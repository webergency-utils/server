import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Server, ConsoleLogger } from '../src/server.js';
import { Scope, Meta, SetMetadata } from '../src/decorators.js';
import { Reflector } from '../src/core/reflector.js';
import { seedInstanceController, runWithRegistry, ApplicationRegistry, defineController, setModuleMeta } from './helpers/testing.js';
import { expectString } from '@webergency-utils/typechecker/runtime';

function setupServer( port: number, setup: ( registry: ApplicationRegistry ) => void, options: Record<string, any> = {}): Server
{
    const server = new Server({ port, ...options });
    runWithRegistry( server.registry, () => setup( server.registry ));

    return server;
}

/** Minimal endpoint metadata for controller 'C'; spread it to override any field. */
function endpoint( methodName: string, httpMethod: string, path: string ): any
{
    return {
        controller   : 'C',
        methodName,
        httpMethod,
        path,
        params       : [],
        guards       : [],
        interceptors : [],
        meta         : {}
    };
}

function preflightRequest( url: string, requestMethod = 'GET' ): Request
{
    return new Request( url, {
        method  : 'OPTIONS',
        headers : { Origin : 'https://a.com', 'Access-Control-Request-Method' : requestMethod }
    });
}

let legacyModuleCount = 0;

/**
 * Modules are identified by class name, so each generated module needs its own — two
 * same-named module classes are a registration conflict the registry rejects.
 */
function legacyModule( meta: Record<string, any> )
{
    class LegacyModule {}
    Object.defineProperty( LegacyModule, 'name', { value : `LegacyModule${++legacyModuleCount}` });
    setModuleMeta( LegacyModule, meta );

    return LegacyModule;
}

import { validators } from '@webergency-utils/typechecker';
import { Context } from '../src/core/context.js';
import { createServer } from 'http';

/** Mocked http/https + fake Bun/Deno globals only make sense on Node. */
const isNodeRuntime =
    typeof ( globalThis as { Bun? : unknown }).Bun === 'undefined'
    && typeof ( globalThis as { Deno? : unknown }).Deno === 'undefined';

vi.mock( 'http', () => ({
    createServer : vi.fn()
}));

vi.mock( 'https', () => ({
    createServer : vi.fn()
}));

