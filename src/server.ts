import { EventEmitter } from 'node:events';
import { Router, RouteMatch } from './core/router.js';
import { joinQueryStrings, pathnameFromUrl, queryStringFromBag } from './helpers/query-string.js';
import { ApplicationRegistry, getRegistry, runWithRegistry } from './core/registry.js';
import { bootstrapRegistry } from './core/bootstrap.js';
import { EndpointMetadata, Logger, LogContext, SeoFallthrough, ForwardIntent, SeoForward } from './core/types.js';
import { ServerRequest } from './core/server-request.js';
import { Context, type RequestContext } from './core/context.js';
import { CorsOptions, SecurityOptions, type FileOptions, type Reviver } from './decorators.js';
import { handleCors, isPreflight } from './helpers/cors.js';
import { mergeSecurityConfigs, generateSecurityHeaders, getAllowedContentTypesSet, isHostAllowed } from './helpers/security.js';

import { RequestProcessor } from './core/request-processor.js';
import { invokeGuards } from './core/guard-runner.js';
import { RateLimiter } from './helpers/rate-limiter.js';
import { ServerAdapter, normalizeHostList } from './adapters/adapter.js';
import type { TlsOptions, NodeHttpOptions } from './adapters/adapter.js';
export type { TlsOptions, NodeHttpOptions };
import { NodeAdapter } from './adapters/node-adapter.js';
import { BunAdapter } from './adapters/bun-adapter.js';
import { DenoAdapter } from './adapters/deno-adapter.js';
import { getContentType, requestLikelyHasBody } from './helpers/request-reader.js';
import { compileTrustProxy, type CompiledTrustProxy } from './helpers/client-ip.js';
import { httpStatusFromError } from './errors.js';
import { clientErrorBody, errorLogFields } from './helpers/error-response.js';
import { resolveRequestId, REQUEST_ID_HEADER } from './helpers/request-id.js';

/** Max internal rewrite hops per request (cycle detection is separate). */
const MAX_FORWARD_DEPTH = 16;


export class ConsoleLogger implements Logger 
{
    info( message: any, context?: LogContext ) 
    {
        console.log( message );
    }
    warn( message: any, context?: LogContext ) 
    {
        console.warn( message );
    }
    error( message: any, context?: LogContext ) 
    {
        console.error( message );
    }
    debug( message: any, context?: LogContext ) 
    {
        console.debug( message );
    }
}

export class NoOpLogger implements Logger 
{
    info( message: any, context?: LogContext ) {}
    warn( message: any, context?: LogContext ) {}
    error( message: any, context?: LogContext ) {}
    debug( message: any, context?: LogContext ) {}
}

export interface ServerOptions {
    port              : number
    /**
     * Network interface(s) or hostname(s) to bind the OS socket listener(s) to.
     * - Omitted / `undefined` / `[]`: runtime default wildcard binding.
     * - `string`: bind a single interface/hostname (e.g. `'127.0.0.1'`, `'0.0.0.0'`, `'::1'`).
     * - `string[]`: bind one listener per unique non-empty entry on `port`.
     */
    host?             : string | string[]
    cors?             : CorsOptions
    security?         : SecurityOptions | boolean
    /** Global multipart / upload defaults (merged under module / `@File`). */
    files?            : FileOptions
    shutdownTimeout?  : number
    controllers?      : any[]
    providers?        : any[]
    interceptors?     : any[]
    guards?           : any[]
    logs?             : boolean
    logger?           : Logger
    module?           : any | any[]
    responseMode?     : 'strict' | 'relaxed' | 'strip'
    tls?              : TlsOptions
    /**
     * Node `http.Server` / `https.Server` timeouts. Ignored on native Bun/Deno listeners;
     * honored when those runtimes fall back to Node-TLS compat. Defaults:
     * `headersTimeout` 60s, `requestTimeout` 300s, `keepAliveTimeout` 5s.
     */
    headersTimeout?   : number
    requestTimeout?   : number
    keepAliveTimeout? : number
    /**
     * Optional liveness / readiness probes answered before routing.
     * - `true` → `GET /health` (live) and `GET /ready` (ready)
     * - `{ path?, readyPath? }` overrides those paths
     *
     * Liveness is 200 while the process can answer. Readiness is 200 only when the
     * server is bootstrapped, listening (after `start()`), and not shutting down.
     */
    health?           : boolean | { path? : string, readyPath? : string }
    /**
     * When to trust X-Forwarded-For for @Ip and rate limiting.
     * - false / omit: never trust XFF (use TCP peer / 127.0.0.1)
     * - true: trust only loopback peers
     * - string[]: CIDR allowlist of immediate peers (e.g. `['10.0.0.0/8', '172.16.0.0/12']`)
     */
    trustProxy?       : string[]
    /** Passed to typechecker `parse` for JSON and query, and to untyped JSON / urlencoded bodies. Hierarchical with Module / `@Reviver`. `null` opts out. */
    reviver?          : Reviver | null
    /**
     * Whether to register process signal listeners (`SIGTERM`, `SIGINT`) for graceful shutdown.
     * Defaults to `true`. Set to `false` in tests or custom process environments.
     */
    signals?          : boolean
}

