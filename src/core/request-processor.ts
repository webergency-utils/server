import { Context } from './context.js';
import { MetadataStore } from './metadata.js';
import { RequestReader, getEffectiveBodyContentType } from '../helpers/request-reader.js';
import { EndpointMetadata, ParamMetadata, AugmentedRequest, ResponseBag } from './types.js';
import { SecurityOptions } from '../decorators.js';
import { httpStatusFromError } from '../errors.js';
import { resolveClientIp } from '../helpers/client-ip.js';

function parseCookies( cookieHeader: string | null ): Record<string, string> 
{
    const cookies: Record<string, string> = {};

    if( !cookieHeader ) { return cookies }

    const pairs = cookieHeader.split( ';' );

    for( const pair of pairs ) 
    {
        const idx = pair.indexOf( '=' );

        if( idx === -1 ) { continue }
        const key = pair.substring( 0, idx ).trim();
        const val = pair.substring( idx + 1 ).trim();

        if( cookies[key] === undefined ) 
        {
            cookies[key] = val;
        }
    }

    return cookies;
}

export class RequestProcessor 
{
    private static throwIfAborted( req: AugmentedRequest )
    {
        if( req.abortSignal?.aborted )
        {
            throw Object.assign( new Error( 'Request Timeout' ), { status : 408 });
        }
    }

    /** Validate one SSE yield: prefer `chunk.data` when present, else the whole chunk. */
    private static validateSseChunk( chunk: any, validator: (( v: any, path: string, ctx: any ) => any) | undefined, mode: string ): any
    {
        if( !validator ){ return chunk }

        const responseCtx = { success : true, errors : [] as any[], mode };

        if( typeof chunk === 'object' && chunk !== null && 'data' in chunk )
        {
            const data = validator( chunk.data, 'response', responseCtx );

            if( !responseCtx.success )
            {
                throw new Error( `Response validation failed: ${JSON.stringify( responseCtx.errors )}` );
            }

            return { ...chunk, data };
        }

        const validated = validator( chunk, 'response', responseCtx );

        if( !responseCtx.success )
        {
            throw new Error( `Response validation failed: ${JSON.stringify( responseCtx.errors )}` );
        }

        return validated;
    }

    private static formatSseChunk( chunk: any ): string
    {
        if( typeof chunk === 'object' && chunk !== null )
        {
            let sseString = '';

            if( 'event' in chunk ){ sseString += `event: ${chunk.event}\n` }

            if( 'id' in chunk ){ sseString += `id: ${chunk.id}\n` }

            if( 'retry' in chunk ){ sseString += `retry: ${chunk.retry}\n` }
            const dataVal = 'data' in chunk ? chunk.data : chunk;
            const dataStr = typeof dataVal === 'object' ? JSON.stringify( dataVal ) : String( dataVal );
            sseString += `data: ${dataStr}\n\n`;

            return sseString;
        }

        return `data: ${String( chunk )}\n\n`;
    }

    public static async resolveParam(
        p: ParamMetadata,
        req: AugmentedRequest,
        ctx: any,
        securityConfig?: SecurityOptions,
        contextModule?: any,
        ws?: any,
        responseBag?: ResponseBag
    ): Promise<any> 
    {
        this.throwIfAborted( req );

        let val: any;
        switch ( p.source ) 
        {
            case 'Param': val = req.params[p.name!]; break;
            case 'Body': val = await RequestReader.getBody( req, securityConfig ); break;
            case 'RawBody': val = await RequestReader.getRawBody( req, securityConfig ); break;
            case 'Query': val = p.name ? req.query[p.name] : req.query; break;
            case 'Header': val = req.headers.get( p.name! ); break;
            case 'Headers': val = Object.fromEntries( req.headers.entries()); break;
            case 'Request': val = req; break;
            case 'Response': val = responseBag; break;
            case 'Ip': val = resolveClientIp( req ); break;
            case 'Url': val = req.url; break;
            case 'Hostname': val = new URL( req.url ).hostname; break;
            case 'Path': val = new URL( req.url ).pathname; break;
            case 'Context': val = Context.get(); break;
            case 'Inject': val = MetadataStore.getInjectable( p.name!, contextModule ); break;
            case 'WebSocket': val = ws; break;
            case 'Peer': {
                val = ( req as any ).clientCert;
                break;
            }
            case 'Cookies': {
                const cookieHeader = req.headers.get( 'cookie' );
                val = parseCookies( cookieHeader );
                break;
            }
            case 'Cookie': {
                const cookieHeader = req.headers.get( 'cookie' );
                const cookies = parseCookies( cookieHeader );
                val = p.name ? cookies[p.name] : cookies;
                break;
            }
        }

        if( p.validator && typeof p.validator === 'function' ) 
        {
            const oldMode = ctx.mode;
            const oldFrom = ctx.from;

            if( p.mode ) { ctx.mode = p.mode }

            if( p.source === 'Query' || p.source === 'Param' || p.source === 'Cookie' ) 
            {
                ctx.from = 'query';
            }
            else if( p.source === 'Body' ) 
            {
                ctx.from = getEffectiveBodyContentType( req ) === 'application/x-www-form-urlencoded' ? 'query' : 'json';
            }

            val = p.validator( val, p.name || p.source.toLowerCase(), ctx );

            ctx.mode = oldMode;
            ctx.from = oldFrom;
        }

        return val;
    }

