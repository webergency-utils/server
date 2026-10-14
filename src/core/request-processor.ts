import { Context } from './context.js';
import { MetadataStore } from './metadata.js';
import { DIContainer } from './container.js';
import { isMultipartContentType } from '../helpers/request-reader.js';
import { EndpointMetadata, ParamMetadata, ServerResponse, SeoFallthrough, ForwardIntent, isSeoForward } from './types.js';
import { ServerRequest, resolveRequestFileOptions } from './server-request.js';
import { SecurityOptions, type FileOptions } from '../decorators.js';
import { getModuleMeta, getBranchSerializers } from './symbols.js';
import { httpStatusFromError } from '../errors.js';
import { clientErrorBody } from '../helpers/error-response.js';
import { invokeGuards } from './guard-runner.js';
import { ParseError, SerializationError } from '@webergency-utils/typechecker/runtime';
import { isBinaryOrStreamBody, toStreamOrBinaryBody } from '../helpers/response-body.js';
import { resolveReviver, parseAnyJson, parseAnyQuery, type Reviver } from '../helpers/reviver.js';

function parseErrorPath( sourcePath: string, inner: string ): string
{
    if( !inner ){ return sourcePath }

    if( inner === sourcePath || inner.startsWith( `${sourcePath}.` ) || inner.startsWith( `${sourcePath}[` ))
    {
        return inner;
    }

    return `${sourcePath}.${inner}`;
}

function moduleMetaOf( moduleInstance: any ): any
{
    if( !moduleInstance ){ return undefined }

    const ctor = moduleInstance.moduleClass || moduleInstance.constructor;

    return ( ctor && getModuleMeta( ctor ))
        || moduleInstance.__moduleMetadata__
        || ctor?.__moduleMetadata__;
}

function resolveModuleFileOptions( moduleInstance: any ): FileOptions | undefined
{
    return moduleMetaOf( moduleInstance )?.files;
}