export type ServerEvents = {
    start          : ( port: number ) => void
    beforeShutdown : () => void
    shutdown       : () => void
    request        : ( req: Request ) => void
    error          : ( err: Error ) => void
};

function setCorsHeader( headers: Headers, key: string, value: string ): void
{
    if( key === 'Vary' || key === 'vary' )
    {
        const existing = headers.get( 'Vary' );

        if( existing && existing !== '*' )
        {
            const parts = existing.split( ',' ).map( s => s.trim().toLowerCase());

            if( !parts.includes( value.toLowerCase()))
            {
                headers.set( 'Vary', `${existing}, ${value}` );
            }

            return;
        }

        if( existing === '*' ){ return }
    }

    headers.set( key, value );
}

const compiledSecurityHeadersCache = new WeakMap<SecurityOptions, [ string, string ][]>();

function getCompiledSecurityHeaders( securityConfig: SecurityOptions ): [ string, string ][]
{
    let cached = compiledSecurityHeadersCache.get( securityConfig );

    if( !cached )
    {
        cached = Object.entries( generateSecurityHeaders( securityConfig ));
        compiledSecurityHeadersCache.set( securityConfig, cached );
    }

    return cached;
}

function applyFinalHeaders(
    headers: Headers,
    corsHeaders: Record<string, string> | Response | null,
    secHeaders: [ string, string ][] | null,
    allowHeader: string | undefined,
    requestId: string
): void
{
    if( corsHeaders && !( corsHeaders instanceof Response ))
    {
        for( const key in corsHeaders )
        {
            setCorsHeader( headers, key, corsHeaders[key]);
        }
    }

    if( secHeaders )
    {
        for( let i = 0; i < secHeaders.length; i++ )
        {
            headers.set( secHeaders[i][0], secHeaders[i][1]);
        }
    }

    if( allowHeader )
    {
        headers.set( 'Allow', allowHeader );
    }

    headers.set( REQUEST_ID_HEADER, requestId );
}

export class Server extends EventEmitter 
{
    /** High-priority SEO route group (`@Seo`). */
    private seoRouter = new Router();
    /** Public (non-SEO, non-Internal) routes. */
    private router = new Router();
    /** Forward-only routes (`@Internal`). */
    private internalRouter = new Router();
    private activeRequests = 0;
    private serverAdapter?     : ServerAdapter;
    private _isShuttingDown = false;
    private listening = false;
    private rateLimiter = new RateLimiter();
    private events             : { [K in keyof ServerEvents]?: Set<any> } = {};
    private bootstrapped = false;
    /** Per-Server metadata / DI registry (no process-global store). */
    public readonly registry = new ApplicationRegistry();
    private sigtermListener?   : () => void;
    private sigintListener?    : () => void;
    private compiledTrustProxy : CompiledTrustProxy | null;
    private hasSeoRoutes = false;
    private baseSecurityConfig : SecurityOptions | undefined;
    private routeSecurityCache = new WeakMap<EndpointMetadata, SecurityOptions | undefined>();
    public logger              : Logger;

    public get isShuttingDown(): boolean 
    {
        return this._isShuttingDown;
    }
    public set isShuttingDown( val: boolean ) 
    {
        this._isShuttingDown = val;
    }

    public get nodeServer(): any 
    {
        return ( this.serverAdapter as any )?.nodeServer;
    }
    public set nodeServer( val: any ) 
    {
        if( !this.serverAdapter ) 
        {
            this.serverAdapter = this.selectAdapter( 'Node' );
        }
        ( this.serverAdapter as any ).nodeServer = val;
    }

    constructor( private options: ServerOptions ) 
    {
        super();
        this.options.logs = options.logs === true || ( options.logger !== undefined && options.logs !== false );
        this.logger = this.options.logs
            ? ( options.logger || new ConsoleLogger())
            : new NoOpLogger();
        this.compiledTrustProxy = compileTrustProxy( options.trustProxy );
        this.baseSecurityConfig = mergeSecurityConfigs([ options.security ]);

        if( options.signals !== false )
        {
            this.setupSignals();
        }
    }

