import { EventEmitter } from 'node:events';
import { Router, RouteMatch, type RouteLookup } from './core/router.js';
import { joinQueryStrings, pathnameFromUrl, queryStringFromBag } from './helpers/query-string.js';
import { ApplicationRegistry, getRegistry, runWithRegistry } from './core/registry.js';
import { bootstrapRegistry } from './core/bootstrap.js';
import
{
    DIRECT_RESPONSE_BODY,
    EndpointMetadata,
    ForwardIntent,
    LogContext,
    Logger,
    SeoFallthrough,
    SeoForward,
    tagDirectResponse
}
    from './core/types.js';
import { getModuleMeta } from './core/symbols.js';
import { ServerRequest } from './core/server-request.js';
import { Context, type RequestContext } from './core/context.js';
import { CorsOptions, SecurityOptions, type FileOptions, type Reviver } from './decorators.js';
import { handleCors, isPreflight, mergeCorsConfigs } from './helpers/cors.js';
import { mergeSecurityConfigs, generateSecurityHeaders, getAllowedContentTypesSet, isHostAllowed } from './helpers/security.js';
import { mergeFileConfigs, resolveMultipartTotalLimit } from './helpers/file-upload.js';

import { FINALIZED_RESPONSE, RequestProcessor, type ExecuteOptions } from './core/request-processor.js';
import { invokeGuards } from './core/guard-runner.js';
import { RateLimiter } from './helpers/rate-limiter.js';
import { ServerAdapter, normalizeHostList } from './adapters/adapter.js';
import type { TlsOptions, NodeHttpOptions } from './adapters/adapter.js';
export type { TlsOptions, NodeHttpOptions };
import { NodeAdapter } from './adapters/node-adapter.js';
import { BunAdapter } from './adapters/bun-adapter.js';
import { DenoAdapter } from './adapters/deno-adapter.js';
import { getContentType, requestLikelyHasBody, resolveBodyLimit } from './helpers/request-reader.js';
import { compileTrustProxy, type CompiledTrustProxy, type TrustProxy } from './helpers/client-ip.js';
import { httpStatusFromError } from './errors.js';
import { clientErrorBody, errorLogFields } from './helpers/error-response.js';
import { resolveRequestId, REQUEST_ID_HEADER } from './helpers/request-id.js';

/** Max internal rewrite hops per request (cycle detection is separate). */
const MAX_FORWARD_DEPTH = 16;
const DEFAULT_RP_EXECUTE = RequestProcessor.execute;


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
    cors?             : CorsOptions | boolean | string | null
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
    trustProxy?       : boolean | TrustProxy
    /** Passed to typechecker `parse` for JSON and query, and to untyped JSON / urlencoded bodies. Hierarchical with Module / `@Reviver`. `null` opts out. */
    reviver?          : Reviver | null
    /**
     * Whether to expose raw `err.message` strings on 5xx responses when `err.data` is absent.
     * Defaults to `false` (returns `"Internal server error"` to prevent internal detail leaks).
     */
    exposeErrors?     : boolean
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

const EMPTY_SEO_MATCHES: RouteMatch[] = [];
const NO_SEC_JSON_HEADERS_TEMPLATE = new Headers({ 'Content-Type' : 'application/json' });
const NO_SEC_BASE_HEADERS_TEMPLATE = new Headers();
const compiledSecurityHeadersCache = new WeakMap<SecurityOptions, [ string, string ][]>();
const compiledJsonHeadersCache = new WeakMap<SecurityOptions, Headers>();
const compiledBaseHeadersCache = new WeakMap<SecurityOptions, Headers>();
const securityHasGatesCache = new WeakMap<SecurityOptions, boolean>();

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

function getCompiledJsonHeadersTemplate( securityConfig?: SecurityOptions ): Headers
{
    if( securityConfig === undefined ){ return NO_SEC_JSON_HEADERS_TEMPLATE }

    let cached = compiledJsonHeadersCache.get( securityConfig );

    if( !cached )
    {
        cached = new Headers({ 'Content-Type' : 'application/json' });
        const secHeaders = getCompiledSecurityHeaders( securityConfig );

        for( let i = 0; i < secHeaders.length; i++ )
        {
            cached.set( secHeaders[i][0], secHeaders[i][1]);
        }

        compiledJsonHeadersCache.set( securityConfig, cached );
    }

    return cached;
}

function getCompiledBaseHeadersTemplate( securityConfig?: SecurityOptions ): Headers
{
    if( securityConfig === undefined ){ return NO_SEC_BASE_HEADERS_TEMPLATE }

    let cached = compiledBaseHeadersCache.get( securityConfig );

    if( !cached )
    {
        cached = new Headers();
        const secHeaders = getCompiledSecurityHeaders( securityConfig );

        for( let i = 0; i < secHeaders.length; i++ )
        {
            cached.set( secHeaders[i][0], secHeaders[i][1]);
        }

        compiledBaseHeadersCache.set( securityConfig, cached );
    }

    return cached;
}

