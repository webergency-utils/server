import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RequestProcessor } from '../core/request-processor.js';
import { ApplicationRegistry, runWithRegistry } from '../core/registry.js';
import { validators } from '@webergency-utils/typechecker';
import type { AugmentedRequest, EndpointMetadata, ParamMetadata } from '../core/types.js';

function createRequest( options:
{
    headers? : Record<string, string | null>
    body?    : string
    params?  : Record<string, string>
    query?   : Record<string, unknown>
    url?     : string
}): AugmentedRequest
{
    const headerMap = new Map<string, string>();

    for( const [ key, value ] of Object.entries( options.headers ?? {}))
    {
        if( value !== null )
        {
            headerMap.set( key.toLowerCase(), value );
        }
    }

    const bodyText = options.body ?? '';

    return {
        headers : {
            get     : ( name: string ) => headerMap.get( name.toLowerCase()) ?? null,
            entries : () => headerMap.entries()
        },
        arrayBuffer : async () => new TextEncoder().encode( bodyText ).buffer,
        params      : options.params ?? {},
        query       : options.query ?? {},
        url         : options.url ?? 'http://localhost/path',
        meta        : {}
    } as unknown as AugmentedRequest;
}

function createEndpoint( overrides: Partial<EndpointMetadata> & Pick<EndpointMetadata, 'controller' | 'methodName'> ): EndpointMetadata
{
    return {
        httpMethod   : 'GET',
        path         : '/test',
        params       : [],
        guards       : [],
        interceptors : [],
        middlewares  : [],
        meta         : {},
        ...overrides
    };
}

function createWsMock()
{
    return {
        close : vi.fn(),
        send  : vi.fn()
    };
}

