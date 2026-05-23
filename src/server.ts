import { EventEmitter } from 'node:events';
import { Router } from './core/router.js';
import { QueryParser } from './helpers/parsers.js';
import { MetadataStore } from './core/metadata.js';
import { EndpointMetadata, ParamMetadata, AugmentedRequest, Logger, LogContext } from './core/types.js';
import { RequestContext, Context } from './core/context.js';
import { CorsOptions, SecurityOptions } from './decorators.js';
import { loadAutoMetadata } from './config.js';
import { handleCors } from './helpers/cors.js';
import { mergeSecurityConfigs, generateSecurityHeaders, parseSize } from './helpers/security.js';
import * as path from 'path';
import * as fs from 'fs';

export class ConsoleLogger implements Logger {
  info(message: any, context?: LogContext) {
    console.log(message);
  }
  warn(message: any, context?: LogContext) {
    console.warn(message);
  }
  error(message: any, context?: LogContext) {
    console.error(message);
  }
  debug(message: any, context?: LogContext) {
    console.debug(message);
  }
}

export interface ServerOptions {
  port: number;
  cors?: CorsOptions;
  security?: SecurityOptions | boolean;
  shutdownTimeout?: number;
  controllers?: any[];
  interceptors?: any[];
  guards?: any[];
  logs?: boolean;
  logger?: Logger;
  module?: any | any[];
}

export type ServerEvents = {
  start: (port: number) => void;
  beforeShutdown: () => void;
  shutdown: () => void;
  request: (req: Request) => void;
  error: (err: Error) => void;
};

export class Server extends EventEmitter {
  private router = new Router();
  private activeRequests = 0;
  private isShuttingDown = false;
  private nodeServer?: any;
  private rateLimitStore = new Map<string, { count: number; resetTime: number }>();
  private events: { [K in keyof ServerEvents]?: Set<any> } = {};
  public logger: Logger;

  constructor(private options: ServerOptions) {
    super();
    this.logger = options.logger || new ConsoleLogger();
    this.setupSignals();
  }

  private collectModuleElements(moduleClass: any, activeControllers: Set<string>, visitedModules = new Set<any>()): any {
    if (!moduleClass) return null;

    let actualModuleClass = moduleClass;
    let metadata: any = {};

    if (moduleClass && typeof moduleClass === 'object' && 'module' in moduleClass) {
      actualModuleClass = moduleClass.module;
      metadata = moduleClass;
    } else if (moduleClass && typeof moduleClass === 'object' && '__moduleMetadata__' in moduleClass) {
      metadata = moduleClass.__moduleMetadata__;
    } else if (moduleClass && typeof moduleClass === 'function') {
      metadata = moduleClass.__moduleMetadata__ || moduleClass.prototype?.__moduleMetadata__ || {};
    }

    const moduleName = (actualModuleClass.name && actualModuleClass.name !== 'Object') 
      ? actualModuleClass.name 
      : (actualModuleClass.constructor?.name && actualModuleClass.constructor.name !== 'Object' 
        ? actualModuleClass.constructor.name 
        : 'DynamicModule');

    let moduleInstance = MetadataStore.getModuleInstance(actualModuleClass);
    if (!moduleInstance) {
      moduleInstance = MetadataStore.createModuleInstance(moduleName, actualModuleClass);
    }

    if (actualModuleClass && (actualModuleClass.__isGlobal__ || moduleClass.__isGlobal__)) {
      MetadataStore.registerGlobalModule(moduleInstance);
    }

    if (visitedModules.has(actualModuleClass)) {
      return moduleInstance;
    }
    visitedModules.add(actualModuleClass);

    if (actualModuleClass && actualModuleClass.name) {
      MetadataStore.registerModule(actualModuleClass.name, actualModuleClass);
      MetadataStore.registerProvider(actualModuleClass.name, actualModuleClass);
      moduleInstance.providers.set(actualModuleClass.name, actualModuleClass);
      MetadataStore.mapClassToModule(actualModuleClass, moduleInstance);
      MetadataStore.mapTokenToModule(actualModuleClass.name, moduleInstance);
    }

    // 1. Process providers
    if (metadata.providers) {
      for (const provider of metadata.providers) {
        let token: string;
        let providerClass: any;
        if (typeof provider === 'function') {
          token = provider.name;
          providerClass = provider;
        } else if (provider && typeof provider === 'object') {
          if ('provide' in provider) {
            token = typeof provider.provide === 'function' ? provider.provide.name : provider.provide;
            providerClass = provider;
          } else {
            token = provider.constructor?.name || 'UnknownProvider';
            providerClass = provider;
          }
        } else {
          continue;
        }

        moduleInstance.providers.set(token, providerClass);
        const actualClass = typeof provider === 'function' ? provider : (provider && typeof provider === 'object' && 'useClass' in provider ? provider.useClass : null);
        if (actualClass) {
          MetadataStore.mapClassToModule(actualClass, moduleInstance);
        }
        MetadataStore.mapTokenToModule(token, moduleInstance);
        MetadataStore.registerProvider(token, provider);
      }
    }

    // 2. Process controllers
    if (metadata.controllers) {
      for (const ctrl of metadata.controllers) {
        const ctrlName = ctrl.name || ctrl;
        activeControllers.add(ctrlName);
        
        moduleInstance.controllers.set(ctrlName, ctrl);
        MetadataStore.mapClassToModule(ctrl, moduleInstance);
        MetadataStore.mapTokenToModule(ctrlName, moduleInstance);
        MetadataStore.registerController(ctrlName, ctrl);
      }
    }

    // 3. Process exports
    if (metadata.exports) {
      for (const exp of metadata.exports) {
        const expName = exp.name || exp;
        moduleInstance.exports.add(expName);
      }
    }

    // 4. Process imports
    if (metadata.imports) {
      for (const imp of metadata.imports) {
        const impInstance = this.collectModuleElements(imp, activeControllers, visitedModules);
        if (impInstance) {
          moduleInstance.imports.add(impInstance);
        }
      }
    }

    return moduleInstance;
  }

