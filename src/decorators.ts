/**
 * PARAMETER DECORATORS (Strict - No Parentheses)
 */
export const Request = (target: any, key: string | symbol, idx: number) => {};
export const Context = (target: any, key: string | symbol, idx: number) => {};
export const Response = (target: any, key: string | symbol, idx: number) => {};
export const Headers = (target: any, key: string | symbol, idx: number) => {};
export const Ip = (target: any, key: string | symbol, idx: number) => {};

/**
 * PARAMETER DECORATORS (Hybrid - Parentheses optional)
 */
export function Body(target: any, key: string | symbol, idx: number): void;
export function Body(mode?: 'strict' | 'strip'): ParameterDecorator;
export function Body(arg1: any, arg2?: any, arg3?: any): any {
  if (arg3 !== undefined) return; // Direct decorator usage
  return (target: any, key: string | symbol, idx: number) => {}; 
}

export function Query(target: any, key: string | symbol, idx: number): void;
export function Query(name?: string, mode?: 'strict' | 'strip'): ParameterDecorator;
export function Query(arg1: any, arg2?: any, arg3?: any): any {
  if (arg3 !== undefined) return; // Direct decorator usage
  return (target: any, key: string | symbol, idx: number) => {}; 
}

export const Param = (name: string): ParameterDecorator => (target: any, key: string | symbol | undefined, idx: number) => {};
export const Header = (name: string): ParameterDecorator => (target: any, key: string | symbol | undefined, idx: number) => {};
export const ConnectedSocket = (): ParameterDecorator => (target: any, key: string | symbol | undefined, idx: number) => {};

/**
 * CLASS/METHOD DECORATORS (Strict Paren-free)
 */
export function Public(target: any): void; 
export function Public(target: any, key: string | symbol, descriptor: any): void; 
export function Public(arg1: any, arg2?: any, arg3?: any): void {}

export enum Scope {
  DEFAULT = 0,
  TRANSIENT = 1,
  REQUEST = 2
}

export interface ControllerOptions {
  path?: string;
  scope?: Scope;
}

export function Controller(prefixOrOptions?: string | ControllerOptions): ClassDecorator {
  return (target: any) => {
    let prefix = '';
    let scope: Scope | undefined;
    if (typeof prefixOrOptions === 'string') {
      prefix = prefixOrOptions;
    } else if (prefixOrOptions && typeof prefixOrOptions === 'object') {
      prefix = prefixOrOptions.path || '';
      scope = prefixOrOptions.scope;
    }
    target.prototype.prefix = prefix;
    if (scope !== undefined) {
      target.__scope__ = scope;
    }
  };
}

export interface WsOptions {
  pingInterval?: number;
  pingTimeout?: number;
  maxPayload?: number;
}

export function Get(path: string = ''): MethodDecorator { return () => {}; }
export function Post(path: string = ''): MethodDecorator { return () => {}; }
export function Put(path: string = ''): MethodDecorator { return () => {}; }
export function Delete(path: string = ''): MethodDecorator { return () => {}; }
export function Patch(path: string = ''): MethodDecorator { return () => {}; }
export function Head(path: string = ''): MethodDecorator { return () => {}; }
export function All(path: string = ''): MethodDecorator { return () => {}; }
export function Ws(path: string = '', options?: WsOptions): MethodDecorator { return () => {}; }
export function Sse(path: string = ''): MethodDecorator { return () => {}; }

export function MessagePattern(pattern: string): MethodDecorator { return () => {}; }
export function EventPattern(pattern: string): MethodDecorator { return () => {}; }

export function Payload(target: any, key: string | symbol, idx: number): void;
export function Payload(name?: string): ParameterDecorator;
export function Payload(arg1?: any, arg2?: any, arg3?: any): any {
  if (arg3 !== undefined) return; // Direct decorator usage
  return (target: any, key: string | symbol, idx: number) => {}; 
}