    public static async execute(
        metadata: EndpointMetadata,
        req: AugmentedRequest,
        securityConfig?: SecurityOptions
    ): Promise<Response> 
    {
        return Context.run({ request : req, metadata, requestInstances : new Map<string, any>() }, async () => 
        {
            const controllerModule = MetadataStore.getTokenModule( metadata.controller );
            const controller = MetadataStore.getController( metadata.controller, controllerModule );

            if( !controller ) { throw new Error( `Controller ${metadata.controller} not registered` ) }

            const ctx = { success : true, errors : [], mode : 'strict' };
            const middlewareResponse = new ResponseBag();

            const finalHandler = async () => 
            {
                this.throwIfAborted( req );

                // 2. Resolve parameters (Parsing & Validation)
                const args: any[] = [];

                for( const p of metadata.params ) 
                {
                    args.push( await this.resolveParam( p, req, ctx, securityConfig, controllerModule, undefined, middlewareResponse ));
                }

                this.throwIfAborted( req );

                if( !ctx.success ) 
                {
                    return new Response( JSON.stringify({ success : false, message : 'request validation failed', errors : ctx.errors }), { 
                        status  : 400,
                        headers : { 'Content-Type' : 'application/json' }
                    });
                }

                // 3. Execute Method
                const result = await controller[metadata.methodName]( ...args );

                this.throwIfAborted( req );

                if( result instanceof Response ) { return result }

                if( metadata.meta?.sse ) 
                {
                    const headers = new Headers({
                        'Content-Type'  : 'text/event-stream',
                        'Cache-Control' : 'no-cache',
                        'Connection'    : 'keep-alive'
                    });

                    const validator = typeof metadata.returnTypeValidator === 'function'
                        ? metadata.returnTypeValidator
                        : undefined;
                    const mode = metadata.returnTypeMode || MetadataStore.getDefaultResponseMode();

                    let bodyStream: any;

                    if( result && typeof result[Symbol.asyncIterator] === 'function' ) 
                    {
                        const encoder = new TextEncoder();
                        bodyStream = new ReadableStream({
                            async start( controller ) 
                            {
                                try 
                                {
                                    for await ( const chunk of result ) 
                                    {
                                        const validated = RequestProcessor.validateSseChunk( chunk, validator, mode );
                                        controller.enqueue( encoder.encode( RequestProcessor.formatSseChunk( validated )));
                                    }
                                    controller.close();
                                }
                                catch ( err ) 
                                {
                                    controller.error( err );
                                }
                            }
                        });
                    }
                    else if( result instanceof ReadableStream ) 
                    {
                        bodyStream = result;
                    }
                    else 
                    {
                        bodyStream = result;
                    }
          
                    return new Response( bodyStream, { headers });
                }

                let validatedResult = result;

                if( metadata.returnTypeValidator && typeof metadata.returnTypeValidator === 'function' ) 
                {
                    const mode = metadata.returnTypeMode || MetadataStore.getDefaultResponseMode();
                    const responseCtx = { success : true, errors : [], mode };
                    validatedResult = metadata.returnTypeValidator( result, 'response', responseCtx );

                    if( !responseCtx.success ) 
                    {
                        throw new Error( `Response validation failed: ${JSON.stringify( responseCtx.errors )}` );
                    }
                }

                return ( typeof validatedResult === 'object' ? new Response( JSON.stringify( validatedResult ), { headers : { 'Content-Type' : 'application/json' } }) : new Response( String( validatedResult || '' )));
            };

            // 4. Wrap in Interceptor Chain
            let chain = finalHandler;

            for( const iName of [...metadata.interceptors].reverse()) 
            {
                const interceptor = MetadataStore.getInterceptor( iName );
                const next = chain;
                chain = () => interceptor.intercept( req, next );
            }

            try 
            {
                this.throwIfAborted( req );

                // Run Middlewares before guards
                if( metadata.middlewares && metadata.middlewares.length > 0 ) 
                {
                    for( const mName of metadata.middlewares ) 
                    {
                        this.throwIfAborted( req );

                        const middlewareInstance = MetadataStore.getInjectable( mName, controllerModule );
                        if( !middlewareInstance ) 
                        {
                            throw new Error( `Middleware ${mName} not registered` );
                        }

                        if( typeof middlewareInstance.use === 'function' ) 
                        {
                            await middlewareInstance.use( req, middlewareResponse );
                        }
                        else if( typeof middlewareInstance.useCallback === 'function' ) 
                        {
                            await new Promise<void>(( resolve, reject ) => 
                            {
                                try 
                                {
                                    const next = ( error?: any ) => 
                                    {
                                        if( error ) 
                                        {
                                            reject( error );
                                        }
                                        else 
                                        {
                                            resolve();
                                        }
                                    };
                                    const res = middlewareInstance.useCallback( req, middlewareResponse, next );
                                    if( res instanceof Promise ) 
                                    {
                                        res.catch( reject );
                                    }
                                }
                                catch ( err ) 
                                {
                                    reject( err );
                                }
                            });
                        }
                    }
                }

                // 1. Run Guards FIRST (Security gate)
                for( const g of metadata.guards ) 
                {
                    this.throwIfAborted( req );

                    const guardModule = g.type === 'class' ? MetadataStore.getTokenModule( g.name ) : controllerModule;
                    const guardInstance = g.type === 'class' ? MetadataStore.getGuard( g.name, guardModule ) : controller;
                    const guardMethod = g.type === 'class' ? guardInstance.use : guardInstance[g.name];
          
                    // Resolve Guard Parameters
                    const guardArgs: any[] = [];
                    let resolverIdx = 0;

                    for( const p of g.params ) 
                    {
                        if( p.source === 'Request' && !p.name && !p.validator ) 
                        {
                            guardArgs.push( await this.resolveParam( p, req, ctx, securityConfig, guardModule ));
                        }
                        else if([
                            'Param', 'Body', 'RawBody', 'Header', 'Headers', 'Cookies', 'Cookie',
                            'Query', 'Context', 'Inject', 'Ip', 'Url', 'Hostname', 'Path', 'Peer', 'Response'
                        ].includes( p.source )) 
                        {
                            guardArgs.push( await this.resolveParam( p, req, ctx, securityConfig, guardModule, undefined, middlewareResponse ));
                        }
                        else 
                        {
                            guardArgs.push( g.resolvers[resolverIdx++]);
                        }
                    }

                    const finalArgs = guardArgs.length > 0 ? guardArgs : g.resolvers;
          
                    await guardMethod.apply( guardInstance, finalArgs );
                }

                this.throwIfAborted( req );

                return middlewareResponse.applyTo( await chain());
            }
            catch ( err: any ) 
            {
                if( err instanceof Response ) 
                {
                    return middlewareResponse.applyTo( err );
                }
                const status = httpStatusFromError( err );

                const response = new Response( JSON.stringify( err.data || { success : false, error : err.message }), { 
                    status, 
                    headers : { 'Content-Type' : 'application/json' } 
                });

                return middlewareResponse.applyTo( response );
            }
        });
    }