  private init() {
    const activeControllers = new Set<string>();

    if (this.options.module) {
      const modules = Array.isArray(this.options.module) ? this.options.module : [this.options.module];
      for (const mod of modules) {
        this.collectModuleElements(mod, activeControllers);
      }
    } else if (this.options.controllers) {
      for (const ctrl of this.options.controllers) {
        activeControllers.add(ctrl.name || ctrl);
      }
    }

    MetadataStore.resolveAll();
    for (const endpoint of MetadataStore.getEndpoints()) {
      if (activeControllers.size > 0 && !activeControllers.has(endpoint.controller)) {
        continue;
      }
      this.router.add(endpoint);
      if (this.options.logs) {
        this.logger.info(
          `Registered route: ${endpoint.httpMethod.padEnd(6)} ${endpoint.path} -> ${endpoint.controller}.${endpoint.methodName}`,
          {
            type: 'registration',
            method: endpoint.httpMethod,
            path: endpoint.path,
            controller: endpoint.controller,
            action: endpoint.methodName
          }
        );
      }
    }
  }


  public on<K extends keyof ServerEvents>(event: K, handler: ServerEvents[K]) {
    if (!this.events[event]) this.events[event] = new Set();
    this.events[event]!.add(handler);
    return this;
  }

  public off<K extends keyof ServerEvents>(event: K, handler: ServerEvents[K]) {
    this.events[event]?.delete(handler);
    return this;
  }

  private internalEmit<K extends keyof ServerEvents>(event: K, ...args: Parameters<ServerEvents[K]>) {
    this.events[event]?.forEach(h => h(...args));
  }

  private setupSignals() {
    const handleSignal = (signal: string) => {
      this.logger.warn(`\nReceived ${signal}. Starting graceful shutdown...`, {
        type: 'server_shutdown',
        reason: signal
      });
      this.shutdown(signal);
    };

    if (typeof process !== 'undefined') {
      process.on('SIGTERM', () => handleSignal('SIGTERM'));
      process.on('SIGINT', () => handleSignal('SIGINT'));
    } 
    else if ((globalThis as any).Deno) {
      (globalThis as any).Deno.addSignalListener('SIGTERM', () => handleSignal('SIGTERM'));
      (globalThis as any).Deno.addSignalListener('SIGINT', () => handleSignal('SIGINT'));
    }
  }

