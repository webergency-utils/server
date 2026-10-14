/**
 * Query text for typechecker `from: 'query'` — never starts with `?`.
 * Reads the raw URL (`IncomingMessage.url` path+query or `Request.url`) so adapters
 * do not go through `URLSearchParams` (lossy on duplicates / encoding).
 */
export function queryStringFromUrl( url: string ): string
{
    const q = url.indexOf( '?' );

    if( q === -1 ){ return '' }

    const hash = url.indexOf( '#', q + 1 );

    return hash === -1 ? url.slice( q + 1 ) : url.slice( q + 1, hash );
}

/**
 * Extract the URL pathname without allocating a `new URL(...)` object.
 * Handles both full URLs (`http://host/path?x=1`) and origin-relative paths (`/path?x=1`).
 */
export function pathnameFromUrl( url: string ): string
{
    let start = 0;
    const schemeIdx = url.indexOf( '://' );

    if( schemeIdx !== -1 )
    {
        const slashIdx = url.indexOf( '/', schemeIdx + 3 );

        if( slashIdx === -1 )
        {
            return '/';
        }

        start = slashIdx;
    }

    let end = url.length;
    const q = url.indexOf( '?', start );

    if( q !== -1 )
    {
        end = q;
    }

    const hash = url.indexOf( '#', start );

    if( hash !== -1 && hash < end )
    {
        end = hash;
    }

    const path = url.slice( start, end );

    return path || '/';
}

/** Concatenate two search strings (neither may start with `?`). */
export function joinQueryStrings( left: string, right: string ): string
{
    if( !left ){ return right }

    if( !right ){ return left }

    return `${left}&${right}`;
}

/**
 * Serialize a query bag back to search text without `URLSearchParams`.
 * Booleans `true` become flag keys (no `=`), matching `parseQueryString`.
 */
export function queryStringFromBag( bag: Record<string, unknown> ): string
{
    const parts: string[] = [];

    for( const key of Object.keys( bag ))
    {
        const value = bag[key];

        if( value === undefined ){ continue }

        const encKey = encodeURIComponent( key );

        if( Array.isArray( value ))
        {
            for( const item of value )
            {
                parts.push( `${encKey}=${encodeURIComponent( String( item ))}` );
            }
        }
        else if( value === true )
        {
            parts.push( encKey );
        }
        else
        {
            parts.push( `${encKey}=${encodeURIComponent( String( value ))}` );
        }
    }

    return parts.join( '&' );
}
