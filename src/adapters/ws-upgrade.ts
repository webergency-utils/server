/**
 * Query string of an upgrade request, flattened the same way in every adapter so a
 * `@Query` parameter on a `@Ws` handler behaves identically across runtimes.
 */
export function upgradeQuery( request: Request ): Record<string, string>
{
    return Object.fromEntries( new URL( request.url ).searchParams.entries());
}