  public async shutdown(signal?: string) {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;
    this.internalEmit('beforeShutdown');

    await MetadataStore.invokeHook('onModuleDestroy');
    await MetadataStore.invokeHook('beforeApplicationShutdown', signal);

    if (this.nodeServer) {
      this.nodeServer.close(() => {
        this.logger.info('Node.js server stopped accepting new connections.', {
          type: 'server_shutdown',
          reason: 'connections_closed'
        });
      });
    }

    const timeout = this.options.shutdownTimeout || 10000;
    const startTime = Date.now();

    this.logger.info(`Waiting for ${this.activeRequests} active requests to finish (Timeout: ${timeout}ms)...`, {
      type: 'server_shutdown',
      activeRequests: this.activeRequests,
      timeout
    });

    const checkActive = async () => {
      while (this.activeRequests > 0) {
        if (Date.now() - startTime > timeout) {
          this.logger.warn(`Shutdown timed out after ${timeout}ms. Force killing ${this.activeRequests} remaining requests.`, {
            type: 'server_shutdown',
            reason: 'timeout',
            activeRequests: this.activeRequests
          });
          break;
        }
        await new Promise(r => setTimeout(r, 100));
      }
    };

    await checkActive();
    await MetadataStore.invokeHook('onApplicationShutdown', signal);

    this.logger.info('Shutdown complete. Goodbye!', {
      type: 'server_shutdown',
      reason: 'complete'
    });
    this.internalEmit('shutdown');
    
    if (typeof process !== 'undefined') process.exit(0);
    else if ((globalThis as any).Deno) (globalThis as any).Deno.exit(0);
  }

  private async getBody(req: AugmentedRequest, securityConfig?: SecurityOptions) {
    if (req._json !== undefined) return req._json;
    const raw = await this.getRawBody(req, securityConfig);
    return req._json = JSON.parse(new TextDecoder().decode(raw));
  }

