/**
 * PARAMETER DECORATORS (Strict - No Parentheses)
 */
import { MiddlewareClass } from './core/types.js';
import type { FileOptions, FileFieldOptions } from './helpers/file-upload.js';
import type { Reviver } from './helpers/reviver.js';

export type { FileOptions, FileFieldOptions, FileHandler } from './helpers/file-upload.js';
export { UploadedFile } from './helpers/file-upload.js';
export { MultipartPayload, type MultipartValue, type MultipartFieldValue } from './helpers/multipart.js';

export const Request = ( target: any, key: string | symbol, idx: number ) => {};
export const Context = ( target: any, key: string | symbol, idx: number ) => {};
export const Response = ( target: any, key: string | symbol, idx: number ) => {};
export const Headers = ( target: any, key: string | symbol, idx: number ) => {};
export const Ip = ( target: any, key: string | symbol, idx: number ) => {};
export const Url = ( target: any, key: string | symbol, idx: number ) => {};
export const Hostname = ( target: any, key: string | symbol, idx: number ) => {};
export const Path = ( target: any, key: string | symbol, idx: number ) => {};
export const RawBody = ( target: any, key: string | symbol, idx: number ) => {};
export const Peer = ( target: any, key: string | symbol, idx: number ) => {};
export const Cookies = ( target: any, key: string | symbol, idx: number ) => {};

/**
 * PARAMETER DECORATORS (Hybrid - Parentheses optional)
 */
export function Body( target: any, key: string | symbol, idx: number ): void;
export function Body( mode?: 'strict' | 'strip' ): ParameterDecorator;
export function Body( arg1: any, arg2?: any, arg3?: any ): any 
{
    if( arg3 !== undefined ) { return } // Direct decorator usage

    return ( target: any, key: string | symbol, idx: number ) => {}; 
}

export function Query( target: any, key: string | symbol, idx: number ): void;
export function Query( name?: string, mode?: 'strict' | 'strip' ): ParameterDecorator;
export function Query( arg1: any, arg2?: any, arg3?: any ): any 
{
    if( arg3 !== undefined ) { return } // Direct decorator usage

    return ( target: any, key: string | symbol, idx: number ) => {}; 
}

export const Param = ( name: string ): ParameterDecorator => ( target: any, key: string | symbol | undefined, idx: number ) => {};
export const Header = ( name: string ): ParameterDecorator => ( target: any, key: string | symbol | undefined, idx: number ) => {};
export const Cookie = ( name: string ): ParameterDecorator => ( target: any, key: string | symbol | undefined, idx: number ) => {};
export const ConnectedSocket = (): ParameterDecorator => ( target: any, key: string | symbol | undefined, idx: number ) => {};

/**
 * Inject all uploaded files from a multipart request.
 * Requires hierarchical `@File({ ... })` config (or `ServerOptions.files` / module `files`).
 */
export const Files = (): ParameterDecorator => ( target: any, key: string | symbol | undefined, idx: number ) => {};

/**
 * File upload config (class / method) and field injection (parameter).
 *
 * Config (hierarchical — ServerOptions.files → Module.files → class → method):
 * ```ts
 * @File({ dest: '/tmp/uploads', maxFileSize: '10mb' })
 * @Controller('/media')
 * class MediaController {
 *   @Post('/avatar')
 *   @File('avatar', { dest: '/tmp/avatars' })
 *   upload(@File('avatar') file: UploadedFile) { return { path: file.path } }
 * }
 * ```
 */
export function File( options?: FileOptions ): ClassDecorator & MethodDecorator;
export function File( field: string, options?: FileFieldOptions ): MethodDecorator & ParameterDecorator;
export function File( arg1?: any, arg2?: any ): any
{
    return () => {};
}

/**
 * CLASS/METHOD DECORATORS (Strict Paren-free)
 */
export function Public( target: any ): void; 
export function Public( target: any, key: string | symbol, descriptor: any ): void; 
export function Public( arg1: any, arg2?: any, arg3?: any ): void {}

