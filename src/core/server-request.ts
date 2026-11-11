import { parseQueryString } from '@webergency-utils/typechecker/runtime';
import { Context, type RequestContext } from './context.js';
import { EMPTY_PARAMS } from './router.js';
import { PeerCert } from './types.js';
import { SecurityOptions } from '../decorators.js';
import
{
    DEFAULT_MAX_BODY_BYTES,
    DEFAULT_MAX_BODY_SIZE,
    decodeBodyText,
    getContentType,
    getContentTypeCharset,
    isJsonContentType,
    isMultipartContentType,
    looksLikeUrlEncoded,
    parseContentLength,
    readRawBody,
    requestLikelyHasBody,
    resolveBodyLimit,
    sniffBody,
    unsupportedMediaType
}
    from '../helpers/request-reader.js';
import { compileTrustProxy, resolveClientIp, type CompiledTrustProxy, type TrustProxy } from '../helpers/client-ip.js';
import { parseSize } from '../helpers/security.js';
import { pathnameFromUrl, queryStringFromUrl } from '../helpers/query-string.js';
import { parseAnyJson, parseAnyQuery, type Reviver } from '../helpers/reviver.js';
import
{
    cleanupUploadedFiles,
    DEFAULT_MAX_FILE_BYTES,
    DEFAULT_MAX_FIELD_BYTES,
    mergeFileConfigs,
    processMultipartUpload,
    resolveMultipartTotalLimit,
    type FileOptions,
    type MultipartParseResult,
    UploadedFile,
    MultipartPayload
}
    from '../helpers/file-upload.js';

export interface TransportRequest extends Request
{
    remoteAddress?         : string
    clientCert?            : PeerCert
    __getDisconnectSignal? : () => AbortSignal
    __isDisconnected?      : () => boolean
}

export interface WireTextResult
{
    kind : 'json' | 'urlencoded'
    text : string
}

export interface ServerRequestInit extends SecurityOptions
{
    params?             : Record<string, string>
    query?              : Record<string, string>
    queryString?        : string
    requestId?          : string
    remoteAddress?      : string
    trustProxy?         : TrustProxy | boolean
    compiledTrustProxy? : CompiledTrustProxy | null
    peer?               : PeerCert
    signal?             : AbortSignal
    security?           : SecurityOptions
    globalFiles?        : FileOptions
    routeFiles?         : FileOptions
    files?              : FileOptions
    globalReviver?      : Reviver | null
    reviver?            : Reviver
    forwardBody?        : Record<string, unknown>
    hasJson?            : boolean
    json?               : unknown
    preParsedBody?      : unknown
    raw?                : ArrayBuffer
    preReadRaw?         : ArrayBuffer
}

const requestFacadeMap = new WeakMap<object, ServerRequest>();

function hasDirectSecurityOption( obj: ServerRequestInit ): boolean
{
    return obj.maxBodySize !== undefined
        || obj.timeout !== undefined
        || obj.rateLimit !== undefined
        || obj.allowedContentTypes !== undefined
        || obj.allowedHosts !== undefined
        || obj.hsts !== undefined
        || obj.frameguard !== undefined
        || obj.noSniff !== undefined
        || obj.downloadOptions !== undefined
        || obj.permittedCrossDomainPolicies !== undefined
        || obj.referrerPolicy !== undefined
        || obj.xssFilter !== undefined
        || obj.csp !== undefined
        || obj.coep !== undefined
        || obj.coop !== undefined
        || obj.corp !== undefined
        || obj.permissionsPolicy !== undefined
        || ( obj as any ).csrf !== undefined
        || ( obj as any ).xss !== undefined
        || ( obj as any ).contentSecurityPolicy !== undefined
        || ( obj as any ).frameOptions !== undefined;
}

/**
 * Sealed request carrier and facade for controllers, middleware, guards, and interceptors.
 * Not a Fetch `Request`. Wire bags (`headers`, `cookies`, `query`, `params`) are always strings.
 */
