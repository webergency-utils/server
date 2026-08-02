import { Context } from './context.js';
import { MetadataStore } from './metadata.js';
import { RequestReader, getEffectiveBodyContentType, isMultipartContentType } from '../helpers/request-reader.js';
import { EndpointMetadata, ParamMetadata, AugmentedRequest, ServerResponse, SeoFallthrough, ForwardIntent, isSeoForward } from './types.js';
import { ServerRequest, parseCookieHeader, resolveRequestFileOptions } from './server-request.js';
import { SecurityOptions, type FileOptions } from '../decorators.js';
import { getModuleMeta } from './symbols.js';
import { httpStatusFromError } from '../errors.js';
import { resolveClientIp } from '../helpers/client-ip.js';
import { invokeGuards } from './guard-runner.js';
import { ParseError, SerializationError } from '@webergency-utils/typechecker/runtime';

function resolveModuleFileOptions( moduleInstance: any ): FileOptions | undefined
{
    if( !moduleInstance ){ return undefined }

    const ctor = moduleInstance.constructor;
    const meta = ( ctor && getModuleMeta( ctor ))
        || moduleInstance.__moduleMetadata__
        || ctor?.__moduleMetadata__;

    return meta?.files;
}

/** Bodies that must not go through JSON.stringify. */
function isBinaryOrStreamBody( value: unknown ): boolean
{
    if( value == null ){ return false }

    if( typeof Blob !== 'undefined' && value instanceof Blob ){ return true }

    if( value instanceof ArrayBuffer ){ return true }

    if( ArrayBuffer.isView( value )){ return true }

    if( typeof ReadableStream !== 'undefined' && value instanceof ReadableStream ){ return true }

    return false;
}

function parseErrorCode( err: ParseError ): string
{
    const prefix = err.path ? `Parse error at "${err.path}": ` : 'Parse error: ';

    if( err.message.startsWith( prefix ))
    {
        return err.message.slice( prefix.length );
    }

    return err.message;
}