describe( 'RequestProcessor.resolveParam', () =>
{
    beforeEach(() =>
    {
        vi.clearAllMocks();
    });

    it( 'should set from:query for Query params and restore prior from', async () =>
    {
        const seen: { from?: unknown, mode?: unknown } = {};
        const validator = vi.fn(( v: unknown, _path: string, ctx: { from?: unknown, mode?: unknown }) =>
        {
            seen.from = ctx.from;
            seen.mode = ctx.mode;

            return validators.number( v, 'a', ctx as never );
        });
        const param: ParamMetadata = { source : 'Query', name : 'a', validator };
        const req = createRequest({ query : { a : '42' } });
        const ctx = { success : true, errors : [], mode : 'strict', from : 'json' };

        const result = await RequestProcessor.resolveParam( param, req, ctx );

        expect( result ).toBe( 42 );
        expect( seen.from ).toBe( 'query' );
        expect( ctx.from ).toBe( 'json' );
        expect( ctx.mode ).toBe( 'strict' );
    });

    it( 'should set from:query for Param and Cookie sources', async () =>
    {
        const fromValues: unknown[] = [];
        const capture = vi.fn(( v: unknown, _path: string, ctx: { from?: unknown }) =>
        {
            fromValues.push( ctx.from );

            return validators.number( v, 'n', ctx as never );
        });
        const req = createRequest({
            params  : { id : '7' },
            headers : { cookie : 'age=9' }
        });
        const ctx = { success : true, errors : [], mode : 'strict' };

        await RequestProcessor.resolveParam(
            { source : 'Param', name : 'id', validator : capture },
            req,
            ctx
        );
        await RequestProcessor.resolveParam(
            { source : 'Cookie', name : 'age', validator : capture },
            req,
            ctx
        );

        expect( fromValues ).toEqual([ 'query', 'query' ]);
        expect( ctx.from ).toBeUndefined();
    });

    it( 'should set from:json for JSON Body and revive Date values', async () =>
    {
        const seen: { from?: unknown } = {};
        const validator = vi.fn(( v: unknown, path: string, ctx: { from?: unknown }) =>
        {
            seen.from = ctx.from;

            return validators.date( v, path, ctx as never );
        });
        const req = createRequest({
            body    : JSON.stringify( '2024-01-01T00:00:00.000Z' ),
            headers : { 'Content-Type' : 'application/json' }
        });
        const ctx = { success : true, errors : [], mode : 'strict' };
        const param: ParamMetadata = { source : 'Body', validator };

        const result = await RequestProcessor.resolveParam( param, req, ctx );

        expect( seen.from ).toBe( 'json' );
        expect( result ).toBeInstanceOf( Date );
        expect(( result as Date ).toISOString()).toBe( '2024-01-01T00:00:00.000Z' );
        expect( ctx.from ).toBeUndefined();
    });

    it( 'should set from:query for urlencoded Body and coerce numbers', async () =>
    {
        const seen: { from?: unknown } = {};
        const validator = vi.fn(( v: unknown, path: string, ctx: { from?: unknown, success: boolean, errors: unknown[], mode: string }) =>
        {
            seen.from = ctx.from;

            if( !validators.object( v, path, ctx as never, [ 'age' ]))
            {
                return v;
            }

            validators.props( v, v, path, ctx as never, [
                [ 'age', false, validators.number ]
            ]);

            return v;
        });
        const req = createRequest({
            body    : 'age=25',
            headers : { 'Content-Type' : 'application/x-www-form-urlencoded; charset=utf-8' }
        });
        const ctx = { success : true, errors : [], mode : 'strict' };
        const param: ParamMetadata = { source : 'Body', validator };

        const result = await RequestProcessor.resolveParam( param, req, ctx );

        expect( seen.from ).toBe( 'query' );
        expect( result ).toEqual({ age : 25 });
        expect( ctx.success ).toBe( true );
    });

    it( 'should sniff JSON Body when content-type is missing', async () =>
    {
        const seen: { from?: unknown } = {};
        const validator = vi.fn(( v: unknown, _path: string, ctx: { from?: unknown }) =>
        {
            seen.from = ctx.from;

            return v;
        });
        const req = createRequest({ body : '{"ok":true}' });
        const ctx = { success : true, errors : [], mode : 'strict' };

        const result = await RequestProcessor.resolveParam(
            { source : 'Body', validator },
            req,
            ctx
        );

        expect( seen.from ).toBe( 'json' );
        expect( result ).toEqual({ ok : true });
    });

    it( 'should sniff urlencoded Body when content-type is missing', async () =>
    {
        const seen: { from?: unknown } = {};
        const validator = vi.fn(( v: unknown, _path: string, ctx: { from?: unknown }) =>
        {
            seen.from = ctx.from;

            return v;
        });
        const req = createRequest({ body : 'age=25' });
        const ctx = { success : true, errors : [], mode : 'strict' };

        const result = await RequestProcessor.resolveParam(
            { source : 'Body', validator },
            req,
            ctx
        );

        expect( seen.from ).toBe( 'query' );
        expect( result ).toEqual({ age : '25' });
    });

    it( 'should reject Body when content-type is missing on a non-empty body', async () =>
    {
        const req = createRequest({ body : 'not-json-or-form' });
        const ctx = { success : true, errors : [], mode : 'strict' };

        await expect( RequestProcessor.resolveParam({ source : 'Body' }, req, ctx ))
            .rejects.toMatchObject({ status : 400 });
    });

    it( 'should set Body from to json for application/json', async () =>
    {
        const seen: { from?: unknown } = {};
        const validator = vi.fn(( v: unknown, _path: string, ctx: { from?: unknown }) =>
        {
            seen.from = ctx.from;

            return v;
        });
        const req = createRequest({
            body    : '{"ok":true}',
            headers : { 'Content-Type' : 'application/json' }
        });
        const ctx = { success : true, errors : [], mode : 'strict' };

        const result = await RequestProcessor.resolveParam(
            { source : 'Body', validator },
            req,
            ctx
        );

        expect( seen.from ).toBe( 'json' );
        expect( result ).toEqual({ ok : true });
    });

    it( 'should apply param mode for the validator then restore ctx.mode', async () =>
    {
        const seen: { mode?: unknown } = {};
        const validator = vi.fn(( v: unknown, _path: string, ctx: { mode?: unknown }) =>
        {
            seen.mode = ctx.mode;

            return v;
        });
        const req = createRequest({ query : { q : 'x' } });
        const ctx = { success : true, errors : [], mode : 'strict' };

        await RequestProcessor.resolveParam(
            { source : 'Query', name : 'q', mode : 'strip', validator },
            req,
            ctx
        );

        expect( seen.mode ).toBe( 'strip' );
        expect( ctx.mode ).toBe( 'strict' );
    });

    it( 'should not mutate from when no validator is present', async () =>
    {
        const req = createRequest({ query : { a : '1' } });
        const ctx = { success : true, errors : [], mode : 'strict', from : undefined };

        const result = await RequestProcessor.resolveParam(
            { source : 'Query', name : 'a' },
            req,
            ctx
        );

        expect( result ).toBe( '1' );
        expect( ctx.from ).toBeUndefined();
    });

    it( 'should resolve RawBody as ArrayBuffer without JSON parsing', async () =>
    {
        const req = createRequest({
            body    : '{"x":1}',
            headers : { 'Content-Type' : 'application/octet-stream' }
        });
        const ctx = { success : true, errors : [], mode : 'strict' };

        const raw = await RequestProcessor.resolveParam({ source : 'RawBody' }, req, ctx );

        expect( raw ).toBeInstanceOf( ArrayBuffer );
        expect( new TextDecoder().decode( raw as ArrayBuffer )).toBe( '{"x":1}' );
        expect( ( req as any )._json ).toBeUndefined();
    });

    it( 'should resolve Url Hostname and Path from the request URL', async () =>
    {
        const req = createRequest({ url : 'https://api.example.com:8443/v1/items?x=1' });
        const ctx = { success : true, errors : [], mode : 'strict' };

        expect( await RequestProcessor.resolveParam({ source : 'Url' }, req, ctx )).toBe( 'https://api.example.com:8443/v1/items?x=1' );
        expect( await RequestProcessor.resolveParam({ source : 'Hostname' }, req, ctx )).toBe( 'api.example.com' );
        expect( await RequestProcessor.resolveParam({ source : 'Path' }, req, ctx )).toBe( '/v1/items' );
    });

    it( 'should resolve Ip from remoteAddress and ignore XFF by default', async () =>
    {
        const withHeader = createRequest({
            headers : { 'x-forwarded-for' : '10.0.0.1, 10.0.0.2' }
        });
        ( withHeader as any ).remoteAddress = '192.0.2.1';
        const without = createRequest({});
        const ctx = { success : true, errors : [], mode : 'strict' };

        const ip1 = await RequestProcessor.resolveParam({ source : 'Ip' }, withHeader, ctx );
        const ip2 = await RequestProcessor.resolveParam({ source : 'Ip' }, without, ctx );

        expect( ip1 ).toBe( '192.0.2.1' );
        expect( ip2 ).toBe( '127.0.0.1' );
    });

    it( 'should resolve Ip from XFF when trustProxy matches the peer', async () =>
    {
        const req = createRequest({
            headers : { 'x-forwarded-for' : '203.0.113.7, 10.0.0.2' }
        });
        ( req as any ).remoteAddress = '10.0.0.5';
        ( req as any ).trustProxy = [ '10.0.0.0/8' ];
        const ctx = { success : true, errors : [], mode : 'strict' };

        const ip = await RequestProcessor.resolveParam({ source : 'Ip' }, req, ctx );
        expect( ip ).toBe( '203.0.113.7' );
    });

    it( 'should parse Cookies with first-match-wins and named Cookie lookup', async () =>
    {
        const req = createRequest({
            headers : { cookie : 'session=first; age=1; session=second' }
        });
        const ctx = { success : true, errors : [], mode : 'strict' };

        const all = await RequestProcessor.resolveParam({ source : 'Cookies' }, req, ctx );
        const session = await RequestProcessor.resolveParam(
            { source : 'Cookie', name : 'session' },
            req,
            ctx
        );
        const missing = await RequestProcessor.resolveParam(
            { source : 'Cookie', name : 'missing' },
            req,
            ctx
        );

        expect( all ).toEqual({ session : 'first', age : '1' });
        expect( session ).toBe( 'first' );
        expect( missing ).toBeUndefined();
    });

    it( 'should skip cookie pairs without equals and ignore empty cookie header', async () =>
    {
        const empty = createRequest({});
        const malformed = createRequest({ headers : { cookie : 'lone; a=b' } });
        const ctx = { success : true, errors : [], mode : 'strict' };

        const a = await RequestProcessor.resolveParam({ source : 'Cookies' }, empty, ctx );
        const b = await RequestProcessor.resolveParam({ source : 'Cookies' }, malformed, ctx );

        expect( a ).toEqual({});
        expect( b ).toEqual({ a : 'b' });
    });
});

