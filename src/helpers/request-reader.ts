import { AugmentedRequest } from '../core/types.js';
import { SecurityOptions } from '../decorators.js';
import { parseSize } from './security.js';
import { QueryParser } from './parsers.js';

export function getContentType( req: AugmentedRequest ): string | null
{
    const raw = req.headers.get( 'content-type' );

    if( !raw ){ return null }

    return raw.split( ';' )[0]?.trim()?.toLowerCase() || null;
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

function parseJsonBody( text: string ): any
{
    try
    {
        return JSON.parse( text );
    }
    catch
    {
        throw Object.assign( new Error( 'Invalid JSON body' ), { status : 400 });
    }
}

/** When Content-Type is absent: try JSON, then urlencoded if the text looks like a form body. */
function sniffBody( text: string ): { value: any; contentType: 'application/json' | 'application/x-www-form-urlencoded' }
{
    try
    {
        return { value : JSON.parse( text ), contentType : 'application/json' };
    }
    catch
    {
        // fall through
    }

    if( looksLikeUrlEncoded( text ))
    {
        return { value : QueryParser.parse( text ), contentType : 'application/x-www-form-urlencoded' };
    }

    throw Object.assign( new Error( 'Unable to parse body without Content-Type' ), { status : 400 });
}

export class RequestReader 
{
    public static async getBody( req: AugmentedRequest, securityConfig?: SecurityOptions ): Promise<any> 
    {
        if( '_json' in req ) { return req._json }
        const raw = await this.getRawBody( req, securityConfig );

        if( !raw.byteLength ){ return req._json = undefined }

        const text = new TextDecoder().decode( raw );
        const contentType = getContentType( req );

        if( !contentType )
        {
            const sniffed = sniffBody( text );
            req._bodyContentType = sniffed.contentType;

            return req._json = sniffed.value;
        }

        if( contentType === 'application/x-www-form-urlencoded' )
        {
            return req._json = QueryParser.parse( text );
        }

        if( contentType === 'application/json' )
        {
            return req._json = parseJsonBody( text );
        }

        unsupportedMediaType( contentType );
    }

    public static async getRawBody( req: AugmentedRequest, securityConfig?: SecurityOptions ): Promise<ArrayBuffer> 
    {
        if( req._raw !== undefined ) { return req._raw }
        const maxSize = securityConfig?.maxBodySize;

        if( maxSize !== undefined ) 
        {
            const limit = parseSize( maxSize );
            const contentLength = req.headers.get( 'content-length' );

            if( contentLength && parseInt( contentLength, 10 ) > limit ) 
            {
                throw Object.assign( new Error( `Payload Too Large (limit: ${maxSize})` ), { status : 413 });
            }
        }
        const buffer = await req.arrayBuffer();

        if( maxSize !== undefined ) 
        {
            const limit = parseSize( maxSize );

            if( buffer.byteLength > limit ) 
            {
                throw Object.assign( new Error( `Payload Too Large (limit: ${maxSize})` ), { status : 413 });
            }
        }

        return req._raw = buffer;
    }
}
