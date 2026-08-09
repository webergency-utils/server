import { describe, it, expect } from 'vitest';
import { ResponseBag, ServerResponse, isSeoForward, ForwardIntent } from '../src/core/types.js';

describe( 'ResponseBag / ServerResponse', () =>
{
    it( 'should track status via chainable status()', () =>
    {
        // Arrange
        const bag = new ResponseBag();

        // Act
        expect( bag.statusSet ).toBe( false );
        bag.status( 201 );

        // Assert
        expect( bag.status()).toBe( 201 );
        expect( bag.statusSet ).toBe( true );
    });

    it( 'should merge status and headers when status was set', () =>
    {
        // Arrange
        const bag = new ResponseBag();
        bag.status( 201 ).header( 'X-A', '1' );
        const base = new Response( 'body', { status : 200, headers : { 'X-B' : '2' } });

        // Act
        const out = bag.applyTo( base );

        // Assert
        expect( out.status ).toBe( 201 );
        expect( out.headers.get( 'X-A' )).toBe( '1' );
        expect( out.headers.get( 'X-B' )).toBe( '2' );
    });

    it( 'should mutate headers in place when status was not set', () =>
    {
        // Arrange
        const bag = new ResponseBag();
        bag.header( 'X-A', '1' );
        const base = new Response( 'ok', { status : 200 });

        // Act
        const out = bag.applyTo( base );

        // Assert
        expect( out ).toBe( base );
        expect( out.status ).toBe( 200 );
        expect( out.headers.get( 'X-A' )).toBe( '1' );
    });

    it( 'should chain header headers cookie and status', () =>
    {
        const res = new ServerResponse()
            .status( 201 )
            .header( 'X-One', '1' )
            .headers({ 'X-Two' : '2', 'X-Three' : '3' })
            .cookie( 'sid', 'abc', { httpOnly : true });

        const out = res.applyTo( new Response( 'ok' ));

        expect( out.status ).toBe( 201 );
        expect( out.headers.get( 'X-One' )).toBe( '1' );
        expect( out.headers.get( 'X-Two' )).toBe( '2' );
        expect( out.headers.get( 'Set-Cookie' )).toContain( 'sid=abc' );
    });

    it( 'should accept optional statusText', () =>
    {
        const bag = new ServerResponse().status( 451, 'Unavailable For Legal Reasons' );
        const out = bag.applyTo( new Response( 'blocked' ));

        expect( out.status ).toBe( 451 );
        expect( out.statusText ).toBe( 'Unavailable For Legal Reasons' );
    });

    it( 'should clear cookies and serialize full cookie option set', () =>
    {
        // Arrange
        const res = new ServerResponse()
            .cookie( 'gone', null, { path : '/' })
            .cookie( 'empty', '', { path : '/' })
            .cookie( 'full', 'v', {
                maxAge   : 12.9,
                expires  : new Date( '2030-01-01T00:00:00.000Z' ),
                path     : '/app',
                domain   : 'example.com',
                secure   : true,
                httpOnly : true,
                sameSite : 'Strict'
            });

        // Act
        const out = res.toResponse();
        const cookies = out.headers.getSetCookie?.() ?? [ out.headers.get( 'Set-Cookie' )! ];

        // Assert
        expect( cookies.some( c => c.includes( 'gone=' ) && c.includes( 'Max-Age=0' ))).toBe( true );
        expect( cookies.some( c => c.includes( 'empty=' ) && c.includes( 'Max-Age=0' ))).toBe( true );
        expect( cookies.some( c =>
            c.includes( 'full=v' )
            && c.includes( 'Max-Age=12' )
            && c.includes( 'Expires=' )
            && c.includes( 'Path=/app' )
            && c.includes( 'Domain=example.com' )
            && c.includes( 'Secure' )
            && c.includes( 'HttpOnly' )
            && c.includes( 'SameSite=Strict' )
        )).toBe( true );
    });

    it( 'should finalize null stream body as empty Response', () =>
    {
        // Arrange
        const res = new ServerResponse().status( 204 ).stream( null as unknown as BodyInit );

        // Act
        const out = res.toResponse();

        // Assert
        expect( out.status ).toBe( 204 );
        expect( out.body ).toBeNull();
    });

    it( 'should serialize a cookie without options and reject invalid SeoForward shapes', () =>
    {
        // Arrange / Act
        const plain = new ServerResponse().cookie( 'a', 'b' ).toResponse();
        const intent = new ForwardIntent({ method : 'GET', path : '/x' });

        // Assert
        expect( plain.headers.get( 'Set-Cookie' )).toBe( 'a=b' );
        expect( intent.name ).toBe( 'ForwardIntent' );
        expect( isSeoForward( null )).toBe( false );
        expect( isSeoForward( { method : 'GET' } )).toBe( false );
        expect( isSeoForward( { method : 'GET', path : '/x', query : [] } )).toBe( false );
        expect( isSeoForward( { method : 'GET', path : '/x', query : null } )).toBe( false );
        expect( isSeoForward( { method : 'GET', path : '/x', body : [] } )).toBe( false );
        expect( isSeoForward( { method : 'GET', path : '/x', body : null } )).toBe( false );
        expect( isSeoForward( { method : 'GET', path : '/x', query : { a : '1' }, body : { b : 2 } })).toBe( true );
    });
});