describe( 'RequestProcessor.execute SSE', () =>
{
    beforeEach(() =>
    {
        vi.clearAllMocks();
    });

    it( 'should preserve falsy primitive handler results', async () =>
    {
        // Arrange
        const registry = new ApplicationRegistry();
        registry.registerController( 'FalsyCtrl', {
            zero    : () => 0,
            no      : () => false,
            empty   : () => ''
        });

        // Act / Assert
        await runWithRegistry( registry, async () =>
        {
            const zero = await RequestProcessor.execute(
                createEndpoint({ controller : 'FalsyCtrl', methodName : 'zero' }),
                createRequest({})
            );
            const no = await RequestProcessor.execute(
                createEndpoint({ controller : 'FalsyCtrl', methodName : 'no' }),
                createRequest({})
            );
            const empty = await RequestProcessor.execute(
                createEndpoint({ controller : 'FalsyCtrl', methodName : 'empty' }),
                createRequest({})
            );

            expect( await zero.text()).toBe( '0' );
            expect( await no.text()).toBe( 'false' );
            expect( await empty.text()).toBe( '' );
        });
    });

    it( 'should format bare string SSE chunks and run the bare-chunk validator path', async () =>
    {
        // Arrange
        const registry = new ApplicationRegistry();
        const validated: unknown[] = [];
        registry.registerController( 'SseBareCtrl', {
            stream : async function *()
            {
                yield 'hello';
                yield 42;
            }
        });
        const meta = createEndpoint({
            controller          : 'SseBareCtrl',
            methodName          : 'stream',
            meta                : { sse : true },
            returnTypeValidator : ( v: unknown, _path: string, ctx: { success: boolean, errors: unknown[] }) =>
            {
                validated.push( v );

                if( v === 42 )
                {
                    ctx.success = false;
                    ctx.errors.push({ message : 'bad bare chunk' });
                }

                return v;
            }
        });
        const req = createRequest({});

        // Act
        const res = await runWithRegistry( registry, () => RequestProcessor.execute( meta, req ));

        // Assert
        expect( res.headers.get( 'Content-Type' )).toBe( 'text/event-stream' );
        await expect( res.text()).rejects.toThrow( /Response validation failed/ );
        expect( validated ).toEqual([ 'hello', 42 ]);
    });

    it( 'should stream bare strings when SSE validation succeeds', async () =>
    {
        // Arrange
        const registry = new ApplicationRegistry();
        registry.registerController( 'SseOkCtrl', {
            stream : async function *()
            {
                yield 'ping';
            }
        });
        const meta = createEndpoint({
            controller          : 'SseOkCtrl',
            methodName          : 'stream',
            meta                : { sse : true },
            returnTypeValidator : ( v: unknown ) => v
        });

        // Act
        const res = await runWithRegistry( registry, () =>
            RequestProcessor.execute( meta, createRequest({})));

        // Assert
        expect( await res.text()).toBe( 'data: ping\n\n' );
    });

    it( 'should accept a ReadableStream body for SSE endpoints', async () =>
    {
        // Arrange — Node ReadableStream is also async-iterable; clear that so the
        // instanceof ReadableStream branch is taken instead of formatSseChunk.
        const registry = new ApplicationRegistry();
        const stream = new ReadableStream({
            start( controller )
            {
                controller.enqueue( new TextEncoder().encode( 'data: from-stream\n\n' ));
                controller.close();
            }
        });
        Object.defineProperty( stream, Symbol.asyncIterator, { value : undefined });
        registry.registerController( 'SseStreamCtrl', {
            stream : () => stream
        });
        const meta = createEndpoint({
            controller : 'SseStreamCtrl',
            methodName : 'stream',
            meta       : { sse : true }
        });

        // Act
        const res = await runWithRegistry( registry, () =>
            RequestProcessor.execute( meta, createRequest({})));

        // Assert
        expect( res.headers.get( 'Content-Type' )).toBe( 'text/event-stream' );
        expect( await res.text()).toBe( 'data: from-stream\n\n' );
    });

    it( 'should accept a raw non-stream body for SSE endpoints', async () =>
    {
        // Arrange
        const registry = new ApplicationRegistry();
        registry.registerController( 'SseRawCtrl', {
            stream : () => 'data: already-formatted\n\n'
        });
        const meta = createEndpoint({
            controller : 'SseRawCtrl',
            methodName : 'stream',
            meta       : { sse : true }
        });

        // Act
        const res = await runWithRegistry( registry, () =>
            RequestProcessor.execute( meta, createRequest({})));

        // Assert
        expect( await res.text()).toBe( 'data: already-formatted\n\n' );
    });
});

