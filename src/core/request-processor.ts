import { Context, type RequestContext } from './context.js';
import { ApplicationRegistry, getRegistry } from './registry.js';
import { isMultipartContentType } from '../helpers/request-reader.js';
import { EndpointMetadata, ParamMetadata, ServerResponse, SeoFallthrough, ForwardIntent, isSeoForward } from './types.js';
import { ServerRequest, resolveRequestFileOptions } from './server-request.js';
import { Scope, SecurityOptions, type FileOptions } from '../decorators.js';
import { getModuleMeta, getBranchSerializers, hasFallbackBranchSerializers } from './symbols.js';
import { httpStatusFromError } from '../errors.js';
import { clientErrorBody } from '../helpers/error-response.js';
import { invokeGuards } from './guard-runner.js';
import { ParseError, SerializationError } from '@webergency-utils/typechecker/runtime';
import { toStreamOrBinaryBody } from '../helpers/response-body.js';
import { resolveReviver, parseAnyJson, parseAnyQuery, type Reviver } from '../helpers/reviver.js';
import { computeBodyHash } from '../helpers/body-hash.js';

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

const reversedInterceptorsCache = new WeakMap<EndpointMetadata, string[]>();
const rpcRequestTemplateCache = new WeakMap<EndpointMetadata, Request>();

interface EndpointPlan {
    cacheVersion           : number
    controllerModule       : any
    moduleFiles            : FileOptions | undefined
    moduleReviver          : Reviver | null | undefined
    reversedInterceptors   : string[]
    needsResponseInParams  : boolean
    hasMiddlewares         : boolean
    hasGuards              : boolean
    singletonController?   : any
    singletonInterceptors? : any[]
}

const endpointPlanCache = new WeakMap<ApplicationRegistry, WeakMap<EndpointMetadata, EndpointPlan>>();

function getReversedInterceptors( metadata: EndpointMetadata ): string[]
{
    if( metadata.interceptors.length === 0 ) { return metadata.interceptors }

    let reversed = reversedInterceptorsCache.get( metadata );

    if( !reversed )
    {
        reversed = [ ...metadata.interceptors ].reverse();
        reversedInterceptorsCache.set( metadata, reversed );
    }

    return reversed;
}

function getEndpointPlan( registry: ApplicationRegistry, metadata: EndpointMetadata ): EndpointPlan
{
    let byMeta = endpointPlanCache.get( registry );

    if( !byMeta )
    {
        byMeta = new WeakMap();
        endpointPlanCache.set( registry, byMeta );
    }

    let plan = byMeta.get( metadata );

    if( !plan || plan.cacheVersion !== registry.cacheVersion )
    {
        const controllerModule = registry.getTokenModule( metadata.controller );
        plan = {
            cacheVersion          : registry.cacheVersion,
            controllerModule,
            moduleFiles           : resolveModuleFileOptions( controllerModule ),
            moduleReviver         : resolveModuleReviver( controllerModule ),
            reversedInterceptors  : getReversedInterceptors( metadata ),
            needsResponseInParams : metadata.params.some( p => p.source === 'Response' ),
            hasMiddlewares        : Boolean( metadata.middlewares && metadata.middlewares.length > 0 ),
            hasGuards             : metadata.guards.length > 0
        };
        byMeta.set( metadata, plan );
    }

    return plan;
}

function getRpcTemplateRequest( metadata: EndpointMetadata ): Request
{
    let req = rpcRequestTemplateCache.get( metadata );

    if( !req )
    {
        req = new Request( 'rpc://localhost/' + metadata.path );
        rpcRequestTemplateCache.set( metadata, req );
    }

    return req;
}

const SOURCE_LABELS: Record<string, string> = {
    Param     : 'param',
    Body      : 'body',
    RawBody   : 'rawbody',
    BodyHash  : 'bodyhash',
    Query     : 'query',
    Header    : 'header',
    Headers   : 'headers',
    Request   : 'request',
    Response  : 'response',
    Ip        : 'ip',
    Url       : 'url',
    Hostname  : 'hostname',
    Path      : 'path',
    Context   : 'context',
    Inject    : 'inject',
    WebSocket : 'websocket',
    Peer      : 'peer',
    Cookies   : 'cookies',
    Cookie    : 'cookie',
    File      : 'file',
    Files     : 'files'
};

