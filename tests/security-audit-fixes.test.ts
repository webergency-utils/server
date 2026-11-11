import { describe, it, expect, vi, afterEach } from 'vitest';
import crypto from 'node:crypto';
import net from 'node:net';
import ts from '../src/compiler/ts.js';
import { Server } from '../src/server.js';
import { ServerRequest } from '../src/core/server-request.js';
import { RequestProcessor } from '../src/core/request-processor.js';
import { ServerResponse, serializeCookie, tagDirectResponse } from '../src/core/types.js';
import { hasPublicDecorator } from '../src/compiler/decorator-config.js';
import compilerPlugin from '../src/compiler/transformer.js';
import { SwaggerSpecGenerator, toOpenApiPath } from '../src/compiler/swagger.js';
import { createRegistry } from '../src/compiler/registry.js';
import { handleCors } from '../src/helpers/cors.js';
import { extractHostname, generateSecurityHeaders } from '../src/helpers/security.js';
import { resolveClientIp, TRUST_PROXY_LOOPBACK } from '../src/helpers/client-ip.js';
import { RateLimiter } from '../src/helpers/rate-limiter.js';
import { createFormBag } from '../src/helpers/parsers.js';
import { resolveFieldOptions, FileOptions } from '../src/helpers/file-upload.js';
import { clientErrorBody, redactSecrets, REDACTED } from '../src/helpers/error-response.js';
import { computeBodyHash, verifyBodyHash } from '../src/helpers/body-hash.js';
import { resolveRequestId } from '../src/helpers/request-id.js';
import { attachClientCert, normalizePeerCert } from '../src/helpers/peer-cert.js';
import { MultiBuffer, WebsocketFrame, DEFAULT_MAX_WS_PAYLOAD } from '../src/helpers/ws-frame.js';
import { isWsPayloadTooLarge } from '../src/adapters/ws-upgrade.js';
import { NodeAdapter } from '../src/adapters/node-adapter.js';
import { NdjsonLineFramer } from '../src/microservice/ndjson-framer.js';
import { defineController, ApplicationRegistry, runWithRegistry } from './helpers/testing.js';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

function parseDecoratorsFromClass( code: string ): readonly ts.Decorator[]
{
    const sf = ts.createSourceFile( 'test.ts', code, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS );

    for( const stmt of sf.statements )
    {
        if( ts.isClassDeclaration( stmt ))
        {
            return ts.getDecorators( stmt ) ?? [];
        }
    }

    return [];
}