describe( 'RequestProcessor.execute middleware and guards', () =>
{
    beforeEach(() =>
    {
        vi.clearAllMocks();
    });

    it( 'should throw when middleware resolves to a falsy instance', async () =>
    {
        // Arrange
        const registry = new ApplicationRegistry();
        registry.registerController( 'MwCtrl', { ok : () => 'ok' });
        registry.registerProvider( 'MissingMw', { useValue : null });
        const meta = createEndpoint({
            controller  : 'MwCtrl',
            methodName  : 'ok',
            middlewares : [ 'MissingMw' ]
        });

        // Act
        const res = await runWithRegistry( registry, () =>
            RequestProcessor.execute( meta, createRequest({})));

        // Assert — thrown Error is mapped to a 500 JSON response
        expect( res.status ).toBe( 500 );
        expect( await res.json()).toMatchObject({
            success : false,
            error   : 'Middleware MissingMw not registered'
        });
    });

    it( 'should reject when useCallback middleware calls next(error)', async () =>
    {
        // Arrange
        const registry = new ApplicationRegistry();
        registry.registerController( 'MwCtrl', { ok : () => 'ok' });
        registry.registerProvider( 'CbErrMw', {
            useCallback : ( _req: unknown, _res: unknown, next: ( error?: unknown ) => void ) =>
            {
                next( Object.assign( new Error( 'cb failed' ), { status : 418 }));
            }
        });
        const meta = createEndpoint({
            controller  : 'MwCtrl',
            methodName  : 'ok',
            middlewares : [ 'CbErrMw' ]
        });

        // Act
        const res = await runWithRegistry( registry, () =>
            RequestProcessor.execute( meta, createRequest({})));

        // Assert
        expect( res.status ).toBe( 418 );
        expect( await res.json()).toMatchObject({ success : false, error : 'cb failed' });
    });

    it( 'should reject when useCallback middleware throws synchronously', async () =>
    {
        // Arrange
        const registry = new ApplicationRegistry();
        registry.registerController( 'MwCtrl', { ok : () => 'ok' });
        registry.registerProvider( 'CbThrowMw', {
            useCallback : () =>
            {
                throw Object.assign( new Error( 'sync mw boom' ), { status : 503 });
            }
        });
        const meta = createEndpoint({
            controller  : 'MwCtrl',
            methodName  : 'ok',
            middlewares : [ 'CbThrowMw' ]
        });

        // Act
        const res = await runWithRegistry( registry, () =>
            RequestProcessor.execute( meta, createRequest({})));

        // Assert
        expect( res.status ).toBe( 503 );
        expect( await res.json()).toMatchObject({ success : false, error : 'sync mw boom' });
    });

    it( 'should return a Response thrown by a guard', async () =>
    {
        // Arrange
        const registry = new ApplicationRegistry();
        registry.registerController( 'GuardCtrl', { ok : () => 'ok' });
        registry.registerGuard( 'DenyGuard', {
            use : () =>
            {
                throw new Response( 'denied', { status : 403 });
            }
        });
        const meta = createEndpoint({
            controller : 'GuardCtrl',
            methodName : 'ok',
            guards     : [{
                type      : 'class',
                name      : 'DenyGuard',
                resolvers : [],
                params    : [],
                isAsync   : false
            }]
        });

        // Act
        const res = await runWithRegistry( registry, () =>
            RequestProcessor.execute( meta, createRequest({})));

        // Assert
        expect( res.status ).toBe( 403 );
        expect( await res.text()).toBe( 'denied' );
    });
});

