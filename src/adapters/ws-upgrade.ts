import { parseQueryString } from '@webergency-utils/typechecker/runtime';
import { queryStringFromUrl } from '../helpers/query-string.js';
import { DEFAULT_MAX_WS_PAYLOAD } from '../helpers/ws-frame.js';

export { DEFAULT_MAX_WS_PAYLOAD };

const WS_KEY_RE = /^[A-Za-z0-9+/]{22}==$/;

/** Validate RFC 6455 §4.1 16-byte base64 `Sec-WebSocket-Key`. */
export function isValidWsHandshakeKey( wsKey: string ): boolean
{
    return WS_KEY_RE.test( wsKey.trim());
}

/** Truncate a WebSocket close reason to RFC 6455's 123 UTF-8 byte limit without splitting code points. */
export function truncateWsReason( reason: string, maxBytes = 123 ): string
{
    if( Buffer.byteLength( reason, 'utf8' ) <= maxBytes )
    {
        return reason;
    }

    let out = '';
    let used = 0;

    for( const ch of reason )
    {
        const chBytes = Buffer.byteLength( ch, 'utf8' );

        if( used + chBytes > maxBytes )
        {
            break;
        }

        out += ch;
        used += chBytes;
    }

    return out;
}

/**
 * Query bag of an upgrade request, parsed from the raw URL search (not
 * `URLSearchParams`) so `@Query` on a `@Ws` handler matches HTTP query parse.
 */
export function upgradeQuery( request: Request ): Record<string, any>
{
    const handedOffReq = ( request as any )?.__wsRequestContext?.request;

    if( handedOffReq )
    {
        return handedOffReq.query;
    }

    return parseQueryString( queryStringFromUrl( request.url ));
}

/**
 * True when an inbound WebSocket message exceeds `maxPayload` bytes.
 * Shared by Bun and Deno adapters (Node enforces `maxPayload` inside `WebsocketFrame.read`).
 */
export function isWsPayloadTooLarge( data: unknown, maxPayload: number | undefined ): boolean
{
    if( maxPayload === undefined )
    {
        return false;
    }

    if( typeof data === 'string' )
    {
        return Buffer.byteLength( data ) > maxPayload;
    }

    if( data && typeof data === 'object' )
    {
        const sized = data as { byteLength? : number, size? : number, length? : number };
        const len = sized.byteLength !== undefined
            ? sized.byteLength
            : ( sized.size !== undefined ? sized.size : ( sized.length ?? 0 ));

        return len > maxPayload;
    }

    return false;
}