    /**
     * Lazy walk of module/controller Symbol meta + route wiring.
     * Safe to call multiple times; runs once per Server instance.
     */
    public async ensureReady()
    {
        if( this.bootstrapped ){ return }

        await runWithRegistry( this.registry, async () =>
        {
            bootstrapRegistry( this.registry, {
                module       : this.options.module,
                controllers  : this.options.controllers,
                providers    : this.options.providers,
                guards       : this.options.guards,
                interceptors : this.options.interceptors,
                responseMode : this.options.responseMode
            });

            await this.registry.resolveAll();

            const publicKeys = new Set<string>();
            const internalKeys = new Set<string>();

            for( const endpoint of this.registry.getEndpoints())
            {
                if( endpoint.seo && endpoint.internal )
                {
                    throw new Error(
                        `Endpoint ${endpoint.controller}.${endpoint.methodName} cannot be both @Seo and @Internal`
                    );
                }

                const key = `${endpoint.httpMethod} ${endpoint.path}`;

                if( endpoint.seo )
                {
                    this.hasSeoRoutes = true;
                    this.seoRouter.add( endpoint );
                }
                else if( endpoint.internal )
                {
                    if( publicKeys.has( key ))
                    {
                        throw new Error( `Internal route ${key} conflicts with a public route` );
                    }

                    internalKeys.add( key );
                    this.internalRouter.add( endpoint );
                }
                else
                {
                    if( internalKeys.has( key ))
                    {
                        throw new Error( `Public route ${key} conflicts with an Internal route` );
                    }

                    publicKeys.add( key );
                    this.router.add( endpoint );
                }

                if( this.options.logs )
                {
                    const group = endpoint.seo ? 'seo' : endpoint.internal ? 'internal' : 'public';

                    this.logger.info(
                        `Registered route (${group}): ${endpoint.httpMethod.padEnd( 6 )} ${endpoint.path} -> ${endpoint.controller}.${endpoint.methodName}`,
                        {
                            type       : 'registration',
                            method     : endpoint.httpMethod,
                            path       : endpoint.path,
                            controller : endpoint.controller,
                            action     : endpoint.methodName
                        }
                    );
                }
            }

            // Compiling here means overlapping patterns are reported at bootstrap rather
            // than silently shadowing each other on the first request.
            this.seoRouter.compile();
            this.router.compile();
            this.internalRouter.compile();

            for( const warning of [ ...this.seoRouter.warnings, ...this.router.warnings, ...this.internalRouter.warnings ])
            {
                this.logger.warn( warning, { type : 'registration' });
            }

            for( const cycle of this.registry.dependencyCycles )
            {
                this.logger.warn(
                    `Circular dependency: ${cycle}. It resolves through a lazy proxy, but a request scope inside the cycle cannot be detected.`,
                    { type : 'registration' }
                );
            }
        });

        this.bootstrapped = true;
    }

    /** @deprecated Use ensureReady() — kept for tests that called init(). */
    private async init()
    {
        await this.ensureReady();
    }

    public on<K extends keyof ServerEvents>( event: K, handler: ServerEvents[K]) 
    {
        if( !this.events[event]) { this.events[event] = new Set() }
        this.events[event]!.add( handler );

        return this;
    }

    public off<K extends keyof ServerEvents>( event: K, handler: ServerEvents[K]) 
    {
        this.events[event]?.delete( handler );

        return this;
    }

    private internalEmit<K extends keyof ServerEvents>( event: K, ...args: Parameters<ServerEvents[K]> ) 
    {
        this.events[event]?.forEach( h => h( ...args ));
    }

    private setupSignals(): void
    {
        const handleSignal = ( signal: string ) => 
        {
            this.removeSignals();

            if( this.options.logs ) 
            {
                this.logger.warn( `\nReceived ${signal}. Starting graceful shutdown...`, {
                    type   : 'server_shutdown',
                    reason : signal
                });
            }
            this.shutdown( signal );
        };

        this.sigtermListener = () => handleSignal( 'SIGTERM' );
        this.sigintListener = () => handleSignal( 'SIGINT' );

        if( typeof process !== 'undefined' && typeof process.on === 'function' ) 
        {
            process.on( 'SIGTERM', this.sigtermListener );
            process.on( 'SIGINT', this.sigintListener );
        }
    }

    private removeSignals(): void
    {
        if( typeof process !== 'undefined' && typeof process.off === 'function' ) 
        {
            if( this.sigtermListener ){ process.off( 'SIGTERM', this.sigtermListener ) }

            if( this.sigintListener ){ process.off( 'SIGINT', this.sigintListener ) }
        }
        this.sigtermListener = undefined;
        this.sigintListener = undefined;
    }

    public async shutdown( _signal?: string ) 
    {
        this.removeSignals();

        if( this._isShuttingDown ){ return }
        this._isShuttingDown = true;
        this.listening = false;

        this.internalEmit( 'beforeShutdown' );

        if( this.serverAdapter ) 
        {
            await this.serverAdapter.close();
        }

        const timeout = this.options.shutdownTimeout || 10000;
        const startTime = Date.now();

        if( this.options.logs ) 
        {
            this.logger.info( `Waiting for ${this.activeRequests} active requests to finish (Timeout: ${timeout}ms)...`, {
                type           : 'server_shutdown',
                activeRequests : this.activeRequests,
                timeout
            });
        }

        const checkActive = async () => 
        {
            while( this.activeRequests > 0 ) 
            {
                if( Date.now() - startTime > timeout ) 
                {
                    if( this.options.logs ) 
                    {
                        this.logger.warn( `Shutdown timed out after ${timeout}ms. Force killing ${this.activeRequests} remaining requests.`, {
                            type           : 'server_shutdown',
                            reason         : 'timeout',
                            activeRequests : this.activeRequests
                        });
                    }
                    break;
                }
                await new Promise( r => setTimeout( r, 100 ));
            }
        };

        await checkActive();

        // Anything still open after the drain window (or still mid-flight on timeout) is cut.
        this.serverAdapter?.closeAllConnections?.();

        await runWithRegistry( this.registry, async () =>
        {
            await this.registry.destroyAll();
        });

        if( this.options.logs ) 
        {
            this.logger.info( 'Shutdown complete. Goodbye!', {
                type   : 'server_shutdown',
                reason : 'complete'
            });
        }

        this.internalEmit( 'shutdown' );
    }

