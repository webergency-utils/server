import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RequestProcessor } from '../core/request-processor.js';
import { validators } from '@webergency-utils/typechecker';
import type { AugmentedRequest, ParamMetadata } from '../core/types.js';

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
