import { describe, it, expect } from 'vitest';
import { joinQueryStrings, pathnameFromUrl, queryStringFromBag, queryStringFromUrl } from '../src/helpers/query-string.js';

describe( 'queryStringFromUrl', () =>
{
    it( 'should strip a leading ? from an absolute URL', () =>
    {
        expect( queryStringFromUrl( 'http://localhost/search?q=ada&page=1' )).toBe( 'q=ada&page=1' );
    });

    it( 'should strip a leading ? from a path+query IncomingMessage url', () =>
    {
        expect( queryStringFromUrl( '/status?name=ryan' )).toBe( 'name=ryan' );
    });

    it( 'should return empty when there is no query', () =>
    {
        expect( queryStringFromUrl( 'http://localhost/ws' )).toBe( '' );
        expect( queryStringFromUrl( '/ws' )).toBe( '' );
    });

    it( 'should drop a fragment after the query', () =>
    {
        expect( queryStringFromUrl( 'http://localhost/x?a=1#frag' )).toBe( 'a=1' );
    });
});

describe( 'pathnameFromUrl', () =>
{
    it( 'should extract pathname from full URLs and origin-relative URLs without new URL()', () =>
    {
        expect( pathnameFromUrl( 'http://localhost:3000/users/42?expand=1#top' )).toBe( '/users/42' );
        expect( pathnameFromUrl( 'https://example.com' )).toBe( '/' );
        expect( pathnameFromUrl( 'https://example.com?foo=bar' )).toBe( '/' );
        expect( pathnameFromUrl( '/api/v1/items?page=2' )).toBe( '/api/v1/items' );
        expect( pathnameFromUrl( '/api/v1/items#section' )).toBe( '/api/v1/items' );
        expect( pathnameFromUrl( '' )).toBe( '/' );
    });
});

describe( 'joinQueryStrings', () =>
{
    it( 'should join, skip empty sides, and never emit a leading ?', () =>
    {
        expect( joinQueryStrings( 'a=1', 'src=seo' )).toBe( 'a=1&src=seo' );
        expect( joinQueryStrings( '', 'src=seo' )).toBe( 'src=seo' );
        expect( joinQueryStrings( 'a=1', '' )).toBe( 'a=1' );
    });
});

describe( 'queryStringFromBag', () =>
{
    it( 'should serialize scalars, arrays, and flag keys without URLSearchParams', () =>
    {
        expect( queryStringFromBag({ src : 'seo', debug : true })).toBe( 'src=seo&debug' );
        expect( queryStringFromBag({ tag : [ 'a', 'b' ] })).toBe( 'tag=a&tag=b' );
        expect( queryStringFromBag({ skip : undefined, q : 'ada' })).toBe( 'q=ada' );
    });
});

