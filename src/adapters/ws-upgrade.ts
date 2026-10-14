import { parseQueryString } from '@webergency-utils/typechecker/runtime';
import { queryStringFromUrl } from '../helpers/query-string.js';

/**
 * Query bag of an upgrade request, parsed from the raw URL search (not
 * `URLSearchParams`) so `@Query` on a `@Ws` handler matches HTTP query parse.
 */
export function upgradeQuery( request: Request ): Record<string, any>
{
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
        const sized = data as { byteLength? : number, length? : number };
        const len = sized.byteLength !== undefined ? sized.byteLength : ( sized.length ?? 0 );

        return len > maxPayload;
    }

    return false;
}

