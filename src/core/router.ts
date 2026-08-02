import { Method, EndpointMetadata } from './types.js';
import { pathMatcher, parse, MatchFunction, Token } from '../helpers/match.js';

export interface Route {
    method   : Method
    path     : string
    metadata : EndpointMetadata
    matchFn  : MatchFunction<any>
}

export interface RouteMatch {
    metadata : EndpointMetadata
    params   : Record<string, any>
}

/**
 * One lookup answers three questions: did the requested method match, and if not, does any
 * other method serve this path (405 + `Allow`) or none at all (404).
 */
export interface RouteLookup {
    match    : RouteMatch | null
    /** Populated only when `match` is null and some other method serves the path. */
    allowed  : string[]
    /**
     * The first route matching the path under a different method. OPTIONS handling reads its
     * CORS / security metadata so a preflight is answered with the target route's config.
     */
    fallback : RouteMatch | null
}

/** Verbs an `ALL` route answers. WS and RPC are transport-specific and never advertised. */
const ALL_EXPANDED = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
const NON_HTTP_METHODS = new Set<string>(['WS', 'RPC']);

const NO_METHODS: string[] = [];

/**
 * Normalize registered route methods into an `Allow` list: `ALL` expands, HEAD is implied
 * by GET, and OPTIONS is always supported. Empty when nothing HTTP-facing was registered.
 */
export function toAllowList( methods: Iterable<string> ): string[]
{
    const allowed = new Set<string>();

    for( const m of methods )
    {
        if( NON_HTTP_METHODS.has( m )){ continue }

        if( m === 'ALL' )
        {
            for( const expanded of ALL_EXPANDED ){ allowed.add( expanded ) }
        }
        else { allowed.add( m ) }
    }

    if( allowed.size === 0 ){ return [] }

    if( allowed.has( 'GET' )){ allowed.add( 'HEAD' ) }
    allowed.add( 'OPTIONS' );

    return [...allowed];
}

/** The methods a route actually answers, with `ALL` expanded. */
function effectiveMethods( method: Method ): string[]
{
    return method === 'ALL' ? ALL_EXPANDED : [method];
}

interface Shape {
    /** Identity of the pattern ignoring param names, for overlap detection. */
    key        : string
    /** A path made only of literal text can be matched by string equality. */
    isStatic   : boolean
    wildcards  : number
    groups     : number
    params     : number
    literalLen : number
}

function describeTokens( tokens: Token[], shape: Shape ): string
{
    let key = '';

    for( const token of tokens )
    {
        if( token.type === 'text' )
        {
            shape.literalLen += token.value.length;
            key += token.value;
        }
        else if( token.type === 'param' )
        {
            shape.isStatic = false;
            shape.params++;
            // Param names are irrelevant to matching, so `/u/:id` and `/u/:key` collide.
            key += token.pattern ? `:(${token.pattern})` : ':';
        }
        else if( token.type === 'wildcard' )
        {
            shape.isStatic = false;
            shape.wildcards++;
            key += '*';
        }
        else
        {
            shape.isStatic = false;
            shape.groups++;
            key += `{${describeTokens( token.tokens, shape )}}`;
        }
    }

    return key;
}

function describe( path: string ): Shape
{
    const shape: Shape = { key : '', isStatic : true, wildcards : 0, groups : 0, params : 0, literalLen : 0 };

    // An unparsable path is left to pathMatcher to reject; treat it as opaquely dynamic.
    try
    {
        shape.key = describeTokens( parse( path ).tokens, shape );
    }
    catch
    {
        shape.isStatic = false;
        shape.key = path;
    }

    return shape;
}

interface Entry {
    route : Route
    shape : Shape
    order : number
}

/**
 * Most specific first: wildcards and optional groups match the widest, then fewer params and
 * more literal text win, and registration order breaks the remaining ties.
 */
function bySpecificity( a: Entry, b: Entry ): number
{
    return a.shape.wildcards - b.shape.wildcards
        || a.shape.groups - b.shape.groups
        || a.shape.params - b.shape.params
        || b.shape.literalLen - a.shape.literalLen
        || a.order - b.order;
}

export class Router 
{
    private entries : Entry[] = [];
    private compiled = false;

    /** Exact-path routes, keyed by `method + ' ' + path` — no regex needed. */
    private staticRoutes = new Map<string, Route>();
    /** Per exact path: the methods serving it and the first route registered, for `Allow`. */
    private staticPaths = new Map<string, { methods : Set<string>, first : Route }>();
    /** Pattern routes bucketed per method, specificity-sorted. */
    private dynamicRoutes = new Map<string, Entry[]>();
    /** Every HTTP-facing pattern route, for the `Allow` fallback scan. */
    private dynamicHttp : Entry[] = [];

    /** Overlap diagnostics collected while compiling; read after the last `add`. */
    public readonly warnings : string[] = [];

    public add( metadata: EndpointMetadata ) 
    {
        const route: Route = {
            method  : metadata.httpMethod,
            path    : metadata.path,
            metadata,
            matchFn : pathMatcher( metadata.path, { sensitive : true, end : true })
        };

        this.entries.push({ route, shape : describe( metadata.path ), order : this.entries.length });
        this.compiled = false;
    }

