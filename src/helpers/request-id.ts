import { randomUUID } from 'node:crypto';

export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Prefer an inbound `X-Request-Id` when present and non-empty; otherwise mint a UUID.
 * Callers echo the same value on the response so proxies and clients can correlate.
 */
export function resolveRequestId( request: Request ): string
{
    const incoming = request.headers.get( REQUEST_ID_HEADER )?.trim();

    return incoming && incoming.length > 0 ? incoming : randomUUID();
}
