/**
 * Minimal HTTP header / Content-Type parameter parsing for multipart parts.
 * Sticky-regex walk + one-slot value cache (liqd-js/http-header-parser strategy).
 * Parameter / part splitting is a linear scanner (no nested-quantifier ReDoS).
 */

// Numbered groups avoid allocating a `groups` object on every match.
const HEADER_RE = /([\w-]+):\s*(.*?)(\r\n(?![\t ])|$)/sy;
const CONTINUATION_RE = /[\t ]*\r\n[\t ]+/g;

function unescapeValue( str: string ): string
{
    if( str.length === 0 || str.charCodeAt( 0 ) !== 0x22 /* " */ )
    {
        return str;
    }

    const hasClosingQuote = str.length >= 2 && str.charCodeAt( str.length - 1 ) === 0x22;
    const end = hasClosingQuote ? str.length - 1 : str.length;

    if( str.indexOf( '\\' ) === -1 )
    {
        return str.slice( 1, end );
    }

    let out = '';

    for( let i = 1; i < end; i++ )
    {
        const c = str.charCodeAt( i );

        if( c === 0x5c /* \ */ && i + 1 < str.length )
        {
            i++;

            if( i < end || !hasClosingQuote )
            {
                out += str[i];
            }
            else
            {
                // Escaped trailing quote `"foo\"` (unterminated quoted-string): keep literal `"`
                out += '"';
            }
        }
        else
        {
            out += str[i];
        }
    }

    return out;
}

function isWs( c: number ): boolean
{
    return c === 0x20 || c === 0x09;
}

/**
 * Scan one semicolon-delimited part starting at `i` (O(n) over the slice).
 * Quoted segments may contain `;`. Returns null at end-of-string after whitespace.
 */
function scanHeaderPart( value: string, i: number ): { token : string, next : number } | null
{
    const n = value.length;

    while( i < n && isWs( value.charCodeAt( i )))
    {
        i++;
    }

    if( i >= n ){ return null }

    const start = i;
    let inQuote = false;
    let escaped = false;

    while( i < n )
    {
        const c = value.charCodeAt( i );

        if( inQuote )
        {
            if( escaped )
            {
                escaped = false;
            }
            else if( c === 0x5c /* \ */ )
            {
                escaped = true;
            }
            else if( c === 0x22 /* " */ )
            {
                inQuote = false;
            }
        }
        else if( c === 0x22 /* " */ )
        {
            inQuote = true;
        }
        else if( c === 0x3b /* ; */ )
        {
            break;
        }

        i++;
    }

    let end = i;

    while( end > start && isWs( value.charCodeAt( end - 1 )))
    {
        end--;
    }

    const token = value.slice( start, end );
    let next = i;

    if( next < n && value.charCodeAt( next ) === 0x3b )
    {
        next++;
    }

    return { token, next };
}

/**
 * Split `key=value` with optional quotes (O(n)). Returns null when no `=` outside quotes.
 */
function splitParameter( token: string ): { key : string, val : string } | null
{
    const n = token.length;
    let i = 0;
    const keyStart = 0;
    let inQuote = false;
    let escaped = false;
    let eq = -1;

    while( i < n )
    {
        const c = token.charCodeAt( i );

        if( inQuote )
        {
            if( escaped )
            {
                escaped = false;
            }
            else if( c === 0x5c )
            {
                escaped = true;
            }
            else if( c === 0x22 )
            {
                inQuote = false;
            }
        }
        else if( c === 0x22 )
        {
            inQuote = true;
        }
        else if( c === 0x3d /* = */ )
        {
            eq = i;

            break;
        }

        i++;
    }

    if( eq === -1 ){ return null }

    let keyEnd = eq;

    while( keyEnd > keyStart && isWs( token.charCodeAt( keyEnd - 1 )))
    {
        keyEnd--;
    }

    if( keyEnd <= keyStart ){ return null }

    let v = eq + 1;

    while( v < n && isWs( token.charCodeAt( v )))
    {
        v++;
    }

    if( n <= v ){ return null }

    return { key : token.slice( keyStart, keyEnd ), val : token.slice( v, n ) };
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
    let i = 0;

    while( i < value.length )
    {
        const scanned = scanHeaderPart( value, i );

        if( !scanned ){ break }

        const { token, next } = scanned;

        if( token.length > 0 )
        {
            const parameter = splitParameter( token );

            if( parameter )
            {
                parts.push({ [unescapeValue( parameter.key )] : unescapeValue( parameter.val ) });
            }
            else
            {
                parts.push( unescapeValue( token ));
            }
        }

        if( next <= i ){ break }

        i = next;
    }

    cacheValueRaw = value;
    cacheValueParsed = parts;

    return parts;
}

export function parseHeaderValueParameter( value: string | undefined, parameter: string ): string | undefined
{
    if( !value ){ return undefined }

    const parts = parseHeaderValue( value );
    const targetLower = parameter.toLowerCase();

    for( let i = 0; i < parts.length; i++ )
    {
        const part = parts[i];

        if( typeof part !== 'object' ){ continue }

        if( Object.hasOwn( part, parameter ))
        {
            return part[parameter];
        }

        const keys = Object.keys( part );

        for( let k = 0; k < keys.length; k++ )
        {
            if( keys[k].toLowerCase() === targetLower )
            {
                return part[keys[k]];
            }
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

        if( Object.hasOwn( part, 'name' ) && out.name === undefined )
        {
            out.name = part.name;
            continue;
        }

        if( Object.hasOwn( part, 'filename' ) && out.filename === undefined )
        {
            out.filename = part.filename;
            continue;
        }

        const keys = Object.keys( part );

        for( let k = 0; k < keys.length; k++ )
        {
            const lower = keys[k].toLowerCase();

            if( lower === 'name' && out.name === undefined )
            {
                out.name = part[keys[k]];
            }
            else if( lower === 'filename' && out.filename === undefined )
            {
                out.filename = part[keys[k]];
            }
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

    if( type !== 'multipart' && type.toLowerCase() !== 'multipart' ){ return undefined }

    // Common unquoted form: `; boundary=----WebKit...` (verify preceding `;` so `notboundary=` never matches)
    const marker = 'boundary=';
    const hayLower = contentType.includes( marker ) ? contentType : contentType.toLowerCase();
    let searchFrom = slash;
    let idx = -1;

    while( searchFrom < hayLower.length )
    {
        const found = hayLower.indexOf( marker, searchFrom );

        if( found === -1 ){ break }

        let p = found - 1;

        while( p > slash && isWs( contentType.charCodeAt( p )))
        {
            p--;
        }

        if( contentType.charCodeAt( p ) === 0x3b /* ; */ )
        {
            idx = found;
            break;
        }

        searchFrom = found + 1;
    }

    if( idx === -1 ){ return parseHeaderValueParameter( contentType, 'boundary' ) }

    const start = idx + marker.length;
    let end = contentType.length;

    if( contentType[start] === '"' || start >= contentType.length || isWs( contentType.charCodeAt( start )))
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