function hasSecurityGates( cfg?: SecurityOptions ): boolean
{
    if( !cfg ){ return false }

    let cached = securityHasGatesCache.get( cfg );

    if( cached === undefined )
    {
        cached = Boolean(
            ( cfg.allowedHosts && cfg.allowedHosts !== true )
            || ( cfg.allowedContentTypes && cfg.allowedContentTypes.length > 0 )
            || cfg.rateLimit
        );
        securityHasGatesCache.set( cfg, cached );
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

interface SignalHandlePair
{
    sigterm : () => void
    sigint  : () => void
}

const serverSignalFinalizer = typeof FinalizationRegistry === 'function'
    ? new FinalizationRegistry<SignalHandlePair>(( pair ) =>
    {
        if( typeof process !== 'undefined' && typeof process.off === 'function' )
        {
            process.off( 'SIGTERM', pair.sigterm );
            process.off( 'SIGINT', pair.sigint );
        }
    })
    : undefined;

function cancelResponseBody( res: Response ): void
{
    if( DIRECT_RESPONSE_BODY in res || !res.body ){ return }

    try
    {
        void res.body.cancel()?.catch(() => undefined );
    }
    catch
    {
        // ignore cancel failures on locked/already-closed streams
    }
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
    private serverAdapter?           : ServerAdapter;
    private _isShuttingDown = false;
    private listening = false;
    private rateLimiter = new RateLimiter();
    private bootstrapped = false;
    private bootstrapPromise?        : Promise<void>;
    /** Per-Server metadata / DI registry (no process-global store). */
    public readonly registry = new ApplicationRegistry();
    private sigtermListener?         : () => void;
    private sigintListener?          : () => void;
    private compiledTrustProxy       : CompiledTrustProxy | null;
    private hasSeoRoutes = false;
    private baseSecurityConfig       : SecurityOptions | undefined;
    private baseHasSecurityGates     : boolean;
    private baseJsonHeadersTemplate  : Headers;
    private baseBaseHeadersTemplate  : Headers;
    private routeSecurityCache = new WeakMap<EndpointMetadata, SecurityOptions | undefined>();
    private baseCorsConfig           : CorsOptions | undefined;
    private routeCorsCache = new WeakMap<EndpointMetadata, CorsOptions | undefined>();
    private hasHealthProbe           : boolean;
    private healthLivePath           : string;
    private healthReadyPath          : string;
    private readonly onEndpointError : ( err: unknown, status: number, requestId?: string ) => void;
    private defaultExecOptions       : ExecuteOptions;
    private baseFastExecOptions      : ExecuteOptions;
    private fastExecOptionsCache = new WeakMap<SecurityOptions, ExecuteOptions>();
    public logger                    : Logger;

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
        this.baseHasSecurityGates = hasSecurityGates( this.baseSecurityConfig );
        this.baseJsonHeadersTemplate = getCompiledJsonHeadersTemplate( this.baseSecurityConfig );
        this.baseBaseHeadersTemplate = getCompiledBaseHeadersTemplate( this.baseSecurityConfig );
        this.baseCorsConfig = mergeCorsConfigs([ options.cors ]);
        this.hasHealthProbe = Boolean( options.health );
        this.healthLivePath = typeof options.health === 'object' ? ( options.health.path ?? '/health' ) : '/health';
        this.healthReadyPath = typeof options.health === 'object' ? ( options.health.readyPath ?? '/ready' ) : '/ready';
        this.onEndpointError = ( err: unknown, status: number, requestId?: string ) =>
        {
            this.reportEndpointError( err, status, requestId );
        };
        const exposeErrors = Boolean( options.exposeErrors );
        this.defaultExecOptions = {
            exposeErrors,
            onError : this.onEndpointError
        };
        this.baseFastExecOptions = {
            exposeErrors,
            onError             : this.onEndpointError,
            jsonHeadersTemplate : this.baseJsonHeadersTemplate,
            baseHeadersTemplate : this.baseBaseHeadersTemplate
        };

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

        if( this.bootstrapPromise )
        {
            await this.bootstrapPromise;

            return;
        }

        const work = ( async () =>
        {
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
        })();

        this.bootstrapPromise = work;

        try
        {
            await work;
        }
        finally
        {
            this.bootstrapPromise = undefined;
        }
    }

    /** @deprecated Use ensureReady() — kept for tests that called init(). */
    private async init()
    {
        await this.ensureReady();
    }

    public override on<K extends keyof ServerEvents>( event: K, handler: ServerEvents[K]): this;
    public override on( event: string | symbol, handler: ( ...args: any[]) => void ): this;
    public override on( event: string | symbol, handler: ( ...args: any[]) => void ): this
    {
        return super.on( event, handler );
    }

    public override off<K extends keyof ServerEvents>( event: K, handler: ServerEvents[K]): this;
    public override off( event: string | symbol, handler: ( ...args: any[]) => void ): this;
    public override off( event: string | symbol, handler: ( ...args: any[]) => void ): this
    {
        return super.off( event, handler );
    }

    public override once<K extends keyof ServerEvents>( event: K, handler: ServerEvents[K]): this;
    public override once( event: string | symbol, handler: ( ...args: any[]) => void ): this;
    public override once( event: string | symbol, handler: ( ...args: any[]) => void ): this
    {
        return super.once( event, handler );
    }

    private internalEmit<K extends keyof ServerEvents>( event: K, ...args: Parameters<ServerEvents[K]> ): void
    {
        if( event === 'error' && this.listenerCount( 'error' ) === 0 )
        {
            return;
        }

        this.emit( event, ...args );
    }

    private setupSignals(): void
    {
        if( this.sigtermListener || this.sigintListener ){ return }

        const selfRef = new WeakRef( this );
        const handleSignal = ( signal: string ) => 
        {
            const srv = selfRef.deref();

            if( !srv ){ return }

            srv.removeSignals();

            if( srv.options.logs ) 
            {
                srv.logger.warn( `\nReceived ${signal}. Starting graceful shutdown...`, {
                    type   : 'server_shutdown',
                    reason : signal
                });
            }
            void srv.shutdown( signal );
        };

        this.sigtermListener = () => handleSignal( 'SIGTERM' );
        this.sigintListener = () => handleSignal( 'SIGINT' );

        if( typeof process !== 'undefined' && typeof process.on === 'function' ) 
        {
            process.on( 'SIGTERM', this.sigtermListener );
            process.on( 'SIGINT', this.sigintListener );
            serverSignalFinalizer?.register( this, {
                sigterm : this.sigtermListener,
                sigint  : this.sigintListener
            }, this );
        }
    }

    private removeSignals(): void
    {
        serverSignalFinalizer?.unregister( this );

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
            const httpOpts: NodeHttpOptions = {
                headersTimeout     : this.options.headersTimeout,
                requestTimeout     : this.options.requestTimeout,
                keepAliveTimeout   : this.options.keepAliveTimeout,
                maxRequestBodySize : this.resolveMaxRequestBodySize()
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

    private getFastExecOptions( securityConfig?: SecurityOptions ): ExecuteOptions
    {
        if( securityConfig === this.baseSecurityConfig )
        {
            return this.baseFastExecOptions;
        }

        if( securityConfig === undefined )
        {
            return {
                exposeErrors        : Boolean( this.options.exposeErrors ),
                onError             : this.onEndpointError,
                jsonHeadersTemplate : NO_SEC_JSON_HEADERS_TEMPLATE,
                baseHeadersTemplate : NO_SEC_BASE_HEADERS_TEMPLATE
            };
        }

        let cached = this.fastExecOptionsCache.get( securityConfig );

        if( !cached )
        {
            cached = {
                exposeErrors        : Boolean( this.options.exposeErrors ),
                onError             : this.onEndpointError,
                jsonHeadersTemplate : getCompiledJsonHeadersTemplate( securityConfig ),
                baseHeadersTemplate : getCompiledBaseHeadersTemplate( securityConfig )
            };
            this.fastExecOptionsCache.set( securityConfig, cached );
        }

        return cached;
    }

    private async runEndpoint(
        metadata: EndpointMetadata,
        sreq: ServerRequest,
        securityConfig: SecurityOptions | undefined,
        request: Request
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
                return this.executeForward( err.target, sreq, request );
            }

            throw err;
        }
    }

    private reportEndpointError( err: unknown, status: number, requestId?: string ): void
    {
        if( status < 500 ){ return }

        if( this.listenerCount( 'error' ) > 0 )
        {
            this.internalEmit( 'error', err instanceof Error ? err : new Error( String( err )));
        }

        if( this.options.logs )
        {
            const msg = err && typeof err === 'object' && typeof ( err as { message? : unknown }).message === 'string'
                ? ( err as { message : string }).message
                : String( err );
            this.logger.error( `Server Error: ${msg}`, {
                type  : 'error',
                error : errorLogFields( err ) as any,
                requestId
            });
        }
    }

    private runEndpointTimed(
        metadata: EndpointMetadata,
        sreq: ServerRequest,
        securityConfig?: SecurityOptions
    ): Promise<Response>
    {
        if( !securityConfig?.timeout )
        {
            return RequestProcessor.execute( metadata, sreq, securityConfig, this.registry, this.defaultExecOptions );
        }

        return this.runEndpointWithTimeout( metadata, sreq, securityConfig, securityConfig.timeout );
    }

    private async runEndpointWithTimeout(
        metadata: EndpointMetadata,
        sreq: ServerRequest,
        securityConfig: SecurityOptions,
        timeoutMs: number
    ): Promise<Response>
    {
        const prevSignal = sreq.signal;
        const controller = new AbortController();

        if( prevSignal )
        {
            if( prevSignal.aborted ){ controller.abort() }
            else { prevSignal.addEventListener( 'abort', () => controller.abort(), { once : true }) }
        }

        sreq.signal = controller.signal;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const work = RequestProcessor.execute( metadata, sreq, securityConfig, this.registry, this.defaultExecOptions );

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
                    timer.unref?.();
                })
            ]);
        }
        finally
        {
            if( timer !== undefined ) { clearTimeout( timer ) }
            void work.catch(() => undefined );
        }
    }

    /**
     * Internal rewrite: look up `method`+`path` on public ∪ internal (SEO skipped).
     * Nested forwards are allowed up to {@link MAX_FORWARD_DEPTH}; cycles are rejected.
     */
    private async executeForward( target: SeoForward, sreq: ServerRequest, request: Request ): Promise<Response>
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
        sreq.forwardBody = target.body !== undefined ? target.body : undefined;

        const securityConfig = this.resolveEndpointSecurity( match.metadata );
        this.enforceSecurityGates( securityConfig, request, sreq, method, match.metadata.path );

        // runEndpoint (not Timed alone) so a nested ForwardIntent can hop again.
        return await this.runEndpoint( match.metadata, sreq, securityConfig, request );
    }

    /** @internal */
    public fetch = ( request: Request ): Promise<Response> => 
    {
        if( this.hasHealthProbe && request.method === 'GET' )
        {
            const pathname = pathnameFromUrl( request.url );

            if( pathname === this.healthLivePath || pathname === this.healthReadyPath )
            {
                return this.answerHealthProbeForPath( request, pathname );
            }
        }

        if( this.bootstrapped )
        {
            return this.handleFetch( request );
        }

        return this.ensureReady().then(() => this.handleFetch( request ));
    };

    /**
     * Liveness / readiness are answered before bootstrap and routing so a broken module
     * graph cannot take the probes down.
     */
    private async answerHealthProbeForPath( request: Request, pathname: string ): Promise<Response>
    {
        const requestId = resolveRequestId( request );
        const headers = {
            'Content-Type'      : 'application/json',
            [REQUEST_ID_HEADER] : requestId
        };

        if( pathname === this.healthLivePath )
        {
            const body = JSON.stringify({ status : 'ok' });

            return tagDirectResponse( new Response( body, { status : 200, headers }), body );
        }

        try
        {
            await this.ensureReady();
        }
        catch
        {
            const body = JSON.stringify({ status : 'not_ready' });

            return tagDirectResponse( new Response( body, { status : 503, headers }), body );
        }

        const ready = this.isReady();
        const body = JSON.stringify({ status : ready ? 'ready' : 'not_ready' });

        return tagDirectResponse( new Response( body, { status : ready ? 200 : 503, headers }), body );
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

    private resolveEndpointCors( metadata?: EndpointMetadata ): CorsOptions | undefined
    {
        if( !metadata || metadata.cors === undefined )
        {
            return this.baseCorsConfig;
        }

        if( this.routeCorsCache.has( metadata ))
        {
            return this.routeCorsCache.get( metadata );
        }

        const merged = mergeCorsConfigs([ this.baseCorsConfig, metadata.cors ]);
        this.routeCorsCache.set( metadata, merged );

        return merged;
    }

    private resolveMaxRequestBodySize(): number
    {
        const baseLimit = resolveBodyLimit( this.baseSecurityConfig ).limit;

        if( baseLimit === undefined )
        {
            return Number.MAX_SAFE_INTEGER;
        }

        let maxBytes = baseLimit;

        if( this.options.files )
        {
            const globalFileLimit = resolveMultipartTotalLimit( this.baseSecurityConfig, this.options.files );

            if( globalFileLimit === undefined )
            {
                return Number.MAX_SAFE_INTEGER;
            }

            if( globalFileLimit > maxBytes )
            {
                maxBytes = globalFileLimit;
            }
        }

        for( const ep of this.registry.getEndpoints())
        {
            const sec = this.resolveEndpointSecurity( ep );
            const bodyLimit = resolveBodyLimit( sec ).limit;

            if( bodyLimit === undefined )
            {
                return Number.MAX_SAFE_INTEGER;
            }

            if( bodyLimit > maxBytes )
            {
                maxBytes = bodyLimit;
            }

            const controllerModule = this.registry.getTokenModule( ep.controller );
            const moduleCtor = controllerModule?.moduleClass || controllerModule?.constructor;
            const moduleFiles = ( moduleCtor && getModuleMeta( moduleCtor )?.files )
                ?? controllerModule?.__moduleMetadata__?.files
                ?? controllerModule?.files;
            const usesFiles = Boolean(
                ep.files
                || moduleFiles
                || this.options.files
                || ( Array.isArray( ep.params ) && ep.params.some(( p: any ) => p?.source === 'File' || p?.source === 'Files' || p?.source === 'Body' ))
            );

            if( usesFiles )
            {
                const mergedFiles = mergeFileConfigs([ this.options.files, moduleFiles, ep.files ]);
                const fileLimit = resolveMultipartTotalLimit( sec, mergedFiles );

                if( fileLimit === undefined )
                {
                    return Number.MAX_SAFE_INTEGER;
                }

                if( fileLimit > maxBytes )
                {
                    maxBytes = fileLimit;
                }
            }
        }

        return maxBytes;
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
        if(( res as any )[FINALIZED_RESPONSE] === true )
        {
            return res;
        }

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

            if( DIRECT_RESPONSE_BODY in res )
            {
                const direct = ( res as any )[DIRECT_RESPONSE_BODY] as string | Uint8Array | null;

                return tagDirectResponse( new Response( direct as BodyInit | null, {
                    status     : res.status,
                    statusText : res.statusText,
                    headers    : merged
                }), direct );
            }

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
        const hasGates = cfg === this.baseSecurityConfig
            ? this.baseHasSecurityGates
            : hasSecurityGates( cfg );

        if( !hasGates ){ return }

        // Enforce allowedHosts (HTTP Host header allowlist)
        if( cfg?.allowedHosts && cfg.allowedHosts !== true && !isHostAllowed( request.headers.get( 'host' ), cfg ))
        {
            throw Object.assign( new Error( 'Forbidden: Disallowed Host' ), { status : 403 });
        }

        // Enforce allowedContentTypes (require a matching CT when a body is indicated)
        if( cfg?.allowedContentTypes && cfg.allowedContentTypes.length > 0 && method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS' && method !== 'WS' ) 
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
            const limit = this.rateLimiter.consume( ip, routeKey, cfg.rateLimit, method );

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

    private resolveExternalAllowed( path: string, publicLookup: RouteLookup ): string[]
    {
        if( !this.hasSeoRoutes && !publicLookup.match )
        {
            return publicLookup.allowed;
        }

        return this.externalAllowedMethods( path );
    }

    private async handleFetchError(
        err: any,
        request: Request,
        sreq: ServerRequest,
        method: string,
        path: string,
        startTime: number,
        requestId: string,
        finalMatch: RouteMatch | null
    ): Promise<Response>
    {
        try
        {
            await sreq.cleanupDiskUploads();

            if( this.listenerCount( 'error' ) > 0 )
            {
                this.internalEmit( 'error', err );
            }

            const statusCode = httpStatusFromError( err );

            if( this.options.logs ) 
            {
                this.logger.error( `Server Error: ${err.message}`, {
                    type  : 'error',
                    error : errorLogFields( err ) as any,
                    requestId
                });
                this.logRequestEnd( startTime, method, path, statusCode, requestId );
            }

            const corsConfig = this.resolveEndpointCors( finalMatch?.metadata );
            const errSecurityConfig = this.resolveEndpointSecurity( finalMatch?.metadata );
            const errHeaders: Record<string, string> = { 'Content-Type' : 'application/json' };

            // Errors may carry protocol headers of their own, e.g. Retry-After on a 429.
            if( err && typeof err === 'object' && err.headers && typeof err.headers === 'object' ) 
            {
                if( err.headers instanceof Headers )
                {
                    err.headers.forEach(( value: string, key: string ) =>
                    {
                        errHeaders[key] = value;
                    });
                }
                else
                {
                    for( const [ key, value ] of Object.entries( err.headers as Record<string, unknown> )) 
                    {
                        if( typeof value === 'string' ) { errHeaders[key] = value }
                    }
                }
            }

            const errBody = JSON.stringify( clientErrorBody( err, statusCode, Boolean( this.options.exposeErrors )));
            let res = tagDirectResponse( new Response( errBody, {
                status  : statusCode,
                headers : errHeaders
            }), errBody );
            res = this.finalizeResponse( res, request, requestId, corsConfig, errSecurityConfig );

            if( method === 'HEAD' ) 
            {
                res = tagDirectResponse( new Response( null, {
                    status     : res.status,
                    statusText : res.statusText,
                    headers    : res.headers
                }), null );
            }

            return res;
        }
        finally
        {
            this.activeRequests--;
        }
    }

    private async finishPublicAsync(
        pendingPromise: Promise<Response>,
        request: Request,
        sreq: ServerRequest,
        method: string,
        path: string,
        startTime: number,
        requestId: string,
        finalMatch: RouteMatch,
        activeCors: CorsOptions | undefined,
        activeSecurity: SecurityOptions | undefined
    ): Promise<Response>
    {
        try
        {
            let response: Response;

            try
            {
                response = await pendingPromise;
            }
            catch( err: any )
            {
                if( err instanceof ForwardIntent )
                {
                    response = await this.executeForward( err.target, sreq, request );
                }
                else
                {
                    throw err;
                }
            }

            response = this.finalizeResponse( response, request, requestId, activeCors, activeSecurity );
            this.logRequestEnd( startTime, method, path, response.status, requestId );

            if( method === 'HEAD' )
            {
                cancelResponseBody( response );
                response = tagDirectResponse( new Response( null, {
                    status     : response.status,
                    statusText : response.statusText,
                    headers    : response.headers
                }), null );
            }

            this.activeRequests--;

            return response;
        }
        catch( err: any )
        {
            return this.handleFetchError( err, request, sreq, method, path, startTime, requestId, finalMatch );
        }
    }

    private handleFetch = ( request: Request ): Promise<Response> => 
    {
        if( this.listenerCount( 'request' ) > 0 )
        {
            this.internalEmit( 'request', request );
        }

        const requestId = resolveRequestId( request );

        if( this._isShuttingDown ) 
        {
            const body = 'Service Unavailable (Shutting Down)';
            const res = tagDirectResponse( new Response( body, { status : 503 }), body );

            return Promise.resolve(
                this.finalizeResponse( res, request, requestId, this.baseCorsConfig, this.baseSecurityConfig )
            );
        }

        this.activeRequests++;
        const startTime = this.options.logs ? Date.now() : 0;
        const rawMethod = request.method;
        const isUpgrade = rawMethod === 'GET' && request.headers.get( 'upgrade' )?.toLowerCase() === 'websocket';
        const method = isUpgrade ? 'WS' : rawMethod;
        const sreq = ServerRequest.createInternal(
            request,
            requestId,
            this.options.trustProxy,
            this.compiledTrustProxy,
            this.options.files,
            this.options.reviver
        );
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

        if( isUpgrade || this.hasSeoRoutes || method === 'OPTIONS' )
        {
            return this.handleFetchComplex( request, sreq, method, path, isUpgrade, startTime, requestId );
        }

        let finalMatch: RouteMatch | null = null;

        try
        {
            const publicLookup = this.router.lookup( method, path );
            const pubMatch = publicLookup.match;

            if( !pubMatch )
            {
                const externalAllowed = publicLookup.allowed;
                const wrongMethod = externalAllowed.length > 0;
                const status = wrongMethod ? 405 : 404;
                const body = wrongMethod ? 'Method Not Allowed' : 'Not Found';

                this.logRequestEnd( startTime, method, path, status, requestId, body );

                let res = tagDirectResponse( new Response( body, {
                    status,
                    headers : wrongMethod ? { Allow : externalAllowed.join( ', ' ) } : undefined
                }), body );
                res = this.finalizeResponse( res, request, requestId, this.baseCorsConfig, this.baseSecurityConfig );

                if( method === 'HEAD' )
                {
                    res = tagDirectResponse( new Response( null, {
                        status     : res.status,
                        statusText : res.statusText,
                        headers    : res.headers
                    }), null );
                }

                this.activeRequests--;

                return Promise.resolve( res );
            }

            finalMatch = pubMatch;
            sreq.params = pubMatch.params;
            sreq.routeFiles = pubMatch.metadata.files;

            const activeSecurity = pubMatch.metadata.security === undefined
                ? this.baseSecurityConfig
                : this.resolveEndpointSecurity( pubMatch.metadata );
            const activeCors = pubMatch.metadata.cors === undefined
                ? this.baseCorsConfig
                : this.resolveEndpointCors( pubMatch.metadata );

            this.enforceSecurityGates( activeSecurity, request, sreq, method, pubMatch.metadata.path );

            if( activeCors || activeSecurity?.timeout || RequestProcessor.execute !== DEFAULT_RP_EXECUTE )
            {
                const work = this.runEndpoint( pubMatch.metadata, sreq, activeSecurity, request );

                return this.finishPublicAsync(
                    work,
                    request,
                    sreq,
                    method,
                    path,
                    startTime,
                    requestId,
                    pubMatch,
                    activeCors,
                    activeSecurity
                );
            }

            const fastExecOpts = this.getFastExecOptions( activeSecurity );
            const outOrPromise = RequestProcessor.executeInternal(
                pubMatch.metadata,
                sreq,
                activeSecurity,
                this.registry,
                fastExecOpts
            );

            if( outOrPromise instanceof Promise )
            {
                return this.finishPublicAsync(
                    outOrPromise,
                    request,
                    sreq,
                    method,
                    path,
                    startTime,
                    requestId,
                    pubMatch,
                    activeCors,
                    activeSecurity
                );
            }

            let response = this.finalizeResponse( outOrPromise, request, requestId, undefined, activeSecurity );
            this.logRequestEnd( startTime, method, path, response.status, requestId );

            if( method === 'HEAD' )
            {
                cancelResponseBody( response );
                response = tagDirectResponse( new Response( null, {
                    status     : response.status,
                    statusText : response.statusText,
                    headers    : response.headers
                }), null );
            }

            this.activeRequests--;

            return Promise.resolve( response );
        }
        catch( err: any )
        {
            if( err instanceof ForwardIntent )
            {
                const activeSecurity = finalMatch ? this.resolveEndpointSecurity( finalMatch.metadata ) : this.baseSecurityConfig;
                const activeCors = finalMatch ? this.resolveEndpointCors( finalMatch.metadata ) : this.baseCorsConfig;

                return this.finishPublicAsync(
                    this.executeForward( err.target, sreq, request ),
                    request,
                    sreq,
                    method,
                    path,
                    startTime,
                    requestId,
                    finalMatch!,
                    activeCors,
                    activeSecurity
                );
            }

            return this.handleFetchError( err, request, sreq, method, path, startTime, requestId, finalMatch );
        }
    };

    private async handleFetchComplex(
        request: Request,
        sreq: ServerRequest,
        method: string,
        path: string,
        isUpgrade: boolean,
        startTime: number,
        requestId: string
    ): Promise<Response>
    {
        let finalMatch: RouteMatch | null = null;

        try 
        {
            // SEO group first (matchAll for void fallthrough), then public. Internal never
            // participates in external lookup.
            const seoMatches = ( isUpgrade || !this.hasSeoRoutes ) ? EMPTY_SEO_MATCHES : this.seoRouter.matchAll( method, path );
            const publicLookup = this.router.lookup( method, path );

            const preflightReq = !isUpgrade && method === 'OPTIONS' && isPreflight( request );
            const acrm = preflightReq
                ? request.headers.get( 'access-control-request-method' )?.trim().toUpperCase()
                : undefined;
            const preflightTargetMatch = acrm
                ? (( this.hasSeoRoutes ? this.seoRouter.match( acrm, path ) : null ) || this.router.match( acrm, path ))
                : null;

            const match = seoMatches[0] || publicLookup.match;
            finalMatch = match || preflightTargetMatch || ( method === 'OPTIONS'
                ? (( this.hasSeoRoutes ? this.seoRouter.lookup( method, path ).fallback : null ) || publicLookup.fallback )
                : null );

            const corsConfig = this.resolveEndpointCors( finalMatch?.metadata );
            const securityConfig = this.resolveEndpointSecurity( finalMatch?.metadata );

            // A genuine CORS preflight is answered here, before guards run. Browsers omit
            // credentials on preflight, so dispatching it into a @Protect'ed route would
            // reject it and break CORS for every protected endpoint.
            if( preflightReq ) 
            {
                // Enforce allowedHosts even on preflights so Host-header allowlists cannot be bypassed.
                if( securityConfig?.allowedHosts && securityConfig.allowedHosts !== true && !isHostAllowed( request.headers.get( 'host' ), securityConfig ))
                {
                    this.logRequestEnd( startTime, method, path, 403, requestId, 'Disallowed Host' );
                    this.activeRequests--;

                    const body = JSON.stringify({ success : false, error : 'Forbidden: Disallowed Host' });

                    return this.finalizeResponse(
                        tagDirectResponse( new Response( body, {
                            status  : 403,
                            headers : { 'Content-Type' : 'application/json' }
                        }), body ),
                        request,
                        requestId,
                        undefined,
                        securityConfig
                    );
                }

                const corsRes = corsConfig ? handleCors( request, corsConfig ) : null;

                if( corsRes instanceof Response ) 
                {
                    this.logRequestEnd( startTime, method, path, corsRes.status, requestId, 'CORS Preflight' );
                    this.activeRequests--;

                    return this.finalizeResponse( corsRes, request, requestId, undefined, securityConfig );
                }

                if( !finalMatch ) 
                {
                    this.logRequestEnd( startTime, method, path, 404, requestId, 'Not Found' );
                    this.activeRequests--;

                    return this.finalizeResponse(
                        tagDirectResponse( new Response( 'Not Found', { status : 404 }), 'Not Found' ),
                        request,
                        requestId,
                        undefined,
                        securityConfig
                    );
                }

                this.logRequestEnd( startTime, method, path, 204, requestId );
                this.activeRequests--;

                return this.finalizeResponse(
                    this.optionsResponse( path, this.resolveExternalAllowed( path, publicLookup )),
                    request,
                    requestId,
                    undefined,
                    securityConfig
                );
            }

            // Non-preflight OPTIONS falls through to an @Options / @All handler when one
            // matched; otherwise the framework answers with Allow.
            if( method === 'OPTIONS' && !match ) 
            {
                if( !finalMatch ) 
                {
                    this.logRequestEnd( startTime, method, path, 404, requestId, 'Not Found' );
                    this.activeRequests--;

                    return this.finalizeResponse(
                        tagDirectResponse( new Response( 'Not Found', { status : 404 }), 'Not Found' ),
                        request,
                        requestId,
                        undefined,
                        securityConfig
                    );
                }

                this.logRequestEnd( startTime, method, path, 204, requestId );
                this.activeRequests--;

                return this.finalizeResponse(
                    this.optionsResponse( path, this.resolveExternalAllowed( path, publicLookup )),
                    request,
                    requestId,
                    corsConfig,
                    securityConfig
                );
            }

            if( !finalMatch && seoMatches.length === 0 ) 
            {
                // The path exists under other verbs, so this is 405 + Allow, not 404. An
                // upgrade request is exempt: WS is a transport, not an advertised method.
                const externalAllowed = isUpgrade ? EMPTY_SEO_MATCHES as unknown as string[] : this.resolveExternalAllowed( path, publicLookup );
                const wrongMethod = !isUpgrade && externalAllowed.length > 0;
                const status = wrongMethod ? 405 : 404;
                const body = wrongMethod ? 'Method Not Allowed' : 'Not Found';

                this.logRequestEnd( startTime, method, path, status, requestId, body );
                this.activeRequests--;

                const res = tagDirectResponse( new Response( body, {
                    status,
                    headers : wrongMethod ? { Allow : externalAllowed.join( ', ' ) } : undefined
                }), body );

                return this.finalizeResponse( res, request, requestId, this.baseCorsConfig, this.baseSecurityConfig );
            }

            if( isUpgrade ) 
            {
                // WS only lives on the public router (SEO/Internal are HTTP resolvers).
                const wsMatch = publicLookup.match!;
                finalMatch = wsMatch;

                const wsSecurity = this.resolveEndpointSecurity( wsMatch.metadata );
                const wsCors = this.resolveEndpointCors( wsMatch.metadata );
                this.enforceSecurityGates( wsSecurity, request, sreq, 'WS', wsMatch.metadata.path );

                // Enforce Origin policy on WebSocket upgrades whenever @Cors / server cors is configured
                // and the client presents an Origin header (browsers always send Origin on WS handshakes;
                // browsers do NOT send CORS preflights for WebSocket, preventing CSWSH).
                const wsOrigin = request.headers.get( 'origin' );

                if( wsCors && wsOrigin !== null )
                {
                    const wsCorsHeaders = handleCors( request, wsCors );

                    if(
                        wsCorsHeaders instanceof Response
                        || !wsCorsHeaders
                        || !wsCorsHeaders['Access-Control-Allow-Origin']
                    )
                    {
                        this.logRequestEnd( startTime, method, path, 403, requestId, 'WS Origin Forbidden' );
                        this.activeRequests--;

                        return this.finalizeResponse(
                            tagDirectResponse( new Response( 'Forbidden: Origin not allowed', { status : 403 }), 'Forbidden: Origin not allowed' ),
                            request,
                            requestId,
                            wsCors,
                            wsSecurity
                        );
                    }
                }

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

                const wsOut = await Context.run( requestCtx, async () =>
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
                            const badBody = JSON.stringify({
                                success : false,
                                message : 'request validation failed',
                                errors  : ctx.errors
                            });

                            return this.finalizeResponse( tagDirectResponse( new Response( badBody, {
                                status  : 400,
                                headers : { 'Content-Type' : 'application/json' }
                            }), badBody ), request, requestId, wsCors, wsSecurity );
                        }

                        if( this.serverAdapter && typeof this.serverAdapter.upgrade === 'function' ) 
                        {
                            ( request as any ).__wsRequestContext = requestCtx;
                            ( request as any ).__wsMaskErrors = !this.options.exposeErrors;
                            const res = await this.serverAdapter.upgrade( request, finalMatch!.metadata, finalMatch!.params );

                            if( res.status < 400 && !requestCtx.wsCleanedUp )
                            {
                                handedOffToWs = true;
                            }
                            else
                            {
                                delete ( request as any ).__wsRequestContext;
                            }

                            return this.finalizeResponse( res, request, requestId, wsCors, wsSecurity );
                        }

                        return this.finalizeResponse(
                            tagDirectResponse( new Response( 'WebSockets not supported by adapter', { status : 501 }), 'WebSockets not supported by adapter' ),
                            request,
                            requestId,
                            wsCors,
                            wsSecurity
                        );
                    }
                    finally
                    {
                        if( !handedOffToWs && requestCtx.requestInstances?.size )
                        {
                            await RequestProcessor.cleanupRequestContext( requestCtx );
                        }
                    }
                });

                this.activeRequests--;

                return wsOut;
            }

            let response: Response | undefined;
            let activeSecurity = securityConfig;
            let activeCors = corsConfig;

            // Try SEO matches in specificity order; void → next; forward → internal hop.
            for( const seoMatch of seoMatches )
            {
                finalMatch = seoMatch;
                this.applyMatchBags( sreq, seoMatch );
                activeSecurity = this.resolveEndpointSecurity( seoMatch.metadata );
                activeCors = this.resolveEndpointCors( seoMatch.metadata );
                this.enforceSecurityGates( activeSecurity, request, sreq, method, seoMatch.metadata.path );

                try
                {
                    response = await this.runEndpoint( seoMatch.metadata, sreq, activeSecurity, request );
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
                    const body = wrongMethod ? 'Method Not Allowed' : 'Not Found';
                    const res = tagDirectResponse( new Response( body, {
                        status,
                        headers : wrongMethod ? { Allow : allowedAfterSeo.join( ', ' ) } : undefined
                    }), body );

                    this.logRequestEnd( startTime, method, path, status, requestId, body );
                    this.activeRequests--;

                    return this.finalizeResponse( res, request, requestId, this.baseCorsConfig, this.baseSecurityConfig );
                }

                finalMatch = pubMatch;
                this.applyMatchBags( sreq, pubMatch );
                activeSecurity = this.resolveEndpointSecurity( pubMatch.metadata );
                activeCors = this.resolveEndpointCors( pubMatch.metadata );
                this.enforceSecurityGates( activeSecurity, request, sreq, method, pubMatch.metadata.path );
                response = await this.runEndpoint( pubMatch.metadata, sreq, activeSecurity, request );
            }

            // RFC 9110: an OPTIONS response should advertise Allow.
            let allowHeader: string | undefined;

            if( method === 'OPTIONS' && !response.headers.has( 'Allow' )) 
            {
                const allowed = this.resolveExternalAllowed( path, publicLookup );

                if( allowed.length > 0 ) 
                {
                    allowHeader = allowed.join( ', ' );
                }
            }

            response = this.finalizeResponse( response, request, requestId, activeCors, activeSecurity, allowHeader );

            this.logRequestEnd( startTime, method, path, response.status, requestId );

            if( method === 'HEAD' ) 
            {
                cancelResponseBody( response );
                response = tagDirectResponse( new Response( null, {
                    status     : response.status,
                    statusText : response.statusText,
                    headers    : response.headers
                }), null );
            }

            this.activeRequests--;

            return response;
        }
        catch ( err: any ) 
        {
            return this.handleFetchError( err, request, sreq, method, path, startTime, requestId, finalMatch );
        }
    }
}
