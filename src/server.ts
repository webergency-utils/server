import { EventEmitter } from 'node:events';
import { Router, RouteMatch } from './core/router.js';
import { parseQueryString } from '@webergency-utils/typechecker/runtime';
import { joinQueryStrings, queryStringFromBag, queryStringFromUrl } from './helpers/query-string.js';
import { ApplicationRegistry, getRegistry, runWithRegistry } from './core/registry.js';
import { bootstrapRegistry } from './core/bootstrap.js';
import { EndpointMetadata, AugmentedRequest, Logger, LogContext, SeoFallthrough, ForwardIntent, SeoForward } from './core/types.js';
import { CorsOptions, SecurityOptions, type FileOptions, type Reviver } from './decorators.js';
import { handleCors, isPreflight } from './helpers/cors.js';
import { mergeSecurityConfigs, generateSecurityHeaders } from './helpers/security.js';

import { RequestProcessor } from './core/request-processor.js';
import { invokeGuards } from './core/guard-runner.js';
import { RateLimiter } from './helpers/rate-limiter.js';
import { ServerAdapter } from './adapters/adapter.js';
import type { TlsOptions, NodeHttpOptions } from './adapters/adapter.js';
export type { TlsOptions, NodeHttpOptions };
import { NodeAdapter } from './adapters/node-adapter.js';
import { BunAdapter } from './adapters/bun-adapter.js';
import { DenoAdapter } from './adapters/deno-adapter.js';
import { RequestReader, getContentType, requestLikelyHasBody } from './helpers/request-reader.js';
import { httpStatusFromError } from './errors.js';
import { clientErrorBody, errorLogFields } from './helpers/error-response.js';
import { resolveClientIp } from './helpers/client-ip.js';
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
}

export type ServerEvents = {
    start          : ( port: number ) => void
    beforeShutdown : () => void
    shutdown       : () => void
    request        : ( req: Request ) => void
    error          : ( err: Error ) => void
};

export class Server extends EventEmitter 
{
    /** High-priority SEO route group (`@Seo`). */
    private seoRouter = new Router();
    /** Public (non-SEO, non-Internal) routes. */
    private router = new Router();
    /** Forward-only routes (`@Internal`). */
    private internalRouter = new Router();
    private activeRequests = 0;
    private serverAdapter? : ServerAdapter;
    private _isShuttingDown = false;
    private listening = false;
    private rateLimiter = new RateLimiter();
    private events         : { [K in keyof ServerEvents]?: Set<any> } = {};
    private bootstrapped = false;
    /** Per-Server metadata / DI registry (no process-global store). */
    public readonly registry = new ApplicationRegistry();
    public logger          : Logger;

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

    public async getBody( req: AugmentedRequest, securityConfig?: SecurityOptions ): Promise<any> 
    {
        const sec = securityConfig || ( typeof this.options.security === 'object' ? this.options.security : undefined );

        if( req.reviver === undefined )
        {
            req.reviver = this.options.reviver ?? undefined;
        }

        return RequestReader.getBody( req, sec );
    }

    public async getRawBody( req: AugmentedRequest, securityConfig?: SecurityOptions ): Promise<ArrayBuffer> 
    {
        const sec = securityConfig || ( typeof this.options.security === 'object' ? this.options.security : undefined );

        return RequestReader.getRawBody( req, sec );
    }

