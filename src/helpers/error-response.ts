import { httpStatusFromError } from '../errors.js';

export const REDACTED = '********';
export const SECRET_KEYS =
[
    'password',
    'confirmPassword',
    'secret',
    'clientSecret',
    'privateKey',
    'token',
    'accessToken',
    'refreshToken',
    'apiKey',
    'api_key',
    'authorization',
    'cookie',
    'set-cookie'
];
function normalizeSecretKey( key: string ): string
{
    return key.toLowerCase().replace( /[_-]/g, '' );
}

const SECRET_KEYS_NORMALIZED = new Set<string>( SECRET_KEYS.map( normalizeSecretKey ));

export function redactSecrets<T>( value: T ): T
{
    return redact( value, new WeakSet()) as T;
}

export function clientErrorBody( err: unknown, status = httpStatusFromError( err ), exposeErrors = false ): Record<string, any>
{
    const e = asErrorRecord( err );
    const data = e.data && typeof e.data === 'object' && !Array.isArray( e.data )
        ? e.data
        : undefined;

    if( data )
    {
        const body = { ...data };

        delete body.stack;

        if( status >= 500 )
        {
            delete body.debug;
        }

        return redactSecrets( body );
    }

    if( status >= 500 && !exposeErrors )
    {
        return {
            success : false,
            error   : 'Internal server error'
        };
    }

    return {
        success : false,
        error   : typeof e.message === 'string' && e.message ? e.message : 'Internal server error'
    };
}

export type ErrorLogFields =
    {
        name    : string
        message : string
        status  : number
        data?   : unknown
        stack?  : string
    };

export function errorLogFields( err: unknown ): ErrorLogFields
{
    const e = asErrorRecord( err );

    return {
        name    : typeof e.name === 'string' && e.name ? e.name : 'Error',
        message : typeof e.message === 'string' ? e.message : '',
        status  : httpStatusFromError( err ),
        data    : e.data !== undefined ? redactSecrets( e.data ) : undefined,
        stack   : e.stack
    };
}

function asErrorRecord( err: unknown ): { name? : string, message? : string, data? : any, stack? : string }
{
    if( err && typeof err === 'object' )
    {
        return err as { name? : string, message? : string, data? : any, stack? : string };
    }

    return { message : err === undefined || err === null ? '' : String( err ) };
}

function redact( value: unknown, activeAncestors: WeakSet<object> ): unknown
{
    if( value === null || typeof value !== 'object' )
    {
        return value;
    }

    if( value instanceof Date )
    {
        return new Date( value.getTime());
    }

    if( value instanceof RegExp )
    {
        return new RegExp( value.source, value.flags );
    }

    if( value instanceof URL )
    {
        return new URL( value.href );
    }

    if( Buffer.isBuffer( value ) || ArrayBuffer.isView( value ) || value instanceof ArrayBuffer )
    {
        return value;
    }

    if( activeAncestors.has( value ))
    {
        return '[Circular]';
    }

    activeAncestors.add( value );

    try
    {
        if( Array.isArray( value ))
        {
            return value.map(( item ) => redact( item, activeAncestors ));
        }

        const out: Record<string, unknown> = {};
        const keys = Object.keys( value );

        for( let i = 0; i < keys.length; i++ )
        {
            const key = keys[i];

            if( SECRET_KEYS_NORMALIZED.has( normalizeSecretKey( key )))
            {
                out[key] = REDACTED;

                continue;
            }

            out[key] = redact(( value as Record<string, unknown> )[key], activeAncestors );
        }

        return out;
    }
    finally
    {
        activeAncestors.delete( value );
    }
}
