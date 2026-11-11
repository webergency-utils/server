import { Context, type RequestContext } from './context.js';
import { ApplicationRegistry, getRegistry } from './registry.js';
import { isMultipartContentType } from '../helpers/request-reader.js';
import
{
    DIRECT_RESPONSE_BODY,
    EndpointMetadata,
    ForwardIntent,
    isNullBodyStatus,
    isSeoForward,
    ParamMetadata,
    SeoFallthrough,
    ServerResponse,
    tagDirectResponse
}
    from './types.js';
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

export const FINALIZED_RESPONSE = Symbol.for( 'webergency.server.finalizedResponse' );

const ASYNC_PARAM_SOURCES = new Set<string>([ 'Body', 'RawBody', 'BodyHash', 'Inject', 'File', 'Files' ]);
const EMPTY_ARGS: any[] = [];

const reversedInterceptorsCache = new WeakMap<EndpointMetadata, string[]>();
const rpcRequestTemplateCache = new WeakMap<EndpointMetadata, Request>();

interface EndpointPlan
{
    cacheVersion           : number
    controllerModule       : any
    moduleFiles            : FileOptions | undefined
    moduleReviver          : Reviver | null | undefined
    reversedInterceptors   : string[]
    needsResponseInParams  : boolean
    hasMiddlewares         : boolean
    hasGuards              : boolean
    hasAsyncParams         : boolean
    isSse                  : boolean
    isSeo                  : boolean
    singletonController?   : any
    singletonInterceptors? : any[]
}

const endpointPlanCache = new WeakMap<ApplicationRegistry, WeakMap<EndpointMetadata, EndpointPlan>>();