    private detectRuntime(): 'Bun' | 'Deno' | 'Node' 
    {
        if(( globalThis as any ).Bun ) { return 'Bun' }

        if(( globalThis as any ).Deno ) { return 'Deno' }

        return 'Node';
    }

    private selectAdapter( runtime: 'Bun' | 'Deno' | 'Node' ): ServerAdapter 
    {
        if( runtime === 'Bun' ) { return new BunAdapter() }

        if( runtime === 'Deno' ) { return new DenoAdapter() }

        return new NodeAdapter();
    }

    public async start() 
    {
        await this.ensureReady();

        const { port } = this.options;
        const runtime = this.detectRuntime();

        if( this.options.logs ) 
        {
            this.logger.info( `📡 Runtime Detected: ${runtime}`, {
                type : 'server_start',
                runtime
            });
        }

        this.serverAdapter = this.selectAdapter( runtime );
        const hosts = normalizeHostList( this.options.host );
        await runWithRegistry( this.registry, async () =>
        {
            const httpOpts = {
                headersTimeout   : this.options.headersTimeout,
                requestTimeout   : this.options.requestTimeout,
                keepAliveTimeout : this.options.keepAliveTimeout
            };

            if( hosts.length > 0 )
            {
                await this.serverAdapter!.listen( port, this.fetch, this.options.tls, httpOpts, this.options.host );
            }
            else
            {
                await this.serverAdapter!.listen( port, this.fetch, this.options.tls, httpOpts );
            }
        });

        this.listening = true;

        const protocol = this.options.tls ? 'https' : 'http';

        if( this.options.logs ) 
        {
            const displayHosts = hosts.length > 0 ? hosts : ['localhost'];
            const urls = displayHosts
                .map(( h ) => `${protocol}://${h.includes( ':' ) && !h.startsWith( '[' ) ? `[${h}]` : h}:${port}` )
                .join( ', ' );

            this.logger.info( `${runtime} server running at ${urls}`, {
                type : 'server_start',
                runtime,
                port
            });
        }

        this.internalEmit( 'start', port );
    }

    /** 204 with `Allow`, per RFC 9110 for an OPTIONS request with no user handler. */
    private optionsResponse( path: string, precomputed?: string[]): Response 
    {
        const allowed = precomputed ?? this.externalAllowedMethods( path );
        const headers: Record<string, string> = {};

        if( allowed.length > 0 ) { headers['Allow'] = allowed.join( ', ' ) }

        return new Response( null, { status : 204, headers });
    }

    /** Allow list for external clients (SEO ∪ public; never Internal). */
    private externalAllowedMethods( path: string ): string[]
    {
        if( !this.hasSeoRoutes )
        {
            return this.router.allowedMethods( path );
        }

        const allowed = new Set<string>([
            ...this.seoRouter.allowedMethods( path ),
            ...this.router.allowedMethods( path )
        ]);

        return [ ...allowed ];
    }

    private applyMatchBags( sreq: ServerRequest, match: RouteMatch ): void
    {
        sreq.params = match.params;
        sreq.routeFiles = match.metadata.files;
    }

    private async runEndpoint(
        metadata: EndpointMetadata,
        sreq: ServerRequest,
        securityConfig?: SecurityOptions
    ): Promise<Response>
    {
        try
        {
            return await this.runEndpointTimed( metadata, sreq, securityConfig );
        }
        catch( err: any )
        {
            if( err instanceof ForwardIntent )
            {
                return this.executeForward( err.target, sreq );
            }

            throw err;
        }
    }

    private async runEndpointTimed(
        metadata: EndpointMetadata,
        sreq: ServerRequest,
        securityConfig?: SecurityOptions
    ): Promise<Response>
    {
        if( securityConfig?.timeout )
        {
            const timeoutMs = securityConfig.timeout;
            const controller = new AbortController();
            sreq.signal = controller.signal;
            let timer: ReturnType<typeof setTimeout> | undefined;
            const work = RequestProcessor.execute( metadata, sreq, securityConfig, this.registry );

            try
            {
                return await Promise.race([
                    work,
                    new Promise<never>(( _, reject ) =>
                    {
                        timer = setTimeout(() =>
                        {
                            controller.abort();
                            reject( Object.assign( new Error( `Request Timeout (${timeoutMs}ms)` ), { status : 408 }));
                        }, timeoutMs );
                    })
                ]);
            }
            finally
            {
                if( timer !== undefined ) { clearTimeout( timer ) }
                void work.catch(() => undefined );
            }
        }

        return RequestProcessor.execute( metadata, sreq, securityConfig, this.registry );
    }

