import { describe, it, expect } from 'vitest';
import { ServerRequest } from '../core/server-request.js';
import { ServerResponse, ResponseBag } from '../core/types.js';
import type { AugmentedRequest } from '../core/types.js';

function createAugmented( init: RequestInit & { url?: string } = {}): AugmentedRequest
{
    const url = init.url || 'https://api.example.com/v1/items?q=1';
    const req = new Request( url, {
        method  : init.method || 'GET',
        headers : init.headers,
        body    : init.body
    }) as AugmentedRequest;
    req.params = {};
    req.query = { q : '1' };
    req.meta = {};
    req.remoteAddress = '127.0.0.1';

    return req;
}

describe( 'ServerRequest', () =>
{
    it( 'should expose string bags and identity fields without Fetch leak', () =>
    {
        const raw = createAugmented({
            headers : { cookie : 'a=1; b=2', 'x-test' : 'yes' }
        });
        const req = new ServerRequest( raw );

        expect( req ).toBeInstanceOf( ServerRequest );
        expect( req instanceof Request ).toBe( false );
        expect( req.method ).toBe( 'GET' );
        expect( req.path ).toBe( '/v1/items' );
        expect( req.hostname ).toBe( 'api.example.com' );
        expect( req.query ).toEqual({ q : '1' });
        expect( req.cookies ).toEqual({ a : '1', b : '2' });
        expect( req.headers['x-test']).toBe( 'yes' );
        expect( req.ip ).toBe( '127.0.0.1' );
    });

    it( 'should keep cookie/header bags as strings when copies are mutated', () =>
    {
        const raw = createAugmented({ headers : { cookie : 'age=28' } });
        const req = new ServerRequest( raw );
        const cookies = { ...req.cookies };
        ( cookies as any ).age = 99;

        expect( req.cookies.age ).toBe( '28' );
    });

    it( 'should read rawBody and text under the shared body cache', async () =>
    {
        const raw = createAugmented({
            method  : 'POST',
            headers : { 'content-type' : 'text/plain' },
            body    : 'hello'
        });
        const req = new ServerRequest( raw, { maxBodySize : '1mb' });
        const buf = await req.rawBody();

        expect( new TextDecoder().decode( buf )).toBe( 'hello' );
        expect( await req.text()).toBe( 'hello' );
    });

    it( 'should reject stream after buffered body read', async () =>
    {
        const raw = createAugmented({
            method  : 'POST',
            headers : { 'content-type' : 'application/octet-stream' },
            body    : 'x'
        });
        const req = new ServerRequest( raw );
        await req.rawBody();

        expect(() => req.stream()).toThrow( /already consumed/ );
    });
});

describe( 'ServerResponse', () =>
{
    it( 'should alias ResponseBag to ServerResponse', () =>
    {
        expect( new ResponseBag()).toBeInstanceOf( ServerResponse );
    });

    it( 'should set cookies and redirect', () =>
    {
        const res = new ServerResponse();
        res.cookie( 'sid', 'abc', { httpOnly : true, path : '/', sameSite : 'Lax' });
        res.redirect( 303, '/next' );

        const out = res.applyTo( new Response( '' ));

        expect( out.status ).toBe( 303 );
        expect( out.headers.get( 'Location' )).toBe( '/next' );
        expect( out.headers.get( 'Set-Cookie' )).toContain( 'sid=abc' );
        expect( out.headers.get( 'Set-Cookie' )).toContain( 'HttpOnly' );
        expect( out.headers.get( 'Set-Cookie' )).toContain( 'SameSite=Lax' );
    });

    it( 'should stash forward without Location', () =>
    {
        const res = new ServerResponse();
        res.forward({ method : 'GET', path : '/posts/1', query : { x : '1' } });

        expect( res.pendingForward ).toEqual({ method : 'GET', path : '/posts/1', query : { x : '1' } });
        expect( res.toResponse().headers.get( 'Location' )).toBeNull();
    });
});
