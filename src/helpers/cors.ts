import { CorsOptions } from '../decorators.js';
import { mergeOptionObjects } from './security.js';

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

export type CorsConfigInput = CorsOptions | boolean | string | null | undefined;

export function mergeCorsConfigs( configs: CorsConfigInput[]): CorsOptions | undefined
{
    let merged: CorsOptions | undefined = undefined;

    for( const config of configs )
    {
        if( config === undefined ) { continue }

        if( config === false || config === null )
        {
            merged = undefined;
        }
        else if( config === true )
        {
            merged = {};
        }
        else if( typeof config === 'string' )
        {
            merged = { ...( merged || {}), origin : config };
        }
        else if( typeof config === 'object' )
        {
            if( Object.keys( config ).length === 0 )
            {
                merged = {};
            }
            else
            {
                merged = merged ? mergeOptionObjects( merged, config ) : { ...config };
            }
        }
    }

    return merged;
}

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
    const rawMethods = config.methods === undefined ? DEFAULT_METHODS : config.methods;
    let methods: any = rawMethods;
    let methodsStr: string | undefined;

    if( Array.isArray( rawMethods ))
    {
        methodsStr = rawMethods === DEFAULT_METHODS ? DEFAULT_METHODS_STR : rawMethods.join( ', ' );
    }
    else if( typeof rawMethods === 'string' )
    {
        methodsStr = rawMethods;
        methods = rawMethods.split( ',' ).map( m => m.trim()).filter( Boolean );
    }

    let allowedHeadersRule: any = DEFAULT_ALLOWED_HEADERS;
    let allowedHeadersStr: string | undefined;

    if( Array.isArray( config.allowedHeaders ))
    {
        allowedHeadersRule = config.allowedHeaders;
        allowedHeadersStr = config.allowedHeaders.join( ', ' );
    }
    else if( typeof config.allowedHeaders === 'string' )
    {
        allowedHeadersRule = config.allowedHeaders === '*'
            ? '*'
            : config.allowedHeaders.split( ',' ).map( h => h.trim()).filter( Boolean );
        allowedHeadersStr = config.allowedHeaders === '*' ? undefined : config.allowedHeaders;
    }

    const exposedHeadersStr = config.exposedHeaders
        ? ( Array.isArray( config.exposedHeaders ) ? config.exposedHeaders.join( ', ' ) : config.exposedHeaders )
        : undefined;

    const maxAgeStr = ( config.maxAge !== undefined && config.maxAge !== false )
        ? String( config.maxAge )
        : undefined;

    let staticNonPreflight: CorsHeaders | undefined;

    if( originRule === '*' && !config.credentials )
    {
        staticNonPreflight = { 'Access-Control-Allow-Origin' : '*' };

        if( exposedHeadersStr )
        {
            staticNonPreflight['Access-Control-Expose-Headers'] = exposedHeadersStr;
        }

        Object.freeze( staticNonPreflight );
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
        // Never reflect arbitrary Origins when configured with wildcard '*' + credentials.
        // Callers wanting credentialed reflection must opt in explicitly via `origin: true` or an allowlist.
        allowedOrigin = '';
    }

    const headers: CorsHeaders = {};

    // Non-wildcard origin policies must always vary by Origin (even when disallowed or absent)
    // so shared caches do not serve an uncredentialed/disallowed response to an allowed Origin or vice versa.
    if( originRule !== '*' )
    {
        headers['Vary'] = 'Origin';
    }

    if( allowedOrigin ) 
    {
        headers['Access-Control-Allow-Origin'] = allowedOrigin;

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
