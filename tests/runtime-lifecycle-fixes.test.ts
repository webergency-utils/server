import { describe, it, expect, vi, afterEach } from 'vitest';
import crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import { Server } from '../src/server.js';
import { ServerRequest } from '../src/core/server-request.js';
import { ServerResponse, serializeCookie } from '../src/core/types.js';
import { RequestProcessor } from '../src/core/request-processor.js';
import { bootstrapRegistry } from '../src/core/bootstrap.js';
import { Scope } from '../src/decorators.js';
import { ParseError } from '../src/errors.js';
import { handleCors } from '../src/helpers/cors.js';
import {
    parseContentDisposition,
    parseHeaderValueParameter,
    extractMultipartBoundary,
    clearHeaderValueCache
} from '../src/helpers/http-header-parse.js';
import { MultipartPayload, UploadedFile } from '../src/helpers/multipart.js';
import { openFileStorage } from '../src/helpers/file-upload.js';
import { parseAnyQuery } from '../src/helpers/reviver.js';
import { computeBodyHash } from '../src/helpers/body-hash.js';
import { MultiBuffer, WebsocketFrame } from '../src/helpers/ws-frame.js';
import { truncateWsReason, isValidWsHandshakeKey } from '../src/adapters/ws-upgrade.js';
import { WsHeartbeat } from '../src/adapters/ws-heartbeat.js';
import { DenoAdapter } from '../src/adapters/deno-adapter.js';
import { Microservice } from '../src/microservice/microservice.js';
import { TcpMessageAdapter } from '../src/microservice/tcp-adapter.js';
import { TcpClient } from '../src/microservice/tcp-client.js';
import {
    defineController,
    setInjectableMeta,
    setModuleMeta,
    ApplicationRegistry,
    runWithRegistry
} from './helpers/testing.js';

const isNodeRuntime =
    typeof ( globalThis as { Bun? : unknown }).Bun === 'undefined'
    && typeof ( globalThis as { Deno? : unknown }).Deno === 'undefined';

