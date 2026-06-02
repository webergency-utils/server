import { ServerError } from '../errors.js';

export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'WS' | 'HEAD' | 'ALL' | 'RPC';

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
    source     : 'Param' | 'Body' | 'Query' | 'Header' | 'Headers' | 'Request' | 'Response' | 'Ip' | 'Url' | 'Hostname' | 'Path' | 'Context' | 'Inject' | 'WebSocket' | 'Peer' | 'Cookies' | 'Cookie'
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
    params          : Record<string, string>
    query           : Record<string, string>
    globalCors?     : any
    cors?           : any
    globalSecurity? : any
    security?       : any
    meta            : Record<string, any>
    _json?          : any
    _raw?           : ArrayBuffer
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
export type EndpointResponse = Response;

export interface Middleware 
{
    use?( request: EndpointRequest, response: EndpointResponse ): Promise<void> | void;
    useCallback?( request: EndpointRequest, response: EndpointResponse, next: (error?: ServerError) => Promise<void> | void ): Promise<void> | void;
}

export type MiddlewareClass = 
    | (new (...args: any[]) => { use(request: EndpointRequest, response: EndpointResponse): Promise<void> | void; useCallback?: never })
    | (new (...args: any[]) => { useCallback(request: EndpointRequest, response: EndpointResponse, next: (error?: ServerError) => Promise<void> | void): Promise<void> | void; use?: never });