    /**
     * Build the lookup tables. Called automatically on first use; call it directly after
     * registration to surface `warnings` at bootstrap.
     */
    public compile(): void
    {
        if( this.compiled ){ return }

        this.staticRoutes.clear();
        this.staticPaths.clear();
        this.dynamicRoutes.clear();
        this.dynamicHttp = [];
        this.warnings.length = 0;

        const seen = new Map<string, Route>();

        for( const entry of this.entries )
        {
            const { route, shape } = entry;
            const isHttp = !NON_HTTP_METHODS.has( route.method );

            for( const method of effectiveMethods( route.method ))
            {
                const shapeKey = `${method} ${shape.key}`;
                const previous = seen.get( shapeKey );

                if( previous )
                {
                    this.warnings.push(
                        `Route ${route.method} ${route.path} (${route.metadata.controller}.${route.metadata.methodName}) `
                        + `is unreachable: ${previous.method} ${previous.path} `
                        + `(${previous.metadata.controller}.${previous.metadata.methodName}) already matches the same paths.`
                    );
                }
                else { seen.set( shapeKey, route ) }

                if( shape.isStatic )
                {
                    const key = `${method} ${shape.key}`;

                    if( !this.staticRoutes.has( key )){ this.staticRoutes.set( key, route ) }
                }
                else
                {
                    let bucket = this.dynamicRoutes.get( method );

                    if( !bucket ){ this.dynamicRoutes.set( method, bucket = []) }
                    bucket.push( entry );
                }
            }

            if( !isHttp ){ continue }

            if( shape.isStatic )
            {
                let known = this.staticPaths.get( shape.key );

                if( !known ){ this.staticPaths.set( shape.key, known = { methods : new Set(), first : route }) }
                known.methods.add( route.method );
            }
            else { this.dynamicHttp.push( entry ) }
        }

        for( const bucket of this.dynamicRoutes.values()){ bucket.sort( bySpecificity ) }

        this.compiled = true;
    }

    /**
     * Resolve `path` for `method`, falling back from HEAD to GET per RFC 9110. On a miss the
     * result carries the `Allow` list when another method serves the path.
     */
    public lookup( method: string, path: string ): RouteLookup
    {
        this.compile();

        const match = this.matchMethod( method, path )
            || ( method === 'HEAD' ? this.matchMethod( 'GET', path ) : null );

        if( match ){ return { match, allowed : NO_METHODS, fallback : null } }

        const probe = this.probePath( path );

        return { match : null, allowed : probe.allowed, fallback : probe.fallback };
    }

    public find( method: string, path: string ): RouteMatch | null
    {
        this.compile();

        return this.matchMethod( method, path );
    }

    /**
     * Every route that matches `method`+`path`, most-specific first (then registration order).
     * Used by the SEO group so a void return can fall through to the next match.
     */
    public matchAll( method: string, path: string ): RouteMatch[]
    {
        this.compile();

        const matches = this.collectMatches( method, path );

        if( matches.length === 0 && method === 'HEAD' )
        {
            return this.collectMatches( 'GET', path );
        }

        return matches;
    }

    /**
     * HTTP methods registered for `path`, for `Allow` on OPTIONS and 405 responses.
     * OPTIONS is always supported, and HEAD is implied by GET.
     */
    public allowedMethods( path: string ): string[]
    {
        this.compile();

        return this.probePath( path ).allowed;
    }

    /** One scan over the path, whatever the method: the `Allow` list and a config fallback. */
    private probePath( path: string ): { allowed : string[], fallback : RouteMatch | null }
    {
        const matched: string[] = [];
        let fallback: RouteMatch | null = null;
        const staticHit = this.staticPaths.get( path )
            ?? ( path.endsWith( '/' ) ? this.staticPaths.get( path.slice( 0, -1 )) : undefined );

        if( staticHit )
        {
            matched.push( ...staticHit.methods );
            fallback = { metadata : staticHit.first.metadata, params : Object.create( null ) };
        }

        for( const entry of this.dynamicHttp )
        {
            const match = entry.route.matchFn( path );

            if( !match ){ continue }

            matched.push( entry.route.method );

            if( !fallback ){ fallback = { metadata : entry.route.metadata, params : match.params } }
        }

        return { allowed : toAllowList( matched ), fallback };
    }

    private matchMethod( method: string, path: string ): RouteMatch | null
    {
        const matches = this.collectMatches( method, path );

        return matches[0] ?? null;
    }

    private collectMatches( method: string, path: string ): RouteMatch[]
    {
        const out: RouteMatch[] = [];

        // `pathMatcher` accepts an optional trailing slash, so the map lookup must too.
        const exact = this.staticRoutes.get( `${method} ${path}` )
            ?? ( path.endsWith( '/' ) ? this.staticRoutes.get( `${method} ${path.slice( 0, -1 )}` ) : undefined );

        if( exact )
        {
            out.push({ metadata : exact.metadata, params : Object.create( null ) });
        }

        const bucket = this.dynamicRoutes.get( method );

        if( !bucket ){ return out }

        for( const { route } of bucket )
        {
            const match = route.matchFn( path );

            if( match )
            {
                out.push({ metadata : route.metadata, params : match.params });
            }
        }

        return out;
    }
}
