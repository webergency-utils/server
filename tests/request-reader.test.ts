import { describe, it, expect, beforeEach, vi } from 'vitest';
import
{
    getContentType,
    getContentTypeCharset,
    isJsonContentType,
    isMultipartContentType,
    requestLikelyHasBody,
    DEFAULT_MAX_BODY_SIZE
}
    from '../src/helpers/request-reader.js';
import { ServerRequest } from '../src/core/server-request.js';
import { mergeSecurityConfigs, parseSize } from '../src/helpers/security.js';

const DEFAULT_MAX_BODY_BYTES = parseSize( DEFAULT_MAX_BODY_SIZE );

type TestServerRequest = ServerRequest & {
    arrayBuffer      : ReturnType<typeof vi.fn>
    arrayBufferCalls : () => number
};

function createRequest( options:
{
    headers?     : Record<string, string | null>
    body?        : string | ArrayBuffer
    streamBody?  : ReadableStream<Uint8Array>
    _json?       : unknown
    withJsonKey? : boolean
    _raw?        : ArrayBuffer
}): TestServerRequest
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

    const arrayBuffer = vi.fn( async () =>
    {
        arrayBufferCalls += 1;

        return bodyBytes ?? new ArrayBuffer( 0 );
    });

    const raw =
        {
            headers : {
                get     : ( name: string ) => headerMap.get( name.toLowerCase()) ?? null,
                entries : () => headerMap.entries()
            },
            body : options.streamBody,
            arrayBuffer,
            url  : 'http://localhost/'
        } as unknown as Request;

    const initOpts: ConstructorParameters<typeof ServerRequest>[1] = {};

    if( options.withJsonKey || '_json' in options )
    {
        initOpts.preParsedBody = options._json;
    }

    if( options._raw !== undefined )
    {
        initOpts.preReadRaw = options._raw;
    }

    const sreq = new ServerRequest( raw, initOpts ) as TestServerRequest;
    sreq.arrayBuffer = arrayBuffer;
    sreq.arrayBufferCalls = () => arrayBufferCalls;

    return sreq;
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