function getParamLabel( p: ParamMetadata ): string
{
    return p.name || SOURCE_LABELS[p.source] || p.source.toLowerCase();
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

    private static assertForwardCompatible( bag: ServerResponse | undefined, result: unknown ): void
    {
        if( bag?.bodySet )
        {
            throw Object.assign( new Error( 'Cannot forward after streaming a response body' ), { status : 500 });
        }

        if( bag && bag.toResponse().headers.has( 'Location' ))
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
            case 'BodyHash': {
                const raw = await sreq.rawBody( securityConfig );
                val = computeBodyHash( raw, p.hasher, p.hashOptions );
                break;
            }
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
            case 'Inject': val = await getRegistry().getInjectable( p.name!, contextModule ); break;
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
                const paramLabel = getParamLabel( p );

                try
                {
                    const parseArg = sreq.reviver
                        ? { reviver : sreq.reviver }
                        : paramLabel;
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
                            path  : parseErrorPath( paramLabel, e.path ),
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

            val = p.validator( val, getParamLabel( p ), ctx );

            ctx.mode = oldMode;
            ctx.from = oldFrom;
        }

        return val;
    }

    public static async resolveParams(
        metadata: EndpointMetadata,
        sreq: ServerRequest,
        ctx: { success : boolean, errors : any[], mode : string },
        securityConfig?: SecurityOptions,
        controllerModule?: any,
        ws?: any,
        responseBag?: ServerResponse
    ): Promise<any[]>
    {
        if( metadata.params.length === 0 ){ return [] }

        const args: any[] = [];

        for( const p of metadata.params )
        {
            args.push( await this.resolveParam( p, sreq, ctx, securityConfig, controllerModule, ws, responseBag ));
        }

        return args;
    }

    private static async resolveController(
        plan: EndpointPlan,
        metadata: EndpointMetadata,
        registry: ApplicationRegistry
    ): Promise<any>
    {
        const controller = await registry.getController( metadata.controller, plan.controllerModule );

        if( controller && registry.getResolvedScope( metadata.controller, plan.controllerModule ) === Scope.SINGLETON )
        {
            plan.singletonController = controller;
        }

        return controller;
    }

    private static wrapInterceptorChain<T>(
        interceptors: any[],
        sreq: ServerRequest,
        finalHandler: () => Promise<T>
    ): () => Promise<T>
    {
        let chain = finalHandler;

        for( let i = 0; i < interceptors.length; i++ )
        {
            const interceptor = interceptors[i];
            const next = chain;
            chain = () => interceptor.intercept( sreq, next );
        }

        return chain;
    }

    private static async buildInterceptorChain<T>(
        plan: EndpointPlan,
        registry: ApplicationRegistry,
        sreq: ServerRequest,
        finalHandler: () => Promise<T>
    ): Promise<() => Promise<T>>
    {
        const resolved: any[] = [];
        let allSingleton = true;

        for( const iName of plan.reversedInterceptors )
        {
            const interceptor = await registry.getInterceptor( iName, plan.controllerModule );
            resolved.push( interceptor );

            if( allSingleton && registry.getResolvedScope( iName, plan.controllerModule ) !== Scope.SINGLETON )
            {
                allSingleton = false;
            }
        }

        if( allSingleton )
        {
            plan.singletonInterceptors = resolved;
        }

        return this.wrapInterceptorChain( resolved, sreq, finalHandler );
    }

    private static async runMiddlewares(
        plan: EndpointPlan,
        metadata: EndpointMetadata,
        registry: ApplicationRegistry,
        sreq: ServerRequest,
        resBag: ServerResponse
    ): Promise<void>
    {
        for( const mName of metadata.middlewares! )
        {
            this.throwIfAborted( sreq );

            const middlewareInstance = await registry.getInjectable( mName, plan.controllerModule );

            if( !middlewareInstance )
            {
                throw new Error( `Middleware ${mName} not registered` );
            }

            if( typeof middlewareInstance.use === 'function' )
            {
                await middlewareInstance.use( sreq, resBag );
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
                        const res = middlewareInstance.useCallback( sreq, resBag, next );

                        if( res instanceof Promise )
                        {
                            res.catch( reject );
                        }
                    }
                    catch( err )
                    {
                        reject( err );
                    }
                });
            }
        }
    }

    public static async cleanupRequestContext( requestCtx?: RequestContext ): Promise<void>
    {
        if( !requestCtx ){ return }

        requestCtx.wsCleanedUp = true;
        const scoped = requestCtx.requestInstances;

        if( scoped && scoped.size > 0 )
        {
            await ApplicationRegistry.destroyInstances( scoped.values());
            scoped.clear();
        }
    }

    public static async execute(
        metadata: EndpointMetadata,
        req: ServerRequest | Request,
        securityConfig?: SecurityOptions,
        registryArg?: ApplicationRegistry
    ): Promise<Response> 
    {
        const sreq = ServerRequest.from( req, { security : securityConfig });

        if( securityConfig !== undefined )
        {
            sreq.securityOptions = securityConfig;
        }

        const registry = registryArg ?? getRegistry();
        const requestCtx: RequestContext = {
            request   : sreq,
            metadata,
            requestId : sreq.requestID,
            registry
        };

        return Context.run( requestCtx, async () => 
        {
            const plan = getEndpointPlan( registry, metadata );
            const { controllerModule } = plan;
            const controller = plan.singletonController ?? await this.resolveController( plan, metadata, registry );

            if( !controller ) { throw new Error( `Controller ${metadata.controller} not registered` ) }

            sreq.reviver = resolveReviver(
                metadata.reviver,
                plan.moduleReviver,
                sreq.globalReviver
            );

            const ctx = { success : true, errors : [] as any[], mode : 'strict' };
            let middlewareResponse: ServerResponse | undefined =
                ( plan.hasMiddlewares || plan.needsResponseInParams ) ? new ServerResponse() : undefined;
            const getResponseBag = (): ServerResponse =>
                middlewareResponse ?? ( middlewareResponse = new ServerResponse());

            if( sreq.globalFiles !== undefined || plan.moduleFiles !== undefined || sreq.routeFiles !== undefined )
            {
                sreq.fileOptions = resolveRequestFileOptions( sreq, plan.moduleFiles );
            }

            const finalHandler = async () => 
            {
                this.throwIfAborted( sreq );

                // 2. Resolve parameters (Parsing & Validation) & Execute Method
                let result: any;

                if( metadata.params.length === 0 )
                {
                    result = await controller[metadata.methodName]();
                }
                else
                {
                    const args = await this.resolveParams(
                        metadata,
                        sreq,
                        ctx,
                        securityConfig,
                        controllerModule,
                        undefined,
                        middlewareResponse
                    );

                    this.throwIfAborted( sreq );

                    if( !ctx.success ) 
                    {
                        await sreq.cleanupDiskUploads();

                        return new Response( JSON.stringify({ success : false, message : 'request validation failed', errors : ctx.errors }), { 
                            status  : 400,
                            headers : { 'Content-Type' : 'application/json' }
                        });
                    }

                    result = await controller[metadata.methodName]( ...args );
                }

                this.throwIfAborted( sreq );

                const pending =
                    ( result instanceof ServerResponse ? result.pendingForward : undefined )
                    || middlewareResponse?.pendingForward;

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
                    const mode = metadata.returnTypeMode || registry.getDefaultResponseMode();

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
                    ? ( requestCtx.branchSerializers?.get( result )
                        ?? ( hasFallbackBranchSerializers() ? getBranchSerializers().get( result ) : undefined ))
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
                    const mode = metadata.returnTypeMode || registry.getDefaultResponseMode();
                    const responseCtx = { success : true, errors : [], mode };
                    validatedResult = metadata.returnTypeValidator( result, 'response', responseCtx );

                    if( !responseCtx.success ) 
                    {
                        throw new Error( `Response validation failed: ${JSON.stringify( responseCtx.errors )}` );
                    }
                }

                if( typeof validatedResult === 'object' && validatedResult !== null )
                {
                    return new Response( JSON.stringify( validatedResult ), { headers : { 'Content-Type' : 'application/json' } });
                }

                return new Response( validatedResult == null ? '' : String( validatedResult ));
            };

            const chain = plan.reversedInterceptors.length === 0
                ? finalHandler
                : ( plan.singletonInterceptors !== undefined
                    ? this.wrapInterceptorChain( plan.singletonInterceptors, sreq, finalHandler )
                    : await this.buildInterceptorChain( plan, registry, sreq, finalHandler ));

            try 
            {
                this.throwIfAborted( sreq );

                if( plan.hasMiddlewares )
                {
                    await this.runMiddlewares( plan, metadata, registry, sreq, middlewareResponse! );
                }

                // 1. Run Guards FIRST (Security gate)
                if( plan.hasGuards )
                {
                    await invokeGuards( metadata, sreq, {
                        ctx,
                        controller,
                        controllerModule,
                        securityConfig,
                        response    : middlewareResponse,
                        getResponse : getResponseBag,
                        beforeEach  : () => this.throwIfAborted( sreq )
                    });
                }

                this.throwIfAborted( sreq );

                const outResponse = await chain();

                return middlewareResponse ? middlewareResponse.applyTo( outResponse ) : outResponse;
            }
            catch ( err: any ) 
            {
                if( err instanceof SeoFallthrough || err instanceof ForwardIntent )
                {
                    throw err;
                }

                await sreq.cleanupDiskUploads();

                if( err instanceof Response ) 
                {
                    return middlewareResponse ? middlewareResponse.applyTo( err ) : err;
                }
                const status = httpStatusFromError( err );

                const response = new Response( JSON.stringify( clientErrorBody( err, status )), { 
                    status, 
                    headers : { 'Content-Type' : 'application/json' } 
                });

                return middlewareResponse ? middlewareResponse.applyTo( response ) : response;
            }
            finally
            {
                if( requestCtx.requestInstances?.size )
                {
                    await this.cleanupRequestContext( requestCtx );
                }
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
        const handedOffCtx: RequestContext | undefined = ( req as any )?.__wsRequestContext;
        const sreq: ServerRequest = handedOffCtx?.request ?? ServerRequest.from( req );

        if( ws?.params && Object.keys( sreq.params ).length === 0 )
        {
            sreq.params = ws.params;
        }

        const registry = handedOffCtx?.registry ?? getRegistry();
        const requestCtx: RequestContext = handedOffCtx ?? {
            request   : sreq,
            metadata,
            requestId : sreq.requestID,
            registry
        };

        return Context.run( requestCtx, async () => 
        {
            const plan = getEndpointPlan( registry, metadata );
            const { controllerModule } = plan;
            const controller = handedOffCtx?.wsController
                ?? plan.singletonController
                ?? await this.resolveController( plan, metadata, registry );

            if( !controller ) { throw new Error( `Controller ${metadata.controller} not registered` ) }

            if( !handedOffCtx )
            {
                sreq.reviver = resolveReviver(
                    metadata.reviver,
                    plan.moduleReviver,
                    sreq.globalReviver
                );
            }

            const ctx = { success : true, errors : [] as any[], mode : 'strict' };
            const middlewareResponse: ServerResponse | undefined =
                ( plan.hasMiddlewares || plan.needsResponseInParams ) ? new ServerResponse() : undefined;

            try 
            {
                if( plan.hasMiddlewares )
                {
                    await this.runMiddlewares( plan, metadata, registry, sreq, middlewareResponse! );
                }

                const args = await this.resolveParams(
                    metadata,
                    sreq,
                    ctx,
                    undefined,
                    controllerModule,
                    ws,
                    middlewareResponse
                );

                if( !ctx.success ) 
                {
                    ws.close( 4000, JSON.stringify({ success : false, message : 'request validation failed', errors : ctx.errors }));

                    return;
                }

                const finalHandler = async () => controller[metadata.methodName]( ...args );
                const chain = plan.reversedInterceptors.length === 0
                    ? finalHandler
                    : ( plan.singletonInterceptors !== undefined
                        ? this.wrapInterceptorChain( plan.singletonInterceptors, sreq, finalHandler )
                        : await this.buildInterceptorChain( plan, registry, sreq, finalHandler ));
                await chain();
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
                await this.cleanupRequestContext( requestCtx );
            }
        });
    }

    public static async executeRpc(
        metadata: EndpointMetadata,
        payload: any
    ): Promise<any> 
    {
        const sreq = new ServerRequest(
            getRpcTemplateRequest( metadata ),
            { preParsedBody : payload }
        );

        const registry = getRegistry();
        const requestCtx: RequestContext = {
            request   : sreq,
            metadata,
            requestId : sreq.requestID,
            registry
        };

        return Context.run( requestCtx, async () => 
        {
            try
            {
                const plan = getEndpointPlan( registry, metadata );
                const { controllerModule } = plan;
                const controller = plan.singletonController ?? await this.resolveController( plan, metadata, registry );

                if( !controller ) { throw new Error( `Controller ${metadata.controller} not registered` ) }

                const ctx = { success : true, errors : [] as any[], mode : 'strict' };
                let middlewareResponse: ServerResponse | undefined =
                    ( plan.hasMiddlewares || plan.needsResponseInParams ) ? new ServerResponse() : undefined;
                const getResponseBag = (): ServerResponse =>
                    middlewareResponse ?? ( middlewareResponse = new ServerResponse());

                if( plan.hasMiddlewares )
                {
                    await this.runMiddlewares( plan, metadata, registry, sreq, middlewareResponse! );
                }

                // 1. Run Guards
                if( plan.hasGuards )
                {
                    await invokeGuards( metadata, sreq, {
                        ctx,
                        controller,
                        controllerModule,
                        response    : middlewareResponse,
                        getResponse : getResponseBag
                    });
                }

                // 2. Resolve parameters (Validation)
                const args = await this.resolveParams(
                    metadata,
                    sreq,
                    ctx,
                    undefined,
                    controllerModule,
                    undefined,
                    middlewareResponse
                );

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
                        const mode = metadata.returnTypeMode || registry.getDefaultResponseMode();
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

                const chain = plan.reversedInterceptors.length === 0
                    ? finalHandler
                    : ( plan.singletonInterceptors !== undefined
                        ? this.wrapInterceptorChain( plan.singletonInterceptors, sreq, finalHandler )
                        : await this.buildInterceptorChain( plan, registry, sreq, finalHandler ));

                return await chain();
            }
            finally
            {
                if( requestCtx.requestInstances?.size )
                {
                    await this.cleanupRequestContext( requestCtx );
                }
            }
        });
    }
}