function serializationErrorCode( err: SerializationError ): string
{
    const prefix = err.path ? `Serialization error at "${err.path}": ` : 'Serialization error: ';

    if( err.message.startsWith( prefix ))
    {
        return err.message.slice( prefix.length );
    }

    return err.message;
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

    private static assertForwardCompatible( bag: ServerResponse, result: unknown ): void
    {
        if( bag.bodySet )
        {
            throw Object.assign( new Error( 'Cannot forward after streaming a response body' ), { status : 500 });
        }

        if( bag.toResponse().headers.has( 'Location' ))
        {
            throw Object.assign( new Error( 'Cannot combine redirect and forward' ), { status : 500 });
        }

        if( result instanceof ServerResponse && result !== bag )
        {
            if( result.bodySet )
            {
                throw Object.assign( new Error( 'Cannot forward after streaming a response body' ), { status : 500 });
            }

            if( result.toResponse().headers.has( 'Location' ))
            {
                throw Object.assign( new Error( 'Cannot combine redirect and forward' ), { status : 500 });
            }
        }
    }

    /** Validate one SSE yield: prefer `chunk.data` when present, else the whole chunk. */
    private static validateSseChunk( chunk: any, validator: (( v: any, path: string, ctx: any ) => any ) | undefined, mode: string ): any
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

    /** Format one SSE yield: prefer serializer for `data` JSON when present. */
    private static formatSseChunk( chunk: any, serializer?: ( v: any ) => string ): string
    {
        if( typeof chunk === 'object' && chunk !== null )
        {
            let sseString = '';

            if( 'event' in chunk ){ sseString += `event: ${chunk.event}\n` }

            if( 'id' in chunk ){ sseString += `id: ${chunk.id}\n` }

            if( 'retry' in chunk ){ sseString += `retry: ${chunk.retry}\n` }
            const dataVal = 'data' in chunk ? chunk.data : chunk;
            let dataStr: string;

            if( serializer )
            {
                dataStr = serializer( dataVal );
            }
            else 
            {
                dataStr = typeof dataVal === 'object' ? JSON.stringify( dataVal ) : String( dataVal );
            }
            sseString += `data: ${dataStr}\n\n`;

            return sseString;
        }

        if( serializer ){ return `data: ${serializer( chunk )}\n\n` }

        return `data: ${String( chunk )}\n\n`;
    }

    public static async resolveParam(
        p: ParamMetadata,
        req: AugmentedRequest,
        ctx: any,
        securityConfig?: SecurityOptions,
        contextModule?: any,
        ws?: any,
        responseBag?: ServerResponse,
        serverRequest?: ServerRequest
    ): Promise<any> 
    {
        this.throwIfAborted( req );

        let val: any;
        switch ( p.source ) 
        {
            case 'Param': val = req.params[p.name!]; break;
            case 'Body': {
                if( isMultipartContentType( getEffectiveBodyContentType( req )))
                {
                    const facade = serverRequest ?? new ServerRequest( req, securityConfig );
                    const payload = await facade.payload();
                    // Query-shaped bag: text fields + UploadedFile / UploadedFile[].
                    // Validated below via assert-style validator with from: 'query'.
                    val = payload.toObject();
                }
                else
                {
                    val = await RequestReader.getBody( req, securityConfig );
                }

                if( req.forwardBody && val && typeof val === 'object' && !Array.isArray( val ))
                {
                    val = { ...val, ...req.forwardBody };
                }
                else if( req.forwardBody && ( val === undefined || val === null ))
                {
                    val = { ...req.forwardBody };
                }

                break;
            }
            case 'RawBody': val = await RequestReader.getRawBody( req, securityConfig ); break;
            case 'Query': val = p.name ? req.query[p.name] : { ...req.query }; break;
            case 'Header': val = req.headers.get( p.name! ); break;
            case 'Headers': val = Object.fromEntries( req.headers.entries()); break;
            case 'Request': val = serverRequest ?? new ServerRequest( req, securityConfig ); break;
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
                val = parseCookieHeader( req.headers.get( 'cookie' ));
                break;
            }
            case 'Cookie': {
                const cookies = parseCookieHeader( req.headers.get( 'cookie' ));
                val = p.name ? cookies[p.name] : { ...cookies };
                break;
            }
            case 'File': {
                if( !p.name )
                {
                    throw Object.assign( new Error( '@File parameter requires a field name' ), { status : 500 });
                }

                const facade = serverRequest ?? new ServerRequest( req, securityConfig );
                const file = await facade.upload( p.name );
                val = file;
                break;
            }
            case 'Files': {
                const facade = serverRequest ?? new ServerRequest( req, securityConfig );
                val = await facade.uploads( p.name || undefined );
                break;
            }
        }

        const bodyContentType = p.source === 'Body' ? getEffectiveBodyContentType( req ) : null;
        const bodyIsMultipart = p.source === 'Body' && isMultipartContentType( bodyContentType );
        const bodyIsUrlencoded = p.source === 'Body' && bodyContentType === 'application/x-www-form-urlencoded';

        // Multipart uses the assert/validator channel (from: 'query'), not buildParser —
        // parsers lack class instanceof for UploadedFile fields.
        if( !bodyIsMultipart && ( p.parser || p.parserQuery ))
        {
            let parserFn: (( input: any, path?: string ) => any ) | undefined;

            if( bodyIsUrlencoded )
            {
                const fn = p.parserQuery || p.parser;
                parserFn = typeof fn === 'function' ? fn : undefined;
            }
            else
            {
                parserFn = typeof p.parser === 'function' ? p.parser : undefined;
            }

            if( parserFn )
            {
                try
                {
                    val = parserFn( val, p.name || p.source.toLowerCase());
                }
                catch( e: any )
                {
                    if( e instanceof ParseError )
                    {
                        ctx.success = false;
                        ctx.errors.push({ path : e.path, error : parseErrorCode( e ) });

                        return val;
                    }

                    throw e;
                }

                return val;
            }
        }

        if( p.validator && typeof p.validator === 'function' )
        {
            const oldMode = ctx.mode;
            const oldFrom = ctx.from;

            if( p.mode ){ ctx.mode = p.mode }

            if( p.source === 'Query' || p.source === 'Param' || p.source === 'Cookie'
                || p.source === 'Header' || p.source === 'Headers' || p.source === 'Cookies' )
            {
                ctx.from = 'query';
            }
            else if( p.source === 'Body' )
            {
                ctx.from = ( bodyIsUrlencoded || bodyIsMultipart ) ? 'query' : 'json';
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
        return Context.run({
            request          : req,
            metadata,
            requestId        : req.requestId,
            requestInstances : new Map<string, any>()
        }, async () => 
        {
            const controllerModule = MetadataStore.getTokenModule( metadata.controller );
            const controller = MetadataStore.getController( metadata.controller, controllerModule );

            if( !controller ) { throw new Error( `Controller ${metadata.controller} not registered` ) }

            const ctx = { success : true, errors : [], mode : 'strict' };
            const middlewareResponse = new ServerResponse();
            const moduleFiles = resolveModuleFileOptions( controllerModule );
            const filesConfig = resolveRequestFileOptions( req, moduleFiles );
            const serverRequest = new ServerRequest( req, securityConfig, filesConfig );

            const finalHandler = async () => 
            {
                this.throwIfAborted( req );

                // 2. Resolve parameters (Parsing & Validation)
                const args: any[] = [];

                for( const p of metadata.params ) 
                {
                    args.push( await this.resolveParam( p, req, ctx, securityConfig, controllerModule, undefined, middlewareResponse, serverRequest ));
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

                const pending =
                    ( result instanceof ServerResponse ? result.pendingForward : undefined )
                    || middlewareResponse.pendingForward;

                if( metadata.seo )
                {
                    if( result === undefined || result === null )
                    {
                        throw new SeoFallthrough();
                    }

                    if( isSeoForward( result ))
                    {
                        throw new ForwardIntent( result );
                    }

                    if( pending )
                    {
                        this.assertForwardCompatible( middlewareResponse, result );

                        throw new ForwardIntent( pending );
                    }

                    throw Object.assign(
                        new Error( 'SEO endpoint must return a SeoForward descriptor or void' ),
                        { status : 500 }
                    );
                }

                if( pending )
                {
                    this.assertForwardCompatible( middlewareResponse, result );

                    throw new ForwardIntent( pending );
                }

                // Returning ServerResponse means the handler owns the HTTP response
                // (status / headers / optional streamed body) — skip JSON / return-type paths.
                if( result instanceof ServerResponse )
                {
                    return result.toResponse();
                }

                if( result instanceof Response ) { return result }

                if( metadata.meta?.sse ) 
                {
                    const headers = new Headers({
                        'Content-Type'  : 'text/event-stream',
                        'Cache-Control' : 'no-cache',
                        'Connection'    : 'keep-alive'
                    });

                    const serializer = typeof metadata.returnTypeSerializer === 'function'
                        ? metadata.returnTypeSerializer
                        : undefined;
                    const validator = !serializer && typeof metadata.returnTypeValidator === 'function'
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
                                        try 
                                        {
                                            const payload = serializer
                                                ? chunk
                                                : RequestProcessor.validateSseChunk( chunk, validator, mode );
                                            controller.enqueue( encoder.encode( RequestProcessor.formatSseChunk( payload, serializer )));
                                        }
                                        catch( err: any ) 
                                        {
                                            if( err instanceof SerializationError ) 
                                            {
                                                throw new Error( `Response validation failed: ${JSON.stringify([{ path : err.path, error : serializationErrorCode( err ) }])}` );
                                            }

                                            throw err;
                                        }
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

                if( typeof metadata.returnTypeSerializer === 'function' )
                {
                    try 
                    {
                        const jsonStr = metadata.returnTypeSerializer( result );

                        return new Response( jsonStr, { headers : { 'Content-Type' : 'application/json' } });
                    }
                    catch( e: any ) 
                    {
                        if( e instanceof SerializationError ) 
                        {
                            throw new Error( `Response validation failed: ${JSON.stringify([{ path : e.path, error : serializationErrorCode( e ) }])}` );
                        }

                        throw e;
                    }
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

                if( isBinaryOrStreamBody( validatedResult ))
                {
                    return new Response( validatedResult as BodyInit );
                }

                if( typeof validatedResult === 'object' && validatedResult !== null )
                {
                    return new Response( JSON.stringify( validatedResult ), { headers : { 'Content-Type' : 'application/json' } });
                }

                return new Response( validatedResult == null ? '' : String( validatedResult ));
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
                            await middlewareInstance.use( serverRequest, middlewareResponse );
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
                                    const res = middlewareInstance.useCallback( serverRequest, middlewareResponse, next );

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
                await invokeGuards( metadata, req, {
                    ctx,
                    controller,
                    controllerModule,
                    securityConfig,
                    response      : middlewareResponse,
                    serverRequest,
                    beforeEach    : () => this.throwIfAborted( req )
                });

                this.throwIfAborted( req );

                return middlewareResponse.applyTo( await chain());
            }
            catch ( err: any ) 
            {
                if( err instanceof SeoFallthrough || err instanceof ForwardIntent )
                {
                    throw err;
                }

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
        return Context.run({
            request          : req,
            metadata,
            requestId        : req.requestId,
            requestInstances : new Map<string, any>()
        }, async () => 
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
                    args.push( await this.resolveParam( p, req, ctx, undefined, controllerModule, ws, undefined, new ServerRequest( req )));
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

        return Context.run({
            request          : req,
            metadata,
            requestId        : req.requestId,
            requestInstances : new Map<string, any>()
        }, async () => 
        {
            const controllerModule = MetadataStore.getTokenModule( metadata.controller );
            const controller = MetadataStore.getController( metadata.controller, controllerModule );

            if( !controller ) { throw new Error( `Controller ${metadata.controller} not registered` ) }

            const ctx = { success : true, errors : [], mode : 'strict' };

            // 1. Run Guards
            await invokeGuards( metadata, req, { ctx, controller, controllerModule });

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
