import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Server } from '../../src/server.js';
import { compileFixture, loadCompiledApp, allocatePort, httpJson } from './compile.js';

describe( 'E2E webergency-tsc HTTP parse', () =>
{
    let server: Server;
    let base: string;

    beforeAll( async () =>
    {
        compileFixture();
        const { AppModule } = await loadCompiledApp();
        const port = await allocatePort();
        server = new Server({
            port,
            module : AppModule,
            cors   : { origin : [ 'http://localhost:5173' ], credentials : true }
        });
        await server.start();
        base = `http://127.0.0.1:${port}`;
    }, 60_000 );

    afterAll( async () =>
    {
        await server?.shutdown();
    });

    describe( 'named @Query string', () =>
    {
        it( 'should return a present apiKey query value', async () =>
        {
            const res = await httpJson( base, '/parse/api-key?apiKey=secret' );

            expect( res.status, res.raw ).toBe( 200 );
            expect( res.body.apiKey ).toBe( 'secret' );
            expect( res.body.present ).toBe( true );
        });

        it( 'should accept an optional apiKey when the query key is omitted', async () =>
        {
            const res = await httpJson( base, '/parse/api-key' );

            expect( res.status, res.raw ).toBe( 200 );
            expect( res.body.present ).toBe( false );
            expect( res.body.apiKey == null ).toBe( true );
        });

        it( 'should treat an empty apiKey as an empty string, not missing', async () =>
        {
            const res = await httpJson( base, '/parse/api-key?apiKey=' );

            expect( res.status, res.raw ).toBe( 200 );
            expect( res.body.apiKey ).toBe( '' );
            expect( res.body.present ).toBe( true );
        });

        it( 'should decode a percent-encoded apiKey', async () =>
        {
            const res = await httpJson( base, '/parse/api-key?apiKey=hello%20world' );

            expect( res.status, res.raw ).toBe( 200 );
            expect( res.body.apiKey ).toBe( 'hello world' );
        });

        it( 'should reject a missing required apiKey with Type<string>', async () =>
        {
            const res = await httpJson( base, '/parse/api-key-required' );

            expect( res.status, res.raw ).toBe( 400 );
            expect( res.body.success ).toBe( false );
            expect( res.body.message ).toBe( 'request validation failed' );
            expect( res.body.errors ).toEqual(
                expect.arrayContaining([ expect.objectContaining({ path : 'apiKey', error : 'Type<string>' }) ])
            );
        });

        it( 'should accept a required apiKey when present', async () =>
        {
            const res = await httpJson( base, '/parse/api-key-required?apiKey=k' );

            expect( res.status, res.raw ).toBe( 200 );
            expect( res.body.apiKey ).toBe( 'k' );
        });
    });

    describe( '@Query() object bag', () =>
    {
        it( 'should parse optional bag fields from the query string', async () =>
        {
            const res = await httpJson( base, '/parse/search?apiKey=k&page=2&active=true' );

            expect( res.status, res.raw ).toBe( 200 );
            expect( res.body ).toEqual({ apiKey : 'k', page : 2, active : true });
        });

        it( 'should allow an empty optional search bag', async () =>
        {
            const res = await httpJson( base, '/parse/search' );

            expect( res.status, res.raw ).toBe( 200 );
            expect( res.body ).toEqual({});
        });
    });

    describe( 'coerced named query params', () =>
    {
        it( 'should coerce page, active, and repeated tags', async () =>
        {
            const res = await httpJson( base, '/parse/mixed?page=3&active=false&tags=a&tags=b' );

            expect( res.status, res.raw ).toBe( 200 );
            expect( res.body.page ).toBe( 3 );
            expect( res.body.active ).toBe( false );
            expect( res.body.tags ).toEqual([ 'a', 'b' ]);
        });

        it( 'should omit optional coerced params when they are absent', async () =>
        {
            const res = await httpJson( base, '/parse/mixed' );

            expect( res.status, res.raw ).toBe( 200 );
            expect( res.body.page == null ).toBe( true );
            expect( res.body.active == null ).toBe( true );
            expect( res.body.tags == null ).toBe( true );
        });

        it( 'should reject a non-numeric page', async () =>
        {
            const res = await httpJson( base, '/parse/mixed?page=nope' );

            expect( res.status, res.raw ).toBe( 400 );
            expect( res.body.success ).toBe( false );
        });
    });

    describe( 'param / header alongside query', () =>
    {
        it( 'should bind path, optional query, and optional header together', async () =>
        {
            const res = await httpJson( base, '/parse/echo/abc?flag=on', {
                headers : { 'x-token' : 'tok' }
            });

            expect( res.status, res.raw ).toBe( 200 );
            expect( res.body ).toEqual({ id : 'abc', flag : 'on', token : 'tok' });
        });

        it( 'should allow omitted optional header and query', async () =>
        {
            const res = await httpJson( base, '/parse/echo/abc' );

            expect( res.status, res.raw ).toBe( 200 );
            expect( res.body.id ).toBe( 'abc' );
            expect( res.body.flag == null ).toBe( true );
            expect( res.body.token == null ).toBe( true );
        });
    });

    describe( 'JSON body', () =>
    {
        it( 'should parse a matching JSON body', async () =>
        {
            const res = await httpJson( base, '/parse/json', {
                method  : 'POST',
                headers : { 'Content-Type' : 'application/json' },
                body    : JSON.stringify({ name : 'Ada', age : 36, extra : 'drop' })
            });

            expect( res.status, res.raw ).toBe( 200 );
            expect( res.body ).toEqual({ name : 'Ada', age : 36 });
        });

        it( 'should allow omitting optional JSON fields', async () =>
        {
            const res = await httpJson( base, '/parse/json', {
                method  : 'POST',
                headers : { 'Content-Type' : 'application/json' },
                body    : JSON.stringify({ name : 'Ada' })
            });

            expect( res.status, res.raw ).toBe( 200 );
            expect( res.body ).toEqual({ name : 'Ada' });
        });

        it( 'should reject JSON missing a required field', async () =>
        {
            const res = await httpJson( base, '/parse/json', {
                method  : 'POST',
                headers : { 'Content-Type' : 'application/json' },
                body    : JSON.stringify({ age : 1 })
            });

            expect( res.status, res.raw ).toBe( 400 );
            expect( res.body.success ).toBe( false );
        });

        it( 'should reject extra properties in strict JSON body mode', async () =>
        {
            const res = await httpJson( base, '/parse/json-strict', {
                method  : 'POST',
                headers : { 'Content-Type' : 'application/json' },
                body    : JSON.stringify({ name : 'Ada', extra : 1 })
            });

            expect( res.status, res.raw ).toBe( 400 );
            expect( res.body.success ).toBe( false );
            expect( res.body.errors ).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ error : expect.stringMatching( /PropertyNotAllowed/ ) })
                ])
            );
        });

        it( 'should parse JSON despite a charset parameter on Content-Type', async () =>
        {
            const res = await httpJson( base, '/parse/json', {
                method  : 'POST',
                headers : { 'Content-Type' : 'application/json; charset=utf-8' },
                body    : JSON.stringify({ name : 'Ada' })
            });

            expect( res.status, res.raw ).toBe( 200 );
            expect( res.body.name ).toBe( 'Ada' );
        });
    });

    describe( 'urlencoded body', () =>
    {
        it( 'should parse application/x-www-form-urlencoded the same as query', async () =>
        {
            const res = await httpJson( base, '/parse/form', {
                method  : 'POST',
                headers : { 'Content-Type' : 'application/x-www-form-urlencoded' },
                body    : 'name=Ada&age=36&tags=a&tags=b'
            });

            expect( res.status, res.raw ).toBe( 200 );
            expect( res.body ).toEqual({ name : 'Ada', age : 36, tags : [ 'a', 'b' ] });
        });

        it( 'should reject urlencoded missing required name', async () =>
        {
            const res = await httpJson( base, '/parse/form', {
                method  : 'POST',
                headers : { 'Content-Type' : 'application/x-www-form-urlencoded' },
                body    : 'age=1'
            });

            expect( res.status, res.raw ).toBe( 400 );
            expect( res.body.success ).toBe( false );
        });
    });

    describe( 'nested / union / array JSON bodies', () =>
    {
        it( 'should parse a nested JSON object and strip extras', async () =>
        {
            const res = await httpJson( base, '/parse/nested', {
                method  : 'POST',
                headers : { 'Content-Type' : 'application/json' },
                body    : JSON.stringify({
                    user  : { name : 'Ada', age : 36, extra : 1 },
                    tags  : [ 'a', 'b' ],
                    extra : true
                })
            });

            expect( res.status, res.raw ).toBe( 200 );
            expect( res.body ).toEqual({ user : { name : 'Ada', age : 36 }, tags : [ 'a', 'b' ] });
        });

        it( 'should reject nested JSON missing required user.name', async () =>
        {
            const res = await httpJson( base, '/parse/nested', {
                method  : 'POST',
                headers : { 'Content-Type' : 'application/json' },
                body    : JSON.stringify({ user : { age : 1 }, tags : [] })
            });

            expect( res.status, res.raw ).toBe( 400 );
            expect( res.body.success ).toBe( false );
        });

        it( 'should discriminate a tagged union body', async () =>
        {
            const a = await httpJson( base, '/parse/union', {
                method  : 'POST',
                headers : { 'Content-Type' : 'application/json' },
                body    : JSON.stringify({ type : 'a', a : 'hi' })
            });
            const b = await httpJson( base, '/parse/union', {
                method  : 'POST',
                headers : { 'Content-Type' : 'application/json' },
                body    : JSON.stringify({ type : 'b', b : 2 })
            });

            expect( a.status, a.raw ).toBe( 200 );
            expect( a.body ).toEqual({ type : 'a', a : 'hi' });
            expect( b.status, b.raw ).toBe( 200 );
            expect( b.body ).toEqual({ type : 'b', b : 2 });
        });

        it( 'should reject a union body that matches neither arm', async () =>
        {
            const res = await httpJson( base, '/parse/union', {
                method  : 'POST',
                headers : { 'Content-Type' : 'application/json' },
                body    : JSON.stringify({ type : 'c', c : 1 })
            });

            expect( res.status, res.raw ).toBe( 400 );
            expect( res.body.success ).toBe( false );
        });

        it( 'should parse an array JSON body', async () =>
        {
            const res = await httpJson( base, '/parse/list', {
                method  : 'POST',
                headers : { 'Content-Type' : 'application/json' },
                body    : JSON.stringify([{ name : 'Ada' }, { name : 'Bob', age : 2 }])
            });

            expect( res.status, res.raw ).toBe( 200 );
            expect( res.body ).toEqual([{ name : 'Ada' }, { name : 'Bob', age : 2 }]);
        });
    });

    describe( 'query + body + param together', () =>
    {
        it( 'should bind path, optional boolean query, and JSON body', async () =>
        {
            const res = await httpJson( base, '/parse/submit/99?dry=true', {
                method  : 'POST',
                headers : { 'Content-Type' : 'application/json' },
                body    : JSON.stringify({ name : 'Ada', extra : 'x' })
            });

            expect( res.status, res.raw ).toBe( 200 );
            expect( res.body.id ).toBe( '99' );
            expect( res.body.dry ).toBe( true );
            expect( res.body.body ).toEqual({ name : 'Ada' });
        });

        it( 'should allow omitting optional dry while still requiring the body', async () =>
        {
            const res = await httpJson( base, '/parse/submit/1', {
                method  : 'POST',
                headers : { 'Content-Type' : 'application/json' },
                body    : JSON.stringify({ name : 'Ada' })
            });

            expect( res.status, res.raw ).toBe( 200 );
            expect( res.body.id ).toBe( '1' );
            expect( res.body.dry == null ).toBe( true );
            expect( res.body.body ).toEqual({ name : 'Ada' });
        });
    });

    describe( 'query unions, flags, nested bags', () =>
    {
        it( 'should accept a string-literal query union', async () =>
        {
            const ok = await httpJson( base, '/parse/status?s=active' );
            const bad = await httpJson( base, '/parse/status?s=nope' );

            expect( ok.status, ok.raw ).toBe( 200 );
            expect( ok.body.s ).toBe( 'active' );
            expect( bad.status, bad.raw ).toBe( 400 );
        });

        it( 'should parse nested bracket query keys', async () =>
        {
            const res = await httpJson( base, '/parse/nested-query?user[name]=Ada&q=hi' );

            expect( res.status, res.raw ).toBe( 200 );
            expect( res.body ).toEqual({ user : { name : 'Ada' }, q : 'hi' });
        });

        it( 'should coerce a boolean query flag without a value as true', async () =>
        {
            const res = await httpJson( base, '/parse/flag?on' );

            expect( res.status, res.raw ).toBe( 200 );
            expect( res.body.on ).toBe( true );
        });

        it( 'should parse tags[] bracket arrays on a named query', async () =>
        {
            const res = await httpJson( base, '/parse/mixed?tags[]=c&tags[]=d' );

            expect( res.status, res.raw ).toBe( 200 );
            expect( res.body.tags ).toEqual([ 'c', 'd' ]);
        });
    });

    describe( 'HTTP methods', () =>
    {
        it( 'should route GET PUT PATCH DELETE on the same path', async () =>
        {
            const get = await httpJson( base, '/http/item/7' );
            const put = await httpJson( base, '/http/item/7', { method : 'PUT' });
            const patch = await httpJson( base, '/http/item/7', { method : 'PATCH' });
            const del = await httpJson( base, '/http/item/7', { method : 'DELETE' });

            expect( get.body ).toEqual({ method : 'GET', id : '7' });
            expect( put.body ).toEqual({ method : 'PUT', id : '7' });
            expect( patch.body ).toEqual({ method : 'PATCH', id : '7' });
            expect( del.body ).toEqual({ method : 'DELETE', id : '7' });
        });

        it( 'should answer 404 for an unknown path', async () =>
        {
            const res = await httpJson( base, '/no-such-route' );

            expect( res.status ).toBe( 404 );
        });
    });

    describe( 'cookies, headers, raw body', () =>
    {
        it( 'should bind an optional cookie when present', async () =>
        {
            const res = await httpJson( base, '/http/cookie', {
                headers : { cookie : 'sid=abc' }
            });

            expect( res.status, res.raw ).toBe( 200 );
            expect( res.body.sid ).toBe( 'abc' );
            expect( res.body.present ).toBe( true );
        });

        it( 'should allow a missing optional cookie', async () =>
        {
            const res = await httpJson( base, '/http/cookie' );

            expect( res.status, res.raw ).toBe( 200 );
            expect( res.body.present ).toBe( false );
            expect( res.body.sid == null ).toBe( true );
        });

        it( 'should parse a Cookie header into a bag', async () =>
        {
            const res = await httpJson( base, '/http/cookies', {
                headers : { cookie : 'sid=abc; theme=dark' }
            });

            expect( res.status, res.raw ).toBe( 200 );
            expect( res.body.sid ).toBe( 'abc' );
            expect( res.body.theme ).toBe( 'dark' );
        });

        it( 'should expose request headers in the @Headers bag', async () =>
        {
            const res = await httpJson( base, '/http/headers', {
                headers : { 'x-token' : 'tok', accept : 'application/json' }
            });

            expect( res.status, res.raw ).toBe( 200 );
            expect( res.body.hasToken ).toBe( true );
            expect( String( res.body.accept )).toMatch( /json/ );
        });

        it( 'should return the raw POST body text', async () =>
        {
            const res = await httpJson( base, '/http/raw', {
                method  : 'POST',
                headers : { 'Content-Type' : 'text/plain' },
                body    : 'hello-raw'
            });

            expect( res.status, res.raw ).toBe( 200 );
            expect( res.body.raw ).toBe( 'hello-raw' );
            expect( res.body.bytes ).toBe( 9 );
        });
    });

    describe( 'guards', () =>
    {
        it( 'should reject a protected route without x-api-key', async () =>
        {
            const res = await httpJson( base, '/secure/ping' );

            expect( res.status ).toBe( 403 );
        });

        it( 'should allow a protected route with the correct key', async () =>
        {
            const res = await httpJson( base, '/secure/ping', {
                headers : { 'x-api-key' : 'ok' }
            });

            expect( res.status, res.raw ).toBe( 200 );
            expect( res.body ).toEqual({ ok : true });
        });

        it( 'should allow a @Public route without the guard header', async () =>
        {
            const res = await httpJson( base, '/secure/open' );

            expect( res.status, res.raw ).toBe( 200 );
            expect( res.body ).toEqual({ open : true });
        });
    });

    describe( 'CORS', () =>
    {
        it( 'should answer a preflight from an allowed origin', async () =>
        {
            const res = await httpJson( base, '/parse/json', {
                method  : 'OPTIONS',
                headers : {
                    Origin                             : 'http://localhost:5173',
                    'Access-Control-Request-Method'    : 'POST',
                    'Access-Control-Request-Headers'   : 'content-type'
                }
            });

            expect( res.status ).toBe( 204 );
            expect( res.headers.get( 'access-control-allow-origin' )).toBe( 'http://localhost:5173' );
        });

        it( 'should echo CORS on a simple GET from an allowed origin', async () =>
        {
            const res = await httpJson( base, '/parse/api-key?apiKey=k', {
                headers : { Origin : 'http://localhost:5173' }
            });

            expect( res.status, res.raw ).toBe( 200 );
            expect( res.headers.get( 'access-control-allow-origin' )).toBe( 'http://localhost:5173' );
        });
    });

    describe( 'SSE', () =>
    {
        it( 'should stream event-stream payloads over a real HTTP listen', async () =>
        {
            const res = await fetch( `${base}/http/sse` );

            expect( res.status ).toBe( 200 );
            expect( res.headers.get( 'content-type' )).toBe( 'text/event-stream' );
            const text = await res.text();
            expect( text ).toContain( 'event: tick' );
            expect( text ).toContain( '"n":1' );
            expect( text ).toContain( '"n":2' );
        });
    });
});