describe( 'ServerRequest.rawBody', () =>
{
    beforeEach(() =>
    {
        vi.clearAllMocks();
    });

    it( 'should return and cache raw body without re-reading', async () =>
    {
        // Arrange
        const req = createRequest({ body : 'hello' });

        // Act
        const first = await req.rawBody();
        const second = await req.rawBody();

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
        const raw = await req.rawBody();

        // Assert
        expect( raw.byteLength ).toBe( 100 );
    });

    it( 'should apply the 1mb default cap when maxBodySize is undefined', async () =>
    {
        // Arrange
        const req = createRequest({ body : 'x'.repeat( DEFAULT_MAX_BODY_BYTES + 1 ) });

        // Act
        const act = req.rawBody();

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
        const act = req.rawBody();

        // Assert
        await expect( act ).rejects.toMatchObject({ status : 413 });
        expect( req.arrayBuffer ).not.toHaveBeenCalled();
    });

    it( 'should treat maxBodySize 0 as unlimited', async () =>
    {
        // Arrange
        const req = createRequest({ body : 'x'.repeat( DEFAULT_MAX_BODY_BYTES + 64 ) });

        // Act
        const raw = await req.rawBody({ maxBodySize : 0 });

        // Assert
        expect( raw.byteLength ).toBe( DEFAULT_MAX_BODY_BYTES + 64 );
    });

    it( 'should treat security:false as unlimited via merged config', async () =>
    {
        // Arrange
        const req = createRequest({ body : 'x'.repeat( DEFAULT_MAX_BODY_BYTES + 8 ) });

        // Act
        const raw = await req.rawBody( mergeSecurityConfigs([false]));

        // Assert
        expect( raw.byteLength ).toBe( DEFAULT_MAX_BODY_BYTES + 8 );
    });

    it( 'should reject a non-numeric content-length with 400', async () =>
    {
        // Arrange
        const req = createRequest({ body : 'hello', headers : { 'content-length' : '5abc' } });

        // Act
        const act = req.rawBody();

        // Assert
        await expect( act ).rejects.toMatchObject({ status : 400 });
        expect( req.arrayBuffer ).not.toHaveBeenCalled();
    });

    it( 'should reject a negative content-length with 400', async () =>
    {
        // Arrange
        const req = createRequest({ body : 'hello', headers : { 'content-length' : '-1' } });

        // Act / Assert
        await expect( req.rawBody()).rejects.toMatchObject({ status : 400 });
    });

    it( 'should reject duplicate content-length values with 400', async () =>
    {
        // Arrange — duplicate headers arrive joined by the Headers API
        const req = createRequest({ body : 'hello', headers : { 'content-length' : '5, 5' } });

        // Act / Assert
        await expect( req.rawBody()).rejects.toMatchObject({ status : 400 });
    });

    it( 'should reject early when content-length exceeds maxBodySize', async () =>
    {
        // Arrange
        const req = createRequest({
            body    : 'tiny',
            headers : { 'content-length' : '100' }
        });

        // Act
        const act = req.rawBody({ maxBodySize : '10b' });

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
        const act = req.rawBody({ maxBodySize : '10b' });

        // Assert
        await expect( act ).rejects.toMatchObject({ status : 413 });
    });

    it( 'should reject mid-stream when chunked body exceeds maxBodySize', async () =>
    {
        // Arrange — no Content-Length; stream would otherwise buffer everything via arrayBuffer()
        const req = createRequest({
            streamBody : chunkedStream([ 'aaaaaaaaaa', 'bbbbbbbbbb', 'cccccccccc' ])
        });

        // Act
        const act = req.rawBody({ maxBodySize : '15b' });

        // Assert
        await expect( act ).rejects.toMatchObject({ status : 413 });
        expect( req.arrayBufferCalls()).toBe( 0 );
    });

    it( 'should stream-read bodies within maxBodySize without calling arrayBuffer', async () =>
    {
        // Arrange
        const req = createRequest({
            streamBody : chunkedStream([ 'hel', 'lo' ])
        });

        // Act
        const raw = await req.rawBody({ maxBodySize : '10b' });

        // Assert
        expect( new TextDecoder().decode( raw )).toBe( 'hello' );
        expect( req.arrayBufferCalls()).toBe( 0 );
    });

    it( 'should accept bodies within a numeric maxBodySize limit', async () =>
    {
        // Arrange
        const req = createRequest({ body : 'ok' });

        // Act
        const raw = await req.rawBody({ maxBodySize : 10 });

        // Assert
        expect( raw.byteLength ).toBe( 2 );
    });

    it( 'should return cached _raw without calling arrayBuffer', async () =>
    {
        // Arrange
        const cached = new TextEncoder().encode( 'cached' ).buffer;
        const req = createRequest({ _raw : cached, body : 'ignored' });

        // Act
        const raw = await req.rawBody();

        // Assert
        expect( raw ).toBe( cached );
        expect( req.arrayBufferCalls()).toBe( 0 );
    });
});

