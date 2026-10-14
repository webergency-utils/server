import { SecurityOptions } from '../decorators.js';
import { parseSize } from './security.js';
import { parseHeaderValueParameter } from './http-header-parse.js';
import { parseAnyQuery, reviveAny } from './reviver.js';

const UTF8_DECODER = new TextDecoder( 'utf-8' );

export interface HeaderCarrier
{
    headers? : {
        get?( name: string ): string | null
    } | Record<string, string>
    header?( name: string ): string | null
}

export interface BodyCheckCarrier extends HeaderCarrier
{
    body?       : ReadableStream<Uint8Array> | null
    bodyStream? : ReadableStream<Uint8Array> | null
}

export interface RawBodyCarrier extends BodyCheckCarrier
{
    headers : {
        get( name: string ): string | null
    }
    arrayBuffer(): Promise<ArrayBuffer>
}

function getHeader( req: HeaderCarrier, name: string ): string | null
{
    if( typeof req.header === 'function' )
    {
        return req.header( name );
    }

    const h = req.headers as any;

    if( h && typeof h.get === 'function' )
    {
        return h.get( name );
    }

    if( h && typeof h === 'object' )
    {
        return h[name.toLowerCase()] ?? h[name] ?? null;
    }

    return null;
}

export function getContentType( req: HeaderCarrier ): string | null
{
    const raw = getHeader( req, 'content-type' );

    if( !raw ){ return null }

    if( raw === 'application/json' || raw === 'application/x-www-form-urlencoded' || raw === 'text/plain' )
    {
        return raw;
    }

    const semi = raw.indexOf( ';' );
    const slice = semi === -1 ? raw : raw.slice( 0, semi );
    const trimmed = slice.trim().toLowerCase();

    return trimmed || null;
}