export function Meta(...metas: Record<string, any>[]): any {
  return (target: any, propertyKey?: string | symbol, descriptor?: TypedPropertyDescriptor<any>) => {
    const mergedMeta = Object.assign({}, ...metas);

    // Class decorator
    if (propertyKey === undefined) {
      if (!target.__metadata__) {
        target.__metadata__ = {};
      }
      Object.assign(target.__metadata__, mergedMeta);
      return target;
    }

    // Method decorator
    let targetMethod = descriptor?.value;
    if (!targetMethod && propertyKey !== undefined) {
      targetMethod = target[propertyKey];
    }

    if (targetMethod && typeof targetMethod === 'function') {
      if (!targetMethod.__metadata__) {
        targetMethod.__metadata__ = {};
      }
      Object.assign(targetMethod.__metadata__, mergedMeta);
    } else {
      if (!target.__metadata__) {
        target.__metadata__ = {};
      }
      if (!target.__metadata__[propertyKey]) {
        target.__metadata__[propertyKey] = {};
      }
      Object.assign(target.__metadata__[propertyKey], mergedMeta);
    }

    return descriptor;
  };
}

export function SetMetadata<K = any, V = any>(key: K, value: V): any {
  return Meta({ [key as any]: value });
}

export function Protect(guard: string | Function, ...guards: (string | Function)[]): any { return () => {}; }
export function Intercept(...interceptors: any[]): any { return () => {}; }
export function ResponseMode(mode: 'strict' | 'relaxed' | 'strip'): any { return () => {}; }

export interface CorsOptions {
  origin?: string | string[] | boolean | Function;
  methods?: string | string[] | Function;
  allowedHeaders?: string | string[] | Function;
  exposedHeaders?: string | string[];
  credentials?: boolean;
  maxAge?: number;
}

export function Cors(config?: CorsOptions | string): any { return () => {}; }

export interface SecurityOptions {
  /** Request Protection */
  maxBodySize?: string | number;
  timeout?: number;
  rateLimit?: { max: number; window?: string | number };
  allowedContentTypes?: string[];

  /** Response Headers */
  frameguard?: boolean | 'deny' | 'sameorigin' | { action: 'deny' | 'sameorigin' };
  noSniff?: boolean;
  hsts?: boolean | { maxAge?: number; includeSubDomains?: boolean; preload?: boolean };
  downloadOptions?: boolean;
  permittedCrossDomainPolicies?: boolean | 'none' | 'master-only' | 'by-content-type' | 'all';
  referrerPolicy?: boolean | string;
  xssFilter?: boolean;
  csp?: boolean | string | Record<string, string[]>;
  coep?: boolean | 'require-corp' | 'credentialless' | 'unsafe-none';
  coop?: boolean | 'same-origin' | 'same-origin-allow-popups' | 'unsafe-none';
  corp?: boolean | 'same-origin' | 'same-site' | 'cross-origin';
}

export function Security(config?: SecurityOptions | boolean): any { return () => {}; }

/**
 * Guard Interface
 */
export interface Guard {
  use(...args: any[]): void | Promise<void>;
}

/**
 * Interceptor Interface
 * Interceptors can wrap the entire request execution.
 * They MUST call next() to continue the chain.
 */
export interface Interceptor {
  intercept(request: any, next: () => Promise<any>): Promise<any>;
}

/**
 * Dependency Injection Decorators
 */
export interface InjectableOptions {
  scope?: Scope;
}

export function Injectable(options?: InjectableOptions): ClassDecorator {
  return (target: any) => {
    if (options && options.scope !== undefined) {
      target.__scope__ = options.scope;
    }
  };
}

export function Inject(token?: any): any {
  return (target: any, key?: string | symbol, index?: number) => {};
}

/**
 * Module Decorator
 */
export interface ModuleMetadata {
  imports?: any[];
  controllers?: any[];
  providers?: any[];
  exports?: any[];
}

export function Module(metadata: ModuleMetadata): ClassDecorator {
  return (target: any) => {
    target.__moduleMetadata__ = metadata;
  };
}

/**
 * Global Module Decorator
 */
export function Global(): ClassDecorator {
  return (target: any) => {
    target.__isGlobal__ = true;
  };
}

/**
 * Lifecycle Hook Interfaces
 */
export interface OnModuleInit {
  onModuleInit(): void | Promise<void>;
}

export interface OnApplicationBootstrap {
  onApplicationBootstrap(): void | Promise<void>;
}

export interface OnModuleDestroy {
  onModuleDestroy(): void | Promise<void>;
}

export interface BeforeApplicationShutdown {
  beforeApplicationShutdown(signal?: string): void | Promise<void>;
}

export interface OnApplicationShutdown {
  onApplicationShutdown(signal?: string): void | Promise<void>;
}