    constructor( private options: ServerOptions ) 
    {
        super();
        this.options.logs = options.logs === true || ( options.logger !== undefined && options.logs !== false );
        this.logger = this.options.logs
            ? ( options.logger || new ConsoleLogger())
            : new NoOpLogger();
        this.setupSignals();
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
            const seoKeys = new Set<string>();

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
                    if( seoKeys.has( key ))
                    {
                        throw new Error( `Duplicate SEO route: ${key}` );
                    }

                    seoKeys.add( key );
                    this.seoRouter.add( endpoint );
                }
                else if( endpoint.internal )
                {
                    if( internalKeys.has( key ))
                    {
                        throw new Error( `Duplicate Internal route: ${key}` );
                    }

                    if( publicKeys.has( key ))
                    {
                        throw new Error( `Internal route ${key} conflicts with a public route` );
                    }

                    internalKeys.add( key );
                    this.internalRouter.add( endpoint );
                }
                else
                {
                    if( publicKeys.has( key ))
                    {
                        throw new Error( `Duplicate public route: ${key}` );
                    }

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

    private setupSignals() 
    {
        const handleSignal = ( signal: string ) => 
        {
            if( this.options.logs ) 
            {
                this.logger.warn( `\nReceived ${signal}. Starting graceful shutdown...`, {
                    type   : 'server_shutdown',
                    reason : signal
                });
            }
            this.shutdown( signal );
        };

        if( typeof process !== 'undefined' ) 
        {
            process.on( 'SIGTERM', () => handleSignal( 'SIGTERM' ));
            process.on( 'SIGINT', () => handleSignal( 'SIGINT' ));
        } 
        else if(( globalThis as any ).Deno ) 
        {
            ( globalThis as any ).Deno.addSignalListener( 'SIGTERM', () => handleSignal( 'SIGTERM' ));
            ( globalThis as any ).Deno.addSignalListener( 'SIGINT', () => handleSignal( 'SIGINT' ));
        }
    }

    public async shutdown( _signal?: string ) 
    {
        if( this._isShuttingDown ) { return }
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
        await runWithRegistry( this.registry, async () =>
        {
            await this.serverAdapter!.listen( port, this.fetch, this.options.tls, {
                headersTimeout   : this.options.headersTimeout,
                requestTimeout   : this.options.requestTimeout,
                keepAliveTimeout : this.options.keepAliveTimeout
            });
        });

        this.listening = true;

        const protocol = this.options.tls ? 'https' : 'http';

        if( this.options.logs ) 
        {
            this.logger.info( `${runtime} server running at ${protocol}://localhost:${port}`, {
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
        const allowed = new Set<string>([
            ...this.seoRouter.allowedMethods( path ),
            ...this.router.allowedMethods( path )
        ]);

        return [ ...allowed ];
    }

    private applyMatchBags( req: AugmentedRequest, match: RouteMatch ): void
    {
        req.params = match.params;
        req.queryString = queryStringFromUrl( req.url );
        req.query = parseQueryString( req.queryString );
        req.globalCors = this.options.cors;
        req.cors = match.metadata.cors;
        req.globalSecurity = this.options.security;
        req.security = match.metadata.security;
        req.globalFiles = this.options.files;
        req.files = match.metadata.files;
        req.meta = match.metadata.meta;
        req.globalReviver = this.options.reviver;
    }

    private async runEndpoint(
        metadata: EndpointMetadata,
        req: AugmentedRequest,
        securityConfig?: SecurityOptions
    ): Promise<Response>
    {
        try
        {
            return await this.runEndpointTimed( metadata, req, securityConfig );
        }
        catch( err: any )
        {
            if( err instanceof ForwardIntent )
            {
                return this.executeForward( err.target, req );
            }

            throw err;
        }
    }

    private async runEndpointTimed(
        metadata: EndpointMetadata,
        req: AugmentedRequest,
        securityConfig?: SecurityOptions
    ): Promise<Response>
    {
        if( securityConfig?.timeout )
        {
            const timeoutMs = securityConfig.timeout;
            const controller = new AbortController();
            req.abortSignal = controller.signal;
            const timer = setTimeout(() => controller.abort(), timeoutMs );
            const work = RequestProcessor.execute( metadata, req, securityConfig );

            try
            {
                return await Promise.race([
                    work,
                    new Promise<never>(( _, reject ) =>
                    {
                        const fail = () =>
                        {
                            reject( Object.assign( new Error( `Request Timeout (${timeoutMs}ms)` ), { status : 408 }));
                        };

                        if( controller.signal.aborted )
                        {
                            fail();

                            return;
                        }

                        controller.signal.addEventListener( 'abort', fail, { once : true });
                    })
                ]);
            }
            finally
            {
                clearTimeout( timer );
                void work.catch(() => undefined );
            }
        }

        return RequestProcessor.execute( metadata, req, securityConfig );
    }

    /**
     * Internal rewrite: look up `method`+`path` on public ∪ internal (SEO skipped).
     * Nested forwards are allowed up to {@link MAX_FORWARD_DEPTH}; cycles are rejected.
     */
    private async executeForward( target: SeoForward, req: AugmentedRequest ): Promise<Response>
    {
        const method = target.method.toUpperCase();
        const path = target.path.startsWith( '/' ) ? target.path : `/${target.path}`;
        const hopKey = `${method} ${path}`;
        const stack = req.forwardStack ?? ( req.forwardStack = []);

        if( stack.includes( hopKey ))
        {
            throw Object.assign(
                new Error( `Forward cycle detected: ${[ ...stack, hopKey ].join( ' -> ' )}` ),
                { status : 500 }
            );
        }

        if( stack.length >= MAX_FORWARD_DEPTH )
        {
            throw Object.assign(
                new Error( `Forward depth exceeded (max ${MAX_FORWARD_DEPTH})` ),
                { status : 500 }
            );
        }

        stack.push( hopKey );
        req.forwardDepth = stack.length;

        const match =
            this.router.lookup( method, path ).match
            || this.internalRouter.lookup( method, path ).match;

        if( !match )
        {
            throw Object.assign(
                new Error( `Forward target not found: ${method} ${path}` ),
                { status : 500 }
            );
        }

        req.params = match.params;
        req.query = { ...req.query, ...( target.query || {}) };

        if( target.query )
        {
            req.queryString = joinQueryStrings(
                req.queryString ?? queryStringFromUrl( req.url ),
                queryStringFromBag( target.query as Record<string, unknown> )
            );
        }

        req.cors = match.metadata.cors;
        req.security = match.metadata.security;
        req.files = match.metadata.files;
        req.meta = match.metadata.meta;

        if( target.body )
        {
            req.forwardBody = target.body;
        }
        else
        {
            delete req.forwardBody;
        }

        const securityConfig = mergeSecurityConfigs([ this.options.security, match.metadata.security ]);

        try
        {
            // runEndpoint (not Timed alone) so a nested ForwardIntent can hop again.
            return await this.runEndpoint( match.metadata, req, securityConfig );
        }
        catch( err: any )
        {
            if( err instanceof SeoFallthrough )
            {
                throw Object.assign(
                    new Error( 'SEO fallthrough is not valid during forward' ),
                    { status : 500 }
                );
            }

            throw err;
        }
    }

    public fetch = async ( request: Request ): Promise<Response> => 
    {
        const probe = await this.answerHealthProbe( request );

        if( probe ) { return probe }

        await this.ensureReady();

        return runWithRegistry( this.registry, () => this.handleFetch( request ));
    };

    /**
     * Liveness / readiness are answered before bootstrap and routing so a broken module
     * graph cannot take the probes down. Returns null when health is disabled or the
     * path is not a probe.
     */
    private async answerHealthProbe( request: Request ): Promise<Response | null>
    {
        if( !this.options.health || request.method !== 'GET' ) { return null }

        const url = new URL( request.url );
        const paths = typeof this.options.health === 'object'
            ? {
                live  : this.options.health.path ?? '/health',
                ready : this.options.health.readyPath ?? '/ready'
            }
            : { live : '/health', ready : '/ready' };

        const requestId = resolveRequestId( request );
        const headers = {
            'Content-Type'      : 'application/json',
            [REQUEST_ID_HEADER] : requestId
        };

        if( url.pathname === paths.live )
        {
            return new Response( JSON.stringify({ status : 'ok' }), { status : 200, headers });
        }

        if( url.pathname === paths.ready )
        {
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

        return null;
    }

    private isReady(): boolean
    {
        if( !this.bootstrapped || this._isShuttingDown ) { return false }

        // In-process `fetch` without `start()` has no listener; bootstrapped is enough.
        if( !this.serverAdapter ) { return true }

        return this.listening;
    }

    private handleFetch = async ( request: Request ): Promise<Response> => 
    {
        this.internalEmit( 'request', request );

        const requestId = resolveRequestId( request );
    
        // Some Response headers are immutable, so fall back to cloning the response.
        // Always echo X-Request-Id last so correlation survives CORS/security merges.
        const withHeaders = ( res: Response, headers: Record<string, string> ): Response => 
        {
            const all = { ...headers, [REQUEST_ID_HEADER] : requestId };

            try 
            {
                for( const [ key, value ] of Object.entries( all )) 
                {
                    res.headers.set( key, value );
                }

                return res;
            }
            catch 
            {
                const merged = new Headers( res.headers );

                for( const [ key, value ] of Object.entries( all )) 
                {
                    merged.set( key, value );
                }

                return new Response( res.body, {
                    status     : res.status,
                    statusText : res.statusText,
                    headers    : merged
                });
            }
        };

        const withRequestId = ( res: Response ): Response =>
            withHeaders( res, {});

        const applyCors = ( res: Response, config: any ): Response => 
        {
            if( !config ) { return res }
            const corsHeaders = handleCors( request, config );

            if( corsHeaders && !( corsHeaders instanceof Response )) 
            {
                return withHeaders( res, corsHeaders );
            }

            return res;
        };

        const applySecurityHeaders = ( res: Response, config: any ): Response => 
        {
            if( config === undefined ) { return res }

            return withHeaders( res, generateSecurityHeaders( config ));
        };

        if( this.isShuttingDown ) 
        {
            let res = new Response( 'Service Unavailable (Shutting Down)', { status : 503 });
            res = applyCors( res, this.options.cors );
            res = applySecurityHeaders( res, mergeSecurityConfigs([this.options.security]));

            return withRequestId( res );
        }

        this.activeRequests++;
        const startTime = Date.now();
        const url = new URL( request.url );
        const path = url.pathname;
        const isUpgrade = request.headers.get( 'upgrade' )?.toLowerCase() === 'websocket';
        const method = isUpgrade ? 'WS' : request.method;
        const augmented = request as AugmentedRequest;
        augmented.trustProxy = this.options.trustProxy;
        augmented.requestId = requestId;

        if(( request as any ).remoteAddress !== undefined )
        {
            augmented.remoteAddress = ( request as any ).remoteAddress;
        }
    
        if( this.options.logs ) 
        {
            this.logger.info( `--> ${method} ${path}${url.search ? url.search : ''}`, {
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
            const seoMatches = isUpgrade ? [] : this.seoRouter.matchAll( method, path );
            const publicLookup = this.router.lookup( method, path );
            const seoLookup = this.seoRouter.lookup( method, path );
            const externalAllowed = this.externalAllowedMethods( path );

            const match = seoMatches[0] || publicLookup.match;
            finalMatch = match || ( method === 'OPTIONS'
                ? ( seoLookup.fallback || publicLookup.fallback )
                : null );

            const corsConfig = finalMatch ? ( finalMatch.metadata.cors !== undefined ? finalMatch.metadata.cors : this.options.cors ) : this.options.cors;
            const routeSecurity = finalMatch ? finalMatch.metadata.security : undefined;
            const securityConfig = mergeSecurityConfigs([this.options.security, routeSecurity]);

            const logOptions = ( status: number, note?: string ) =>
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
            };

            // A genuine CORS preflight is answered here, before guards run. Browsers omit
            // credentials on preflight, so dispatching it into a @Protect'ed route would
            // reject it and break CORS for every protected endpoint.
            if( isPreflight( request )) 
            {
                const corsRes = corsConfig ? handleCors( request, corsConfig ) : null;

                if( corsRes instanceof Response ) 
                {
                    logOptions( 204, 'CORS Preflight' );

                    return applySecurityHeaders( corsRes, securityConfig );
                }

                if( !finalMatch ) 
                {
                    logOptions( 404, 'Not Found' );

                    return applySecurityHeaders( new Response( 'Not Found', { status : 404 }), securityConfig );
                }

                logOptions( 204 );

                return applySecurityHeaders( this.optionsResponse( path, externalAllowed ), securityConfig );
            }

            // Non-preflight OPTIONS falls through to an @Options / @All handler when one
            // matched; otherwise the framework answers with Allow.
            if( method === 'OPTIONS' && !match ) 
            {
                if( !finalMatch ) 
                {
                    logOptions( 404, 'Not Found' );

                    return applySecurityHeaders( new Response( 'Not Found', { status : 404 }), securityConfig );
                }

                logOptions( 204 );

                return applyCors( applySecurityHeaders( this.optionsResponse( path, externalAllowed ), securityConfig ), corsConfig );
            }

            if( !finalMatch && seoMatches.length === 0 ) 
            {
                // The path exists under other verbs, so this is 405 + Allow, not 404. An
                // upgrade request is exempt: WS is a transport, not an advertised method.
                const wrongMethod = !isUpgrade && externalAllowed.length > 0;
                const status = wrongMethod ? 405 : 404;

                if( this.options.logs ) 
                {
                    const duration = Date.now() - startTime;
                    this.logger.info( `<-- ${method} ${path} - ${status} ${wrongMethod ? 'Method Not Allowed' : 'Not Found'} (${duration}ms)`, {
                        type : 'request_end',
                        method,
                        path,
                        status,
                        duration,
                        requestId
                    });
                }
                let res = new Response( wrongMethod ? 'Method Not Allowed' : 'Not Found', {
                    status,
                    headers : wrongMethod ? { Allow : externalAllowed.join( ', ' ) } : undefined
                });
                res = applyCors( res, this.options.cors );
                res = applySecurityHeaders( res, mergeSecurityConfigs([this.options.security]));

                return withRequestId( res );
            }

            if( isUpgrade ) 
            {
                // WS only lives on the public router (SEO/Internal are HTTP resolvers).
                const wsMatch = publicLookup.match;

                if( !wsMatch )
                {
                    logOptions( 404, 'Not Found' );

                    return withRequestId( new Response( 'Not Found', { status : 404 }));
                }

                finalMatch = wsMatch;

                // Enforce guards before upgrading
                const registry = getRegistry();
                const controllerModule = registry.getTokenModule( finalMatch.metadata.controller );
                const controller = await registry.getController( finalMatch.metadata.controller, controllerModule );

                if( !controller ) { throw new Error( `Controller ${finalMatch.metadata.controller} not registered` ) }

                // Run Guards
                const req = request as AugmentedRequest;
                req.params = finalMatch.params;
                req.queryString = queryStringFromUrl( req.url );
                req.query = parseQueryString( req.queryString );
                req.globalReviver = this.options.reviver;
                RequestProcessor.applyReviver( req, finalMatch.metadata, controllerModule );
                const ctx = { success : true, errors : [], mode : 'strict' };

                // The socket does not exist until after the upgrade, so @ConnectedSocket is null.
                await invokeGuards( finalMatch.metadata, req, {
                    ctx,
                    controller,
                    controllerModule,
                    websocket : null
                });

                if( !ctx.success ) 
                {
                    return withRequestId( new Response( JSON.stringify({
                        success : false,
                        message : 'request validation failed',
                        errors  : ctx.errors
                    }), {
                        status  : 400,
                        headers : { 'Content-Type' : 'application/json' }
                    }));
                }

                if( this.serverAdapter && typeof this.serverAdapter.upgrade === 'function' ) 
                {
                    const res = await this.serverAdapter.upgrade( request, finalMatch.metadata, finalMatch.params );

                    return withRequestId( res );
                }

                return withRequestId( new Response( 'WebSockets not supported by adapter', { status : 501 }));
            }

            const req = request as AugmentedRequest;
            let response: Response | undefined;
            let activeSecurity = securityConfig;
            let activeCors = corsConfig;

            const enforceSecurityGates = ( cfg: SecurityOptions | undefined ) =>
            {
                // Enforce allowedContentTypes (require a matching CT when a body is indicated)
                if( cfg?.allowedContentTypes && method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS' ) 
                {
                    const contentType = getContentType( req );
                    const allowed = cfg.allowedContentTypes.map( t => t.toLowerCase());

                    if( requestLikelyHasBody( req ))
                    {
                        if( !contentType || !allowed.includes( contentType ))
                        {
                            throw Object.assign( new Error( `Unsupported Media Type: ${contentType || 'missing'}` ), { status : 415 });
                        }
                    }
                    else if( contentType && !allowed.includes( contentType ))
                    {
                        throw Object.assign( new Error( `Unsupported Media Type: ${contentType}` ), { status : 415 });
                    }
                }

                // Enforce rateLimit
                if( cfg?.rateLimit ) 
                {
                    const ip = resolveClientIp( req, this.options.trustProxy );
                    const limit = this.rateLimiter.consume( ip, path, cfg.rateLimit );

                    if( !limit.allowed ) 
                    {
                        throw Object.assign( new Error( 'Too Many Requests' ), {
                            status  : 429,
                            headers : { 'Retry-After' : String( limit.retryAfter ) }
                        });
                    }
                }
            };

            // Try SEO matches in specificity order; void → next; forward → internal hop.
            for( const seoMatch of seoMatches )
            {
                this.applyMatchBags( req, seoMatch );
                activeSecurity = mergeSecurityConfigs([ this.options.security, seoMatch.metadata.security ]);
                activeCors = seoMatch.metadata.cors !== undefined ? seoMatch.metadata.cors : this.options.cors;
                enforceSecurityGates( activeSecurity );

                try
                {
                    response = await this.runEndpoint( seoMatch.metadata, req, activeSecurity );
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
                    const allowedAfterSeo = seoMatches.length > 0
                        ? publicLookup.allowed
                        : externalAllowed;
                    const wrongMethod = allowedAfterSeo.length > 0;
                    const status = wrongMethod ? 405 : 404;
                    let res = new Response( wrongMethod ? 'Method Not Allowed' : 'Not Found', {
                        status,
                        headers : wrongMethod ? { Allow : allowedAfterSeo.join( ', ' ) } : undefined
                    });
                    res = applyCors( res, this.options.cors );
                    res = applySecurityHeaders( res, mergeSecurityConfigs([ this.options.security ]));

                    if( this.options.logs )
                    {
                        const duration = Date.now() - startTime;
                        this.logger.info( `<-- ${method} ${path} - ${status} ${wrongMethod ? 'Method Not Allowed' : 'Not Found'} (${duration}ms)`, {
                            type : 'request_end',
                            method,
                            path,
                            status,
                            duration,
                            requestId
                        });
                    }

                    return withRequestId( res );
                }

                this.applyMatchBags( req, pubMatch );
                activeSecurity = mergeSecurityConfigs([ this.options.security, pubMatch.metadata.security ]);
                activeCors = pubMatch.metadata.cors !== undefined ? pubMatch.metadata.cors : this.options.cors;
                enforceSecurityGates( activeSecurity );
                response = await this.runEndpoint( pubMatch.metadata, req, activeSecurity );
            }

            response = applyCors( response!, activeCors );
            response = applySecurityHeaders( response, activeSecurity );

            // RFC 9110: an OPTIONS response should advertise Allow.
            if( method === 'OPTIONS' && !response.headers.has( 'Allow' )) 
            {
                const allowed = this.externalAllowedMethods( path );

                if( allowed.length > 0 ) 
                {
                    response = withHeaders( response, { Allow : allowed.join( ', ' ) });
                }
            }
      
            if( this.options.logs ) 
            {
                const duration = Date.now() - startTime;
                this.logger.info( `<-- ${method} ${path} - ${response.status} (${duration}ms)`, {
                    type   : 'request_end',
                    method,
                    path,
                    status : response.status,
                    duration,
                    requestId
                });
            }

            if( method === 'HEAD' ) 
            {
                response = new Response( null, {
                    status     : response.status,
                    statusText : response.statusText,
                    headers    : response.headers
                });
            }

            return withRequestId( response );
        }
        catch ( err: any ) 
        {
            this.internalEmit( 'error', err );
            const statusCode = httpStatusFromError( err );

            if( this.options.logs ) 
            {
                this.logger.error( `Server Error: ${err.message}`, {
                    type  : 'error',
                    error : errorLogFields( err ),
                    requestId
                });
            }

            if( this.options.logs ) 
            {
                const duration = Date.now() - startTime;
                this.logger.info( `<-- ${method} ${path} - ${statusCode} (${duration}ms)`, {
                    type   : 'request_end',
                    method,
                    path,
                    status : statusCode,
                    duration,
                    requestId
                });
            }
      
            const corsConfig = finalMatch ? ( finalMatch.metadata.cors !== undefined ? finalMatch.metadata.cors : this.options.cors ) : this.options.cors;
            const routeSecurity = finalMatch ? finalMatch.metadata.security : undefined;
            const errSecurityConfig = mergeSecurityConfigs([this.options.security, routeSecurity]);
      
            const errHeaders: Record<string, string> = { 'Content-Type' : 'application/json' };

            // Errors may carry protocol headers of their own, e.g. Retry-After on a 429.
            if( err.headers && typeof err.headers === 'object' ) 
            {
                for( const [ key, value ] of Object.entries( err.headers as Record<string, unknown> )) 
                {
                    if( typeof value === 'string' ) { errHeaders[key] = value }
                }
            }

            let res = new Response( JSON.stringify( clientErrorBody( err, statusCode ) ), {
                status  : statusCode,
                headers : errHeaders
            });
            res = applyCors( res, corsConfig );
            res = applySecurityHeaders( res, errSecurityConfig );

            if( method === 'HEAD' ) 
            {
                res = new Response( null, {
                    status     : res.status,
                    statusText : res.statusText,
                    headers    : res.headers
                });
            }

            return withRequestId( res );
        }
        finally 
        {
            this.activeRequests--;
        }
    };
}