/** `application/json` and structured suffixes (`application/vnd.api+json`, …). */
export function isJsonContentType( contentType: string | null | undefined ): boolean
{
    if( !contentType ){ return false }

    return contentType === 'application/json'
        || /^application\/[a-z0-9!#$&^_.+-]*\+json$/.test( contentType );
}

/** `multipart/form-data` (boundary parameters ignored — use `getContentType`). */
export function isMultipartContentType( contentType: string | null | undefined ): boolean
{
    return contentType === 'multipart/form-data';
}

/** Extract `charset` from a Content-Type header (quoted or bare). */
export function getContentTypeCharset( contentTypeHeader: string | null ): string | undefined
{
    if( !contentTypeHeader ){ return undefined }

    return parseHeaderValueParameter( contentTypeHeader, 'charset' );
}

function isUtf8Charset( label: string ): boolean
{
    const normalized = label.trim().toLowerCase().replace( /_/g, '-' );

    return normalized === 'utf-8' || normalized === 'utf8' || normalized === 'unicode-1-1-utf-8';
}

/**
 * Decode body bytes. UTF-8 (default / explicit) uses a shared decoder;
 * other WHATWG labels construct a one-off `TextDecoder`. Unknown → 415.
 */
export function decodeBodyText( raw: ArrayBuffer, charset?: string | null ): string
{
    if( !charset || isUtf8Charset( charset ))
    {
        return UTF8_DECODER.decode( raw );
    }

    try
    {
        return new TextDecoder( charset ).decode( raw );
    }
    catch
    {
        throw Object.assign( new Error( `Unsupported charset: ${charset}` ), { status : 415 });
    }
}

/** True when headers or the Request body stream indicate a non-empty body (without reading it). */
export function requestLikelyHasBody( req: BodyCheckCarrier ): boolean
{
    if( typeof ( req as { likelyHasBody? : boolean }).likelyHasBody === 'boolean' )
    {
        return ( req as { likelyHasBody : boolean }).likelyHasBody;
    }

    const contentLength = getHeader( req, 'content-length' );

    if( contentLength !== null )
    {
        const n = parseInt( contentLength, 10 );

        if( !Number.isNaN( n ))
        {
            return n > 0;
        }
    }

    const transferEncoding = getHeader( req, 'transfer-encoding' );

    if( transferEncoding && transferEncoding.toLowerCase() !== 'identity' )
    {
        return true;
    }

    // Bun (and some undici paths) may omit Content-Length while still exposing a body stream.
    if(( req.body != null && typeof req.body !== 'function' ) || req.bodyStream != null )
    {
        return true;
    }

    return false;
}

export function unsupportedMediaType( contentType: string | null ): never
{
    throw Object.assign( new Error( `Unsupported Media Type: ${contentType || 'missing'}` ), { status : 415 });
}

export function looksLikeUrlEncoded( text: string ): boolean
{
    return /[=&]/.test( text );
}

/** When Content-Type is absent: try JSON, then urlencoded if the text looks like a form body. */
export function sniffBody( text: string, reviver?: ( key: string, value: any ) => any ): { value : any, contentType : 'application/json' | 'application/x-www-form-urlencoded' }
{
    let jsonValue: any;
    let isJson = false;

    try
    {
        jsonValue = JSON.parse( text );
        isJson = true;
    }
    catch
    {
        // fall through
    }

    if( isJson )
    {
        return { value : reviveAny( jsonValue, reviver ), contentType : 'application/json' };
    }

    if( looksLikeUrlEncoded( text ))
    {
        return { value : parseAnyQuery( text, reviver ), contentType : 'application/x-www-form-urlencoded' };
    }

    throw Object.assign( new Error( 'Unable to parse body without Content-Type' ), { status : 400 });
}

function payloadTooLarge( maxSize: string | number ): never
{
    throw Object.assign( new Error( `Payload Too Large (limit: ${maxSize})` ), { status : 413 });
}

/**
 * Applied unless `maxBodySize` is set explicitly. An uncapped body is a trivial memory
 * DoS, so the safe value is the default rather than something callers must opt into.
 */
export const DEFAULT_MAX_BODY_SIZE = '1mb';

export const DEFAULT_MAX_BODY_BYTES = parseSize( DEFAULT_MAX_BODY_SIZE );

interface BodyLimitDescriptor
{
    limit : number | undefined
    label : string | number
}

const DEFAULT_BODY_LIMIT: BodyLimitDescriptor = {
    limit : DEFAULT_MAX_BODY_BYTES,
    label : DEFAULT_MAX_BODY_SIZE
};

const bodyLimitCache = new WeakMap<SecurityOptions, BodyLimitDescriptor>();

/** `0` and `Infinity` opt out of the cap entirely. */
function resolveBodyLimit( securityConfig?: SecurityOptions ): BodyLimitDescriptor
{
    if( !securityConfig || securityConfig.maxBodySize === undefined )
    {
        return DEFAULT_BODY_LIMIT;
    }

    const cached = bodyLimitCache.get( securityConfig );

    if( cached !== undefined )
    {
        return cached;
    }

    const configured = securityConfig.maxBodySize;
    const resolved: BodyLimitDescriptor = ( configured === 0 || configured === Infinity )
        ? { limit : undefined, label : configured }
        : { limit : parseSize( configured ), label : configured };

    bodyLimitCache.set( securityConfig, resolved );

    return resolved;
}

/**
 * `parseInt` accepts trailing garbage (`'10abc'` -> `10`) and duplicate headers arrive
 * joined as `'10, 20'`, so require a single fully numeric value and reject the rest.
 */
function parseContentLength( raw: string | null ): number | undefined
{
    if( raw === null ){ return undefined }

    const trimmed = raw.trim();
    const len = trimmed.length;

    if( len === 0 )
    {
        throw Object.assign( new Error( `Invalid Content-Length: ${raw}` ), { status : 400 });
    }

    let val = 0;

    for( let i = 0; i < len; i++ )
    {
        const code = trimmed.charCodeAt( i );

        if( code < 48 || code > 57 )
        {
            throw Object.assign( new Error( `Invalid Content-Length: ${raw}` ), { status : 400 });
        }

        val = val * 10 + ( code - 48 );
    }

    if( !Number.isSafeInteger( val ))
    {
        throw Object.assign( new Error( `Invalid Content-Length: ${raw}` ), { status : 400 });
    }

    return val;
}

const EMPTY_ARRAY_BUFFER = new ArrayBuffer( 0 );

function concatChunks( chunks: Uint8Array[], total: number ): ArrayBuffer
{
    if( chunks.length === 0 )
    {
        return EMPTY_ARRAY_BUFFER;
    }

    if( chunks.length === 1 )
    {
        const single = chunks[0];

        if( single.byteOffset === 0 && single.byteLength === single.buffer.byteLength && single.buffer instanceof ArrayBuffer )
        {
            return single.buffer;
        }
    }

    const out = new Uint8Array( total );
    let offset = 0;

    for( const chunk of chunks )
    {
        out.set( chunk, offset );
        offset += chunk.byteLength;
    }

    return out.buffer;
}

/**
 * Read a Request body stream while capping total bytes in memory.
 * Cancels the stream as soon as the limit is exceeded.
 */
async function readStreamWithLimit( body: ReadableStream<Uint8Array>, limit: number, maxSize: string | number ): Promise<ArrayBuffer>
{
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;

    try
    {
        for( ;; )
        {
            const { done, value } = await reader.read();

            if( done ){ break }

            if( !value?.byteLength ){ continue }

            total += value.byteLength;

            if( total > limit )
            {
                await reader.cancel().catch(() => undefined );
                payloadTooLarge( maxSize );
            }

            chunks.push( value );
        }
    }
    finally
    {
        reader.releaseLock();
    }

    return concatChunks( chunks, total );
}

/**
 * Stateless raw-body stream reader enforcing `Content-Length` validation and `maxBodySize`.
 */
export async function readRawBody( req: RawBodyCarrier, securityConfig?: SecurityOptions ): Promise<ArrayBuffer>
{
    const { limit, label } = resolveBodyLimit( securityConfig );
    const declared = parseContentLength( req.headers.get( 'content-length' ));

    if( limit !== undefined && declared !== undefined && declared > limit )
    {
        payloadTooLarge( label );
    }

    // Prefer streaming when a size cap is set so chunked/omitted Content-Length
    // cannot force the entire payload into memory before rejection.
    if( limit !== undefined && req.body != null && typeof ( req.body as ReadableStream<Uint8Array> ).getReader === 'function' )
    {
        return readStreamWithLimit( req.body as ReadableStream<Uint8Array>, limit, label );
    }

    const buffer = await req.arrayBuffer();

    if( limit !== undefined && buffer.byteLength > limit )
    {
        payloadTooLarge( label );
    }

    return buffer;
}