/** Marks endpoints for the high-priority SEO router group. */
export function Seo( target: any ): void;
export function Seo( target: any, key: string | symbol, descriptor: any ): void;
export function Seo( arg1: any, arg2?: any, arg3?: any ): void {}

/** Marks endpoints as forward-only (excluded from external HTTP routing). */
export function Internal( target: any ): void;
export function Internal( target: any, key: string | symbol, descriptor: any ): void;
export function Internal( arg1: any, arg2?: any, arg3?: any ): void {}

export enum Scope {
    SINGLETON = 0,
    TRANSIENT = 1,
    REQUEST = 2
}

export interface ControllerOptions {
    path?  : string
    scope? : Scope
}

export function Controller( prefixOrOptions?: string | ControllerOptions ): ClassDecorator 
{
    return ( target: any ) => 
    {
        let prefix = '';
        let scope: Scope | undefined;

        if( typeof prefixOrOptions === 'string' ) 
        {
            prefix = prefixOrOptions;
        }
        else if( prefixOrOptions && typeof prefixOrOptions === 'object' ) 
        {
            prefix = prefixOrOptions.path || '';
            scope = prefixOrOptions.scope;
        }
        target.prototype.prefix = prefix;

        if( scope !== undefined ) 
        {
            target.__scope__ = scope;
        }
    };
}

export interface WsOptions {
    pingInterval? : number
    pingTimeout?  : number
    maxPayload?   : number
}

export function Get( path: string = '' ): MethodDecorator { return () => {} }
export function Post( path: string = '' ): MethodDecorator { return () => {} }
export function Put( path: string = '' ): MethodDecorator { return () => {} }
export function Delete( path: string = '' ): MethodDecorator { return () => {} }
export function Patch( path: string = '' ): MethodDecorator { return () => {} }
export function Head( path: string = '' ): MethodDecorator { return () => {} }
/** Handles non-preflight OPTIONS only; genuine CORS preflight is always answered by the framework. */
export function Options( path: string = '' ): MethodDecorator { return () => {} }
export function All( path: string = '' ): MethodDecorator { return () => {} }
export function Ws( path: string = '', options?: WsOptions ): MethodDecorator { return () => {} }
export function Sse( path: string = '' ): MethodDecorator { return () => {} }

export function MessagePattern( pattern: string ): MethodDecorator { return () => {} }
export function EventPattern( pattern: string ): MethodDecorator { return () => {} }

export function Payload( target: any, key: string | symbol, idx: number ): void;
export function Payload( name?: string ): ParameterDecorator;
export function Payload( arg1?: any, arg2?: any, arg3?: any ): any 
{
    if( arg3 !== undefined ) { return } // Direct decorator usage

    return ( target: any, key: string | symbol, idx: number ) => {}; 
}

const METADATA_BAG = Symbol.for( 'webergency.server.metadata' );

function ensureMetaBag( host: any ): Record<string | symbol, any>
{
    if( !host[METADATA_BAG])
    {
        host[METADATA_BAG] = host.__metadata__ || {};
    }
    host.__metadata__ = host[METADATA_BAG];

    return host[METADATA_BAG];
}

export function Meta( ...metas: Record<string, any>[]): any 
{
    return ( target: any, propertyKey?: string | symbol, descriptor?: TypedPropertyDescriptor<any> ) => 
    {
        const mergedMeta = Object.assign({}, ...metas );

        // Class decorator
        if( propertyKey === undefined ) 
        {
            Object.assign( ensureMetaBag( target ), mergedMeta );

            return target;
        }

        // Method decorator
        let targetMethod = descriptor?.value;

        if( !targetMethod && propertyKey !== undefined ) 
        {
            targetMethod = target[propertyKey];
        }

        if( targetMethod && typeof targetMethod === 'function' ) 
        {
            Object.assign( ensureMetaBag( targetMethod ), mergedMeta );
        }
        else 
        {
            const bag = ensureMetaBag( target );

            if( !bag[propertyKey as any])
            {
                bag[propertyKey as any] = {};
            }
            Object.assign( bag[propertyKey as any], mergedMeta );
        }

        return descriptor;
    };
}

