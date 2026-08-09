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
from '../src/helpers/http-header-parse.js';

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

    it( 'keeps semicolons inside quoted parameter values', () =>
    {
        expect( parseHeaderValueParameter( 'form-data; name="a;b"; filename="x.txt"', 'name' ))
            .toBe( 'a;b' );
        expect( parseHeaderValueParameter( 'form-data; name="a;b"; filename="x.txt"', 'filename' ))
            .toBe( 'x.txt' );
    });

    it( 'rejects adversarial quote/semicolon spam in linear time', () =>
    {
        const attacks =
        [
            `${'"a'.repeat( 25_000 )};`,
            `${'";'.repeat( 25_000 )}`,
            `token; ${'='.repeat( 50_000 )}`
        ];

        for( const attack of attacks )
        {
            const started = Date.now();

            try
            {
                parseHeaderValue( attack );
            }
            catch
            {
                // Malformed quoted values may throw from JSON.parse; timing still matters.
            }

            expect( Date.now() - started ).toBeLessThan( 500 );
        }
    });

    it( 'unescapes quoted values and skips empty/trailing parts', () =>
    {
        expect( parseHeaderValue( 'form-data; name="a\\"b"' )).toEqual([
            'form-data',
            { name : 'a"b' }
        ]);
        expect( parseHeaderValue( '  ;  ; token  ' )).toEqual([ 'token' ]);
        expect( parseHeaderValueParameter( undefined, 'name' )).toBeUndefined();
        expect( parseHeaderValueParameter( 'form-data', 'missing' )).toBeUndefined();
    });

    it( 'parseContentDisposition skips non-object tokens and undefined input', () =>
    {
        expect( parseContentDisposition( undefined )).toEqual({});
        expect( parseContentDisposition( 'inline' )).toEqual({});
        expect( parseContentDisposition( 'form-data; filename="a"; name="b"; filename="c"' ))
            .toEqual({ name : 'b', filename : 'a' });
    });

    it( 'extractMultipartBoundary rejects non-multipart and empty boundary', () =>
    {
        expect( extractMultipartBoundary( null )).toBeUndefined();
        expect( extractMultipartBoundary( undefined )).toBeUndefined();
        expect( extractMultipartBoundary( 'no-slash' )).toBeUndefined();
        expect( extractMultipartBoundary( 'text/plain' )).toBeUndefined();
        expect( extractMultipartBoundary( 'multi/form-data; boundary=x' )).toBeUndefined();
        expect( extractMultipartBoundary( 'multipart/form-data' )).toBeUndefined();
        expect( extractMultipartBoundary( 'multipart/form-data; boundary=' )).toBeUndefined();
        expect( extractMultipartBoundary( 'multipart/form-data; boundary=ab; charset=utf-8' ))
            .toBe( 'ab' );
        expect( extractMultipartBoundary( 'multipart/form-data; boundary=ab\tdef' )).toBe( 'ab' );
        expect( extractMultipartBoundary( 'Multipart/mixed; boundary="q bound"' )).toBe( 'q bound' );
    });

    it( 'covers splitParameter empty key/value and escaped keys', () =>
    {
        // Arrange / Act / Assert
        expect( parseHeaderValue( 'form-data;   ' )).toEqual([ 'form-data' ]);
        expect( parseHeaderValueParameter( 'form-data; name=', 'name' )).toBeUndefined();
        expect( parseHeaderValueParameter( 'form-data; =value', 'name' )).toBeUndefined();
        expect( parseHeaderValueParameter( 'form-data; name=   ', 'name' )).toBeUndefined();
        expect( parseHeaderValueParameter( 'form-data; name = x', 'name' )).toBe( 'x' );
        expect( parseHeaderValueParameter( 'form-data; "k\\"ey"="v\\"al"', 'k"ey' )).toBe( 'v"al' );
    });
});