describe( 'Security Audit Fixes (S1–S13)', () =>
{
    afterEach(() =>
    {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    describe( 'S1: Exact @Public decorator matching in hasPublicDecorator', () =>
    {
        it( 'should not match substring Public in @Controller, @Protect, @Meta, or @PublicApi', () =>
        {
            // Arrange
            const falsePositiveDecorators = parseDecoratorsFromClass( `
                @Controller( '/api/PublicProfile' )
                @Protect( PublicApiKeyGuard )
                @Meta({ scope : 'NotPublic' })
                @PublicApi()
                class ProfileController {}
            ` );
            const exactBareDecorators = parseDecoratorsFromClass( `
                @Public
                class OpenController {}
            ` );
            const exactCallDecorators = parseDecoratorsFromClass( `
                @Public()
                class OpenCallController {}
            ` );

            // Act & Assert
            expect( hasPublicDecorator( falsePositiveDecorators )).toBe( false );
            expect( hasPublicDecorator( exactBareDecorators )).toBe( true );
            expect( hasPublicDecorator( exactCallDecorators )).toBe( true );
        });
    });

    describe( 'S2: Named scalar @Query validation bypass prevention (HPP / operator injection)', () =>
    {
        it( 'should reject arrays, nested objects, and boolean flags on scalar string @Query while preserving boolean flags and string[]', async () =>
        {
            // Arrange
            const tmpBase = path.resolve( `./tmp_s2_${Date.now()}` );
            const tsPath = `${tmpBase}.ts`;
            const jsPath = `${tmpBase}.mjs`;

            const source = `
                import { Controller, Get, Query } from './src/index.js';

                @Controller( '/s2' )
                export class S2Controller
                {
                    @Get( '/user' )
                    getUser( @Query( 'id' ) id: string )
                    {
                        return { id, type : typeof id };
                    }

                    @Get( '/flag' )
                    getFlag( @Query( 'active' ) active: boolean, @Query( 'tags' ) tags?: string[])
                    {
                        return { active, tags };
                    }
                }
            `;

            fs.writeFileSync( tsPath, source );

            try
            {
                const program = ts.createProgram([tsPath], {
                    target                 : ts.ScriptTarget.ES2022,
                    module                 : ts.ModuleKind.NodeNext,
                    moduleResolution       : ts.ModuleResolutionKind.NodeNext,
                    skipLibCheck           : true,
                    experimentalDecorators : true
                });
                const sf = program.getSourceFile( tsPath )!;
                const transformed = ts.transform( sf, [compilerPlugin( program )]);
                const emitted = ts.createPrinter().printFile( transformed.transformed[0]);
                const jsOut = ts.transpileModule( emitted, {
                    compilerOptions : {
                        target : ts.ScriptTarget.ES2022,
                        module : ts.ModuleKind.ES2022
                    }
                }).outputText;
                fs.writeFileSync( jsPath, jsOut );

                const mod = await import( pathToFileURL( jsPath ).href );
                const server = new Server({
                    port        : 0,
                    signals     : false,
                    controllers : [mod.S2Controller]
                });

                // Act — operator injection & HPP attacks against scalar string
                const resNoSql = await server.fetch( new Request( 'http://localhost/s2/user?id[$ne]=admin' ));
                const resHpp = await server.fetch( new Request( 'http://localhost/s2/user?id=one&id=two' ));
                const resBareFlag = await server.fetch( new Request( 'http://localhost/s2/user?id' ));
                const resValid = await server.fetch( new Request( 'http://localhost/s2/user?id=usr_42' ));
                const resBoolAndArr = await server.fetch( new Request( 'http://localhost/s2/flag?active&tags=a&tags=b' ));

                // Assert
                expect( resNoSql.status ).toBe( 400 );
                expect( resHpp.status ).toBe( 400 );
                expect( resBareFlag.status ).toBe( 400 );
                expect( resValid.status ).toBe( 200 );
                expect( await resValid.json()).toEqual({ id : 'usr_42', type : 'string' });
                expect( resBoolAndArr.status ).toBe( 200 );
                expect( await resBoolAndArr.json()).toEqual({ active : true, tags : [ 'a', 'b' ] });
            }
            finally
            {
                if( fs.existsSync( tsPath )) { fs.unlinkSync( tsPath ) }

                if( fs.existsSync( jsPath )) { fs.unlinkSync( jsPath ) }
            }
        });

        it( 'should reject non-string wire values when parser-only scalar metadata lacks a validator', async () =>
        {
            // Arrange
            const sreq = new ServerRequest( new Request( 'http://localhost/items?id=1&id=2' ));
            const ctx = { success : true, errors : [] as Array<{ path : string, error : string }> };

            // Act
            await RequestProcessor.resolveParam(
                {
                    source : 'Query',
                    name   : 'id',
                    parser : ( v: string ) => v
                },
                sreq,
                ctx
            );

            // Assert
            expect( ctx.success ).toBe( false );
            expect( ctx.errors ).toEqual([{ path : 'id', error : 'expected string' }]);
        });
    });

    describe( 'S3: CORS credentials + wildcard reflection refusal and Vary: Origin', () =>
    {
        it( 'should refuse arbitrary Origin reflection when credentials: true is paired with implicit or explicit wildcard', () =>
        {
            // Arrange
            const req = new Request( 'http://localhost/api/me', {
                method  : 'GET',
                headers : { Origin : 'https://attacker.example' }
            });

            // Act
            const implicitWildcard = handleCors( req, { credentials : true }) as Record<string, string>;
            const explicitWildcard = handleCors( req, { origin : '*', credentials : true }) as Record<string, string>;
            const explicitReflect = handleCors( req, { origin : true, credentials : true }) as Record<string, string>;

            // Assert
            expect( implicitWildcard['Access-Control-Allow-Origin']).toBeUndefined();
            expect( implicitWildcard['Access-Control-Allow-Credentials']).toBeUndefined();
            expect( explicitWildcard['Access-Control-Allow-Origin']).toBeUndefined();
            expect( explicitWildcard['Access-Control-Allow-Credentials']).toBeUndefined();
            expect( explicitReflect['Access-Control-Allow-Origin']).toBe( 'https://attacker.example' );
            expect( explicitReflect['Access-Control-Allow-Credentials']).toBe( 'true' );
            expect( explicitReflect['Vary']).toBe( 'Origin' );
        });

        it( 'should always include Vary: Origin for non-wildcard rules even when Origin is absent or disallowed', () =>
        {
            // Arrange
            const noOriginReq = new Request( 'http://localhost/api/data' );
            const badOriginReq = new Request( 'http://localhost/api/data', {
                headers : { Origin : 'https://disallowed.example' }
            });
            const corsConfig = { origin : [ 'https://trusted.example' ] };

            // Act
            const resNoOrigin = handleCors( noOriginReq, corsConfig ) as Record<string, string>;
            const resBadOrigin = handleCors( badOriginReq, corsConfig ) as Record<string, string>;

            // Assert
            expect( resNoOrigin['Vary']).toBe( 'Origin' );
            expect( resBadOrigin['Vary']).toBe( 'Origin' );
            expect( resBadOrigin['Access-Control-Allow-Origin']).toBeUndefined();
        });
    });

    describe( 'S4: Host header path smuggling and absolute-form authority spoofing', () =>
    {
        it( 'should reject unsafe characters and non-IPv6 brackets in extractHostname', () =>
        {
            // Arrange & Act & Assert
            expect( extractHostname( 'localhost/admin/purge?x=' )).toBeNull();
            expect( extractHostname( 'evil\\admin.example.com' )).toBeNull();
            expect( extractHostname( 'user@trusted.example.com' )).toBeNull();
            expect( extractHostname( 'trusted.example.com#frag' )).toBeNull();
            expect( extractHostname( '[not-an-ipv6]' )).toBeNull();
            expect( extractHostname( '[::1]:8080' )).toBe( '[::1]' );
            expect( extractHostname( 'sub.example.com:3000' )).toBe( 'sub.example.com' );
        });

        it( 'should reject path-smuggled Host headers with 400 and ignore absolute-form request-target authorities in NodeAdapter', async () =>
        {
            // Arrange
            const adapter = new NodeAdapter();
            const registry = new ApplicationRegistry();
            let observedUrl = '';

            await runWithRegistry( registry, async () =>
            {
                await adapter.listen( 0, async ( req ) =>
                {
                    observedUrl = req.url;
                    const sreq = new ServerRequest( req );

                    return new Response( JSON.stringify({
                        hostname : sreq.hostname,
                        path     : sreq.path,
                        query    : sreq.query
                    }));
                });
            });

            const port = ( adapter.nodeServer.address() as net.AddressInfo ).port;

            const sendRawHttp = ( rawRequest: string ): Promise<string> =>
                new Promise(( resolve, reject ) =>
                {
                    let buf = '';
                    const sock = net.connect( port, '127.0.0.1', () =>
                    {
                        sock.write( rawRequest );
                    });
                    sock.on( 'data', ( chunk ) => { buf += chunk.toString( 'utf8' ) });
                    sock.on( 'end', () => resolve( buf ));
                    sock.on( 'error', reject );
                });

            try
            {
                // Act 1 — Host path smuggling
                const smuggledRaw = await sendRawHttp(
                    'GET /public HTTP/1.1\r\n' +
                    'Host: localhost/admin/purge?x=\r\n' +
                    'Connection: close\r\n\r\n'
                );

                // Act 2 — Absolute-form request URI spoofing
                const absFormRaw = await sendRawHttp(
                    'GET http://evil.attacker.example/reset?token=abc HTTP/1.1\r\n' +
                    `Host: trusted.example.com:${port}\r\n` +
                    'Connection: close\r\n\r\n'
                );

                // Assert
                expect( smuggledRaw ).toContain( 'HTTP/1.1 400 Bad Request' );
                expect( absFormRaw ).toContain( 'HTTP/1.1 200' );
                expect( observedUrl ).toBe( `http://trusted.example.com:${port}/reset?token=abc` );
                const jsonMatch = absFormRaw.match( /\{[^\r\n]+\}/ );
                expect( jsonMatch ).not.toBeNull();
                expect( JSON.parse( jsonMatch![0])).toEqual({
                    hostname : 'trusted.example.com',
                    path     : '/reset',
                    query    : { token : 'abc' }
                });
            }
            finally
            {
                await adapter.close();
                adapter.closeAllConnections();
            }
        });
    });

    describe( 'S5: WebSocket and Server unhandled error event safety', () =>
    {
        it( 'should not throw ERR_UNHANDLED_ERROR when an upgrade socket errors mid-handshake or after upgrade without error listener', async () =>
        {
            // Arrange
            const adapter = new NodeAdapter();
            const registry = new ApplicationRegistry();
            let releaseHandler!: () => void;
            const gate = new Promise<void>(( r ) => { releaseHandler = r });

            registry.registerEndpoint({
                controller   : 'WsCtrl',
                methodName   : 'chat',
                httpMethod   : 'WS',
                path         : '/ws',
                params       : [],
                guards       : [],
                interceptors : [],
                meta         : {}
            });

            await runWithRegistry( registry, async () =>
            {
                await adapter.listen( 0, async () =>
                {
                    await gate;

                    return new Response( 'Forbidden', { status : 403 });
                });
            });

            const listeners = new Map<string, ( ...args: unknown[]) => void>();
            const fakeUpgradeSocket = {
                destroyed : false,
                on        : vi.fn(( ev: string, cb: ( ...args: unknown[]) => void ) => { listeners.set( ev, cb ) }),
                destroy   : vi.fn( function( this: { destroyed : boolean }) { this.destroyed = true }),
                end       : vi.fn()
            };

            try
            {
                // Act — trigger upgrade, then emit socket error before async handler settles
                adapter.nodeServer.emit(
                    'upgrade',
                    { method : 'GET', url : '/ws', headers : { host : 'localhost' }, socket : fakeUpgradeSocket },
                    fakeUpgradeSocket,
                    Buffer.alloc( 0 )
                );

                expect(() => listeners.get( 'error' )?.( new Error( 'ECONNRESET' ))).not.toThrow();
                expect( fakeUpgradeSocket.destroy ).toHaveBeenCalled();
                releaseHandler();
            }
            finally
            {
                await adapter.close();
            }

            // Also verify post-upgrade NodeServerWebSocket without user ws.on('error')
            const wsListeners = new Map<string, ( ...args: unknown[]) => void>();
            const mockWsSocket = {
                write              : vi.fn(),
                setTimeout         : vi.fn(),
                setNoDelay         : vi.fn(),
                end                : vi.fn(),
                destroy            : vi.fn(),
                removeAllListeners : vi.fn(),
                on                 : vi.fn(( ev: string, cb: ( ...args: unknown[]) => void ) => { wsListeners.set( ev, cb ) })
            };
            vi.spyOn( RequestProcessor, 'runWs' ).mockImplementation(() => {});

            const upgReq = new Request( 'http://localhost/ws', {
                headers : { 'sec-websocket-key' : 'dGhlIHNhbXBsZSBub25jZQ==' }
            }) as Request & { nodeSocket : unknown, nodeHead : Buffer };
            upgReq.nodeSocket = mockWsSocket;
            upgReq.nodeHead = Buffer.alloc( 0 );

            await adapter.upgrade( upgReq, { meta : {}, controller : 'WsCtrl', methodName : 'chat', params : [] }, {});
            expect(() => wsListeners.get( 'error' )?.( new Error( 'RST' ))).not.toThrow();
        });
    });

    describe( 'S6: X-Forwarded-For spoofing and IP canonicalization', () =>
    {
        it( 'should ignore XFF when remoteAddress is missing and parse hex-mapped IPv6 without loopback fallback', () =>
        {
            // Arrange
            const missingPeerReq = new Request( 'http://localhost/', {
                headers : { 'x-forwarded-for' : '198.51.100.77' }
            });
            const hexMappedPeerReq = Object.assign(
                new Request( 'http://localhost/', {
                    headers : { 'x-forwarded-for' : '198.51.100.88' }
                }),
                { remoteAddress : '::ffff:cb00:7105' }
            );

            // Act
            const missingPeerIp = resolveClientIp( missingPeerReq, true );
            const hexMappedIp = resolveClientIp( hexMappedPeerReq, TRUST_PROXY_LOOPBACK );

            // Assert — cb00:7105 is 203.0.113.5 (not loopback), so XFF is ignored!
            expect( missingPeerIp ).toBe( '127.0.0.1' );
            expect( hexMappedIp ).toBe( '203.0.113.5' );
        });

        it( 'should strip port on IPv4 XFF hops, stop on malformed hops, and canonicalize IPv4/IPv6', () =>
        {
            // Arrange
            const portHopReq = Object.assign(
                new Request( 'http://localhost/', {
                    headers : { 'x-forwarded-for' : '198.51.100.1, 203.0.113.9:54321' }
                }),
                { remoteAddress : '127.0.0.1' }
            );
            const malformedHopReq = Object.assign(
                new Request( 'http://localhost/', {
                    headers : { 'x-forwarded-for' : '198.51.100.1, unknown, 127.0.0.1' }
                }),
                { remoteAddress : '127.0.0.1' }
            );
            const nonCanonicalV6Req = Object.assign(
                new Request( 'http://localhost/', {
                    headers : { 'x-forwarded-for' : '2001:0db8:0000:0000:0000:0000:0000:0001' }
                }),
                { remoteAddress : '127.0.0.1' }
            );
            const octalLikeV4Req = Object.assign(
                new Request( 'http://localhost/', {
                    headers : { 'x-forwarded-for' : '010.000.000.001' }
                }),
                { remoteAddress : '127.0.0.1' }
            );
            const invalidTrailingDoubleColonReq = Object.assign(
                new Request( 'http://localhost/' ),
                { remoteAddress : '1:2:3:4:5:6:7:8::' }
            );

            // Act & Assert
            expect( resolveClientIp( portHopReq, TRUST_PROXY_LOOPBACK )).toBe( '203.0.113.9' );
            expect( resolveClientIp( malformedHopReq, TRUST_PROXY_LOOPBACK )).toBe( '127.0.0.1' );
            expect( resolveClientIp( nonCanonicalV6Req, TRUST_PROXY_LOOPBACK )).toBe( '2001:db8::1' );
            expect( resolveClientIp( octalLikeV4Req, TRUST_PROXY_LOOPBACK )).toBe( '10.0.0.1' );
            expect( resolveClientIp( invalidTrailingDoubleColonReq )).toBe( '127.0.0.1' );
        });
    });

    describe( 'S7: RateLimiter per-method bucket isolation', () =>
    {
        it( 'should isolate POST rate limits from GET requests on the same path and IP', () =>
        {
            // Arrange
            const limiter = new RateLimiter();
            const postRule = { max : 2, window : '15m' };
            const getRule = { max : 60, window : '1s' };

            // Act — exhaust POST /login
            expect( limiter.consume( '203.0.113.10', '/login', postRule, 'POST' ).allowed ).toBe( true );
            expect( limiter.consume( '203.0.113.10', '/login', postRule, 'POST' ).allowed ).toBe( true );
            expect( limiter.consume( '203.0.113.10', '/login', postRule, 'POST' ).allowed ).toBe( false );

            // Interleave GET /login with short 1s window
            expect( limiter.consume( '203.0.113.10', '/login', getRule, 'GET' ).allowed ).toBe( true );

            // Assert — POST /login remains locked out!
            const postAfterGet = limiter.consume( '203.0.113.10', '/login', postRule, 'POST' );
            expect( postAfterGet.allowed ).toBe( false );
        });
    });

    describe( 'S8: Sparse-array DoS, bracket depth cap, and bounded upload field cache', () =>
    {
        it( 'should not allocate multi-billion sparse arrays on huge numeric bracket indices', () =>
        {
            // Arrange
            const parsed = createFormBag();
            const normalArr = createFormBag();

            // Act
            parsed.assign( 'items[2147483646]', 'boom' );
            parsed.assign( 'items[0]', 'ok' );
            normalArr.assign( 'list[0]', 'first' );
            normalArr.assign( 'list[1]', 'second' );

            // Assert
            expect( Array.isArray( parsed.items )).toBe( false );
            expect( parsed.items ).toEqual({ '0' : 'ok', '2147483646' : 'boom' });
            expect( Array.isArray( normalArr.list )).toBe( true );
            expect( normalArr.list ).toEqual([ 'first', 'second' ]);
        });

        it( 'should bound deep bracket chains without stack overflow and avoid caching arbitrary upload field names', () =>
        {
            // Arrange
            const deepKey = 'root' + '[a]'.repeat( 80 );
            const fileOpts: FileOptions = {
                maxFileSize : '2mb',
                fields      : {
                    avatar : { maxFileSize : '512kb' }
                }
            };
            const deepParsed = createFormBag();

            // Act
            deepParsed.assign( deepKey, 'leaf' );
            const avatarResolved = resolveFieldOptions( fileOpts, 'avatar' );
            const random1 = resolveFieldOptions( fileOpts, 'random_field_1' );
            const random2 = resolveFieldOptions( fileOpts, 'random_field_2' );

            // Assert
            expect( deepParsed.root ).toBeDefined();
            expect( avatarResolved.maxFileSize ).toBe( '512kb' );
            expect( random1 ).toBe( random2 );
            expect( random1.maxFileSize ).toBe( '2mb' );
        });
    });

    describe( 'S9: 5xx error masking by default and comprehensive secret redaction', () =>
    {
        it( 'should mask unhandled 5xx error messages on Server by default and expose them only when exposeErrors: true', async () =>
        {
            // Arrange
            class CrashController
            {
                crash()
                {
                    throw new Error( 'SELECT * FROM users WHERE secret_key = "xyz"' );
                }
            }
            defineController( CrashController, [{
                methodName : 'crash',
                httpMethod : 'GET',
                path       : '/crash'
            }]);

            const defaultServer = new Server({ port : 0, signals : false, controllers : [CrashController] });
            const debugServer = new Server({ port : 0, signals : false, exposeErrors : true, controllers : [CrashController] });

            // Act
            const maskedRes = await defaultServer.fetch( new Request( 'http://localhost/crash' ));
            const exposedRes = await debugServer.fetch( new Request( 'http://localhost/crash' ));

            // Assert
            expect( maskedRes.status ).toBe( 500 );
            expect( await maskedRes.json()).toEqual({
                success : false,
                error   : 'Internal server error'
            });
            expect( exposedRes.status ).toBe( 500 );
            expect(( await exposedRes.json()).error ).toContain( 'SELECT * FROM users' );
        });

        it( 'should redact case-insensitive secrets, preserve Date/RegExp/URL, support DAG refs, and break circular refs', () =>
        {
            // Arrange
            const sharedLeaf = { label : 'ok', apiKey : 'sk_live_123' };
            const cyclic: Record<string, unknown> = {
                createdAt     : new Date( '2026-01-01T00:00:00.000Z' ),
                pattern       : /abc/i,
                endpoint      : new URL( 'https://example.com/hook' ),
                Access_Token  : 'tok_secret',
                Authorization : 'Bearer xyz',
                first         : sharedLeaf,
                second        : sharedLeaf
            };
            cyclic.self = cyclic;

            // Act
            const redacted = redactSecrets( cyclic ) as Record<string, unknown>;
            const serialized = JSON.stringify( clientErrorBody({ status : 400, data : cyclic }, 400 ));

            // Assert
            expect( redacted.Access_Token ).toBe( REDACTED );
            expect( redacted.Authorization ).toBe( REDACTED );
            expect( redacted.createdAt ).toBeInstanceOf( Date );
            expect( redacted.pattern ).toBeInstanceOf( RegExp );
            expect( redacted.endpoint ).toBeInstanceOf( URL );
            expect( redacted.first ).toEqual({ label : 'ok', apiKey : REDACTED });
            expect( redacted.second ).toEqual({ label : 'ok', apiKey : REDACTED });
            expect( redacted.self ).toBe( '[Circular]' );
            expect( serialized ).not.toContain( 'sk_live_123' );
            expect( serialized ).not.toContain( 'tok_secret' );
        });
    });

    describe( 'S10: @BodyHash missing-key protection and timing-safe verifyBodyHash', () =>
    {
        it( 'should throw when options.key is present but undefined or empty instead of downgrading to unkeyed hash', () =>
        {
            // Arrange
            const raw = new TextEncoder().encode( '{"event":"charge.succeeded"}' ).buffer;

            // Act & Assert
            expect(() => computeBodyHash( raw, 'sha256', { key : undefined, encoding : 'hex' }))
                .toThrow( /BodyHash HMAC key must be a non-empty string or Buffer/ );
            expect(() => computeBodyHash( raw, 'sha256', { key : '', encoding : 'hex' }))
                .toThrow( /BodyHash HMAC key must be a non-empty string or Buffer/ );
        });

        it( 'should verify valid HMAC signatures in constant time and reject tampered ones via verifyBodyHash', () =>
        {
            // Arrange
            const raw = new TextEncoder().encode( '{"id":"evt_1"}' ).buffer;
            const secret = 'whsec_test_secret';
            const computedHex = computeBodyHash( raw, 'sha256', { key : secret, encoding : 'hex' }) as string;
            const expectedHex = crypto.createHmac( 'sha256', secret ).update( '{"id":"evt_1"}' ).digest( 'hex' );

            // Act & Assert
            expect( verifyBodyHash( computedHex, expectedHex )).toBe( true );
            expect( verifyBodyHash( `sha256=${computedHex}`, `sha256=${expectedHex}` )).toBe( true );
            expect( verifyBodyHash( computedHex, 'deadbeef' )).toBe( false );
            expect( verifyBodyHash( computedHex, '0'.repeat( computedHex.length ))).toBe( false );
            expect( verifyBodyHash( computedHex, '' )).toBe( false );
            expect( verifyBodyHash( computedHex, undefined )).toBe( false );
        });
    });

    describe( 'S11: WebSocket CSWSH @Cors origin enforcement, Blob.size check, and DEFAULT_MAX_WS_PAYLOAD', () =>
    {
        it( 'should reject cross-origin WebSocket upgrades when @Cors disallows the Origin', async () =>
        {
            // Arrange
            class WsChatCtrl
            {
                chat() {}
            }
            defineController( WsChatCtrl, [{
                methodName : 'chat',
                httpMethod : 'WS',
                path       : '/ws/chat',
                cors       : { origin : 'https://app.example.com' }
            }]);

            const upgradeSpy = vi.fn( async () => new Response( null, { status : 200 }));
            const server = new Server({
                port        : 0,
                signals     : false,
                controllers : [WsChatCtrl]
            });
            ( server as unknown as { serverAdapter : unknown }).serverAdapter = {
                listen  : async () => {},
                close   : async () => {},
                upgrade : upgradeSpy
            };

            // Act
            const rejected = await server.fetch( new Request( 'http://localhost/ws/chat', {
                headers : {
                    Upgrade : 'websocket',
                    Origin  : 'https://evil.example.com'
                }
            }));
            const allowed = await server.fetch( new Request( 'http://localhost/ws/chat', {
                headers : {
                    Upgrade : 'websocket',
                    Origin  : 'https://app.example.com'
                }
            }));

            // Assert
            expect( rejected.status ).toBe( 403 );
            expect( upgradeSpy ).toHaveBeenCalledTimes( 1 );
            expect( allowed.status ).toBe( 200 );
        });

        it( 'should enforce Blob.size in isWsPayloadTooLarge and DEFAULT_MAX_WS_PAYLOAD in WebsocketFrame.read', () =>
        {
            // Arrange
            const blob = new Blob([ new Uint8Array( 10 ) ]);
            const rx = new MultiBuffer();
            // Masked binary frame advertising 16 MiB + 1 byte via 64-bit extended length
            const overDefaultLen = DEFAULT_MAX_WS_PAYLOAD + 1;
            const header = Buffer.alloc( 10 );
            header[0] = 0x82;
            header[1] = 0xff;
            header.writeUInt32BE( 0, 2 );
            header.writeUInt32BE( overDefaultLen, 6 );
            rx.append( header );

            const events: string[] = [];

            // Act
            WebsocketFrame.read( rx, ( ev ) => { events.push( ev ) });

            // Assert
            expect( isWsPayloadTooLarge( blob, 5 )).toBe( true );
            expect( isWsPayloadTooLarge( blob, 12 )).toBe( false );
            expect( events ).toEqual([ 'limit_exceeded' ]);
        });
    });

    describe( 'S12: mTLS @Peer authorization verification', () =>
    {
        it( 'should refuse unverified peer certificates when socket.authorized is false', () =>
        {
            // Arrange
            const rawCert = {
                subject      : { CN : 'forged-admin' },
                issuer       : { CN : 'self-signed' },
                serialNumber : 'DEADBEEF'
            };
            const reqUnverified = new Request( 'https://localhost/admin' );
            const reqVerified = new Request( 'https://localhost/admin' );

            // Act
            attachClientCert( reqUnverified, rawCert, false );
            attachClientCert( reqVerified, rawCert, true );
            const normalizedFalse = normalizePeerCert( rawCert, false );

            // Assert
            expect(( reqUnverified as Request & { clientCert? : unknown }).clientCert ).toBeUndefined();
            expect(( reqVerified as Request & { clientCert? : { authorized? : boolean } }).clientCert?.authorized ).toBe( true );
            expect( normalizedFalse?.authorized ).toBe( false );
        });
    });

    describe( 'S13: SSE frame injection, Cookie Path/Domain injection, Request-Id cap, Security headers, and NdjsonLineFramer', () =>
    {
        it( 'should sanitize CRLF in SSE event/id fields, omit undefined id, and split multi-line string data', async () =>
        {
            // Arrange
            class SseCtrl
            {
                async *stream()
                {
                    yield {
                        id    : undefined,
                        event : 'update\r\ndata: {"injected":true}',
                        data  : 'first line\nsecond line'
                    };
                }
            }
            defineController( SseCtrl, [{
                methodName : 'stream',
                httpMethod : 'GET',
                path       : '/events',
                meta       : { sse : true }
            }]);

            const server = new Server({ port : 0, signals : false, controllers : [SseCtrl] });

            // Act
            const res = await server.fetch( new Request( 'http://localhost/events' ));
            const text = await res.text();

            // Assert
            expect( text ).not.toContain( 'id: undefined' );
            expect( text ).toContain( 'event: update data: {"injected":true}\n' );
            expect( text ).toContain( 'data: first line\ndata: second line\n\n' );
        });

        it( 'should reject semicolons or CRLF in serializeCookie domain and path', () =>
        {
            // Arrange & Act & Assert
            expect(() => serializeCookie( 'sid', '123', { path : '/; HttpOnly=false' }))
                .toThrow( /Invalid cookie Path attribute value/ );
            expect(() => serializeCookie( 'sid', '123', { domain : 'example.com\r\nSet-Cookie: evil=1' }))
                .toThrow( /Invalid cookie Domain attribute value/ );
        });

        it( 'should cap X-Request-Id length and reject control/non-ASCII characters', () =>
        {
            // Arrange
            const oversizedReq = new Request( 'http://localhost/', {
                headers : { 'x-request-id' : 'a'.repeat( 200 ) }
            });
            const ansiReq = new Request( 'http://localhost/', {
                headers : { 'x-request-id' : 'req-\x1b[31minjected' }
            });
            const cleanReq = new Request( 'http://localhost/', {
                headers : { 'x-request-id' : 'req-valid-123' }
            });

            // Act & Assert
            expect( resolveRequestId( oversizedReq )).toMatch( /^[0-9a-f-]{36}$/i );
            expect( resolveRequestId( ansiReq )).toMatch( /^[0-9a-f-]{36}$/i );
            expect( resolveRequestId( cleanReq )).toBe( 'req-valid-123' );
        });

        it( 'should validate COEP/COOP/CORP/CSP headers, freeze cached maps, and pre-check NdjsonLineFramer byte length', () =>
        {
            // Arrange & Act
            const headers = generateSecurityHeaders({
                coep : 'invalid-policy\r\nX-Evil: 1' as unknown as 'require-corp',
                coop : 'same-origin',
                corp : 'same-site',
                csp  : {
                    'default-src' : [ "'self'", 'https://cdn.example; evil-directive' ]
                }
            });
            const framer = new NdjsonLineFramer( 16 );
            const oversizedString = framer.push( 'x'.repeat( 64 ));

            // Assert
            expect( Object.isFrozen( headers )).toBe( true );
            expect( headers['Cross-Origin-Embedder-Policy']).toBeUndefined();
            expect( headers['Cross-Origin-Opener-Policy']).toBe( 'same-origin' );
            expect( headers['Cross-Origin-Resource-Policy']).toBe( 'same-site' );
            expect( headers['Content-Security-Policy']).toBe( "default-src 'self'" );
            expect( oversizedString ).toEqual({ lines : [], oversized : true });
        });

        it( 'should enforce passive maxBytes cutoff on ServerRequest.stream(maxBytes)', async () =>
        {
            // Arrange
            const chunks = [ new Uint8Array( 6 ), new Uint8Array( 6 ) ];
            let index = 0;
            const body = new ReadableStream<Uint8Array>({
                pull( controller )
                {
                    if( index < chunks.length )
                    {
                        controller.enqueue( chunks[index++]);
                    }
                    else
                    {
                        controller.close();
                    }
                }
            });
            const sreq = new ServerRequest( new Request( 'http://localhost/upload', {
                method : 'POST',
                body,
                // @ts-expect-error duplex half required by Fetch streaming Request
                duplex : 'half'
            }));

            // Act
            const reader = sreq.stream( 10 )!.getReader();
            const first = await reader.read();

            // Assert
            expect( first.done ).toBe( false );
            await expect( reader.read()).rejects.toMatchObject({ status : 413 });
        });

        it( 'should default ServerRequest.stream() cap to resolved route maxBodySize / files.maxTotalSize and support opt-out', async () =>
        {
            // Arrange — route maxBodySize = 8 bytes (no explicit arg to stream())
            const makeChunkedReq = ( sizes: number[], headers?: Record<string, string> ) =>
            {
                let i = 0;
                const body = new ReadableStream<Uint8Array>({
                    pull( controller )
                    {
                        if( i < sizes.length )
                        {
                            controller.enqueue( new Uint8Array( sizes[i++]));
                        }
                        else
                        {
                            controller.close();
                        }
                    }
                });

                return new Request( 'http://localhost/upload', {
                    method : 'POST',
                    headers,
                    body,
                    // @ts-expect-error duplex half required by Fetch streaming Request
                    duplex : 'half'
                });
            };

            const defaultCapped = new ServerRequest(
                makeChunkedReq([ 5, 5 ]),
                { security : { maxBodySize : 8 } }
            );
            const contentLengthTooBig = new ServerRequest(
                makeChunkedReq([ 4 ], { 'content-length' : '25' }),
                { security : { maxBodySize : 10 } }
            );
            const badContentLength = new ServerRequest(
                makeChunkedReq([ 4 ], { 'content-length' : '10abc' }),
                { security : { maxBodySize : 10 } }
            );
            const fileRouteCapped = new ServerRequest(
                makeChunkedReq([ 6, 6 ]),
                {
                    security   : { maxBodySize : 100 },
                    routeFiles : { maxTotalSize : 10 }
                }
            );
            const optedOut = new ServerRequest(
                makeChunkedReq([ 12, 12 ]),
                { security : { maxBodySize : 8 } }
            );

            // Act & Assert
            const defaultReader = defaultCapped.stream().getReader();
            expect(( await defaultReader.read()).done ).toBe( false );
            await expect( defaultReader.read()).rejects.toMatchObject({ status : 413 });

            expect(() => contentLengthTooBig.stream()).toThrow(
                expect.objectContaining({ status : 413 })
            );
            expect(() => badContentLength.stream()).toThrow(
                expect.objectContaining({ status : 400 })
            );

            const fileReader = fileRouteCapped.stream().getReader();
            expect(( await fileReader.read()).done ).toBe( false );
            await expect( fileReader.read()).rejects.toMatchObject({ status : 413 });

            const optOutReader = optedOut.stream( 0 ).getReader();
            expect(( await optOutReader.read()).value?.byteLength ).toBe( 12 );
            expect(( await optOutReader.read()).value?.byteLength ).toBe( 12 );
            expect(( await optOutReader.read()).done ).toBe( true );
        });
    });

    describe( 'CodeQL Security Alerts (#55, #56, #57)', () =>
    {
        it( 'Alert #55: toOpenApiPath should convert route patterns in linear O(n) time without polynomial backtracking', () =>
        {
            // Arrange
            const adversarial = ':0('.repeat( 30000 );

            // Act
            const start = performance.now();
            const convertedAdversarial = toOpenApiPath( adversarial );
            const elapsedMs = performance.now() - start;

            // Assert
            expect( toOpenApiPath( '/users/:id(\\d+)?/files/*filepath/*' )).toBe(
                '/users/{id}/files/{filepath}/{wildcard}'
            );
            expect( toOpenApiPath( 'math.sum' )).toBe( 'math.sum' );
            expect( convertedAdversarial.startsWith( '{0}(' )).toBe( true );
            expect( elapsedMs ).toBeLessThan( 200 );
        });

        it( 'Alert #56: SwaggerSpecGenerator.generate should not pollute Object.prototype on __proto__ route paths', () =>
        {
            // Arrange
            const tmpDir = fs.mkdtempSync( path.join( os.tmpdir(), 'wu-sec-swag-' ));
            const ctrlFile = path.join( tmpDir, 'proto.controller.ts' );
            fs.writeFileSync(
                ctrlFile,
                'export class ProtoCtrl { ping(): { ok: boolean } { return { ok: true }; } }\n',
                'utf8'
            );

            try
            {
                const program = ts.createProgram([ ctrlFile ], {
                    target : ts.ScriptTarget.ES2022,
                    module : ts.ModuleKind.NodeNext
                });
                const projRegistry = createRegistry();
                projRegistry.controllers.set( 'ProtoCtrl', {
                    path       : ctrlFile,
                    injections : new Map()
                });
                projRegistry.endpoints.push({
                    controller   : 'ProtoCtrl',
                    methodName   : 'ping',
                    httpMethod   : 'GET',
                    path         : '__proto__',
                    params       : [],
                    guards       : [],
                    interceptors : [],
                    meta         : {}
                });

                // Act
                SwaggerSpecGenerator.generate( projRegistry, program, tmpDir );

                // Assert
                expect(({} as Record<string, unknown> ).get ).toBeUndefined();
                const rawSpec = fs.readFileSync( path.join( tmpDir, 'swagger.json' ), 'utf8' );
                expect( rawSpec ).toContain( '"__proto__"' );
                expect( rawSpec ).toContain( '"ProtoCtrl_ping"' );
            }
            finally
            {
                fs.rmSync( tmpDir, { recursive : true, force : true });
            }
        });

        it( 'Alert #57: ServerResponse.applyTo and error handling should isolate direct bodies via WeakMap and never expose stack traces', async () =>
        {
            // Arrange
            const directRes = tagDirectResponse( new Response( '{"ok":true}', {
                status  : 200,
                headers : { 'Content-Type' : 'application/json' }
            }), '{"ok":true}' );
            const bag = new ServerResponse().status( 201 ).header( 'X-Bag', '1' );

            class CrashCtrl
            {
                boom( res: ServerResponse ): never
                {
                    res.status( 502 ).header( 'X-Middleware', 'applied' );

                    throw new Error( 'Secret internal explosion' );
                }
            }
            defineController( CrashCtrl, [{
                methodName : 'boom',
                httpMethod : 'GET',
                path       : '/boom',
                params     : [{ source : 'Response' }]
            }]);

            const server = new Server({
                controllers  : [CrashCtrl],
                exposeErrors : false,
                security     : false
            });

            // Act
            const merged = bag.applyTo( directRes );
            const errRes = await server.fetch( new Request( 'http://localhost/boom' ));
            const errJson = await errRes.json();

            // Assert
            expect( Object.getOwnPropertySymbols( directRes )).toEqual(
                Object.getOwnPropertySymbols( new Response( '{"ok":true}' ))
            );
            expect( Symbol.for( 'webergency.server.directBody' ) in directRes ).toBe( false );
            expect( merged.status ).toBe( 201 );
            expect( merged.headers.get( 'x-bag' )).toBe( '1' );
            expect( await merged.text()).toBe( '{"ok":true}' );
            expect( errRes.status ).toBe( 502 );
            expect( errRes.headers.get( 'x-middleware' )).toBe( 'applied' );
            expect( errJson ).toEqual({ success : false, error : 'Internal server error' });
            expect( JSON.stringify( errJson )).not.toContain( 'Secret internal explosion' );
            expect( JSON.stringify( errJson )).not.toContain( 'at CrashCtrl' );
        });
    });
});