export function SetMetadata<K = any, V = any>( key: K, value: V ): any 
{
    return Meta({ [key as any] : value });
}

export type ClassConstructor = new (...args: any[]) => any;

export function Protect( guard: ClassConstructor, ...params: any[]): any { return () => {} }
export function OverrideProtect( guard: ClassConstructor, ...params: any[]): any { return () => {} }
export function Unprotect( target: Function ): void;
export function Unprotect( target: any, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<any> ): void;
export function Unprotect( guard: ClassConstructor, ...moreGuards: ClassConstructor[]): any;
export function Unprotect( ...args: any[]): any {
    if( args.length === 3 && typeof args[1] === 'string' ) {
        return args[2];
    }
    if( args.length === 1 && typeof args[0] === 'function' && typeof args[0].prototype?.use !== 'function' ) {
        return args[0];
    }
    return ( target: any, propertyKey?: string | symbol, descriptor?: any ) => {
        if( propertyKey === undefined ) {
            return target;
        }
        return descriptor;
    };
}
export function Intercept( interceptor: ClassConstructor, ...params: any[]): any { return () => {} }
export function OverrideIntercept( interceptor: ClassConstructor, ...params: any[]): any { return () => {} }
export function Unintercept( target: Function ): void;
export function Unintercept( target: any, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<any> ): void;
export function Unintercept( interceptor: ClassConstructor, ...moreInterceptors: ClassConstructor[]): any;
export function Unintercept( ...args: any[]): any {
    if( args.length === 3 && typeof args[1] === 'string' ) {
        return args[2];
    }
    if( args.length === 1 && typeof args[0] === 'function' && typeof args[0].prototype?.intercept !== 'function' ) {
        return args[0];
    }
    return ( target: any, propertyKey?: string | symbol, descriptor?: any ) => {
        if( propertyKey === undefined ) {
            return target;
        }
        return descriptor;
    };
}
export function ResponseMode( mode: 'strict' | 'relaxed' | 'strip' ): any { return () => {} }
export function Use( ...middlewares: MiddlewareClass[] ): any { return () => {} }
export function OverrideUse( ...middlewares: MiddlewareClass[] ): any { return () => {} }
export function Unuse( target: Function ): void;
export function Unuse( target: any, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<any> ): void;
export function Unuse( ...middlewares: MiddlewareClass[] ): any;
export function Unuse( ...args: any[]): any {
    if( args.length === 3 && typeof args[1] === 'string' ) {
        return args[2];
    }
    if( args.length === 1 && typeof args[0] === 'function' && typeof args[0].prototype?.use !== 'function' && typeof args[0].prototype?.useCallback !== 'function' ) {
        return args[0];
    }
    return ( target: any, propertyKey?: string | symbol, descriptor?: any ) => {
        if( propertyKey === undefined ) {
            return target;
        }
        return descriptor;
    };
}

export interface CorsOptions {
    origin?         : string | string[] | boolean | Function
    methods?        : string | string[] | Function
    allowedHeaders? : string | string[] | Function
    exposedHeaders? : string | string[]
    credentials?    : boolean
    maxAge?         : number
}

export function Cors( config?: CorsOptions | string ): any { return () => {} }

/**
 * JSON.parse-style reviver applied to typed JSON and query parse, and to untyped JSON / urlencoded bodies.
 * Hierarchical: ServerOptions.reviver → Module.reviver → `@Reviver` on Controller → `@Reviver` on Endpoint.
 * `null` at a layer opts out of every parent.
 */
export type { Reviver } from './helpers/reviver.js';
export function Reviver( reviver: Reviver | null ): ClassDecorator & MethodDecorator
{
    return () => {};
}

export type ReferrerPolicyValue =
    | 'no-referrer'
    | 'no-referrer-when-downgrade'
    | 'origin'
    | 'origin-when-cross-origin'
    | 'same-origin'
    | 'strict-origin'
    | 'strict-origin-when-cross-origin'
    | 'unsafe-url';