export class ServerRequest
{
    #req                 : Request;
    #url?                : URL;
    #path?               : string;
    #params?             : Record<string, string>;
    #queryString?        : string;
    #query?              : Record<string, string>;
    #requestId?          : string;
    #remoteAddress?      : string;
    #trustProxy?         : TrustProxy | boolean;
    #compiledTrustProxy  : CompiledTrustProxy | null | undefined;
    #ip?                 : string;
    #peer?               : PeerCert;
    #signal?             : AbortSignal;
    #useReqSignal        = false;
    #security            : SecurityOptions | undefined;
    #globalFiles?        : FileOptions;
    #routeFiles?         : FileOptions;
    #files               : FileOptions | undefined;
    #globalReviver?      : Reviver | null;
    #reviver?            : Reviver;
    #forwardStack?       : string[];
    #forwardBody?        : Record<string, unknown>;
    #headers?            : Record<string, string>;
    #cookies?            : Record<string, string>;
    #raw?                : ArrayBuffer;
    #hasJson             = false;
    #json?               : unknown;
    #declaredContentType : string | null | undefined;
    #bodyContentType?    : 'application/json' | 'application/x-www-form-urlencoded';
    #form?               : FormData;
    #multipart?          : MultipartParseResult;
    #payload?            : MultipartPayload;
    #bodyMode?           : 'raw' | 'text' | 'form' | 'stream' | 'multipart';

