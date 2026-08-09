import { describe, it, expect } from 'vitest';
import { Readable } from 'node:stream';
import { isNodeReadable, toStreamOrBinaryBody, isBinaryOrStreamBody } from '../src/helpers/response-body.js';

describe( 'response-body helpers', () =>
{
    it( 'should classify Node and duck-typed readables', () =>
    {
        // Arrange
        const node = Readable.from([ 'x' ]);
        const duck =
        {
            pipe     : () => duck,
            on       : () => duck,
            read     : () => null,
            readable : true
        };
        const web = new ReadableStream();

        // Assert
        expect( isNodeReadable( null )).toBe( false );
        expect( isNodeReadable( node )).toBe( true );
        expect( isNodeReadable( duck )).toBe( true );
        expect( isNodeReadable( web )).toBe( false );
        expect( isNodeReadable({})).toBe( false );
    });

    it( 'should convert Blob, ArrayBuffer, views, streams, and Node readables', async () =>
    {
        // Arrange / Act / Assert
        expect( toStreamOrBinaryBody( null )).toBeUndefined();
        expect( toStreamOrBinaryBody( 'text' )).toBeUndefined();
        expect( isBinaryOrStreamBody( 'text' )).toBe( false );

        const blob = new Blob([ 'hi' ]);
        expect( toStreamOrBinaryBody( blob )).toBe( blob );

        const ab = new TextEncoder().encode( 'ab' ).buffer;
        expect( toStreamOrBinaryBody( ab )).toBe( ab );

        const view = new Uint8Array([ 9 ]);
        expect( toStreamOrBinaryBody( view )).toBe( view );
        expect( isBinaryOrStreamBody( view )).toBe( true );

        const web = new ReadableStream();
        expect( toStreamOrBinaryBody( web )).toBe( web );

        const nodeBody = toStreamOrBinaryBody( Readable.from([ Buffer.from( 'n' )]));
        expect( nodeBody ).toBeInstanceOf( ReadableStream );
        expect( await new Response( nodeBody ).text()).toBe( 'n' );
    });
});
