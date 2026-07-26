import { EventEmitter } from 'node:events';
import { Router } from './core/router.js';
import { QueryParser } from './helpers/parsers.js';
import { ApplicationRegistry, getRegistry, runWithRegistry } from './core/registry.js';
import { bootstrapRegistry } from './core/bootstrap.js';
import { EndpointMetadata, AugmentedRequest, Logger, LogContext } from './core/types.js';
import { CorsOptions, SecurityOptions } from './decorators.js';
import { handleCors } from './helpers/cors.js';
import { mergeSecurityConfigs, generateSecurityHeaders } from './helpers/security.js';

// Decoupled architectural imports
import { RequestProcessor } from './core/request-processor.js';
import { RateLimiter } from './helpers/rate-limiter.js';
import { ServerAdapter, TlsOptions } from './adapters/adapter.js';
export { TlsOptions };
import { NodeAdapter } from './adapters/node-adapter.js';
import { BunAdapter } from './adapters/bun-adapter.js';
import { DenoAdapter } from './adapters/deno-adapter.js';
import { RequestReader, getContentType, requestLikelyHasBody } from './helpers/request-reader.js';
import { httpStatusFromError } from './errors.js';
import { resolveClientIp } from './helpers/client-ip.js';

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
    port             : number
    cors?            : CorsOptions
    security?        : SecurityOptions | boolean
    shutdownTimeout? : number
    controllers?     : any[]
    providers?       : any[]
    interceptors?    : any[]
    guards?          : any[]
    logs?            : boolean
    logger?          : Logger
    module?          : any | any[]
    responseMode?    : 'strict' | 'relaxed' | 'strip'
    tls?             : TlsOptions
    /**
     * When to trust X-Forwarded-For for @Ip and rate limiting.
     * - false / omit: never trust XFF (use TCP peer / 127.0.0.1)
     * - true: trust only loopback peers
     * - string[]: CIDR allowlist of immediate peers (e.g. `['10.0.0.0/8', '172.16.0.0/12']`)
     */
    trustProxy?      : boolean | string[]
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
    private router = new Router();
    private activeRequests = 0;
    private serverAdapter? : ServerAdapter;
    private _isShuttingDown = false;
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
            ? ( options.logger || new ConsoleLogger() )
            : new NoOpLogger();
        this.setupSignals();
    }

    /**
     * Lazy walk of module/controller Symbol meta + route wiring.
     * Safe to call multiple times; runs once per Server instance.
     */
    public ensureReady()
    {
        if( this.bootstrapped ){ return }

        runWithRegistry( this.registry, () =>
        {
            bootstrapRegistry( this.registry, {
                module       : this.options.module,
                controllers  : this.options.controllers,
                providers    : this.options.providers,
                guards       : this.options.guards,
                interceptors : this.options.interceptors,
                responseMode : this.options.responseMode
            });

            this.registry.resolveAll();

            for( const endpoint of this.registry.getEndpoints())
            {
                this.router.add( endpoint );

                if( this.options.logs )
                {
                    this.logger.info(
                        `Registered route: ${endpoint.httpMethod.padEnd( 6 )} ${endpoint.path} -> ${endpoint.controller}.${endpoint.methodName}`,
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
        });

        this.bootstrapped = true;
    }

    /** @deprecated Use ensureReady() — kept for tests that called init(). */
    private init()
    {
        this.ensureReady();
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

    public async shutdown( signal?: string ) 
    {
        if( this._isShuttingDown ) { return }
        this._isShuttingDown = true;

        this.internalEmit( 'beforeShutdown' );

        await runWithRegistry( this.registry, async () =>
        {
            await this.registry.invokeHook( 'onModuleDestroy' );
            await this.registry.invokeHook( 'beforeApplicationShutdown', signal );
        });

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
        await runWithRegistry( this.registry, async () =>
        {
            await this.registry.invokeHook( 'onApplicationShutdown', signal );
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
        this.ensureReady();

        await runWithRegistry( this.registry, async () =>
        {
            await this.registry.invokeHook( 'onModuleInit' );
        });

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
            await this.serverAdapter!.listen( port, this.fetch, this.options.tls );
        });

        const protocol = this.options.tls ? 'https' : 'http';

        if( this.options.logs ) 
        {
            this.logger.info( `${runtime} server running at ${protocol}://localhost:${port}`, {
                type : 'server_start',
                runtime,
                port
            });
        }

        await runWithRegistry( this.registry, async () =>
        {
            await this.registry.invokeHook( 'onApplicationBootstrap' );
        });
        this.internalEmit( 'start', port );
    }

    public fetch = async ( request: Request ): Promise<Response> => 
    {
        this.ensureReady();

        return runWithRegistry( this.registry, () => this.handleFetch( request ));
    };

    private handleFetch = async ( request: Request ): Promise<Response> => 
    {
        this.internalEmit( 'request', request );
    
        const applyCors = ( res: Response, config: any ): Response => 
        {
            if( !config ) { return res }
            const corsHeaders = handleCors( request, config );

            if( corsHeaders && !( corsHeaders instanceof Response )) 
            {
                try 
                {
                    for( const [key, value] of Object.entries( corsHeaders )) 
                    {
                        res.headers.set( key, value );
                    }

                    return res;
                }
                catch ( e ) 
                {
                    const newHeaders = new Headers( res.headers );

                    for( const [key, value] of Object.entries( corsHeaders )) 
                    {
                        newHeaders.set( key, value );
                    }

                    return new Response( res.body, {
                        status     : res.status,
                        statusText : res.statusText,
                        headers    : newHeaders
                    });
                }
            }

            return res;
        };

        const applySecurityHeaders = ( res: Response, config: any ): Response => 
        {
            if( config === undefined ) { return res }
            const headers = generateSecurityHeaders( config );
            try 
            {
                for( const [key, value] of Object.entries( headers )) 
                {
                    res.headers.set( key, value );
                }

                return res;
            }
            catch ( e ) 
            {
                const newHeaders = new Headers( res.headers );

                for( const [key, value] of Object.entries( headers )) 
                {
                    newHeaders.set( key, value );
                }

                return new Response( res.body, {
                    status     : res.status,
                    statusText : res.statusText,
                    headers    : newHeaders
                });
            }
        };

        if( this.isShuttingDown ) 
        {
            let res = new Response( 'Service Unavailable (Shutting Down)', { status : 503 });
            res = applyCors( res, this.options.cors );
            res = applySecurityHeaders( res, mergeSecurityConfigs([this.options.security]));

            return res;
        }

        this.activeRequests++;
        const startTime = Date.now();
        const url = new URL( request.url );
        const path = url.pathname;
        const isUpgrade = request.headers.get( 'upgrade' )?.toLowerCase() === 'websocket';
        const method = isUpgrade ? 'WS' : request.method;
        const augmented = request as AugmentedRequest;
        augmented.trustProxy = this.options.trustProxy;
        if( ( request as any ).remoteAddress !== undefined )
        {
            augmented.remoteAddress = ( request as any ).remoteAddress;
        }
    
        if( this.options.logs ) 
        {
            this.logger.info( `--> ${method} ${path}${url.search ? url.search : ''}`, {
                type : 'request_start',
                method,
                path,
                url  : request.url
            });
        }

        let finalMatch: any = null;
        try 
        {
            let match = this.router.find( method, path );

            if( !match && method === 'HEAD' ) 
            {
                match = this.router.find( 'GET', path );
            }
      
            finalMatch = match;

            if( !match && method === 'OPTIONS' ) 
            {
                finalMatch = this.router.find( 'GET', path ) || 
                     this.router.find( 'POST', path ) || 
                     this.router.find( 'PUT', path ) || 
                     this.router.find( 'DELETE', path );
            }

            const corsConfig = finalMatch ? ( finalMatch.metadata.cors !== undefined ? finalMatch.metadata.cors : this.options.cors ) : this.options.cors;
            const routeSecurity = finalMatch ? finalMatch.metadata.security : undefined;
            const securityConfig = mergeSecurityConfigs([this.options.security, routeSecurity]);

            if( method === 'OPTIONS' && corsConfig ) 
            {
                const corsRes = handleCors( request, corsConfig );

                if( corsRes instanceof Response ) 
                {
                    if( this.options.logs ) 
                    {
                        const duration = Date.now() - startTime;
                        this.logger.info( `<-- ${method} ${path} - 204 CORS Preflight (${duration}ms)`, {
                            type   : 'request_end',
                            method,
                            path,
                            status : 204,
                            duration
                        });
                    }

                    return applySecurityHeaders( corsRes, securityConfig );
                }
            }

            if( !finalMatch ) 
            {
                if( this.options.logs ) 
                {
                    const duration = Date.now() - startTime;
                    this.logger.info( `<-- ${method} ${path} - 404 Not Found (${duration}ms)`, {
                        type   : 'request_end',
                        method,
                        path,
                        status : 404,
                        duration
                    });
                }
                let res = new Response( 'Not Found', { status : 404 });
                res = applyCors( res, this.options.cors );
                res = applySecurityHeaders( res, mergeSecurityConfigs([this.options.security]));

                return res;
            }

            if( isUpgrade ) 
            {
                // Enforce guards before upgrading
                const registry = getRegistry();
                const controllerModule = registry.getTokenModule( finalMatch.metadata.controller );
                const controller = registry.getController( finalMatch.metadata.controller, controllerModule );

                if( !controller ) { throw new Error( `Controller ${finalMatch.metadata.controller} not registered` ) }

                // Run Guards
                const req = request as AugmentedRequest;
                req.params = finalMatch.params;
                req.query = QueryParser.parse( url.search.startsWith( '?' ) ? url.search.slice( 1 ) : url.search );
                const ctx = { success : true, errors : [], mode : 'strict' };

                for( const g of finalMatch.metadata.guards ) 
                {
                    const guardModule = g.type === 'class' ? registry.getTokenModule( g.name ) : controllerModule;
                    const guardInstance = g.type === 'class' ? registry.getGuard( g.name, guardModule ) : controller;
                    const guardMethod = g.type === 'class' ? guardInstance.use : guardInstance[g.name];
          
                    const guardArgs: any[] = [];
                    let resolverIdx = 0;

                    for( const p of g.params ) 
                    {
                        if( p.source === 'WebSocket' ) 
                        {
                            guardArgs.push( null );
                        }
                        else if( p.source === 'Request' && !p.name && !p.validator ) 
                        {
                            const { RequestProcessor } = await import( './core/request-processor.js' );
                            guardArgs.push( await RequestProcessor.resolveParam( p, req, ctx, undefined, guardModule ));
                        }
                        else if([
                            'Param', 'Body', 'RawBody', 'Header', 'Headers', 'Cookies', 'Cookie',
                            'Query', 'Context', 'Inject', 'Ip', 'Url', 'Hostname', 'Path', 'Peer'
                        ].includes( p.source )) 
                        {
                            const { RequestProcessor } = await import( './core/request-processor.js' );
                            guardArgs.push( await RequestProcessor.resolveParam( p, req, ctx, undefined, guardModule ));
                        }
                        else 
                        {
                            guardArgs.push( g.resolvers[resolverIdx++]);
                        }
                    }
                    const finalArgs = guardArgs.length > 0 ? guardArgs : g.resolvers;
                    await guardMethod.apply( guardInstance, finalArgs );
                }

                if( this.serverAdapter && typeof this.serverAdapter.upgrade === 'function' ) 
                {
                    const res = await this.serverAdapter.upgrade( request, finalMatch.metadata, finalMatch.params );

                    return res;
                }

                return new Response( 'WebSockets not supported by adapter', { status : 501 });
            }

            const req = request as AugmentedRequest;
            req.params = finalMatch.params;
            req.query = QueryParser.parse( url.search.startsWith( '?' ) ? url.search.slice( 1 ) : url.search );
            req.globalCors = this.options.cors;
            req.cors = finalMatch.metadata.cors;
            req.globalSecurity = this.options.security;
            req.security = finalMatch.metadata.security;
            req.meta = finalMatch.metadata.meta;

            // Enforce allowedContentTypes (require a matching CT when a body is indicated)
            if( securityConfig?.allowedContentTypes && method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS' ) 
            {
                const contentType = getContentType( req );
                const allowed = securityConfig.allowedContentTypes.map( t => t.toLowerCase());

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
            if( securityConfig?.rateLimit ) 
            {
                const ip = resolveClientIp( req, this.options.trustProxy );
                const allowed = this.rateLimiter.checkLimit( ip, path, securityConfig.rateLimit );

                if( !allowed ) 
                {
                    throw Object.assign( new Error( 'Too Many Requests' ), { status : 429 });
                }
            }

            // Enforce timeout
            let response: Response;

            if( securityConfig?.timeout ) 
            {
                const timeoutMs = securityConfig.timeout;
                const controller = new AbortController();
                req.abortSignal = controller.signal;
                const timer = setTimeout(() => controller.abort(), timeoutMs );
                const work = RequestProcessor.execute( finalMatch.metadata, req, securityConfig );

                try 
                {
                    response = await Promise.race([
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
                    // Timed-out work may still settle later; swallow to avoid unhandled rejection.
                    void work.catch(() => undefined );
                }
            }
            else 
            {
                response = await RequestProcessor.execute( finalMatch.metadata, req, securityConfig );
            }

            response = applyCors( response, corsConfig );
            response = applySecurityHeaders( response, securityConfig );
      
            if( this.options.logs ) 
            {
                const duration = Date.now() - startTime;
                this.logger.info( `<-- ${method} ${path} - ${response.status} (${duration}ms)`, {
                    type   : 'request_end',
                    method,
                    path,
                    status : response.status,
                    duration
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

            return response;
        }
        catch ( err: any ) 
        {
            this.internalEmit( 'error', err );
            const statusCode = httpStatusFromError( err );

            if( this.options.logs ) 
            {
                this.logger.error( `Server Error: ${err.message}`, {
                    type  : 'error',
                    error : err
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
                    duration
                });
            }
      
            const corsConfig = finalMatch ? ( finalMatch.metadata.cors !== undefined ? finalMatch.metadata.cors : this.options.cors ) : this.options.cors;
            const routeSecurity = finalMatch ? finalMatch.metadata.security : undefined;
            const errSecurityConfig = mergeSecurityConfigs([this.options.security, routeSecurity]);
      
            let res = new Response( JSON.stringify( err.data || { success : false, error : err.message }), {
                status  : statusCode,
                headers : { 'Content-Type' : 'application/json' }
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

            return res;
        }
        finally 
        {
            this.activeRequests--;
        }
    };
}
