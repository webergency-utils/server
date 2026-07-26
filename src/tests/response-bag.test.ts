import { describe, it, expect } from 'vitest';
import { ResponseBag } from '../core/types.js';

describe( 'ResponseBag', () =>
{
    it( 'should track status via status and statusCode aliases', () =>
    {
        // Arrange
        const bag = new ResponseBag();

        // Act
        expect( bag.statusSet ).toBe( false );
        bag.statusCode = 201;

        // Assert
        expect( bag.status ).toBe( 201 );
        expect( bag.statusCode ).toBe( 201 );
        expect( bag.statusSet ).toBe( true );
    });

    it( 'should merge status and headers when status was set', () =>
    {
        // Arrange
        const bag = new ResponseBag();
        bag.status = 201;
        bag.headers.set( 'X-A', '1' );
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
        bag.headers.set( 'X-A', '1' );
        const base = new Response( 'ok', { status : 200 });

        // Act
        const out = bag.applyTo( base );

        // Assert
        expect( out ).toBe( base );
        expect( out.status ).toBe( 200 );
        expect( out.headers.get( 'X-A' )).toBe( '1' );
    });
});
