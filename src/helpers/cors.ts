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
    if( rule === undefined || rule === null ) { return true } // Relaxed default

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

export function handleCors( request: Request, config: CorsOptions | undefined ): Response | CorsHeaders | null 
{
    if( !config ) { return null }

    const method = request.method;
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

    // Preflight Request Check
    if( method === 'OPTIONS' ) 
    {
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
            const allowedHeadersConfig = config.allowedHeaders;
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
