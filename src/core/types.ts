import { ServerError } from '../errors.js';

export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'WS' | 'HEAD' | 'OPTIONS' | 'ALL' | 'RPC';

export interface ServerWebSocket {
    send( data: string | ArrayBuffer | Buffer ): void
    close( code?: number, reason?: string ): void
    on( event: 'message' | 'close' | 'error', callback: Function ): void
    off( event: 'message' | 'close' | 'error', callback: Function ): void
    readonly headers : Headers
    readonly query   : Record<string, string>
    readonly params  : Record<string, string>
}

export type ValidationMode = 'strict' | 'relaxed' | 'strip';

export interface PeerCertSubject {
    C?            : string
    ST?           : string
    L?            : string
    O?            : string
    OU?           : string
    CN?           : string
    [key: string] : any
}

export interface PeerCert {
    subject : PeerCertSubject
    issuer  : PeerCertSubject
    valid: {
        from : Date
        to   : Date
    }
    fingerprint     : string
    fingerprint256? : string
    serialNumber    : string
    serial          : string // Alias for serialNumber
}

export interface ParamMetadata {
    source       : 'Param' | 'Body' | 'RawBody' | 'Query' | 'Header' | 'Headers' | 'Request' | 'Response' | 'Ip' | 'Url' | 'Hostname' | 'Path' | 'Context' | 'Inject' | 'WebSocket' | 'Peer' | 'Cookies' | 'Cookie' | 'File' | 'Files'
    name?        : string
    validator?   : string | Validator
    parser?      : string | Parser
    parserQuery? : string | Parser
    mode?        : ValidationMode
}

export interface GuardMetadata {
    type      : 'class' | 'method'
    name      : string
    resolvers : any[]
    params    : ParamMetadata[]
    isAsync   : boolean
}

export interface EndpointMetadata {
    controller           : string
    methodName           : string
    httpMethod           : Method
    path                 : string
    params               : ParamMetadata[]
    guards               : GuardMetadata[]
    interceptors         : string[]
    middlewares          : string[]
    cors?                : any
    security?            : any
    /** Merged class + method `@File` config (runtime merges ServerOptions / Module). */
    files?               : any
    meta                 : Record<string, any>
    /** High-priority SEO route group (`@Seo`). */
    seo?                 : boolean
    /** Forward-only route; not reachable from external HTTP (`@Internal`). */
    internal?            : boolean
    returnTypeValidator? : string | Validator
    returnTypeSerializer?: string | Serializer
    returnTypeMode?      : 'strict' | 'relaxed' | 'strip'
}

/**
 * Internal rewrite descriptor returned from `@Seo` handlers or passed to `ServerResponse.forward`.
 * Re-dispatched by HTTP method + path (public ∪ internal routers; SEO skipped).
 */
export type SeoForward =
{
    method : string
    path   : string
    query? : Record<string, string>
    body?  : Record<string, unknown>
}

/** Thrown (control flow) when an `@Seo` handler returns void / undefined. */
export class SeoFallthrough extends Error
{
    constructor()
    {
        super( 'SEO_FALLTHROUGH' );
        this.name = 'SeoFallthrough';
    }
}

/** Thrown (control flow) when a handler requests an internal forward. */
export class ForwardIntent extends Error
{
    public readonly target: SeoForward;

    constructor( target: SeoForward )
    {
        super( 'FORWARD' );
        this.name = 'ForwardIntent';
        this.target = target;
    }
}

export function isSeoForward( value: unknown ): value is SeoForward
{
    if( !value || typeof value !== 'object' ){ return false }

    const v = value as Record<string, unknown>;

    if( typeof v.method !== 'string' || typeof v.path !== 'string' ){ return false }

    if( v.query !== undefined && ( typeof v.query !== 'object' || v.query === null || Array.isArray( v.query ))){ return false }

    if( v.body !== undefined && ( typeof v.body !== 'object' || v.body === null || Array.isArray( v.body ))){ return false }

    return true;
}

