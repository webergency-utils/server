const HTTP_MESSAGES: Record<number, string> = { 100: 'Continue', 101: 'Switching Protocols', 102: 'Processing', 103: 'Early Hints', 200: 'OK', 201: 'Created', 202: 'Accepted', 203: 'Non-Authoritative Information', 204: 'No Content', 205: 'Reset Content', 206: 'Partial Content', 207: 'Multi-Status', 208: 'Already Reported', 226: 'IM Used', 300: 'Multiple Choices', 301: 'Moved Permanently', 302: 'Found', 303: 'See Other', 304: 'Not Modified', 305: 'Use Proxy', 307: 'Temporary Redirect', 308: 'Permanent Redirect', 400: 'Bad Request', 401: 'Unauthorized', 402: 'Payment Required', 403: 'Forbidden', 404: 'Not Found', 405: 'Method Not Allowed', 406: 'Not Acceptable', 407: 'Proxy Authentication Required', 408: 'Request Timeout', 409: 'Conflict', 410: 'Gone', 411: 'Length Required', 412: 'Precondition Failed', 413: 'Payload Too Large', 414: 'URI Too Long', 415: 'Unsupported Media Type', 416: 'Range Not Satisfiable', 417: 'Expectation Failed', 418: 'I\'m a teapot', 421: 'Misdirected Request', 422: 'Unprocessable Entity', 423: 'Locked', 424: 'Failed Dependency', 425: 'Too Early', 426: 'Upgrade Required', 428: 'Precondition Required', 429: 'Too Many Requests', 431: 'Request Header Fields Too Large', 451: 'Unavailable For Legal Reasons', 500: 'Internal Server Error', 501: 'Not Implemented', 502: 'Bad Gateway', 503: 'Service Unavailable', 504: 'Gateway Timeout', 505: 'HTTP Version Not Supported', 506: 'Variant Also Negotiates', 507: 'Insufficient Storage', 508: 'Loop Detected', 510: 'Not Extended', 511: 'Network Authentication Required' };

export class ServerError extends Error
{
    constructor( public code: number, message: string, public data?: Record<string, any>, public debug?: Record<string, any> )
    {
        super( message );
    }
}

export class HTTPServerError extends ServerError
{
    constructor( code: number, message: string, data?: Record<string, any>, debug?: Record<string, any> )
    constructor( code: number, data?: Record<string, any>, debug?: Record<string, any> )
    constructor( code: number, arg2?: string | Record<string, any>, arg3?: Record<string, any>, arg4?: Record<string, any> )
    {
        const [ message, data, debug ] = ( typeof arg2 === 'string' ? [ arg2,  arg3, arg4 ] : [ HTTP_MESSAGES[code] ?? 'HTTP Error', arg2, arg3 ]);

        super( code, message, data, debug );
    }
}

export class BadRequestError extends HTTPServerError
{
    constructor( message?: string, data?: Record<string, any>, debug?: Record<string, any> )
    constructor( data?: Record<string, any>, debug?: Record<string, any> )
    constructor( ...args: any[] )
    {
        super( 400, ...args );
    }
}

export class UnauthorizedError extends HTTPServerError
{
    constructor( message?: string, data?: Record<string, any>, debug?: Record<string, any> )
    constructor( data?: Record<string, any>, debug?: Record<string, any> )
    constructor( ...args: any[] )
    {
        super( 401, ...args );
    }
}

export class ForbiddenError extends HTTPServerError
{
    constructor( message?: string, data?: Record<string, any>, debug?: Record<string, any> )
    constructor( data?: Record<string, any>, debug?: Record<string, any> )
    constructor( ...args: any[] )
    {
        super( 403, ...args );
    }
}

export class NotFoundError extends HTTPServerError
{
    constructor( message?: string, data?: Record<string, any>, debug?: Record<string, any> )
    constructor( data?: Record<string, any>, debug?: Record<string, any> )
    constructor( ...args: any[] )
    {
        super( 404, ...args );
    }
}

export class ConflictError extends HTTPServerError
{
    constructor( message?: string, data?: Record<string, any>, debug?: Record<string, any> )
    constructor( data?: Record<string, any>, debug?: Record<string, any> )
    constructor( ...args: any[] )
    {
        super( 409, ...args );
    }
}

export class PreconditionFailedError extends HTTPServerError
{
    constructor( message?: string, data?: Record<string, any>, debug?: Record<string, any> )
    constructor( data?: Record<string, any>, debug?: Record<string, any> )
    constructor( ...args: any[] )
    {
        super( 412, ...args );
    }
}

export class RateLimitError extends HTTPServerError
{
    constructor( message?: string, data?: Record<string, any>, debug?: Record<string, any> )
    constructor( data?: Record<string, any>, debug?: Record<string, any> )
    constructor( ...args: any[] )
    {
        super( 429, ...args );
    }
}

export class InternalServerError extends HTTPServerError
{
    constructor( message?: string, data?: Record<string, any>, debug?: Record<string, any> )
    constructor( data?: Record<string, any>, debug?: Record<string, any> )
    constructor( ...args: any[] )
    {
        super( 500, ...args );
    }
}

export class ServiceUnavailableError extends HTTPServerError
{
    constructor( message?: string, data?: Record<string, any>, debug?: Record<string, any> )
    constructor( data?: Record<string, any>, debug?: Record<string, any> )
    constructor( ...args: any[] )
    {
        super( 503, ...args );
    }
}