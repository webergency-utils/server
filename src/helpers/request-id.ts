import { randomUUID } from 'node:crypto';

export const REQUEST_ID_HEADER = 'x-request-id';
export const MAX_REQUEST_ID_LENGTH = 128;

function isSafeRequestId( value: string ): boolean
{
    if( value.length === 0 || value.length > MAX_REQUEST_ID_LENGTH )
    {
        return false;
    }

    for( let i = 0; i < value.length; i++ )
    {
        const c = value.charCodeAt( i );

        // Printable ASCII (0x20..0x7e) only — rejects CR, LF, NUL, DEL, and non-ASCII log-forging chars.
        if( c < 0x20 || c > 0x7e )
        {
            return false;
        }
    }

    return true;
}

/**
 * Prefer an inbound `X-Request-Id` when present, bounded (<=128 chars), and printable ASCII;
 * otherwise mint a fresh UUID. Callers echo the same value on the response so proxies and clients can correlate.
 */
export function resolveRequestId( request: Request ): string
{
    const incoming = request.headers.get( REQUEST_ID_HEADER )?.trim();

    return incoming && isSafeRequestId( incoming ) ? incoming : randomUUID();
}
