import { describe, it, expect, beforeEach, vi } from 'vitest';
import
{
    RequestReader,
    getContentType,
    getContentTypeCharset,
    isJsonContentType,
    isMultipartContentType,
    requestLikelyHasBody,
    DEFAULT_MAX_BODY_SIZE
}
from '../src/helpers/request-reader.js';
import { mergeSecurityConfigs, parseSize } from '../src/helpers/security.js';
import type { AugmentedRequest } from '../src/core/types.js';

const DEFAULT_MAX_BODY_BYTES = parseSize( DEFAULT_MAX_BODY_SIZE );

function createRequest( options:
{
    headers?     : Record<string, string | null>
    body?        : string | ArrayBuffer
    streamBody?  : ReadableStream<Uint8Array>
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
        body : options.streamBody,
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

function chunkedStream( chunks: string[]): ReadableStream<Uint8Array>
{
    const encoder = new TextEncoder();
    let i = 0;

    return new ReadableStream({
        pull( controller )
        {
            if( i < chunks.length )
            {
                controller.enqueue( encoder.encode( chunks[i++]));
            }
            else
            {
                controller.close();
            }
        }
    });
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

    it( 'should treat a non-null Request body stream as a body', () =>
    {
        expect( requestLikelyHasBody( new Request( 'http://localhost/', {
            method : 'POST',
            body   : '{"a":1}'
        }) as any )).toBe( true );
        expect( requestLikelyHasBody( new Request( 'http://localhost/', {
            method : 'POST'
        }) as any )).toBe( false );
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

    it( 'should accept bodies under the default cap when maxBodySize is undefined', async () =>
    {
        // Arrange
        const large = 'x'.repeat( 100 );
        const req = createRequest({ body : large });

        // Act
        const raw = await RequestReader.getRawBody( req );

        // Assert
        expect( raw.byteLength ).toBe( 100 );
    });

    it( 'should apply the 1mb default cap when maxBodySize is undefined', async () =>
    {
        // Arrange
        const req = createRequest({ body : 'x'.repeat( DEFAULT_MAX_BODY_BYTES + 1 ) });

        // Act
        const act = RequestReader.getRawBody( req );

        // Assert
        await expect( act ).rejects.toMatchObject({
            status  : 413,
            message : expect.stringContaining( DEFAULT_MAX_BODY_SIZE )
        });
    });

    it( 'should reject early against the default cap using content-length', async () =>
    {
        // Arrange
        const req = createRequest({
            body    : 'tiny',
            headers : { 'content-length' : String( DEFAULT_MAX_BODY_BYTES + 1 ) }
        });

        // Act
        const act = RequestReader.getRawBody( req );

        // Assert
        await expect( act ).rejects.toMatchObject({ status : 413 });
        expect( req.arrayBuffer ).not.toHaveBeenCalled();
    });

    it( 'should treat maxBodySize 0 as unlimited', async () =>
    {
        // Arrange
        const req = createRequest({ body : 'x'.repeat( DEFAULT_MAX_BODY_BYTES + 64 ) });

        // Act
        const raw = await RequestReader.getRawBody( req, { maxBodySize : 0 });

        // Assert
        expect( raw.byteLength ).toBe( DEFAULT_MAX_BODY_BYTES + 64 );
    });

    it( 'should treat security:false as unlimited via merged config', async () =>
    {
        // Arrange
        const req = createRequest({ body : 'x'.repeat( DEFAULT_MAX_BODY_BYTES + 8 ) });

        // Act
        const raw = await RequestReader.getRawBody( req, mergeSecurityConfigs([false]));

        // Assert
        expect( raw.byteLength ).toBe( DEFAULT_MAX_BODY_BYTES + 8 );
    });

    it( 'should reject a non-numeric content-length with 400', async () =>
    {
        // Arrange
        const req = createRequest({ body : 'hello', headers : { 'content-length' : '5abc' } });

        // Act
        const act = RequestReader.getRawBody( req );

        // Assert
        await expect( act ).rejects.toMatchObject({ status : 400 });
        expect( req.arrayBuffer ).not.toHaveBeenCalled();
    });

    it( 'should reject a negative content-length with 400', async () =>
    {
        // Arrange
        const req = createRequest({ body : 'hello', headers : { 'content-length' : '-1' } });

        // Act / Assert
        await expect( RequestReader.getRawBody( req )).rejects.toMatchObject({ status : 400 });
    });

    it( 'should reject duplicate content-length values with 400', async () =>
    {
        // Arrange — duplicate headers arrive joined by the Headers API
        const req = createRequest({ body : 'hello', headers : { 'content-length' : '5, 5' } });

        // Act / Assert
        await expect( RequestReader.getRawBody( req )).rejects.toMatchObject({ status : 400 });
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

    it( 'should reject mid-stream when chunked body exceeds maxBodySize', async () =>
    {
        // Arrange — no Content-Length; stream would otherwise buffer everything via arrayBuffer()
        const req = createRequest({
            streamBody : chunkedStream([ 'aaaaaaaaaa', 'bbbbbbbbbb', 'cccccccccc' ])
        }) as AugmentedRequest & { arrayBufferCalls: () => number };

        // Act
        const act = RequestReader.getRawBody( req, { maxBodySize : '15b' });

        // Assert
        await expect( act ).rejects.toMatchObject({ status : 413 });
        expect( req.arrayBufferCalls()).toBe( 0 );
        expect( req._raw ).toBeUndefined();
    });

    it( 'should stream-read bodies within maxBodySize without calling arrayBuffer', async () =>
    {
        // Arrange
        const req = createRequest({
            streamBody : chunkedStream([ 'hel', 'lo' ])
        }) as AugmentedRequest & { arrayBufferCalls: () => number };

        // Act
        const raw = await RequestReader.getRawBody( req, { maxBodySize : '10b' });

        // Assert
        expect( new TextDecoder().decode( raw )).toBe( 'hello' );
        expect( req.arrayBufferCalls()).toBe( 0 );
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

    it( 'should apply reviver when parsing JSON and sniffed JSON', async () =>
    {
        const reviver = ( _key: string, value: any ) => value === 'x' ? 'y' : value;

        const typed = createRequest({
            body    : JSON.stringify({ v : 'x' }),
            headers : { 'Content-Type' : 'application/json' }
        });
        typed.reviver = reviver;

        const sniffed = createRequest({ body : JSON.stringify({ v : 'x' }) });
        sniffed.reviver = reviver;

        expect( await RequestReader.getBody( typed ) ).toEqual({ v : 'y' });
        expect( await RequestReader.getBody( sniffed ) ).toEqual({ v : 'y' });
    });

    it( 'should apply reviver to urlencoded and sniffed urlencoded bodies', async () =>
    {
        const reviver = ( _key: string, value: any ) => value === 'x' ? 'y' : value;

        const typed = createRequest({
            body    : 'v=x',
            headers : { 'Content-Type' : 'application/x-www-form-urlencoded' }
        });
        typed.reviver = reviver;

        const sniffed = createRequest({ body : 'v=x' });
        sniffed.reviver = reviver;

        expect( await RequestReader.getBody( typed ) ).toEqual({ v : 'y' });
        expect( await RequestReader.getBody( sniffed ) ).toEqual({ v : 'y' });
    });

    it( 'should parse urlencoded bodies via parseQueryString', async () =>
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

    it( 'tryGetUrlEncodedText returns wire text without parseQueryString', async () =>
    {
        const req = createRequest({
            body    : 'age=30&token=jpUllytbmQ=',
            headers : { 'Content-Type' : 'application/x-www-form-urlencoded' }
        });

        const text = await RequestReader.tryGetUrlEncodedText( req );

        expect( text ).toBe( 'age=30&token=jpUllytbmQ=' );
        expect( '_json' in req ).toBe( false );
    });

    it( 'tryGetUrlEncodedText returns undefined for JSON bodies', async () =>
    {
        const req = createRequest({
            body    : JSON.stringify({ age : 30 }),
            headers : { 'Content-Type' : 'application/json' }
        });

        expect( await RequestReader.tryGetUrlEncodedText( req )).toBeUndefined();
    });

    it( 'tryGetUrlEncodedText sniffs urlencoded when Content-Type is missing', async () =>
    {
        const req = createRequest({ body : 'a=1&b=2' });

        expect( await RequestReader.tryGetUrlEncodedText( req )).toBe( 'a=1&b=2' );
        expect( req._bodyContentType ).toBe( 'application/x-www-form-urlencoded' );
    });

    it( 'tryGetUrlEncodedText sniffs JSON without Content-Type and returns undefined', async () =>
    {
        const req = createRequest({ body : '{"a":1}' });

        expect( await RequestReader.tryGetUrlEncodedText( req )).toBeUndefined();
        expect( req._bodyContentType ).toBe( 'application/json' );
    });

    it( 'tryGetUrlEncodedText returns undefined for empty and non-form sniff bodies', async () =>
    {
        expect( await RequestReader.tryGetUrlEncodedText( createRequest({ body : '' }))).toBeUndefined();
        expect( await RequestReader.tryGetUrlEncodedText( createRequest({ body : 'not-form' }))).toBeUndefined();
    });

    it( 'tryGetJsonText returns wire text without JSON.parse', async() =>
    {
        const req = createRequest({
            body    : '{"name":"Ada"}',
            headers : { 'Content-Type' : 'application/json' }
        });

        const text = await RequestReader.tryGetJsonText( req );

        expect( text ).toBe( '{"name":"Ada"}' );
        expect( '_json' in req ).toBe( false );
    });

    it( 'tryGetJsonText returns undefined for urlencoded bodies', async() =>
    {
        const req = createRequest({
            body    : 'age=30',
            headers : { 'Content-Type' : 'application/x-www-form-urlencoded' }
        });

        expect( await RequestReader.tryGetJsonText( req )).toBeUndefined();
    });

    it( 'tryGetJsonText sniffs JSON when Content-Type is missing', async() =>
    {
        const req = createRequest({ body : '{"a":1}' });

        expect( await RequestReader.tryGetJsonText( req )).toBe( '{"a":1}' );
        expect( req._bodyContentType ).toBe( 'application/json' );
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

    it( 'should parse application/*+json as JSON', async () =>
    {
        const req = createRequest({
            body    : JSON.stringify({ data : { id : '1' } }),
            headers : { 'Content-Type' : 'application/vnd.api+json' }
        });

        expect( await RequestReader.getBody( req )).toEqual({ data : { id : '1' } });
    });

    it( 'should return text/plain bodies as a string', async () =>
    {
        const req = createRequest({
            body    : 'hello plain',
            headers : { 'Content-Type' : 'text/plain' }
        });

        const first = await RequestReader.getBody( req );
        const second = await RequestReader.getBody( req );

        expect( first ).toBe( 'hello plain' );
        expect( first ).toBe( second );
    });

    it( 'should treat text/plain with charset as a string', async () =>
    {
        const req = createRequest({
            body    : 'café',
            headers : { 'Content-Type' : 'text/plain; charset=utf-8' }
        });

        expect( await RequestReader.getBody( req )).toBe( 'café' );
    });

    it( 'should decode text/plain with a non-utf8 charset', async () =>
    {
        // "café" in ISO-8859-1
        const body = Uint8Array.from([ 0x63, 0x61, 0x66, 0xe9 ]).buffer;
        const req = createRequest({
            body,
            headers : { 'Content-Type' : 'text/plain; charset=iso-8859-1' }
        });

        expect( await RequestReader.getBody( req )).toBe( 'café' );
    });

    it( 'should reject text/plain with an unknown charset', async () =>
    {
        const req = createRequest({
            body    : 'x',
            headers : { 'Content-Type' : 'text/plain; charset=not-a-real-encoding' }
        });

        await expect( RequestReader.getBody( req )).rejects.toMatchObject({ status : 415 });
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
            body    : '<root/>',
            headers : { 'Content-Type' : 'application/xml' }
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

    it( 'should classify content types and charset helpers', () =>
    {
        // Assert
        expect( isJsonContentType( null )).toBe( false );
        expect( isJsonContentType( undefined )).toBe( false );
        expect( isJsonContentType( 'application/json' )).toBe( true );
        expect( isJsonContentType( 'application/vnd.api+json' )).toBe( true );
        expect( isMultipartContentType( 'multipart/form-data' )).toBe( true );
        expect( isMultipartContentType( 'application/json' )).toBe( false );
        expect( getContentTypeCharset( null )).toBeUndefined();
        expect( getContentTypeCharset( 'text/plain; charset=utf-8' )).toBe( 'utf-8' );
        expect( getContentType( createRequest({ headers : { 'Content-Type' : ';' } }))).toBeNull();
    });

    it( 'tryGetUrlEncodedText sniffs when Content-Type is missing', async () =>
    {
        // Arrange
        const jsonReq = createRequest({ body : '{"a":1}' });
        const formReq = createRequest({ body : 'a=1&b=2' });
        const plainReq = createRequest({ body : 'just-text' });
        const emptyReq = createRequest({ body : '' });
        const already = createRequest({ withJsonKey : true, _json : { x : 1 } });
        const declared = createRequest({
            body    : 'a=1',
            headers : { 'Content-Type' : 'text/plain' }
        });

        // Act / Assert
        expect( await RequestReader.tryGetUrlEncodedText( jsonReq )).toBeUndefined();
        expect( jsonReq._bodyContentType ).toBe( 'application/json' );

        expect( await RequestReader.tryGetUrlEncodedText( formReq )).toBe( 'a=1&b=2' );
        expect( formReq._bodyContentType ).toBe( 'application/x-www-form-urlencoded' );

        expect( await RequestReader.tryGetUrlEncodedText( plainReq )).toBeUndefined();
        expect( await RequestReader.tryGetUrlEncodedText( emptyReq )).toBeUndefined();
        expect( await RequestReader.tryGetUrlEncodedText( already )).toBeUndefined();
        expect( await RequestReader.tryGetUrlEncodedText( declared )).toBeUndefined();
    });

    it( 'should skip empty stream chunks and 413 when streaming exceeds maxBodySize', async () =>
    {
        // Arrange
        const emptyChunkStream = new ReadableStream<Uint8Array>({
            start( controller )
            {
                controller.enqueue( new Uint8Array( 0 ));
                controller.enqueue( new TextEncoder().encode( '{"ok":true}' ));
                controller.close();
            }
        });
        const okReq = createRequest({
            streamBody : emptyChunkStream,
            headers    : { 'Content-Type' : 'application/json' }
        });

        // Act / Assert
        expect( await RequestReader.getBody( okReq )).toEqual({ ok : true });

        const big = new ReadableStream<Uint8Array>({
            start( controller )
            {
                controller.enqueue( new TextEncoder().encode( 'abcdefghij' ));
                controller.close();
            }
        });
        const bigReq = createRequest({
            streamBody : big,
            headers    : { 'Content-Type' : 'application/json' }
        });

        await expect( RequestReader.getRawBody( bigReq, { maxBodySize : 4 })).rejects.toMatchObject({
            status : 413
        });
    });
});
