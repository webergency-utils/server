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
    source     : 'Param' | 'Body' | 'RawBody' | 'Query' | 'Header' | 'Headers' | 'Request' | 'Response' | 'Ip' | 'Url' | 'Hostname' | 'Path' | 'Context' | 'Inject' | 'WebSocket' | 'Peer' | 'Cookies' | 'Cookie'
    name?      : string
    validator? : string | Validator
    mode?      : ValidationMode
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
    meta                 : Record<string, any>
    returnTypeValidator? : string | Validator
    returnTypeMode?      : 'strict' | 'relaxed' | 'strip'
}

export type Validator = ( v: any, path: string, ctx: any ) => any;

export interface AugmentedRequest extends Request {
    params            : Record<string, string>
    query             : Record<string, string>
    globalCors?       : any
    cors?             : any
    globalSecurity?   : any
    security?         : any
    meta              : Record<string, any>
    /** Set when `security.timeout` is active; aborted when the request times out. */
    abortSignal?      : AbortSignal
    /** TCP peer address attached by the runtime adapter (if available). */
    remoteAddress?    : string
    /** Copied from ServerOptions.trustProxy for @Ip resolution. */
    trustProxy?       : string[]
    /** Accept-or-generate `X-Request-Id` for this request. */
    requestId?        : string
    _json?            : any
    _raw?             : ArrayBuffer
    /** Set by getBody when Content-Type was missing and the body was sniffed. */
    _bodyContentType? : 'application/json' | 'application/x-www-form-urlencoded'
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

export type EndpointRequest = AugmentedRequest;

/**
 * Mutable status/headers bag shared by middleware and `@Response`.
 * Headers and status are merged onto the final Fetch `Response` after the handler returns.
 */
export class ResponseBag
{
    #status = 200;
    #statusSet = false;
    public readonly headers = new Headers();

    public get status(): number
    {
        return this.#status;
    }

    public set status( value: number )
    {
        this.#status = value;
        this.#statusSet = true;
    }

    /** Nest-style alias for `status`. */
    public get statusCode(): number
    {
        return this.#status;
    }

    public set statusCode( value: number )
    {
        this.status = value;
    }

    public get statusSet(): boolean
    {
        return this.#statusSet;
    }

    /** Merge this bag onto a Fetch Response (headers always; status when explicitly set). */
    public applyTo( response: Response ): Response
    {
        if( this.#statusSet )
        {
            const headers = new Headers( response.headers );

            for( const [key, value] of this.headers.entries())
            {
                headers.set( key, value );
            }

            return new Response( response.body, {
                status     : this.#status,
                statusText : response.statusText,
                headers
            });
        }

        for( const [key, value] of this.headers.entries())
        {
            response.headers.set( key, value );
        }

        return response;
    }
}

export type EndpointResponse = ResponseBag;

export interface Middleware 
{
    use?( request: EndpointRequest, response: EndpointResponse ): Promise<void> | void
    useCallback?( request: EndpointRequest, response: EndpointResponse, next: ( error?: ServerError ) => Promise<void> | void ): Promise<void> | void
}

export type MiddlewareClass = 
    | ( new ( ...args: any[]) => { use( request: EndpointRequest, response: EndpointResponse ): Promise<void> | void, useCallback? : never })
    | ( new ( ...args: any[]) => { useCallback( request: EndpointRequest, response: EndpointResponse, next: ( error?: ServerError ) => Promise<void> | void ): Promise<void> | void, use? : never });