describe( 'ServerRequest.body', () =>
{
    beforeEach(() =>
    {
        vi.clearAllMocks();
    });

    it( 'should return cached _json including undefined without reading the body', async () =>
    {
        // Arrange
        const req = createRequest({ withJsonKey : true, _json : undefined, body : '{"a":1}' });

        // Act
        const body = await req.body();

        // Assert
        expect( body ).toBeUndefined();
        expect( req.arrayBufferCalls()).toBe( 0 );
    });

    it( 'should cache undefined for empty bodies', async () =>
    {
        // Arrange
        const req = createRequest({ body : '' });

        // Act
        const first = await req.body();
        const second = await req.body();

        // Assert
        expect( first ).toBeUndefined();
        expect( second ).toBeUndefined();
        expect( req.hasCachedBody ).toBe( true );
    });

    it( 'should parse application/json bodies and cache the result', async () =>
    {
        // Arrange
        const req = createRequest({
            body    : JSON.stringify({ hello : 'world' }),
            headers : { 'Content-Type' : 'application/json' }
        });

        // Act
        const first = await req.body();
        const second = await req.body();

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

        expect( await typed.body()).toEqual({ v : 'y' });
        expect( await sniffed.body()).toEqual({ v : 'y' });
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

        expect( await typed.body()).toEqual({ v : 'y' });
        expect( await sniffed.body()).toEqual({ v : 'y' });
    });

    it( 'should parse urlencoded bodies via parseQueryString', async () =>
    {
        // Arrange
        const req = createRequest({
            body    : 'age=25&tags=a&tags=b',
            headers : { 'Content-Type' : 'application/x-www-form-urlencoded' }
        });

        // Act
        const body = await req.body();

        // Assert
        expect( body ).toEqual({ age : '25', tags : ['a', 'b'] });
    });

    it( 'tryGetUrlEncodedText returns wire text without parseQueryString', async () =>
    {
        const req = createRequest({
            body    : 'age=30&token=jpUllytbmQ=',
            headers : { 'Content-Type' : 'application/x-www-form-urlencoded' }
        });

        const text = await req.tryGetUrlEncodedText();

        expect( text ).toBe( 'age=30&token=jpUllytbmQ=' );
        expect( req.hasCachedBody ).toBe( false );
    });

    it( 'tryGetUrlEncodedText returns undefined for JSON bodies', async () =>
    {
        const req = createRequest({
            body    : JSON.stringify({ age : 30 }),
            headers : { 'Content-Type' : 'application/json' }
        });

        expect( await req.tryGetUrlEncodedText()).toBeUndefined();
    });

    it( 'tryGetUrlEncodedText sniffs urlencoded when Content-Type is missing', async () =>
    {
        const req = createRequest({ body : 'a=1&b=2' });

        expect( await req.tryGetUrlEncodedText()).toBe( 'a=1&b=2' );
        expect( req.effectiveContentType ).toBe( 'application/x-www-form-urlencoded' );
    });

    it( 'tryGetUrlEncodedText sniffs JSON without Content-Type and returns undefined', async () =>
    {
        const req = createRequest({ body : '{"a":1}' });

        expect( await req.tryGetUrlEncodedText()).toBeUndefined();
        expect( req.effectiveContentType ).toBe( 'application/json' );
    });

    it( 'tryGetUrlEncodedText returns undefined for empty and non-form sniff bodies', async () =>
    {
        expect( await createRequest({ body : '' }).tryGetUrlEncodedText()).toBeUndefined();
        expect( await createRequest({ body : 'not-form' }).tryGetUrlEncodedText()).toBeUndefined();
    });

    it( 'tryGetJsonText returns wire text without JSON.parse', async() =>
    {
        const req = createRequest({
            body    : '{"name":"Ada"}',
            headers : { 'Content-Type' : 'application/json' }
        });

        const text = await req.tryGetJsonText();

        expect( text ).toBe( '{"name":"Ada"}' );
        expect( req.hasCachedBody ).toBe( false );
    });

    it( 'tryGetJsonText returns undefined for urlencoded bodies', async() =>
    {
        const req = createRequest({
            body    : 'age=30',
            headers : { 'Content-Type' : 'application/x-www-form-urlencoded' }
        });

        expect( await req.tryGetJsonText()).toBeUndefined();
    });

    it( 'tryGetJsonText sniffs JSON when Content-Type is missing', async() =>
    {
        const req = createRequest({ body : '{"a":1}' });

        expect( await req.tryGetJsonText()).toBe( '{"a":1}' );
        expect( req.effectiveContentType ).toBe( 'application/json' );
    });

    it( 'should treat urlencoded content-type with charset as form data', async () =>
    {
        // Arrange
        const req = createRequest({
            body    : 'name=Ada',
            headers : { 'Content-Type' : 'application/x-www-form-urlencoded; charset=UTF-8' }
        });

        // Act
        const body = await req.body();

        // Assert
        expect( body ).toEqual({ name : 'Ada' });
    });

    it( 'should parse application/*+json as JSON', async () =>
    {
        const req = createRequest({
            body    : JSON.stringify({ data : { id : '1' } }),
            headers : { 'Content-Type' : 'application/vnd.api+json' }
        });

        expect( await req.body()).toEqual({ data : { id : '1' } });
    });

    it( 'should return text/plain bodies as a string', async () =>
    {
        const req = createRequest({
            body    : 'hello plain',
            headers : { 'Content-Type' : 'text/plain' }
        });

        const first = await req.body();
        const second = await req.body();

        expect( first ).toBe( 'hello plain' );
        expect( first ).toBe( second );
    });

    it( 'should treat text/plain with charset as a string', async () =>
    {
        const req = createRequest({
            body    : 'café',
            headers : { 'Content-Type' : 'text/plain; charset=utf-8' }
        });

        expect( await req.body()).toBe( 'café' );
    });

    it( 'should decode text/plain with a non-utf8 charset', async () =>
    {
        // "café" in ISO-8859-1
        const body = Uint8Array.from([ 0x63, 0x61, 0x66, 0xe9 ]).buffer;
        const req = createRequest({
            body,
            headers : { 'Content-Type' : 'text/plain; charset=iso-8859-1' }
        });

        expect( await req.body()).toBe( 'café' );
    });

    it( 'should reject text/plain with an unknown charset', async () =>
    {
        const req = createRequest({
            body    : 'x',
            headers : { 'Content-Type' : 'text/plain; charset=not-a-real-encoding' }
        });

        await expect( req.body()).rejects.toMatchObject({ status : 415 });
    });

    it( 'should sniff JSON or urlencoded when Content-Type is missing', async () =>
    {
        const jsonReq = createRequest({ body : '{"x":1}' });
        const formReq = createRequest({ body : 'a=1&b=2' });

        expect( await jsonReq.body()).toEqual({ x : 1 });
        expect( jsonReq.effectiveContentType ).toBe( 'application/json' );

        expect( await formReq.body()).toEqual({ a : '1', b : '2' });
        expect( formReq.effectiveContentType ).toBe( 'application/x-www-form-urlencoded' );
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

        await expect( other.body()).rejects.toMatchObject({ status : 415 });
        await expect( multipart.body()).rejects.toMatchObject({ status : 415 });
        await expect( garbage.body()).rejects.toMatchObject({ status : 400 });
    });

    it( 'should throw 400 for invalid JSON bodies', async () =>
    {
        // Arrange
        const req = createRequest({
            body    : '{not-json',
            headers : { 'Content-Type' : 'application/json' }
        });

        // Act
        const act = req.body();

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
        const act = req.body({ maxBodySize : '5b' });

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
        expect( await jsonReq.tryGetUrlEncodedText()).toBeUndefined();
        expect( jsonReq.effectiveContentType ).toBe( 'application/json' );

        expect( await formReq.tryGetUrlEncodedText()).toBe( 'a=1&b=2' );
        expect( formReq.effectiveContentType ).toBe( 'application/x-www-form-urlencoded' );

        expect( await plainReq.tryGetUrlEncodedText()).toBeUndefined();
        expect( await emptyReq.tryGetUrlEncodedText()).toBeUndefined();
        expect( await already.tryGetUrlEncodedText()).toBeUndefined();
        expect( await declared.tryGetUrlEncodedText()).toBeUndefined();
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
        expect( await okReq.body()).toEqual({ ok : true });

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

        await expect( bigReq.rawBody({ maxBodySize : 4 })).rejects.toMatchObject({
            status : 413
        });
    });
});
