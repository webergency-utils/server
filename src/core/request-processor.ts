import { Context } from './context.js';
import { MetadataStore } from './metadata.js';
import { RequestReader } from '../helpers/request-reader.js';
import { EndpointMetadata, ParamMetadata, AugmentedRequest } from './types.js';
import { SecurityOptions } from '../decorators.js';

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
    public static async resolveParam(
        p: ParamMetadata,
        req: AugmentedRequest,
        ctx: any,
        securityConfig?: SecurityOptions,
        contextModule?: any,
        ws?: any
    ): Promise<any> 
    {
        let val: any;
        switch ( p.source ) 
        {
            case 'Param': val = req.params[p.name!]; break;
            case 'Body': val = await RequestReader.getBody( req, securityConfig ); break;
            case 'Query': val = p.name ? req.query[p.name] : req.query; break;
            case 'Header': val = req.headers.get( p.name! ); break;
            case 'Headers': val = Object.fromEntries( req.headers.entries()); break;
            case 'Request': val = req; break;
            case 'Response': val = undefined; break;
            case 'Ip': val = req.headers.get( 'x-forwarded-for' )?.split( ',' )[0] || '127.0.0.1'; break;
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
            const oldTryConvert = ctx.tryConvert;
      
            if( p.mode ) { ctx.mode = p.mode }

            if( p.source === 'Query' || p.source === 'Param' || p.source === 'Cookie' ) 
            {
                ctx.tryConvert = true;
                ctx.wrapArrays = true;
            }
      
            val = p.validator( val, p.name || p.source.toLowerCase(), ctx );
      
            ctx.mode = oldMode;
            ctx.tryConvert = oldTryConvert;
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
            const middlewareResponse = new Response();

            const finalHandler = async () => 
            {
                // 2. Resolve parameters (Parsing & Validation)
                const args: any[] = [];

                for( const p of metadata.params ) 
                {
                    args.push( await this.resolveParam( p, req, ctx, securityConfig, controllerModule ));
                }

                if( !ctx.success ) 
                {
                    return new Response( JSON.stringify({ success : false, message : 'request validation failed', errors : ctx.errors }), { 
                        status  : 400,
                        headers : { 'Content-Type' : 'application/json' }
                    });
                }

                // 3. Execute Method
                const result = await controller[metadata.methodName]( ...args );

                if( result instanceof Response ) { return result }

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

                if( metadata.meta?.sse ) 
                {
                    const headers = new Headers({
                        'Content-Type'  : 'text/event-stream',
                        'Cache-Control' : 'no-cache',
                        'Connection'    : 'keep-alive'
                    });

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
                                        let sseString = '';

                                        if( typeof chunk === 'object' && chunk !== null ) 
                                        {
                                            if( 'event' in chunk ) { sseString += `event: ${chunk.event}\n` }

                                            if( 'id' in chunk ) { sseString += `id: ${chunk.id}\n` }

                                            if( 'retry' in chunk ) { sseString += `retry: ${chunk.retry}\n` }
                                            const dataVal = 'data' in chunk ? chunk.data : chunk;
                                            const dataStr = typeof dataVal === 'object' ? JSON.stringify( dataVal ) : String( dataVal );
                                            sseString += `data: ${dataStr}\n\n`;
                                        }
                                        else 
                                        {
                                            sseString += `data: ${String( chunk )}\n\n`;
                                        }
                                        controller.enqueue( encoder.encode( sseString ));
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
                // Run Middlewares before guards
                if( metadata.middlewares && metadata.middlewares.length > 0 ) 
                {
                    for( const mName of metadata.middlewares ) 
                    {
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
                        else if( p.source === 'Param' || p.source === 'Body' || p.source === 'Header' || p.source === 'Query' || p.source === 'Context' || p.source === 'Inject' ) 
                        {
                            guardArgs.push( await this.resolveParam( p, req, ctx, securityConfig, guardModule ));
                        }
                        else 
                        {
                            guardArgs.push( g.resolvers[resolverIdx++]);
                        }
                    }

                    const finalArgs = guardArgs.length > 0 ? guardArgs : g.resolvers;
          
                    await guardMethod.apply( guardInstance, finalArgs );
                }

                const response = await chain();
                for( const [key, value] of middlewareResponse.headers.entries()) 
                {
                    response.headers.set( key, value );
                }
                return response;
            }
            catch ( err: any ) 
            {
                if( err instanceof Response ) 
                {
                    for( const [key, value] of middlewareResponse.headers.entries()) 
                    {
                        err.headers.set( key, value );
                    }
                    return err;
                }
                const status = err.status || err.code || 500;

                const response = new Response( JSON.stringify( err.data || { success : false, error : err.message }), { 
                    status, 
                    headers : { 'Content-Type' : 'application/json' } 
                });
                for( const [key, value] of middlewareResponse.headers.entries()) 
                {
                    response.headers.set( key, value );
                }
                return response;
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
                ws.close( 4001, err.message || 'Internal WS Handler Error' );
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
                    else if( p.source === 'Param' || p.source === 'Body' || p.source === 'Header' || p.source === 'Query' || p.source === 'Context' || p.source === 'Inject' ) 
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
