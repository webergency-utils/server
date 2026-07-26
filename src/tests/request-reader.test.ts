import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RequestReader, getContentType, requestLikelyHasBody } from '../helpers/request-reader.js';
import type { AugmentedRequest } from '../core/types.js';

function createRequest( options:
{
    headers?     : Record<string, string | null>
    body?        : string | ArrayBuffer
    _json?       : unknown
    withJsonKey? : boolean
    _raw?        : ArrayBuffer
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

    let arrayBufferCalls = 0;
    const bodyBytes = typeof options.body === 'string'
        ? new TextEncoder().encode( options.body ).buffer
        : options.body;

    const req =
    {
        headers : {
            get : ( name: string ) => headerMap.get( name.toLowerCase()) ?? null
        },
        arrayBuffer : vi.fn( async () =>
        {
            arrayBufferCalls += 1;

            return bodyBytes ?? new ArrayBuffer( 0 );
        }),
        params : {},
        query  : {},
        url    : 'http://localhost/',
        meta   : {}
    } as unknown as AugmentedRequest & { arrayBufferCalls: () => number };

    if( options.withJsonKey || '_json' in options )
    {
        ( req as { _json?: unknown })._json = options._json;
    }

    if( options._raw !== undefined )
    {
        req._raw = options._raw;
    }

    ( req as { arrayBufferCalls: () => number }).arrayBufferCalls = () => arrayBufferCalls;

    return req;
}

describe( 'getContentType', () =>
{
    it( 'should return null when content-type header is missing', () =>
    {
        // Arrange
        const req = createRequest({});

        // Act
        const result = getContentType( req );

        // Assert
        expect( result ).toBeNull();
    });

    it( 'should strip parameters and lowercase the mime type', () =>
    {
        // Arrange
        const req = createRequest({
            headers : { 'Content-Type' : 'Application/JSON; charset=utf-8' }
        });

        // Act
        const result = getContentType( req );

        // Assert
        expect( result ).toBe( 'application/json' );
    });

    it( 'should return null when the mime segment is empty', () =>
    {
        // Arrange
        const req = createRequest({
            headers : { 'content-type' : '; charset=utf-8' }
        });

        // Act
        const result = getContentType( req );

        // Assert
        expect( result ).toBeNull();
    });
});

describe( 'requestLikelyHasBody', () =>
{
    it( 'should detect Content-Length greater than zero', () =>
    {
        expect( requestLikelyHasBody( createRequest({
            headers : { 'content-length' : '12' }
        }))).toBe( true );
        expect( requestLikelyHasBody( createRequest({
            headers : { 'content-length' : '0' }
        }))).toBe( false );
    });

    it( 'should treat non-identity Transfer-Encoding as a body', () =>
    {
        expect( requestLikelyHasBody( createRequest({
            headers : { 'transfer-encoding' : 'chunked' }
        }))).toBe( true );
    });

    it( 'should return false when no body indicators are present', () =>
    {
        expect( requestLikelyHasBody( createRequest({}))).toBe( false );
    });
});

describe( 'RequestReader.getRawBody', () =>
{
    beforeEach(() =>
    {
        vi.clearAllMocks();
    });

    it( 'should return and cache raw body without re-reading', async () =>
    {
        // Arrange
        const req = createRequest({ body : 'hello' }) as AugmentedRequest & { arrayBufferCalls: () => number };

        // Act
        const first = await RequestReader.getRawBody( req );
        const second = await RequestReader.getRawBody( req );

        // Assert
        expect( new TextDecoder().decode( first )).toBe( 'hello' );
        expect( first ).toBe( second );
        expect( req.arrayBufferCalls()).toBe( 1 );
    });

    it( 'should skip size checks when maxBodySize is undefined', async () =>
    {
        // Arrange
        const large = 'x'.repeat( 100 );
        const req = createRequest({ body : large });

        // Act
        const raw = await RequestReader.getRawBody( req );

        // Assert
        expect( raw.byteLength ).toBe( 100 );
    });

    it( 'should reject early when content-length exceeds maxBodySize', async () =>
    {
        // Arrange
        const req = createRequest({
            body    : 'tiny',
            headers : { 'content-length' : '100' }
        });

        // Act
        const act = RequestReader.getRawBody( req, { maxBodySize : '10b' });

        // Assert
        await expect( act ).rejects.toMatchObject({
            status  : 413,
            message : expect.stringContaining( '10b' )
        });
        expect( req.arrayBuffer ).not.toHaveBeenCalled();
    });

    it( 'should reject after read when buffer exceeds maxBodySize without content-length', async () =>
    {
        // Arrange
        const req = createRequest({ body : 'abcdefghijklmnop' });

        // Act
        const act = RequestReader.getRawBody( req, { maxBodySize : '10b' });

        // Assert
        await expect( act ).rejects.toMatchObject({ status : 413 });
    });

    it( 'should accept bodies within a numeric maxBodySize limit', async () =>
    {
        // Arrange
        const req = createRequest({ body : 'ok' });

        // Act
        const raw = await RequestReader.getRawBody( req, { maxBodySize : 10 });

        // Assert
        expect( raw.byteLength ).toBe( 2 );
    });

    it( 'should return cached _raw without calling arrayBuffer', async () =>
    {
        // Arrange
        const cached = new TextEncoder().encode( 'cached' ).buffer;
        const req = createRequest({ _raw : cached, body : 'ignored' }) as AugmentedRequest & { arrayBufferCalls: () => number };

        // Act
        const raw = await RequestReader.getRawBody( req );

        // Assert
        expect( raw ).toBe( cached );
        expect( req.arrayBufferCalls()).toBe( 0 );
    });
});

describe( 'RequestReader.getBody', () =>
{
    beforeEach(() =>
    {
        vi.clearAllMocks();
    });

    it( 'should return cached _json including undefined without reading the body', async () =>
    {
        // Arrange
        const req = createRequest({ withJsonKey : true, _json : undefined, body : '{"a":1}' }) as AugmentedRequest & { arrayBufferCalls: () => number };

        // Act
        const body = await RequestReader.getBody( req );

        // Assert
        expect( body ).toBeUndefined();
        expect( req.arrayBufferCalls()).toBe( 0 );
    });

    it( 'should cache undefined for empty bodies', async () =>
    {
        // Arrange
        const req = createRequest({ body : '' });

        // Act
        const first = await RequestReader.getBody( req );
        const second = await RequestReader.getBody( req );

        // Assert
        expect( first ).toBeUndefined();
        expect( second ).toBeUndefined();
        expect( '_json' in req ).toBe( true );
    });

    it( 'should parse application/json bodies and cache the result', async () =>
    {
        // Arrange
        const req = createRequest({
            body    : JSON.stringify({ hello : 'world' }),
            headers : { 'Content-Type' : 'application/json' }
        });

        // Act
        const first = await RequestReader.getBody( req );
        const second = await RequestReader.getBody( req );

        // Assert
        expect( first ).toEqual({ hello : 'world' });
        expect( first ).toBe( second );
    });

    it( 'should parse urlencoded bodies via QueryParser', async () =>
    {
        // Arrange
        const req = createRequest({
            body    : 'age=25&tags=a&tags=b',
            headers : { 'Content-Type' : 'application/x-www-form-urlencoded' }
        });

        // Act
        const body = await RequestReader.getBody( req );

        // Assert
        expect( body ).toEqual({ age : '25', tags : ['a', 'b'] });
    });

    it( 'should treat urlencoded content-type with charset as form data', async () =>
    {
        // Arrange
        const req = createRequest({
            body    : 'name=Ada',
            headers : { 'Content-Type' : 'application/x-www-form-urlencoded; charset=UTF-8' }
        });

        // Act
        const body = await RequestReader.getBody( req );

        // Assert
        expect( body ).toEqual({ name : 'Ada' });
    });

    it( 'should sniff JSON or urlencoded when Content-Type is missing', async () =>
    {
        const jsonReq = createRequest({ body : '{"x":1}' });
        const formReq = createRequest({ body : 'a=1&b=2' });

        expect( await RequestReader.getBody( jsonReq )).toEqual({ x : 1 });
        expect( jsonReq._bodyContentType ).toBe( 'application/json' );

        expect( await RequestReader.getBody( formReq )).toEqual({ a : '1', b : '2' });
        expect( formReq._bodyContentType ).toBe( 'application/x-www-form-urlencoded' );
    });

    it( 'should reject unsupported Content-Types and unsniffable bodies', async () =>
    {
        const other = createRequest({
            body    : '{"y":2}',
            headers : { 'Content-Type' : 'text/plain' }
        });
        const multipart = createRequest({
            body    : '--boundary',
            headers : { 'Content-Type' : 'multipart/form-data; boundary=boundary' }
        });
        const garbage = createRequest({ body : 'not-json-or-form' });

        await expect( RequestReader.getBody( other )).rejects.toMatchObject({ status : 415 });
        await expect( RequestReader.getBody( multipart )).rejects.toMatchObject({ status : 415 });
        await expect( RequestReader.getBody( garbage )).rejects.toMatchObject({ status : 400 });
    });

    it( 'should throw 400 for invalid JSON bodies', async () =>
    {
        // Arrange
        const req = createRequest({
            body    : '{not-json',
            headers : { 'Content-Type' : 'application/json' }
        });

        // Act
        const act = RequestReader.getBody( req );

        // Assert
        await expect( act ).rejects.toMatchObject({ status : 400, message : 'Invalid JSON body' });
    });

    it( 'should propagate 413 from getRawBody when maxBodySize is exceeded', async () =>
    {
        // Arrange
        const req = createRequest({
            body    : 'abcdefghijklmnop',
            headers : { 'Content-Type' : 'application/json' }
        });

        // Act
        const act = RequestReader.getBody( req, { maxBodySize : '5b' });

        // Assert
        await expect( act ).rejects.toMatchObject({ status : 413 });
    });
});
