import { AugmentedRequest } from '../core/types.js';
import { SecurityOptions } from '../decorators.js';
import { parseSize } from './security.js';
import { parseHeaderValueParameter } from './http-header-parse.js';
import { parseAnyJson, parseAnyQuery, reviveAny } from './reviver.js';

const UTF8_DECODER = new TextDecoder( 'utf-8' );

export function getContentType( req: AugmentedRequest ): string | null
{
    const raw = req.headers.get( 'content-type' );

    if( !raw ){ return null }

    return raw.split( ';' )[0]?.trim()?.toLowerCase() || null;
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

/**
 * Declared Content-Type, or the type inferred when the header was missing and the body was sniffed.
 * Used for `@Body` `from` selection after `getBody`.
 */
export function getEffectiveBodyContentType( req: AugmentedRequest ): string | null
{
    return getContentType( req ) ?? req._bodyContentType ?? null;
}

/** True when headers or the Request body stream indicate a non-empty body (without reading it). */
export function requestLikelyHasBody( req: AugmentedRequest ): boolean
{
    const contentLength = req.headers.get( 'content-length' );

    if( contentLength !== null )
    {
        const n = parseInt( contentLength, 10 );

        if( !Number.isNaN( n ))
        {
            return n > 0;
        }
    }

    const transferEncoding = req.headers.get( 'transfer-encoding' );

    if( transferEncoding && transferEncoding.toLowerCase() !== 'identity' )
    {
        return true;
    }

    // Bun (and some undici paths) may omit Content-Length while still exposing a body stream.
    if( req.body != null )
    {
        return true;
    }

    return false;
}

function unsupportedMediaType( contentType: string | null ): never
{
    throw Object.assign( new Error( `Unsupported Media Type: ${contentType || 'missing'}` ), { status : 415 });
}

function looksLikeUrlEncoded( text: string ): boolean
{
    return /[=&]/.test( text );
}

/** When Content-Type is absent: try JSON, then urlencoded if the text looks like a form body. */
function sniffBody( text: string, reviver?: ( key: string, value: any ) => any ): { value: any; contentType: 'application/json' | 'application/x-www-form-urlencoded' }
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

const DEFAULT_MAX_BODY_BYTES = parseSize( DEFAULT_MAX_BODY_SIZE );

/** `0` and `Infinity` opt out of the cap entirely. */
function resolveBodyLimit( securityConfig?: SecurityOptions ): { limit : number | undefined, label : string | number }
{
    const configured = securityConfig?.maxBodySize;

    if( configured === undefined )
    {
        return { limit : DEFAULT_MAX_BODY_BYTES, label : DEFAULT_MAX_BODY_SIZE };
    }

    if( configured === 0 || configured === Infinity )
    {
        return { limit : undefined, label : configured };
    }

    return { limit : parseSize( configured ), label : configured };
}

/**
 * `parseInt` accepts trailing garbage (`'10abc'` -> `10`) and duplicate headers arrive
 * joined as `'10, 20'`, so require a single fully numeric value and reject the rest.
 */
function parseContentLength( raw: string | null ): number | undefined
{
    if( raw === null ){ return undefined }

    const trimmed = raw.trim();

    if( !/^\d+$/.test( trimmed ) || !Number.isSafeInteger( Number( trimmed )))
    {
        throw Object.assign( new Error( `Invalid Content-Length: ${raw}` ), { status : 400 });
    }

    return Number( trimmed );
}

function concatChunks( chunks: Uint8Array[], total: number ): ArrayBuffer
{
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

export class RequestReader 
{
    /**
     * When the body is (or sniffs as) urlencoded, return decoded wire text without
     * `parseQueryString` — for a single `parse(text, { from: 'query' })` pass.
     * Sets `req._bodyContentType` when sniffing. Returns `undefined` when not urlencoded
     * (caller should use {@link getBody}).
     */
    public static async tryGetUrlEncodedText(
        req            : AugmentedRequest,
        securityConfig?: SecurityOptions
    ): Promise<string | undefined>
    {
        if( '_json' in req )
        {
            // Already consumed as a structured body — cannot recover wire text.
            return undefined;
        }

        const declared = getContentType( req );
        const raw = await this.getRawBody( req, securityConfig );

        if( !raw.byteLength ){ return undefined }

        if( declared === 'application/x-www-form-urlencoded' )
        {
            return decodeBodyText( raw );
        }

        if( declared )
        {
            return undefined;
        }

        // Sniff like getBody, but keep urlencoded as text for the typed parser path.
        const text = decodeBodyText( raw );

        try
        {
            JSON.parse( text );
            req._bodyContentType = 'application/json';

            return undefined;
        }
        catch
        {
            // fall through
        }

        if( looksLikeUrlEncoded( text ))
        {
            req._bodyContentType = 'application/x-www-form-urlencoded';

            return text;
        }

        return undefined;
    }

    /**
     * When the body is (or sniffs as) JSON, return decoded wire text without
     * `JSON.parse` — for a single `parse(text, { from: 'json' })` pass.
     * Sets `req._bodyContentType` when sniffing. Returns `undefined` when not JSON.
     */
    public static async tryGetJsonText(
        req            : AugmentedRequest,
        securityConfig?: SecurityOptions
    ): Promise<string | undefined>
    {
        if( '_json' in req )
        {
            return undefined;
        }

        const declared = getContentType( req );
        const raw = await this.getRawBody( req, securityConfig );

        if( !raw.byteLength ){ return undefined }

        const text = decodeBodyText( raw );

        if( isJsonContentType( declared ))
        {
            return text;
        }

        if( declared )
        {
            return undefined;
        }

        try
        {
            JSON.parse( text );
            req._bodyContentType = 'application/json';

            return text;
        }
        catch
        {
            return undefined;
        }
    }

    public static async getBody( req: AugmentedRequest, securityConfig?: SecurityOptions ): Promise<any> 
    {
        if( '_json' in req ) { return req._json }
        const raw = await this.getRawBody( req, securityConfig );

        if( !raw.byteLength ){ return req._json = undefined }

        const contentType = getContentType( req );
        const contentTypeHeader = req.headers.get( 'content-type' );

        if( contentType === 'text/plain' )
        {
            return req._json = decodeBodyText( raw, getContentTypeCharset( contentTypeHeader ));
        }

        // JSON / urlencoded / sniff: UTF-8 (charset on those types is almost always utf-8)
        const text = decodeBodyText( raw );

        if( !contentType )
        {
            const sniffed = sniffBody( text, req.reviver );
            req._bodyContentType = sniffed.contentType;

            return req._json = sniffed.value;
        }

        if( contentType === 'application/x-www-form-urlencoded' )
        {
            return req._json = parseAnyQuery( text, req.reviver );
        }

        if( isJsonContentType( contentType ))
        {
            return req._json = parseAnyJson( text, req.reviver );
        }

        unsupportedMediaType( contentType );
    }

    public static async getRawBody( req: AugmentedRequest, securityConfig?: SecurityOptions ): Promise<ArrayBuffer> 
    {
        if( req._raw !== undefined ) { return req._raw }
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
            return req._raw = await readStreamWithLimit( req.body as ReadableStream<Uint8Array>, limit, label );
        }

        const buffer = await req.arrayBuffer();

        if( limit !== undefined && buffer.byteLength > limit ) 
        {
            payloadTooLarge( label );
        }

        return req._raw = buffer;
    }
}
