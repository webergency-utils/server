import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as net from 'node:net';
import { EventEmitter } from 'node:events';
import { ApplicationRegistry, runWithRegistry } from '../src/core/registry.js';
import { Context } from '../src/core/context.js';
import { Scope, OverrideProtect, OverrideIntercept, Protect } from '../src/decorators.js';
import { ServerResponse, EndpointMetadata } from '../src/core/types.js';
import { ServerRequest } from '../src/core/server-request.js';
import { RequestProcessor } from '../src/core/request-processor.js';
import { invokeGuards } from '../src/core/guard-runner.js';
import { Server } from '../src/server.js';
import { TcpMessageAdapter } from '../src/microservice/tcp-adapter.js';
import { TcpClient } from '../src/microservice/tcp-client.js';
import { seedInstanceController, defineController, setInjectableMeta } from './helpers/testing.js';
import { setGuardMeta, getBranchSerializers, WEBERGENCY_BRANCH_SERIALIZERS } from '../src/core/symbols.js';
import { compileTrustProxy, ipInCidr, resolveClientIp } from '../src/helpers/client-ip.js';
import { handleCors } from '../src/helpers/cors.js';
import { pathMatcher } from '../src/helpers/match.js';
import { MultiBuffer } from '../src/helpers/multibuffer.js';
import { UploadedFile, parseMultipartStream } from '../src/helpers/multipart.js';
import { getContentType, readRawBody } from '../src/helpers/request-reader.js';
import { mergeSecurityConfigs, generateSecurityHeaders } from '../src/helpers/security.js';
import { NodeAdapter } from '../src/adapters/node-adapter.js';
import ts from '../src/compiler/ts.js';
import compilerPlugin, { createRegistry, discoverFromEntryPoint } from '../src/compiler/transformer.js';
import { SwaggerSpecGenerator } from '../src/compiler/swagger.js';
import { DiagnosticReporter, DiagnosticCode } from '../src/compiler/diagnostics.js';
import { resolveTokenFromType } from '../src/compiler/di-resolution.js';
import { createBeforeTransformers } from '../src/compiler/emit-transformers.js';
import { generateManifestCode, objectToExpression } from '../src/compiler/manifest.js';
import { unwrapSsePayloadType } from '../src/compiler/sse-types.js';
import { classImplementsInterface, isStandaloneGuardClass } from '../src/compiler/decorator-config.js';
import { upgradeQuery, isWsPayloadTooLarge } from '../src/adapters/ws-upgrade.js';
import { MultipartParser, MAX_PART_HEADER_SIZE } from '../src/helpers/multipart.js';
import { Microservice } from '../src/microservice/microservice.js';
import { MicroserviceNoReply } from '../src/microservice/adapter.js';
import { NdjsonLineFramer } from '../src/microservice/ndjson-framer.js';
import { errorLogFields, clientErrorBody, redactSecrets, REDACTED } from '../src/helpers/error-response.js';
import { computeBodyHash } from '../src/helpers/body-hash.js';
import { mergeFileConfigs } from '../src/helpers/file-upload.js';
import { Router } from '../src/core/router.js';

