import { httpStatusFromError } from '../errors.js';

export const REDACTED = '********';
export const SECRET_KEYS = [ 'password', 'confirmPassword' ];

export function redactSecrets<T>( value: T ): T
{
    return redact( value, new WeakSet() ) as T;
}

export function clientErrorBody( err: unknown, status = httpStatusFromError( err ) ): Record<string, any>
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
            delete body.stack;
        }

        return redactSecrets( body );
    }

    return redactSecrets({
        success : false,
        error   : typeof e.message === 'string' && e.message ? e.message : 'Internal server error'
    });
}

export function errorLogFields( err: unknown ): Record<string, unknown>
{
    const e = asErrorRecord( err );

    return {
        name    : e.name,
        message : e.message,
        status  : httpStatusFromError( err ),
        data    : e.data !== undefined ? redactSecrets( cloneJson( e.data ) ) : undefined,
        stack   : e.stack
    };
}

function asErrorRecord( err: unknown ): { name?: string, message?: string, data?: any, stack?: string }
{
    if( err && typeof err === 'object' )
    {
        return err as { name?: string, message?: string, data?: any, stack?: string };
    }

    return { message : err === undefined || err === null ? '' : String( err ) };
}

function cloneJson( value: unknown ): unknown
{
    try
    {
        return JSON.parse( JSON.stringify( value ) );
    }
    catch
    {
        return undefined;
    }
}

function redact( value: unknown, seen: WeakSet<object> ): unknown
{
    if( value === null || typeof value !== 'object' )
    {
        return value;
    }

    if( seen.has( value ) )
    {
        return value;
    }

    seen.add( value );

    if( Array.isArray( value ) )
    {
        return value.map( ( item ) => redact( item, seen ) );
    }

    const out: Record<string, unknown> = {};

    for( const [ key, nested ] of Object.entries( value ) )
    {
        if( SECRET_KEYS.includes( key ) )
        {
            out[key] = REDACTED;

            continue;
        }

        out[key] = redact( nested, seen );
    }

    return out;
}
