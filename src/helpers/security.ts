import { SecurityOptions } from '../decorators.js';

const SIZE_UNITS: Record<string, number> = {
  b  : 1,
  kb : 1024,
  mb : 1024 * 1024,
  gb : 1024 * 1024 * 1024
};

export function parseSize( size: string | number ): number 
{
    if( typeof size === 'number' ) { return size }
    const match = size.trim().toLowerCase().match( /^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)$/ );

    if( !match ) { throw new Error( `Invalid size format: "${size}". Use formats like "2mb", "500kb", "1gb".` ) }

    return Math.floor( parseFloat( match[1]) * SIZE_UNITS[match[2]]);
}

/** RFC-defined `Referrer-Policy` tokens; anything else is dropped rather than emitted. */
const REFERRER_POLICIES = new Set([
    'no-referrer',
    'no-referrer-when-downgrade',
    'origin',
    'origin-when-cross-origin',
    'same-origin',
    'strict-origin',
    'strict-origin-when-cross-origin',
    'unsafe-url'
]);

const CROSS_DOMAIN_POLICIES = new Set([ 'none', 'master-only', 'by-content-type', 'by-ftp-filename', 'all' ]);

export function mergeSecurityConfigs( configs: ( SecurityOptions | boolean | undefined )[]): SecurityOptions | undefined 
{
    let merged: SecurityOptions | undefined = undefined;

    for( const config of configs ) 
    {
        if( config === undefined ) { continue }

        if( config === true ) 
        {
            if( !merged ) { merged = {} }
        }
        else if( config === false ) 
        {
            merged = {
        // `0` disables the default body cap; `security: false` opts out of protection wholesale.
        maxBodySize                  : 0,
        frameguard                   : false,
        noSniff                      : false,
        hsts                         : false,
        downloadOptions              : false,
        permittedCrossDomainPolicies : false,
        referrerPolicy               : false,
        xssFilter                    : false,
        csp                          : false,
        coep                         : false,
        coop                         : false,
        corp                         : false
      };
        }
        else if( typeof config === 'object' ) 
        {
            if( !merged ) { merged = {} }
            merged = { ...merged, ...config };
        }
    }

    return merged;
}