export type Validator = ( v: any, path: string, ctx: any ) => any;
export type Parser = ( input: any, path?: string ) => any;
export type Serializer = ( v: any ) => string;


export interface AugmentedRequest extends Request {
    params            : Record<string, string>
    query             : Record<string, string>
    globalCors?       : any
    cors?             : any
    globalSecurity?   : any
    security?         : any
    globalFiles?      : any
    files?            : any
    meta              : Record<string, any>
    /** Set when `security.timeout` is active; aborted when the request times out. */
    abortSignal?      : AbortSignal
    /** TCP peer address attached by the runtime adapter (if available). */
    remoteAddress?    : string
    /** Copied from ServerOptions.trustProxy for @Ip resolution. */
    trustProxy?       : string[]
    /** Accept-or-generate `X-Request-Id` for this request. */
    requestId?        : string
    /** Incremented on each internal forward hop. */
    forwardDepth?     : number
    /** `METHOD path` keys already visited in this forward chain (cycle detection). */
    forwardStack?     : string[]
    /** Shallow-merged into `@Body` after parse when set by a forward. */
    forwardBody?      : Record<string, unknown>
    _json?            : any
    _raw?             : ArrayBuffer
    /** Set by getBody when Content-Type was missing and the body was sniffed. */
    _bodyContentType? : 'application/json' | 'application/x-www-form-urlencoded'
    /** Cached streaming multipart parse result. */
    _multipart?        : import( '../helpers/multipart.js' ).MultipartParseResult
    _multipartPayload? : import( '../helpers/multipart.js' ).MultipartPayload
}

export interface LogContext {
    type          : 'server_start' | 'server_shutdown' | 'registration' | 'request_start' | 'request_end' | 'error'
    port?         : number
    runtime?      : string
    reason?       : string
    method?       : string
    path?         : string
    url?          : string
    status?       : number
    duration?     : number
    controller?   : string
    action?       : string
    requestId?    : string
    error?        : Error
    [key: string] : any
}

export interface Logger {
    info( message: any, context?: LogContext ): void
    warn( message: any, context?: LogContext ): void
    error( message: any, context?: LogContext ): void
    debug?( message: any, context?: LogContext ): void
}

export type EndpointRequest = import( './server-request.js' ).ServerRequest;

export interface CookieOptions
{
    maxAge?   : number
    expires?  : Date
    path?     : string
    domain?   : string
    secure?   : boolean
    httpOnly? : boolean
    sameSite? : 'Strict' | 'Lax' | 'None' | 'strict' | 'lax' | 'none'
}

/**
 * Sealed response facade for middleware and `@Response`.
 * Headers and status are merged onto the final Fetch `Response` after the handler returns.
 * Not a Fetch `Response`. Chainable setters return `this`.
 */
export class ServerResponse
{
    #status = 200;
    #statusSet = false;
    #statusText? : string;
    #body?      : BodyInit | null;
    #bodySet = false;
    #pendingForward? : SeoForward;
    readonly #headers = new Headers();

    public status(): number;
    public status( code: number, statusText?: string ): this;
    public status( code?: number, statusText?: string ): number | this
    {
        if( code === undefined )
        {
            return this.#status;
        }

        this.#status = code;
        this.#statusSet = true;

        if( statusText !== undefined )
        {
            this.#statusText = statusText;
        }

        return this;
    }

    public get statusSet(): boolean
    {
        return this.#statusSet;
    }

    public get pendingForward(): SeoForward | undefined
    {
        return this.#pendingForward;
    }

    public get bodySet(): boolean
    {
        return this.#bodySet;
    }

    public header( name: string, value: string ): this
    {
        this.#headers.set( name, value );

        return this;
    }

    public headers( init: Record<string, string> ): this
    {
        for( const [ name, value ] of Object.entries( init ))
        {
            this.#headers.set( name, value );
        }

        return this;
    }