    /** Start a WS handler without blocking the upgrade response; never leave an unhandled rejection. */
    public static runWs(
        metadata: EndpointMetadata,
        ws: any,
        req: AugmentedRequest
    ): void
    {
        void this.executeWs( metadata, ws, req ).catch(( err: any ) =>
        {
            try
            {
                ws.close( 1011, err?.message || 'Internal WS Handler Error' );
            }
            catch
            {
                // ignore secondary close failures
            }
        });
    }

    public static async executeWs(
        metadata: EndpointMetadata,
        ws: any,
        req: AugmentedRequest
    ): Promise<void> 
    {
        return Context.run({ request : req, metadata, requestInstances : new Map<string, any>() }, async () => 
        {
            const controllerModule = MetadataStore.getTokenModule( metadata.controller );
            const controller = MetadataStore.getController( metadata.controller, controllerModule );

            if( !controller ) { throw new Error( `Controller ${metadata.controller} not registered` ) }

            const ctx = { success : true, errors : [], mode : 'strict' };

            try 
            {
                // Resolve parameters (Parsing & Validation)
                const args: any[] = [];

                for( const p of metadata.params ) 
                {
                    args.push( await this.resolveParam( p, req, ctx, undefined, controllerModule, ws ));
                }

                if( !ctx.success ) 
                {
                    ws.close( 4000, JSON.stringify({ success : false, message : 'request validation failed', errors : ctx.errors }));

                    return;
                }

                // Execute Method
                await controller[metadata.methodName]( ...args );
            }
            catch ( err: any ) 
            {
                try
                {
                    ws.close( 4001, err.message || 'Internal WS Handler Error' );
                }
                catch
                {
                    // ignore secondary close failures
                }
            }
        });
    }

