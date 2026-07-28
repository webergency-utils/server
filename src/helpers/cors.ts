import { CorsOptions } from '../decorators.js';

export function matchWildcard( value: string, pattern: string ): boolean 
{
    if( pattern === '*' ) { return true }
    const regexPattern = pattern
        .replace( /[.+^${}()|[\]\\]/g, '\\$&' ) // Escape regex special chars
        .replace( /\*/g, '.*' );               // Convert * to .*

    return new RegExp( `^${regexPattern}$`, 'i' ).test( value );
}

export function isAllowed( value: string, rule: any ): boolean 
{
    if( rule === undefined || rule === null ) { return false } // Deny-by-default

    if( typeof rule === 'function' ) 
    {
        return rule( value );
    }

    if( typeof rule === 'boolean' ) 
    {
        return rule;
    }

    if( typeof rule === 'string' ) 
    {
        return matchWildcard( value, rule );
    }

    if( Array.isArray( rule )) 
    {
        return rule.some( pattern => matchWildcard( value, pattern ));
    }

    return false;
}

export interface CorsHeaders {
    [key: string] : string
}

/**
 * Used when `allowedHeaders` is unset. Requested headers are matched against this instead of
 * being echoed back, so an attacker cannot get an arbitrary header allowlisted by asking for
 * it. Set `allowedHeaders` to replace this list.
 */
export const DEFAULT_ALLOWED_HEADERS = ['Accept', 'Accept-Language', 'Content-Language', 'Content-Type', 'Authorization'];

/**
 * A browser CORS preflight, as opposed to a plain OPTIONS request. Both headers are
 * mandatory on a preflight, so requiring them keeps ordinary OPTIONS requests routable.
 */
export function isPreflight( request: Request ): boolean
{
    return request.method === 'OPTIONS'
        && request.headers.get( 'origin' ) !== null
        && request.headers.get( 'access-control-request-method' ) !== null;
}

export function handleCors( request: Request, config: CorsOptions | undefined ): Response | CorsHeaders | null 
{
    if( !config ) { return null }

    const originHeader = request.headers.get( 'origin' );
  
    // Resolve allowed origin
    const originRule = config.origin === undefined ? '*' : config.origin;
    let allowedOrigin = '';

    if( originHeader ) 
    {
        if( originRule === '*' ) 
        {
            allowedOrigin = '*';
        }
        else if( originRule === true ) 
        {
            allowedOrigin = originHeader;
        }
        else if( isAllowed( originHeader, originRule )) 
        {
            allowedOrigin = originHeader;
        }
    }
    else 
    {
        if( originRule === '*' ) 
        {
            allowedOrigin = '*';
        }
        else if( typeof originRule === 'string' ) 
        {
            allowedOrigin = originRule;
        }
    }

    if( config.credentials && allowedOrigin === '*' ) 
    {
        allowedOrigin = originHeader || '';
    }

    const headers: CorsHeaders = {};

    if( allowedOrigin ) 
    {
        headers['Access-Control-Allow-Origin'] = allowedOrigin;

        // Reflected origins must vary by Origin so shared caches do not reuse ACAO.
        if( allowedOrigin !== '*' ) 
        {
            headers['Vary'] = 'Origin';
        }

        if( config.credentials ) 
        {
            headers['Access-Control-Allow-Credentials'] = 'true';
        }
    }

    // Only a genuine preflight short-circuits with a response; a plain OPTIONS request
    // stays routable and just receives the headers below.
    if( isPreflight( request )) 
    {
        // Without an allowed origin the browser would reject the response anyway; answering
        // 403 makes the rejection explicit rather than looking like a successful preflight.
        if( !allowedOrigin ) 
        {
            return new Response( 'CORS origin not allowed', { status : 403, headers : { Vary : 'Origin' } });
        }

        const reqMethod = request.headers.get( 'access-control-request-method' );

        if( reqMethod ) 
        {
            const methods = config.methods || ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'];

            if( isAllowed( reqMethod, methods )) 
            {
                if( typeof methods === 'function' ) 
                {
                    headers['Access-Control-Allow-Methods'] = reqMethod;
                }
                else 
                {
                    headers['Access-Control-Allow-Methods'] = Array.isArray( methods ) ? methods.join( ', ' ) : methods;
                }
            }
        }

        const reqHeadersStr = request.headers.get( 'access-control-request-headers' );

        if( reqHeadersStr ) 
        {
            const reqHeaders = reqHeadersStr.split( ',' ).map( h => h.trim());
            const allowedHeadersConfig = config.allowedHeaders ?? DEFAULT_ALLOWED_HEADERS;
            const allowedHeaders = reqHeaders.filter( h => isAllowed( h, allowedHeadersConfig ));

            if( allowedHeaders.length > 0 ) 
            {
                headers['Access-Control-Allow-Headers'] = allowedHeaders.join( ', ' );
            }
        }
        else if( config.allowedHeaders && Array.isArray( config.allowedHeaders )) 
        {
            headers['Access-Control-Allow-Headers'] = config.allowedHeaders.join( ', ' );
        }

        if( config.maxAge !== undefined ) 
        {
            headers['Access-Control-Max-Age'] = String( config.maxAge );
        }

        return new Response( null, {
            status  : 204,
            headers : headers as any
        });
    }

    // Actual Request headers
    if( config.exposedHeaders ) 
    {
        headers['Access-Control-Expose-Headers'] = Array.isArray( config.exposedHeaders )
            ? config.exposedHeaders.join( ', ' )
            : config.exposedHeaders;
    }

    return headers;
}