describe( 'Server & Metadata', () => 
{

    describe( 'ApplicationRegistry', () =>
    {
        it( 'should register and retrieve controllers, guards, and interceptors', async () =>
        {
            const registry = new ApplicationRegistry();
            const ctrl = { hello : () => 'world' };
            const guard = { use : () => true };
            const interceptor = { intercept : () => {} };
            registry.registerController( 'TestCtrl', ctrl );
            registry.registerGuard( 'TestGuard', guard );
            registry.registerInterceptor( 'TestInt', interceptor );
            expect( await registry.getController( 'TestCtrl' )).toBe( ctrl );
            expect( await registry.getGuard( 'TestGuard' )).toBe( guard );
            expect( await registry.getInterceptor( 'TestInt' )).toBe( interceptor );
        });
        it( 'should register endpoints', () =>
        {
            const registry = new ApplicationRegistry();
            const ep: any = { controller : 'C', methodName : 'm', path : '/test', httpMethod : 'GET', params : [], guards : [], interceptors : [], meta : {} };
            registry.registerEndpoint( ep );
            expect( registry.getEndpoints()).toContain( ep );
        });
    });

    describe( 'RequestContext', () => 
    {
        it( 'should manage async context', async () => 
        {
            const req = { url : 'http://test.com' } as any;
            const meta = { path : '/' } as any;
            const ctx = { request : req, metadata : meta };
            
            await Context.run( ctx, async () => 
            {
                expect( Context.get()).toBe( ctx );
                expect( Context.request ).toBe( req );
                expect( Context.metadata ).toBe( meta );
            });
            expect( Context.get()).toBeUndefined();
        });

        it( 'should expose requestId from the request when the context omits it', async () =>
        {
            const req = { url : 'http://test.com', requestId : 'from-req' } as any;
            const meta = { path : '/' } as any;

            await Context.run({ request : req, metadata : meta }, async () =>
            {
                expect( Context.requestId ).toBe( 'from-req' );
                expect( Context.get()?.requestId ).toBe( 'from-req' );
            });
        });
    });

    describe( 'Observability', () =>
    {
        it( 'should echo an inbound X-Request-Id on the response and in logs', async () =>
        {
            // Arrange
            const logs: any[] = [];
            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerController( 'C', { home : () => 'ok' });
                registry.registerEndpoint( endpoint( 'home', 'GET', '/' ));
            }, {
                logs   : true,
                logger : {
                    info  : ( _m: any, ctx: any ) => logs.push( ctx ),
                    warn  : () => {},
                    error : () => {}
                }
            });

            // Act
            const res = await server.fetch( new Request( 'http://localhost/', {
                headers : { 'x-request-id' : 'trace-abc' }
            }));

            // Assert
            expect( res.headers.get( 'x-request-id' )).toBe( 'trace-abc' );
            expect( logs.find( l => l?.type === 'request_start' )?.requestId ).toBe( 'trace-abc' );
            expect( logs.find( l => l?.type === 'request_end' )?.requestId ).toBe( 'trace-abc' );
        });

        it( 'should generate an X-Request-Id when none is provided', async () =>
        {
            // Arrange
            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerController( 'C', { home : () => 'ok' });
                registry.registerEndpoint( endpoint( 'home', 'GET', '/' ));
            });

            // Act
            const res = await server.fetch( new Request( 'http://localhost/' ));

            // Assert
            expect( res.headers.get( 'x-request-id' )).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
            );
        });

        it( 'should answer liveness and readiness probes before routing', async () =>
        {
            // Arrange
            let routed = 0;
            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerController( 'C', { health : () => 
                {
                    routed++;

                    return 'nope'; 
                } });
                registry.registerEndpoint( endpoint( 'health', 'GET', '/health' ));
            }, { health : true });

            // Act
            const live = await server.fetch( new Request( 'http://localhost/health' ));
            const ready = await server.fetch( new Request( 'http://localhost/ready' ));

            // Assert — probes win over the colliding controller route
            expect( live.status ).toBe( 200 );
            expect( await live.json()).toEqual({ status : 'ok' });
            expect( ready.status ).toBe( 200 );
            expect( await ready.json()).toEqual({ status : 'ready' });
            expect( routed ).toBe( 0 );
            expect( live.headers.get( 'x-request-id' )).toBeTruthy();
        });

        it( 'should return 503 on readiness while shutting down', async () =>
        {
            // Arrange
            const server = setupServer( 3000, () => {}, { health : true, shutdownTimeout : 10 });
            await server.fetch( new Request( 'http://localhost/ready' )); // bootstrap
            server.isShuttingDown = true;

            // Act
            const ready = await server.fetch( new Request( 'http://localhost/ready' ));

            // Assert
            expect( ready.status ).toBe( 503 );
            expect( await ready.json()).toEqual({ status : 'not_ready' });
        });

        it( 'should honor custom health paths', async () =>
        {
            // Arrange
            const server = setupServer( 3000, () => {}, {
                health : { path : '/livez', readyPath : '/readyz' }
            });

            // Act / Assert
            expect(( await server.fetch( new Request( 'http://localhost/livez' ))).status ).toBe( 200 );
            expect(( await server.fetch( new Request( 'http://localhost/readyz' ))).status ).toBe( 200 );
            expect(( await server.fetch( new Request( 'http://localhost/health' ))).status ).toBe( 404 );
        });
    });

    describe( 'Runtime Routing', () => 
    {
        it( 'should handle static and parametric routes', async () => 
        {
            const ctrl = { 
                home : () => 'home',
                user : ( id: string ) => id 
            };
            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerController( 'Ctrl', ctrl );
                registry.registerEndpoint({
                    controller : 'Ctrl', methodName : 'home', httpMethod : 'GET', path : '/', params : [], guards : [], interceptors : [], meta : {}
                });
                registry.registerEndpoint({
                    controller   : 'Ctrl', methodName   : 'user', httpMethod   : 'GET', path         : '/users/:id', 
                    params       : [{ source : 'Param', name : 'id' }], guards       : [], interceptors : [], meta         : {}
                });
            });
            
            const res1 = await server.fetch( new Request( 'http://localhost/' ));
            expect( await res1.text()).toBe( 'home' );

            const res2 = await server.fetch( new Request( 'http://localhost/users/456' ));
            expect( await res2.text()).toBe( '456' );
        });

        it( 'should answer OPTIONS with 204 without running rematched verb handlers', async () =>
        {
            let posts = 0;
            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerController( 'C', { post : () => 
                {
                    posts++;

                    return 'ok'; 
                } });
                registry.registerEndpoint({
                    controller : 'C', methodName : 'post', httpMethod : 'POST', path : '/data', params : [], guards : [], interceptors : [], meta : {}
                });
            });

            const res = await server.fetch( new Request( 'http://localhost/data', { method : 'OPTIONS' }));
            expect( res.status ).toBe( 204 );
            expect( posts ).toBe( 0 );
        });

        it( 'should find route CORS config on OPTIONS for PATCH-only and HEAD-only routes', async () =>
        {
            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerController( 'C', { patch : () => 'p', head : () => 'h' });
                registry.registerEndpoint( endpoint( 'patch', 'PATCH', '/only-patch' ));
                registry.registerEndpoint( endpoint( 'head', 'HEAD', '/only-head' ));
            });

            const patchRes = await server.fetch( new Request( 'http://localhost/only-patch', { method : 'OPTIONS' }));
            const headRes = await server.fetch( new Request( 'http://localhost/only-head', { method : 'OPTIONS' }));

            expect( patchRes.status ).toBe( 204 );
            expect( headRes.status ).toBe( 204 );
        });

        it( 'should dispatch non-preflight OPTIONS to an @Options handler even when CORS is configured', async () =>
        {
            let handled = 0;
            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerController( 'C', { opts : () => ( handled++, 'from-handler' ) });
                registry.registerEndpoint( endpoint( 'opts', 'OPTIONS', '/thing' ));
            }, { cors : { origin : '*' } });

            const res = await server.fetch( new Request( 'http://localhost/thing', { method : 'OPTIONS' }));

            expect( handled ).toBe( 1 );
            expect( await res.text()).toBe( 'from-handler' );
            expect( res.headers.get( 'Access-Control-Allow-Origin' )).toBe( '*' );
        });

        it( 'should never dispatch a genuine CORS preflight to an @Options handler', async () =>
        {
            let handled = 0;
            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerController( 'C', { opts : () => ( handled++, 'from-handler' ) });
                registry.registerEndpoint( endpoint( 'opts', 'OPTIONS', '/thing' ));
            }, { cors : { origin : '*' } });

            const res = await server.fetch( preflightRequest( 'http://localhost/thing' ));

            expect( handled ).toBe( 0 );
            expect( res.status ).toBe( 204 );
        });

        it( 'should not run guards for a genuine preflight on a protected OPTIONS route', async () =>
        {
            let guarded = 0;
            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerGuard( 'DenyGuard', { use : () => { guarded++; throw Object.assign( new Error( 'nope' ), { status : 401 }) } });
                registry.registerController( 'C', { opts : () => 'from-handler' });
                registry.registerEndpoint({
                    ...endpoint( 'opts', 'OPTIONS', '/guarded' ),
                    guards : [{ name : 'DenyGuard', type : 'class', resolvers : [], params : [] }]
                });
            }, { cors : { origin : '*' } });

            const preflight = await server.fetch( preflightRequest( 'http://localhost/guarded' ));

            expect( guarded ).toBe( 0 );
            expect( preflight.status ).toBe( 204 );

            // A plain OPTIONS request is dispatched, so the guard does run and rejects.
            const plain = await server.fetch( new Request( 'http://localhost/guarded', { method : 'OPTIONS' }));

            expect( guarded ).toBe( 1 );
            expect( plain.status ).toBe( 401 );
        });

        it( 'should advertise Allow on the framework OPTIONS response', async () =>
        {
            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerController( 'C', { get : () => 'g', patch : () => 'p' });
                registry.registerEndpoint( endpoint( 'get', 'GET', '/res' ));
                registry.registerEndpoint( endpoint( 'patch', 'PATCH', '/res' ));
            });

            const res = await server.fetch( new Request( 'http://localhost/res', { method : 'OPTIONS' }));
            const allow = ( res.headers.get( 'Allow' ) || '' ).split( ', ' );

            expect( res.status ).toBe( 204 );
            expect( allow ).toEqual( expect.arrayContaining([ 'GET', 'HEAD', 'PATCH', 'OPTIONS' ]));
        });

        it( 'should auto-add Allow when an @Options handler did not set one', async () =>
        {
            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerController( 'C', { opts : () => 'ok', get : () => 'g' });
                registry.registerEndpoint( endpoint( 'opts', 'OPTIONS', '/mixed' ));
                registry.registerEndpoint( endpoint( 'get', 'GET', '/mixed' ));
            });

            const res = await server.fetch( new Request( 'http://localhost/mixed', { method : 'OPTIONS' }));

            expect( await res.text()).toBe( 'ok' );
            expect(( res.headers.get( 'Allow' ) || '' ).split( ', ' )).toEqual( expect.arrayContaining([ 'GET', 'OPTIONS' ]));
        });

        it( 'should return 405 with Allow when the path exists under another verb', async () =>
        {
            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerController( 'C', { create : () => 'ok' });
                registry.registerEndpoint( endpoint( 'create', 'POST', '/orders' ));
            });

            const res = await server.fetch( new Request( 'http://localhost/orders' ));

            expect( res.status ).toBe( 405 );
            expect(( res.headers.get( 'Allow' ) || '' ).split( ', ' )).toEqual( expect.arrayContaining([ 'POST', 'OPTIONS' ]));
        });

        it( 'should keep 404 for a path no route matches', async () =>
        {
            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerController( 'C', { create : () => 'ok' });
                registry.registerEndpoint( endpoint( 'create', 'POST', '/orders' ));
            });

            const res = await server.fetch( new Request( 'http://localhost/nothing' ));

            expect( res.status ).toBe( 404 );
            expect( res.headers.get( 'Allow' )).toBeNull();
        });

        it( 'should prefer a static route over a parametric one', async () =>
        {
            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerController( 'C', { byId : ( id: string ) => id, me : () => 'me' });
                registry.registerEndpoint({
                    ...endpoint( 'byId', 'GET', '/users/:id' ),
                    params : [{ source : 'Param', name : 'id' }]
                });
                registry.registerEndpoint( endpoint( 'me', 'GET', '/users/me' ));
            });

            const me = await server.fetch( new Request( 'http://localhost/users/me' ));
            const other = await server.fetch( new Request( 'http://localhost/users/7' ));

            expect( await me.text()).toBe( 'me' );
            expect( await other.text()).toBe( '7' );
        });

        it( 'should answer a preflight with the target route CORS config, not the global one', async () =>
        {
            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerController( 'C', { create : () => 'ok' });
                registry.registerEndpoint({
                    ...endpoint( 'create', 'POST', '/route-cors' ),
                    cors : { origin : 'https://a.com', maxAge : 99 }
                });
            }, { cors : { origin : 'https://global.com' } });

            const res = await server.fetch( preflightRequest( 'http://localhost/route-cors', 'POST' ));

            expect( res.status ).toBe( 204 );
            expect( res.headers.get( 'Access-Control-Allow-Origin' )).toBe( 'https://a.com' );
            expect( res.headers.get( 'Access-Control-Max-Age' )).toBe( '99' );
        });

        it( 'should return 400 for malformed percent-encoding in a path param', async () =>
        {
            let handled = 0;
            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerController( 'C', { user : ( id: string ) => ( handled++, id ) });
                registry.registerEndpoint({
                    ...endpoint( 'user', 'GET', '/users/:id' ),
                    params : [{ source : 'Param', name : 'id' }]
                });
            });

            const res = await server.fetch( new Request( 'http://localhost/users/%ZZ' ));

            expect( res.status ).toBe( 400 );
            expect( handled ).toBe( 0 );
        });

        it( 'should correctly parse path parameters containing equal signs (e.g. /param/base64=/param2/test)', async () =>
        {
            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerController( 'C', {
                    testParams : ( b64: string, p2: string ) => ({ b64, p2 })
                });
                registry.registerEndpoint({
                    ...endpoint( 'testParams', 'GET', '/param/:base64/param2/:param2' ),
                    params : [
                        { source : 'Param', name : 'base64', validator : ( v: any, p: string ) => expectString( v, p ) },
                        { source : 'Param', name : 'param2', validator : ( v: any, p: string ) => expectString( v, p ) }
                    ]
                });
            });

            const res = await server.fetch( new Request( 'http://localhost/param/base64=/param2/test' ));
            const body = await res.json();

            expect( res.status ).toBe( 200 );
            expect( body ).toEqual({ b64 : 'base64=', p2 : 'test' });
        });

        it( 'should accept path/header/cookie scalars with =%& via from:string-style parsers', async () =>
        {
            // Mirrors typechecker from:'string' — coerce/validate only, never parseQueryString.
            const asString = ( v: any, path: string ) => expectString( v, path );
            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerController( 'C', {
                    echo : ( id: string, token: string, flag: string ) => ({ id, token, flag })
                });
                registry.registerEndpoint({
                    ...endpoint( 'echo', 'GET', '/echo/:id' ),
                    params : [
                        { source : 'Param', name : 'id', parser : asString },
                        { source : 'Header', name : 'x-token', parser : asString },
                        { source : 'Cookie', name : 'flag', parser : asString }
                    ]
                });
            });

            const res = await server.fetch( new Request( 'http://localhost/echo/jpUllytbmQ=', {
                headers : {
                    'x-token' : '100%',
                    cookie    : 'flag=a&b=c'
                }
            }));
            const body = await res.json();

            expect( res.status ).toBe( 200 );
            expect( body ).toEqual({ id : 'jpUllytbmQ=', token : '100%', flag : 'a&b=c' });
        });

        it( 'should correctly parse complex base64 attachmentId with trailing = in nexus mail webhook URL with typechecking validator', async () =>
        {
            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerController( 'C', {
                    getAttachment : ( id: string, attachmentId: string, emailAddress: string ) => ({ id, attachmentId, emailAddress })
                });
                registry.registerEndpoint({
                    ...endpoint( 'getAttachment', 'GET', '/webhooks/mail/:id/attachments/:attachmentId/emailAddress/:emailAddress' ),
                    params : [
                        { source : 'Param', name : 'id', validator : ( v: any, p: string ) => expectString( v, p ) },
                        { source : 'Param', name : 'attachmentId', validator : ( v: any, p: string ) => expectString( v, p ) },
                        { source : 'Param', name : 'emailAddress', validator : ( v: any, p: string ) => expectString( v, p ) }
                    ]
                });
            });

            const targetUrl = 'http://localhost/webhooks/mail/6a706ab6a21043e5a87b3832/attachments/AAMkAGYxZjRlMzA2LWI1NmEtNGU2Mi1iNzRmLTE1NmRlNDgwY2RjYwBGAAAAAACL_78JZwTXQ5GR_qVV6miEBwBLN00naEE7SqVBTiX0KJ7bAAAAAAEMAABLN00naEE7SqVBTiX0KJ7bAASBNx7AAAABEgAQANPhTTfLqw9EmPhhIbKrjDI=/emailAddress/john.doe@acme.com';
            const res = await server.fetch( new Request( targetUrl ));
            const body = await res.json();

            expect( res.status ).toBe( 200 );
            expect( body.id ).toBe( '6a706ab6a21043e5a87b3832' );
            expect( body.attachmentId ).toBe( 'AAMkAGYxZjRlMzA2LWI1NmEtNGU2Mi1iNzRmLTE1NmRlNDgwY2RjYwBGAAAAAACL_78JZwTXQ5GR_qVV6miEBwBLN00naEE7SqVBTiX0KJ7bAAAAAAEMAABLN00naEE7SqVBTiX0KJ7bAASBNx7AAAABEgAQANPhTTfLqw9EmPhhIbKrjDI=' );
            expect( body.emailAddress ).toBe( 'john.doe@acme.com' );
        });

        it( 'should handle extremely long path parameters (e.g. 5,000+ chars attachmentId) with typechecking validator', async () =>
        {
            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerController( 'C', {
                    getAttachment : ( id: string, attachmentId: string, emailAddress: string ) => ({ id, attachmentId, emailAddress })
                });
                registry.registerEndpoint({
                    ...endpoint( 'getAttachment', 'GET', '/webhooks/mail/:id/attachments/:attachmentId/emailAddress/:emailAddress' ),
                    params : [
                        { source : 'Param', name : 'id', validator : ( v: any, p: string ) => expectString( v, p ) },
                        { source : 'Param', name : 'attachmentId', validator : ( v: any, p: string ) => expectString( v, p ) },
                        { source : 'Param', name : 'emailAddress', validator : ( v: any, p: string ) => expectString( v, p ) }
                    ]
                });
            });

            const longAttachmentId = 'A'.repeat( 5000 ) + '=';
            const targetUrl = `http://localhost/webhooks/mail/6a706ab6a21043e5a87b3832/attachments/${longAttachmentId}/emailAddress/john.doe@acme.com`;
            const res = await server.fetch( new Request( targetUrl ));
            const body = await res.json();

            expect( res.status ).toBe( 200 );
            expect( body.attachmentId ).toBe( longAttachmentId );
        });
    });

    describe( 'Parameter Resolution', () => 
    {
        it( 'should resolve all sources', async () => 
        {
            const ctrl = {
                test : ( query: any, header: any, host: string, url: string, path: string, ip: string, res: any, ctx: any, headers: any ) => 
                    ({ query, header, host, url, path, ip, res, ctx, headers })
            };
            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerController( 'ParamCtrl', ctrl );
                registry.registerEndpoint({
                    controller : 'ParamCtrl',
                    methodName : 'test',
                    httpMethod : 'GET',
                    path       : '/params',
                    params     : [
                        { source : 'Query', name : 'q' },
                        { source : 'Header', name : 'x-f' },
                        { source : 'Hostname' },
                        { source : 'Url' },
                        { source : 'Path' },
                        { source : 'Ip' },
                        { source : 'Response' },
                        { source : 'Context' },
                        { source : 'Headers' }
                    ],
                    guards : [], interceptors : [], meta : {}
                });
            });
            const res = await server.fetch( new Request( 'http://example.com/params?q=1', {
                headers : { 'x-f' : 'v', 'x-forwarded-for' : '1.2.3.4', 'x-test' : 'val' }
            }));
            const data = await res.json();
            expect( data.query ).toBe( '1' );
            expect( data.header ).toBe( 'v' );
            expect( data.host ).toBe( 'example.com' );
            expect( data.url ).toBe( 'http://example.com/params?q=1' );
            expect( data.path ).toBe( '/params' );
            expect( data.ip ).toBe( '127.0.0.1' );
            expect( data.res ).toEqual({});
            expect( data.ctx ).toBeDefined();
            expect( data.headers['x-test']).toBe( 'val' );
        });

        it( 'should apply @Response headers and status onto the outbound response', async () =>
        {
            const ctrl = {
                get : ( res: { header : ( n: string, v: string ) => unknown, status : ( n: number ) => unknown }) =>
                {
                    res.header( 'x-from-handler', '1' );
                    res.status( 201 );

                    return { ok : true };
                }
            };
            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerController( 'ResCtrl', ctrl );
                registry.registerEndpoint({
                    controller   : 'ResCtrl',
                    methodName   : 'get',
                    httpMethod   : 'GET',
                    path         : '/res',
                    params       : [{ source : 'Response' }],
                    guards       : [],
                    interceptors : [],
                    meta         : {}
                });
            });
            const res = await server.fetch( new Request( 'http://localhost/res' ));
            expect( res.status ).toBe( 201 );
            expect( res.headers.get( 'x-from-handler' )).toBe( '1' );
            expect( res.headers.get( 'content-type' )).toContain( 'application/json' );
            expect( await res.json()).toEqual({ ok : true });
        });

        it( 'should validate each SSE chunk data and strip extras', async () =>
        {
            const ctrl = {
                stream : async function *()
                {
                    yield { event : 'tick', data : { val : 1, extra : 'x' } };
                }
            };
            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerController( 'SseValCtrl', ctrl );
                registry.registerEndpoint({
                    controller          : 'SseValCtrl',
                    methodName          : 'stream',
                    httpMethod          : 'GET',
                    path                : '/sse-val',
                    params              : [],
                    guards              : [],
                    interceptors        : [],
                    meta                : { sse : true },
                    returnTypeMode      : 'strip',
                    returnTypeValidator : ( v: any, _path: string, ctx: any ) =>
                    {
                        if( ctx.mode === 'strip' && v && typeof v === 'object' )
                        {
                            const out : Record<string, any> = {};

                            if( 'val' in v ){ out.val = v.val }

                            return out;
                        }

                        return v;
                    }
                });
            });
            const res = await server.fetch( new Request( 'http://localhost/sse-val' ));
            expect( res.status ).toBe( 200 );
            const text = await res.text();
            expect( text ).toContain( 'event: tick\ndata: {"val":1}\n\n' );
            expect( text ).not.toContain( 'extra' );
        });

        it( 'should honor X-Forwarded-For when trustProxy allows the peer', async () =>
        {
            const ctrl = {
                get : ( ip: string ) => ({ ip })
            };
            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerController( 'IpCtrl', ctrl );
                registry.registerEndpoint({
                    controller   : 'IpCtrl',
                    methodName   : 'get',
                    httpMethod   : 'GET',
                    path         : '/ip',
                    params       : [{ source : 'Ip' }],
                    guards       : [],
                    interceptors : [],
                    meta         : {}
                });
            }, {trustProxy : [ '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16' ]});

            const req = new Request( 'http://example.com/ip', {
                headers : { 'x-forwarded-for' : '203.0.113.50, 10.0.0.2' }
            });
            ( req as any ).remoteAddress = '10.0.0.5';

            const res = await server.fetch( req );
            const data = await res.json();
            expect( data.ip ).toBe( '203.0.113.50' );
        });

        it( 'should handle body and duplex streams', async () => 
        {
            const ctrl = { echo : ( body: any ) => body };
            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerController( 'EchoCtrl', ctrl );
                registry.registerEndpoint({
                    controller   : 'EchoCtrl', methodName   : 'echo', httpMethod   : 'POST', path         : '/echo',
                    params       : [{ source : 'Body' }], guards       : [], interceptors : [], meta         : {}
                });
            });
            
            const res = await server.fetch( new Request( 'http://localhost/echo', {
                method  : 'POST',
                body    : JSON.stringify({ a : 1 }),
                headers : { 'Content-Type' : 'application/json' }
            }));
            expect( await res.json()).toEqual({ a : 1 });
        });
    });

    describe( 'Guards & Interceptors', () => 
    {
        it( 'should execute guards with complex parameters', async () => 
        {
            const guard = { 
                use : vi.fn().mockImplementation(( req, body ) => 
                {
                    if( body.deny ) { throw { code : 403, message : 'Denied' } }
                })
            };
            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerGuard( 'ComplexGuard', guard );
                registry.registerController( 'C', { test : () => 'ok' });
                registry.registerEndpoint({
                    controller : 'C', methodName : 'test', httpMethod : 'POST', path       : '/complex-g', params     : [],
                    guards     : [{ 
                        name      : 'ComplexGuard', type      : 'class', resolvers : [], 
                        params    : [
                            { source : 'Request' },
                            { source : 'Body' }
                        ] 
                    }],
                    interceptors : [], meta : {}
                });
            });
            
            const req = new Request( 'http://localhost/complex-g', {
                method  : 'POST',
                headers : { 'Content-Type' : 'application/json' },
                body    : JSON.stringify({ deny : true })
            });
            const res = await server.fetch( req );
            expect( res.status ).toBe( 403 );
            expect( guard.use ).toHaveBeenCalled();
        });

        it( 'should execute guard chain and resolvers', async () => 
        {
            const guard = { use : vi.fn().mockImplementation(( val ) => 
            { 
                if( val === 'deny' ) { throw { code : 403, message : 'Denied' } }
            })};
            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerGuard( 'G', guard );
                registry.registerController( 'C', { ok : () => 'ok' });
                registry.registerEndpoint({
                    controller   : 'C', methodName   : 'ok', httpMethod   : 'GET', path         : '/g', params       : [],
                    guards       : [{ name : 'G', type : 'class', resolvers : ['deny'], params : [{ source : 'Unknown' as any }] }],
                    interceptors : [], meta         : {}
                });
            });
            const res = await server.fetch( new Request( 'http://localhost/g' ));
            expect( res.status ).toBe( 403 );
            const data = await res.json();
            expect( data.error ).toBe( 'Denied' );
        });

        it( 'should execute interceptor chain', async () => 
        {
            const i1 = { intercept : async ( req, next ) => 
            {
                const res = await next();
                res.headers.set( 'x-1', '1' );

                return res;
            }};
            const i2 = { intercept : async ( req, next ) => 
            {
                const res = await next();
                res.headers.set( 'x-2', '2' );

                return res;
            }};
            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerInterceptor( 'I1', i1 );
                registry.registerInterceptor( 'I2', i2 );
                registry.registerController( 'C', { ok : () => 'ok' });
                registry.registerEndpoint({
                    controller   : 'C', methodName   : 'ok', httpMethod   : 'GET', path         : '/i', params       : [],
                    guards       : [], interceptors : ['I1', 'I2'], meta         : {}
                });
            });
            const res = await server.fetch( new Request( 'http://localhost/i' ));
            expect( res.headers.get( 'x-1' )).toBe( '1' );
            expect( res.headers.get( 'x-2' )).toBe( '2' );
        });
    });

    describe( 'Server Lifecycle & Events', () => 
    {
        it( 'should emit request events', async () => 
        {
            const server = new Server({ port : 3000 });
            const onReq = vi.fn();
            server.on( 'request', onReq );
            
            await server.fetch( new Request( 'http://localhost/any' ));
            expect( onReq ).toHaveBeenCalled();
        });

        it( 'should handle body caching', async () => 
        {
            const server = new Server({ port : 3000 });
            const req: any = new Request( 'http://localhost/', {
                method  : 'POST',
                body    : JSON.stringify({ hello : 'world' }),
                headers : { 'Content-Type' : 'application/json' }
            });
            
            const body1 = await ( server as any ).getBody( req );
            const body2 = await ( server as any ).getBody( req );
            
            expect( body1 ).toEqual({ hello : 'world' });
            expect( body1 ).toBe( body2 ); // Should be the same reference (cached)
        });

        it( 'should return undefined for empty body instead of throwing JSON.parse error', async () => 
        {
            const server = new Server({ port : 3000 });
            const req: any = new Request( 'http://localhost/', { method : 'POST' });
            
            const body = await ( server as any ).getBody( req );

            expect( body ).toBeUndefined();
        });

        it( 'should cache undefined body on repeated calls', async () => 
        {
            const server = new Server({ port : 3000 });
            const req: any = new Request( 'http://localhost/', { method : 'POST' });
            
            const body1 = await ( server as any ).getBody( req );
            const body2 = await ( server as any ).getBody( req );

            expect( body1 ).toBeUndefined();
            expect( body2 ).toBeUndefined();
        });

        it( 'should parse application/x-www-form-urlencoded bodies', async () => 
        {
            const server = new Server({ port : 3000 });
            const req: any = new Request( 'http://localhost/', {
                method  : 'POST',
                body    : 'hello=world&count=2&count=3',
                headers : { 'Content-Type' : 'application/x-www-form-urlencoded' }
            });

            const body = await ( server as any ).getBody( req );

            expect( body ).toEqual({ hello : 'world', count : ['2', '3'] });
        });

        it( 'should coerce urlencoded Body with from:query and revive JSON Body Date with from:json', async () => 
        {
            const formCtrl = {
                form : ( body: any ) => body,
                json : ( body: any ) => ({
                    age  : body.age,
                    when : body.when instanceof Date ? body.when.toISOString() : body.when,
                    big  : typeof body.big === 'bigint' ? body.big.toString() : body.big
                })
            };
            const bodyValidator = ( v: any, path: string, ctx: any ) => 
            {
                if( !validators.object( v, path, ctx, ['age', 'active'])) { return v }
                validators.props( v, v, path, ctx, [
                    ['age', false, validators.number],
                    ['active', false, validators.boolean]
                ]);

                return v;
            };
            const jsonValidator = ( v: any, path: string, ctx: any ) => 
            {
                if( !validators.object( v, path, ctx, ['age', 'when', 'big'])) { return v }
                validators.props( v, v, path, ctx, [
                    ['age', false, validators.number],
                    ['when', false, validators.date],
                    ['big', false, validators.bigint]
                ]);

                return v;
            };

            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerController( 'FromBodyCtrl', formCtrl );
                registry.registerEndpoint({
                    controller   : 'FromBodyCtrl', methodName   : 'form', httpMethod   : 'POST', path         : '/from-form',
                    params       : [{ source : 'Body', validator : bodyValidator }],
                    guards       : [], interceptors : [], meta         : {}
                });
                registry.registerEndpoint({
                    controller   : 'FromBodyCtrl', methodName   : 'json', httpMethod   : 'POST', path         : '/from-json',
                    params       : [{ source : 'Body', validator : jsonValidator }],
                    guards       : [], interceptors : [], meta         : {}
                });
            });

            const formRes = await server.fetch( new Request( 'http://localhost/from-form', {
                method  : 'POST',
                body    : 'age=25&active=true',
                headers : { 'Content-Type' : 'application/x-www-form-urlencoded' }
            }));
            expect( formRes.status ).toBe( 200 );
            expect( await formRes.json()).toEqual({ age : 25, active : true });

            const jsonRes = await server.fetch( new Request( 'http://localhost/from-json', {
                method : 'POST',
                body   : JSON.stringify({
                    age  : 25,
                    when : '2024-01-01T00:00:00.000Z',
                    big  : '9007199254740991'
                }),
                headers : { 'Content-Type' : 'application/json' }
            }));
            expect( jsonRes.status ).toBe( 200 );
            expect( await jsonRes.json()).toEqual({
                age  : 25,
                when : '2024-01-01T00:00:00.000Z',
                big  : '9007199254740991'
            });

            const strictRes = await server.fetch( new Request( 'http://localhost/from-json', {
                method  : 'POST',
                body    : JSON.stringify({ age : '25', when : '2024-01-01T00:00:00.000Z', big : '1' }),
                headers : { 'Content-Type' : 'application/json' }
            }));
            expect( strictRes.status ).toBe( 400 );
        });

        it( 'should pass undefined to handler when body param has no validator and no body is sent', async () => 
        {
            const ctrl = { echo : vi.fn(( body: any ) => ({ received : body })) };
            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerController( 'EmptyBodyCtrl', ctrl );
                registry.registerEndpoint({
                    controller   : 'EmptyBodyCtrl', methodName   : 'echo', httpMethod   : 'POST', path         : '/empty-body',
                    params       : [{ source : 'Body' }], guards       : [], interceptors : [], meta         : {}
                });
            });
            
            const res = await server.fetch( new Request( 'http://localhost/empty-body', { method : 'POST' }));

            expect( res.status ).toBe( 200 );
            expect( ctrl.echo ).toHaveBeenCalledWith( undefined );
        });

        it( 'should pass validation when optional body (union with undefined) is not sent', async () => 
        {
            const optionalBodyValidator = ( v: any, path: string, ctx: any ) => 
            {
                return validators.union( v, path, ctx, [
                    ( v: any, p: string, c: any ) => 
                    {
                        if( !validators.object( v, p, c, ['name'])) { return v }
                        validators.props( v, v, p, c, [
                            ['name', false, validators.string]
                        ]);

                        return v;
                    },
                    validators.undefined
                ]);
            };

            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerController( 'OptBodyCtrl', {
                    test : ( body: any ) => ({ received : body })
                });
                registry.registerEndpoint({
                    controller   : 'OptBodyCtrl', methodName   : 'test', httpMethod   : 'POST', path         : '/opt-body',
                    params       : [{ source : 'Body', validator : optionalBodyValidator, mode : 'strict' }],
                    guards       : [], interceptors : [], meta         : {}
                });
            });

            const res = await server.fetch( new Request( 'http://localhost/opt-body', { method : 'POST' }));

            expect( res.status ).toBe( 200 );
            const data = await res.json();
            expect( data.received ).toBeUndefined(); // undefined values are omitted from JSON
        });

        it( 'should return 400 when required body validator fails on empty body', async () => 
        {
            const requiredBodyValidator = ( v: any, path: string, ctx: any ) => 
            {
                if( !validators.object( v, path, ctx, ['name'])) { return v }
                validators.props( v, v, path, ctx, [
                    ['name', false, validators.string]
                ]);

                return v;
            };

            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerController( 'ReqBodyCtrl', {
                    test : ( body: any ) => body
                });
                registry.registerEndpoint({
                    controller   : 'ReqBodyCtrl', methodName   : 'test', httpMethod   : 'POST', path         : '/req-body',
                    params       : [{ source : 'Body', validator : requiredBodyValidator, mode : 'strict' }],
                    guards       : [], interceptors : [], meta         : {}
                });
            });

            const res = await server.fetch( new Request( 'http://localhost/req-body', { method : 'POST' }));

            expect( res.status ).toBe( 400 );
            const data = await res.json();
            expect( data.success ).toBe( false );
        });

        it( 'should handle server errors gracefully', async () => 
        {
            const ctrl = { boom : () => { throw new Error( 'Boom' ) } };
            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerController( 'C', ctrl );
                registry.registerEndpoint({
                    controller   : 'C', methodName   : 'boom', httpMethod   : 'GET', path         : '/boom', params       : [],
                    guards       : [], interceptors : [], meta         : {}
                });
            });
            const res = await server.fetch( new Request( 'http://localhost/boom' ));
            expect( res.status ).toBe( 500 );
            const data = await res.json();
            expect( data.error ).toBe( 'Boom' );
        });

        it( 'should handle custom errors with data', async () => 
        {
            const ctrl = { fail : () => { throw { code : 418, data : { tea : 'pot' } } } };
            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerController( 'C', ctrl );
                registry.registerEndpoint({
                    controller   : 'C', methodName   : 'fail', httpMethod   : 'GET', path         : '/fail', params       : [],
                    guards       : [], interceptors : [], meta         : {}
                });
            });
            const res = await server.fetch( new Request( 'http://localhost/fail' ));
            expect( res.status ).toBe( 418 );
            expect( await res.json()).toEqual({ tea : 'pot' });
        });

        it( 'should handle router errors', async () => 
        {
            const server = new Server({ port : 3000 });
            vi.spyOn(( server as any ).router, 'lookup' ).mockImplementation(() => { throw new Error( 'Router Fail' ) });
            const res = await server.fetch( new Request( 'http://localhost/any' ));
            expect( res.status ).toBe( 500 );
            expect( await res.json()).toEqual({ success : false, error : 'Router Fail' });
        });

        it( 'should validate parameters and return 400 with multiple errors', async () => 
        {
            const ctrl = { test : ( a: number, b: number ) => ({ a, b }) };
            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerController( 'ValCtrl', ctrl );
                registry.registerEndpoint({
                    controller : 'ValCtrl', methodName : 'test', httpMethod : 'GET', path       : '/val-fail',
                    params     : [
                        { source : 'Query', name : 'a', validator : validators.number },
                        { source : 'Query', name : 'b', validator : validators.number }
                    ],
                    guards : [], interceptors : [], meta : {}
                });
            });
            const res = await server.fetch( new Request( 'http://localhost/val-fail?a=x&b=y' ));
            expect( res.status ).toBe( 400 );
            const data = await res.json();
            expect( data.errors.length ).toBe( 2 );
        });

        it( 'should respect shutdown state', async () => 
        {
            const server = new Server({ port : 3000 });
            ( server as any ).isShuttingDown = true;
            const res = await server.fetch( new Request( 'http://localhost/any' ));
            expect( res.status ).toBe( 503 );
        });

        it( 'should execute graceful shutdown sequence', async () => 
        {
            const server = new Server({ port : 3000 });
            const before = vi.fn();
            const after = vi.fn();
            server.on( 'beforeShutdown', before );
            server.on( 'shutdown', after );
            
            await server.shutdown();
            
            expect( server['isShuttingDown']).toBe( true );
            expect( before ).toHaveBeenCalled();
            expect( after ).toHaveBeenCalled();
            
            // Second call should return early
            before.mockClear();
            await server.shutdown();
            expect( before ).not.toHaveBeenCalled();
        });

        it( 'should handle shutdown timeout', async () => 
        {
            const server = new Server({ port : 3004, shutdownTimeout : 10, logs : true });
            ( server as any ).activeRequests = 1;
            
            const warnSpy = vi.spyOn( console, 'warn' ).mockImplementation(() => {});
            
            await server.shutdown();
            
            expect( warnSpy ).toHaveBeenCalledWith( expect.stringContaining( 'Shutdown timed out' ));
            warnSpy.mockRestore();
        });

        it.skipIf( !isNodeRuntime )( 'should close Node.js server on shutdown', async () => 
        {
            const server = new Server({ port : 3005 });
            const mockNodeServer = { close : vi.fn( cb => cb()) };
            ( server as any ).nodeServer = mockNodeServer;
            
            await server.shutdown();
            
            expect( mockNodeServer.close ).toHaveBeenCalled();
        });

        it.skipIf( !isNodeRuntime )( 'should detect different runtimes', () => 
        {
            const server = new Server({ port : 3000 });
            
            // Mock Bun
            ( globalThis as any ).Bun = {};
            expect(( server as any ).detectRuntime()).toBe( 'Bun' );
            delete ( globalThis as any ).Bun;

            // Mock Deno
            ( globalThis as any ).Deno = {};
            expect(( server as any ).detectRuntime()).toBe( 'Deno' );
            delete ( globalThis as any ).Deno;

            // Default to Node
            expect(( server as any ).detectRuntime()).toBe( 'Node' );
        });

        it.skipIf( !isNodeRuntime )( 'should start Node.js bridge server', async () => 
        {
            // Mock http.createServer
            const mockServer = {
                listen : vi.fn(( port, cb ) => cb()),
                close  : vi.fn( cb => cb())
            };
            const { createServer } = await import( 'http' );
            const mockCreateServer = vi.mocked( createServer ).mockReturnValue( mockServer as any );

            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerController( 'NodeCtrl', { test : () => ({ ok : true }) });
                registry.registerEndpoint({
                    controller   : 'NodeCtrl', methodName   : 'test', httpMethod   : 'POST', path         : '/test',
                    params       : [], guards       : [], interceptors : [], meta         : {}
                });
            });
            await server.start();

            expect( mockCreateServer ).toHaveBeenCalled();
            expect( mockServer.listen ).toHaveBeenCalledWith( 3000, expect.any( Function ));

            // Test the request handler inside createServer
            const handler = mockCreateServer.mock.calls[0][0];
            const mockReq = {
                method  : 'POST',
                url     : '/test',
                headers : { host : 'localhost' },
                socket  : {},
                pipe    : vi.fn()
            };
            const mockRes = {
                statusCode : 0,
                setHeader  : vi.fn(),
                end        : vi.fn(),
                on         : vi.fn(),
                once       : vi.fn(),
                emit       : vi.fn(),
                write      : vi.fn()
            };

            // Mock Metadata for the request to match
            await handler( mockReq as any, mockRes as any );

            expect( mockRes.statusCode ).toBe( 200 );
            expect( mockRes.setHeader ).toHaveBeenCalledWith( 'content-type', 'application/json' );
        });

        it.skipIf( !isNodeRuntime )( 'should start HTTPS server when tls is provided', async () => 
        {
            const mockServer = {
                listen : vi.fn(( port, cb ) => cb()),
                close  : vi.fn( cb => cb())
            };
            const { createServer } = await import( 'https' );
            const mockCreateServer = vi.mocked( createServer ).mockReturnValue( mockServer as any );

            const tlsOptions = { key : 'key-data', cert : 'cert-data' };
            const server = new Server({ port : 4430, tls : tlsOptions });
            await server.start();

            expect( mockCreateServer ).toHaveBeenCalledWith( tlsOptions, expect.any( Function ));
            expect( mockServer.listen ).toHaveBeenCalledWith( 4430, expect.any( Function ));
        });

        it.skipIf( !isNodeRuntime )( 'should start Bun server', async () => 
        {
            ( globalThis as any ).Bun = { serve : vi.fn() };
            try 
            {
                const server = new Server({ port : 3001 });
                await server.start();
                expect(( globalThis as any ).Bun.serve ).toHaveBeenCalledWith({ port : 3001, fetch : expect.any( Function ) });
            }
            finally 
            {
                delete ( globalThis as any ).Bun;
            }
        });

        it.skipIf( !isNodeRuntime )( 'should start Deno server', async () => 
        {
            ( globalThis as any ).Deno = { serve : vi.fn() };
            try 
            {
                const server = new Server({ port : 3002 });
                await server.start();
                expect(( globalThis as any ).Deno.serve ).toHaveBeenCalledWith( expect.objectContaining({ port : 3002 }), expect.any( Function ));
            }
            finally 
            {
                delete ( globalThis as any ).Deno;
            }
        });

        it.skipIf( !isNodeRuntime )( 'should handle Node.js bridge with empty body', async () => 
        {
            const mockServer = { listen : vi.fn(( p, cb ) => cb()), close : vi.fn() };
            const { createServer } = await import( 'http' );
            vi.mocked( createServer ).mockReturnValue( mockServer as any );

            const server = setupServer( 3003, ( registry ) =>
            {
                registry.registerController( 'EmptyCtrl', { test : () => new Response( null ) });
                registry.registerEndpoint({
                    controller   : 'EmptyCtrl', methodName   : 'test', httpMethod   : 'GET', path         : '/empty-test',
                    params       : [], guards       : [], interceptors : [], meta         : {}
                });
            });
            await server.start();
            const handler = vi.mocked( createServer ).mock.calls[vi.mocked( createServer ).mock.calls.length - 1][0];

            const mockReq = { method : 'GET', url : '/empty-test', headers : { host : 'l' }, socket : { getPeerCertificate : () => null } };
            const mockRes = { statusCode : 0, setHeader : vi.fn(), end : vi.fn(), on : vi.fn(), once : vi.fn(), emit : vi.fn(), write : vi.fn() };

            await handler( mockReq as any, mockRes as any );
            expect( mockRes.end ).toHaveBeenCalled();
        });

        it( 'should handle raw body caching', async () => 
        {
            const server = new Server({ port : 3000 });
            const body = new TextEncoder().encode( JSON.stringify({ a : 1 }));
            const req: any = new Request( 'http://localhost/', {
                method : 'POST',
                body   : body
            });
            
            const raw1 = await ( server as any ).getRawBody( req );
            const raw2 = await ( server as any ).getRawBody( req );
            
            expect( new Uint8Array( raw1 )).toEqual( body );
            expect( raw1 ).toBe( raw2 ); // Cached reference
        });

        it( 'should log routes and incoming requests when logs: true is specified', async () => 
        {
            const consoleSpy = vi.spyOn( console, 'log' ).mockImplementation(() => {});
            
            const server = setupServer( 3004, ( registry ) =>
            {
                registry.registerController( 'LogCtrl', { getLog : () => ({ hello : 'log' }) });
                registry.registerEndpoint({
                    controller   : 'LogCtrl', methodName   : 'getLog', httpMethod   : 'GET', path         : '/log-test',
                    params       : [], guards       : [], interceptors : [], meta         : {}
                });
            }, { logs : true });
            await server.start();
            
            // Verify registration log
            expect( consoleSpy ).toHaveBeenCalledWith( expect.stringContaining( 'Registered route (public): GET    /log-test -> LogCtrl.getLog' ));
            
            // Simulate incoming request
            const request = new Request( 'http://localhost:3004/log-test', { method : 'GET' });
            const response = await server.fetch( request );
            
            // Verify request and response logs
            expect( consoleSpy ).toHaveBeenCalledWith( expect.stringContaining( '--> GET /log-test' ));
            expect( consoleSpy ).toHaveBeenCalledWith( expect.stringContaining( '<-- GET /log-test - 200' ));
            
            expect( response.status ).toBe( 200 );
            
            consoleSpy.mockRestore();
        });
    });

    describe( 'ConsoleLogger and event off()', () =>
    {
        it( 'should forward ConsoleLogger.error and debug to console', () =>
        {
            // Arrange
            const err = vi.spyOn( console, 'error' ).mockImplementation(() => {});
            const dbg = vi.spyOn( console, 'debug' ).mockImplementation(() => {});
            const logger = new ConsoleLogger();

            // Act
            logger.error( 'E' );
            logger.debug( 'D' );

            // Assert
            expect( err ).toHaveBeenCalledWith( 'E' );
            expect( dbg ).toHaveBeenCalledWith( 'D' );
            err.mockRestore();
            dbg.mockRestore();
        });

        it( 'should remove event handlers with off()', async () =>
        {
            // Arrange
            const server = new Server({ port : 3000 });
            const onReq = vi.fn();
            server.on( 'request', onReq );
            server.off( 'request', onReq );

            // Act
            await server.fetch( new Request( 'http://localhost/any' ));

            // Assert
            expect( onReq ).not.toHaveBeenCalled();
        });

        it( 'should strip error response bodies for HEAD requests', async () =>
        {
            // Arrange — force Server.catch (RequestProcessor normally swallows handler errors)
            const { RequestProcessor } = await import( '../src/core/request-processor.js' );
            const spy = vi.spyOn( RequestProcessor, 'execute' ).mockRejectedValue( new Error( 'nope' ));

            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerController( 'C', { ok : () => 'ok' });
                registry.registerEndpoint({
                    controller   : 'C',
                    methodName   : 'ok',
                    httpMethod   : 'GET',
                    path         : '/boom',
                    params       : [],
                    guards       : [],
                    interceptors : [],
                    meta         : {}
                });
            });

            // Act
            const res = await server.fetch( new Request( 'http://localhost/boom', { method : 'HEAD' }));

            // Assert
            expect( res.status ).toBe( 500 );
            expect( await res.text()).toBe( '' );
            spy.mockRestore();
        });

        it( 'should rebuild responses when security headers cannot mutate immutable headers', async () =>
        {
            // Arrange — security only (no cors) so applySecurityHeaders catch runs
            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerController( 'C', {
                    get : () =>
                    {
                        const res = new Response( 'ok' );
                        res.headers.set = () => { throw new TypeError( 'immutable' ) };

                        return res;
                    }
                });
                registry.registerEndpoint({
                    controller   : 'C',
                    methodName   : 'get',
                    httpMethod   : 'GET',
                    path         : '/h',
                    params       : [],
                    guards       : [],
                    interceptors : [],
                    meta         : {}
                });
            }, { security : true });

            // Act
            const res = await server.fetch( new Request( 'http://localhost/h' ));

            // Assert
            expect( res.status ).toBe( 200 );
            expect( res.headers.get( 'x-content-type-options' )).toBe( 'nosniff' );
            expect( await res.text()).toBe( 'ok' );
        });

        it( 'should rebuild responses when CORS headers cannot mutate immutable headers', async () =>
        {
            // Arrange
            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerController( 'C', {
                    get : () =>
                    {
                        const res = new Response( 'ok' );
                        res.headers.set = () => { throw new TypeError( 'immutable' ) };

                        return res;
                    }
                });
                registry.registerEndpoint({
                    controller   : 'C',
                    methodName   : 'get',
                    httpMethod   : 'GET',
                    path         : '/cors-h',
                    params       : [],
                    guards       : [],
                    interceptors : [],
                    meta         : {}
                });
            }, { cors : { origin : '*' } });

            // Act
            const res = await server.fetch( new Request( 'http://localhost/cors-h', {
                headers : { Origin : 'http://example.com' }
            }));

            // Assert
            expect( res.status ).toBe( 200 );
            expect( res.headers.get( 'access-control-allow-origin' )).toBe( '*' );
            expect( await res.text()).toBe( 'ok' );
        });
    });

    describe( 'Server coverage seams', () =>
    {
        it( 'should expose nodeServer via getter after setter creates an adapter', () =>
        {
            // Arrange
            const server = new Server({ port : 3000 });
            const mockNode = { close : vi.fn() };

            // Act
            server.nodeServer = mockNode;

            // Assert
            expect( server.nodeServer ).toBe( mockNode );
            expect(( server as any ).serverAdapter ).toBeDefined();
        });

        it( 'should bootstrap via deprecated init()', async () =>
        {
            // Arrange
            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerController( 'InitCtrl', { ok : () => 'ready' });
                registry.registerEndpoint({
                    controller   : 'InitCtrl',
                    methodName   : 'ok',
                    httpMethod   : 'GET',
                    path         : '/init',
                    params       : [],
                    guards       : [],
                    interceptors : [],
                    meta         : {}
                });
            });

            // Act
            ( server as any ).init();
            const res = await server.fetch( new Request( 'http://localhost/init' ));

            // Assert
            expect(( server as any ).bootstrapped ).toBe( true );
            expect( await res.text()).toBe( 'ready' );
        });

        it.skipIf( !isNodeRuntime )( 'should log and shutdown on SIGTERM when logs:true', async () =>
        {
            // Arrange
            const captured : Record<string, () => void> = {};
            const onSpy = vi.spyOn( process, 'on' ).mockImplementation(( event : any, listener : any ) =>
            {
                if( event === 'SIGTERM' || event === 'SIGINT' )
                {
                    captured[event] = listener;
                }

                return process as any;
            });
            const logger =
            {
                info  : vi.fn(),
                warn  : vi.fn(),
                error : vi.fn(),
                debug : vi.fn()
            };
            const server = new Server({ port : 3998, logs : true, logger });
            const shutdownSpy = vi.spyOn( server, 'shutdown' ).mockResolvedValue( undefined as any );

            // Act
            captured.SIGTERM();

            // Assert
            expect( logger.warn ).toHaveBeenCalledWith(
                expect.stringContaining( 'SIGTERM' ),
                expect.objectContaining({ type : 'server_shutdown', reason : 'SIGTERM' })
            );
            expect( shutdownSpy ).toHaveBeenCalledWith( 'SIGTERM' );
            onSpy.mockRestore();
        });

        it( 'should log CORS preflight and 404 when logs:true', async () =>
        {
            // Arrange
            const logger =
            {
                info  : vi.fn(),
                warn  : vi.fn(),
                error : vi.fn(),
                debug : vi.fn()
            };
            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerController( 'CorsCtrl', { get : () => 'ok' });
                registry.registerEndpoint({
                    controller   : 'CorsCtrl',
                    methodName   : 'get',
                    httpMethod   : 'GET',
                    path         : '/cors-log',
                    params       : [],
                    guards       : [],
                    interceptors : [],
                    meta         : {}
                });
            }, { logs : true, logger, cors : { origin : '*' } });

            // Act
            const preflight = await server.fetch( new Request( 'http://localhost/cors-log', {
                method  : 'OPTIONS',
                headers : {
                    Origin                          : 'http://example.com',
                    'Access-Control-Request-Method' : 'GET'
                }
            }));
            const missing = await server.fetch( new Request( 'http://localhost/no-such-route' ));

            // Assert
            expect( preflight.status ).toBe( 204 );
            expect( logger.info ).toHaveBeenCalledWith(
                expect.stringContaining( '204 CORS Preflight' ),
                expect.objectContaining({ type : 'request_end', status : 204 })
            );
            expect( missing.status ).toBe( 404 );
            expect( logger.info ).toHaveBeenCalledWith(
                expect.stringContaining( '404 Not Found' ),
                expect.objectContaining({ type : 'request_end', status : 404 })
            );
        });

        it( 'should run WS upgrade guards across param sources and mock adapter.upgrade', async () =>
        {
            // Arrange
            const guardArgs : any[] = [];
            const guard =
            {
                use : vi.fn(( ...args : any[]) => { guardArgs.push( ...args ) })
            };
            const upgradeRes = new Response( null, { status : 200 });
            const upgrade = vi.fn().mockResolvedValue( upgradeRes );
            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerProvider( 'Tok', { value : 'injected' });
                registry.registerGuard( 'WsGuard', guard );
                registry.registerController( 'WsCtrl', { ws : () => {} });
                registry.registerEndpoint({
                    controller : 'WsCtrl',
                    methodName : 'ws',
                    httpMethod : 'WS',
                    path       : '/ws/:id',
                    params     : [],
                    guards     : [{
                        name      : 'WsGuard',
                        type      : 'class',
                        resolvers : [ 'from-resolver' ],
                        params    : [
                            { source : 'WebSocket' },
                            { source : 'Request' },
                            { source : 'Param', name : 'id' },
                            { source : 'Query', name : 'q' },
                            { source : 'Inject', name : 'Tok' },
                            { source : 'Unknown' as any }
                        ]
                    }],
                    interceptors : [],
                    meta         : {}
                });
            });
            ( server as any ).serverAdapter = { upgrade, close : async () => {} };

            // Act
            const res = await server.fetch( new Request( 'http://localhost/ws/42?q=hi', {
                headers : { upgrade : 'websocket' }
            }));

            // Assert
            expect( guard.use ).toHaveBeenCalledOnce();
            expect( guardArgs[0]).toBeNull();
            expect( guardArgs[1]).toBeInstanceOf(
                ( await import( '../src/core/server-request.js' )).ServerRequest
            );
            expect( guardArgs[2]).toBe( '42' );
            expect( guardArgs[3]).toBe( 'hi' );
            expect( guardArgs[4]).toBe( 'injected' );
            expect( guardArgs[5]).toBe( 'from-resolver' );
            expect( upgrade ).toHaveBeenCalledOnce();
            expect( res.status ).toBe( 200 );
        });

        it( 'should return 501 when adapter has no upgrade', async () =>
        {
            // Arrange
            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerController( 'WsCtrl', { ws : () => {} });
                registry.registerEndpoint({
                    controller   : 'WsCtrl',
                    methodName   : 'ws',
                    httpMethod   : 'WS',
                    path         : '/ws-no',
                    params       : [],
                    guards       : [],
                    interceptors : [],
                    meta         : {}
                });
            });
            ( server as any ).serverAdapter = { close : async () => {} };

            // Act
            const res = await server.fetch( new Request( 'http://localhost/ws-no', {
                headers : { upgrade : 'websocket' }
            }));

            // Assert
            expect( res.status ).toBe( 501 );
            expect( await res.text()).toBe( 'WebSockets not supported by adapter' );
        });

        it( 'should reject WS upgrade when guard param validation fails', async () =>
        {
            // Arrange
            const upgrade = vi.fn();
            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerGuard( 'BadQueryGuard', {
                    use : () => true
                });
                registry.registerController( 'WsCtrl', { ws : () => {} });
                registry.registerEndpoint({
                    controller : 'WsCtrl',
                    methodName : 'ws',
                    httpMethod : 'WS',
                    path       : '/ws-bad',
                    params     : [],
                    guards     : [{
                        type   : 'class',
                        name   : 'BadQueryGuard',
                        params : [{
                            source    : 'Query',
                            name      : 'token',
                            validator : ( _v: unknown, _p: string, ctx: { success : boolean, errors : unknown[] }) =>
                            {
                                ctx.success = false;
                                ctx.errors.push({ message : 'bad token' });

                                return undefined;
                            }
                        }],
                        resolvers : []
                    }],
                    interceptors : [],
                    meta         : {}
                });
            });
            ( server as any ).serverAdapter = { upgrade, close : async () => {} };

            // Act
            const res = await server.fetch( new Request( 'http://localhost/ws-bad', {
                headers : { upgrade : 'websocket' }
            }));

            // Assert
            expect( res.status ).toBe( 400 );
            expect( upgrade ).not.toHaveBeenCalled();
            expect( await res.json()).toMatchObject({ success : false, message : 'request validation failed' });
        });

        it( 'should reject immediately when timeout AbortSignal is already aborted', async () =>
        {
            // Arrange
            const RealAC = AbortController;
            vi.stubGlobal( 'AbortController', class extends RealAC
            {
                constructor()
                {
                    super();
                    this.abort();
                }
            });
            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerController( 'T', {
                    slow : async () =>
                    {
                        await new Promise( r => setTimeout( r, 50 ));

                        return 'ok';
                    }
                });
                registry.registerEndpoint({
                    controller   : 'T',
                    methodName   : 'slow',
                    httpMethod   : 'GET',
                    path         : '/already-aborted',
                    params       : [],
                    guards       : [],
                    interceptors : [],
                    meta         : {},
                    security     : { timeout : 1000 }
                });
            });

            // Act
            const res = await server.fetch( new Request( 'http://localhost/already-aborted' ));

            // Assert
            expect( res.status ).toBe( 408 );
            vi.unstubAllGlobals();
        });

        it( 'should log error and response end when logs:true and handler throws', async () =>
        {
            // Arrange — force Server.catch (RequestProcessor normally returns error Responses)
            const { RequestProcessor } = await import( '../src/core/request-processor.js' );
            const spy = vi.spyOn( RequestProcessor, 'execute' ).mockRejectedValue( new Error( 'logged-boom' ));
            const logger =
            {
                info  : vi.fn(),
                warn  : vi.fn(),
                error : vi.fn(),
                debug : vi.fn()
            };
            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerController( 'BoomCtrl', { boom : () => 'ok' });
                registry.registerEndpoint({
                    controller   : 'BoomCtrl',
                    methodName   : 'boom',
                    httpMethod   : 'GET',
                    path         : '/logged-boom',
                    params       : [],
                    guards       : [],
                    interceptors : [],
                    meta         : {}
                });
            }, { logs : true, logger });

            // Act
            const res = await server.fetch( new Request( 'http://localhost/logged-boom' ));

            // Assert
            expect( res.status ).toBe( 500 );
            expect( logger.error ).toHaveBeenCalledWith(
                expect.stringContaining( 'Server Error: logged-boom' ),
                expect.objectContaining({ type : 'error' })
            );
            expect( logger.info ).toHaveBeenCalledWith(
                expect.stringContaining( '500' ),
                expect.objectContaining({ type : 'request_end', status : 500 })
            );
            spy.mockRestore();
        });
    });

    describe( 'Logger Integration', () => 
    {
        it( 'should dispatch registration, request, and lifecycle events with structured LogContext metadata', async () => 
        {
            const logs: any[] = [];
            const customLogger = {
                info  : ( msg: string, ctx: any ) => logs.push({ level : 'info', msg, ctx }),
                warn  : ( msg: string, ctx: any ) => logs.push({ level : 'warn', msg, ctx }),
                error : ( msg: string, ctx: any ) => logs.push({ level : 'error', msg, ctx })
            };

            const server = setupServer( 3005, ( registry ) =>
            {
                registry.registerController( 'MockCtrl', { mockAction : () => 'ok' });
                registry.registerEndpoint({
                    controller   : 'MockCtrl', methodName   : 'mockAction', httpMethod   : 'GET', path         : '/mock-log',
                    params       : [], guards       : [], interceptors : [], meta         : {}
                });
            }, { logs : true, logger : customLogger });
            await server.start();

            const regLog = logs.find( l => l.ctx?.type === 'registration' );
            expect( regLog ).toBeDefined();
            expect( regLog.ctx.method ).toBe( 'GET' );
            expect( regLog.ctx.path ).toBe( '/mock-log' );
            expect( regLog.ctx.controller ).toBe( 'MockCtrl' );
            expect( regLog.ctx.action ).toBe( 'mockAction' );

            // 2. Verify Request & Response Log
            const request = new Request( 'http://localhost:3005/mock-log', { method : 'GET' });
            await server.fetch( request );

            const startLog = logs.find( l => l.ctx?.type === 'request_start' );
            expect( startLog ).toBeDefined();
            expect( startLog.ctx.method ).toBe( 'GET' );
            expect( startLog.ctx.path ).toBe( '/mock-log' );

            const endLog = logs.find( l => l.ctx?.type === 'request_end' );
            expect( endLog ).toBeDefined();
            expect( endLog.ctx.method ).toBe( 'GET' );
            expect( endLog.ctx.path ).toBe( '/mock-log' );
            expect( endLog.ctx.status ).toBe( 200 );
            expect( endLog.ctx.duration ).toBeGreaterThanOrEqual( 0 );
        });
    });

    describe( 'Module System', () => 
    {
        it( 'should traverse a module tree, register controllers/providers, and map routes', async () => 
        {
            const logs: any[] = [];
            const logger = {
                info  : ( msg: any, ctx: any ) => logs.push({ msg, ctx }),
                warn  : ( msg: any, ctx: any ) => {},
                error : ( msg: any, ctx: any ) => {},
                debug : ( msg: any, ctx: any ) => {}
            };

            class ServiceA 
            {
                getValue() { return 'A' }
            }

            class ServiceB 
            {
                constructor( public a: ServiceA ) {}
                getValue() { return this.a.getValue() + 'B' }
            }

            class ServiceC 
            {
                getValue() { return 'C' }
            }

            class ChildController 
            {
                constructor( public b: ServiceB ) {}
                async hello() 
                {
                    return this.b.getValue();
                }
            }

            class ParentController 
            {
                constructor( public c: ServiceC ) {}
                async greet() 
                {
                    return this.c.getValue();
                }
            }

            // Set up injections metadata manually as if compile-time AOT generated them
            ( ServiceB as any ).__injections__ = { constructorDeps : ['ServiceA'] };
            ( ChildController as any ).__injections__ = { constructorDeps : ['ServiceB'] };
            ( ParentController as any ).__injections__ = { constructorDeps : ['ServiceC'] };

            defineController( ChildController, [{ methodName : 'hello', httpMethod : 'GET', path : '/child' }]);
            defineController( ParentController, [{ methodName : 'greet', httpMethod : 'GET', path : '/parent' }]);

            const SubModule = legacyModule({
                providers   : [ServiceA, ServiceB],
                controllers : [ChildController]
            });

            const RootModule = legacyModule({
                imports     : [SubModule],
                providers   : [ServiceC],
                controllers : [ParentController]
            });

            const server = setupServer( 3006, () => {}, {module : RootModule, logger, logs : false});

            await server.ensureReady();

            await runWithRegistry( server.registry, async () =>
            {
                const parentInst = await server.registry.getController( 'ParentController' );
                const childInst = await server.registry.getController( 'ChildController' );
                expect( parentInst ).toBeDefined();
                expect( parentInst.c.getValue()).toBe( 'C' );

                expect( childInst ).toBeDefined();
                expect( childInst.b.getValue()).toBe( 'AB' );
            });

            // Verify routes are registered
            const res1 = await server.fetch( new Request( 'http://localhost/parent' ));
            expect( await res1.text()).toBe( 'C' );

            const res2 = await server.fetch( new Request( 'http://localhost/child' ));
            expect( await res2.text()).toBe( 'AB' );

            // Route from OtherController should not be registered (route filtering)
            const res3 = await server.fetch( new Request( 'http://localhost/ignored' ));
            expect( res3.status ).toBe( 404 );
        });

        it( 'should support dynamic modules', async () => 
        {
            class ConfigService 
            {
                constructor() {}
                get() { return 'dynamic-config' }
            }

            class DynamicController 
            {
                constructor( public config: ConfigService ) {}
                async handle() { return this.config.get() }
            }
            ( DynamicController as any ).__injections__ = { constructorDeps : ['ConfigService'] };

            defineController( DynamicController, [{ methodName : 'handle', httpMethod : 'GET', path : '/dynamic' }]);

            class DynamicModuleClass {}
            const DynamicModule = {
                module      : DynamicModuleClass,
                providers   : [ConfigService],
                controllers : [DynamicController]
            };

            const RootModule = legacyModule({ imports : [DynamicModule] });

            const server = setupServer( 3007, () => {}, {module : RootModule});

            await server.ensureReady();
            await runWithRegistry( server.registry, async () =>
            {
                const ctrl = await server.registry.getController( 'DynamicController' );
                expect( ctrl ).toBeDefined();
                expect( ctrl.config.get()).toBe( 'dynamic-config' );
            });

            const res = await server.fetch( new Request( 'http://localhost/dynamic' ));
            expect( await res.text()).toBe( 'dynamic-config' );
        });

        it( 'should handle circular module dependencies gracefully', async () => 
        {
            const ModuleA: any = legacyModule({});
            const ModuleB: any = legacyModule({ imports : [ModuleA] });
            setModuleMeta( ModuleA, { imports : [ModuleB] });

            const server = new Server({ port : 3008, module : ModuleA });
            await expect( server.ensureReady()).resolves.toBeUndefined();
        });

        it( 'should support multiple root modules', async () => 
        {
            class ServiceX 
            {
                getValue() { return 'X' }
            }
            class ServiceY 
            {
                getValue() { return 'Y' }
            }
            class ControllerX 
            {
                constructor( public x: ServiceX ) {}
                async hello() { return this.x.getValue() }
            }
            class ControllerY 
            {
                constructor( public y: ServiceY ) {}
                async hello() { return this.y.getValue() }
            }
            ( ControllerX as any ).__injections__ = { constructorDeps : ['ServiceX'] };
            ( ControllerY as any ).__injections__ = { constructorDeps : ['ServiceY'] };

            defineController( ControllerX, [{ methodName : 'hello', httpMethod : 'GET', path : '/x' }]);
            defineController( ControllerY, [{ methodName : 'hello', httpMethod : 'GET', path : '/y' }]);

            const ModuleX = legacyModule({ providers : [ServiceX], controllers : [ControllerX] });
            const ModuleY = legacyModule({ providers : [ServiceY], controllers : [ControllerY] });

            const server = setupServer( 3009, () => {}, {module : [ModuleX, ModuleY]});

            const resX = await server.fetch( new Request( 'http://localhost/x' ));
            expect( await resX.text()).toBe( 'X' );

            const resY = await server.fetch( new Request( 'http://localhost/y' ));
            expect( await resY.text()).toBe( 'Y' );
        });

        it( 'should enforce module encapsulation (fail if provider is not exported)', async () => 
        {
            class HiddenService 
            {
                getValue() { return 'hidden' }
            }
            class ConsumerController 
            {
                constructor( public hidden: HiddenService ) {}
                async hello() { return this.hidden.getValue() }
            }
            ( ConsumerController as any ).__injections__ = { constructorDeps : ['HiddenService'] };

            defineController( ConsumerController, [{ methodName : 'hello', httpMethod : 'GET', path : '/consume' }]);

            const ModuleA = legacyModule({ providers : [HiddenService] });
            const RootModule = legacyModule({ imports : [ModuleA], controllers : [ConsumerController] });

            const server = setupServer( 3010, () => {}, {module : RootModule});
            await expect( server.ensureReady()).rejects.toThrow(
                /No provider registered for token: HiddenService in module/
            );
        });

        it( 'should support module re-exports', async () => 
        {
            class SharedService 
            {
                getValue() { return 'shared' }
            }
            class ConsumerController 
            {
                constructor( public shared: SharedService ) {}
                async hello() { return this.shared.getValue() }
            }
            ( ConsumerController as any ).__injections__ = { constructorDeps : ['SharedService'] };

            defineController( ConsumerController, [{ methodName : 'hello', httpMethod : 'GET', path : '/reexport' }]);

            const ModuleC = legacyModule({ providers : [SharedService], exports : [SharedService] });
            const ModuleB = legacyModule({ imports : [ModuleC], exports : [ModuleC] });
            const RootModule = legacyModule({ imports : [ModuleB], controllers : [ConsumerController] });

            const server = setupServer( 3011, () => {}, {module : RootModule});

            const res = await server.fetch( new Request( 'http://localhost/reexport' ));
            expect( await res.text()).toBe( 'shared' );
        });

        it( 'should support circular dependency injection in modules', async () => 
        {
            class ServiceA 
            {
                static __injections__ = { constructorDeps : ['ServiceB'], propertyDeps : {} };
                constructor( public b: any ) {}
                hello() { return 'A' + this.b.getValue() }
                getValue() { return 'A' }
            }
            class ServiceB 
            {
                static __injections__ = { constructorDeps : ['ServiceA'], propertyDeps : {} };
                constructor( public a: any ) {}
                hello() { return 'B' + this.a.getValue() }
                getValue() { return 'B' }
            }
            class CircularController 
            {
                constructor( public a: ServiceA ) {}
                async hello() { return this.a.hello() }
            }
            ( CircularController as any ).__injections__ = { constructorDeps : ['ServiceA'] };

            defineController( CircularController, [{ methodName : 'hello', httpMethod : 'GET', path : '/circ' }]);

            const CircularModule = legacyModule({
                providers   : [ServiceA, ServiceB],
                controllers : [CircularController]
            });

            const server = setupServer( 3012, () => {}, {module : CircularModule});

            const res = await server.fetch( new Request( 'http://localhost/circ' ));
            expect( await res.text()).toBe( 'AB' );

            await runWithRegistry( server.registry, async () =>
            {
                const ctrl = await server.registry.getController( 'CircularController' );
                expect( ctrl.a.b.hello()).toBe( 'BA' );
            });
        });

        it( 'should support @Global() modules', async () => 
        {
            class GlobalService 
            {
                getValue() { return 'global' }
            }
            class ConsumerController 
            {
                constructor( public glob: GlobalService ) {}
                async hello() { return this.glob.getValue() }
            }
            ( ConsumerController as any ).__injections__ = { constructorDeps : ['GlobalService'] };

            defineController( ConsumerController, [{ methodName : 'hello', httpMethod : 'GET', path : '/consume-global' }]);

            const GlobalModule = legacyModule({ global : true, providers : [GlobalService], exports : [GlobalService] });
            const RootModule = legacyModule({ imports : [GlobalModule], controllers : [] });
            const ConsumerModule = legacyModule({ controllers : [ConsumerController] });

            const server = setupServer( 3013, () => {}, {module : [RootModule, ConsumerModule]});

            const res = await server.fetch( new Request( 'http://localhost/consume-global' ));
            expect( await res.text()).toBe( 'global' );
        });
    });

    describe( 'Injection Scopes', () => 
    {

        it( 'should resolve TRANSIENT provider with new instance every time', async () => 
        {
            let instanceCount = 0;
            class TransientService 
            {
                static __scope__ = Scope.TRANSIENT;
                public id : number;
                constructor() 
                {
                    instanceCount++;
                    this.id = instanceCount;
                }
            }
            const registry = new ApplicationRegistry();
            registry.registerProvider( 'TransientService', TransientService );
            const inst1 = await runWithRegistry( registry, () => registry.resolve( 'TransientService' ));
            const inst2 = await runWithRegistry( registry, () => registry.resolve( 'TransientService' ));
            expect( inst1 ).toBeInstanceOf( TransientService );
            expect( inst2 ).toBeInstanceOf( TransientService );
            expect( inst1.id ).toBe( 1 );
            expect( inst2.id ).toBe( 2 );
            expect( inst1 ).not.toBe( inst2 );
        });

        it( 'should propagate REQUEST scope to dependent classes and resolve per-request', async () => 
        {
            let reqServiceInstCount = 0;
            class RequestService 
            {
                static __scope__ = Scope.REQUEST;
                public id : number;
                constructor() 
                {
                    reqServiceInstCount++;
                    this.id = reqServiceInstCount;
                }
            }

            class DependentService 
            {
                static __injections__ = { constructorDeps : ['RequestService'], propertyDeps : {} };
                constructor( public reqService: RequestService ) {}
            }

            class RequestController 
            {
                static __injections__ = { constructorDeps : ['DependentService'], propertyDeps : {} };
                constructor( public depService: DependentService ) {}
                async hello() 
                {
                    return {
                        reqId          : this.depService.reqService.id,
                        depServiceType : typeof this.depService
                    };
                }
            }

            defineController( RequestController, [{ methodName : 'hello', httpMethod : 'GET', path : '/scope-test' }]);

            const ScopeModule = legacyModule({
                providers   : [RequestService, DependentService],
                controllers : [RequestController]
            });

            const server = setupServer( 3014, () => {}, {module : ScopeModule});
            await server.ensureReady();

            await expect( runWithRegistry( server.registry, () => server.registry.resolve( 'RequestService' )))
                .rejects.toThrow( /Cannot resolve request-scoped provider/ );
            // Fetch request 1
            const res1 = await server.fetch( new Request( 'http://localhost/scope-test' ));
            const data1 = ( await res1.json()) as any;
            expect( data1.reqId ).toBe( 1 );

            // Fetch request 2
            const res2 = await server.fetch( new Request( 'http://localhost/scope-test' ));
            const data2 = ( await res2.json()) as any;
            expect( data2.reqId ).toBe( 2 );
        });
    });

    describe( 'Lifecycle Hooks', () => 
    {

        it( 'should call onInit during start and onDestroy during shutdown', async () => 
        {
            const sequence: string[] = [];

            class HookService 
            {
                async onInit() 
                {
                    sequence.push( 'provider:onInit' );
                }
                async onDestroy() 
                {
                    sequence.push( 'provider:onDestroy' );
                }
            }

            class HookController 
            {
                async onInit() 
                {
                    sequence.push( 'controller:onInit' );
                }
                async onDestroy() 
                {
                    sequence.push( 'controller:onDestroy' );
                }
            }

            class HookModule
            {
                async onInit()
                {
                    sequence.push( 'module:onInit' );
                }
                async onDestroy()
                {
                    sequence.push( 'module:onDestroy' );
                }
            }

            defineController( HookController, []);
            setModuleMeta( HookModule, {
                providers   : [HookService],
                controllers : [HookController]
            });

            const server = new Server({ port : 3015, module : HookModule });

            // onInit runs during ensureReady / resolveAll (no listen needed)
            await server.ensureReady();

            expect( sequence ).toContain( 'provider:onInit' );
            expect( sequence ).toContain( 'controller:onInit' );
            expect( sequence ).toContain( 'module:onInit' );

            // Shutdown — onDestroy runs via destroyAll after drain
            await server.shutdown( 'SIGINT' );

            expect( sequence ).toContain( 'provider:onDestroy' );
            expect( sequence ).toContain( 'controller:onDestroy' );
            expect( sequence ).toContain( 'module:onDestroy' );
        });
    });

    describe( 'Custom Decorators & Reflector', () => 
    {
        it( 'should correctly attach metadata on class constructors using Meta and SetMetadata', () => 
        {
            @Meta({ roles : ['admin'], isClass : true })
            class CustomCtrl {}

            @SetMetadata( 'roles', ['user'])
            class UserCtrl {}

            const reflector = new Reflector();
            expect( reflector.get( 'roles', CustomCtrl )).toEqual(['admin']);
            expect( reflector.get( 'isClass', CustomCtrl )).toBe( true );
            expect( reflector.get( 'roles', UserCtrl )).toEqual(['user']);
            expect( reflector.get( 'nonexistent', CustomCtrl )).toBeUndefined();
        });

        it( 'should correctly attach metadata on methods using Meta and SetMetadata', () => 
        {
            class CustomCtrl 
            {
                @Meta({ permissions : ['read'] })
                readAction() {}

                @SetMetadata( 'permissions', ['write'])
                writeAction() {}
            }

            const reflector = new Reflector();
            
            // Standard JS decorators attach descriptor.value
            const readMethod = CustomCtrl.prototype.readAction;
            const writeMethod = CustomCtrl.prototype.writeAction;

            expect( reflector.get( 'permissions', readMethod )).toEqual(['read']);
            expect( reflector.get( 'permissions', writeMethod )).toEqual(['write']);
        });

        it( 'should resolve metadata hierarchies using getAllAndOverride and getAllAndMerge', () => 
        {
            @Meta({ roles : ['admin'], scope : 'global' })
            class CustomCtrl 
            {
                @Meta({ roles : ['user'] })
                userAction() {}

                noRolesAction() {}
            }

            const reflector = new Reflector();
            const classObj = CustomCtrl;
            const userMethod = CustomCtrl.prototype.userAction;
            const guestMethod = CustomCtrl.prototype.noRolesAction;

            // getAllAndOverride: returns the first defined metadata value in the array of targets
            expect( reflector.getAllAndOverride( 'roles', [userMethod, classObj])).toEqual(['user']);
            expect( reflector.getAllAndOverride( 'roles', [guestMethod, classObj])).toEqual(['admin']);
            expect( reflector.getAllAndOverride( 'scope', [userMethod, classObj])).toBe( 'global' );

            // getAllAndMerge: merges arrays or objects
            // Roles: array merge
            expect( reflector.getAllAndMerge( 'roles', [userMethod, classObj])).toEqual(['user', 'admin']);
            expect( reflector.getAllAndMerge( 'roles', [guestMethod, classObj])).toEqual(['admin']);

            // Object merge
            @Meta({ options : { a : 1, b : 2 } })
            class OptionCtrl 
            {
                @Meta({ options : { b : 3, c : 4 } })
                action() {}
            }
            const optionMethod = OptionCtrl.prototype.action;
            expect( reflector.getAllAndMerge( 'options', [optionMethod, OptionCtrl])).toEqual({ a : 1, b : 3, c : 4 });
        });

        it( 'should integrate Reflector in request lifecycle guards', async () => 
        {
            const sequence: string[] = [];

            class AuthGuard
            {
                constructor( private reg: ApplicationRegistry ) {}

                async use( req: import( '../src/core/server-request.js' ).ServerRequest )
                {
                    const ctx = Context.get();

                    if( !ctx )
                    {
                        sequence.push( 'no-context' );

                        return;
                    }
                    const reflector = new Reflector();
                    const controllerClass = this.reg.getProvider( ctx.metadata.controller );
                    const handlerMethod = controllerClass?.prototype?.[ctx.metadata.methodName];

                    const requiredRoles = reflector.getAllAndOverride<string[]>( 'roles', [handlerMethod, controllerClass]);

                    const roleHeader = req.headers['x-role'];

                    if( requiredRoles && ( !roleHeader || !requiredRoles.includes( roleHeader )))
                    {
                        const err = new Error( 'Forbidden' );
                        ( err as any ).status = 403;
                        throw err;
                    }
                    sequence.push( 'authorized' );
                }
            }

            class TestController
            {
                async adminEndpoint()
                {
                    return { ok : true, section : 'admin' };
                }

                async userEndpoint()
                {
                    return { ok : true, section : 'user' };
                }
            }

            Meta({ roles : ['admin'] })( TestController );
            Meta({ roles : ['user', 'admin'] })( TestController.prototype, 'userEndpoint', Object.getOwnPropertyDescriptor( TestController.prototype, 'userEndpoint' )! );

            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerGuard( 'AuthGuard', new AuthGuard( registry ));
                registry.registerController( 'TestController', TestController );
                registry.registerProvider( 'TestController', TestController );
                registry.registerEndpoint({
                    controller : 'TestController',
                    methodName : 'adminEndpoint',
                    httpMethod : 'GET',
                    path       : '/admin',
                    params     : [],
                    guards     : [
                        { type : 'class', name : 'AuthGuard', resolvers : [], params : [{ source : 'Request' }], isAsync : true }
                    ],
                    interceptors : [],
                    meta         : {}
                });
                registry.registerEndpoint({
                    controller : 'TestController',
                    methodName : 'userEndpoint',
                    httpMethod : 'GET',
                    path       : '/user',
                    params     : [],
                    guards     : [
                        { type : 'class', name : 'AuthGuard', resolvers : [], params : [{ source : 'Request' }], isAsync : true }
                    ],
                    interceptors : [],
                    meta         : {}
                });
            });

            // 1. Calling /admin with no role -> 403 Forbidden
            const res1 = await server.fetch( new Request( 'http://localhost/admin' ));
            expect( res1.status ).toBe( 403 );

            // 2. Calling /admin with admin role -> 200 OK
            const res2 = await server.fetch( new Request( 'http://localhost/admin', {
                headers : { 'x-role' : 'admin' }
            }));
            expect( res2.status ).toBe( 200 );
            expect( await res2.json()).toEqual({ ok : true, section : 'admin' });

            // 3. Calling /user with user role -> 200 OK
            const res3 = await server.fetch( new Request( 'http://localhost/user', {
                headers : { 'x-role' : 'user' }
            }));
            expect( res3.status ).toBe( 200 );
            expect( await res3.json()).toEqual({ ok : true, section : 'user' });

            // 4. Calling /user with guest role -> 403 Forbidden
            const res4 = await server.fetch( new Request( 'http://localhost/user', {
                headers : { 'x-role' : 'guest' }
            }));
            expect( res4.status ).toBe( 403 );
        });
    });

    describe( 'mTLS client certificate and @Peer resolver', () => 
    {
        it( 'should extract client certificate metadata correctly', async () => 
        {
            class PeerTestController 
            {
                async handle( peer: any ) 
                {
                    return { peer };
                }
            }

            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerController( 'PeerTestController', PeerTestController );
                registry.registerEndpoint({
                    controller : 'PeerTestController',
                    methodName : 'handle',
                    httpMethod : 'GET',
                    path       : '/peer-test',
                    params     : [
                        { source : 'Peer' }
                    ],
                    guards       : [],
                    interceptors : [],
                    meta         : {}
                });
            });

            const req = new Request( 'http://localhost/peer-test' ) as any;
            req.clientCert = {
                subject : {
                    CN : 'ClientName',
                    O  : 'Organization'
                },
                issuer : {
                    CN : 'Authority'
                },
                valid : {
                    from : new Date( '2026-05-28' ),
                    to   : new Date( '2027-05-28' )
                },
                fingerprint    : 'AA:BB:CC',
                fingerprint256 : 'DD:EE:FF',
                serialNumber   : '123456',
                serial         : '123456'
            };

            const res = await server.fetch( req );
            expect( res.status ).toBe( 200 );
            const body = await res.json();
            expect( body.peer.subject.CN ).toBe( 'ClientName' );
            expect( body.peer.serialNumber ).toBe( '123456' );
            expect( body.peer.serial ).toBe( '123456' );
            expect( new Date( body.peer.valid.from ).getTime()).toBe( new Date( '2026-05-28' ).getTime());
            expect( new Date( body.peer.valid.to ).getTime()).toBe( new Date( '2027-05-28' ).getTime());
            expect( body.peer.raw ).toBeUndefined();
        });

        it( 'should return undefined if client certificate is missing', async () => 
        {
            class PeerTestController2 
            {
                async handle( peer: any ) 
                {
                    return { peer : peer ?? null };
                }
            }

            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerController( 'PeerTestController2', PeerTestController2 );
                registry.registerEndpoint({
                    controller : 'PeerTestController2',
                    methodName : 'handle',
                    httpMethod : 'GET',
                    path       : '/peer-test-missing',
                    params     : [
                        { source : 'Peer' }
                    ],
                    guards       : [],
                    interceptors : [],
                    meta         : {}
                });
            });

            const req = new Request( 'http://localhost/peer-test-missing' );
            const res = await server.fetch( req );
            expect( res.status ).toBe( 200 );
            const body = await res.json();
            expect( body.peer ).toBeNull();
        });
    });

    describe( 'Cookies Decorators & Deno Adapter Extensions', () => 
    {
        it( 'should parse Cookies and specific Cookie with first-match wins and coercion', async () => 
        {
            class CookieTestController 
            {
                async handle( cookies: any, session: any, age: any ) 
                {
                    return { cookies, session, age };
                }
            }

            const server = setupServer( 3000, ( registry ) =>
            {
                registry.registerController( 'CookieTestController', CookieTestController );
                registry.registerEndpoint({
                    controller : 'CookieTestController',
                    methodName : 'handle',
                    httpMethod : 'GET',
                    path       : '/cookie-test',
                    params     : [
                        { source : 'Cookies' },
                        { source : 'Cookie', name : 'sessionId' },
                        { source : 'Cookie', name : 'age', validator : validators.number }
                    ],
                    guards       : [],
                    interceptors : [],
                    meta         : {}
                });
            });

            // Send multiple sessionId cookies to test RFC 6265 first-match wins, and an age cookie to test coercion
            const req = new Request( 'http://localhost/cookie-test', {
                headers : {
                    'Cookie' : 'sessionId=first; age=28; sessionId=second'
                }
            });

            const res = await server.fetch( req );
            expect( res.status ).toBe( 200 );
            const body = await res.json();

            // All cookies parsed
            expect( body.cookies ).toEqual({ sessionId : 'first', age : '28' });
            // RFC 6265: First-match wins for sessionId
            expect( body.session ).toBe( 'first' );
            // Coercion works via validator
            expect( body.age ).toBe( 28 );
        });

        it.skipIf( !isNodeRuntime )( 'should use native Deno.serve TLS for cert/key without mTLS', async () =>
        {
            const { DenoAdapter } = await import( '../src/adapters/deno-adapter.js' );
            const adapter = new DenoAdapter();

            const serveMock = vi.fn().mockReturnValue({
                shutdown : vi.fn().mockResolvedValue( undefined ),
                finished : Promise.resolve()
            });
            ( globalThis as any ).Deno = { serve : serveMock };

            const tlsOptions = { key : '-----BEGIN KEY-----\nK\n-----END KEY-----', cert : '-----BEGIN CERT-----\nC\n-----END CERT-----' };
            await adapter.listen( 8443, async () => new Response( 'ok' ), tlsOptions );

            expect( serveMock ).toHaveBeenCalledWith(
                expect.objectContaining({
                    port : 8443,
                    key  : tlsOptions.key,
                    cert : tlsOptions.cert
                }),
                expect.any( Function )
            );

            await adapter.close();
            delete ( globalThis as any ).Deno;
        });

        it.skipIf( !isNodeRuntime )( 'should delegate Deno mTLS (requestCert) to NodeAdapter', async () =>
        {
            const { DenoAdapter } = await import( '../src/adapters/deno-adapter.js' );
            const adapter = new DenoAdapter();

            const serveMock = vi.fn();
            ( globalThis as any ).Deno = { serve : serveMock };

            const tlsOptions = { key : 'key', cert : 'cert', requestCert : true, ca : 'ca' };

            const mockNodeServer = { listen : vi.fn(( p, cb ) => cb()), close : vi.fn( cb => cb()) };
            const { createServer } = await import( 'https' );
            const mockCreateServer = vi.mocked( createServer ).mockReturnValue( mockNodeServer as any );

            const registry = new ApplicationRegistry();
            await runWithRegistry( registry, async () =>
            {
                await adapter.listen( 3002, async () => new Response(), tlsOptions );
            });

            expect( serveMock ).not.toHaveBeenCalled();
            expect( mockCreateServer ).toHaveBeenCalled();

            await adapter.close();
            expect( mockNodeServer.close ).toHaveBeenCalled();

            delete ( globalThis as any ).Deno;
        });

        it.skipIf( !isNodeRuntime )( 'should close Deno native server gracefully when no TLS is provided', async () => 
        {
            const { DenoAdapter } = await import( '../src/adapters/deno-adapter.js' );
            const adapter = new DenoAdapter();

            const shutdownMock = vi.fn().mockResolvedValue( undefined );
            const finishedPromise = Promise.resolve();

            const serveMock = vi.fn().mockReturnValue({
                shutdown : shutdownMock,
                finished : finishedPromise
            });

            ( globalThis as any ).Deno = { serve : serveMock };

            await adapter.listen( 3002, async () => new Response());
            expect( serveMock ).toHaveBeenCalled();

            await adapter.close();

            expect( shutdownMock ).toHaveBeenCalled();

            delete ( globalThis as any ).Deno;
        });
    });
});



