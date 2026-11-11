import { Method, EndpointMetadata } from './types.js';
import { pathMatcher, parse, MatchFunction, Token } from '../helpers/match.js';
import { BadRequestError } from '../errors.js';

export interface Route {
    method       : Method
    path         : string
    metadata     : EndpointMetadata
    matchFn      : MatchFunction<any>
    fastMatchFn? : ( path: string ) => RouteMatch | null
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
    key            : string
    /** A path made only of literal text can be matched by string equality. */
    isStatic       : boolean
    /** Leading complete static path segments before any parameter, wildcard, or group. */
    staticSegments : string[]
    wildcards      : number
    groups         : number
    params         : number
    literalLen     : number
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

const NO_SEGMENTS: string[] = [];

function extractStaticSegments( tokens: Token[]): string[]
{
    const first = tokens[0];

    if( !first || first.type !== 'text' || !first.value.startsWith( '/' ))
    {
        return NO_SEGMENTS;
    }

    const lastSlash = first.value.lastIndexOf( '/' );

    if( lastSlash <= 1 )
    {
        return NO_SEGMENTS;
    }

    return first.value.slice( 1, lastSlash ).split( '/' );
}

function describe( path: string ): { shape : Shape, tokens : Token[] }
{
    const shape: Shape = {
        key            : '',
        isStatic       : true,
        staticSegments : NO_SEGMENTS,
        wildcards      : 0,
        groups         : 0,
        params         : 0,
        literalLen     : 0
    };

    const parsedTokens = parse( path ).tokens;
    shape.key = describeTokens( parsedTokens, shape );
    shape.staticSegments = extractStaticSegments( parsedTokens );

    return { shape, tokens : parsedTokens };
}

function decodeFastSegment( raw: string, name: string ): string
{
    try
    {
        return decodeURIComponent( raw );
    }
    catch
    {
        throw new BadRequestError( `Malformed percent-encoding in path parameter "${name}"` );
    }
}

const UNSAFE_PARAM_NAMES = new Set([ '__proto__', 'constructor', 'prototype' ]);

/**
 * Build a zero-RegExp segment matcher for standard `/lit/:param/...` patterns (no custom regex,
 * wildcards, or optional groups). Falls back to `undefined` for complex patterns so `matchFn` runs.
 */
function buildFastSegmentMatcher(
    metadata: EndpointMetadata,
    tokens: Token[]
): (( input: string ) => RouteMatch | null ) | undefined
{
    if( tokens.length < 2 || tokens[0].type !== 'text' || !tokens[0].value.endsWith( '/' ))
    {
        return undefined;
    }

    const literals: string[] = [tokens[0].value];
    const paramNames: string[] = [];
    const seenParams = new Set<string>();
    let expectParam = true;

    for( let i = 1; i < tokens.length; i++ )
    {
        const tok = tokens[i];

        if( expectParam )
        {
            if( tok.type !== 'param' || tok.pattern || UNSAFE_PARAM_NAMES.has( tok.name ) || seenParams.has( tok.name ))
            {
                return undefined;
            }

            seenParams.add( tok.name );
            paramNames.push( tok.name );
            expectParam = false;
        }
        else
        {
            const isLast = i === tokens.length - 1;

            if( tok.type !== 'text' || !tok.value.startsWith( '/' ))
            {
                return undefined;
            }

            if( !isLast && !tok.value.endsWith( '/' ))
            {
                return undefined;
            }

            if( isLast && tok.value.endsWith( '/' ))
            {
                return undefined;
            }

            literals.push( tok.value );
            expectParam = true;
        }
    }

    if( paramNames.length === 0 )
    {
        return undefined;
    }

    if( literals.length === paramNames.length )
    {
        literals.push( '' );
    }

    if( paramNames.length === 1 )
    {
        const prefix = literals[0];
        const suffix = literals[1];
        const pLen = prefix.length;
        const param0 = paramNames[0];

        if( suffix.length === 0 )
        {
            return ( input: string ): RouteMatch | null =>
            {
                let end = input.length;

                if( end > pLen && input.charCodeAt( end - 1 ) === 47 ){ end-- }

                if( end <= pLen || !input.startsWith( prefix )){ return null }

                const slash = input.indexOf( '/', pLen );

                if( slash !== -1 && slash < end ){ return null }

                const raw = input.slice( pLen, end );
                const params: Record<string, string> = Object.create( null );
                params[param0] = raw.indexOf( '%' ) === -1 ? raw : decodeFastSegment( raw, param0 );

                return { metadata, params };
            };
        }

        const sLen = suffix.length;

        return ( input: string ): RouteMatch | null =>
        {
            let end = input.length;

            if( end > 1 && input.charCodeAt( end - 1 ) === 47 ){ end-- }

            const paramEnd = end - sLen;

            if( paramEnd <= pLen || !input.startsWith( suffix, paramEnd ) || !input.startsWith( prefix ))
            {
                return null;
            }

            if( input.indexOf( '/', pLen ) !== paramEnd ){ return null }

            const raw = input.slice( pLen, paramEnd );
            const params: Record<string, string> = Object.create( null );
            params[param0] = raw.indexOf( '%' ) === -1 ? raw : decodeFastSegment( raw, param0 );

            return { metadata, params };
        };
    }

    const pCount = paramNames.length;
    const prefix0 = literals[0];
    const p0Len = prefix0.length;
    const tail = literals[pCount];
    const tailLen = tail.length;

    return ( input: string ): RouteMatch | null =>
    {
        let end = input.length;

        if( end > 1 && input.charCodeAt( end - 1 ) === 47 ){ end-- }

        const bodyEnd = end - tailLen;

        if( bodyEnd <= p0Len || ( tailLen > 0 && !input.startsWith( tail, bodyEnd )) || !input.startsWith( prefix0 ))
        {
            return null;
        }

        const params: Record<string, string> = Object.create( null );
        let pos = p0Len;

        for( let i = 0; i < pCount; i++ )
        {
            const isLastParam = i === pCount - 1;
            const segEnd = isLastParam ? bodyEnd : input.indexOf( '/', pos );

            if( segEnd <= pos || segEnd > bodyEnd ){ return null }

            if( isLastParam )
            {
                const innerSlash = input.indexOf( '/', pos );

                if( innerSlash !== -1 && innerSlash < bodyEnd ){ return null }
            }

            const raw = input.slice( pos, segEnd );
            const pName = paramNames[i];
            params[pName] = raw.indexOf( '%' ) === -1 ? raw : decodeFastSegment( raw, pName );

            if( !isLastParam )
            {
                const sep = literals[i + 1];

                if( !input.startsWith( sep, segEnd )){ return null }

                pos = segEnd + sep.length;
            }
        }

        return { metadata, params };
    };
}

interface Entry {
    route : Route
    shape : Shape
    order : number
}

interface PrefixTrieNode {
    entries  : Entry[]
    children : Map<string, PrefixTrieNode> | undefined
}

const EMPTY_ENTRIES: Entry[] = [];

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

function byRegistrationOrder( a: Entry, b: Entry ): number
{
    return a.order - b.order;
}

function buildPrefixTrie(
    sortedList: Entry[],
    compareFn: ( a: Entry, b: Entry ) => number = bySpecificity
): PrefixTrieNode
{
    const root: PrefixTrieNode = { entries : [], children : undefined };

    for( const entry of sortedList )
    {
        let node = root;

        for( const seg of entry.shape.staticSegments )
        {
            if( !node.children )
            {
                node.children = new Map();
            }

            let child = node.children.get( seg );

            if( !child )
            {
                child = { entries : [], children : undefined };
                node.children.set( seg, child );
            }

            node = child;
        }

        node.entries.push( entry );
    }

    const propagate = ( node: PrefixTrieNode, inherited: Entry[]): void =>
    {
        if( inherited.length > 0 )
        {
            if( node.entries.length === 0 )
            {
                node.entries = inherited;
            }
            else
            {
                node.entries = [ ...inherited, ...node.entries ].sort( compareFn );
            }
        }

        if( !node.children ){ return }

        for( const child of node.children.values())
        {
            propagate( child, node.entries );
        }
    };

    propagate( root, EMPTY_ENTRIES );

    return root;
}

function lookupTrieCandidates( root: PrefixTrieNode | undefined, path: string ): Entry[]
{
    if( !root ){ return EMPTY_ENTRIES }

    let node = root;

    if( !node.children || !path.startsWith( '/' ) || path.length <= 1 )
    {
        return node.entries;
    }

    let start = 1;
    const len = path.length;

    while( node.children && start < len )
    {
        const slashIdx = path.indexOf( '/', start );
        const end = slashIdx === -1 ? len : slashIdx;
        const next = node.children.get( path.slice( start, end ));

        if( !next ){ break }

        node = next;

        if( slashIdx === -1 ){ break }

        start = slashIdx + 1;
    }

    return node.entries;
}

export const EMPTY_PARAMS: Record<string, any> = Object.freeze( Object.create( null ));

function matchRoute( route: Route, path: string ): RouteMatch | null
{
    if( route.fastMatchFn !== undefined )
    {
        return route.fastMatchFn( path );
    }

    const match = route.matchFn( path );

    return match ? { metadata : route.metadata, params : match.params } : null;
}

class MissRouteLookup implements RouteLookup
{
    public readonly match = null;
    #router : Router;
    #path   : string;
    #probe? : { allowed : string[], fallback : RouteMatch | null };