export function generateSecurityHeaders( config: SecurityOptions | boolean | undefined ): Record<string, string> 
{
    if( config === undefined ) { return {} }

    const headers: Record<string, string> = {};
  
    const options: SecurityOptions = config === true ? {} : ( config === false ? {
        frameguard                   : false,
        noSniff                      : false,
        hsts                         : false,
        downloadOptions              : false,
        permittedCrossDomainPolicies : false,
        referrerPolicy               : false,
        xssFilter                    : false,
        csp                          : false,
        coep                         : false,
        coop                         : false,
        corp                         : false
    } : config );

    const isEnabled = ( prop: keyof SecurityOptions ): boolean => 
    {
        return options[prop] !== false;
    };

    // 1. X-Frame-Options (frameguard)
    if( isEnabled( 'frameguard' )) 
    {
        const val = options.frameguard;

        if( val === undefined || val === true || val === 'sameorigin' ) 
        {
            headers['X-Frame-Options'] = 'SAMEORIGIN';
        }
        else if( val === 'deny' ) 
        {
            headers['X-Frame-Options'] = 'DENY';
        }
        else if( typeof val === 'object' ) 
        {
            const action = typeof val.action === 'string' ? val.action.toLowerCase() : '';

            // ALLOW-FROM is obsolete and incomplete without a domain; only emit valid values.
            if( action === 'deny' || action === 'sameorigin' )
            {
                headers['X-Frame-Options'] = action.toUpperCase();
            }
        }
    }

    // 2. X-Content-Type-Options (noSniff)
    if( isEnabled( 'noSniff' )) 
    {
        headers['X-Content-Type-Options'] = 'nosniff';
    }

    // 3. Strict-Transport-Security (hsts)
    if( isEnabled( 'hsts' )) 
    {
        const val = options.hsts;

        if( val === undefined || val === true ) 
        {
            headers['Strict-Transport-Security'] = 'max-age=15552000; includeSubDomains';
        }
        else if( typeof val === 'object' ) 
        {
            const maxAge = val.maxAge !== undefined ? val.maxAge : 15552000;
            const includeSubDomains = val.includeSubDomains !== false;
            const preload = !!val.preload;
            headers['Strict-Transport-Security'] = `max-age=${maxAge}${includeSubDomains ? '; includeSubDomains' : ''}${preload ? '; preload' : ''}`;
        }
    }

    // 4. X-Download-Options (downloadOptions)
    if( isEnabled( 'downloadOptions' )) 
    {
        headers['X-Download-Options'] = 'noopen';
    }

    // 5. X-Permitted-Cross-Domain-Policies (permittedCrossDomainPolicies)
    if( isEnabled( 'permittedCrossDomainPolicies' )) 
    {
        const val = options.permittedCrossDomainPolicies;

        if( val === undefined || val === true ) 
        {
            headers['X-Permitted-Cross-Domain-Policies'] = 'none';
        }
        else if( typeof val === 'string' && CROSS_DOMAIN_POLICIES.has( val )) 
        {
            headers['X-Permitted-Cross-Domain-Policies'] = val;
        }
    }

    // 6. Referrer-Policy (referrerPolicy)
    if( isEnabled( 'referrerPolicy' )) 
    {
        const val = options.referrerPolicy;

        if( val === undefined || val === true ) 
        {
            headers['Referrer-Policy'] = 'no-referrer';
        }
        else if( typeof val === 'string' && REFERRER_POLICIES.has( val )) 
        {
            headers['Referrer-Policy'] = val;
        }
    }

    // 7. X-XSS-Protection (xssFilter)
    if( isEnabled( 'xssFilter' )) 
    {
        headers['X-XSS-Protection'] = '0';
    }

    // 8. Content-Security-Policy (csp - Disabled by default)
    if( options.csp ) 
    {
        const val = options.csp;

        if( val === true ) 
        {
            headers['Content-Security-Policy'] = "default-src 'self'";
        }
        else if( typeof val === 'string' ) 
        {
            headers['Content-Security-Policy'] = val;
        }
        else if( typeof val === 'object' ) 
        {
            const parts: string[] = [];

            for( const [directive, sources] of Object.entries( val )) 
            {
                if( Array.isArray( sources )) 
                {
                    parts.push( `${directive} ${sources.join( ' ' )}` );
                }
                else 
                {
                    parts.push( `${directive} ${sources}` );
                }
            }
            headers['Content-Security-Policy'] = parts.join( '; ' );
        }
    }

    // 9. Cross-Origin-Embedder-Policy (coep - Disabled by default)
    if( options.coep ) 
    {
        headers['Cross-Origin-Embedder-Policy'] = options.coep === true ? 'require-corp' : options.coep;
    }

    // 10. Cross-Origin-Opener-Policy (coop - Disabled by default)
    if( options.coop ) 
    {
        headers['Cross-Origin-Opener-Policy'] = options.coop === true ? 'same-origin' : options.coop;
    }

    // 11. Cross-Origin-Resource-Policy (corp - Disabled by default)
    if( options.corp ) 
    {
        headers['Cross-Origin-Resource-Policy'] = options.corp === true ? 'same-origin' : options.corp;
    }

    // 12. Permissions-Policy (permissionsPolicy - Disabled by default)
    if( options.permissionsPolicy ) 
    {
        const val = options.permissionsPolicy;

        if( val === true ) 
        {
            // Deny the most commonly abused features.
            headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()';
        }
        else if( typeof val === 'string' ) 
        {
            headers['Permissions-Policy'] = val;
        }
        else if( typeof val === 'object' ) 
        {
            const parts: string[] = [];

            for( const [ feature, allowlist ] of Object.entries( val )) 
            {
                const origins = Array.isArray( allowlist ) ? allowlist : [allowlist];
                parts.push( `${feature}=(${origins.join( ' ' )})` );
            }

            if( parts.length > 0 ) { headers['Permissions-Policy'] = parts.join( ', ' ) }
        }
    }

    return headers;
}
