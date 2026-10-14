import { parseQueryString } from '@webergency-utils/typechecker/runtime';
import { Context, type RequestContext } from './context.js';
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
    looksLikeUrlEncoded,
    readRawBody,
    requestLikelyHasBody,
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
    mergeFileConfigs,
    processMultipartUpload,
    type FileOptions,
    type MultipartParseResult,
    UploadedFile,
    MultipartPayload
}
    from '../helpers/file-upload.js';

export interface TransportRequest extends Request
{
    remoteAddress? : string
    clientCert?    : PeerCert
}

export interface ServerRequestInit extends SecurityOptions
{
    params?             : Record<string, string>
    query?              : Record<string, string>
    queryString?        : string
    requestId?          : string
    remoteAddress?      : string
    trustProxy?         : TrustProxy
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

const EMPTY_PARAMS_BAG: Record<string, string> = {};

function hasDirectSecurityOption( obj: ServerRequestInit ): boolean
{
    return obj.maxBodySize !== undefined
        || obj.timeout !== undefined
        || obj.rateLimit !== undefined
        || obj.allowedContentTypes !== undefined
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
    #req                : Request;
    #url?               : URL;
    #path?              : string;
    #params             : Record<string, string>;
    #queryString?       : string;
    #query?             : Record<string, string>;
    #requestId?         : string;
    #remoteAddress?     : string;
    #trustProxy?        : TrustProxy;
    #compiledTrustProxy : CompiledTrustProxy | null | undefined;
    #ip?                : string;
    #peer?              : PeerCert;
    #signal?            : AbortSignal;
    #security           : SecurityOptions | undefined;
    #globalFiles?       : FileOptions;
    #routeFiles?        : FileOptions;
    #files              : FileOptions | undefined;
    #globalReviver?     : Reviver | null;
    #reviver?           : Reviver;
    #forwardStack?      : string[];
    #forwardBody?       : Record<string, unknown>;
    #headers?           : Record<string, string>;
    #cookies?           : Record<string, string>;
    #raw?               : ArrayBuffer;
    #hasJson            = false;
    #json?              : unknown;
    #bodyContentType?   : 'application/json' | 'application/x-www-form-urlencoded';
    #form?              : FormData;
    #multipart?         : MultipartParseResult;
    #payload?           : MultipartPayload;
    #bodyMode?          : 'raw' | 'text' | 'form' | 'stream' | 'multipart';

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
            this.#params = {};
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
            this.#files = files ?? opts.files ?? (
                ( this.#globalFiles || this.#routeFiles )
                    ? mergeFileConfigs([ this.#globalFiles, this.#routeFiles ])
                    : undefined
            );
            this.#params = opts.params ?? {};
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

    static from(
        req             : ServerRequest | Request,
        securityOrInit? : ServerRequestInit,
        files?          : FileOptions,
        init?           : ServerRequestInit
    ): ServerRequest
    {
        if( req instanceof ServerRequest )
        {
            if( securityOrInit !== undefined && req.#security === undefined )
            {
                req.#security = securityOrInit;
            }

            if( files !== undefined && req.#files === undefined )
            {
                req.#files = files;
            }

            return req;
        }

        const existing = ( req && typeof req === 'object' )
            ? requestFacadeMap.get( req )
            : undefined;

        if( existing )
        {
            if( securityOrInit !== undefined && existing.#security === undefined )
            {
                existing.#security = securityOrInit;
            }

            if( files !== undefined && existing.#files === undefined )
            {
                existing.#files = files;
            }

            return existing;
        }

        return new ServerRequest( req, securityOrInit, files, init );
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

    get trustProxy(): TrustProxy | undefined
    {
        return this.#trustProxy;
    }

    set trustProxy( val: TrustProxy | undefined )
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

    set requestID( val: string | undefined )
    {
        this.#requestId = val;
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
        return this.cookies[name];
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
        return this.#params;
    }

    set params( val: Record<string, string> )
    {
        this.#params = val;
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

    set peer( val: PeerCert | undefined )
    {
        this.#peer = val;
    }

    /** AbortSignal when `security.timeout` is set (and later disconnect). */
    get signal(): AbortSignal | undefined
    {
        return this.#signal;
    }

    set signal( val: AbortSignal | undefined )
    {
        this.#signal = val;
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

    set globalFiles( val: FileOptions | undefined )
    {
        this.#globalFiles = val;
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

    get forwardDepth(): number
    {
        return this.#forwardStack ? this.#forwardStack.length : 0;
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

    get contentType(): string | null
    {
        return getContentType( this.#req );
    }

    get bodyContentType(): 'application/json' | 'application/x-www-form-urlencoded' | undefined
    {
        return this.#bodyContentType;
    }

    get effectiveContentType(): string | null
    {
        return getContentType( this.#req ) ?? this.#bodyContentType ?? null;
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

    get cachedRawBody(): ArrayBuffer | undefined
    {
        return this.#raw;
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

    /** Raw body stream — not size-capped; caller must enforce limits. */
    stream(): ReadableStream<Uint8Array>
    {
        if( this.#raw !== undefined || this.#bodyMode )
        {
            throw Object.assign( new Error( 'Request body already consumed' ), { status : 400 });
        }

        if( this.#req.body == null )
        {
            throw Object.assign( new Error( 'Request has no body stream' ), { status : 400 });
        }

        this.#bodyMode = 'stream';

        return this.#req.body as ReadableStream<Uint8Array>;
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

function resolveMultipartTotalLimit( security?: SecurityOptions, files?: FileOptions ): number | undefined
{
    if( files?.maxTotalSize !== undefined )
    {
        return parseSize( files.maxTotalSize );
    }

    const configured = security?.maxBodySize;

    if( configured === undefined )
    {
        return DEFAULT_MAX_BODY_BYTES;
    }

    if( configured === 0 || configured === Infinity )
    {
        return undefined;
    }

    return parseSize( configured );
}

/** Resolve Server → Module → route file options. */
export function resolveRequestFileOptions( req: ServerRequest, moduleFiles?: FileOptions ): FileOptions | undefined
{
    return mergeFileConfigs([ req.globalFiles, moduleFiles, req.routeFiles ]);
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
            const key = cookieHeader.slice( start, eqIdx ).trim();
            const val = cookieHeader.slice( eqIdx + 1, end ).trim();

            if( cookies[key] === undefined )
            {
                cookies[key] = val;
            }
        }

        start = end + 1;
    }

    return cookies;
}

