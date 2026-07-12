import { EventEmitter } from 'node:events';
import { Router } from './core/router.js';
import { QueryParser } from './helpers/parsers.js';
import { MetadataStore } from './core/metadata.js';
import { EndpointMetadata, AugmentedRequest, Logger, LogContext } from './core/types.js';
import { CorsOptions, SecurityOptions } from './decorators.js';
import { loadAutoMetadata } from './config.js';
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
import { RequestReader } from './helpers/request-reader.js';

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
    interceptors?    : any[]
    guards?          : any[]
    logs?            : boolean
    logger?          : Logger
    module?          : any | any[]
    responseMode?    : 'strict' | 'relaxed' | 'strip'
    tls?             : TlsOptions
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

        if( options.responseMode ) 
        {
            MetadataStore.setDefaultResponseMode( options.responseMode );
        }
    }

    private collectModuleElements( moduleClass: any, activeControllers: Set<string>, visitedModules = new Set<any>()): any 
    {
        if( !moduleClass ) { return null }

        let actualModuleClass = moduleClass;
        let metadata: any = {};

        if( moduleClass && typeof moduleClass === 'object' && 'module' in moduleClass ) 
        {
            actualModuleClass = moduleClass.module;
            metadata = moduleClass;
        }
        else if( moduleClass && typeof moduleClass === 'object' && '__moduleMetadata__' in moduleClass ) 
        {
            metadata = moduleClass.__moduleMetadata__;
        }
        else if( moduleClass && typeof moduleClass === 'function' ) 
        {
            metadata = moduleClass.__moduleMetadata__ || moduleClass.prototype?.__moduleMetadata__ || {};
        }

        const moduleName = ( actualModuleClass.name && actualModuleClass.name !== 'Object' ) 
            ? actualModuleClass.name 
            : ( actualModuleClass.constructor?.name && actualModuleClass.constructor.name !== 'Object' 
                ? actualModuleClass.constructor.name 
                : 'DynamicModule' );

        let moduleInstance = MetadataStore.getModuleInstance( actualModuleClass );

        if( !moduleInstance ) 
        {
            moduleInstance = MetadataStore.createModuleInstance( moduleName, actualModuleClass );
        }

        if( actualModuleClass && ( actualModuleClass.__isGlobal__ || moduleClass.__isGlobal__ )) 
        {
            MetadataStore.registerGlobalModule( moduleInstance );
        }

        if( visitedModules.has( actualModuleClass )) 
        {
            return moduleInstance;
        }
        visitedModules.add( actualModuleClass );

        if( actualModuleClass && actualModuleClass.name ) 
        {
            MetadataStore.registerModule( actualModuleClass.name, actualModuleClass );
            MetadataStore.registerProvider( actualModuleClass.name, actualModuleClass );
            moduleInstance.providers.set( actualModuleClass.name, actualModuleClass );
            MetadataStore.mapClassToModule( actualModuleClass, moduleInstance );
            MetadataStore.mapTokenToModule( actualModuleClass.name, moduleInstance );
        }

        // 1. Process providers
        if( metadata.providers ) 
        {
            for( const provider of metadata.providers ) 
            {
                let token: string;
                let providerClass: any;

                if( typeof provider === 'function' ) 
                {
                    token = provider.name;
                    providerClass = provider;
                }
                else if( provider && typeof provider === 'object' ) 
                {
                    if( 'provide' in provider ) 
                    {
                        token = typeof provider.provide === 'function' ? provider.provide.name : provider.provide;
                        providerClass = provider;
                    }
                    else 
                    {
                        token = provider.constructor?.name || 'UnknownProvider';
                        providerClass = provider;
                    }
                }
                else 
                {
                    continue;
                }

                moduleInstance.providers.set( token, providerClass );
                const actualClass = typeof provider === 'function' ? provider : ( provider && typeof provider === 'object' && 'useClass' in provider ? provider.useClass : null );

                if( actualClass ) 
                {
                    MetadataStore.mapClassToModule( actualClass, moduleInstance );
                }
                MetadataStore.mapTokenToModule( token, moduleInstance );
                MetadataStore.registerProvider( token, provider );
            }
        }

        // 2. Process controllers
        if( metadata.controllers ) 
        {
            for( const ctrl of metadata.controllers ) 
            {
                const ctrlName = ctrl.name || ctrl;
                activeControllers.add( ctrlName );
        
                moduleInstance.controllers.set( ctrlName, ctrl );
                MetadataStore.mapClassToModule( ctrl, moduleInstance );
                MetadataStore.mapTokenToModule( ctrlName, moduleInstance );
                MetadataStore.registerController( ctrlName, ctrl );
            }
        }

        // 3. Process exports
        if( metadata.exports ) 
        {
            for( const exp of metadata.exports ) 
            {
                const expName = exp.name || exp;
                moduleInstance.exports.add( expName );
            }
        }

        // 4. Process imports
        if( metadata.imports ) 
        {
            for( const imp of metadata.imports ) 
            {
                const impInstance = this.collectModuleElements( imp, activeControllers, visitedModules );

                if( impInstance ) 
                {
                    moduleInstance.imports.add( impInstance );
                }
            }
        }

        return moduleInstance;
    }

    private init() 
    {
        const activeControllers = new Set<string>();

        if( this.options.module ) 
        {
            const modules = Array.isArray( this.options.module ) ? this.options.module : [this.options.module];

            for( const mod of modules ) 
            {
                this.collectModuleElements( mod, activeControllers );
            }
        }
        else if( this.options.controllers ) 
        {
            for( const ctrl of this.options.controllers ) 
            {
                activeControllers.add( ctrl.name || ctrl );
            }
        }

        MetadataStore.resolveAll();

        for( const endpoint of MetadataStore.getEndpoints()) 
        {
            if( activeControllers.size > 0 && !activeControllers.has( endpoint.controller )) 
            {
                continue;
            }
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

        await MetadataStore.invokeHook( 'onModuleDestroy' );
        await MetadataStore.invokeHook( 'beforeApplicationShutdown', signal );

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
        await MetadataStore.invokeHook( 'onApplicationShutdown', signal );

        if( this.options.logs ) 
        {
            this.logger.info( 'Shutdown complete. Goodbye!', {
                type   : 'server_shutdown',
                reason : 'complete'
            });
        }

        this.internalEmit( 'shutdown' );
    
        if( typeof process !== 'undefined' ) { process.exit( 0 ) }
        else if(( globalThis as any ).Deno ) { ( globalThis as any ).Deno.exit( 0 ) }
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
        if( MetadataStore.getEndpoints().length === 0 ) 
        {
            await loadAutoMetadata( !!this.options.logs );
        }
        this.init();
        await MetadataStore.invokeHook( 'onModuleInit' );

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
        await this.serverAdapter.listen( port, this.fetch, this.options.tls );

        const protocol = this.options.tls ? 'https' : 'http';
        if( this.options.logs ) 
        {
            this.logger.info( `${runtime} server running at ${protocol}://localhost:${port}`, {
                type : 'server_start',
                runtime,
                port
            });
        }

        await MetadataStore.invokeHook( 'onApplicationBootstrap' );
        this.internalEmit( 'start', port );
    }

    public fetch = async ( request: Request ): Promise<Response> => 
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
                const controllerModule = MetadataStore.getTokenModule( finalMatch.metadata.controller );
                const controller = MetadataStore.getController( finalMatch.metadata.controller, controllerModule );

                if( !controller ) { throw new Error( `Controller ${finalMatch.metadata.controller} not registered` ) }

                // Run Guards
                const req = request as AugmentedRequest;
                req.params = finalMatch.params;
                req.query = QueryParser.parse( url.search.startsWith( '?' ) ? url.search.slice( 1 ) : url.search );
                const ctx = { success : true, errors : [], mode : 'strict' };

                for( const g of finalMatch.metadata.guards ) 
                {
                    const guardModule = g.type === 'class' ? MetadataStore.getTokenModule( g.name ) : controllerModule;
                    const guardInstance = g.type === 'class' ? MetadataStore.getGuard( g.name, guardModule ) : controller;
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
                        else if( p.source === 'Param' || p.source === 'Body' || p.source === 'Header' || p.source === 'Query' || p.source === 'Context' || p.source === 'Inject' ) 
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

            // Enforce allowedContentTypes
            if( securityConfig?.allowedContentTypes && method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS' ) 
            {
                const contentType = request.headers.get( 'content-type' )?.split( ';' )[0]?.trim()?.toLowerCase();

                if( contentType && !securityConfig.allowedContentTypes.some( t => t.toLowerCase() === contentType )) 
                {
                    throw Object.assign( new Error( `Unsupported Media Type: ${contentType}` ), { status : 415 });
                }
            }

            // Enforce rateLimit
            if( securityConfig?.rateLimit ) 
            {
                const ip = request.headers.get( 'x-forwarded-for' )?.split( ',' )[0] || '127.0.0.1';
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
                const timer = setTimeout(() => controller.abort(), timeoutMs );
                try 
                {
                    response = await Promise.race([
                        RequestProcessor.execute( finalMatch.metadata, req, securityConfig ),
                        new Promise<never>(( _, reject ) => 
                        {
                            controller.signal.addEventListener( 'abort', () => 
                            {
                                reject( Object.assign( new Error( `Request Timeout (${timeoutMs}ms)` ), { status : 408 }));
                            });
                        })
                    ]);
                }
                finally 
                {
                    clearTimeout( timer );
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
                this.logger.info( `<-- ${method} ${path} - 500 Internal Server Error (${duration}ms)`, {
                    type   : 'request_end',
                    method,
                    path,
                    status : 500,
                    duration
                });
            }
      
            const corsConfig = finalMatch ? ( finalMatch.metadata.cors !== undefined ? finalMatch.metadata.cors : this.options.cors ) : this.options.cors;
            const routeSecurity = finalMatch ? finalMatch.metadata.security : undefined;
            const errSecurityConfig = mergeSecurityConfigs([this.options.security, routeSecurity]);
            const statusCode = err.status || 500;
      
            let res = new Response( JSON.stringify({ success : false, error : err.message }), {
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