  private async getRawBody(req: AugmentedRequest, securityConfig?: SecurityOptions) {
    if (req._raw !== undefined) return req._raw;
    const maxSize = securityConfig?.maxBodySize;
    if (maxSize !== undefined) {
      const limit = parseSize(maxSize);
      const contentLength = req.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > limit) {
        throw Object.assign(new Error(`Payload Too Large (limit: ${maxSize})`), { status: 413 });
      }
    }
    const buffer = await req.arrayBuffer();
    if (maxSize !== undefined) {
      const limit = parseSize(maxSize);
      if (buffer.byteLength > limit) {
        throw Object.assign(new Error(`Payload Too Large (limit: ${maxSize})`), { status: 413 });
      }
    }
    return req._raw = buffer;
  }

  private async resolveParam(p: ParamMetadata, req: AugmentedRequest, ctx: any, securityConfig?: SecurityOptions, contextModule?: any) {
    let val: any;
    switch (p.source) {
      case 'Param': val = req.params[p.name!]; break;
      case 'Body': val = await this.getBody(req, securityConfig); break;
      case 'Query': val = p.name ? req.query[p.name] : req.query; break;
      case 'Header': val = req.headers.get(p.name!); break;
      case 'Headers': val = Object.fromEntries(req.headers.entries()); break;
      case 'Request': val = req; break;
      case 'Response': val = undefined; break;
      case 'Ip': val = req.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1"; break;
      case 'Url': val = req.url; break;
      case 'Hostname': val = new URL(req.url).hostname; break;
      case 'Path': val = new URL(req.url).pathname; break;
      case 'Context': val = Context.get(); break;
      case 'Inject': val = MetadataStore.getInjectable(p.name!, contextModule); break;
    }

    if (p.validator && typeof p.validator === 'function') {
      const oldMode = ctx.mode;
      const oldTryConvert = ctx.tryConvert;
      
      if (p.mode) ctx.mode = p.mode;
      if (p.source === 'Query' || p.source === 'Param') {
        ctx.tryConvert = true;
        ctx.wrapArrays = true;
      }
      
      val = p.validator(val, p.name || p.source.toLowerCase(), ctx);
      
      ctx.mode = oldMode;
      ctx.tryConvert = oldTryConvert;
    }
    return val;
  }

  public fetch = async (request: Request): Promise<Response> => {
    this.internalEmit('request', request);
    
    const applyCors = (res: Response, config: any): Response => {
      if (!config) return res;
      const corsHeaders = handleCors(request, config);
      if (corsHeaders && !(corsHeaders instanceof Response)) {
        try {
          for (const [key, value] of Object.entries(corsHeaders)) {
            res.headers.set(key, value);
          }
          return res;
        } catch (e) {
          const newHeaders = new Headers(res.headers);
          for (const [key, value] of Object.entries(corsHeaders)) {
            newHeaders.set(key, value);
          }
          return new Response(res.body, {
            status: res.status,
            statusText: res.statusText,
            headers: newHeaders
          });
        }
      }
      return res;
    };

    const applySecurityHeaders = (res: Response, config: any): Response => {
      if (config === undefined) return res;
      const headers = generateSecurityHeaders(config);
      try {
        for (const [key, value] of Object.entries(headers)) {
          res.headers.set(key, value);
        }
        return res;
      } catch (e) {
        const newHeaders = new Headers(res.headers);
        for (const [key, value] of Object.entries(headers)) {
          newHeaders.set(key, value);
        }
        return new Response(res.body, {
          status: res.status,
          statusText: res.statusText,
          headers: newHeaders
        });
      }
    };

    if (this.isShuttingDown) {
      let res = new Response('Service Unavailable (Shutting Down)', { status: 503 });
      res = applyCors(res, this.options.cors);
      res = applySecurityHeaders(res, mergeSecurityConfigs([this.options.security]));
      return res;
    }

    this.activeRequests++;
    const startTime = Date.now();
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    
    if (this.options.logs) {
      this.logger.info(`--> ${method} ${path}${url.search ? url.search : ''}`, {
        type: 'request_start',
        method,
        path,
        url: request.url
      });
    }

    let finalMatch: any = null;
    try {
      const match = this.router.find(method, path);
      
      finalMatch = match;
      if (!match && method === 'OPTIONS') {
        finalMatch = this.router.find('GET', path) || 
                     this.router.find('POST', path) || 
                     this.router.find('PUT', path) || 
                     this.router.find('DELETE', path);
      }

      const corsConfig = finalMatch ? (finalMatch.metadata.cors !== undefined ? finalMatch.metadata.cors : this.options.cors) : this.options.cors;
      const routeSecurity = finalMatch ? finalMatch.metadata.security : undefined;
      const securityConfig = mergeSecurityConfigs([this.options.security, routeSecurity]);

      if (method === 'OPTIONS' && corsConfig) {
        const corsRes = handleCors(request, corsConfig);
        if (corsRes instanceof Response) {
          if (this.options.logs) {
            const duration = Date.now() - startTime;
            this.logger.info(`<-- ${method} ${path} - 204 CORS Preflight (${duration}ms)`, {
              type: 'request_end',
              method,
              path,
              status: 204,
              duration
            });
          }
          return applySecurityHeaders(corsRes, securityConfig);
        }
      }

      if (!finalMatch) {
        if (this.options.logs) {
          const duration = Date.now() - startTime;
          this.logger.info(`<-- ${method} ${path} - 404 Not Found (${duration}ms)`, {
            type: 'request_end',
            method,
            path,
            status: 404,
            duration
          });
        }
        let res = new Response('Not Found', { status: 404 });
        res = applyCors(res, this.options.cors);
        res = applySecurityHeaders(res, mergeSecurityConfigs([this.options.security]));
        return res;
      }

      const req = request as AugmentedRequest;
      req.params = finalMatch.params;
      req.query = QueryParser.parse(url.search.startsWith('?') ? url.search.slice(1) : url.search);
      req.globalCors = this.options.cors;
      req.cors = finalMatch.metadata.cors;
      req.globalSecurity = this.options.security;
      req.security = finalMatch.metadata.security;
      req.meta = finalMatch.metadata.meta;

      // Enforce allowedContentTypes
      if (securityConfig?.allowedContentTypes && method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
        const contentType = request.headers.get('content-type')?.split(';')[0]?.trim()?.toLowerCase();
        if (contentType && !securityConfig.allowedContentTypes.some(t => t.toLowerCase() === contentType)) {
          throw Object.assign(new Error(`Unsupported Media Type: ${contentType}`), { status: 415 });
        }
      }

      // Enforce rateLimit
      if (securityConfig?.rateLimit) {
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
        const limitConfig = securityConfig.rateLimit;
        const max = limitConfig.max;
        const windowOption = limitConfig.window || '1m';
        let windowMs = 60000;
        if (typeof windowOption === 'number') {
          windowMs = windowOption;
        } else if (typeof windowOption === 'string') {
          const match = windowOption.trim().toLowerCase().match(/^(\d+)(s|m|h)$/);
          if (match) {
            const val = parseInt(match[1], 10);
            const unit = match[2];
            if (unit === 's') windowMs = val * 1000;
            else if (unit === 'm') windowMs = val * 60000;
            else if (unit === 'h') windowMs = val * 3600000;
          }
        }
        
        const now = Date.now();
        const storeKey = `${path}:${ip}`;
        let clientRecord = this.rateLimitStore.get(storeKey);
        if (!clientRecord || now > clientRecord.resetTime) {
          clientRecord = { count: 0, resetTime: now + windowMs };
        }
        clientRecord.count++;
        this.rateLimitStore.set(storeKey, clientRecord);

        if (clientRecord.count > max) {
          throw Object.assign(new Error('Too Many Requests'), { status: 429 });
        }
      }

      // Enforce timeout
      let response: Response;
      if (securityConfig?.timeout) {
        const timeoutMs = securityConfig.timeout;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          response = await Promise.race([
            this.execute(finalMatch.metadata, req, securityConfig),
            new Promise<never>((_, reject) => {
              controller.signal.addEventListener('abort', () => {
                reject(Object.assign(new Error(`Request Timeout (${timeoutMs}ms)`), { status: 408 }));
              });
            })
          ]);
        } finally {
          clearTimeout(timer);
        }
      } else {
        response = await this.execute(finalMatch.metadata, req, securityConfig);
      }

      response = applyCors(response, corsConfig);
      response = applySecurityHeaders(response, securityConfig);
      
      if (this.options.logs) {
        const duration = Date.now() - startTime;
        this.logger.info(`<-- ${method} ${path} - ${response.status} (${duration}ms)`, {
          type: 'request_end',
          method,
          path,
          status: response.status,
          duration
        });
      }
      return response;
    } catch (err: any) {
      this.internalEmit('error', err);
      this.logger.error(`Server Error: ${err.message}`, {
        type: 'error',
        error: err
      });
      if (this.options.logs) {
        const duration = Date.now() - startTime;
        this.logger.info(`<-- ${method} ${path} - 500 Internal Server Error (${duration}ms)`, {
          type: 'request_end',
          method,
          path,
          status: 500,
          duration
        });
      }
      
      const corsConfig = finalMatch ? (finalMatch.metadata.cors !== undefined ? finalMatch.metadata.cors : this.options.cors) : this.options.cors;
      const routeSecurity = finalMatch ? finalMatch.metadata.security : undefined;
      const errSecurityConfig = mergeSecurityConfigs([this.options.security, routeSecurity]);
      const statusCode = err.status || 500;
      
      let res = new Response(JSON.stringify({ success: false, error: err.message }), {
        status: statusCode,
        headers: { 'Content-Type': 'application/json' }
      });
      res = applyCors(res, corsConfig);
      res = applySecurityHeaders(res, errSecurityConfig);
      return res;
    } finally {
      this.activeRequests--;
    }
  };


  private async execute(metadata: EndpointMetadata, req: AugmentedRequest, securityConfig?: SecurityOptions): Promise<Response> {
    return Context.run({ request: req, metadata, requestInstances: new Map<string, any>() }, async () => {
      const controllerModule = MetadataStore.getTokenModule(metadata.controller);
      const controller = MetadataStore.getController(metadata.controller, controllerModule);
    if (!controller) throw new Error(`Controller ${metadata.controller} not registered`);

    const ctx = { success: true, errors: [], mode: "strict" };

    const finalHandler = async () => {
      // 1. Run Guards FIRST (Security gate)
      for (const g of metadata.guards) {
        const guardModule = g.type === 'class' ? MetadataStore.getTokenModule(g.name) : controllerModule;
        const guardInstance = g.type === 'class' ? MetadataStore.getGuard(g.name, guardModule) : controller;
        const guardMethod = g.type === 'class' ? guardInstance.use : guardInstance[g.name];
        
        // Resolve Guard Parameters
        const guardArgs: any[] = [];
        let resolverIdx = 0;
        for (const p of g.params) {
          if (p.source === 'Request' && !p.name && !p.validator) {
            // Special case for backward compat or if it's a positional static arg?
            // Actually, if we have params metadata, we use it.
            guardArgs.push(await this.resolveParam(p, req, ctx, securityConfig, guardModule));
          } else if (p.source === 'Param' || p.source === 'Body' || p.source === 'Header' || p.source === 'Query' || p.source === 'Context' || p.source === 'Inject') {
             guardArgs.push(await this.resolveParam(p, req, ctx, securityConfig, guardModule));
          } else {
            // Positional static arg from CallExpression (resolver)
            guardArgs.push(g.resolvers[resolverIdx++]);
          }
        }

        // If no params metadata (legacy or method-based without decorators), fallback to resolvers
        const finalArgs = guardArgs.length > 0 ? guardArgs : g.resolvers;
        
        await guardMethod.apply(guardInstance, finalArgs);
      }

      // 2. Resolve parameters (Parsing & Validation)
      const args: any[] = [];
      for (const p of metadata.params) {
        args.push(await this.resolveParam(p, req, ctx, securityConfig, controllerModule));
      }

      if (!ctx.success) {
        return new Response(JSON.stringify({ success: false, errors: ctx.errors }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // 3. Execute Method
      const result = await controller[metadata.methodName](...args);
      return (result instanceof Response) ? result : (typeof result === "object" ? new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } }) : new Response(String(result || "")));
    };

    // 4. Wrap in Interceptor Chain
    let chain = finalHandler;
    for (const iName of [...metadata.interceptors].reverse()) {
      const interceptor = MetadataStore.getInterceptor(iName);
      const next = chain;
      chain = () => interceptor.intercept(req, next);
    }

    try {
      return await chain();
    } catch (err: any) {
      const status = err.status || err.code || 500;
      return new Response(JSON.stringify(err.data || { success: false, error: err.message }), { 
        status, 
        headers: { "Content-Type": "application/json" } 
      });
    }
    });
  }

  public async start() {
    if (MetadataStore.getEndpoints().length === 0) {
      await loadAutoMetadata();
    }
    this.init();
    await MetadataStore.invokeHook('onModuleInit');

    const { port } = this.options;
    const runtime = this.detectRuntime();

    this.logger.info(`📡 Runtime Detected: ${runtime}`, {
      type: 'server_start',
      runtime
    });

    if (runtime === 'Bun') {
      (globalThis as any).Bun.serve({ port, fetch: this.fetch });
      this.logger.info(`Bun server running at http://localhost:${port}`, {
        type: 'server_start',
        runtime: 'Bun',
        port
      });
      await MetadataStore.invokeHook('onApplicationBootstrap');
      this.internalEmit('start', port);
    } 
    else if (runtime === 'Deno') {
      (globalThis as any).Deno.serve({ port }, this.fetch);
      this.logger.info(`Deno server running at http://localhost:${port}`, {
        type: 'server_start',
        runtime: 'Deno',
        port
      });
      await MetadataStore.invokeHook('onApplicationBootstrap');
      this.internalEmit('start', port);
    } 
    else {
      await this.startNode(port);
      await MetadataStore.invokeHook('onApplicationBootstrap');
      this.internalEmit('start', port);
    }
  }

  private detectRuntime(): 'Bun' | 'Deno' | 'Node' {
    if ((globalThis as any).Bun) return 'Bun';
    if ((globalThis as any).Deno) return 'Deno';
    return 'Node';
  }

  private async startNode(port: number): Promise<void> {
    const { createServer } = await import('http');
    this.nodeServer = createServer(async (req, res) => {
      const protocol = (req.socket as any).encrypted ? 'https' : 'http';
      const url = `${protocol}://${req.headers.host}${req.url}`;
      const fetchReq = new Request(url, {
        method: req.method,
        headers: req.headers as any,
        body: ['GET', 'HEAD'].includes(req.method || '') ? undefined : (req as any),
        // @ts-ignore
        duplex: 'half'
      });
      const response = await this.fetch(fetchReq);
      res.statusCode = response.status;
      response.headers.forEach((value, key) => res.setHeader(key, value));
      if (response.body) {
        const { Readable } = await import('stream');
        // @ts-ignore
        Readable.fromWeb(response.body).pipe(res);
      } else res.end();
    });
    return new Promise<void>((resolve) => {
      this.nodeServer.listen(port, () => {
        this.logger.info(`Node.js bridge server running at http://localhost:${port}`, {
          type: 'server_start',
          runtime: 'Node',
          port
        });
        resolve();
      });
    });
  }
}