    public static async executeRpc(
        metadata: EndpointMetadata,
        payload: any
    ): Promise<any> 
    {
        const req: any = {
      _json   : payload,
      headers : new Headers(),
      url     : 'rpc://localhost/' + metadata.path,
      params  : {},
      query   : {},
      meta    : {}
    };

        return Context.run({ request : req, metadata, requestInstances : new Map<string, any>() }, async () => 
        {
            const controllerModule = MetadataStore.getTokenModule( metadata.controller );
            const controller = MetadataStore.getController( metadata.controller, controllerModule );

            if( !controller ) { throw new Error( `Controller ${metadata.controller} not registered` ) }

            const ctx = { success : true, errors : [], mode : 'strict' };

            // 1. Run Guards
            for( const g of metadata.guards ) 
            {
                const guardModule = g.type === 'class' ? MetadataStore.getTokenModule( g.name ) : controllerModule;
                const guardInstance = g.type === 'class' ? MetadataStore.getGuard( g.name, guardModule ) : controller;
                const guardMethod = g.type === 'class' ? guardInstance.use : guardInstance[g.name];
        
                const guardArgs: any[] = [];
                let resolverIdx = 0;

                for( const p of g.params ) 
                {
                    if( p.source === 'Request' && !p.name && !p.validator ) 
                    {
                        guardArgs.push( await this.resolveParam( p, req, ctx, undefined, guardModule ));
                    }
                    else if([
                        'Param', 'Body', 'RawBody', 'Header', 'Headers', 'Cookies', 'Cookie',
                        'Query', 'Context', 'Inject', 'Ip', 'Url', 'Hostname', 'Path', 'Peer'
                    ].includes( p.source )) 
                    {
                        guardArgs.push( await this.resolveParam( p, req, ctx, undefined, guardModule ));
                    }
                    else 
                    {
                        guardArgs.push( g.resolvers[resolverIdx++]);
                    }
                }

                const finalArgs = guardArgs.length > 0 ? guardArgs : g.resolvers;
                await guardMethod.apply( guardInstance, finalArgs );
            }

            // 2. Resolve parameters (Validation)
            const args: any[] = [];

            for( const p of metadata.params ) 
            {
                args.push( await this.resolveParam( p, req, ctx, undefined, controllerModule ));
            }

            if( !ctx.success ) 
            {
                throw Object.assign( new Error( 'Validation failed' ), { status : 400, data : { success : false, message : 'request validation failed', errors : ctx.errors } });
            }

            // 3. Wrap in Interceptor Chain
            const finalHandler = async () => 
            {
                const result = await controller[metadata.methodName]( ...args );

                if( metadata.returnTypeValidator && typeof metadata.returnTypeValidator === 'function' ) 
                {
                    const mode = metadata.returnTypeMode || MetadataStore.getDefaultResponseMode();
                    const responseCtx = { success : true, errors : [], mode };
                    const validatedResult = metadata.returnTypeValidator( result, 'response', responseCtx );

                    if( !responseCtx.success ) 
                    {
                        throw new Error( `Response validation failed: ${JSON.stringify( responseCtx.errors )}` );
                    }

                    return validatedResult;
                }

                return result;
            };

            let chain = finalHandler;

            for( const iName of [...metadata.interceptors].reverse()) 
            {
                const interceptor = MetadataStore.getInterceptor( iName );
                const next = chain;
                chain = () => interceptor.intercept( req, next );
            }

            return await chain();
        });
    }
}
