import { parseQueryString } from '@webergency-utils/typechecker/runtime';
import { queryStringFromUrl } from '../helpers/query-string.js';

/**
 * Query bag of an upgrade request, parsed from the raw URL search (not
 * `URLSearchParams`) so `@Query` on a `@Ws` handler matches HTTP query parse.
 */
export function upgradeQuery( request: Request ): Record<string, any>
{
    return parseQueryString( queryStringFromUrl( request.url ) );
}