function resolveModuleReviver( moduleInstance: any ): Reviver | null | undefined
{
    return moduleMetaOf( moduleInstance )?.reviver;
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
    public static applyReviver(
        req            : ServerRequest | Request,
        metadata       : EndpointMetadata,
        moduleInstance?: any
    ): ServerRequest
    {
        const sreq = ServerRequest.from( req );
        sreq.reviver = resolveReviver(
            metadata.reviver,
            resolveModuleReviver( moduleInstance ),
            sreq.globalReviver
        );

        return sreq;
    }

    private static throwIfAborted( req: ServerRequest )
    {
        if( req.signal?.aborted )
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
        req: ServerRequest | Request,
        ctx: any,
        securityConfig?: SecurityOptions,
        contextModule?: any,
        ws?: any,
        responseBag?: ServerResponse
    ): Promise<any> 
    {
        const sreq = ServerRequest.from( req, { security : securityConfig });

        this.throwIfAborted( sreq );

        const bodyIsPreparsed = p.source === 'Body' && sreq.hasCachedBody;
        let val: any;

        switch ( p.source ) 
        {
            case 'Param': val = sreq.params[p.name!]; break;
            case 'Body': {
                if( isMultipartContentType( sreq.effectiveContentType ))
                {
                    const payload = await sreq.payload();
                    // Query-shaped bag: text fields + UploadedFile / UploadedFile[].
                    // Validated below via assert-style validator with from: 'query'.
                    val = payload.toObject();
                }
                else if( p.parserQuery || p.parser )
                {
                    // Typed urlencoded / JSON: raw text → one parse(text).
                    // With forwardBody, structurally parse once, merge, then assert (not parse).
                    const urlenc = await sreq.tryGetUrlEncodedText( securityConfig );

                    if( urlenc !== undefined )
                    {
                        val = sreq.forwardBody
                            ? { ...parseAnyQuery( urlenc, sreq.reviver ), ...sreq.forwardBody }
                            : urlenc;
                    }
                    else
                    {
                        const jsonText = await sreq.tryGetJsonText( securityConfig );

                        if( jsonText !== undefined )
                        {
                            val = sreq.forwardBody
                                ? { ...parseAnyJson( jsonText, sreq.reviver ), ...sreq.forwardBody }
                                : jsonText;
                        }
                        else
                        {
                            val = await sreq.body( securityConfig );
                        }
                    }
                }
                else
                {
                    val = await sreq.body( securityConfig );
                }

                // Object bags (JSON / multipart / merged urlencoded): apply forwardBody before validate.
                // Raw urlencoded text (no forwardBody) stays a string for parserQuery.
                if( sreq.forwardBody && val && typeof val === 'object' && !Array.isArray( val ))
                {
                    val = { ...val, ...sreq.forwardBody };
                }
                else if( sreq.forwardBody && ( val === undefined || val === null ))
                {
                    val = { ...sreq.forwardBody };
                }

                break;
            }
            case 'RawBody': val = await sreq.rawBody( securityConfig ); break;
            case 'Query': {
                if( p.name )
                {
                    val = sreq.query[p.name];
                }
                else if( p.parser || p.parserQuery )
                {
                    val = sreq.queryString;
                }
                else
                {
                    val = { ...sreq.query };
                }

                break;
            }
            case 'Header': val = sreq.header( p.name! ); break;
            case 'Headers': val = { ...sreq.headers }; break;
            case 'Request': val = sreq; break;
            case 'Response': val = responseBag; break;
            case 'Ip': val = sreq.ip; break;
            case 'Url': val = sreq.url; break;
            case 'Hostname': val = sreq.hostname; break;
            case 'Path': val = sreq.path; break;
            case 'Context': val = Context.get(); break;
            case 'Inject': val = await MetadataStore.getInjectable( p.name!, contextModule ); break;
            case 'WebSocket': val = ws; break;
            case 'Peer': {
                val = sreq.peer;
                break;
            }
            case 'Cookies': {
                val = { ...sreq.cookies };
                break;
            }
            case 'Cookie': {
                val = p.name ? sreq.cookie( p.name ) : { ...sreq.cookies };
                break;
            }
            case 'File': {
                if( !p.name )
                {
                    throw Object.assign( new Error( '@File parameter requires a field name' ), { status : 500 });
                }

                val = await sreq.upload( p.name );
                break;
            }
            case 'Files': {
                val = await sreq.uploads( p.name || undefined );
                break;
            }
        }

        if( p.optional && p.source !== 'Body' && ( val === undefined || val === null ))
        {
            return undefined;
        }

        const bodyContentType = p.source === 'Body' ? sreq.effectiveContentType : null;
        const bodyIsMultipart = p.source === 'Body' && isMultipartContentType( bodyContentType );
        const bodyIsUrlencoded = p.source === 'Body' && bodyContentType === 'application/x-www-form-urlencoded';

        // parse() is wire text only. Objects (multipart, forward merge, header/cookie maps)
        // and already-structured pre-cached bodies stay on the assert/validator channel.
        const canParse = !bodyIsMultipart
            && !bodyIsPreparsed
            && ( p.parser || p.parserQuery )
            && ( typeof val === 'string' || ( p.source !== 'Body' && ( val === undefined || val === null )));

        if( canParse )
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
                    const parseArg = sreq.reviver
                        ? { reviver : sreq.reviver }
                        : ( p.name || p.source.toLowerCase());
                    val = parserFn( val, parseArg as any );

                    // Cache validated body so a later body() call does not re-parse.
                    if( p.source === 'Body' && !sreq.hasCachedBody )
                    {
                        sreq.cacheParsedBody( val );
                    }
                }
                catch( e: any )
                {
                    if( e instanceof ParseError )
                    {
                        ctx.success = false;
                        ctx.errors.push({
                            path  : parseErrorPath( p.name || p.source.toLowerCase(), e.path ),
                            error : parseErrorCode( e )
                        });

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

            if( p.source === 'Param' || p.source === 'Cookie' || p.source === 'Header' )
            {
                ctx.from = 'string';
            }
            else if( p.source === 'Query' || p.source === 'Headers' || p.source === 'Cookies' )
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
        req: ServerRequest | Request,
        securityConfig?: SecurityOptions
    ): Promise<Response> 
    {
        const sreq = ServerRequest.from( req, { security : securityConfig });

        if( securityConfig !== undefined )
        {
            sreq.securityOptions = securityConfig;
        }

        return Context.run({
            request          : sreq,
            metadata,
            requestId        : sreq.requestID,
            requestInstances : new Map<string, any>()
        }, async () => 
        {
            const controllerModule = MetadataStore.getTokenModule( metadata.controller );
            const controller = await MetadataStore.getController( metadata.controller, controllerModule );

            if( !controller ) { throw new Error( `Controller ${metadata.controller} not registered` ) }

            this.applyReviver( sreq, metadata, controllerModule );

            const ctx = { success : true, errors : [], mode : 'strict' };
            const middlewareResponse = new ServerResponse();
            const moduleFiles = resolveModuleFileOptions( controllerModule );
            sreq.fileOptions = resolveRequestFileOptions( sreq, moduleFiles );

            const finalHandler = async () => 
            {
                this.throwIfAborted( sreq );

                // 2. Resolve parameters (Parsing & Validation)
                const args: any[] = [];

                for( const p of metadata.params ) 
                {
                    args.push( await this.resolveParam( p, sreq, ctx, securityConfig, controllerModule, undefined, middlewareResponse ));
                }

                this.throwIfAborted( sreq );

                if( !ctx.success ) 
                {
                    return new Response( JSON.stringify({ success : false, message : 'request validation failed', errors : ctx.errors }), { 
                        status  : 400,
                        headers : { 'Content-Type' : 'application/json' }
                    });
                }

                // 3. Execute Method
                const result = await controller[metadata.methodName]( ...args );

                this.throwIfAborted( sreq );

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

                // Binary / Web ReadableStream / Node Readable|ReadStream → pipe to the UA
                // (before JSON serializers / validators, which cannot consume streams).
                const streamOrBinary = toStreamOrBinaryBody( result );

                if( streamOrBinary !== undefined && !metadata.meta?.sse )
                {
                    return new Response( streamOrBinary );
                }

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
                                                throw new Error(
                                                    `Response validation failed: ${JSON.stringify([{ path : err.path, error : serializationErrorCode( err ) }])}`,
                                                    { cause : err }
                                                );
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

                const branchSerializer = ( typeof result === 'object' && result !== null )
                    ? getBranchSerializers().get( result )
                    : undefined;
                const activeSerializer = branchSerializer
                    || ( typeof metadata.returnTypeSerializer === 'function' ? metadata.returnTypeSerializer : undefined );

                if( typeof activeSerializer === 'function' )
                {
                    try 
                    {
                        const jsonStr = activeSerializer( result );

                        return new Response( jsonStr, { headers : { 'Content-Type' : 'application/json' } });
                    }
                    catch( e: any ) 
                    {
                        if( e instanceof SerializationError ) 
                        {
                            throw new Error( `Response validation failed: ${JSON.stringify([{ path : e.path, error : serializationErrorCode( e ) }])}`, { cause : e });
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
                    return new Response( toStreamOrBinaryBody( validatedResult )! );
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
                const interceptor = await MetadataStore.getInterceptor( iName );
                const next = chain;
                chain = () => interceptor.intercept( sreq, next );
            }

            try 
            {
                this.throwIfAborted( sreq );

                // Run Middlewares before guards
                if( metadata.middlewares && metadata.middlewares.length > 0 ) 
                {
                    for( const mName of metadata.middlewares ) 
                    {
                        this.throwIfAborted( sreq );

                        const middlewareInstance = await MetadataStore.getInjectable( mName, controllerModule );

                        if( !middlewareInstance ) 
                        {
                            throw new Error( `Middleware ${mName} not registered` );
                        }

                        if( typeof middlewareInstance.use === 'function' ) 
                        {
                            await middlewareInstance.use( sreq, middlewareResponse );
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
                                    const res = middlewareInstance.useCallback( sreq, middlewareResponse, next );

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
                await invokeGuards( metadata, sreq, {
                    ctx,
                    controller,
                    controllerModule,
                    securityConfig,
                    response   : middlewareResponse,
                    beforeEach : () => this.throwIfAborted( sreq )
                });

                this.throwIfAborted( sreq );

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

                const response = new Response( JSON.stringify( clientErrorBody( err, status )), { 
                    status, 
                    headers : { 'Content-Type' : 'application/json' } 
                });

                return middlewareResponse.applyTo( response );
            }
            finally
            {
                await DIContainer.destroyInstances( Context.get()?.requestInstances?.values() || []);
                Context.get()?.requestInstances?.clear();
            }
        });
    }

    /** Start a WS handler without blocking the upgrade response; never leave an unhandled rejection. */
    public static runWs(
        metadata: EndpointMetadata,
        ws: any,
        req: ServerRequest | Request
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
        req: ServerRequest | Request
    ): Promise<void> 
    {
        const sreq = ServerRequest.from( req );

        if( ws?.params && Object.keys( sreq.params ).length === 0 )
        {
            sreq.params = ws.params;
        }

        return Context.run({
            request          : sreq,
            metadata,
            requestId        : sreq.requestID,
            requestInstances : new Map<string, any>()
        }, async () => 
        {
            const controllerModule = MetadataStore.getTokenModule( metadata.controller );
            const controller = await MetadataStore.getController( metadata.controller, controllerModule );

            if( !controller ) { throw new Error( `Controller ${metadata.controller} not registered` ) }

            this.applyReviver( sreq, metadata, controllerModule );

            const ctx = { success : true, errors : [], mode : 'strict' };

            try 
            {
                // Resolve parameters (Parsing & Validation)
                const args: any[] = [];

                for( const p of metadata.params ) 
                {
                    args.push( await this.resolveParam( p, sreq, ctx, undefined, controllerModule, ws ));
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
            finally
            {
                await DIContainer.destroyInstances( Context.get()?.requestInstances?.values() || []);
                Context.get()?.requestInstances?.clear();
            }
        });
    }

    public static async executeRpc(
        metadata: EndpointMetadata,
        payload: any
    ): Promise<any> 
    {
        const sreq = new ServerRequest(
            new Request( 'rpc://localhost/' + metadata.path ),
            { preParsedBody : payload }
        );

        return Context.run({
            request          : sreq,
            metadata,
            requestId        : sreq.requestID,
            requestInstances : new Map<string, any>()
        }, async () => 
        {
            try
            {
                const controllerModule = MetadataStore.getTokenModule( metadata.controller );
                const controller = await MetadataStore.getController( metadata.controller, controllerModule );

                if( !controller ) { throw new Error( `Controller ${metadata.controller} not registered` ) }

                const ctx = { success : true, errors : [], mode : 'strict' };

                // 1. Run Guards
                await invokeGuards( metadata, sreq, { ctx, controller, controllerModule });

                // 2. Resolve parameters (Validation)
                const args: any[] = [];

                for( const p of metadata.params ) 
                {
                    args.push( await this.resolveParam( p, sreq, ctx, undefined, controllerModule ));
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
                    const interceptor = await MetadataStore.getInterceptor( iName );
                    const next = chain;
                    chain = () => interceptor.intercept( sreq, next );
                }

                return await chain();
            }
            finally
            {
                await DIContainer.destroyInstances( Context.get()?.requestInstances?.values() || []);
                Context.get()?.requestInstances?.clear();
            }
        });
    }
}