    /**
     * Internal rewrite: look up `method`+`path` on public ∪ internal (SEO skipped).
     * Nested forwards are allowed up to {@link MAX_FORWARD_DEPTH}; cycles are rejected.
     */
    private async executeForward( target: SeoForward, sreq: ServerRequest ): Promise<Response>
    {
        const method = target.method.toUpperCase();
        const path = target.path.startsWith( '/' ) ? target.path : `/${target.path}`;
        const hopKey = `${method} ${path}`;

        sreq.recordForwardHop( hopKey, MAX_FORWARD_DEPTH );

        const match =
            this.router.match( method, path )
            || this.internalRouter.match( method, path );

        if( !match )
        {
            throw Object.assign(
                new Error( `Forward target not found: ${method} ${path}` ),
                { status : 500 }
            );
        }

        sreq.params = match.params;
        sreq.query = { ...sreq.query, ...( target.query || {}) };

        if( target.query )
        {
            sreq.queryString = joinQueryStrings(
                sreq.queryString,
                queryStringFromBag( target.query as Record<string, unknown> )
            );
        }

        sreq.routeFiles = match.metadata.files;
        sreq.forwardBody = target.body ? target.body : undefined;

        const securityConfig = this.resolveEndpointSecurity( match.metadata );
        this.enforceSecurityGates( securityConfig, sreq.raw, sreq, method, match.metadata.path );

        // runEndpoint (not Timed alone) so a nested ForwardIntent can hop again.
        return await this.runEndpoint( match.metadata, sreq, securityConfig );
    }

    /** @internal */
    public fetch = async ( request: Request ): Promise<Response> => 
    {
        const probe = await this.answerHealthProbe( request );

        if( probe ) { return probe }

        await this.ensureReady();

        return this.handleFetch( request );
    };

    /**
     * Liveness / readiness are answered before bootstrap and routing so a broken module
     * graph cannot take the probes down. Returns null when health is disabled or the
     * path is not a probe.
     */
    private async answerHealthProbe( request: Request ): Promise<Response | null>
    {
        if( !this.options.health || request.method !== 'GET' ) { return null }

        const pathname = pathnameFromUrl( request.url );
        const paths = typeof this.options.health === 'object'
            ? {
                live  : this.options.health.path ?? '/health',
                ready : this.options.health.readyPath ?? '/ready'
            }
            : { live : '/health', ready : '/ready' };

        if( pathname !== paths.live && pathname !== paths.ready )
        {
            return null;
        }

        const requestId = resolveRequestId( request );
        const headers = {
            'Content-Type'      : 'application/json',
            [REQUEST_ID_HEADER] : requestId
        };

        if( pathname === paths.live )
        {
            return new Response( JSON.stringify({ status : 'ok' }), { status : 200, headers });
        }

        try
        {
            await this.ensureReady();
        }
        catch
        {
            return new Response(
                JSON.stringify({ status : 'not_ready' }),
                { status : 503, headers }
            );
        }

        const ready = this.isReady();

        return new Response(
            JSON.stringify({ status : ready ? 'ready' : 'not_ready' }),
            { status : ready ? 200 : 503, headers }
        );
    }

    private isReady(): boolean
    {
        if( !this.bootstrapped || this._isShuttingDown ) { return false }

        // In-process `fetch` without `start()` has no listener; bootstrapped is enough.
        if( !this.serverAdapter ) { return true }

        return this.listening;
    }

    private resolveEndpointSecurity( metadata?: EndpointMetadata ): SecurityOptions | undefined
    {
        if( !metadata || metadata.security === undefined )
        {
            return this.baseSecurityConfig;
        }

        if( this.routeSecurityCache.has( metadata ))
        {
            return this.routeSecurityCache.get( metadata );
        }

        const merged = mergeSecurityConfigs([ this.baseSecurityConfig, metadata.security ]);
        this.routeSecurityCache.set( metadata, merged );

        return merged;
    }

    /**
     * Apply CORS, security, optional Allow, and `X-Request-Id` in one pass.
     * Falls back to cloning the Response if its headers are immutable.
     */
    private finalizeResponse(
        res: Response,
        request: Request,
        requestId: string,
        corsConfig?: CorsOptions,
        securityConfig?: SecurityOptions,
        allowHeader?: string
    ): Response
    {
        const corsHeaders = corsConfig ? handleCors( request, corsConfig ) : null;
        const secHeaders = securityConfig !== undefined ? getCompiledSecurityHeaders( securityConfig ) : null;

        try
        {
            applyFinalHeaders( res.headers, corsHeaders, secHeaders, allowHeader, requestId );

            return res;
        }
        catch
        {
            const merged = new Headers( res.headers );
            applyFinalHeaders( merged, corsHeaders, secHeaders, allowHeader, requestId );

            return new Response( res.body, {
                status     : res.status,
                statusText : res.statusText,
                headers    : merged
            });
        }
    }

