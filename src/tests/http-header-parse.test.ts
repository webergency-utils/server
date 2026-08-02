import { describe, it, expect, beforeEach } from 'vitest';
import
{
    parseHeaders,
    parseHeaderValue,
    parseHeaderValueParameter,
    parseContentDisposition,
    extractMultipartBoundary,
    clearHeaderValueCache
}
from '../helpers/http-header-parse.js';

describe( 'http-header-parse', () =>
{
    beforeEach(() => clearHeaderValueCache());

    it( 'parses folded headers', () =>
    {
        const headers = parseHeaders( 'Content-Type: text/plain\r\nContent-Disposition: form-data;\r\n name="x"\r\n\r\n' );

        expect( headers['content-type']).toBe( 'text/plain' );
        expect( headers['content-disposition']).toBe( 'form-data; name="x"' );
    });

    it( 'caches parseHeaderValue for repeated lookups', () =>
    {
        const value = 'form-data; name="avatar"; filename="a.png"';
        const a = parseHeaderValue( value );
        const b = parseHeaderValue( value );

        expect( a ).toBe( b );
        expect( parseHeaderValueParameter( value, 'name' )).toBe( 'avatar' );
        expect( parseHeaderValueParameter( value, 'filename' )).toBe( 'a.png' );
    });

    it( 'parseContentDisposition returns name and filename in one pass', () =>
    {
        expect( parseContentDisposition( 'form-data; name="f"; filename="x.txt"' )).toEqual({
            name     : 'f',
            filename : 'x.txt'
        });
        expect( parseContentDisposition( 'form-data; name="title"' )).toEqual({ name : 'title' });
    });

    it( 'extractMultipartBoundary handles common and quoted forms', () =>
    {
        expect( extractMultipartBoundary( 'multipart/form-data; boundary=----WebKit' ))
            .toBe( '----WebKit' );
        expect( extractMultipartBoundary( 'multipart/form-data; boundary="a b"' ))
            .toBe( 'a b' );
        expect( extractMultipartBoundary( 'application/json' )).toBeUndefined();
    });
});
