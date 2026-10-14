import { CorsOptions } from '../decorators.js';

const wildcardRegexCache = new Map<string, RegExp>();

export function matchWildcard( value: string, pattern: string ): boolean 
{
    if( pattern === '*' ) { return true }

    if( !pattern.includes( '*' ))
    {
        return value.toLowerCase() === pattern.toLowerCase();
    }

    let regex = wildcardRegexCache.get( pattern );

    if( !regex )
    {
        const regexPattern = pattern
            .replace( /[.+^${}()|[\]\\]/g, '\\$&' ) // Escape regex special chars
            .replace( /\*/g, '.*' );               // Convert * to .*
        regex = new RegExp( `^${regexPattern}$`, 'i' );
        wildcardRegexCache.set( pattern, regex );
    }

    return regex.test( value );
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

const DEFAULT_METHODS = [ 'GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE' ];
const DEFAULT_METHODS_STR = 'GET, HEAD, PUT, PATCH, POST, DELETE';

interface CompiledCors {
    originRule         : any
    methods            : any
    methodsStr         : string | undefined
    allowedHeadersRule : any
    allowedHeadersStr  : string | undefined
    exposedHeadersStr  : string | undefined
    maxAgeStr          : string | undefined
    staticNonPreflight : CorsHeaders | undefined
}

const compiledCorsCache = new WeakMap<CorsOptions, CompiledCors>();

function getCompiledCors( config: CorsOptions ): CompiledCors
{
    let compiled = compiledCorsCache.get( config );

    if( compiled ) { return compiled }

    const originRule = config.origin === undefined ? '*' : config.origin;
    const methods = config.methods || DEFAULT_METHODS;
    let methodsStr: string | undefined;

    if( Array.isArray( methods ))
    {
        methodsStr = methods === DEFAULT_METHODS ? DEFAULT_METHODS_STR : methods.join( ', ' );
    }
    else if( typeof methods === 'string' )
    {
        methodsStr = methods;
    }

    const allowedHeadersRule = config.allowedHeaders ?? DEFAULT_ALLOWED_HEADERS;
    const allowedHeadersStr = config.allowedHeaders && Array.isArray( config.allowedHeaders )
        ? config.allowedHeaders.join( ', ' )
        : undefined;

    const exposedHeadersStr = config.exposedHeaders
        ? ( Array.isArray( config.exposedHeaders ) ? config.exposedHeaders.join( ', ' ) : config.exposedHeaders )
        : undefined;

    const maxAgeStr = config.maxAge !== undefined ? String( config.maxAge ) : undefined;

    let staticNonPreflight: CorsHeaders | undefined;

    if( originRule === '*' && !config.credentials )
    {
        staticNonPreflight = { 'Access-Control-Allow-Origin' : '*' };

        if( exposedHeadersStr )
        {
            staticNonPreflight['Access-Control-Expose-Headers'] = exposedHeadersStr;
        }
    }

    compiled = {
        originRule,
        methods,
        methodsStr,
        allowedHeadersRule,
        allowedHeadersStr,
        exposedHeadersStr,
        maxAgeStr,
        staticNonPreflight
    };
    compiledCorsCache.set( config, compiled );

    return compiled;
}

export function handleCors( request: Request, config: CorsOptions | undefined ): Response | CorsHeaders | null 
{
    if( !config ) { return null }

    const compiled = getCompiledCors( config );
    const preflight = isPreflight( request );

    if( !preflight && compiled.staticNonPreflight )
    {
        return compiled.staticNonPreflight;
    }

    const originHeader = request.headers.get( 'origin' );
    const originRule = compiled.originRule;
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
    if( preflight ) 
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
            if( isAllowed( reqMethod, compiled.methods )) 
            {
                headers['Access-Control-Allow-Methods'] = compiled.methodsStr ?? reqMethod;
            }
        }

        const reqHeadersStr = request.headers.get( 'access-control-request-headers' );

        if( reqHeadersStr ) 
        {
            const reqHeaders = reqHeadersStr.split( ',' ).map( h => h.trim());
            const allowedHeaders = reqHeaders.filter( h => isAllowed( h, compiled.allowedHeadersRule ));

            if( allowedHeaders.length > 0 ) 
            {
                headers['Access-Control-Allow-Headers'] = allowedHeaders.join( ', ' );
            }
        }
        else if( compiled.allowedHeadersStr ) 
        {
            headers['Access-Control-Allow-Headers'] = compiled.allowedHeadersStr;
        }

        if( compiled.maxAgeStr !== undefined ) 
        {
            headers['Access-Control-Max-Age'] = compiled.maxAgeStr;
        }

        return new Response( null, {
            status  : 204,
            headers : headers as any
        });
    }

    // Actual Request headers
    if( compiled.exposedHeadersStr ) 
    {
        headers['Access-Control-Expose-Headers'] = compiled.exposedHeadersStr;
    }

    return headers;
}