    private enforceSecurityGates(
        cfg: SecurityOptions | undefined,
        request: Request,
        sreq: ServerRequest,
        method: string,
        routeKey: string
    ): void
    {
        // Enforce allowedHosts (HTTP Host header allowlist)
        if( cfg?.allowedHosts && cfg.allowedHosts !== true && cfg.allowedHosts.length > 0 )
        {
            if( !isHostAllowed( request.headers.get( 'host' ), cfg ))
            {
                throw Object.assign( new Error( 'Forbidden: Disallowed Host' ), { status : 403 });
            }
        }

        // Enforce allowedContentTypes (require a matching CT when a body is indicated)
        if( cfg?.allowedContentTypes && method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS' && method !== 'WS' ) 
        {
            const contentType = getContentType( request );
            const allowed = getAllowedContentTypesSet( cfg );

            if( requestLikelyHasBody( request ))
            {
                if( !contentType || !allowed?.has( contentType ))
                {
                    throw Object.assign( new Error( `Unsupported Media Type: ${contentType || 'missing'}` ), { status : 415 });
                }
            }
            else if( contentType && !allowed?.has( contentType ))
            {
                throw Object.assign( new Error( `Unsupported Media Type: ${contentType}` ), { status : 415 });
            }
        }

        // Enforce rateLimit
        if( cfg?.rateLimit ) 
        {
            const ip = sreq.ip;
            const limit = this.rateLimiter.consume( ip, routeKey, cfg.rateLimit );

            if( !limit.allowed ) 
            {
                throw Object.assign( new Error( 'Too Many Requests' ), {
                    status  : 429,
                    headers : { 'Retry-After' : String( limit.retryAfter ) }
                });
            }
        }
    }

    private logRequestEnd(
        startTime: number,
        method: string,
        path: string,
        status: number,
        requestId: string,
        note?: string
    ): void
    {
        if( !this.options.logs ) { return }
        const duration = Date.now() - startTime;
        this.logger.info( `<-- ${method} ${path} - ${status}${note ? ' ' + note : ''} (${duration}ms)`, {
            type : 'request_end',
            method,
            path,
            status,
            duration,
            requestId
        });
    }

    private handleFetch = async ( request: Request ): Promise<Response> => 
    {
        if( this.events.request?.size )
        {
            this.internalEmit( 'request', request );
        }

        const requestId = resolveRequestId( request );

        if( this.isShuttingDown ) 
        {
            const res = new Response( 'Service Unavailable (Shutting Down)', { status : 503 });

            return this.finalizeResponse( res, request, requestId, this.options.cors, this.baseSecurityConfig );
        }

        this.activeRequests++;
        const startTime = this.options.logs ? Date.now() : 0;
        const isUpgrade = request.headers.get( 'upgrade' )?.toLowerCase() === 'websocket';
        const method = isUpgrade ? 'WS' : request.method;
        const sreq = new ServerRequest( request, {
            requestId,
            trustProxy         : this.options.trustProxy,
            compiledTrustProxy : this.compiledTrustProxy,
            globalFiles        : this.options.files,
            globalReviver      : this.options.reviver
        });
        const path = sreq.path;
    
        if( this.options.logs ) 
        {
            const rawSearch = sreq.queryString ? `?${sreq.queryString}` : '';
            this.logger.info( `--> ${method} ${path}${rawSearch}`, {
                type : 'request_start',
                method,
                path,
                url  : request.url,
                requestId
            });
        }

        let finalMatch: RouteMatch | null = null;
        try 
        {
            // SEO group first (matchAll for void fallthrough), then public. Internal never
            // participates in external lookup.
            const seoMatches = ( isUpgrade || !this.hasSeoRoutes ) ? [] : this.seoRouter.matchAll( method, path );
            const publicLookup = this.router.lookup( method, path );
            const getExternalAllowed = (): string[] =>
            {
                if( !this.hasSeoRoutes && !publicLookup.match )
                {
                    return publicLookup.allowed;
                }

                return this.externalAllowedMethods( path );
            };

            const match = seoMatches[0] || publicLookup.match;
            finalMatch = match || ( method === 'OPTIONS'
                ? (( this.hasSeoRoutes ? this.seoRouter.lookup( method, path ).fallback : null ) || publicLookup.fallback )
                : null );

            const corsConfig = finalMatch ? ( finalMatch.metadata.cors !== undefined ? finalMatch.metadata.cors : this.options.cors ) : this.options.cors;
            const securityConfig = this.resolveEndpointSecurity( finalMatch?.metadata );

            // A genuine CORS preflight is answered here, before guards run. Browsers omit
            // credentials on preflight, so dispatching it into a @Protect'ed route would
            // reject it and break CORS for every protected endpoint.
            if( isPreflight( request )) 
            {
                const corsRes = corsConfig ? handleCors( request, corsConfig ) : null;

                if( corsRes instanceof Response ) 
                {
                    this.logRequestEnd( startTime, method, path, 204, requestId, 'CORS Preflight' );

                    return this.finalizeResponse( corsRes, request, requestId, undefined, securityConfig );
                }

                if( !finalMatch ) 
                {
                    this.logRequestEnd( startTime, method, path, 404, requestId, 'Not Found' );

                    return this.finalizeResponse( new Response( 'Not Found', { status : 404 }), request, requestId, undefined, securityConfig );
                }

                this.logRequestEnd( startTime, method, path, 204, requestId );

                return this.finalizeResponse( this.optionsResponse( path, getExternalAllowed()), request, requestId, undefined, securityConfig );
            }

            // Non-preflight OPTIONS falls through to an @Options / @All handler when one
            // matched; otherwise the framework answers with Allow.
            if( method === 'OPTIONS' && !match ) 
            {
                if( !finalMatch ) 
                {
                    this.logRequestEnd( startTime, method, path, 404, requestId, 'Not Found' );

                    return this.finalizeResponse( new Response( 'Not Found', { status : 404 }), request, requestId, undefined, securityConfig );
                }

                this.logRequestEnd( startTime, method, path, 204, requestId );

                return this.finalizeResponse( this.optionsResponse( path, getExternalAllowed()), request, requestId, corsConfig, securityConfig );
            }

            if( !finalMatch && seoMatches.length === 0 ) 
            {
                // The path exists under other verbs, so this is 405 + Allow, not 404. An
                // upgrade request is exempt: WS is a transport, not an advertised method.
                const externalAllowed = isUpgrade ? [] : getExternalAllowed();
                const wrongMethod = !isUpgrade && externalAllowed.length > 0;
                const status = wrongMethod ? 405 : 404;

                this.logRequestEnd( startTime, method, path, status, requestId, wrongMethod ? 'Method Not Allowed' : 'Not Found' );

                const res = new Response( wrongMethod ? 'Method Not Allowed' : 'Not Found', {
                    status,
                    headers : wrongMethod ? { Allow : externalAllowed.join( ', ' ) } : undefined
                });

                return this.finalizeResponse( res, request, requestId, this.options.cors, this.baseSecurityConfig );
            }

            if( isUpgrade ) 
            {
                // WS only lives on the public router (SEO/Internal are HTTP resolvers).
                const wsMatch = publicLookup.match!;
                finalMatch = wsMatch;

                const wsSecurity = this.resolveEndpointSecurity( wsMatch.metadata );
                this.enforceSecurityGates( wsSecurity, request, sreq, 'WS', wsMatch.metadata.path );

                // Enforce guards + upgrade within request context
                const registry = this.registry;
                const controllerModule = registry.getTokenModule( finalMatch.metadata.controller );
                sreq.params = finalMatch.params;
                RequestProcessor.applyReviver( sreq, finalMatch.metadata, controllerModule );
                const ctx = { success : true, errors : [], mode : 'strict' };
                const requestCtx: RequestContext = {
                    request  : sreq,
                    metadata : wsMatch.metadata,
                    requestId,
                    registry
                };

                return await Context.run( requestCtx, async () =>
                {
                    let handedOffToWs = false;
                    try
                    {
                        const controller = await registry.getController( finalMatch!.metadata.controller, controllerModule );

                        if( !controller ) { throw new Error( `Controller ${finalMatch!.metadata.controller} not registered` ) }

                        requestCtx.wsController = controller;

                        // The socket does not exist until after the upgrade, so @ConnectedSocket is null.
                        await invokeGuards( wsMatch.metadata, sreq, {
                            ctx,
                            controller,
                            controllerModule,
                            securityConfig : wsSecurity,
                            websocket      : null
                        });

                        if( !ctx.success ) 
                        {
                            return this.finalizeResponse( new Response( JSON.stringify({
                                success : false,
                                message : 'request validation failed',
                                errors  : ctx.errors
                            }), {
                                status  : 400,
                                headers : { 'Content-Type' : 'application/json' }
                            }), request, requestId );
                        }

                        if( this.serverAdapter && typeof this.serverAdapter.upgrade === 'function' ) 
                        {
                            ( request as any ).__wsRequestContext = requestCtx;
                            const res = await this.serverAdapter.upgrade( request, finalMatch!.metadata, finalMatch!.params );

                            if( res.status < 400 && !requestCtx.wsCleanedUp )
                            {
                                handedOffToWs = true;
                            }
                            else
                            {
                                delete ( request as any ).__wsRequestContext;
                            }

                            return this.finalizeResponse( res, request, requestId );
                        }

                        return this.finalizeResponse( new Response( 'WebSockets not supported by adapter', { status : 501 }), request, requestId );
                    }
                    finally
                    {
                        if( !handedOffToWs && requestCtx.requestInstances?.size )
                        {
                            await RequestProcessor.cleanupRequestContext( requestCtx );
                        }
                    }
                });
            }

            let response: Response | undefined;
            let activeSecurity = securityConfig;
            let activeCors = corsConfig;

            // Try SEO matches in specificity order; void → next; forward → internal hop.
            for( const seoMatch of seoMatches )
            {
                this.applyMatchBags( sreq, seoMatch );
                activeSecurity = this.resolveEndpointSecurity( seoMatch.metadata );
                activeCors = seoMatch.metadata.cors !== undefined ? seoMatch.metadata.cors : this.options.cors;
                this.enforceSecurityGates( activeSecurity, request, sreq, method, seoMatch.metadata.path );

                try
                {
                    response = await this.runEndpoint( seoMatch.metadata, sreq, activeSecurity );
                    break;
                }
                catch( err: any )
                {
                    if( err instanceof SeoFallthrough )
                    {
                        response = undefined;
                        continue;
                    }

                    throw err;
                }
            }

            // After SEO miss / all fallthrough → public router.
            if( response === undefined )
            {
                const pubMatch = publicLookup.match;

                if( !pubMatch )
                {
                    // SEO already declined (void fallthrough): do not advertise SEO verbs as Allow.
                    const allowedAfterSeo = publicLookup.allowed;
                    const wrongMethod = allowedAfterSeo.length > 0;
                    const status = wrongMethod ? 405 : 404;
                    const res = new Response( wrongMethod ? 'Method Not Allowed' : 'Not Found', {
                        status,
                        headers : wrongMethod ? { Allow : allowedAfterSeo.join( ', ' ) } : undefined
                    });

                    this.logRequestEnd( startTime, method, path, status, requestId, wrongMethod ? 'Method Not Allowed' : 'Not Found' );

                    return this.finalizeResponse( res, request, requestId, this.options.cors, this.baseSecurityConfig );
                }

                this.applyMatchBags( sreq, pubMatch );
                activeSecurity = this.resolveEndpointSecurity( pubMatch.metadata );
                activeCors = pubMatch.metadata.cors !== undefined ? pubMatch.metadata.cors : this.options.cors;
                this.enforceSecurityGates( activeSecurity, request, sreq, method, pubMatch.metadata.path );
                response = await this.runEndpoint( pubMatch.metadata, sreq, activeSecurity );
            }

            // RFC 9110: an OPTIONS response should advertise Allow.
            let allowHeader: string | undefined;

            if( method === 'OPTIONS' && !response.headers.has( 'Allow' )) 
            {
                const allowed = getExternalAllowed();

                if( allowed.length > 0 ) 
                {
                    allowHeader = allowed.join( ', ' );
                }
            }

            response = this.finalizeResponse( response, request, requestId, activeCors, activeSecurity, allowHeader );

            this.logRequestEnd( startTime, method, path, response.status, requestId );

            if( method === 'HEAD' ) 
            {
                response = new Response( null, {
                    status     : response.status,
                    statusText : response.statusText,
                    headers    : response.headers
                });
            }

            return response;
        }
        catch ( err: any ) 
        {
            if( this.events.error?.size )
            {
                this.internalEmit( 'error', err );
            }

            const statusCode = httpStatusFromError( err );

            if( this.options.logs ) 
            {
                this.logger.error( `Server Error: ${err.message}`, {
                    type  : 'error',
                    error : errorLogFields( err ),
                    requestId
                });
                this.logRequestEnd( startTime, method, path, statusCode, requestId );
            }
      
            const corsConfig = finalMatch ? ( finalMatch.metadata.cors !== undefined ? finalMatch.metadata.cors : this.options.cors ) : this.options.cors;
            const errSecurityConfig = this.resolveEndpointSecurity( finalMatch?.metadata );
      
            const errHeaders: Record<string, string> = { 'Content-Type' : 'application/json' };

            // Errors may carry protocol headers of their own, e.g. Retry-After on a 429.
            if( err.headers && typeof err.headers === 'object' ) 
            {
                for( const [ key, value ] of Object.entries( err.headers as Record<string, unknown> )) 
                {
                    if( typeof value === 'string' ) { errHeaders[key] = value }
                }
            }

            let res = new Response( JSON.stringify( clientErrorBody( err, statusCode )), {
                status  : statusCode,
                headers : errHeaders
            });
            res = this.finalizeResponse( res, request, requestId, corsConfig, errSecurityConfig );

            if( method === 'HEAD' ) 
            {
                res = new Response( null, {
                    status     : res.status,
                    statusText : res.statusText,
                    headers    : res.headers
                });
            }

            return res;
        }
        finally 
        {
            this.activeRequests--;
        }
    };
}