describe( 'Runtime, Pipeline & Compiler Regressions', () =>
{
    beforeEach(() =>
    {
        vi.clearAllMocks();
    });

    afterEach(() =>
    {
        vi.restoreAllMocks();
    });

    describe( 'Concurrent Scope.REQUEST & Scope.TRANSIENT DI Resolution', () =>
    {
        it( 'should isolate concurrent Scope.REQUEST async resolutions across requests without returning false circular proxies', async () =>
        {
            // Arrange
            const registry = new ApplicationRegistry();
            let counter = 0;

            class AsyncReqService
            {
                public id = ++counter;
                public initialized = false;

                async onInit()
                {
                    await new Promise( r => setTimeout( r, 25 ));
                    this.initialized = true;
                }
            }
            ( AsyncReqService as any ).__scope__ = Scope.REQUEST;

            registry.registerProvider( 'AsyncReqService', AsyncReqService );

            const makeCtx = ( id: string ) => ({
                request   : new ServerRequest( new Request( 'http://localhost/test' )),
                metadata  : { controller : 'C', methodName : 'm', httpMethod : 'GET', path : '/test', params : [], guards : [], interceptors : [] } as EndpointMetadata,
                requestId : id,
                registry
            });

            // Act
            const [ resA, resB ] = await Promise.all([
                Context.run( makeCtx( 'req-a' ), () => registry.resolve( 'AsyncReqService' )),
                Context.run( makeCtx( 'req-b' ), () => registry.resolve( 'AsyncReqService' ))
            ]);

            // Assert
            expect( resA ).toBeInstanceOf( AsyncReqService );
            expect( resB ).toBeInstanceOf( AsyncReqService );
            expect( resA ).not.toBe( resB );
            expect( resA.id ).toBe( 1 );
            expect( resB.id ).toBe( 2 );
            expect( resA.initialized ).toBe( true );
            expect( resB.initialized ).toBe( true );
        });

        it( 'should coalesce parallel Scope.REQUEST resolutions within the same request into a single instance', async () =>
        {
            // Arrange
            const registry = new ApplicationRegistry();
            let constructed = 0;

            class SharedReqService
            {
                public seq = ++constructed;

                async onInit()
                {
                    await new Promise( r => setTimeout( r, 20 ));
                }
            }
            ( SharedReqService as any ).__scope__ = Scope.REQUEST;

            registry.registerProvider( 'SharedReqService', SharedReqService );

            const ctx = {
                request   : new ServerRequest( new Request( 'http://localhost/test' )),
                metadata  : { controller : 'C', methodName : 'm', httpMethod : 'GET', path : '/test', params : [], guards : [], interceptors : [] } as EndpointMetadata,
                requestId : 'req-same',
                registry
            };

            // Act
            const [ first, second ] = await Context.run( ctx, () =>
                Promise.all([
                    registry.resolve( 'SharedReqService' ),
                    registry.resolve( 'SharedReqService' )
                ])
            );

            // Assert
            expect( first ).toBe( second );
            expect( constructed ).toBe( 1 );
        });

        it( 'should construct independent instances for concurrent Scope.TRANSIENT async resolutions', async () =>
        {
            // Arrange
            const registry = new ApplicationRegistry();
            let count = 0;

            class AsyncTransient
            {
                public id = ++count;

                async onInit()
                {
                    await new Promise( r => setTimeout( r, 15 ));
                }
            }
            ( AsyncTransient as any ).__scope__ = Scope.TRANSIENT;

            registry.registerProvider( 'AsyncTransient', AsyncTransient );

            // Act
            const [ inst1, inst2 ] = await Promise.all([
                registry.resolve( 'AsyncTransient' ),
                registry.resolve( 'AsyncTransient' )
            ]);

            // Assert
            expect( inst1 ).toBeInstanceOf( AsyncTransient );
            expect( inst2 ).toBeInstanceOf( AsyncTransient );
            expect( inst1 ).not.toBe( inst2 );
            expect( inst1.id ).not.toBe( inst2.id );
        });
    });

    describe( 'ServerResponse Multiple Set-Cookie Preservation', () =>
    {
        it( 'should preserve multiple Set-Cookie headers in applyTo both with and without status override', () =>
        {
            // Arrange
            const bagWithoutStatus = new ServerResponse()
                .cookie( 'session', 'abc', { httpOnly : true })
                .cookie( 'csrf', 'xyz', { secure : true });

            const bagWithStatus = new ServerResponse()
                .status( 201 )
                .cookie( 'a', '1' )
                .cookie( 'b', '2' );

            // Act
            const res1 = bagWithoutStatus.applyTo( new Response( 'ok' ));
            const res2 = bagWithStatus.applyTo( new Response( 'created' ));

            // Assert
            expect( res1.headers.getSetCookie()).toEqual([
                'session=abc; HttpOnly',
                'csrf=xyz; Secure'
            ]);
            expect( res2.status ).toBe( 201 );
            expect( res2.headers.getSetCookie()).toEqual([
                'a=1',
                'b=2'
            ]);
        });
    });

    describe( 'GuardRunner File & Extended Parameter Sources', () =>
    {
        it( 'should pass @File, @Ip, and @Path parameters into Guard.use', async () =>
        {
            // Arrange
            const registry = new ApplicationRegistry();
            const seen: any = {};

            class UploadGuard
            {
                use( file: any, ip: string, reqPath: string )
                {
                    seen.filename = file?.filename;
                    seen.ip = ip;
                    seen.path = reqPath;
                }
            }

            registry.registerGuard( 'UploadGuard', UploadGuard );

            const boundary = '----WebKitFormBoundaryGuardTest';
            const body = [
                `--${boundary}`,
                'Content-Disposition: form-data; name="doc"; filename="report.txt"',
                'Content-Type: text/plain',
                '',
                'hello guard',
                `--${boundary}--`,
                ''
            ].join( '\r\n' );

            const rawReq = new Request( 'http://localhost/upload', {
                method  : 'POST',
                headers : {
                    'content-type'    : `multipart/form-data; boundary=${boundary}`,
                    'x-forwarded-for' : '203.0.113.9'
                },
                body
            });
            ( rawReq as any ).remoteAddress = '127.0.0.1';
            const sreq = new ServerRequest( rawReq, {
                trustProxy         : [ '127.0.0.1' ],
                compiledTrustProxy : compileTrustProxy([ '127.0.0.1' ])
            });

            const metadata: EndpointMetadata = {
                controller   : 'Ctrl',
                methodName   : 'upload',
                httpMethod   : 'POST',
                path         : '/upload',
                params       : [],
                interceptors : [],
                guards       : [{
                    type   : 'class',
                    name   : 'UploadGuard',
                    params : [
                        { source : 'File', name : 'doc' },
                        { source : 'Ip' },
                        { source : 'Path' }
                    ],
                    resolvers : []
                }]
            };

            // Act
            await runWithRegistry( registry, () =>
                invokeGuards( metadata, sreq, {
                    ctx              : { success : true, errors : [], mode : 'strict' },
                    controller       : {},
                    controllerModule : undefined
                })
            );

            // Assert
            expect( seen.filename ).toBe( 'report.txt' );
            expect( seen.ip ).toBe( '203.0.113.9' );
            expect( seen.path ).toBe( '/upload' );
        });
    });

    describe( 'WebSocket Upgrade DI Continuity, Interceptors & Rejected Socket Cleanup', () =>
    {
        it( 'should preserve Scope.REQUEST instances from WS upgrade guard into executeWs and run interceptors', async () =>
        {
            // Arrange
            const events: string[] = [];

            class WsReqState
            {
                public user = '';

                onDestroy()
                {
                    events.push( `destroy:${this.user}` );
                }
            }
            ( WsReqState as any ).__scope__ = Scope.REQUEST;
            setInjectableMeta( WsReqState, { kind : 'provider', token : 'WsReqState', scope : Scope.REQUEST });

            class WsAuthGuard
            {
                constructor( private state: WsReqState ) {}

                use()
                {
                    this.state.user = 'alice';
                    events.push( 'guard' );
                }
            }
            ( WsAuthGuard as any ).__injections__ = {
                constructorDeps : [ 'WsReqState' ],
                propertyDeps    : {}
            };
            setInjectableMeta( WsAuthGuard, { kind : 'guard', token : 'WsAuthGuard' });
            setGuardMeta( WsAuthGuard, { params : [] });

            class WsLogInterceptor
            {
                async intercept( _req: any, next: () => Promise<any> )
                {
                    events.push( 'intercept:before' );
                    const out = await next();
                    events.push( 'intercept:after' );

                    return out;
                }
            }
            setInjectableMeta( WsLogInterceptor, { kind : 'interceptor', token : 'WsLogInterceptor' });

            class ChatCtrl
            {
                constructor( private state: WsReqState ) {}

                handle( ws: any )
                {
                    events.push( `handler:${this.state.user}` );
                    ws.send( `hello ${this.state.user}` );
                }
            }
            ( ChatCtrl as any ).__injections__ = {
                constructorDeps : [ 'WsReqState' ],
                propertyDeps    : {}
            };
            defineController( ChatCtrl, [{
                methodName   : 'handle',
                httpMethod   : 'WS',
                path         : '/chat',
                params       : [{ source : 'WebSocket' }],
                guards       : [{ type : 'class', name : 'WsAuthGuard', params : [], resolvers : [] }],
                interceptors : [ 'WsLogInterceptor' ]
            }]);

            const server = new Server({
                port         : 0,
                controllers  : [ ChatCtrl ],
                providers    : [ WsReqState ],
                guards       : [ WsAuthGuard ],
                interceptors : [ WsLogInterceptor ]
            });

            const sent: string[] = [];
            ( server as any ).serverAdapter = {
                listen  : async () => {},
                close   : async () => {},
                upgrade : async ( request: Request, metadata: EndpointMetadata, params: Record<string, string> ) =>
                {
                    const fakeWs = {
                        params,
                        send  : ( msg: string ) => sent.push( msg ),
                        close : vi.fn()
                    };
                    await RequestProcessor.executeWs( metadata, fakeWs, request );

                    return new Response( null, { status : 200 });
                }
            };

            // Act
            const res = await server.fetch( new Request( 'http://localhost/chat', {
                headers : { Upgrade : 'websocket' }
            }));

            // Assert
            expect( res.status ).toBe( 200 );
            expect( sent ).toEqual([ 'hello alice' ]);
            expect( events ).toEqual([
                'guard',
                'intercept:before',
                'handler:alice',
                'intercept:after',
                'destroy:alice'
            ]);
        });

        it( 'should write HTTP error status and destroy raw socket when WS upgrade is rejected in NodeAdapter', async () =>
        {
            // Arrange
            const server = new Server({ port : 0, signals : false });
            ( server as any ).detectRuntime = () => 'Node';
            seedInstanceController( server.registry, 'WsCtrl', {
                connect : () => {}
            }, [{
                methodName : 'connect',
                httpMethod : 'WS',
                path       : '/ws-only',
                params     : []
            }]);

            await server.start();

            // Act: request WS upgrade on a non-existent path /wrong-path
            const isBun = typeof ( globalThis as any ).Bun !== 'undefined';
            let rawResponse : string;

            if( !isBun )
            {
                const port = ( server.nodeServer.address() as net.AddressInfo ).port;
                rawResponse = await new Promise<string>(( resolve, reject ) =>
                {
                    const client = net.connect( port, '127.0.0.1', () =>
                    {
                        client.write(
                            'GET /wrong-path HTTP/1.1\r\n' +
                            'Host: localhost\r\n' +
                            'Upgrade: websocket\r\n' +
                            'Connection: Upgrade\r\n' +
                            'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n' +
                            'Sec-WebSocket-Version: 13\r\n\r\n'
                        );
                    });

                    let data = '';
                    client.on( 'data', chunk => { data += chunk.toString( 'utf8' ) });
                    client.on( 'end', () => resolve( data ));
                    client.on( 'close', () => resolve( data ));
                    client.on( 'error', reject );
                });
            }
            else
            {
                rawResponse = await new Promise<string>(( resolve ) =>
                {
                    let written = '';
                    const mockSocket = {
                        destroyed : false,
                        write     : ( chunk : string ) => { written += chunk },
                        end       : ( chunk? : string ) =>
                        {
                            if( chunk ){ written += chunk }
                            mockSocket.destroyed = true;
                            resolve( written );
                        },
                        destroy : () =>
                        {
                            mockSocket.destroyed = true;
                            resolve( written );
                        }
                    };

                    server.nodeServer.emit( 'upgrade', {
                        url     : '/wrong-path',
                        headers : {
                            host                    : 'localhost',
                            upgrade                 : 'websocket',
                            connection              : 'Upgrade',
                            'sec-websocket-key'     : 'dGhlIHNhbXBsZSBub25jZQ==',
                            'sec-websocket-version' : '13'
                        },
                        socket : { remoteAddress : '127.0.0.1' }
                    }, mockSocket, Buffer.alloc( 0 ));
                });
            }

            await server.shutdown();

            // Assert
            expect( rawResponse ).toContain( 'HTTP/1.1 404' );
        });
    });

    describe( 'NodeAdapter Malformed Request URL Handling', () =>
    {
        it( 'should respond 400 Bad Request instead of throwing when Host header produces an invalid URL', async () =>
        {
            // Arrange
            const server = new Server({ port : 0, signals : false });
            ( server as any ).detectRuntime = () => 'Node';
            seedInstanceController( server.registry, 'PingCtrl', {
                ping : () => ({ ok : true })
            }, [{
                methodName : 'ping',
                httpMethod : 'GET',
                path       : '/ping',
                params     : []
            }]);

            await server.start();
            const port = ( server.nodeServer.address() as net.AddressInfo ).port;

            // Act
            const rawResponse = await new Promise<string>(( resolve, reject ) =>
            {
                const client = net.connect( port, '127.0.0.1', () =>
                {
                    client.write(
                        'GET /ping HTTP/1.1\r\n' +
                        'Host: [::invalid::host\r\n' +
                        'Connection: close\r\n\r\n'
                    );
                });

                let data = '';
                client.on( 'data', chunk => { data += chunk.toString( 'utf8' ) });
                client.on( 'end', () => resolve( data ));
                client.on( 'close', () => resolve( data ));
                client.on( 'error', reject );
            });

            await server.shutdown();

            // Assert
            expect( rawResponse ).toContain( '400 Bad Request' );
        });
    });

    describe( 'CORS Vary Header Merge & Multipart Disk Upload Cleanup on Failure', () =>
    {
        it( 'should merge Vary: Origin with an existing Vary header from the handler', async () =>
        {
            // Arrange
            const server = new Server({
                port : 0,
                cors : { origin : [ 'https://app.example.com' ] }
            });

            seedInstanceController( server.registry, 'VaryCtrl', {
                get : () => new Response( 'content', {
                    headers : { Vary : 'Accept-Encoding' }
                })
            }, [{
                methodName : 'get',
                httpMethod : 'GET',
                path       : '/vary',
                params     : []
            }]);

            // Act
            const res = await server.fetch( new Request( 'http://localhost/vary', {
                headers : { Origin : 'https://app.example.com' }
            }));

            // Assert
            expect( res.headers.get( 'Vary' )).toBe( 'Accept-Encoding, Origin' );
        });

        it( 'should delete disk multipart files when parameter validation fails after upload parsing', async () =>
        {
            // Arrange
            const tmpDir = fs.mkdtempSync( path.join( os.tmpdir(), 'weberg-upload-clean-' ));

            try
            {
                const server = new Server({
                    port  : 0,
                    files : { dest : tmpDir }
                });

                seedInstanceController( server.registry, 'UploadCtrl', {
                    upload : () => ({ ok : true })
                }, [{
                    methodName : 'upload',
                    httpMethod : 'POST',
                    path       : '/upload',
                    params     : [
                        { source : 'File', name : 'avatar' },
                        {
                            source    : 'Query',
                            name      : 'version',
                            validator : ( v: any, p: string, ctx: any ) =>
                            {
                                ctx.success = false;
                                ctx.errors.push({ path : p, error : 'InvalidType<number>' });

                                return v;
                            }
                        }
                    ]
                }]);

                const boundary = '----WebKitFormBoundaryCleanupTest';
                const body = [
                    `--${boundary}`,
                    'Content-Disposition: form-data; name="avatar"; filename="pic.png"',
                    'Content-Type: image/png',
                    '',
                    'PNG_DATA_BYTES',
                    `--${boundary}--`,
                    ''
                ].join( '\r\n' );

                // Act
                const res = await server.fetch( new Request( 'http://localhost/upload?version=bad', {
                    method  : 'POST',
                    headers : { 'content-type' : `multipart/form-data; boundary=${boundary}` },
                    body
                }));

                // Assert
                expect( res.status ).toBe( 400 );
                const remainingFiles = fs.readdirSync( tmpDir );
                expect( remainingFiles ).toEqual([]);
            }
            finally
            {
                fs.rmSync( tmpDir, { recursive : true, force : true });
            }
        });
    });

    describe( 'TcpMessageAdapter Concurrent Dispatch & TcpClient Timeout', () =>
    {
        it( 'should process multiple RPC lines in a single TCP chunk concurrently without head-of-line blocking and support send timeout', async () =>
        {
            // Arrange
            const probe = net.createServer();
            const port = await new Promise<number>(( resolve ) =>
            {
                probe.listen( 0, '127.0.0.1', () =>
                {
                    const p = ( probe.address() as net.AddressInfo ).port;
                    probe.close(() => resolve( p ));
                });
            });

            const adapter = new TcpMessageAdapter( port );
            const order: string[] = [];

            await adapter.listen( async ( pattern ) =>
            {
                if( pattern === 'slow' )
                {
                    await new Promise( r => setTimeout( r, 60 ));
                    order.push( 'slow' );

                    return 'slow-ok';
                }

                if( pattern === 'fast' )
                {
                    order.push( 'fast' );

                    return 'fast-ok';
                }

                if( pattern === 'hang' )
                {
                    await new Promise( r => setTimeout( r, 200 ));

                    return 'late';
                }

                return null;
            });

            const client = new TcpClient({ port });
            await client.connect();

            try
            {
                // Act
                const [ slowRes, fastRes ] = await Promise.all([
                    client.send( 'slow', {}),
                    client.send( 'fast', {})
                ]);

                // Assert: fast finishes before slow even when sent back-to-back
                expect( slowRes ).toBe( 'slow-ok' );
                expect( fastRes ).toBe( 'fast-ok' );
                expect( order ).toEqual([ 'fast', 'slow' ]);

                // Act & Assert: timeout rejects promptly
                await expect( client.send( 'hang', {}, 25 )).rejects.toThrow( /timed out after 25ms/ );
            }
            finally
            {
                await client.close();
                await adapter.close();
            }
        });
    });

    describe( 'Request-Scoped Union Branch Serializer Isolation', () =>
    {
        it( 'should isolate branch serializers across concurrent requests returning the same shared object reference', async () =>
        {
            // Arrange
            const sharedObj = Object.freeze({ id : 'shared-1', secret : 'hidden' });
            const server = new Server({ port : 0 });

            class DelayInterceptor
            {
                async intercept( _req: any, next: () => Promise<any> )
                {
                    const res = await next();
                    await new Promise( r => setTimeout( r, 20 ));

                    return res;
                }
            }
            setInjectableMeta( DelayInterceptor, { kind : 'interceptor', token : 'DelayInterceptor' });
            server.registry.registerInterceptor( 'DelayInterceptor', DelayInterceptor );

            seedInstanceController( server.registry, 'BranchRaceCtrl', {
                stripEndpoint : async () =>
                {
                    getBranchSerializers().set( sharedObj, ( v: any ) => JSON.stringify({ id : v.id }));
                    await new Promise( r => setTimeout( r, 15 ));

                    return sharedObj;
                },
                fullEndpoint : async () =>
                {
                    getBranchSerializers().set( sharedObj, ( v: any ) => JSON.stringify({ id : v.id, secret : v.secret }));
                    await new Promise( r => setTimeout( r, 5 ));

                    return sharedObj;
                }
            }, [
                {
                    methodName   : 'stripEndpoint',
                    httpMethod   : 'GET',
                    path         : '/strip',
                    params       : [],
                    interceptors : [ 'DelayInterceptor' ]
                },
                {
                    methodName   : 'fullEndpoint',
                    httpMethod   : 'GET',
                    path         : '/full',
                    params       : [],
                    interceptors : [ 'DelayInterceptor' ]
                }
            ]);

            // Act
            const [ stripRes, fullRes ] = await Promise.all([
                ( server as any ).fetch( new Request( 'http://localhost/strip' )),
                ( server as any ).fetch( new Request( 'http://localhost/full' ))
            ]);

            // Assert
            expect( await stripRes.json()).toEqual({ id : 'shared-1' });
            expect( await fullRes.json()).toEqual({ id : 'shared-1', secret : 'hidden' });
        });
    });

    describe( 'Compiler Diagnostics & Swagger Completeness', () =>
    {
        function transformMultiFile( files: Record<string, string> ): void
        {
            const tmpDir = fs.mkdtempSync( path.join( os.tmpdir(), 'weberg-compiler-diag-' ));
            const written: string[] = [];

            try
            {
                for( const [ name, code ] of Object.entries( files ))
                {
                    const filePath = path.join( tmpDir, name );
                    fs.writeFileSync( filePath, code );
                    written.push( filePath );
                }

                const program = ts.createProgram( written, {
                    target                 : ts.ScriptTarget.ES2022,
                    module                 : ts.ModuleKind.NodeNext,
                    moduleResolution       : ts.ModuleResolutionKind.NodeNext,
                    skipLibCheck           : true,
                    experimentalDecorators : true
                });
                const plugin = compilerPlugin( program );

                for( const filePath of written )
                {
                    const sf = program.getSourceFile( filePath )!;
                    ts.transform( sf, [ plugin ]);
                }
            }
            finally
            {
                fs.rmSync( tmpDir, { recursive : true, force : true });
            }
        }

        it( 'should throw a compile-time diagnostic when two files declare the same @Controller class name', () =>
        {
            // Arrange & Act & Assert
            expect(() => transformMultiFile({
                'v1.ts' : `
                    function Controller( _p?: string ){ return ( _t: any ) => {} }
                    @Controller( '/v1' )
                    export class UsersController {}
                `,
                'v2.ts' : `
                    function Controller( _p?: string ){ return ( _t: any ) => {} }
                    @Controller( '/v2' )
                    export class UsersController {}
                `
            })).toThrow( /Duplicate controller class name "UsersController"/ );
        });

        it( 'should throw a compile-time diagnostic when a @Module controller injects an unexported or unimported provider from another @Module', () =>
        {
            // Arrange & Act & Assert: BillingModule is not imported
            expect(() => transformMultiFile({
                'app.ts' : `
                    function Controller( _p?: string ){ return ( _t: any ) => {} }
                    function Injectable(){ return ( _t: any ) => {} }
                    function Module( _m?: any ){ return ( _t: any ) => {} }

                    @Injectable()
                    export class BillingService {}

                    @Module({ providers : [ BillingService ], exports : [ BillingService ] })
                    export class BillingModule {}

                    @Controller( '/users' )
                    export class UsersController {
                        constructor( private billing: BillingService ) {}
                    }

                    @Module({ controllers : [ UsersController ] })
                    export class UsersModule {}
                `
            })).toThrow( /Cannot inject "BillingService" into "UsersController" in module "UsersModule": "BillingService" is declared in "BillingModule", which is not imported/ );

            // Arrange & Act & Assert: BillingModule is imported, but BillingService is not exported
            expect(() => transformMultiFile({
                'app.ts' : `
                    function Controller( _p?: string ){ return ( _t: any ) => {} }
                    function Injectable(){ return ( _t: any ) => {} }
                    function Module( _m?: any ){ return ( _t: any ) => {} }

                    @Injectable()
                    export class BillingService {}

                    @Module({ providers : [ BillingService ] })
                    export class BillingModule {}

                    @Controller( '/users' )
                    export class UsersController {
                        constructor( private billing: BillingService ) {}
                    }

                    @Module({ imports : [ BillingModule ], controllers : [ UsersController ] })
                    export class UsersModule {}
                `
            })).toThrow( /"BillingService" is declared in "BillingModule" but is not in its exports/ );
        });

        it( 'should omit @Internal endpoints and include controller tags in generated Swagger spec', () =>
        {
            // Arrange
            const dir = fs.mkdtempSync( path.join( os.tmpdir(), 'weberg-swagger-spec-' ));

            try
            {
                const ctrlPath = path.join( dir, 'ApiCtrl.ts' );
                fs.writeFileSync( ctrlPath, `
                    export class ApiCtrl {
                        pub( apiKey: string ) { return { ok: true } }
                        secret() { return { hidden: true } }
                    }
                ` );

                const program = ts.createProgram([ ctrlPath ], {
                    target       : ts.ScriptTarget.ES2022,
                    module       : ts.ModuleKind.ESNext,
                    skipLibCheck : true
                });
                const registry = createRegistry();
                registry.controllers.set( 'ApiCtrl', { path : ctrlPath, injections : new Map() });
                registry.endpoints.push(
                    {
                        controller   : 'ApiCtrl',
                        methodName   : 'pub',
                        httpMethod   : 'GET',
                        path         : '/pub',
                        params       : [{ source : 'Header', name : 'x-api-key' }],
                        guards       : [],
                        interceptors : [],
                        meta         : {}
                    },
                    {
                        controller   : 'ApiCtrl',
                        methodName   : 'secret',
                        httpMethod   : 'GET',
                        path         : '/internal-only',
                        internal     : true,
                        params       : [],
                        guards       : [],
                        interceptors : [],
                        meta         : {}
                    }
                );

                vi.spyOn( console, 'log' ).mockImplementation(() => {});

                // Act
                SwaggerSpecGenerator.generate( registry, program, dir );
                const spec = JSON.parse( fs.readFileSync( path.join( dir, 'swagger.json' ), 'utf8' ));

                // Assert
                expect( spec.paths['/internal-only']).toBeUndefined();
                expect( spec.paths['/pub'].get.tags ).toEqual([ 'ApiCtrl' ]);
                expect( spec.paths['/pub'].get.parameters ).toEqual([
                    expect.objectContaining({ name : 'x-api-key', in : 'header' })
                ]);
            }
            finally
            {
                fs.rmSync( dir, { recursive : true, force : true });
            }
        });
    });

    describe( 'Parametric Rate-Limit Keying, WS Security Gates & WS Upgrade Query Reuse', () =>
    {
        it( 'should key rate limits by route pattern (metadata.path) instead of raw URL path', async () =>
        {
            // Arrange
            const server = new Server({
                port     : 0,
                security : {
                    rateLimit : { max : 2, windowMs : 60_000 }
                }
            });

            seedInstanceController( server.registry, 'UserCtrl', {
                get : () => ({ ok : true })
            }, [{
                methodName : 'get',
                httpMethod : 'GET',
                path       : '/users/:id',
                params     : [{ source : 'Param', name : 'id' }]
            }]);

            // Act — 3 requests to distinct URLs matching the same `/users/:id` route pattern
            const r1 = await server.fetch( new Request( 'http://localhost/users/1' ));
            const r2 = await server.fetch( new Request( 'http://localhost/users/2' ));
            const r3 = await server.fetch( new Request( 'http://localhost/users/3' ));

            // Assert — 3rd request hits the shared `/users/:id` rate-limit bucket
            expect( r1.status ).toBe( 200 );
            expect( r2.status ).toBe( 200 );
            expect( r3.status ).toBe( 429 );
            expect( r3.headers.get( 'Retry-After' )).toBeTruthy();
        });

        it( 'should enforce rate limits on WebSocket upgrade handshakes', async () =>
        {
            // Arrange
            const server = new Server({
                port     : 0,
                security : {
                    rateLimit : { max : 1, windowMs : 60_000 }
                }
            });

            seedInstanceController( server.registry, 'WsRateCtrl', {
                chat : () => {}
            }, [{
                methodName : 'chat',
                httpMethod : 'WS',
                path       : '/ws/:room',
                params     : []
            }]);

            ( server as any ).serverAdapter = {
                upgrade : vi.fn( async () => new Response( null, { status : 200 }))
            };

            // Act — 2 WS upgrade requests to `/ws/room-a` and `/ws/room-b`
            const r1 = await server.fetch( new Request( 'http://localhost/ws/room-a', {
                headers : { Upgrade : 'websocket' }
            }));
            const r2 = await server.fetch( new Request( 'http://localhost/ws/room-b', {
                headers : { Upgrade : 'websocket' }
            }));

            // Assert
            expect( r1.status ).toBe( 200 );
            expect( r2.status ).toBe( 429 );
        });

        it( 'should reuse handed-off ServerRequest.query in upgradeQuery when __wsRequestContext is present', () =>
        {
            // Arrange
            const req = new Request( 'http://localhost/ws?token=abc' );
            const cachedQuery = { token : 'reused' };
            ( req as any ).__wsRequestContext = {
                request : {
                    get query()
                    {
                        return cachedQuery;
                    }
                }
            };

            // Act & Assert
            expect( upgradeQuery( req )).toBe( cachedQuery );
        });
    });

    describe( 'Multipart Limits, Microservice Graceful Drain & Error Redaction', () =>
    {
        it( 'should enforce maxFiles before invoking onFile and reject oversized part headers', async () =>
        {
            // Arrange — maxFiles = 1, 2 file parts
            const openedFiles: string[] = [];
            const boundary = '----WebKitFormBoundaryMaxFiles';
            const body = Buffer.from([
                `--${boundary}`,
                'Content-Disposition: form-data; name="f1"; filename="a.txt"',
                '',
                'one',
                `--${boundary}`,
                'Content-Disposition: form-data; name="f2"; filename="b.txt"',
                '',
                'two',
                `--${boundary}--`,
                ''
            ].join( '\r\n' ));

            const parser = new MultipartParser( boundary, {
                maxFiles : 1,
                onFile   : ( file ) => { openedFiles.push( file.filename ) }
            });
            parser.append( body );

            // Act & Assert — 2nd file must be rejected before onFile is invoked
            await expect( parser.finish()).rejects.toMatchObject({ status : 413 });
            expect( openedFiles ).toEqual([ 'a.txt' ]);

            // Oversized part header (> MAX_PART_HEADER_SIZE)
            const headerParser = new MultipartParser( boundary );
            headerParser.append( Buffer.from(
                `--${boundary}\r\nContent-Disposition: form-data; name="x"\r\nX-Pad: ${'a'.repeat( MAX_PART_HEADER_SIZE + 64 )}`
            ));
            await expect( headerParser.parse()).rejects.toMatchObject({ status : 431 });
        });

        it( 'should deduplicate concurrent Microservice.ensureReady() and drain in-flight RPCs before destroyAll()', async () =>
        {
            // Arrange
            let handlerRef: (( pattern: string, data: any ) => Promise<any> ) | undefined;
            const events: string[] = [];

            class SlowRpcService
            {
                async onInit()
                {
                    await new Promise( r => setTimeout( r, 10 ));
                    events.push( 'init' );
                }

                async onDestroy()
                {
                    events.push( 'destroy' );
                }
            }
            setInjectableMeta( SlowRpcService, { kind : 'provider', token : 'SlowRpcService' });

            class RpcCtrl
            {
                async work()
                {
                    events.push( 'rpc:start' );
                    await new Promise( r => setTimeout( r, 30 ));
                    events.push( 'rpc:end' );

                    return { ok : true };
                }
            }
            defineController( RpcCtrl, [{
                methodName : 'work',
                httpMethod : 'RPC',
                path       : 'jobs.work',
                params     : []
            }]);

            const ms = new Microservice(
                {
                    listen : async ( cb ) => { handlerRef = cb },
                    close  : async () => { events.push( 'adapter:close' ) }
                },
                {
                    controllers : [ RpcCtrl ],
                    providers   : [ SlowRpcService ]
                }
            );

            // Act — concurrent ensureReady calls
            await Promise.all([ ms.ensureReady(), ms.ensureReady() ]);
            expect( events ).toEqual([ 'init' ]);

            await ms.start();
            const inFlight = handlerRef!( 'jobs.work', {});
            await new Promise( r => setTimeout( r, 5 ));
            const shuttingDown = ms.shutdown( 1000 );

            // New RPCs during shutdown are rejected
            await expect( handlerRef!( 'jobs.work', {})).rejects.toThrow( /Shutting Down/ );

            await Promise.all([ inFlight, shuttingDown ]);

            // Assert — rpc:end happens BEFORE destroy
            expect( events ).toEqual([ 'init', 'rpc:start', 'adapter:close', 'rpc:end', 'destroy' ]);
        });

        it( 'should redact secrets in errorLogFields without losing data on circular references', () =>
        {
            // Arrange
            const data: Record<string, any> = { password : 'secret', count : 1 };
            data.self = data;
            const err = Object.assign( new Error( 'circular' ), { status : 500, data });

            // Act
            const fields = errorLogFields( err );

            // Assert
            expect(( fields.data as any ).password ).toBe( REDACTED );
            expect(( fields.data as any ).count ).toBe( 1 );
        });

        it( 'should cover isWsPayloadTooLarge, computeBodyHash, symbols branch map, NdjsonLineFramer, and Router prefix trie inheritance', async () =>
        {
            // 1. isWsPayloadTooLarge
            expect( isWsPayloadTooLarge( 'hello', undefined )).toBe( false );
            expect( isWsPayloadTooLarge( 'hello', 3 )).toBe( true );
            expect( isWsPayloadTooLarge( 'hi', 3 )).toBe( false );
            expect( isWsPayloadTooLarge( new Uint8Array( 5 ), 4 )).toBe( true );
            expect( isWsPayloadTooLarge({ length : 5 }, 4 )).toBe( true );
            expect( isWsPayloadTooLarge({}, 4 )).toBe( false );
            expect( isWsPayloadTooLarge( 123, 4 )).toBe( false );

            // 2. computeBodyHash factory fallback & buffer/Uint8Array digest branches
            const raw = new TextEncoder().encode( 'payload' ).buffer as ArrayBuffer;
            const arrowFactory = () => ({
                update() { return this },
                digest() { return 'str-digest' }
            });
            const bufFromStr = computeBodyHash( raw, arrowFactory, { encoding : 'buffer' });
            expect( Buffer.isBuffer( bufFromStr )).toBe( true );

            const uintFactory = () => ({
                update() { return this },
                digest() { return new Uint8Array([ 1, 2, 3 ]) }
            });
            expect( computeBodyHash( raw, uintFactory, { encoding : 'buffer' })).toBeInstanceOf( Uint8Array );
            expect( computeBodyHash( raw, uintFactory, { encoding : 'hex' })).toBe( '010203' );

            // 3. symbols.ts context-aware branchSerializers WeakMap upgrade / has / delete
            const originalMap = ( globalThis as any )[WEBERGENCY_BRANCH_SERIALIZERS];
            try
            {
                const customMap = new WeakMap<object, ( val: any ) => string>();
                const keyObj = {};
                customMap.set( keyObj, () => 'fallback' );
                ( globalThis as any )[WEBERGENCY_BRANCH_SERIALIZERS] = customMap;

                const upgraded = getBranchSerializers();
                expect( getBranchSerializers()).toBe( upgraded );
                expect( upgraded.get( keyObj )?.( null )).toBe( 'fallback' );
                expect( upgraded.has( keyObj )).toBe( true );

                await Context.run({ request : {} as any, metadata : {} as any }, async () =>
                {
                    const ctxKey = {};
                    upgraded.set( ctxKey, () => 'ctx' );
                    expect( upgraded.has( ctxKey )).toBe( true );
                    expect( upgraded.delete( ctxKey )).toBe( true );
                    expect( upgraded.delete( ctxKey )).toBe( false );
                });

                expect( upgraded.delete( keyObj )).toBe( true );

                ( globalThis as any )[WEBERGENCY_BRANCH_SERIALIZERS] = null;
                expect( getBranchSerializers()).toBe( originalMap );
            }
            finally
            {
                ( globalThis as any )[WEBERGENCY_BRANCH_SERIALIZERS] = originalMap;
            }

            // 4. NdjsonLineFramer string input and oversized complete line
            const framer = new NdjsonLineFramer( 10 );
            expect( framer.push( 'abc\n' )).toEqual({ lines : [ 'abc' ], oversized : false });
            expect( framer.push( '0123456789abcdef\n' )).toEqual({ lines : [], oversized : true });

            // 5. error-response non-object error & array redaction
            expect( clientErrorBody( null, 500 )).toEqual({ success : false, error : 'Internal server error' });
            expect( redactSecrets([ { password : 'x' }, 'plain' ])).toEqual([ { password : REDACTED }, 'plain' ]);

            // 6. mergeFileConfigs pair cache hit & empty fields
            const baseCfg = { maxFiles : 2, fields : {} };
            const overCfg = { maxFiles : 4, fields : {} };
            const firstMerge = mergeFileConfigs([ baseCfg, overCfg ]);
            const secondMerge = mergeFileConfigs([ baseCfg, overCfg ]);
            expect( firstMerge ).toBe( secondMerge );
            expect( firstMerge?.fields ).toBeUndefined();

            // 7. Router prefix trie root wildcard inheritance into child node
            const router = new Router();
            router.add({
                controller   : 'C',
                methodName   : 'wild',
                httpMethod   : 'GET',
                path         : '/*splat',
                params       : [],
                guards       : [],
                interceptors : [],
                meta         : {}
            });
            router.add({
                controller   : 'C',
                methodName   : 'deep',
                httpMethod   : 'GET',
                path         : '/api/v1/:id/items',
                params       : [],
                guards       : [],
                interceptors : [],
                meta         : {}
            });
            // `/api/v1` has no direct entries of its own, so it inherits `/*splat` from root
            expect( router.match( 'GET', '/api/v1' )?.metadata.methodName ).toBe( 'wild' );
            expect( router.match( 'GET', '/api/v1/42/items' )?.metadata.methodName ).toBe( 'deep' );

            // 8. Microservice @EventPattern during shutdown returns MicroserviceNoReply
            let eventCb: (( pattern: string, data: any ) => Promise<any> ) | undefined;
            class EvCtrl
            {
                onEv() {}
            }
            defineController( EvCtrl, [{
                methodName : 'onEv',
                httpMethod : 'RPC',
                path       : 'ev.fire',
                params     : [],
                meta       : { event : true }
            }]);
            const evMs = new Microservice(
                {
                    listen : async ( cb ) => { eventCb = cb },
                    close  : async () => {}
                },
                { controllers : [ EvCtrl ] }
            );
            await evMs.start();
            await evMs.shutdown();
            expect( await eventCb!( 'ev.fire', {})).toBe( MicroserviceNoReply );
        });

        it( 'should cover remaining core, helpers, node-adapter, and server edge cases', async () =>
        {
            // 1. Router matchMethod fallthrough when dynamic candidates do not match
            const r = new Router();
            r.add({
                controller   : 'C',
                methodName   : 'item',
                httpMethod   : 'GET',
                path         : '/items/:id/detail',
                params       : [],
                guards       : [],
                interceptors : [],
                meta         : {}
            });
            expect( r.match( 'GET', '/items/123/other' )).toBeNull();

            // 2. Registry destroyInstances error logging, getCached tokenToModuleMap fallback, topologicalInstances duplicate token
            const errSpy = vi.spyOn( console, 'error' ).mockImplementation(() => {});
            await ApplicationRegistry.destroyInstances([{
                onDestroy() { throw new Error( 'destroy-fail' ) }
            }]);
            expect( errSpy ).toHaveBeenCalledWith( '[onDestroy]', expect.any( Error ));

            const reg = new ApplicationRegistry();
            class ModA {}
            class ModB {}
            class CircA
            {
                static __injections__ = { constructorDeps : [ 'CircB' ] };
                constructor( public b: any ) {}
            }
            class CircB
            {
                static __injections__ = { constructorDeps : [ 'CircA' ] };
                constructor( public a: any ) {}
                ping() { return 'pong' }
            }
            const modA = reg.registerModule( ModA, { providers : [ 'CircA', 'CircB', 'DupSvc' ] });
            reg.registerProvider( 'CircA', CircA, undefined, modA );
            reg.registerProvider( 'CircB', CircB, undefined, modA );
            const circA = await reg.getInjectable( 'CircA' );
            expect( circA.b.ping()).toBe( 'pong' );

            class DupSvc
            {
                onInit() {}
            }
            const modB = reg.createModuleInstance( 'ModB', ModB );
            const modAInst = reg.createModuleInstance( 'ModA', ModA );
            modAInst.instances.set( 'DupSvc', new DupSvc());
            modB.instances.set( 'DupSvc', new DupSvc());
            await reg.invokeHook( 'onInit' );

            // 3. ServerRequest.from, ip cache hit, recordForwardHop depth, tryGetJsonText non-JSON without Content-Type
            const rawReq = new Request( 'http://localhost/test', {
                method : 'POST',
                body   : 'not-json-at-all'
            });
            rawReq.headers.delete( 'content-type' );
            const sreq1 = ServerRequest.from( rawReq );
            const sreq2 = ServerRequest.from( sreq1, undefined, { maxFiles : 3 });
            expect( sreq2 ).toBe( sreq1 );
            expect( sreq2.fileOptions ).toEqual({ maxFiles : 3 });
            expect( sreq1.ip ).toBe( '127.0.0.1' );
            expect( sreq1.ip ).toBe( '127.0.0.1' );
            expect(() =>
            {
                sreq1.recordForwardHop( 'GET /a', 1 );
                sreq1.recordForwardHop( 'GET /b', 1 );
            }).toThrow( /Forward depth exceeded/ );
            expect( await sreq1.tryGetJsonText()).toBeUndefined();

            // 4. client-ip invalid IP in ipInCidr & trusted peer without XFF
            expect( ipInCidr( 'not-an-ip', '10.0.0.0/8' )).toBe( false );
            expect( resolveClientIp({
                headers       : new Headers(),
                remoteAddress : '127.0.0.1',
                trustProxy    : [ '127.0.0.1/32' ]
            })).toBe( '127.0.0.1' );

            // 5. cors string methods & exposedHeaders on non-static origin
            const corsRes = handleCors(
                new Request( 'http://localhost/x', {
                    method  : 'OPTIONS',
                    headers : {
                        Origin                          : 'https://app.test',
                        'Access-Control-Request-Method' : 'GET'
                    }
                }),
                { origin : 'https://app.test', methods : 'GET' }
            ) as Response;
            expect( corsRes.headers.get( 'Access-Control-Allow-Methods' )).toBe( 'GET' );

            const corsActual = handleCors(
                new Request( 'http://localhost/x', { headers : { Origin : 'https://app.test' } }),
                { origin : 'https://app.test', exposedHeaders : [ 'X-Total' ] }
            ) as Record<string, string>;
            expect( corsActual['Access-Control-Expose-Headers']).toBe( 'X-Total' );

            // 6. match.ts custom decode function (success and error)
            const okMatcher = pathMatcher( '/u/:id', { decode : ( v ) => v.toUpperCase() });
            expect( okMatcher( '/u/abc' )).toEqual({ path : '/u/abc', params : { id : 'ABC' } });
            const badMatcher = pathMatcher( '/u/:id', { decode : () => { throw new Error( 'bad' ) } });
            expect(() => badMatcher( '/u/abc' )).toThrow( /Malformed percent-encoding/ );

            // 7. MultiBuffer single-buffer splice from start of second chunk (exact and partial)
            const mb1 = new MultiBuffer( Buffer.from( 'abc' ), Buffer.from( 'def' ));
            mb1.splice( 3, 3 );
            expect( mb1.spliceConcat( 0, mb1.length ).toString()).toBe( 'abc' );

            const mb2 = new MultiBuffer( Buffer.from( 'abc' ), Buffer.from( 'def' ));
            mb2.splice( 3, 2 );
            expect( mb2.spliceConcat( 0, mb2.length ).toString()).toBe( 'abcf' );

            // 8. Multipart UploadedFile pre-buffered save, error event, backpressure drain, and single-chunk oversized header
            const tmpFile = path.join( os.tmpdir(), `weberg-up-${Date.now()}.bin` );
            try
            {
                const uf = new UploadedFile( 'f', 'a.bin', 'application/octet-stream', {});
                uf.write( Buffer.from( 'pre' ));
                uf.save( tmpFile );
                ( uf as any ).writeStream.emit( 'error', new Error( 'disk-err' ));
                expect(( uf as any ).error.message ).toBe( 'disk-err' );
                await uf.cleanup();
            }
            finally
            {
                fs.rmSync( tmpFile, { force : true });
            }

            // Backpressure drain in MultipartParser (both flushFileSafe and boundary finish)
            const bpBoundary = '----BPBoundary';
            const bpParser = new MultipartParser( bpBoundary, {
                onFile : ( file ) =>
                {
                    ( file as any ).fileMode = 'disk';
                    const fakeStream = new net.Socket();
                    fakeStream.write = (() =>
                    {
                        setImmediate(() => fakeStream.emit( 'drain' ));

                        return false;
                    }) as any;
                    fakeStream.end = (( cb?: () => void ) => { cb?.() }) as any;
                    fakeStream.destroy = (() => fakeStream ) as any;
                    ( file as any ).writeStream = fakeStream;
                }
            });
            bpParser.append( Buffer.from(
                `--${bpBoundary}\r\nContent-Disposition: form-data; name="f"; filename="x.bin"\r\n\r\n` +
                'x'.repeat( 128 )
            ));
            await bpParser.parse();
            bpParser.append( Buffer.from( `\r\n--${bpBoundary}--\r\n` ));
            const bpRes = await bpParser.finish();
            expect( bpRes.files.length ).toBe( 1 );

            const bigHeaderWithEnd = new MultipartParser( bpBoundary );
            bigHeaderWithEnd.append( Buffer.from(
                `--${bpBoundary}\r\nContent-Disposition: form-data; name="x"\r\nX-Big: ${'y'.repeat( MAX_PART_HEADER_SIZE + 10 )}\r\n\r\nhi\r\n--${bpBoundary}--\r\n`
            ));
            await expect( bigHeaderWithEnd.finish()).rejects.toMatchObject({ status : 431 });

            // 9. request-reader plain object headers, null headers, whitespace/huge Content-Length, empty stream
            expect( getContentType({ headers : { 'content-type' : 'application/json' } } as any )).toBe( 'application/json' );
            expect( getContentType({ headers : null } as any )).toBeNull();
            await expect( readRawBody({
                headers     : new Headers({ 'content-length' : '   ' }),
                arrayBuffer : async () => new ArrayBuffer( 0 )
            })).rejects.toMatchObject({ status : 400 });
            await expect( readRawBody({
                headers     : new Headers({ 'content-length' : '99999999999999999999999' }),
                arrayBuffer : async () => new ArrayBuffer( 0 )
            })).rejects.toMatchObject({ status : 400 });
            const emptyStreamBuf = await readRawBody({
                headers     : new Headers(),
                body        : new ReadableStream({ start( c ) { c.close() } }),
                arrayBuffer : async () => new ArrayBuffer( 0 )
            });
            expect( emptyStreamBuf.byteLength ).toBe( 0 );

            // 10. security.ts caches
            const secObj1 = { noSniff : true };
            const secObj2 = { xssFilter : true };
            expect( mergeSecurityConfigs([ secObj1, undefined ])).toBe( secObj1 );
            const m1 = mergeSecurityConfigs([ secObj1, secObj2 ]);
            expect( mergeSecurityConfigs([ secObj1, secObj2 ])).toBe( m1 );
            const hFalse1 = generateSecurityHeaders( false );
            expect( generateSecurityHeaders( false )).toBe( hFalse1 );
            const hObj1 = generateSecurityHeaders( secObj1 );
            expect( generateSecurityHeaders( secObj1 )).toBe( hObj1 );
        });

        it( 'should cover RequestProcessor, NodeAdapter, and Server edge cases', async () =>
        {
            // 1. RequestProcessor: assertForwardCompatible redirect + stream, forwardBody merge without parser, non-ParseError throw, non-singleton interceptor, @Seo pending forward, non-SerializationError throw, binary return without serializer, WS & RPC middlewares/request-scoped cleanup
            const server = new Server({ port : 0, health : true });

            class ReqInt
            {
                async intercept( _req: any, next: () => Promise<any> ) { return next() }
            }
            setInjectableMeta( ReqInt, { kind : 'interceptor', token : 'ReqInt', scope : Scope.REQUEST });
            server.registry.registerInterceptor( 'ReqInt', ReqInt, Scope.REQUEST );

            class MidSvc
            {
                use( _req: any, _res: ServerResponse ) {}
            }
            setInjectableMeta( MidSvc, { kind : 'provider', token : 'MidSvc' });
            server.registry.registerProvider( 'MidSvc', MidSvc );

            class GuardWithRes
            {
                use( _res: ServerResponse, _dep: any )
                {
                    return true;
                }
            }
            setGuardMeta( GuardWithRes, {
                params : [
                    { source : 'Response', name : '' },
                    { source : 'Inject', name : 'ReqScopedDep' }
                ]
            });
            server.registry.registerGuard( 'GuardWithRes', GuardWithRes );

            class ReqScopedDep
            {
                destroyed = false;
                onDestroy() { this.destroyed = true }
            }
            setInjectableMeta( ReqScopedDep, { kind : 'provider', token : 'ReqScopedDep', scope : Scope.REQUEST });
            server.registry.registerProvider( 'ReqScopedDep', ReqScopedDep, Scope.REQUEST );

            seedInstanceController( server.registry, 'EdgeCtrl', {
                redirAndForward( res: ServerResponse )
                {
                    res.header( 'Location', '/elsewhere' );
                    res.forward({ method : 'POST', path : '/internal-target' });
                },
                streamAndForward()
                {
                    const r = new ServerResponse();
                    r.stream( new ReadableStream());
                    r.forward({ method : 'POST', path : '/internal-target' });

                    return r;
                },
                seoForwardViaRes( res: ServerResponse )
                {
                    res.forward({ method : 'POST', path : '/internal-target' });

                    return { notSeoForward : true };
                },
                seoToVoidTarget()
                {
                    return { method : 'GET', path : '/seo-void-target' };
                },
                seoVoidTarget()
                {
                    return undefined;
                },
                internalTarget( body: any )
                {
                    return { merged : body };
                },
                nonParseErr()
                {
                    return { ok : true };
                },
                nonSerErr()
                {
                    return { ok : true };
                },
                binOut()
                {
                    return new Uint8Array([ 1, 2, 3 ]);
                },
                wsHandler() {},
                rpcHandler( dep: any )
                {
                    return { hasDep : Boolean( dep ) };
                }
            }, [
                {
                    methodName : 'redirAndForward',
                    httpMethod : 'GET',
                    path       : '/redir-forward',
                    params     : [{ source : 'Response', name : '' }]
                },
                {
                    methodName : 'streamAndForward',
                    httpMethod : 'GET',
                    path       : '/stream-forward',
                    params     : []
                },
                {
                    methodName : 'seoForwardViaRes',
                    httpMethod : 'GET',
                    path       : '/seo-via-res',
                    seo        : true,
                    params     : [{ source : 'Response', name : '' }]
                },
                {
                    methodName : 'seoToVoidTarget',
                    httpMethod : 'GET',
                    path       : '/seo-to-void',
                    seo        : true,
                    params     : []
                },
                {
                    methodName : 'seoVoidTarget',
                    httpMethod : 'GET',
                    path       : '/seo-void-target',
                    seo        : true,
                    params     : []
                },
                {
                    methodName   : 'internalTarget',
                    httpMethod   : 'POST',
                    path         : '/internal-target',
                    internal     : true,
                    interceptors : [ 'ReqInt' ],
                    params       : [{ source : 'Body', name : '' }]
                },
                {
                    methodName : 'nonParseErr',
                    httpMethod : 'POST',
                    path       : '/non-parse-err',
                    params     : [{
                        source : 'Body',
                        name   : '',
                        parser : () => { throw new Error( 'fatal-parser-bug' ) }
                    }]
                },
                {
                    methodName           : 'nonSerErr',
                    httpMethod           : 'GET',
                    path                 : '/non-ser-err',
                    params               : [],
                    returnTypeSerializer : () => { throw new Error( 'fatal-serializer-bug' ) }
                },
                {
                    methodName : 'binOut',
                    httpMethod : 'GET',
                    path       : '/bin-out',
                    guards     : [{ type : 'class', name : 'GuardWithRes', params : [] }],
                    params     : []
                },
                {
                    methodName  : 'wsHandler',
                    httpMethod  : 'WS',
                    path        : '/ws-mid',
                    middlewares : [ 'MidSvc' ],
                    guards      : [{ type : 'class', name : 'GuardWithRes', params : [] }],
                    params      : [{ source : 'Inject', name : 'ReqScopedDep' }]
                },
                {
                    methodName  : 'rpcHandler',
                    httpMethod  : 'RPC',
                    path        : 'rpc.mid',
                    middlewares : [ 'MidSvc' ],
                    guards      : [{ type : 'class', name : 'GuardWithRes', params : [] }],
                    params      : [{ source : 'Inject', name : 'ReqScopedDep' }]
                }
            ]);

            const errorsEmitted: Error[] = [];
            server.on( 'error', ( e ) => errorsEmitted.push( e ));

            expect(( await server.fetch( new Request( 'http://localhost/redir-forward' ))).status ).toBe( 500 );
            expect(( await server.fetch( new Request( 'http://localhost/stream-forward' ))).status ).toBe( 500 );
            expect(( await server.fetch( new Request( 'http://localhost/seo-via-res' ))).status ).toBe( 200 );
            expect(( await server.fetch( new Request( 'http://localhost/seo-to-void' ))).status ).toBe( 500 );
            expect(( await server.fetch( new Request( 'http://localhost/non-parse-err', {
                method  : 'POST',
                headers : { 'Content-Type' : 'application/json' },
                body    : '{"a":1}'
            }))).status ).toBe( 500 );
            expect(( await server.fetch( new Request( 'http://localhost/non-ser-err' ))).status ).toBe( 500 );
            expect( errorsEmitted.length ).toBeGreaterThan( 0 );

            const binRes = await server.fetch( new Request( 'http://localhost/bin-out' ));
            expect( new Uint8Array( await binRes.arrayBuffer())).toEqual( new Uint8Array([ 1, 2, 3 ]));

            // forwardBody merge when target has no parser and request already has JSON object body
            const fwdReq = new ServerRequest(
                new Request( 'http://localhost/internal-target', {
                    method  : 'POST',
                    headers : { 'Content-Type' : 'application/json' },
                    body    : JSON.stringify({ orig : 1 })
                }),
                { forwardBody : { extra : 2 } }
            );
            const fwdEp = server.registry.getEndpoints().find( e => e.path === '/internal-target' )!;
            const fwdRes = await RequestProcessor.execute( fwdEp, fwdReq, undefined, server.registry );
            expect( await fwdRes.json()).toEqual({ merged : { orig : 1, extra : 2 } });

            // WS with middleware + guard + 501 fallback cleans up request-scoped instances
            const wsEp = server.registry.getEndpoints().find( e => e.path === '/ws-mid' )!;
            const wsUpgradeRes = await server.fetch( new Request( 'http://localhost/ws-mid', {
                headers : { Upgrade : 'websocket' }
            }));
            expect( wsUpgradeRes.status ).toBe( 501 );

            // Direct executeWs with middleware and guard that uses getResponseBag
            const fakeWs = { close : vi.fn(), send : vi.fn(), on : vi.fn() };
            await runWithRegistry( server.registry, () =>
                RequestProcessor.executeWs(
                    wsEp,
                    fakeWs,
                    new Request( 'http://localhost/ws-mid' )
                )
            );
            // Also executeWs without middlewares but with GuardWithRes calling getResponseBag
            const wsEpNoMid: EndpointMetadata = {
                ...wsEp,
                middlewares : []
            };
            await runWithRegistry( server.registry, async () =>
            {
                const ctrl = await server.registry.getController( 'EdgeCtrl' );
                const sreq = new ServerRequest( new Request( 'http://localhost/ws-mid' ));
                await Context.run({ request : sreq, metadata : wsEpNoMid, registry : server.registry }, () =>
                    invokeGuards( wsEpNoMid, sreq, {
                        ctx         : { success : true, errors : [], mode : 'strict' },
                        controller  : ctrl,
                        getResponse : () => new ServerResponse()
                    })
                );
            });

            // Direct executeRpc with middleware, guard, and request-scoped provider
            const rpcEp = server.registry.getEndpoints().find( e => e.path === 'rpc.mid' )!;
            const rpcOut = await runWithRegistry( server.registry, () =>
                RequestProcessor.executeRpc( rpcEp, { a : 1 })
            );
            expect( rpcOut ).toEqual({ hasDep : true });

            // Also executeRpc without middlewares so GuardWithRes triggers getResponseBag lazy init
            const rpcEpNoMid: EndpointMetadata = {
                ...rpcEp,
                middlewares : []
            };
            const rpcOut2 = await runWithRegistry( server.registry, () =>
                RequestProcessor.executeRpc( rpcEpNoMid, { a : 1 })
            );
            expect( rpcOut2 ).toEqual({ hasDep : true });

            // OPTIONS (preflight and non-preflight) to non-existent route -> 404
            expect(( await server.fetch( new Request( 'http://localhost/no-such-route', {
                method  : 'OPTIONS',
                headers : {
                    Origin                          : 'https://a.test',
                    'Access-Control-Request-Method' : 'POST'
                }
            }))).status ).toBe( 404 );
            expect(( await server.fetch( new Request( 'http://localhost/no-such-route', {
                method : 'OPTIONS'
            }))).status ).toBe( 404 );

            // Health /ready when serverAdapter is set
            ( server as any ).serverAdapter = { close : async () => {} };
            expect(( await server.fetch( new Request( 'http://localhost/ready' ))).status ).toBe( 503 );

            // Health /ready when ensureReady throws
            const brokenServer = new Server({ port : 0, health : true });
            brokenServer.registry.registerEndpoint({
                controller   : 'C',
                methodName   : 'a',
                httpMethod   : 'GET',
                path         : '/dup',
                seo          : true,
                internal     : true,
                params       : [],
                guards       : [],
                interceptors : [],
                meta         : {}
            });
            expect(( await brokenServer.fetch( new Request( 'http://localhost/ready' ))).status ).toBe( 503 );

            // Public-after-Internal conflict
            const conflictServer = new Server({ port : 0 });
            conflictServer.registry.registerEndpoint({
                controller   : 'C',
                methodName   : 'a',
                httpMethod   : 'GET',
                path         : '/x',
                internal     : true,
                params       : [],
                guards       : [],
                interceptors : [],
                meta         : {}
            });
            conflictServer.registry.registerEndpoint({
                controller   : 'C',
                methodName   : 'b',
                httpMethod   : 'GET',
                path         : '/x',
                params       : [],
                guards       : [],
                interceptors : [],
                meta         : {}
            });
            await expect( conflictServer.ensureReady()).rejects.toThrow( /conflicts with an Internal route/ );

            // NodeAdapter: endUpgradeSocket fallbacks, Set-Cookie + stream error, upgrade URL/handler error, WS protocol_error
            await runWithRegistry( server.registry, async () =>
            {
                const adapter = new NodeAdapter();
                await adapter.listen( 0, async ( req ) =>
                {
                    if( req.url.endsWith( '/throw' ))
                    {
                        throw new Error( 'upgrade-handler-fail' );
                    }

                    const headers = new Headers();
                    headers.append( 'Set-Cookie', 'a=1' );
                    const errStream = new ReadableStream({
                        start( controller )
                        {
                            controller.error( new Error( 'stream-boom' ));
                        }
                    });

                    return new Response( errStream, { status : 200, headers });
                });

                try
                {
                    const ns = ( adapter as any ).nodeServer;
                    const reqListener = ns.listeners( 'request' )[0];
                    const upgradeListener = ns.listeners( 'upgrade' )[0];

                    // 1) HTTP request with Set-Cookie and failing stream body
                    const fakeRes = new net.Socket();
                    const setHeaders: Record<string, any> = {};
                    ( fakeRes as any ).setHeader = ( k: string, v: any ) => { setHeaders[k] = v };
                    let destroyedErr: Error | undefined;
                    fakeRes.destroy = (( err?: Error ) =>
                    {
                        destroyedErr = err;
                        ( fakeRes as any ).destroyed = true;

                        return fakeRes;
                    }) as any;
                    await reqListener({
                        method  : 'GET',
                        url     : '/cookie-err',
                        headers : { host : 'localhost' }
                    }, fakeRes );
                    await new Promise( r => setTimeout( r, 15 ));
                    expect( setHeaders['set-cookie']).toEqual([ 'a=1' ]);
                    expect( destroyedErr?.message ).toBe( 'stream-boom' );

                    // 2) upgradeListener with invalid URL + socket whose end() throws
                    let destroyedOnEndThrow = false;
                    await upgradeListener(
                        { url : 'http://[::1', headers : { host : 'localhost' } },
                        {
                            destroyed : false,
                            end       : () => { throw new Error( 'end-boom' ) },
                            destroy   : () => { destroyedOnEndThrow = true }
                        },
                        Buffer.alloc( 0 )
                    );
                    expect( destroyedOnEndThrow ).toBe( true );

                    // 3) upgradeListener where handler throws + socket without end()
                    const writtenRaw: string[] = [];
                    let destroyedNoEnd = false;
                    await upgradeListener(
                        { url : '/throw', headers : { host : 'localhost' } },
                        {
                            destroyed : false,
                            write     : ( s: string ) => writtenRaw.push( s ),
                            destroy   : () => { destroyedNoEnd = true }
                        },
                        Buffer.alloc( 0 )
                    );
                    expect( writtenRaw[0]).toContain( '500 Internal Server Error' );
                    expect( destroyedNoEnd ).toBe( true );

                    // 4) adapter.upgrade + invalid WS frame triggering protocol_error -> close(code, reason)
                    const fakeWsSock = new net.Socket();
                    fakeWsSock.setTimeout = (() => fakeWsSock ) as any;
                    fakeWsSock.setNoDelay = (() => fakeWsSock ) as any;
                    fakeWsSock.write = (() => true ) as any;
                    fakeWsSock.end = (() => fakeWsSock ) as any;
                    const upgReq = new Request( 'http://localhost/ws-mid', {
                        headers : { 'sec-websocket-key' : 'dGhlIHNhbXBsZSBub25jZQ==' }
                    });
                    ( upgReq as any ).nodeSocket = fakeWsSock;
                    ( upgReq as any ).nodeHead = Buffer.alloc( 0 );
                    await adapter.upgrade( upgReq, wsEp, {});
                    // Emit frame with RSV1 set (0xc1 = FIN + RSV1 + text) -> protocol_error
                    fakeWsSock.emit( 'data', Buffer.from([ 0xc1, 0x80, 0, 0, 0, 0 ]));
                }
                finally
                {
                    await adapter.close();
                }
            });
        });

        it( 'should cover remaining compiler modules (decorator-config, di-resolution, diagnostics, discovery, emit-transformers, endpoint-analyzer, manifest, metadata-collector, plugin, sse-types, swagger)', () =>
        {
            // 1. decorator-config: classImplementsInterface (extends / non-matching implements) & isStandaloneGuardClass (use(@Header...) without implements Guard)
            const sfDec = ts.createSourceFile(
                'dec.ts',
                `
                class Base {}
                interface Other {}
                class NotGuard extends Base implements Other {
                    use(@Header('x') x: string) { return true; }
                }
                `,
                ts.ScriptTarget.Latest,
                true
            );
            const notGuardDecl = sfDec.statements.find(
                ( s ): s is ts.ClassDeclaration => ts.isClassDeclaration( s ) && s.name?.text === 'NotGuard'
            )!;
            expect( classImplementsInterface( notGuardDecl, 'Guard' )).toBe( false );
            expect( isStandaloneGuardClass( notGuardDecl )).toBe( true );

            // 2. di-resolution: resolveTokenFromType with SymbolFlags.Alias and TypeReferenceNode fallback
            const sfTypeRef = ts.createSourceFile( 'ref.ts', 'let x: MyCustomService;', ts.ScriptTarget.Latest, true );
            const varStmt = sfTypeRef.statements[0] as ts.VariableStatement;
            const typeNode = varStmt.declarationList.declarations[0].type!;
            const aliasSymbol = {
                flags   : ts.SymbolFlags.Alias,
                getName : () => 'default'
            } as unknown as ts.Symbol;
            const resolvedSymbol = {
                flags   : 0,
                getName : () => 'default'
            } as unknown as ts.Symbol;
            const fakeChecker = {
                getSymbolAtLocation : () => aliasSymbol,
                getAliasedSymbol    : () => resolvedSymbol
            } as unknown as ts.TypeChecker;
            const fakeType = {
                getSymbol   : () => undefined,
                aliasSymbol : undefined
            } as unknown as ts.Type;
            expect( resolveTokenFromType( typeNode, fakeType, fakeChecker )).toBe( 'MyCustomService' );

            // 3. diagnostics: reporter.diagnostics and reporter.warning
            const rep = new DiagnosticReporter();
            rep.warning( sfDec, DiagnosticCode.DECORATOR_MISUSE, 'test-warn' );
            expect( rep.diagnostics.length ).toBe( 1 );
            expect( rep.diagnostics[0].category ).toBe( ts.DiagnosticCategory.Warning );

            // 4. emit-transformers: loadTransformerFactory (function, { default: fn }, and invalid export)
            const emitDir = fs.mkdtempSync( path.join( os.tmpdir(), 'weberg-emit-tx-' ));
            try
            {
                fs.writeFileSync( path.join( emitDir, 'package.json' ), '{"name":"t"}' );
                fs.writeFileSync( path.join( emitDir, 'fn-plugin.cjs' ), 'module.exports = () => () => (sf) => sf;' );
                fs.writeFileSync( path.join( emitDir, 'default-plugin.cjs' ), 'module.exports = { default: () => () => (sf) => sf };' );
                fs.writeFileSync( path.join( emitDir, 'bad-plugin.cjs' ), 'module.exports = { notAFactory: true };' );

                const dummyProgram = ts.createProgram([], {});
                const factories = createBeforeTransformers(
                    dummyProgram,
                    undefined,
                    [{ transform : './fn-plugin.cjs' }, { transform : './default-plugin.cjs' }],
                    emitDir
                );
                expect( factories.length ).toBe( 4 );
                expect(() =>
                    createBeforeTransformers( dummyProgram, undefined, [{ transform : './bad-plugin.cjs' }], emitDir )
                ).toThrow( /did not export a transformer factory/ );
            }
            finally
            {
                fs.rmSync( emitDir, { recursive : true, force : true });
            }

            // 5. manifest: generateManifest __raw_code__ catch fallback, objectToExpression non-expression __raw_code__, and unsupported type throw
            const manReg = createRegistry();
            manReg.endpoints.push({
                controller   : 'C',
                methodName   : 'm',
                httpMethod   : 'GET',
                path         : '/m',
                params       : [],
                guards       : [],
                interceptors : [],
                reviver      : { __raw_code__ : 'a"b' },
                meta         : {}
            });
            const manCode = generateManifestCode( manReg, new Map(), '/tmp/entry.ts' );
            expect( manCode ).toContain( 'a\\' );

            expect(() => objectToExpression( Symbol( 'bad' ))).toThrow( /Unsupported object type/ );

            // 6. sse-types: unwrapSsePayloadType fallback when checker.getTypeArguments throws
            const innerPayloadType = { flags : ts.TypeFlags.String } as unknown as ts.Type;
            const fakeGenType = {
                symbol        : { getName : () => 'AsyncGenerator' },
                typeArguments : [ innerPayloadType ]
            } as unknown as ts.Type;
            const throwingChecker = {
                getTypeArguments  : () => { throw new Error( 'no-args' ) },
                getPropertyOfType : () => undefined
            } as unknown as ts.TypeChecker;
            expect( unwrapSsePayloadType( fakeGenType, throwingChecker )).toBe( innerPayloadType );

            // 7. discovery, swagger, metadata-collector, plugin, and endpoint-analyzer via multi-file program
            const tmpDir = fs.mkdtempSync( path.join( os.tmpdir(), 'weberg-comp-full-' ));
            try
            {
                const fileA = path.join( tmpDir, 'a.ts' );
                const fileB = path.join( tmpDir, 'b.ts' );
                fs.writeFileSync( fileA, `
                    import * as __tcRuntime from '@webergency-utils/typechecker/runtime';
                    function Controller( _p?: string ){ return ( _t: any ) => {} }
                    function Get( _p?: string ){ return ( _t: any, _k?: any ) => {} }
                    function Post( _p?: string ){ return ( _t: any, _k?: any ) => {} }
                    function Seo( _t: any, _k?: any ){}
                    function Internal( _t: any, _k?: any ){}
                    function File( _a?: any, _b?: any ){ return ( _t: any, _k?: any, _i?: any ) => {} }
                    function BodyHash( _a?: any, _b?: any ){ return ( _t: any, _k?: any, _i?: any ) => {} }
                    function Injectable( _o?: any ){ return ( _t: any ) => {} }
                    function Module( _o?: any ){ return ( _t: any ) => {} }
                    function Global( _t: any ){}

                    @Injectable({ scope: 1 })
                    export class ScopedNumericSvc {}

                    @Injectable({ other: true })
                    export class UnscopedSvc {}

                    @Injectable()
                    export class DupProv {}

                    @Injectable()
                    export class GlobalSvc {}

                    @Global
                    @Module({
                        providers: [
                            GlobalSvc,
                            { token: 'OBJ_TOKEN', class: ScopedNumericSvc },
                            123 as any
                        ],
                        exports: [ GlobalSvc, 'OBJ_TOKEN' ]
                    })
                    export class GlobalMod {}

                    @Module({
                        providers: [ UnscopedSvc ],
                        exports: [ UnscopedSvc ]
                    })
                    export class LeafMod {}

                    @Module({
                        imports: [ LeafMod ],
                        exports: [ LeafMod ],
                        files: { maxFileSize: 1024 }
                    })
                    export class MidMod {}

                    @Module({
                        imports: [ ( () => MidMod )() ]
                    })
                    export class DynMod {}

                    @File({ maxFileSize: 2048 })
                    @Controller( '/c' )
                    export class EdgeCompCtrl {
                        constructor(
                            private g: GlobalSvc,
                            private u: UnscopedSvc
                        ) {}

                        @Get( '/params' )
                        @File({ maxFiles: 2 })
                        withParams(
                            @BodyHash( 'sha256', { encoding: 'hex' } ) h1: string,
                            @File( 'avatar' ) f1: any
                        ): Promise<{ a: number } | { b: string } | Response | void> {
                            if( !h1 ) { return Promise.resolve(); }
                            if( h1 === 'r' ) { return Promise.resolve( new Response() ); }
                            if( h1 === 'sym' ) { const bad: Promise<bigint> = 123n as any; return bad; }
                            const sub: { a: number } | { b: string } = h1 === 'a' ? { a: 1 } : { b: 'x' };
                            return Promise.resolve( sub );
                        }

                        @Get( '/seo-struct' )
                        @Seo
                        seoStruct(): { method: string; path: string } {
                            return { method: 'GET', path: '/target' };
                        }
                    }

                    @Module({
                        imports: [ MidMod ],
                        controllers: [ EdgeCompCtrl ],
                        exports: [ UnscopedSvc ]
                    })
                    export class ConsumerMod {}

                    @Module({})
                    export class AppMod {}
                ` );

                fs.writeFileSync( fileB, `
                    function Injectable( _o?: any ){ return ( _t: any ) => {} }
                    function Module( _o?: any ){ return ( _t: any ) => {} }
                    function Controller( _p?: string ){ return ( _t: any ) => {} }
                    function Get( _p?: string ){ return ( _t: any, _k?: any ) => {} }
                    function Seo( _t: any, _k?: any ){}
                    function Internal( _t: any, _k?: any ){}
                    function BodyHash( _a?: any, _b?: any ){ return ( _t: any, _k?: any, _i?: any ) => {} }

                    @Injectable()
                    export class DupProv {}

                    @Module({
                        exports: [ 'NON_EXISTENT_EXPORT' ]
                    })
                    export class AppMod {}

                    @Controller( '/bad' )
                    export class BadCtrl {
                        @Get( '/both' )
                        @Seo
                        @Internal
                        both(
                            @BodyHash() emptyHash: string,
                            @BodyHash bareHash: string
                        ) {}
                    }
                ` );

                const prog = ts.createProgram([ fileA, fileB ], {
                    target                 : ts.ScriptTarget.ES2022,
                    module                 : ts.ModuleKind.NodeNext,
                    moduleResolution       : ts.ModuleResolutionKind.NodeNext,
                    skipLibCheck           : true,
                    experimentalDecorators : true
                });

                // Discovery with duplicate provider & module names
                const discReg = createRegistry();
                const discRep = new DiagnosticReporter(() => {});
                vi.spyOn( console, 'log' ).mockImplementation(() => {});
                discoverFromEntryPoint( prog, fileA, discReg, discRep );
                expect( discRep.errors.some( d => d.code === DiagnosticCode.DUPLICATE_CLASS )).toBe( true );

                // Plugin transform: transform fileA twice (covers previous endpoints cleanup) and fileB with sink
                const collectedDiags: ts.Diagnostic[] = [];
                const plug = compilerPlugin( prog, undefined, { addDiagnostic : d => collectedDiags.push( d ) });
                const sfA = prog.getSourceFile( fileA )!;
                const sfB = prog.getSourceFile( fileB )!;
                ts.transform( sfA, [ plug ]);
                ts.transform( sfA, [ plug ]);
                ts.transform( sfB, [ plug ]);
                expect( collectedDiags.some( d => String( d.messageText ).includes( 'cannot export "NON_EXISTENT_EXPORT"' ))).toBe( true );
                expect( collectedDiags.some( d => String( d.messageText ).includes( 'cannot be both @Seo and @Internal' ))).toBe( true );
                expect( collectedDiags.some( d => String( d.messageText ).includes( '"@BodyHash" requires an algorithm' ))).toBe( true );
                expect( collectedDiags.some( d => String( d.messageText ).includes( '"@BodyHash" must be called with arguments' ))).toBe( true );

                // Swagger warning when returnType schema generation throws (e.g. function return property / unsupported type)
                const warnSpy = vi.spyOn( console, 'warn' ).mockImplementation(() => {});
                const swagFile = path.join( tmpDir, 'swag.ts' );
                fs.writeFileSync( swagFile, `
                    export class SwagCtrl {
                        fnRet(): { a: string } { return { a: 'x' }; }
                    }
                ` );
                const swagProg = ts.createProgram([ swagFile ], {
                    target       : ts.ScriptTarget.ES2022,
                    module       : ts.ModuleKind.ESNext,
                    skipLibCheck : true
                });
                const origChecker = swagProg.getTypeChecker();
                vi.spyOn( origChecker, 'typeToString' ).mockReturnValue( '{ a: string }' );
                vi.spyOn( origChecker, 'getReturnTypeOfSignature' ).mockReturnValue({
                    flags         : ts.TypeFlags.Object,
                    isUnion       : () => false,
                    getProperties : () => { throw new Error( 'schema-boom' ) }
                } as any );
                vi.spyOn( swagProg, 'getTypeChecker' ).mockReturnValue( origChecker );
                const swagReg = createRegistry();
                swagReg.controllers.set( 'SwagCtrl', { path : swagFile, injections : new Map() });
                swagReg.endpoints.push({
                    controller   : 'SwagCtrl',
                    methodName   : 'fnRet',
                    httpMethod   : 'GET',
                    path         : '/fn',
                    params       : [],
                    guards       : [],
                    interceptors : [],
                    meta         : {}
                });
                SwaggerSpecGenerator.generate( swagReg, swagProg, tmpDir );
                expect( warnSpy ).toHaveBeenCalledWith( expect.stringContaining( 'Could not derive a response schema' ));
            }
            finally
            {
                fs.rmSync( tmpDir, { recursive : true, force : true });
            }
        });

        it( 'covers remaining callback functions across decorators, silent logger, ws socket events, stream cancel, and tcp listen error', async () =>
        {
            // 1. Decorators: OverrideProtect()(), OverrideIntercept()(), and Protect(G)(target, prop, desc)
            class DummyGuard {}
            class DummyInt {}
            OverrideProtect( DummyGuard as any )();
            OverrideIntercept( DummyInt as any )();
            Protect( DummyGuard as any )( class T {}, 'm', {} as any );

            // 2. SILENT_LOGGER info/error/debug + SEO fallthrough with security timeout (triggers work.catch)
            const silentServer = new Server({ logging : false });
            ( silentServer as any ).logger.info( 'i' );
            ( silentServer as any ).logger.error( 'e' );
            ( silentServer as any ).logger.debug( 'd' );
            seedInstanceController( silentServer.registry, 'SeoTimeoutCtrl', {
                fallthrough()
                {
                    return undefined;
                }
            }, [{
                methodName : 'fallthrough',
                httpMethod : 'GET',
                path       : '/seo-to',
                seo        : true,
                security   : { timeout : 1000 },
                params     : []
            }]);
            const seoToRes = await silentServer.fetch( new Request( 'http://localhost/seo-to' ));
            expect( seoToRes.status ).toBe( 404 );

            // 3. NodeAdapter WS connection socket 'end' and 'close' events
            const adapter = new NodeAdapter();
            seedInstanceController( silentServer.registry, 'WsHoldCtrl', {
                ws()
                {
                    return new Promise(() => {});
                }
            }, [{
                methodName : 'ws',
                httpMethod : 'WS',
                path       : '/ws-hold',
                params     : []
            }]);
            const wsHoldEp = silentServer.registry.getEndpoints().find( e => e.path === '/ws-hold' )!;
            await runWithRegistry( silentServer.registry, async () =>
            {
                for( const evt of [ 'end', 'close' ] as const )
                {
                    const sock = new EventEmitter() as any;
                    sock.write = vi.fn();
                    sock.end = vi.fn();
                    sock.destroy = vi.fn();
                    sock.setTimeout = vi.fn();
                    sock.setNoDelay = vi.fn();
                    sock.writable = true;
                    sock.destroyed = false;

                    const req = new Request( 'http://localhost/ws-hold', {
                        headers : { 'sec-websocket-key' : 'dGhlIHNhbXBsZSBub25jZQ==' }
                    });
                    ( req as any ).nodeSocket = sock;
                    ( req as any ).nodeHead = Buffer.alloc( 0 );
                    const p = adapter.upgrade( req, wsHoldEp, {});
                    sock.emit( evt );
                    await p;
                }
            });

            // 4. parseMultipartStream abort listener when reader.cancel() rejects
            const abortCtrl = new AbortController();
            const fakeMultipartBody = {
                getReader()
                {
                    return {
                        read()
                        {
                            abortCtrl.abort();

                            return Promise.reject( new Error( 'aborted' ));
                        },
                        cancel()
                        {
                            return Promise.reject( new Error( 'cancel-err' ));
                        },
                        releaseLock() {}
                    };
                }
            } as unknown as ReadableStream<Uint8Array>;
            await expect(
                parseMultipartStream( fakeMultipartBody, 'multipart/form-data; boundary=abc', { signal : abortCtrl.signal })
            ).rejects.toThrow();

            // 5. readRawBody when reader.cancel() rejects on size exceeded
            const fakeOversizedReq = {
                headers : new Headers(),
                body    : {
                    getReader()
                    {
                        return {
                            read()
                            {
                                return Promise.resolve({ done : false, value : new Uint8Array( 20 ) });
                            },
                            cancel()
                            {
                                return Promise.reject( new Error( 'cancel-err' ));
                            },
                            releaseLock() {}
                        };
                    }
                },
                arrayBuffer : async () => new ArrayBuffer( 0 )
            };
            await expect( readRawBody( fakeOversizedReq, { maxBodySize : 5 })).rejects.toThrow();

            // 6. TcpAdapter.listen error handler when port is already bound
            const blocker = net.createServer();
            await new Promise<void>( r => blocker.listen( 0, '127.0.0.1', () => r()));
            const usedPort = ( blocker.address() as net.AddressInfo ).port;
            try
            {
                const tcpAdapter = new TcpMessageAdapter({ host : '127.0.0.1', port : usedPort });
                await expect( tcpAdapter.listen( async () => null )).rejects.toThrow();
            }
            finally
            {
                await new Promise<void>( r => blocker.close(() => r()));
            }
        });
    });
});
