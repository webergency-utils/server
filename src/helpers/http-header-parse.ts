/**
 * Minimal HTTP header / Content-Type parameter parsing for multipart parts.
 * Sticky-regex walk + one-slot value cache (liqd-js/http-header-parser strategy).
 */

// Numbered groups avoid allocating a `groups` object on every match.
const HEADER_RE = /([\w-]+):\s*(.*?)(\r\n(?![\t ])|$)/sy;
const CONTINUATION_RE = /[\t ]*\r\n[\t ]+/g;
const HEADER_PART_RE = /\s*(([^;]|"(\\.|[^"\\])+")+)\s*(;|$)/y;
const PARAMETER_RE = /^\s*((?:[^=]|"(\\.|[^"\\])+")+?)\s*=\s*((?:[^=]|"(\\.|[^"\\])+")+?)\s*$/;

function unescapeValue( str: string ): string
{
    return str[0] === '"' ? JSON.parse( str ) : str;
}

export function parseHeaders( headerBlock: string ): Record<string, string>
{
    const headers: Record<string, string> = {};
    let caret = 0;

    HEADER_RE.lastIndex = 0;

    let entry: RegExpExecArray | null;

    while(( entry = HEADER_RE.exec( headerBlock )))
    {
        const name = entry[1].toLowerCase();
        const value = entry[2].replace( CONTINUATION_RE, ' ' );
        headers[name] = value;
        HEADER_RE.lastIndex = ( caret += entry[0].length );
    }

    return headers;
}

/** Last-value cache — multipart often asks for `name` then `filename` on the same string. */
let cacheValueRaw: string | undefined;
let cacheValueParsed: Array<string | Record<string, string>> | undefined;

export function parseHeaderValue( value: string ): Array<string | Record<string, string>>
{
    if( cacheValueRaw === value && cacheValueParsed )
    {
        return cacheValueParsed;
    }

    const parts: Array<string | Record<string, string>> = [];

    HEADER_PART_RE.lastIndex = 0;

    let part: RegExpExecArray | null;

    while(( part = HEADER_PART_RE.exec( value )))
    {
        const token = part[1];
        const parameter = token.match( PARAMETER_RE );

        if( parameter )
        {
            parts.push({ [unescapeValue( parameter[1])] : unescapeValue( parameter[3]) });
        }
        else
        {
            parts.push( unescapeValue( token ));
        }
    }

    cacheValueRaw = value;
    cacheValueParsed = parts;

    return parts;
}

export function parseHeaderValueParameter( value: string | undefined, parameter: string ): string | undefined
{
    if( !value ){ return undefined }

    const parts = parseHeaderValue( value );

    for( let i = 0; i < parts.length; i++ )
    {
        const part = parts[i];

        if( typeof part === 'object' && parameter in part )
        {
            return part[parameter];
        }
    }

    return undefined;
}

export type ContentDisposition =
{
    name?     : string
    filename? : string
};

/** One pass for the multipart hot path (`name` + `filename`). */
export function parseContentDisposition( value: string | undefined ): ContentDisposition
{
    if( !value ){ return {} }

    const parts = parseHeaderValue( value );
    const out: ContentDisposition = {};

    for( let i = 0; i < parts.length; i++ )
    {
        const part = parts[i];

        if( typeof part !== 'object' ){ continue }

        if( 'name' in part && out.name === undefined )
        {
            out.name = part.name;
        }

        if( 'filename' in part && out.filename === undefined )
        {
            out.filename = part.filename;
        }
    }

    return out;
}

/**
 * Extract multipart boundary without allocating a full value-parse when possible.
 * Falls back to the cached parameter parser for quoted / exotic forms.
 */
export function extractMultipartBoundary( contentType: string | null | undefined ): string | undefined
{
    if( !contentType ){ return undefined }

    // Fast reject without lowercasing the whole header
    const slash = contentType.indexOf( '/' );

    if( slash < 1 ){ return undefined }

    const type = contentType.slice( 0, slash );

    if( type.length !== 9 ){ return undefined } // 'multipart'.length

    if( type.toLowerCase() !== 'multipart' ){ return undefined }

    // Common unquoted form: boundary=----WebKit...
    const marker = 'boundary=';
    const idx = contentType.toLowerCase().indexOf( marker );

    if( idx === -1 ){ return undefined }

    let start = idx + marker.length;
    let end = contentType.length;

    if( contentType[start] === '"' )
    {
        return parseHeaderValueParameter( contentType, 'boundary' );
    }

    for( let i = start; i < contentType.length; i++ )
    {
        const ch = contentType.charCodeAt( i );

        if( ch === 0x3b /* ; */ || ch === 0x20 /* space */ || ch === 0x09 /* tab */ )
        {
            end = i;

            break;
        }
    }

    const boundary = contentType.slice( start, end );

    return boundary || undefined;
}

/** Test helper — clear the one-slot value cache. */
export function clearHeaderValueCache()
{
    cacheValueRaw = undefined;
    cacheValueParsed = undefined;
}