    /**
     * Set a cookie. Pass `''`, `null`, or `undefined` as `value` to clear it (Max-Age=0).
     */
    public cookie( name: string, value?: string | null, options?: CookieOptions ): this
    {
        if( value === '' || value == null )
        {
            this.#headers.append( 'Set-Cookie', serializeCookie( name, '', {
                ...options,
                maxAge  : 0,
                expires : new Date( 0 )
            }));
        }
        else
        {
            this.#headers.append( 'Set-Cookie', serializeCookie( name, value, options ));
        }

        return this;
    }

    /**
     * Attach a response body (bytes, blob, or `ReadableStream` to pipe).
     * Returning this `ServerResponse` from a handler finalizes the HTTP response with that body.
     */
    public stream( body: BodyInit | null ): this
    {
        this.#body = body;
        this.#bodySet = true;

        return this;
    }

    public redirect( code: number, url: string ): this
    {
        return this.status( code ).header( 'Location', url );
    }

    /**
     * Request an in-process rewrite to another endpoint (`method` + `path`).
     * Does not send a client `Location`. Stashes intent; return this bag (or let the
     * request-scoped bag carry it) so the framework re-dispatches after the handler.
     */
    public forward( target: SeoForward ): this
    {
        this.#pendingForward = target;

        return this;
    }

    /**
     * Build the Fetch `Response` for this facade.
     * Used when the handler returns a `ServerResponse` (handler owns the response; no JSON serialization).
     */
    public toResponse(): Response
    {
        return new Response( this.#bodySet ? this.#body! : null, {
            status     : this.#status,
            statusText : this.#statusText ?? '',
            headers    : this.#headers
        });
    }

    /** Merge this bag onto a Fetch Response (headers always; status when explicitly set). */
    public applyTo( response: Response ): Response
    {
        if( this.#statusSet )
        {
            const headers = new Headers( response.headers );

            for( const [key, value] of this.#headers.entries())
            {
                headers.set( key, value );
            }

            return new Response( response.body, {
                status     : this.#status,
                statusText : this.#statusText ?? response.statusText,
                headers
            });
        }

        for( const [key, value] of this.#headers.entries())
        {
            response.headers.set( key, value );
        }

        return response;
    }
}

/** @deprecated Use `ServerResponse`. */
export const ResponseBag = ServerResponse;
export type ResponseBag = ServerResponse;

export type EndpointResponse = ServerResponse;

function serializeCookie( name: string, value: string, options?: CookieOptions ): string
{
    let out = `${encodeURIComponent( name )}=${encodeURIComponent( value )}`;

    if( !options ){ return out }

    if( options.maxAge !== undefined )
    {
        out += `; Max-Age=${Math.floor( options.maxAge )}`;
    }

    if( options.expires )
    {
        out += `; Expires=${options.expires.toUTCString()}`;
    }

    if( options.path )
    {
        out += `; Path=${options.path}`;
    }

    if( options.domain )
    {
        out += `; Domain=${options.domain}`;
    }

    if( options.secure )
    {
        out += '; Secure';
    }

    if( options.httpOnly )
    {
        out += '; HttpOnly';
    }

    if( options.sameSite )
    {
        const site = options.sameSite;
        const normalized = site === 'strict' || site === 'Strict' ? 'Strict'
            : site === 'lax' || site === 'Lax' ? 'Lax'
                : 'None';
        out += `; SameSite=${normalized}`;
    }

    return out;
}

export interface Middleware 
{
    use?( request: EndpointRequest, response: EndpointResponse ): Promise<void> | void
    useCallback?( request: EndpointRequest, response: EndpointResponse, next: ( error?: ServerError ) => Promise<void> | void ): Promise<void> | void
}

export type MiddlewareClass = 
    | ( new ( ...args: any[]) => { use( request: EndpointRequest, response: EndpointResponse ): Promise<void> | void, useCallback? : never })
    | ( new ( ...args: any[]) => { useCallback( request: EndpointRequest, response: EndpointResponse, next: ( error?: ServerError ) => Promise<void> | void ): Promise<void> | void, use? : never });