describe( 'RequestProcessor.runWs / executeWs', () =>
{
    beforeEach(() =>
    {
        vi.clearAllMocks();
    });

    it( 'should close with 1011 when runWs executeWs fails for a missing controller', async () =>
    {
        // Arrange
        const registry = new ApplicationRegistry();
        const ws = createWsMock();
        const meta = createEndpoint({
            controller : 'MissingWsCtrl',
            methodName : 'handle',
            httpMethod : 'WS',
            meta       : { ws : true }
        });

        // Act
        runWithRegistry( registry, () =>
            RequestProcessor.runWs( meta, ws, createRequest({})));

        // Assert — resolve throws before the explicit !controller check
        await vi.waitFor(() =>
        {
            expect( ws.close ).toHaveBeenCalledWith(
                1011,
                'No provider registered for token: MissingWsCtrl'
            );
        });
    });

    it( 'should ignore secondary close failures in runWs catch', async () =>
    {
        // Arrange
        const registry = new ApplicationRegistry();
        const ws = createWsMock();
        ws.close.mockImplementation(() =>
        {
            throw new Error( 'close failed' );
        });
        const meta = createEndpoint({
            controller : 'MissingWsCtrl',
            methodName : 'handle',
            httpMethod : 'WS'
        });

        // Act / Assert — must not surface as an unhandled rejection
        await expect( runWithRegistry( registry, async () =>
        {
            RequestProcessor.runWs( meta, ws, createRequest({}));
            await vi.waitFor(() =>
            {
                expect( ws.close ).toHaveBeenCalled();
            });
        })).resolves.toBeUndefined();
    });

    it( 'should close with 4000 when executeWs param validation fails', async () =>
    {
        // Arrange
        const registry = new ApplicationRegistry();
        registry.registerController( 'WsCtrl', { handle : vi.fn() });
        const ws = createWsMock();
        const meta = createEndpoint({
            controller : 'WsCtrl',
            methodName : 'handle',
            httpMethod : 'WS',
            params     : [{
                source    : 'Query',
                name      : 'id',
                validator : ( _v: unknown, path: string, ctx: { success: boolean, errors: unknown[] }) =>
                {
                    ctx.success = false;
                    ctx.errors.push({ path, message : 'invalid' });

                    return _v;
                }
            }]
        });
        const req = createRequest({ query : { id : 'x' } });

        // Act
        await runWithRegistry( registry, () => RequestProcessor.executeWs( meta, ws, req ));

        // Assert
        expect( ws.close ).toHaveBeenCalledWith(
            4000,
            JSON.stringify({
                success : false,
                message : 'request validation failed',
                errors  : [{ path : 'id', message : 'invalid' }]
            })
        );
    });

    it( 'should close with 4001 when the WS handler throws', async () =>
    {
        // Arrange
        const registry = new ApplicationRegistry();
        registry.registerController( 'WsCtrl', {
            handle : () =>
            {
                throw new Error( 'handler boom' );
            }
        });
        const ws = createWsMock();
        const meta = createEndpoint({
            controller : 'WsCtrl',
            methodName : 'handle',
            httpMethod : 'WS'
        });

        // Act
        await runWithRegistry( registry, () =>
            RequestProcessor.executeWs( meta, ws, createRequest({})));

        // Assert
        expect( ws.close ).toHaveBeenCalledWith( 4001, 'handler boom' );
    });

    it( 'should ignore secondary close failures when the WS handler throws', async () =>
    {
        // Arrange
        const registry = new ApplicationRegistry();
        registry.registerController( 'WsCtrl', {
            handle : () =>
            {
                throw new Error( 'handler boom' );
            }
        });
        const ws = createWsMock();
        ws.close.mockImplementation(() =>
        {
            throw new Error( 'close failed' );
        });
        const meta = createEndpoint({
            controller : 'WsCtrl',
            methodName : 'handle',
            httpMethod : 'WS'
        });

        // Act / Assert
        await expect( runWithRegistry( registry, () =>
            RequestProcessor.executeWs( meta, ws, createRequest({}))))
            .resolves.toBeUndefined();
        expect( ws.close ).toHaveBeenCalledWith( 4001, 'handler boom' );
    });
});