    constructor( router: Router, path: string )
    {
        this.#router = router;
        this.#path = path;
    }

    get allowed(): string[]
    {
        return ( this.#probe ?? ( this.#probe = this.#router.probePathInternal( this.#path ))).allowed;
    }

    get fallback(): RouteMatch | null
    {
        return ( this.#probe ?? ( this.#probe = this.#router.probePathInternal( this.#path ))).fallback;
    }
}

export class Router 
{
    private entries : Entry[] = [];
    private compiled = false;

    /** Exact-path pre-allocated lookups, indexed by `method` -> `path` (including optional trailing `/`). */
    private staticLookupByMethod = new Map<string, Map<string, RouteLookup>>();
    /** Per exact path: the methods serving it and the first route registered, for `Allow`. */
    private staticPaths = new Map<string, { methods : Set<string>, first : Route }>();
    /** Pattern routes indexed per method in a static-prefix trie, specificity-sorted. */
    private dynamicRoutes = new Map<string, PrefixTrieNode>();
    /** HTTP-facing pattern routes indexed in a static-prefix trie, for the `Allow` fallback scan. */
    private dynamicHttpTrie? : PrefixTrieNode;

    /** Overlap diagnostics collected while compiling; read after the last `add`. */
    public readonly warnings : string[] = [];

    public add( metadata: EndpointMetadata ) 
    {
        const { shape, tokens } = describe( metadata.path );
        const route: Route = {
            method      : metadata.httpMethod,
            path        : metadata.path,
            metadata,
            matchFn     : pathMatcher( metadata.path, { sensitive : true, end : true }),
            fastMatchFn : shape.isStatic ? undefined : buildFastSegmentMatcher( metadata, tokens )
        };

        this.entries.push({ route, shape, order : this.entries.length });
        this.compiled = false;
    }

    /**
     * Build the lookup tables. Called automatically on first use; call it directly after
     * registration to surface `warnings` at bootstrap.
     */
    public compile(): void
    {
        if( this.compiled ){ return }

        this.staticLookupByMethod.clear();
        this.staticPaths.clear();
        this.dynamicRoutes.clear();
        this.dynamicHttpTrie = undefined;
        this.warnings.length = 0;

        const seen = new Map<string, Route>();
        const rawDynamic = new Map<string, Entry[]>();
        const dynamicHttpList: Entry[] = [];
        const trailingAliases: { byPath : Map<string, RouteLookup>, alias : string, lookup : RouteLookup }[] = [];

        for( const entry of this.entries )
        {
            const { route, shape } = entry;
            const isHttp = !NON_HTTP_METHODS.has( route.method );
            const staticLookup: RouteLookup | undefined = shape.isStatic
                ? { match : { metadata : route.metadata, params : EMPTY_PARAMS }, allowed : NO_METHODS, fallback : null }
                : undefined;

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
                    let byPath = this.staticLookupByMethod.get( method );

                    if( !byPath ){ this.staticLookupByMethod.set( method, byPath = new Map()) }

                    if( !byPath.has( shape.key ))
                    {
                        byPath.set( shape.key, staticLookup! );

                        if( !shape.key.endsWith( '/' ))
                        {
                            trailingAliases.push({ byPath, alias : `${shape.key}/`, lookup : staticLookup! });
                        }
                        else if( shape.key === '/' )
                        {
                            trailingAliases.push({ byPath, alias : '//', lookup : staticLookup! });
                        }
                    }
                }
                else
                {
                    let bucket = rawDynamic.get( method );

                    if( !bucket ){ rawDynamic.set( method, bucket = []) }
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
            else { dynamicHttpList.push( entry ) }
        }

        for( const { byPath, alias, lookup } of trailingAliases )
        {
            if( !byPath.has( alias ))
            {
                byPath.set( alias, lookup );
            }
        }

        for( const [ method, list ] of rawDynamic.entries())
        {
            list.sort( bySpecificity );
            this.dynamicRoutes.set( method, buildPrefixTrie( list, bySpecificity ));
        }

        if( dynamicHttpList.length > 0 )
        {
            this.dynamicHttpTrie = buildPrefixTrie( dynamicHttpList, byRegistrationOrder );
        }

        this.compiled = true;
    }

    /**
     * Resolve `path` for `method`, falling back from HEAD to GET per RFC 9110. On a miss the
     * result carries the `Allow` list when another method serves the path.
     */
    public lookup( method: string, path: string ): RouteLookup
    {
        if( !this.compiled ){ this.compile() }

        const staticHit = this.staticLookupByMethod.get( method )?.get( path )
            ?? ( method === 'HEAD' ? this.staticLookupByMethod.get( 'GET' )?.get( path ) : undefined );

        if( staticHit !== undefined ){ return staticHit }

        const dynMatch = this.matchDynamic( method, path )
            ?? ( method === 'HEAD' ? this.matchDynamic( 'GET', path ) : null );

        if( dynMatch ){ return { match : dynMatch, allowed : NO_METHODS, fallback : null } }

        return new MissRouteLookup( this, path );
    }

    public find( method: string, path: string ): RouteMatch | null
    {
        if( !this.compiled ){ this.compile() }

        return this.matchMethod( method, path );
    }

    /**
     * Hot-path route match for `method`+`path` (including RFC 9110 HEAD → GET fallback),
     * without scanning other HTTP verbs via `probePath` on a miss.
     */
    public match( method: string, path: string ): RouteMatch | null
    {
        if( !this.compiled ){ this.compile() }

        return this.matchMethod( method, path )
            || ( method === 'HEAD' ? this.matchMethod( 'GET', path ) : null );
    }

    /**
     * Every route that matches `method`+`path`, most-specific first (then registration order).
     * Used by the SEO group so a void return can fall through to the next match.
     */
    public matchAll( method: string, path: string ): RouteMatch[]
    {
        if( !this.compiled ){ this.compile() }

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
        if( !this.compiled ){ this.compile() }

        return this.probePathInternal( path ).allowed;
    }

    /** @internal One scan over the path, whatever the method: the `Allow` list and a config fallback. */
    public probePathInternal( path: string ): { allowed : string[], fallback : RouteMatch | null }
    {
        const matched: string[] = [];
        let fallback: RouteMatch | null = null;
        const staticHit = this.staticPaths.get( path )
            ?? ( path.endsWith( '/' ) ? this.staticPaths.get( path.slice( 0, -1 )) : undefined );

        if( staticHit )
        {
            matched.push( ...staticHit.methods );
            fallback = { metadata : staticHit.first.metadata, params : EMPTY_PARAMS };
        }

        const dynamicCandidates = lookupTrieCandidates( this.dynamicHttpTrie, path );

        for( const entry of dynamicCandidates )
        {
            const hit = matchRoute( entry.route, path );

            if( !hit ){ continue }

            matched.push( entry.route.method );

            if( !fallback ){ fallback = hit }
        }

        return { allowed : toAllowList( matched ), fallback };
    }

    private getDynamicCandidates( method: string, path: string ): Entry[]
    {
        return lookupTrieCandidates( this.dynamicRoutes.get( method ), path );
    }

    private matchDynamic( method: string, path: string ): RouteMatch | null
    {
        const candidates = this.getDynamicCandidates( method, path );
        const len = candidates.length;

        if( len === 0 ){ return null }

        for( let i = 0; i < len; i++ )
        {
            const hit = matchRoute( candidates[i].route, path );

            if( hit ){ return hit }
        }

        return null;
    }

    private matchMethod( method: string, path: string ): RouteMatch | null
    {
        const staticHit = this.staticLookupByMethod.get( method )?.get( path );

        if( staticHit !== undefined ){ return staticHit.match }

        return this.matchDynamic( method, path );
    }

    private collectMatches( method: string, path: string ): RouteMatch[]
    {
        const out: RouteMatch[] = [];
        const staticHit = this.staticLookupByMethod.get( method )?.get( path );

        if( staticHit?.match )
        {
            out.push( staticHit.match );
        }

        const candidates = this.getDynamicCandidates( method, path );
        const len = candidates.length;

        for( let i = 0; i < len; i++ )
        {
            const hit = matchRoute( candidates[i].route, path );

            if( hit ){ out.push( hit ) }
        }

        return out;
    }
}