export interface SecurityOptions {
    /** Request Protection */
    maxBodySize?         : string | number
    timeout?             : number
    /**
     * Per-process, keyed by `path:ip`. `fixed` (default) can permit up to 2x `max` across a
     * window boundary; `sliding` weights the previous window to smooth that out.
     */
    rateLimit?           : { max : number, window? : string | number, strategy? : 'fixed' | 'sliding' }
    allowedContentTypes? : string[]

    /** Response Headers */
    frameguard?                   : boolean | 'deny' | 'sameorigin' | { action : 'deny' | 'sameorigin' }
    noSniff?                      : boolean
    hsts?                         : boolean | { maxAge? : number, includeSubDomains? : boolean, preload? : boolean }
    downloadOptions?              : boolean
    permittedCrossDomainPolicies? : boolean | 'none' | 'master-only' | 'by-content-type' | 'by-ftp-filename' | 'all'
    /** Invalid tokens are dropped rather than emitted as a malformed header. */
    referrerPolicy?               : boolean | ReferrerPolicyValue
    xssFilter?                    : boolean
    csp?                          : boolean | string | Record<string, string[]>
    coep?                         : boolean | 'require-corp' | 'credentialless' | 'unsafe-none'
    coop?                         : boolean | 'same-origin' | 'same-origin-allow-popups' | 'unsafe-none'
    corp?                         : boolean | 'same-origin' | 'same-site' | 'cross-origin'
    /**
     * `true` denies camera, microphone, and geolocation. An object maps a feature to its
     * allowlist, e.g. `{ camera: [], geolocation: ["'self'"] }`.
     */
    permissionsPolicy?            : boolean | string | Record<string, string | string[]>
}

export function Security( config?: SecurityOptions | boolean ): any { return () => {} }

/**
 * Guard Interface
 */
export interface Guard {
    use( ...args: any[]): void | Promise<void>
}

/**
 * Interceptor Interface
 * Interceptors can wrap the entire request execution.
 * They MUST call next() to continue the chain.
 */
export interface Interceptor {
    intercept( request: any, next: () => Promise<any> ): Promise<any>
}

/**
 * Dependency Injection Decorators
 */
export interface InjectableOptions {
    scope? : Scope
}

export function Injectable( options?: InjectableOptions ): ClassDecorator 
{
    return ( target: any ) => 
    {
        if( options && options.scope !== undefined ) 
        {
            target.__scope__ = options.scope;
        }
    };
}

export function Inject( target: any, key: string | symbol | undefined, index?: number ): void;
export function Inject( token?: any ): any;
export function Inject( arg1?: any, arg2?: any, arg3?: any ): any 
{
    if( arg2 !== undefined || arg3 !== undefined ) { return } // Direct decorator usage

    return ( target: any, key?: string | symbol, index?: number ) => {};
}

/**
 * Module Decorator
 */
export interface ModuleMetadata {
    imports?     : any[]
    controllers? : any[]
    providers?   : any[]
    exports?     : any[]
    /** Default multipart / upload handling for controllers in this module. */
    files?       : FileOptions
    /** Default JSON / query reviver; Endpoint `@Reviver` / `null` overrides. */
    reviver?     : Reviver | null
}

export function Module( metadata: ModuleMetadata ): ClassDecorator 
{
    return ( target: any ) => 
    {
        target.__moduleMetadata__ = metadata;
        target[Symbol.for( 'webergency.server.module' )] = {
            ...metadata,
            global : !!target.__isGlobal__
        };
    };
}

/**
 * Global Module Decorator
 */
export function Global(): ClassDecorator 
{
    return ( target: any ) => 
    {
        target.__isGlobal__ = true;
        const existing = target[Symbol.for( 'webergency.server.module' )] || target.__moduleMetadata__;

        if( existing )
        {
            target[Symbol.for( 'webergency.server.module' )] = { ...existing, global : true };
        }
    };
}

/**
 * Instance lifecycle hooks — called for every constructed provider instance.
 * App/process events stay on Server; injectables only see their own lifetime.
 */
export interface OnInit {
    onInit(): void | Promise<void>
}

export interface OnDestroy {
    onDestroy(): void | Promise<void>
}