describe( 'RequestProcessor.executeRpc', () =>
{
    beforeEach(() =>
    {
        vi.clearAllMocks();
    });

    it( 'should resolve class guard Request/Body/Param args and fallback resolvers', async () =>
    {
        // Arrange
        const registry = new ApplicationRegistry();
        const seen: unknown[] = [];
        registry.registerController( 'RpcCtrl', {
            run : () => ({ ok : true })
        });
        registry.registerGuard( 'RpcGuard', {
            use : ( req: unknown, body: unknown, id: unknown, token: unknown ) =>
            {
                seen.push( req, body, id, token );
            }
        });
        const meta = createEndpoint({
            controller : 'RpcCtrl',
            methodName : 'run',
            httpMethod : 'RPC',
            path       : 'rpc.run',
            guards     : [{
                type      : 'class',
                name      : 'RpcGuard',
                resolvers : [ 'fallback-token' ],
                params    : [
                    { source : 'Request' },
                    { source : 'Body' },
                    { source : 'Param', name : 'id' },
                    { source : 'WebSocket' }
                ],
                isAsync   : false
            }]
        });

        // Act
        const result = await runWithRegistry( registry, () =>
            RequestProcessor.executeRpc( meta, { n : 1 }));

        // Assert
        expect( result ).toEqual({ ok : true });
        expect( seen[0] ).toMatchObject({ _json : { n : 1 }, url : 'rpc://localhost/rpc.run' });
        expect( seen[1] ).toEqual({ n : 1 });
        expect( seen[2] ).toBeUndefined();
        expect( seen[3] ).toBe( 'fallback-token' );
    });

    it( 'should wrap the RPC handler with registered interceptors', async () =>
    {
        // Arrange
        const registry = new ApplicationRegistry();
        const order: string[] = [];
        registry.registerController( 'RpcCtrl', {
            run : () =>
            {
                order.push( 'handler' );

                return { ok : true };
            }
        });
        registry.registerInterceptor( 'RpcInt', {
            intercept : async ( _req: unknown, next: () => Promise<unknown> ) =>
            {
                order.push( 'before' );
                const value = await next();
                order.push( 'after' );

                return { ...( value as object ), via : 'interceptor' };
            }
        });
        const meta = createEndpoint({
            controller   : 'RpcCtrl',
            methodName   : 'run',
            httpMethod   : 'RPC',
            path         : 'rpc.int',
            interceptors : [ 'RpcInt' ]
        });

        // Act
        const result = await runWithRegistry( registry, () =>
            RequestProcessor.executeRpc( meta, {}));

        // Assert
        expect( result ).toEqual({ ok : true, via : 'interceptor' });
        expect( order ).toEqual([ 'before', 'handler', 'after' ]);
    });
});
