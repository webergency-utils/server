import { describe, it, expect } from 'vitest';
import { ResponseBag, ServerResponse } from '../src/core/types.js';

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
});