describe( 'Runtime, DI, Protocol, WebSocket & Microservice Fixes (#9–#28)', () =>
{
    afterEach(() =>
    {
        vi.restoreAllMocks();
        vi.useRealTimers();
        clearHeaderValueCache();
    });

    describe( 'Bug #9: Null-body HTTP statuses (204/205/304) and immutable Response headers', () =>
    {
        it( 'should return null body for 204 and 304 void controller responses without throwing TypeError', async () =>
        {
            // Arrange
            class NoContentCtrl
            {
                remove( res: ServerResponse ): void
                {
                    res.status( 204 ).header( 'X-Removed', '1' );
                }

                notModified( res: ServerResponse ): void
                {
                    res.status( 304 ).header( 'ETag', '"v1"' );
                }
            }
            defineController( NoContentCtrl, [
                {
                    methodName : 'remove',
                    httpMethod : 'DELETE',
                    path       : '/items/1',
                    params     : [{ source : 'Response' }]
                },
                {
                    methodName : 'notModified',
                    httpMethod : 'GET',
                    path       : '/items/cached',
                    params     : [{ source : 'Response' }]
                }
            ]);

            const server = new Server({ controllers : [NoContentCtrl], security : false });

            // Act
            const res204 = await server.fetch( new Request( 'http://localhost/items/1', { method : 'DELETE' }));
            const res304 = await server.fetch( new Request( 'http://localhost/items/cached' ));

            // Assert
            expect( res204.status ).toBe( 204 );
            expect( res204.headers.get( 'X-Removed' )).toBe( '1' );
            expect( await res204.text()).toBe( '' );
            expect( res304.status ).toBe( 304 );
            expect( res304.headers.get( 'ETag' )).toBe( '"v1"' );
            expect( await res304.text()).toBe( '' );
        });

        it( 'should apply ServerResponse headers and cookies onto Response.redirect with immutable headers', () =>
        {
            // Arrange
            const redirectRes = Response.redirect( 'https://example.com/login', 302 );
            const serverRes = new ServerResponse();
            serverRes.header( 'X-Trace', 'trace-1' );
            serverRes.cookie( 'sid', 'abc', { httpOnly : true });

            // Act
            const applied = serverRes.applyTo( redirectRes );

            // Assert
            expect( applied.status ).toBe( 302 );
            expect( applied.headers.get( 'Location' )).toBe( 'https://example.com/login' );
            expect( applied.headers.get( 'X-Trace' )).toBe( 'trace-1' );
            expect( applied.headers.getSetCookie()).toEqual([ 'sid=abc; HttpOnly' ]);
        });
    });

    describe( 'Bug #10: Error headers preservation and 5xx error observability hooks', () =>
    {
        it( 'should preserve err.headers (Record and Headers) and invoke server error event + logger.error on 500', async () =>
        {
            // Arrange
            const observedErrors: unknown[] = [];
            const loggerErrorSpy = vi.fn();

            class ErrCtrl
            {
                throttled(): never
                {
                    throw Object.assign( new Error( 'Slow down' ), {
                        status  : 429,
                        headers : { 'Retry-After' : '60', 'X-Limit' : '0' }
                    });
                }

                authChallenge(): never
                {
                    const hdrs = new Headers({ 'WWW-Authenticate' : 'Bearer realm="api"' });

                    throw Object.assign( new Error( 'Auth required' ), {
                        status  : 401,
                        headers : hdrs
                    });
                }

                crash(): never
                {
                    throw new Error( 'Database exploded' );
                }
            }
            defineController( ErrCtrl, [
                { methodName : 'throttled', httpMethod : 'GET', path : '/throttled' },
                { methodName : 'authChallenge', httpMethod : 'GET', path : '/challenge' },
                { methodName : 'crash', httpMethod : 'GET', path : '/crash' }
            ]);

            const server = new Server({
                controllers : [ErrCtrl],
                security    : false,
                logs        : true,
                logger      : {
                    info  : vi.fn(),
                    warn  : vi.fn(),
                    error : loggerErrorSpy,
                    debug : vi.fn()
                }
            });
            server.on( 'error', ( err: unknown ) =>
            {
                observedErrors.push( err );
            });

            // Act
            const res429 = await server.fetch( new Request( 'http://localhost/throttled' ));
            const res401 = await server.fetch( new Request( 'http://localhost/challenge' ));
            const res500 = await server.fetch( new Request( 'http://localhost/crash' ));

            // Assert
            expect( res429.status ).toBe( 429 );
            expect( res429.headers.get( 'Retry-After' )).toBe( '60' );
            expect( res429.headers.get( 'X-Limit' )).toBe( '0' );
            expect( res401.status ).toBe( 401 );
            expect( res401.headers.get( 'WWW-Authenticate' )).toBe( 'Bearer realm="api"' );
            expect( res500.status ).toBe( 500 );
            expect( await res500.json()).toEqual({ success : false, error : 'Internal server error' });
            expect( observedErrors ).toHaveLength( 1 );
            expect(( observedErrors[0] as Error ).message ).toBe( 'Database exploded' );
            expect( loggerErrorSpy ).toHaveBeenCalledTimes( 1 );
        });
    });

    describe( 'Bugs #11, #12 & #13: Cross-module singletons, factory declaringModule & subclass @Inject order', () =>
    {
        it( 'Bug #11 & #12: should share exported singletons across consumer modules and resolve private deps of exported factory providers', async () =>
        {
            // Arrange
            let sharedConstructCount = 0;

            class SharedPool
            {
                public readonly id : number;

                constructor()
                {
                    sharedConstructCount++;
                    this.id = sharedConstructCount;
                }
            }
            setInjectableMeta( SharedPool, { kind : 'provider', token : 'SharedPool', scope : Scope.SINGLETON });

            class CoreModule {}
            setModuleMeta( CoreModule, {
                providers : [
                    SharedPool,
                    { token : 'PRIVATE_DSN', value : 'postgres://internal:5432/db' },
                    {
                        token   : 'DB_CONN',
                        factory : ( dsn: string, pool: SharedPool ) => ({ dsn, poolId : pool.id }),
                        inject  : [ 'PRIVATE_DSN', 'SharedPool' ]
                    }
                ],
                exports : [ SharedPool, 'DB_CONN' ]
            });

            class ConsumerACtrl
            {
                constructor(
                    public readonly pool: SharedPool,
                    public readonly conn: { dsn : string, poolId : number }
                ) {}

                info()
                {
                    return { poolId : this.pool.id, conn : this.conn };
                }
            }
            Object.defineProperty( ConsumerACtrl, '__injections__', {
                value : { constructorDeps : [ 'SharedPool', 'DB_CONN' ] }
            });
            defineController( ConsumerACtrl, [
                { methodName : 'info', httpMethod : 'GET', path : '/a' }
            ]);

            class ConsumerBCtrl
            {
                constructor(
                    public readonly pool: SharedPool,
                    public readonly conn: { dsn : string, poolId : number }
                ) {}

                info()
                {
                    return { poolId : this.pool.id, conn : this.conn };
                }
            }
            Object.defineProperty( ConsumerBCtrl, '__injections__', {
                value : { constructorDeps : [ 'SharedPool', 'DB_CONN' ] }
            });
            defineController( ConsumerBCtrl, [
                { methodName : 'info', httpMethod : 'GET', path : '/b' }
            ]);

            class ModuleA {}
            setModuleMeta( ModuleA, { imports : [CoreModule], controllers : [ConsumerACtrl] });

            class ModuleB {}
            setModuleMeta( ModuleB, { imports : [CoreModule], controllers : [ConsumerBCtrl] });

            class AppModule {}
            setModuleMeta( AppModule, { imports : [ ModuleA, ModuleB ] });

            const server = new Server({ module : AppModule, security : false });

            // Act
            const resA = await server.fetch( new Request( 'http://localhost/a' ));
            const resB = await server.fetch( new Request( 'http://localhost/b' ));
            const bodyA = await resA.json() as { poolId : number, conn : { dsn : string, poolId : number } };
            const bodyB = await resB.json() as { poolId : number, conn : { dsn : string, poolId : number } };

            // Assert
            expect( sharedConstructCount ).toBe( 1 );
            expect( bodyA ).toEqual({
                poolId : 1,
                conn   : { dsn : 'postgres://internal:5432/db', poolId : 1 }
            });
            expect( bodyB ).toEqual({
                poolId : 1,
                conn   : { dsn : 'postgres://internal:5432/db', poolId : 1 }
            });
        });

        it( 'Bug #13: should apply parent propertyDeps first so subclass @Inject overrides win', async () =>
        {
            // Arrange
            class BaseService
            {
                public role = '';
                public baseOnly = '';
            }
            Object.defineProperty( BaseService, '__injections__', {
                value : {
                    propertyDeps : {
                        role     : 'BASE_ROLE',
                        baseOnly : 'BASE_ONLY'
                    }
                }
            });

            class ChildService extends BaseService {}
            Object.defineProperty( ChildService, '__injections__', {
                value : {
                    propertyDeps : {
                        role : 'CHILD_ROLE'
                    }
                }
            });
            setInjectableMeta( ChildService, { kind : 'provider', token : 'ChildService', scope : Scope.SINGLETON });

            class PropModule {}
            setModuleMeta( PropModule, {
                providers : [
                    { token : 'BASE_ROLE', value : 'viewer' },
                    { token : 'BASE_ONLY', value : 'inherited' },
                    { token : 'CHILD_ROLE', value : 'admin' },
                    ChildService
                ]
            });

            const registry = new ApplicationRegistry();

            // Act
            await runWithRegistry( registry, async () =>
            {
                bootstrapRegistry( registry, { module : PropModule });
                await registry.resolveAll();
            });
            const modInst = registry.getModuleInstance( PropModule );
            const resolved = await registry.getInjectable( 'ChildService', modInst ) as ChildService;

            // Assert
            expect( resolved.baseOnly ).toBe( 'inherited' );
            expect( resolved.role ).toBe( 'admin' );
        });
    });

    describe( 'Bugs #14 & #15: Concurrent ensureReady() deduplication and EventEmitter API parity', () =>
    {
        it( 'Bug #14: should execute async onInit() only once across concurrent server.fetch() calls', async () =>
        {
            // Arrange
            let initCount = 0;

            class SlowInitProvider
            {
                async onInit(): Promise<void>
                {
                    initCount++;
                    await new Promise( r => setTimeout( r, 30 ));
                }
            }
            setInjectableMeta( SlowInitProvider, { kind : 'provider', token : 'SlowInitProvider', scope : Scope.SINGLETON });

            class PingCtrl
            {
                ping()
                {
                    return { ok : true };
                }
            }
            defineController( PingCtrl, [
                { methodName : 'ping', httpMethod : 'GET', path : '/ping' }
            ]);

            const server = new Server({
                providers   : [SlowInitProvider],
                controllers : [PingCtrl],
                security    : false
            });

            // Act
            const [ r1, r2, r3 ] = await Promise.all([
                server.fetch( new Request( 'http://localhost/ping' )),
                server.fetch( new Request( 'http://localhost/ping' )),
                server.fetch( new Request( 'http://localhost/ping' ))
            ]);

            // Assert
            expect( r1.status ).toBe( 200 );
            expect( r2.status ).toBe( 200 );
            expect( r3.status ).toBe( 200 );
            expect( initCount ).toBe( 1 );
        });

        it( 'Bug #15: should support once(), listenerCount(), and removeAllListeners() on Server', () =>
        {
            // Arrange
            const server = new Server({ security : false });
            const onceSpy = vi.fn();
            const onSpy = vi.fn();

            // Act
            server.once( 'custom', onceSpy );
            server.on( 'custom', onSpy );
            const initialCount = server.listenerCount( 'custom' );
            server.emit( 'custom', 'first' );
            server.emit( 'custom', 'second' );
            const afterOnceCount = server.listenerCount( 'custom' );
            server.removeAllListeners( 'custom' );

            // Assert
            expect( initialCount ).toBe( 2 );
            expect( onceSpy ).toHaveBeenCalledTimes( 1 );
            expect( onceSpy ).toHaveBeenCalledWith( 'first' );
            expect( onSpy ).toHaveBeenCalledTimes( 2 );
            expect( afterOnceCount ).toBe( 1 );
            expect( server.listenerCount( 'custom' )).toBe( 0 );
        });
    });

    describe( 'Bug #16: CORS string options, method-aware preflight lookup, and 403 logging', () =>
    {
        it( 'should parse comma-separated string methods and allowedHeaders in handleCors', () =>
        {
            // Arrange
            const req = new Request( 'http://localhost/items', {
                method  : 'OPTIONS',
                headers : {
                    'Origin'                        : 'https://app.example.com',
                    'Access-Control-Request-Method' : 'POST'
                }
            });

            // Act
            const result = handleCors( req, {
                origin         : 'https://app.example.com',
                methods        : 'GET, POST',
                allowedHeaders : 'X-Custom-A, X-Custom-B'
            }) as Response;

            // Assert
            expect( result ).toBeInstanceOf( Response );
            expect( result.status ).toBe( 204 );
            expect( result.headers.get( 'Access-Control-Allow-Methods' )).toBe( 'GET, POST' );
            expect( result.headers.get( 'Access-Control-Allow-Headers' )).toBe( 'X-Custom-A, X-Custom-B' );
        });

        it( 'should select target route @Cors via Access-Control-Request-Method and log 403 on rejected preflight', async () =>
        {
            // Arrange
            const infoLogs: string[] = [];

            class MultiMethodCtrl
            {
                list()
                {
                    return [];
                }

                create()
                {
                    return { created : true };
                }
            }
            defineController( MultiMethodCtrl, [
                {
                    methodName : 'list',
                    httpMethod : 'GET',
                    path       : '/orders',
                    cors       : { origin : 'https://readonly.example.com', methods : ['GET'] }
                },
                {
                    methodName : 'create',
                    httpMethod : 'POST',
                    path       : '/orders',
                    cors       : { origin : 'https://admin.example.com', methods : ['POST'] }
                }
            ]);

            const server = new Server({
                controllers : [MultiMethodCtrl],
                security    : false,
                logs        : true,
                logger      : {
                    info  : ( msg: string ) => { infoLogs.push( msg ) },
                    warn  : vi.fn(),
                    error : vi.fn(),
                    debug : vi.fn()
                }
            });

            // Act
            const allowedPost = await server.fetch( new Request( 'http://localhost/orders', {
                method  : 'OPTIONS',
                headers : {
                    'Origin'                        : 'https://admin.example.com',
                    'Access-Control-Request-Method' : 'POST'
                }
            }));
            const deniedPost = await server.fetch( new Request( 'http://localhost/orders', {
                method  : 'OPTIONS',
                headers : {
                    'Origin'                        : 'https://evil.example.com',
                    'Access-Control-Request-Method' : 'POST'
                }
            }));

            // Assert
            expect( allowedPost.status ).toBe( 204 );
            expect( allowedPost.headers.get( 'Access-Control-Allow-Origin' )).toBe( 'https://admin.example.com' );
            expect( deniedPost.status ).toBe( 403 );
            expect( infoLogs.some( line => line.includes( 'OPTIONS /orders - 403' ))).toBe( true );
        });
    });

    describe( 'Bug #17: HEAD stream cancellation and falsy forwardBody preservation', () =>
    {
        it( 'should cancel underlying ReadableStream body on HEAD fallback to GET', async () =>
        {
            // Arrange
            const cancelSpy = vi.fn();

            class StreamCtrl
            {
                download()
                {
                    const stream = new ReadableStream<Uint8Array>({
                        start( controller )
                        {
                            controller.enqueue( new TextEncoder().encode( 'chunk-1' ));
                        },
                        cancel : cancelSpy
                    });

                    return new Response( stream, {
                        status  : 200,
                        headers : { 'Content-Type' : 'application/octet-stream', 'X-Size' : '7' }
                    });
                }
            }
            defineController( StreamCtrl, [
                { methodName : 'download', httpMethod : 'GET', path : '/archive' }
            ]);

            const server = new Server({ controllers : [StreamCtrl], security : false });

            // Act
            const res = await server.fetch( new Request( 'http://localhost/archive', { method : 'HEAD' }));

            // Assert
            expect( res.status ).toBe( 200 );
            expect( res.headers.get( 'X-Size' )).toBe( '7' );
            expect( await res.text()).toBe( '' );
            expect( cancelSpy ).toHaveBeenCalledTimes( 1 );
        });

        it( 'should preserve falsy forward body values (0, false, "") instead of falling back to original body', async () =>
        {
            // Arrange
            class ForwardCtrl
            {
                entry( res: ServerResponse )
                {
                    res.forward({
                        method : 'POST',
                        path   : '/internal-target',
                        body   : 0 as unknown as Record<string, unknown>
                    });
                }

                target( body: unknown )
                {
                    return { received : body };
                }
            }
            defineController( ForwardCtrl, [
                {
                    methodName : 'entry',
                    httpMethod : 'POST',
                    path       : '/public-entry',
                    params     : [{ source : 'Response' }]
                },
                {
                    methodName : 'target',
                    httpMethod : 'POST',
                    path       : '/internal-target',
                    internal   : true,
                    params     : [{ source : 'Body' }]
                }
            ]);

            const server = new Server({ controllers : [ForwardCtrl], security : false });

            // Act
            const res = await server.fetch( new Request( 'http://localhost/public-entry', {
                method  : 'POST',
                headers : { 'Content-Type' : 'application/json' },
                body    : JSON.stringify({ original : true })
            }));

            // Assert
            expect( res.status ).toBe( 200 );
            expect( await res.json()).toEqual({ received : 0 });
        });
    });

    describe( 'Bug #18: RFC 9110 header quoted-pair unescaping, case-insensitive params, and boundary matching', () =>
    {
        it( 'should unescape RFC 9110 quoted-pairs and match case-insensitive Content-Disposition parameters', () =>
        {
            // Arrange
            const header = 'form-data; NAME="upload"; FILENAME="a\\"b\\\\c\\\'d.txt"';
            const unterminated = 'form-data; name="field"; filename="unterminated\\"';

            // Act
            const parsed = parseContentDisposition( header );
            const parsedUnterminated = parseContentDisposition( unterminated );

            // Assert
            expect( parsed ).toEqual({
                name     : 'upload',
                filename : 'a"b\\c\'d.txt'
            });
            expect( parsedUnterminated ).toEqual({
                name     : 'field',
                filename : 'unterminated"'
            });
            expect( parseHeaderValueParameter( header, 'toString' )).toBeUndefined();
            expect( parseHeaderValueParameter( header, '__proto__' )).toBeUndefined();
        });

        it( 'should not match notboundary= prefix and should extract case-insensitive or quoted boundary', () =>
        {
            // Act & Assert
            expect( extractMultipartBoundary( 'multipart/form-data; notboundary=fake; boundary=real-123' )).toBe( 'real-123' );
            expect( extractMultipartBoundary( 'multipart/form-data; notboundary=fake' )).toBeUndefined();
            expect( extractMultipartBoundary( 'multipart/form-data; BOUNDARY="quoted-456"' )).toBe( 'quoted-456' );
        });
    });

    describe( 'Bug #19: Cookie encode/decode symmetry and Object.hasOwn prototype-key protection', () =>
    {
        it( 'should decode URI-encoded cookie values, tolerate malformed % sequences, and ignore Object.prototype keys', () =>
        {
            // Arrange
            const setCookieHeader = serializeCookie( 'greeting', 'hello world=100%' );
            const rawCookiePair = setCookieHeader.split( ';' )[0];
            const sreq = new ServerRequest( new Request( 'http://localhost/', {
                headers : { 'Cookie' : `${rawCookiePair}; broken=%E0%A4%A` }
            }));

            // Act & Assert
            expect( sreq.cookie( 'greeting' )).toBe( 'hello world=100%' );
            expect( sreq.cookie( 'broken' )).toBe( '%E0%A4%A' );
            expect( sreq.cookie( 'toString' )).toBeUndefined();
            expect( sreq.cookie( '__proto__' )).toBeUndefined();
            expect( sreq.cookie( 'constructor' )).toBeUndefined();
            expect( sreq.cookies.greeting ).toBe( 'hello world=100%' );
        });

        it( 'should ignore Object.prototype keys in MultipartPayload.has() and field()', () =>
        {
            // Arrange
            const payload = MultipartPayload.from({
                fields : { title : 'report' },
                files  : []
            });

            // Act & Assert
            expect( payload.has( 'title' )).toBe( true );
            expect( payload.has( 'toString' )).toBe( false );
            expect( payload.has( 'constructor' )).toBe( false );
            expect( payload.has( '__proto__' )).toBe( false );
            expect( payload.field( 'toString' )).toBeUndefined();
            expect( payload.field( 'constructor' )).toBeUndefined();
        });
    });

    describe( 'Bugs #20, #22 & #23: Disk upload "." escape, reviver ParseError/query/multipart, and stateful hasher copy', () =>
    {
        it( 'Bug #20: should reject filename "." in openFileStorage with status 400 instead of EISDIR 500', async () =>
        {
            // Arrange
            const tmpDest = fs.mkdtempSync( path.join( os.tmpdir(), 'wu-upload-dot-' ));
            const file = new UploadedFile( 'avatar', 'dot', 'application/octet-stream', {});

            try
            {
                // Act & Assert
                await expect( openFileStorage( file, {
                    storage  : 'disk',
                    dest     : tmpDest,
                    filename : '.'
                })).rejects.toMatchObject({
                    status  : 400,
                    message : 'Upload path escapes destination directory'
                });
            }
            finally
            {
                await file.cleanup();
                fs.rmSync( tmpDest, { recursive : true, force : true });
            }
        });

        it( 'Bug #22: should map ParseError in @Reviver to 400, strip "?" in parseAnyQuery, and apply reviver in MultipartPayload.toObject', async () =>
        {
            // Arrange
            const reviver = ( key: string, value: unknown ) =>
            {
                if( key === 'badDate' )
                {
                    throw new ParseError( 'Invalid date literal' );
                }

                if( key === 'count' && typeof value === 'string' )
                {
                    return Number( value );
                }

                return value;
            };

            class ReviverCtrl
            {
                create( body: Record<string, unknown> )
                {
                    return body;
                }
            }
            defineController( ReviverCtrl, [
                {
                    methodName : 'create',
                    httpMethod : 'POST',
                    path       : '/revive',
                    reviver,
                    params     : [{ source : 'Body' }]
                }
            ]);

            const server = new Server({ controllers : [ReviverCtrl], security : false });
            const file = new UploadedFile( 'doc', 'a.txt', 'text/plain', {});
            const mp = MultipartPayload.from({
                fields : { count : '42' },
                files  : [file]
            });

            // Act
            const badRes = await server.fetch( new Request( 'http://localhost/revive', {
                method  : 'POST',
                headers : { 'Content-Type' : 'application/json' },
                body    : JSON.stringify({ badDate : 'not-a-date' })
            }));
            const parsedQuery = parseAnyQuery( '?count=7&name=alice', reviver );
            const revivedMp = mp.toObject( reviver );

            // Assert
            expect( badRes.status ).toBe( 400 );
            expect( parseAnyQuery( '?x=1' )).toEqual({ x : '1' });
            expect( parsedQuery ).toEqual({ count : 7, name : 'alice' });
            expect( revivedMp.count ).toBe( 42 );
            expect( revivedMp.doc ).toBe( file );
        });

        it( 'Bug #23: should clone stateful crypto.Hash instances via .copy() across multiple computeBodyHash calls', () =>
        {
            // Arrange
            const reusableHash = crypto.createHash( 'sha256' );
            const payloadA = new TextEncoder().encode( 'first-body' ).buffer;
            const payloadB = new TextEncoder().encode( 'second-body' ).buffer;

            // Act
            const digestA = computeBodyHash( payloadA, reusableHash, { encoding : 'hex' });
            const digestB = computeBodyHash( payloadB, reusableHash, { encoding : 'hex' });

            // Assert
            expect( digestA ).toBe( crypto.createHash( 'sha256' ).update( 'first-body' ).digest( 'hex' ));
            expect( digestB ).toBe( crypto.createHash( 'sha256' ).update( 'second-body' ).digest( 'hex' ));
        });
    });

    describe( 'Bugs #24 & #25: Deferred Scope.REQUEST cleanup for @Sse streams and @Ws connections', () =>
    {
        it( 'Bug #24: should keep Scope.REQUEST provider alive during @Sse yield, invoke finally on cancel(), and destroy afterwards', async () =>
        {
            // Arrange
            let destroyed = false;
            let generatorFinalized = false;
            let releaseSecond!: () => void;
            const secondGate = new Promise<void>( r => { releaseSecond = r });

            class ReqScopedTracker
            {
                public active = true;

                onDestroy(): void
                {
                    this.active = false;
                    destroyed = true;
                }
            }
            setInjectableMeta( ReqScopedTracker, { kind : 'provider', token : 'ReqScopedTracker', scope : Scope.REQUEST });

            class SseLifecycleCtrl
            {
                async *events( tracker: ReqScopedTracker )
                {
                    try
                    {
                        yield { activeOnFirst : tracker.active, destroyed };
                        await secondGate;
                        yield { activeOnSecond : tracker.active, destroyed };
                    }
                    finally
                    {
                        generatorFinalized = true;
                    }
                }
            }
            defineController( SseLifecycleCtrl, [
                {
                    methodName : 'events',
                    httpMethod : 'GET',
                    path       : '/sse',
                    meta       : { sse : true },
                    params     : [{ source : 'Inject', name : 'ReqScopedTracker' }]
                }
            ]);

            const server = new Server({
                providers   : [ReqScopedTracker],
                controllers : [SseLifecycleCtrl],
                security    : false
            });

            // Act
            const res = await server.fetch( new Request( 'http://localhost/sse' ));
            const reader = res.body!.getReader();
            const firstChunk = await reader.read();
            const textFirst = new TextDecoder().decode( firstChunk.value );
            const destroyedMidStream = destroyed;
            releaseSecond();
            await reader.cancel();

            // Assert
            expect( textFirst ).toContain( '"activeOnFirst":true' );
            expect( textFirst ).toContain( '"destroyed":false' );
            expect( destroyedMidStream ).toBe( false );
            expect( generatorFinalized ).toBe( true );
            expect( destroyed ).toBe( true );
        });

        it( 'Bug #25: should keep Scope.REQUEST provider alive until WebSocket emits close', async () =>
        {
            // Arrange
            let destroyed = false;

            class WsReqProvider
            {
                onDestroy(): void
                {
                    destroyed = true;
                }
            }
            setInjectableMeta( WsReqProvider, { kind : 'provider', token : 'WsReqProvider', scope : Scope.REQUEST });

            const closeCallbacks: Array<() => void> = [];
            const mockWs = {
                send  : vi.fn(),
                close : vi.fn(),
                on    : ( event: string, cb: () => void ) =>
                {
                    if( event === 'close' )
                    {
                        closeCallbacks.push( cb );
                    }
                },
                off     : vi.fn(),
                headers : new Headers(),
                query   : {},
                params  : {}
            };

            class WsLifecycleCtrl
            {
                connect( _ws: unknown, _scoped: WsReqProvider ): void
                {
                    // Handler returns immediately while socket stays open
                }
            }
            defineController( WsLifecycleCtrl, [
                {
                    methodName : 'connect',
                    httpMethod : 'WS',
                    path       : '/ws',
                    params     : [
                        { source : 'WebSocket' },
                        { source : 'Inject', name : 'WsReqProvider' }
                    ]
                }
            ]);

            const server = new Server({
                providers   : [WsReqProvider],
                controllers : [WsLifecycleCtrl],
                security    : false
            });
            await server.ensureReady();
            const endpoint = server.registry.getEndpoints().find( ep => ep.httpMethod === 'WS' )!;

            // Act
            await runWithRegistry( server.registry, () =>
                RequestProcessor.executeWs( endpoint, mockWs, new Request( 'http://localhost/ws' ))
            );
            const destroyedWhileOpen = destroyed;

            for( const cb of closeCallbacks )
            {
                cb();
            }
            await new Promise( r => setTimeout( r, 10 ));

            // Assert
            expect( destroyedWhileOpen ).toBe( false );
            expect( destroyed ).toBe( true );
        });
    });

    describe( 'Bugs #26, #27 & Disconnect AbortSignal: WebSocket framing, upgrade hardening, heartbeat & HTTP abort', () =>
    {
        it( 'Bug #26: should frame Uint8Array subviews and ArrayBuffer accurately and avoid mutating caller Buffer when mask: true', () =>
        {
            // Arrange
            const backing = Buffer.from([ 0xaa, 0x01, 0x02, 0x03, 0xff ]);
            const subview = new Uint8Array( backing.buffer, backing.byteOffset + 1, 3 );
            const arrayBuf = new Uint8Array([ 0x10, 0x20 ]).buffer;
            const callerBuf = Buffer.from( 'immutable-caller-payload' );
            const snapshot = Buffer.from( callerBuf );

            const txView = new MultiBuffer();
            const txAb = new MultiBuffer();
            const txMasked = new MultiBuffer();
            const received: Buffer[] = [];

            // Act
            WebsocketFrame.write( txView, subview );
            WebsocketFrame.write( txAb, arrayBuf );
            WebsocketFrame.write( txMasked, callerBuf, { mask : true, opcode : 0x02 });
            WebsocketFrame.read( txMasked, ( ev, data ) =>
            {
                if( ev === 'message' )
                {
                    received.push( data as Buffer );
                }
            });

            // Assert
            const rawViewFrame = txView.spliceConcat( 0, txView.length );
            const rawAbFrame = txAb.spliceConcat( 0, txAb.length );
            expect( rawViewFrame ).toEqual( Buffer.from([ 0x82, 0x03, 0x01, 0x02, 0x03 ]));
            expect( rawAbFrame ).toEqual( Buffer.from([ 0x82, 0x02, 0x10, 0x20 ]));
            expect( callerBuf.equals( snapshot )).toBe( true );
            expect( received ).toHaveLength( 1 );
            expect( received[0].equals( snapshot )).toBe( true );
        });

        it( 'Bug #26: should validate Sec-WebSocket-Key and truncate multi-byte UTF-8 close reasons <= 123 bytes cleanly', () =>
        {
            // Arrange
            const validKey = crypto.randomBytes( 16 ).toString( 'base64' );
            const emojis = '🚀'.repeat( 40 ); // 160 UTF-8 bytes

            // Act
            const truncated = truncateWsReason( emojis );

            // Assert
            expect( isValidWsHandshakeKey( validKey )).toBe( true );
            expect( isValidWsHandshakeKey( 'short' )).toBe( false );
            expect( Buffer.byteLength( truncated, 'utf8' )).toBe( 120 );
            expect( truncated.includes( '\uFFFD' )).toBe( false );
        });

        it( 'Bug #27: should clear previous pingTimeout timer on subsequent WsHeartbeat tick when pingTimeout > pingInterval', () =>
        {
            // Arrange
            vi.useFakeTimers();
            const closeSpy = vi.fn();
            const hb = new WsHeartbeat(
                { ping : () => undefined, close : closeSpy },
                { pingInterval : 100, pingTimeout : 180 }
            );

            // Act
            hb.start();
            vi.advanceTimersByTime( 100 ); // Tick 1 at t=100 -> timeout scheduled for t=280
            vi.advanceTimersByTime( 100 ); // Tick 2 at t=200 -> clears first timeout, schedules for t=380
            hb.pong();                     // Pong arrives at t=200
            vi.advanceTimersByTime( 90 );  // t=290 (past old t=280 deadline)

            // Assert
            expect( closeSpy ).not.toHaveBeenCalled();
            hb.stop();
        });

        it.skipIf( !isNodeRuntime )( 'Bug #26 & Disconnect AbortSignal: NodeAdapter should enforce WS key/version, buffer early head frames, emit 1006 on abrupt close, and abort req.signal on HTTP disconnect', async () =>
        {
            // Arrange
            const earlyMessages: string[] = [];
            let closeCodeObserved: number | undefined;
            let signalAbortedResolve!: () => void;
            const signalAbortedPromise = new Promise<void>( r => { signalAbortedResolve = r });
            let requestEnteredResolve!: () => void;
            const requestEnteredPromise = new Promise<void>( r => { requestEnteredResolve = r });

            class LiveNodeCtrl
            {
                async chat( ws: { on : ( ev: string, cb: ( arg: unknown ) => void ) => void })
                {
                    await new Promise( r => setTimeout( r, 25 ));
                    ws.on( 'message', ( msg: unknown ) =>
                    {
                        earlyMessages.push( String( msg ));
                    });
                    ws.on( 'close', ( code: unknown ) =>
                    {
                        closeCodeObserved = code as number;
                    });
                }

                async slow( sreq: ServerRequest )
                {
                    requestEnteredResolve();
                    sreq.signal?.addEventListener( 'abort', () => signalAbortedResolve(), { once : true });
                    await new Promise( r => setTimeout( r, 200 ));

                    return { ok : true };
                }
            }
            defineController( LiveNodeCtrl, [
                {
                    methodName : 'chat',
                    httpMethod : 'WS',
                    path       : '/ws',
                    params     : [{ source : 'WebSocket' }]
                },
                {
                    methodName : 'slow',
                    httpMethod : 'GET',
                    path       : '/slow',
                    params     : [{ source : 'Request' }]
                }
            ]);

            const server = new Server({
                port        : 0,
                host        : '127.0.0.1',
                signals     : false,
                security    : false,
                controllers : [LiveNodeCtrl]
            });
            await server.start();
            const port = ( server.nodeServer.address() as net.AddressInfo ).port;

            try
            {
                // Act 1: Invalid Sec-WebSocket-Key -> 400, Unsupported Sec-WebSocket-Version -> 426
                const sendRawUpgrade = ( headers: string[]) => new Promise<string>(( resolve, reject ) =>
                {
                    const sock = net.connect( port, '127.0.0.1', () =>
                    {
                        sock.write( headers.join( '\r\n' ) + '\r\n\r\n' );
                    });
                    let out = '';
                    sock.on( 'data', ( chunk ) =>
                    {
                        out += chunk.toString( 'utf8' );
                        sock.destroy();
                    });
                    sock.on( 'close', () => resolve( out ));
                    sock.on( 'error', reject );
                });

                const badKeyReply = await sendRawUpgrade([
                    'GET /ws HTTP/1.1',
                    `Host: 127.0.0.1:${port}`,
                    'Upgrade: websocket',
                    'Connection: Upgrade',
                    'Sec-WebSocket-Version: 13',
                    'Sec-WebSocket-Key: invalid-key'
                ]);
                const badVerReply = await sendRawUpgrade([
                    'GET /ws HTTP/1.1',
                    `Host: 127.0.0.1:${port}`,
                    'Upgrade: websocket',
                    'Connection: Upgrade',
                    'Sec-WebSocket-Version: 8',
                    `Sec-WebSocket-Key: ${crypto.randomBytes( 16 ).toString( 'base64' )}`
                ]);

                // Act 2: Valid upgrade with pipelined masked frame in initial packet + abrupt destroy -> buffered message & 1006
                await new Promise<void>(( resolve, reject ) =>
                {
                    const key = crypto.randomBytes( 16 ).toString( 'base64' );
                    const tx = new MultiBuffer();
                    WebsocketFrame.write( tx, 'pipelined-hello', { mask : true });
                    const frameBytes = tx.spliceConcat( 0, tx.length );

                    const sock = net.connect( port, '127.0.0.1', () =>
                    {
                        const reqHead = Buffer.from([
                            'GET /ws HTTP/1.1',
                            `Host: 127.0.0.1:${port}`,
                            'Upgrade: websocket',
                            'Connection: Upgrade',
                            'Sec-WebSocket-Version: 13',
                            `Sec-WebSocket-Key: ${key}`,
                            '',
                            ''
                        ].join( '\r\n' ));
                        sock.write( Buffer.concat([ reqHead, frameBytes ]));
                    });
                    sock.once( 'data', () =>
                    {
                        setTimeout(() =>
                        {
                            sock.destroy();
                            resolve();
                        }, 50 );
                    });
                    sock.on( 'error', reject );
                });

                await new Promise( r => setTimeout( r, 30 ));

                // Act 3: HTTP client disconnects mid-request -> aborts req.signal
                const httpReq = http.request({
                    host   : '127.0.0.1',
                    port,
                    path   : '/slow',
                    method : 'GET'
                });
                httpReq.on( 'error', () => {});
                httpReq.end();
                await requestEnteredPromise;
                httpReq.destroy();
                await signalAbortedPromise;

                // Assert
                expect( badKeyReply ).toContain( '400 Bad Request' );
                expect( badVerReply ).toContain( '426 Upgrade Required' );
                expect( badVerReply ).toMatch( /sec-websocket-version:\s*13/i );
                expect( earlyMessages ).toEqual([ 'pipelined-hello' ]);
                expect( closeCodeObserved ).toBe( 1006 );
            }
            finally
            {
                await server.shutdown( 100 );
            }
        });
    });

    describe( 'Bug #28: Microservice graceful drain, RPC interceptors/serializer, TCP id:0 & TcpClient races', () =>
    {
        it( 'should drain in-flight RPC calls during Microservice.shutdown(), run interceptors + returnTypeSerializer, mask 500s, and deduplicate TcpClient.connect()', async () =>
        {
            // Arrange
            let enterSlowRpc!: () => void;
            const slowRpcEntered = new Promise<void>( r => { enterSlowRpc = r });
            let releaseSlowRpc!: () => void;
            const slowRpcGate = new Promise<void>( r => { releaseSlowRpc = r });

            class TagInterceptor
            {
                async intercept( _ctx: unknown, next: () => Promise<Record<string, unknown>> )
                {
                    const res = await next();

                    return { ...res, intercepted : true };
                }
            }
            setInjectableMeta( TagInterceptor, { kind : 'interceptor', token : 'TagInterceptor', scope : Scope.SINGLETON });

            class RpcCtrl
            {
                async slow( payload: { n : number })
                {
                    enterSlowRpc();
                    await slowRpcGate;

                    return { doubled : payload.n * 2, secretInternal : 'drop-me' };
                }

                boom(): never
                {
                    throw new Error( 'SQL credentials leaked' );
                }
            }
            defineController( RpcCtrl, [
                {
                    methodName           : 'slow',
                    httpMethod           : 'RPC',
                    path                 : 'math.slow',
                    interceptors         : ['TagInterceptor'],
                    params               : [{ source : 'Body' }],
                    returnTypeSerializer : ( val: { doubled : number, intercepted? : boolean }) =>
                        JSON.stringify({ doubled : val.doubled, intercepted : val.intercepted })
                },
                {
                    methodName : 'boom',
                    httpMethod : 'RPC',
                    path       : 'math.boom'
                }
            ]);

            const tcpAdapter = new TcpMessageAdapter( 0, '127.0.0.1' );
            const ms = new Microservice( tcpAdapter, {
                providers   : [TagInterceptor],
                controllers : [RpcCtrl]
            });
            await ms.start();

            const servers = ( tcpAdapter as unknown as { servers : net.Server[] }).servers;
            const port = ( servers[0].address() as net.AddressInfo ).port;
            let connectionCount = 0;
            servers[0].on( 'connection', () => { connectionCount++ });

            const client = new TcpClient({ host : '127.0.0.1', port, timeoutMs : 2000 });

            try
            {
                // Act 1: Concurrent sends on cold TcpClient share 1 socket; check id:0 + non-object lines + 500 masking
                const rawReply = await new Promise<Record<string, unknown>>(( resolve, reject ) =>
                {
                    const rawSock = net.connect( port, '127.0.0.1', () =>
                    {
                        rawSock.write( 'null\n42\n["array"]\n' );
                        rawSock.write( JSON.stringify({ id : 0, pattern : 'math.boom', payload : {} }) + '\n' );
                    });
                    rawSock.once( 'data', ( chunk ) =>
                    {
                        rawSock.destroy();
                        resolve( JSON.parse( chunk.toString( 'utf8' ).trim()));
                    });
                    rawSock.on( 'error', reject );
                });

                connectionCount = 0;
                const slowPromiseA = client.send( 'math.slow', { n : 21 });
                const slowPromiseB = client.send( 'math.slow', { n : 5 });
                await slowRpcEntered;

                // Initiate graceful shutdown while slow RPCs are in flight
                const shutdownPromise = ms.shutdown( 2000 );
                releaseSlowRpc();

                const [ resultA, resultB ] = await Promise.all([ slowPromiseA, slowPromiseB ]);
                await shutdownPromise;

                // Assert
                expect( rawReply ).toEqual({
                    id      : 0,
                    status  : 'error',
                    message : 'Internal server error'
                });
                expect( connectionCount ).toBe( 1 );
                expect( resultA ).toEqual({ doubled : 42, intercepted : true });
                expect( resultB ).toEqual({ doubled : 10, intercepted : true });
            }
            finally
            {
                client.close();
                await ms.shutdown( 100 );
            }
        });

        it( 'should destroy connecting socket cleanly if TcpClient.close() is called before connect completes', async () =>
        {
            // Arrange
            const dummyServer = net.createServer(( sock ) => { sock.destroy() });
            await new Promise<void>( r => dummyServer.listen( 0, '127.0.0.1', () => r()));
            const port = ( dummyServer.address() as net.AddressInfo ).port;

            try
            {
                const client = new TcpClient({ host : '127.0.0.1', port });

                // Act
                const connectPromise = client.connect();
                client.close();

                // Assert
                await expect( connectPromise ).rejects.toThrow( 'Client closed' );
            }
            finally
            {
                await new Promise<void>( r => dummyServer.close(() => r()));
            }
        });
    });

    describe( 'Performance Fast-Path Edge Cases', () =>
    {
        it( 'should allow mutating req.params on static routes without TypeError or cross-request leakage', async () =>
        {
            // Arrange
            class StaticMutateCtrl
            {
                handle( req: ServerRequest )
                {
                    const before = req.params.injected;
                    req.params.injected = 'mutated';

                    return { before : before ?? null, after : req.params.injected };
                }
            }
            defineController( StaticMutateCtrl, [{
                methodName : 'handle',
                httpMethod : 'GET',
                path       : '/static-params',
                params     : [{ source : 'Request' }]
            }]);

            const server = new Server({ controllers : [StaticMutateCtrl], security : false });

            // Act
            const res1 = await server.fetch( new Request( 'http://localhost/static-params' ));
            const res2 = await server.fetch( new Request( 'http://localhost/static-params' ));

            // Assert
            expect( res1.status ).toBe( 200 );
            expect( await res1.json()).toEqual({ before : null, after : 'mutated' });
            expect( res2.status ).toBe( 200 );
            expect( await res2.json()).toEqual({ before : null, after : 'mutated' });
        });

        it( 'should use null-prototype params on fast segment matcher routes (including Object.prototype key names)', async () =>
        {
            // Arrange
            class ProtoParamCtrl
            {
                handle( req: ServerRequest, val: string )
                {
                    return {
                        val,
                        nullProto  : Object.getPrototypeOf( req.params ) === null,
                        hasOwnProp : 'hasOwnProperty' in req.params
                    };
                }
            }
            defineController( ProtoParamCtrl, [{
                methodName : 'handle',
                httpMethod : 'GET',
                path       : '/items/:toString',
                params     : [
                    { source : 'Request' },
                    { source : 'Param', name : 'toString' }
                ]
            }]);

            const server = new Server({ controllers : [ProtoParamCtrl], security : false });

            // Act
            const res = await server.fetch( new Request( 'http://localhost/items/hello-world' ));

            // Assert
            expect( res.status ).toBe( 200 );
            expect( await res.json()).toEqual({
                val        : 'hello-world',
                nullProto  : true,
                hasOwnProp : false
            });
        });

        it( 'should re-enforce security headers and X-Request-Id after an @Interceptor mutates response headers', async () =>
        {
            // Arrange
            class HeaderTamperInterceptor
            {
                async intercept( _req: ServerRequest, next: () => Promise<Response> )
                {
                    const res = await next();
                    res.headers.delete( 'x-content-type-options' );
                    res.headers.set( 'x-request-id', 'tampered-id' );
                    res.headers.set( 'x-custom-interceptor', 'applied' );

                    return res;
                }
            }
            setInjectableMeta( HeaderTamperInterceptor, {});

            class InterceptedCtrl
            {
                ping()
                {
                    return { ok : true };
                }
            }
            defineController( InterceptedCtrl, [{
                methodName   : 'ping',
                httpMethod   : 'GET',
                path         : '/intercepted-ping',
                interceptors : ['HeaderTamperInterceptor']
            }]);

            const server = new Server({
                controllers  : [InterceptedCtrl],
                interceptors : [HeaderTamperInterceptor],
                security     : {}
            });

            // Act
            const res = await server.fetch( new Request( 'http://localhost/intercepted-ping', {
                headers : { 'X-Request-Id' : 'req-original-123' }
            }));

            // Assert
            expect( res.status ).toBe( 200 );
            expect( res.headers.get( 'x-custom-interceptor' )).toBe( 'applied' );
            expect( res.headers.get( 'x-content-type-options' )).toBe( 'nosniff' );
            expect( res.headers.get( 'x-request-id' )).toBe( 'req-original-123' );
        });

        it( 'should honor direct registry.instances mutations and clear() on synchronous DI resolution', async () =>
        {
            // Arrange
            class RealSvc
            {
                tag = 'real';
            }
            setInjectableMeta( RealSvc, {});

            const registry = new ApplicationRegistry();
            registry.registerProvider( 'RealSvc', RealSvc );

            // Act & Assert 1: direct override before first resolve
            registry.instances.set( 'RealSvc::global', { tag : 'manual-override' });
            expect( await registry.resolve( 'RealSvc' )).toEqual({ tag : 'manual-override' });

            // Act & Assert 2: clearing instances causes fresh instantiation without stale mirror cache
            registry.instances.clear();
            expect( await registry.resolve( 'RealSvc' )).toEqual({ tag : 'real' });
        });

        it( 'should ignore Deno legacy post-response req.signal aborts and detach transport signal on WebSocket upgrade', async () =>
        {
            // Arrange 1: Simulate Deno.serve legacy req.signal aborting when a successful response is returned
            const denoGlobal = globalThis as { Deno? : unknown };
            const prevDeno = denoGlobal.Deno;
            let capturedServeHandler: (( req: Request, info: unknown ) => Promise<Response> ) | undefined;

            denoGlobal.Deno = {
                serve : ( _opts: unknown, cb: ( req: Request, info: unknown ) => Promise<Response> ) =>
                {
                    capturedServeHandler = cb;

                    return {
                        finished : Promise.resolve(),
                        shutdown : async () => undefined
                    };
                }
            };

            try
            {
                const adapter = new DenoAdapter();
                let observedReqFacade: ServerRequest | undefined;

                await adapter.listen( 0, async ( req: Request ) =>
                {
                    observedReqFacade = ServerRequest.from( req );

                    return new Response( 'ok', { status : 200 });
                });

                const legacyAbort = new AbortController();
                const denoReq = new Request( 'http://localhost/sse', { signal : legacyAbort.signal });
                await capturedServeHandler!( denoReq, { remoteAddr : { hostname : '127.0.0.1' }});
                legacyAbort.abort();

                expect( observedReqFacade ).toBeDefined();
                expect( observedReqFacade!.isAborted ).toBe( false );
                expect( observedReqFacade!.signal ).toBeUndefined();
                expect( observedReqFacade!.ip ).toBe( '127.0.0.1' );

                await adapter.close();
            }
            finally
            {
                if( prevDeno === undefined )
                {
                    delete denoGlobal.Deno;
                }
                else
                {
                    denoGlobal.Deno = prevDeno;
                }
            }

            // Arrange 2: Simulate upgrade Request.signal aborting upon 101 Switching Protocols before executeWs runs
            let resolvedRoom = '';
            let resolvedToken = '';

            class WsUpgradeCtrl
            {
                connect( ws: { send : ( payload: string ) => void }, room: string, token: string )
                {
                    resolvedRoom = room;
                    resolvedToken = token;
                    ws.send( `${room}:${token}` );
                }
            }
            defineController( WsUpgradeCtrl, [{
                methodName : 'connect',
                httpMethod : 'WS',
                path       : '/ws/:room',
                params     : [
                    { source : 'WebSocket' },
                    { source : 'Param', name : 'room' },
                    { source : 'Query', name : 'token' }
                ]
            }]);

            const registry = new ApplicationRegistry();
            bootstrapRegistry( registry, { controllers : [WsUpgradeCtrl] });

            const upgradeAbort = new AbortController();
            const upgradeReq = new Request( 'http://localhost/ws/lobby?token=abc', {
                signal : upgradeAbort.signal
            });
            const sreq = ServerRequest.from( upgradeReq, { params : { room : 'lobby' }});
            upgradeAbort.abort();

            const sentFrames: string[] = [];
            const mockWs = {
                params : { room : 'lobby' },
                send   : ( payload: string ) => { sentFrames.push( payload ) },
                close  : vi.fn()
            };

            const wsEndpoint = registry.getEndpoints().find( ep => ep.httpMethod === 'WS' )!;

            // Act
            await runWithRegistry( registry, () =>
                RequestProcessor.executeWs( wsEndpoint, mockWs, sreq )
            );

            // Assert
            expect( resolvedRoom ).toBe( 'lobby' );
            expect( resolvedToken ).toBe( 'abc' );
            expect( sentFrames ).toEqual([ 'lobby:abc' ]);
            expect( mockWs.close ).not.toHaveBeenCalled();
        });
    });
});