    constructor(
        req             : Request,
        securityOrInit? : ServerRequestInit,
        files?          : FileOptions,
        init?           : ServerRequestInit
    )
    {
        this.#req = req;

        const opts: ServerRequestInit | undefined = init !== undefined
            ? { ...securityOrInit, ...init }
            : securityOrInit;

        if( opts === undefined )
        {
            this.#security = undefined;
            this.#files = files;
            this.#routeFiles = files;
        }
        else
        {
            const securityFromArg = (
                securityOrInit !== undefined
                && opts.security === undefined
                && hasDirectSecurityOption( securityOrInit )
            )
                ? ( securityOrInit as SecurityOptions )
                : undefined;

            this.#security = opts.security ?? securityFromArg;
            this.#globalFiles = opts.globalFiles;
            this.#routeFiles = opts.routeFiles ?? opts.files ?? files;
            const directFiles = files ?? ( typeof opts.files === 'object' ? opts.files : undefined );
            this.#files = directFiles ?? (
                ( this.#globalFiles !== undefined || this.#routeFiles !== undefined )
                    ? mergeFileConfigs([ this.#globalFiles, this.#routeFiles ])
                    : undefined
            );
            this.#params = opts.params === EMPTY_PARAMS ? undefined : opts.params;
            this.#queryString = opts.queryString;
            this.#query = opts.query;
            this.#requestId = opts.requestId;
            this.#remoteAddress = opts.remoteAddress;
            this.#trustProxy = opts.trustProxy;
            this.#compiledTrustProxy = opts.compiledTrustProxy;
            this.#peer = opts.peer;
            this.#signal = opts.signal;
            this.#globalReviver = opts.globalReviver;
            this.#reviver = opts.reviver;
            this.#forwardBody = opts.forwardBody;

            if( opts.hasJson || opts.json !== undefined || opts.preParsedBody !== undefined || 'json' in opts || 'preParsedBody' in opts )
            {
                this.#hasJson = true;
                this.#json = 'preParsedBody' in opts ? opts.preParsedBody : opts.json;
            }

            if( opts.raw !== undefined || opts.preReadRaw !== undefined )
            {
                this.#raw = opts.preReadRaw ?? opts.raw;
            }
        }

        if( req && typeof req === 'object' && !requestFacadeMap.has( req ))
        {
            requestFacadeMap.set( req, this );
        }
    }

    /** Fast internal factory used by `Server.handleFetch` to avoid allocating an options object on every request. */
    static createInternal(
        req                : Request,
        requestId          : string,
        trustProxy         : TrustProxy | boolean | undefined,
        compiledTrustProxy : CompiledTrustProxy | null | undefined,
        globalFiles        : FileOptions | undefined,
        globalReviver      : Reviver | null | undefined
    ): ServerRequest
    {
        const sreq = new ServerRequest( req );
        sreq.#requestId = requestId;
        sreq.#trustProxy = trustProxy;
        sreq.#compiledTrustProxy = compiledTrustProxy;
        sreq.#globalFiles = globalFiles;
        sreq.#files = globalFiles;
        sreq.#globalReviver = globalReviver;
        sreq.#useReqSignal = !( req as TransportRequest ).__getDisconnectSignal;

        return sreq;
    }

    static from(
        req             : ServerRequest | Request,
        securityOrInit? : ServerRequestInit,
        files?          : FileOptions,
        init?           : ServerRequestInit
    ): ServerRequest
    {
        const existing = req instanceof ServerRequest
            ? req
            : (( req && typeof req === 'object' ) ? requestFacadeMap.get( req ) : undefined );

        if( existing )
        {
            if( securityOrInit !== undefined && existing.#security === undefined )
            {
                const resolvedSec = 'security' in securityOrInit
                    ? securityOrInit.security
                    : ( hasDirectSecurityOption( securityOrInit ) ? ( securityOrInit as SecurityOptions ) : undefined );

                if( resolvedSec !== undefined )
                {
                    existing.#security = resolvedSec;
                }
            }

            if( files !== undefined && existing.#files === undefined )
            {
                existing.#files = files;
            }

            return existing;
        }

        return new ServerRequest( req as Request, securityOrInit, files, init );
    }

    #getUrl(): URL
    {
        return this.#url ?? ( this.#url = new URL( this.#req.url ));
    }

    get method(): string
    {
        return this.#req.method;
    }

    get url(): string
    {
        return this.#req.url;
    }

    get path(): string
    {
        return this.#path ?? ( this.#path = pathnameFromUrl( this.#req.url ));
    }

    get hostname(): string
    {
        return this.#getUrl().hostname;
    }

    get remoteAddress(): string | undefined
    {
        return this.#remoteAddress ?? ( this.#req as TransportRequest ).remoteAddress;
    }

    set remoteAddress( val: string | undefined )
    {
        this.#remoteAddress = val;
        this.#ip = undefined;
    }

    set trustProxy( val: TrustProxy | boolean | undefined )
    {
        this.#trustProxy = val;
        this.#compiledTrustProxy = compileTrustProxy( val );
        this.#ip = undefined;
    }

    get ip(): string
    {
        if( this.#ip !== undefined )
        {
            return this.#ip;
        }

        this.#ip = resolveClientIp({
            headers            : this.#req.headers,
            remoteAddress      : this.remoteAddress,
            trustProxy         : this.#trustProxy,
            compiledTrustProxy : this.#compiledTrustProxy
        });

        return this.#ip;
    }

    get requestID(): string | undefined
    {
        return this.#requestId;
    }

    /** Single header lookup without materializing the full string map. */
    header( name: string ): string | null
    {
        return this.#req.headers.get( name );
    }

    /** Wire headers as a string map (cached). Not mutated by typed `@Headers` parsers. */
    get headers(): Record<string, string>
    {
        if( !this.#headers )
        {
            if( typeof this.#req.headers.forEach === 'function' )
            {
                const map: Record<string, string> = {};
                this.#req.headers.forEach(( val, key ) =>
                {
                    map[key] = val;
                });
                this.#headers = map;
            }
            else
            {
                this.#headers = Object.fromEntries( this.#req.headers.entries());
            }
        }

        return this.#headers;
    }

    /** Single cookie lookup (first-match-wins per RFC 6265). */
    cookie( name: string ): string | undefined
    {
        return Object.hasOwn( this.cookies, name ) ? this.cookies[name] : undefined;
    }

    /** Wire cookies as a string map (cached). Not mutated by typed `@Cookies` parsers. */
    get cookies(): Record<string, string>
    {
        if( !this.#cookies )
        {
            this.#cookies = parseCookieHeader( this.#req.headers.get( 'cookie' ));
        }

        return this.#cookies;
    }

    get params(): Record<string, string>
    {
        return this.#params ?? ( this.#params = Object.create( null ) as Record<string, string> );
    }

    set params( val: Record<string, string> )
    {
        this.#params = val === EMPTY_PARAMS ? undefined : val;
    }

    /** Fast internal parameter read without materializing an empty params bag on static routes. */
    getParam( name: string ): string | undefined
    {
        return this.#params !== undefined && Object.hasOwn( this.#params, name )
            ? this.#params[name]
            : undefined;
    }

    get queryString(): string
    {
        if( this.#queryString === undefined )
        {
            this.#queryString = queryStringFromUrl( this.#req.url );
        }

        return this.#queryString;
    }

    set queryString( val: string | undefined )
    {
        this.#queryString = val;
    }

    get query(): Record<string, string>
    {
        if( !this.#query )
        {
            this.#query = parseQueryString( this.queryString ) as Record<string, string>;
        }

        return this.#query;
    }

    set query( val: Record<string, string> )
    {
        this.#query = val;
    }

    get peer(): PeerCert | undefined
    {
        return this.#peer ?? ( this.#req as TransportRequest ).clientCert;
    }

    /** Fast boolean check for disconnect/timeout without materializing an `AbortController`. */
    get isAborted(): boolean
    {
        if( this.#signal !== undefined )
        {
            return this.#signal.aborted;
        }

        const disconnected = ( this.#req as TransportRequest ).__isDisconnected;

        if( disconnected !== undefined )
        {
            return disconnected();
        }

        if( this.#useReqSignal )
        {
            return Boolean(( this.#req as Request & { signal? : AbortSignal }).signal?.aborted );
        }

        return false;
    }

    /** AbortSignal when `security.timeout` is set or on client disconnect. */
    get signal(): AbortSignal | undefined
    {
        if( this.#signal !== undefined )
        {
            return this.#signal;
        }

        const lazyDisconnect = ( this.#req as TransportRequest ).__getDisconnectSignal;

        if( lazyDisconnect !== undefined )
        {
            this.#signal = lazyDisconnect();

            return this.#signal;
        }

        if( this.#useReqSignal )
        {
            this.#signal = ( this.#req as Request & { signal? : AbortSignal }).signal;

            return this.#signal;
        }

        return undefined;
    }

    set signal( val: AbortSignal | undefined )
    {
        this.#signal = val;
        this.#useReqSignal = false;
    }

    get context(): RequestContext | undefined
    {
        return Context.get();
    }

    get securityOptions(): SecurityOptions | undefined
    {
        return this.#security;
    }

    set securityOptions( val: SecurityOptions | undefined )
    {
        this.#security = val;
    }

    get globalFiles(): FileOptions | undefined
    {
        return this.#globalFiles;
    }

    get routeFiles(): FileOptions | undefined
    {
        return this.#routeFiles;
    }

    set routeFiles( val: FileOptions | undefined )
    {
        this.#routeFiles = val;
    }

    /** Effective upload options for this request (after hierarchical merge). */
    get fileOptions(): FileOptions | undefined
    {
        return this.#files;
    }

    set fileOptions( val: FileOptions | undefined )
    {
        this.#files = val;
    }

    get globalReviver(): Reviver | null | undefined
    {
        return this.#globalReviver;
    }

    set globalReviver( val: Reviver | null | undefined )
    {
        this.#globalReviver = val;
    }

    get reviver(): Reviver | undefined
    {
        return this.#reviver;
    }

    set reviver( val: Reviver | undefined )
    {
        this.#reviver = val;
    }

    get forwardBody(): Record<string, unknown> | undefined
    {
        return this.#forwardBody;
    }

    set forwardBody( val: Record<string, unknown> | undefined )
    {
        this.#forwardBody = val;
    }

    recordForwardHop( hopKey: string, maxDepth: number ): void
    {
        const stack = this.#forwardStack ?? ( this.#forwardStack = []);

        if( stack.includes( hopKey ))
        {
            throw Object.assign(
                new Error( `Forward cycle detected: ${[ ...stack, hopKey ].join( ' -> ' )}` ),
                { status : 500 }
            );
        }

        if( stack.length >= maxDepth )
        {
            throw Object.assign(
                new Error( `Forward depth exceeded (max ${maxDepth})` ),
                { status : 500 }
            );
        }

        stack.push( hopKey );
    }

    #getDeclaredContentType(): string | null
    {
        if( this.#declaredContentType === undefined )
        {
            this.#declaredContentType = getContentType( this.#req );
        }

        return this.#declaredContentType;
    }

    get effectiveContentType(): string | null
    {
        return this.#getDeclaredContentType() ?? this.#bodyContentType ?? null;
    }

    get likelyHasBody(): boolean
    {
        return requestLikelyHasBody( this.#req );
    }

    get hasCachedBody(): boolean
    {
        return this.#hasJson;
    }

    get cachedBody(): unknown
    {
        return this.#json;
    }

    cacheParsedBody( val: unknown ): void
    {
        this.#hasJson = true;
        this.#json = val;
    }

    async #readRaw( securityOverride?: SecurityOptions ): Promise<ArrayBuffer>
    {
        if( this.#raw !== undefined ){ return this.#raw }

        this.#raw = await readRawBody( this.#req, securityOverride ?? this.#security );

        return this.#raw;
    }

    async rawBody( securityOverride?: SecurityOptions ): Promise<ArrayBuffer>
    {
        this.#consumeBody( 'raw' );

        return this.#readRaw( securityOverride );
    }

    async text(): Promise<string>
    {
        this.#consumeBody( 'text' );
        const raw = await this.#readRaw();

        return new TextDecoder().decode( raw );
    }

    /**
     * Single-pass wire text reader for typed JSON or urlencoded `@Body` parameters.
     * Avoids double `#readRaw` awaits and triple `Content-Type` header parses on POST requests.
     */
    async tryGetWireText( securityOverride?: SecurityOptions ): Promise<WireTextResult | undefined>
    {
        if( this.#hasJson )
        {
            return undefined;
        }

        const declared = this.#getDeclaredContentType();
        const raw = await this.#readRaw( securityOverride );

        if( !raw.byteLength ){ return undefined }

        if( isJsonContentType( declared ))
        {
            return { kind : 'json', text : decodeBodyText( raw ) };
        }

        if( declared === 'application/x-www-form-urlencoded' )
        {
            return { kind : 'urlencoded', text : decodeBodyText( raw ) };
        }

        if( declared )
        {
            return undefined;
        }

        const text = decodeBodyText( raw );

        try
        {
            JSON.parse( text );
            this.#bodyContentType = 'application/json';

            return { kind : 'json', text };
        }
        catch
        {
            // fall through
        }

        if( looksLikeUrlEncoded( text ))
        {
            this.#bodyContentType = 'application/x-www-form-urlencoded';

            return { kind : 'urlencoded', text };
        }

        return undefined;
    }

    /**
     * When the body is (or sniffs as) urlencoded, return decoded wire text without
     * `parseQueryString` — for a single `parse(text, { from: 'query' })` pass.
     * Sets `#bodyContentType` when sniffing. Returns `undefined` when not urlencoded.
     */
    async tryGetUrlEncodedText( securityOverride?: SecurityOptions ): Promise<string | undefined>
    {
        if( this.#hasJson )
        {
            return undefined;
        }

        const declared = getContentType( this.#req );
        const raw = await this.#readRaw( securityOverride );

        if( !raw.byteLength ){ return undefined }

        if( declared === 'application/x-www-form-urlencoded' )
        {
            return decodeBodyText( raw );
        }

        if( declared )
        {
            return undefined;
        }

        const text = decodeBodyText( raw );

        try
        {
            JSON.parse( text );
            this.#bodyContentType = 'application/json';

            return undefined;
        }
        catch
        {
            // fall through
        }

        if( looksLikeUrlEncoded( text ))
        {
            this.#bodyContentType = 'application/x-www-form-urlencoded';

            return text;
        }

        return undefined;
    }

    /**
     * When the body is (or sniffs as) JSON, return decoded wire text without
     * `JSON.parse` — for a single `parse(text, { from: 'json' })` pass.
     * Sets `#bodyContentType` when sniffing. Returns `undefined` when not JSON.
     */
    async tryGetJsonText( securityOverride?: SecurityOptions ): Promise<string | undefined>
    {
        if( this.#hasJson )
        {
            return undefined;
        }

        const declared = getContentType( this.#req );
        const raw = await this.#readRaw( securityOverride );

        if( !raw.byteLength ){ return undefined }

        const text = decodeBodyText( raw );

        if( isJsonContentType( declared ))
        {
            return text;
        }

        if( declared )
        {
            return undefined;
        }

        try
        {
            JSON.parse( text );
            this.#bodyContentType = 'application/json';

            return text;
        }
        catch
        {
            return undefined;
        }
    }

    /**
     * Parse and cache the request body (JSON, urlencoded, text/plain, or sniffed when Content-Type is absent).
     */
    async body( securityOverride?: SecurityOptions ): Promise<any>
    {
        if( this.#hasJson ){ return this.#json }

        const raw = await this.#readRaw( securityOverride );

        if( !raw.byteLength )
        {
            this.#hasJson = true;
            this.#json = undefined;

            return undefined;
        }

        const contentType = getContentType( this.#req );
        const contentTypeHeader = this.#req.headers.get( 'content-type' );

        if( contentType === 'text/plain' )
        {
            this.#hasJson = true;
            this.#json = decodeBodyText( raw, getContentTypeCharset( contentTypeHeader ));

            return this.#json;
        }

        // JSON / urlencoded / sniff: UTF-8 (charset on those types is almost always utf-8)
        const text = decodeBodyText( raw );

        if( !contentType )
        {
            const sniffed = sniffBody( text, this.#reviver );
            this.#bodyContentType = sniffed.contentType;
            this.#hasJson = true;
            this.#json = sniffed.value;

            return this.#json;
        }

        if( contentType === 'application/x-www-form-urlencoded' )
        {
            this.#hasJson = true;
            this.#json = parseAnyQuery( text, this.#reviver );

            return this.#json;
        }

        if( isJsonContentType( contentType ))
        {
            this.#hasJson = true;
            this.#json = parseAnyJson( text, this.#reviver );

            return this.#json;
        }

        unsupportedMediaType( contentType );
    }

    /**
     * Parse multipart (or urlencoded) form data under `maxBodySize`.
     * Uses a size-capped raw read, then `Response.formData()`.
     * Prefer `uploads()` / `@File` for streaming multipart with disk storage.
     */
    async formData(): Promise<FormData>
    {
        if( this.#form ){ return this.#form }

        this.#consumeBody( 'form' );
        const raw = await this.#readRaw();
        const contentType = this.#req.headers.get( 'content-type' ) || 'multipart/form-data';
        this.#form = await new Response( raw, { headers : { 'Content-Type' : contentType } }).formData();

        return this.#form;
    }

    async file( name: string ): Promise<File | null>
    {
        const form = await this.formData();
        const value = form.get( name );

        return value instanceof File ? value : null;
    }

    async files( name: string ): Promise<File[]>
    {
        const form = await this.formData();

        return form.getAll( name ).filter(( value ): value is File => value instanceof File );
    }

    /**
     * Streaming multipart parse (MultiBuffer parser). Honors `#files` options
     * (dest / onFile / limits). Cached on this ServerRequest instance.
     */
    async multipart(): Promise<MultipartParseResult>
    {
        if( this.#multipart ){ return this.#multipart }

        this.#consumeBody( 'multipart' );

        const maxTotal = resolveMultipartTotalLimit( this.#security, this.#files );
        const result = await processMultipartUpload(
            this.#req.body,
            this.#req.headers.get( 'content-type' ),
            this.#files,
            maxTotal,
            this.#signal
        );

        this.#multipart = result;

        return result;
    }

    /**
     * Delete any temporary disk files written during streaming multipart parsing on this
     * request. Called when post-parse parameter validation or handler execution fails so
     * rejected requests do not orphan files on disk.
     */
    async cleanupDiskUploads(): Promise<void>
    {
        if( !this.#multipart?.files.length ){ return }

        await cleanupUploadedFiles( this.#multipart.files );
    }

    /** First `UploadedFile` for a field (streaming multipart). */
    async upload( name: string ): Promise<UploadedFile | undefined>
    {
        const { files } = await this.multipart();

        return files.find( f => f.field === name );
    }

    /** All `UploadedFile`s, optionally filtered by field name. */
    async uploads( name?: string ): Promise<UploadedFile[]>
    {
        const { files } = await this.multipart();

        return name === undefined ? files : files.filter( f => f.field === name );
    }

    /** Multipart text fields from the streaming parser. */
    async multipartFields(): Promise<Record<string, string | string[]>>
    {
        const { fields } = await this.multipart();

        return fields;
    }

    /**
     * Processed multipart bag: text fields + `UploadedFile` instances.
     * Prefer `@Body()` (multipart → bag + validator) over calling this manually.
     */
    async payload(): Promise<MultipartPayload>
    {
        if( this.#payload ){ return this.#payload }

        const result = await this.multipart();
        const payload = MultipartPayload.from( result );
        this.#payload = payload;

        return payload;
    }

    #resolveStreamLimit( maxBytes?: number | string | false ): number | undefined
    {
        if( maxBytes !== undefined )
        {
            if( maxBytes === false || maxBytes === 0 || maxBytes === Infinity )
            {
                return undefined;
            }

            return parseSize( maxBytes );
        }

        if( this.#routeFiles !== undefined || ( this.#files !== undefined && isMultipartContentType( getContentType( this.#req ))))
        {
            return resolveMultipartTotalLimit( this.#security, this.#files );
        }

        return resolveBodyLimit( this.#security ).limit;
    }

    /**
     * Raw body stream with passive byte-limit observation (`413 Payload Too Large` on overflow).
     * Defaults to the route's resolved `maxBodySize` (or multipart `maxTotalSize` / `maxFileSize`
     * when `@File` is present); pass `0` or `false` to opt out, or an explicit `maxBytes` override.
     */
    stream( maxBytes?: number | string | false ): ReadableStream<Uint8Array>
    {
        if( this.#raw !== undefined || this.#bodyMode )
        {
            throw Object.assign( new Error( 'Request body already consumed' ), { status : 400 });
        }

        if( this.#req.body == null )
        {
            throw Object.assign( new Error( 'Request has no body stream' ), { status : 400 });
        }

        const rawStream = this.#req.body as ReadableStream<Uint8Array>;
        const limit = this.#resolveStreamLimit( maxBytes );
        const declared = parseContentLength( this.#req.headers.get( 'content-length' ));
        this.#bodyMode = 'stream';

        if( limit === undefined )
        {
            return rawStream;
        }

        if( declared !== undefined && declared > limit )
        {
            try { void rawStream.cancel()?.catch(() => undefined ) }
            catch{ /* ignore */ }

            throw Object.assign( new Error( 'Request body too large' ), { status : 413 });
        }

        let received = 0;

        return rawStream.pipeThrough( new TransformStream<Uint8Array, Uint8Array>({
            transform( chunk, controller )
            {
                received += chunk.byteLength;

                if( received > limit )
                {
                    controller.error( Object.assign( new Error( 'Request body too large' ), { status : 413 }));

                    return;
                }

                controller.enqueue( chunk );
            }
        }));
    }

    #consumeBody( mode: 'raw' | 'text' | 'form' | 'stream' | 'multipart' )
    {
        if( this.#bodyMode === 'stream' )
        {
            throw Object.assign( new Error( 'Request body already consumed' ), { status : 400 });
        }

        if( this.#bodyMode && this.#bodyMode !== mode && !( this.#bodyMode === 'raw' && mode === 'text' ) && !( this.#bodyMode === 'text' && mode === 'raw' ))
        {
            if( !( this.#form && mode === 'form' ) && !( this.#multipart && mode === 'multipart' ))
            {
                throw Object.assign( new Error( 'Request body already consumed' ), { status : 400 });
            }
        }

        this.#bodyMode = mode;
    }
}

/** Resolve Server → Module → route file options. */
export function resolveRequestFileOptions( req: ServerRequest, moduleFiles?: FileOptions ): FileOptions | undefined
{
    return mergeFileConfigs([ req.globalFiles, moduleFiles, req.routeFiles ]);
}

function decodeCookieComponent( rawVal: string ): string
{
    let val = rawVal;

    if( val.length >= 2 && val.charCodeAt( 0 ) === 0x22 && val.charCodeAt( val.length - 1 ) === 0x22 )
    {
        val = val.slice( 1, -1 );
    }

    if( val.indexOf( '%' ) === -1 )
    {
        return val;
    }

    try
    {
        return decodeURIComponent( val );
    }
    catch
    {
        return val;
    }
}

export function parseCookieHeader( cookieHeader: string | null ): Record<string, string>
{
    const cookies: Record<string, string> = {};

    if( !cookieHeader ){ return cookies }

    const len = cookieHeader.length;
    let start = 0;

    while( start < len )
    {
        let end = cookieHeader.indexOf( ';', start );

        if( end === -1 ) { end = len }

        const eqIdx = cookieHeader.indexOf( '=', start );

        if( eqIdx !== -1 && eqIdx < end )
        {
            const rawKey = cookieHeader.slice( start, eqIdx ).trim();
            const key = rawKey ? decodeCookieComponent( rawKey ) : '';

            if(
                key
                && key !== '__proto__'
                && key !== 'prototype'
                && key !== 'constructor'
                && !Object.hasOwn( cookies, key )
            )
            {
                const val = cookieHeader.slice( eqIdx + 1, end ).trim();
                cookies[key] = decodeCookieComponent( val );
            }
        }

        start = end + 1;
    }

    return cookies;
}