function isPromiseLike( val: unknown ): val is PromiseLike<any>
{
    return val !== null
        && ( typeof val === 'object' || typeof val === 'function' )
        && typeof ( val as PromiseLike<any> ).then === 'function';
}

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
        let singletonController: any;

        if( registry.controllers.has( metadata.controller ))
        {
            singletonController = registry.controllers.get( metadata.controller );
        }
        else if( registry.getResolvedScope( metadata.controller, controllerModule ) === Scope.SINGLETON )
        {
            const syncCtrl = registry.resolveSyncOrBail( metadata.controller, controllerModule );

            if( syncCtrl && syncCtrl !== ApplicationRegistry.SYNC_BAILOUT )
            {
                singletonController = syncCtrl;
            }
        }

        plan = {
            cacheVersion          : registry.cacheVersion,
            controllerModule,
            moduleFiles           : resolveModuleFileOptions( controllerModule ),
            moduleReviver         : resolveModuleReviver( controllerModule ),
            reversedInterceptors  : getReversedInterceptors( metadata ),
            needsResponseInParams : metadata.params.some( p => p.source === 'Response' ),
            hasMiddlewares        : Boolean( metadata.middlewares && metadata.middlewares.length > 0 ),
            hasGuards             : metadata.guards.length > 0,
            hasAsyncParams        : metadata.params.some( p => ASYNC_PARAM_SOURCES.has( p.source )),
            isSse                 : Boolean( metadata.meta?.sse ),
            isSeo                 : Boolean( metadata.seo ),
            singletonController
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

export interface ExecuteOptions
{
    exposeErrors?        : boolean
    onError?             : ( err: unknown, status: number, requestId?: string ) => void
    jsonHeadersTemplate? : Headers
    baseHeadersTemplate? : Headers
    requestId?           : string
}

function buildJsonResponse( jsonStr: string, requestId: string | undefined, options?: ExecuteOptions, hasMiddlewareBag?: boolean ): Response
{
    const id = options?.requestId ?? requestId;

    if( !hasMiddlewareBag && options?.jsonHeadersTemplate && id )
    {
        const res = new Response( jsonStr, { headers : options.jsonHeadersTemplate });
        res.headers.set( 'x-request-id', id );
        ( res as any )[DIRECT_RESPONSE_BODY] = jsonStr;
        ( res as any )[FINALIZED_RESPONSE] = true;

        return res;
    }

    return tagDirectResponse(
        new Response( jsonStr, { headers : { 'Content-Type' : 'application/json' } }),
        jsonStr
    );
}

function buildPlainResponse( body: string | null, requestId: string | undefined, options?: ExecuteOptions, hasMiddlewareBag?: boolean ): Response
{
    const id = options?.requestId ?? requestId;

    if( !hasMiddlewareBag && options?.baseHeadersTemplate && id )
    {
        const res = new Response( body, { headers : options.baseHeadersTemplate });
        res.headers.set( 'x-request-id', id );
        ( res as any )[DIRECT_RESPONSE_BODY] = body;
        ( res as any )[FINALIZED_RESPONSE] = true;

        return res;
    }

    return tagDirectResponse( new Response( body ), body );
}

/** Truncate a WebSocket close reason to RFC 6455's 123 UTF-8 byte limit without splitting code points. */
export function truncateWsReason( reason: string, maxBytes = 123 ): string
{
    if( Buffer.byteLength( reason, 'utf8' ) <= maxBytes )
    {
        return reason;
    }

    let out = '';
    let used = 0;

    for( const ch of reason )
    {
        const chBytes = Buffer.byteLength( ch, 'utf8' );

        if( used + chBytes > maxBytes )
        {
            break;
        }

        out += ch;
        used += chBytes;
    }

    return out;
}

function sanitizeSseHeaderField( value: unknown ): string
{
    return String( value ).replace( /[\r\n]+/g, ' ' );
}

function appendSseDataLines( sseString: string, dataStr: string ): string
{
    if( dataStr.indexOf( '\n' ) === -1 && dataStr.indexOf( '\r' ) === -1 )
    {
        return `${sseString}data: ${dataStr}\n\n`;
    }

    const lines = dataStr.split( /\r\n|\r|\n/ );
    let out = sseString;

    for( let i = 0; i < lines.length; i++ )
    {
        out += `data: ${lines[i]}\n`;
    }

    return `${out}\n`;
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
        if( req.isAborted )
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

            if( chunk.event !== undefined && chunk.event !== null )
            {
                sseString += `event: ${sanitizeSseHeaderField( chunk.event )}\n`;
            }

            if( chunk.id !== undefined && chunk.id !== null )
            {
                sseString += `id: ${sanitizeSseHeaderField( chunk.id )}\n`;
            }

            if( chunk.retry !== undefined && chunk.retry !== null )
            {
                const retryNum = Math.trunc( Number( chunk.retry ));

                if( Number.isFinite( retryNum ) && retryNum >= 0 )
                {
                    sseString += `retry: ${retryNum}\n`;
                }
            }

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

            return appendSseDataLines( sseString, dataStr );
        }

        if( serializer )
        {
            return appendSseDataLines( '', serializer( chunk ));
        }

        return appendSseDataLines( '', String( chunk ));
    }

    private static extractSyncParamRaw(
        p: ParamMetadata,
        sreq: ServerRequest,
        ws?: any,
        responseBag?: ServerResponse
    ): any
    {
        switch ( p.source )
        {
            case 'Param': return sreq.getParam( p.name! );
            case 'Query': {
                if( p.name )
                {
                    return Object.hasOwn( sreq.query, p.name ) ? sreq.query[p.name] : undefined;
                }

                if( p.parser || p.parserQuery )
                {
                    return sreq.queryString;
                }

                return { ...sreq.query };
            }
            case 'Header': return sreq.header( p.name! );
            case 'Headers': return { ...sreq.headers };
            case 'Request': return sreq;
            case 'Response': return responseBag;
            case 'Ip': return sreq.ip;
            case 'Url': return sreq.url;
            case 'Hostname': return sreq.hostname;
            case 'Path': return sreq.path;
            case 'Context': return Context.get();
            case 'WebSocket': return ws;
            case 'Peer': return sreq.peer;
            case 'Cookies': return { ...sreq.cookies };
            case 'Cookie': return p.name ? sreq.cookie( p.name ) : { ...sreq.cookies };
            default: return undefined;
        }
    }

    private static finalizeParamValue(
        p: ParamMetadata,
        val: any,
        sreq: ServerRequest,
        ctx: any,
        bodyIsPreparsed: boolean
    ): any
    {
        const isBody = p.source === 'Body';

        if( p.optional && !isBody && ( val === undefined || val === null ))
        {
            return undefined;
        }

        if( p.optional && isBody && Boolean( p.name ) && val === undefined )
        {
            return undefined;
        }

        const bodyContentType = isBody ? sreq.effectiveContentType : null;
        const bodyIsMultipart = isBody && isMultipartContentType( bodyContentType );
        const bodyIsUrlencoded = isBody && bodyContentType === 'application/x-www-form-urlencoded';

        // parse() is wire text only. Objects (multipart, forward merge, header/cookie maps)
        // and already-structured pre-cached bodies stay on the assert/validator channel.
        const canParse = !bodyIsMultipart
            && !bodyIsPreparsed
            && !( isBody && sreq.forwardBody !== undefined )
            && !( isBody && Boolean( p.name ))
            && ( p.parser || p.parserQuery )
            && ( typeof val === 'string' || ( !isBody && ( val === undefined || val === null )));

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
                    const parsed = parserFn( val, parseArg as any );

                    // Cache validated body so a later body() call does not re-parse.
                    if( isBody && !sreq.hasCachedBody )
                    {
                        sreq.cacheParsedBody( parsed );
                    }

                    return parsed;
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
            }
        }

        // Scalar wire parameters compiled with `parser` only (no fallback `validator`) MUST not
        // pass non-string arrays/objects (e.g. `?id=1&id=2` or `?id[a]=b`) through unvalidated.
        if(
            !isBody
            && ( p.parser || p.parserQuery )
            && !p.validator
            && val !== undefined
            && val !== null
            && typeof val !== 'string'
        )
        {
            ctx.success = false;
            ctx.errors.push({
                path  : getParamLabel( p ),
                error : 'expected string'
            });

            return val;
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
            else if( isBody )
            {
                ctx.from = ( bodyIsUrlencoded || bodyIsMultipart ) ? 'query' : 'json';
            }

            const validated = p.validator( val, getParamLabel( p ), ctx );

            ctx.mode = oldMode;
            ctx.from = oldFrom;

            return validated;
        }

        return val;
    }

    public static resolveParamsSync(
        metadata: EndpointMetadata,
        sreq: ServerRequest,
        ctx: { success : boolean, errors : any[], mode : string },
        ws?: any,
        responseBag?: ServerResponse
    ): any[]
    {
        const params = metadata.params;
        const len = params.length;

        if( len === 0 ){ return EMPTY_ARGS }

        if( len === 1 )
        {
            const p0 = params[0];
            this.throwIfAborted( sreq );

            return [
                this.finalizeParamValue(
                    p0,
                    this.extractSyncParamRaw( p0, sreq, ws, responseBag ),
                    sreq,
                    ctx,
                    false
                )
            ];
        }

        const args = new Array( len );

        for( let i = 0; i < len; i++ )
        {
            const p = params[i];
            this.throwIfAborted( sreq );
            args[i] = this.finalizeParamValue(
                p,
                this.extractSyncParamRaw( p, sreq, ws, responseBag ),
                sreq,
                ctx,
                false
            );
        }

        return args;
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
        const sreq = req instanceof ServerRequest ? req : ServerRequest.from( req, { security : securityConfig });

        if( securityConfig !== undefined && sreq.securityOptions === undefined )
        {
            sreq.securityOptions = securityConfig;
        }

        this.throwIfAborted( sreq );

        const bodyIsPreparsed = p.source === 'Body' && sreq.hasCachedBody;
        let val: any;

        switch ( p.source ) 
        {
            case 'Body': {
                if( p.name )
                {
                    let bodyObj: any;

                    if( isMultipartContentType( sreq.effectiveContentType ))
                    {
                        const payload = await sreq.payload();
                        bodyObj = payload.toObject( sreq.reviver );
                    }
                    else
                    {
                        bodyObj = await sreq.body( securityConfig );
                    }

                    if( sreq.forwardBody !== undefined )
                    {
                        if( sreq.forwardBody !== null && typeof sreq.forwardBody === 'object' && !Array.isArray( sreq.forwardBody ))
                        {
                            if( bodyObj && typeof bodyObj === 'object' && !Array.isArray( bodyObj ))
                            {
                                bodyObj = { ...bodyObj, ...sreq.forwardBody };
                            }
                            else if( bodyObj === undefined || bodyObj === null )
                            {
                                bodyObj = { ...sreq.forwardBody };
                            }
                        }
                        else
                        {
                            bodyObj = sreq.forwardBody;
                        }
                    }

                    val = ( bodyObj && typeof bodyObj === 'object' && !Array.isArray( bodyObj ) && Object.hasOwn( bodyObj, p.name ))
                        ? bodyObj[p.name]
                        : undefined;
                    break;
                }

                const hasForwardBody = sreq.forwardBody !== undefined;
                const forwardIsPlainObj = hasForwardBody
                    && sreq.forwardBody !== null
                    && typeof sreq.forwardBody === 'object'
                    && !Array.isArray( sreq.forwardBody );

                if( hasForwardBody && !forwardIsPlainObj )
                {
                    val = sreq.forwardBody;
                }
                else if( isMultipartContentType( sreq.effectiveContentType ))
                {
                    const payload = await sreq.payload();
                    // Query-shaped bag: text fields + UploadedFile / UploadedFile[].
                    // Validated below via assert-style validator with from: 'query'.
                    val = payload.toObject( sreq.reviver );
                }
                else if( p.parserQuery || p.parser )
                {
                    // Typed urlencoded / JSON: single-pass wire text → one parse(text).
                    // With forwardBody, structurally parse once, merge, then assert (not parse).
                    const wire = await sreq.tryGetWireText( securityConfig );

                    if( wire !== undefined )
                    {
                        if( wire.kind === 'urlencoded' )
                        {
                            val = forwardIsPlainObj
                                ? { ...parseAnyQuery( wire.text, sreq.reviver ), ...sreq.forwardBody }
                                : wire.text;
                        }
                        else
                        {
                            val = forwardIsPlainObj
                                ? { ...parseAnyJson( wire.text, sreq.reviver ), ...sreq.forwardBody }
                                : wire.text;
                        }
                    }
                    else
                    {
                        val = await sreq.body( securityConfig );
                    }
                }
                else
                {
                    val = await sreq.body( securityConfig );
                }

                // Object bags (JSON / multipart / merged urlencoded): apply forwardBody before validate.
                // Raw urlencoded text (no forwardBody) stays a string for parserQuery.
                if( forwardIsPlainObj && val && typeof val === 'object' && !Array.isArray( val ))
                {
                    val = { ...val, ...sreq.forwardBody };
                }
                else if( forwardIsPlainObj && ( val === undefined || val === null ))
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
            case 'Inject': val = await getRegistry().getInjectable( p.name!, contextModule ); break;
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
            default: {
                val = this.extractSyncParamRaw( p, sreq, ws, responseBag );
                break;
            }
        }

        return this.finalizeParamValue( p, val, sreq, ctx, bodyIsPreparsed );
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
        if( metadata.params.length === 0 ){ return EMPTY_ARGS }

        const args: any[] = [];

        for( const p of metadata.params )
        {
            if( ASYNC_PARAM_SOURCES.has( p.source ))
            {
                args.push( await this.resolveParam( p, sreq, ctx, securityConfig, controllerModule, ws, responseBag ));
            }
            else
            {
                this.throwIfAborted( sreq );
                args.push( this.finalizeParamValue(
                    p,
                    this.extractSyncParamRaw( p, sreq, ws, responseBag ),
                    sreq,
                    ctx,
                    false
                ));
            }
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

    private static serializeEndpointResult(
        result: any,
        metadata: EndpointMetadata,
        plan: EndpointPlan,
        sreq: ServerRequest,
        registry: ApplicationRegistry,
        requestCtx: RequestContext,
        middlewareResponse: ServerResponse | undefined,
        options?: ExecuteOptions
    ): Response
    {
        this.throwIfAborted( sreq );

        const isPlainObjectOrArray = typeof result === 'object'
            && result !== null
            && (
                ( result.constructor === Object && typeof ( result as Record<string, unknown> ).pipe !== 'function' )
                || Array.isArray( result )
            );

        if( !isPlainObjectOrArray || plan.isSeo || middlewareResponse?.pendingForward )
        {
            const pending =
                ( result instanceof ServerResponse ? result.pendingForward : undefined )
                || middlewareResponse?.pendingForward;

            if( plan.isSeo )
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

            if( streamOrBinary !== undefined )
            {
                const binRes = new Response( streamOrBinary );

                if( streamOrBinary instanceof Uint8Array )
                {
                    tagDirectResponse( binRes, streamOrBinary );
                }

                return binRes;
            }
        }

        const branchSerializer = ( typeof result === 'object' && result !== null )
            ? ( requestCtx.branchSerializers?.get( result )
                ?? ( hasFallbackBranchSerializers() ? getBranchSerializers().get( result ) : undefined ))
            : undefined;
        const activeSerializer = branchSerializer
            || ( typeof metadata.returnTypeSerializer === 'function' ? metadata.returnTypeSerializer : undefined );
        const blockPreFinalize = middlewareResponse !== undefined || plan.reversedInterceptors.length > 0;
        const reqId = requestCtx.requestId ?? sreq.requestID;

        if( typeof activeSerializer === 'function' )
        {
            try
            {
                return buildJsonResponse( activeSerializer( result ), reqId, options, blockPreFinalize );
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
            return buildJsonResponse( JSON.stringify( validatedResult ), reqId, options, blockPreFinalize );
        }

        if( validatedResult == null && middlewareResponse && isNullBodyStatus( middlewareResponse.status()))
        {
            return buildPlainResponse( null, reqId, options, blockPreFinalize );
        }

        return buildPlainResponse( validatedResult == null ? '' : String( validatedResult ), reqId, options, blockPreFinalize );
    }

    private static async handleExecuteError(
        err: any,
        sreq: ServerRequest,
        middlewareResponse: ServerResponse | undefined,
        options?: ExecuteOptions
    ): Promise<Response>
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
        options?.onError?.( err, status, sreq.requestID );

        const errHeaders: Record<string, string> = { 'Content-Type' : 'application/json' };

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
                    if( typeof value === 'string' )
                    {
                        errHeaders[key] = value;
                    }
                }
            }
        }

        const exposeErrors = options !== undefined ? Boolean( options.exposeErrors ) : true;
        const errBody = JSON.stringify( clientErrorBody( err, status, exposeErrors ));
        const response = tagDirectResponse( new Response( errBody, {
            status,
            headers : errHeaders
        }), errBody );

        return middlewareResponse ? middlewareResponse.applyTo( response ) : response;
    }

    private static async finishFastAsync(
        rawPromise: PromiseLike<any>,
        metadata: EndpointMetadata,
        plan: EndpointPlan,
        sreq: ServerRequest,
        registry: ApplicationRegistry,
        requestCtx: RequestContext,
        middlewareResponse: ServerResponse | undefined,
        options?: ExecuteOptions
    ): Promise<Response>
    {
        try
        {
            const resolved = await rawPromise;

            return Context.run( requestCtx, () =>
            {
                const outResponse = this.serializeEndpointResult(
                    resolved,
                    metadata,
                    plan,
                    sreq,
                    registry,
                    requestCtx,
                    middlewareResponse,
                    options
                );

                return middlewareResponse ? middlewareResponse.applyTo( outResponse ) : outResponse;
            });
        }
        catch( err: any )
        {
            return await this.handleExecuteError( err, sreq, middlewareResponse, options );
        }
        finally
        {
            if( requestCtx.requestInstances?.size )
            {
                await this.cleanupRequestContext( requestCtx );
            }
        }
    }

    private static async finishFastError(
        err: any,
        sreq: ServerRequest,
        requestCtx: RequestContext,
        middlewareResponse: ServerResponse | undefined,
        options?: ExecuteOptions
    ): Promise<Response>
    {
        try
        {
            return await this.handleExecuteError( err, sreq, middlewareResponse, options );
        }
        finally
        {
            if( requestCtx.requestInstances?.size )
            {
                await this.cleanupRequestContext( requestCtx );
            }
        }
    }

    /**
     * Internal dispatcher returning a direct `Response` when the entire endpoint pipeline
     * completes synchronously, or a `Promise<Response>` when any step is asynchronous.
     */
    public static executeInternal(
        metadata: EndpointMetadata,
        req: ServerRequest | Request,
        securityConfig?: SecurityOptions,
        registryArg?: ApplicationRegistry,
        options?: ExecuteOptions
    ): Response | Promise<Response>
    {
        const sreq = req instanceof ServerRequest ? req : ServerRequest.from( req, { security : securityConfig });
        sreq.securityOptions = securityConfig;

        const registry = registryArg ?? getRegistry();
        const plan = getEndpointPlan( registry, metadata );
        const requestCtx: RequestContext = {
            request   : sreq,
            metadata,
            requestId : sreq.requestID,
            registry
        };

        if(
            plan.singletonController !== undefined
            && !plan.hasMiddlewares
            && !plan.hasGuards
            && plan.reversedInterceptors.length === 0
            && !plan.hasAsyncParams
            && !plan.isSse
        )
        {
            return Context.run( requestCtx, (): Response | Promise<Response> =>
            {
                const controller = plan.singletonController;

                if( metadata.reviver !== undefined || plan.moduleReviver !== undefined || sreq.globalReviver !== undefined )
                {
                    sreq.reviver = resolveReviver( metadata.reviver, plan.moduleReviver, sreq.globalReviver );
                }

                if( sreq.globalFiles !== undefined || plan.moduleFiles !== undefined || sreq.routeFiles !== undefined )
                {
                    sreq.fileOptions = resolveRequestFileOptions( sreq, plan.moduleFiles );
                }

                const middlewareResponse = plan.needsResponseInParams ? new ServerResponse() : undefined;

                try
                {
                    this.throwIfAborted( sreq );

                    const paramCount = metadata.params.length;
                    let rawResult: any;

                    if( paramCount === 0 )
                    {
                        rawResult = controller[metadata.methodName]();
                    }
                    else
                    {
                        const ctx = { success : true, errors : [] as any[], mode : 'strict' };
                        const args = this.resolveParamsSync( metadata, sreq, ctx, undefined, middlewareResponse );

                        this.throwIfAborted( sreq );

                        if( !ctx.success )
                        {
                            const badBody = JSON.stringify({
                                success : false,
                                message : 'request validation failed',
                                errors  : ctx.errors
                            });
                            const badRes = tagDirectResponse( new Response( badBody, {
                                status  : 400,
                                headers : { 'Content-Type' : 'application/json' }
                            }), badBody );
                            const applied = middlewareResponse ? middlewareResponse.applyTo( badRes ) : badRes;

                            if( requestCtx.requestInstances?.size )
                            {
                                return this.cleanupRequestContext( requestCtx ).then(() => applied );
                            }

                            return applied;
                        }

                        rawResult = paramCount === 1
                            ? controller[metadata.methodName]( args[0])
                            : ( paramCount === 2
                                ? controller[metadata.methodName]( args[0], args[1])
                                : controller[metadata.methodName]( ...args ));
                    }

                    if( isPromiseLike( rawResult ))
                    {
                        return this.finishFastAsync(
                            rawResult,
                            metadata,
                            plan,
                            sreq,
                            registry,
                            requestCtx,
                            middlewareResponse,
                            options
                        );
                    }

                    const outResponse = this.serializeEndpointResult(
                        rawResult,
                        metadata,
                        plan,
                        sreq,
                        registry,
                        requestCtx,
                        middlewareResponse,
                        options
                    );
                    const finalOut = middlewareResponse ? middlewareResponse.applyTo( outResponse ) : outResponse;

                    if( requestCtx.requestInstances?.size )
                    {
                        return this.cleanupRequestContext( requestCtx ).then(() => finalOut );
                    }

                    return finalOut;
                }
                catch( err: any )
                {
                    if(( err instanceof SeoFallthrough || err instanceof ForwardIntent ) && !requestCtx.requestInstances?.size )
                    {
                        throw err;
                    }

                    return this.finishFastError( err, sreq, requestCtx, middlewareResponse, options );
                }
            });
        }

        return this.executeFullAsync( metadata, sreq, plan, registry, requestCtx, securityConfig, options );
    }

    public static execute(
        metadata: EndpointMetadata,
        req: ServerRequest | Request,
        securityConfig?: SecurityOptions,
        registryArg?: ApplicationRegistry,
        options?: ExecuteOptions
    ): Promise<Response> 
    {
        try
        {
            const res = this.executeInternal( metadata, req, securityConfig, registryArg, options );

            return res instanceof Promise ? res : Promise.resolve( res );
        }
        catch( err )
        {
            return Promise.reject( err );
        }
    }

    private static executeFullAsync(
        metadata: EndpointMetadata,
        sreq: ServerRequest,
        plan: EndpointPlan,
        registry: ApplicationRegistry,
        requestCtx: RequestContext,
        securityConfig?: SecurityOptions,
        options?: ExecuteOptions
    ): Promise<Response>
    {
        return Context.run( requestCtx, async () => 
        {
            const { controllerModule } = plan;
            const controller = plan.singletonController ?? await this.resolveController( plan, metadata, registry );

            if( !controller ) { throw new Error( `Controller ${metadata.controller} not registered` ) }

            if( metadata.reviver !== undefined || plan.moduleReviver !== undefined || sreq.globalReviver !== undefined )
            {
                sreq.reviver = resolveReviver(
                    metadata.reviver,
                    plan.moduleReviver,
                    sreq.globalReviver
                );
            }

            const ctx = { success : true, errors : [] as any[], mode : 'strict' };
            let deferContextCleanup = false;
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
                const paramCount = metadata.params.length;

                if( paramCount === 0 )
                {
                    const raw = controller[metadata.methodName]();
                    result = isPromiseLike( raw ) ? await raw : raw;
                }
                else
                {
                    const args = plan.hasAsyncParams
                        ? await this.resolveParams(
                            metadata,
                            sreq,
                            ctx,
                            securityConfig,
                            controllerModule,
                            undefined,
                            middlewareResponse
                        )
                        : this.resolveParamsSync( metadata, sreq, ctx, undefined, middlewareResponse );

                    this.throwIfAborted( sreq );

                    if( !ctx.success ) 
                    {
                        await sreq.cleanupDiskUploads();

                        const badBody = JSON.stringify({
                            success : false,
                            message : 'request validation failed',
                            errors  : ctx.errors
                        });

                        return tagDirectResponse( new Response( badBody, { 
                            status  : 400,
                            headers : { 'Content-Type' : 'application/json' }
                        }), badBody );
                    }

                    const raw = paramCount === 1
                        ? controller[metadata.methodName]( args[0])
                        : ( paramCount === 2
                            ? controller[metadata.methodName]( args[0], args[1])
                            : controller[metadata.methodName]( ...args ));
                    result = isPromiseLike( raw ) ? await raw : raw;
                }

                if( plan.isSse ) 
                {
                    this.throwIfAborted( sreq );

                    const pending =
                        ( result instanceof ServerResponse ? result.pendingForward : undefined )
                        || middlewareResponse?.pendingForward;

                    if( pending )
                    {
                        this.assertForwardCompatible( middlewareResponse, result );

                        throw new ForwardIntent( pending );
                    }

                    if( result instanceof ServerResponse )
                    {
                        return result.toResponse();
                    }

                    if( result instanceof Response ) { return result }

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
                        const iterator = result[Symbol.asyncIterator]();
                        let streamClosed = false;
                        let cleanedUp = false;
                        deferContextCleanup = true;

                        const finalizeSseContext = async () =>
                        {
                            if( cleanedUp ){ return }
                            cleanedUp = true;

                            if( requestCtx.requestInstances?.size )
                            {
                                await RequestProcessor.cleanupRequestContext( requestCtx );
                            }
                        };

                        const closeIterator = async () =>
                        {
                            streamClosed = true;

                            if( typeof iterator.return === 'function' )
                            {
                                try { await iterator.return() }
                                catch{ /* ignore generator teardown errors on cancel */ }
                            }

                            await finalizeSseContext();
                        };

                        const onAbort = () =>
                        {
                            void closeIterator();
                        };

                        sreq.signal?.addEventListener( 'abort', onAbort, { once : true });

                        bodyStream = new ReadableStream({
                            async start( controller ) 
                            {
                                try 
                                {
                                    while( !streamClosed )
                                    {
                                        const step = await Context.run( requestCtx, () => iterator.next());

                                        if( step.done || streamClosed )
                                        {
                                            break;
                                        }

                                        const chunk = step.value;

                                        try 
                                        {
                                            const payload = serializer
                                                ? chunk
                                                : RequestProcessor.validateSseChunk( chunk, validator, mode );
                                            const encoded = encoder.encode( RequestProcessor.formatSseChunk( payload, serializer ));

                                            if( !streamClosed )
                                            {
                                                controller.enqueue( encoded );
                                            }
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

                                    if( !streamClosed )
                                    {
                                        streamClosed = true;
                                        controller.close();
                                    }
                                }
                                catch ( err ) 
                                {
                                    if( !streamClosed )
                                    {
                                        streamClosed = true;
                                        controller.error( err );
                                    }
                                }
                                finally
                                {
                                    sreq.signal?.removeEventListener( 'abort', onAbort );
                                    await finalizeSseContext();
                                }
                            },
                            async cancel()
                            {
                                sreq.signal?.removeEventListener( 'abort', onAbort );
                                await closeIterator();
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

                return this.serializeEndpointResult(
                    result,
                    metadata,
                    plan,
                    sreq,
                    registry,
                    requestCtx,
                    middlewareResponse,
                    options
                );
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
                deferContextCleanup = false;

                return await this.handleExecuteError( err, sreq, middlewareResponse, options );
            }
            finally
            {
                if( !deferContextCleanup && requestCtx.requestInstances?.size )
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
        const maskErrors = Boolean(( req as any )?.__wsMaskErrors );

        void this.executeWs( metadata, ws, req ).catch(( err: any ) =>
        {
            try
            {
                const rawReason = ( maskErrors && httpStatusFromError( err ) >= 500 )
                    ? 'Internal server error'
                    : ( err?.message || 'Internal WS Handler Error' );
                ws.close( 1011, truncateWsReason( rawReason ));
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
        const maskErrors = Boolean(( req as any )?.__wsMaskErrors );
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
            let deferCleanupUntilClose = false;

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
                    ws.close( 4000, truncateWsReason( JSON.stringify({ success : false, message : 'request validation failed', errors : ctx.errors })));

                    return;
                }

                const finalHandler = async () => controller[metadata.methodName]( ...args );
                const chain = plan.reversedInterceptors.length === 0
                    ? finalHandler
                    : ( plan.singletonInterceptors !== undefined
                        ? this.wrapInterceptorChain( plan.singletonInterceptors, sreq, finalHandler )
                        : await this.buildInterceptorChain( plan, registry, sreq, finalHandler ));
                await chain();

                if( typeof ws?.on === 'function' && requestCtx.requestInstances?.size )
                {
                    deferCleanupUntilClose = true;
                    const onWsClose = () =>
                    {
                        if( typeof ws.off === 'function' )
                        {
                            ws.off( 'close', onWsClose );
                        }

                        void this.cleanupRequestContext( requestCtx );
                    };
                    ws.on( 'close', onWsClose );
                }
            }
            catch ( err: any ) 
            {
                deferCleanupUntilClose = false;

                try
                {
                    const rawReason = ( maskErrors && httpStatusFromError( err ) >= 500 )
                        ? 'Internal server error'
                        : ( err.message || 'Internal WS Handler Error' );
                    ws.close( 4001, truncateWsReason( rawReason ));
                }
                catch
                {
                    // ignore secondary close failures
                }
            }
            finally
            {
                // Flush any early WebSocket frames buffered while async setup was running.
                if( typeof ws?.flushBufferedMessages === 'function' )
                {
                    ws.flushBufferedMessages();
                }

                if( !deferCleanupUntilClose )
                {
                    await this.cleanupRequestContext( requestCtx );
                }
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

                // 2. Wrap parameter resolution + handler execution inside Interceptor Chain (parity with HTTP)
                const finalHandler = async () => 
                {
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

                    if( typeof metadata.returnTypeSerializer === 'function' )
                    {
                        try
                        {
                            return JSON.parse( metadata.returnTypeSerializer( result ));
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
