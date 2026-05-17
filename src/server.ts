import { EventEmitter } from 'node:events';
import { Router } from './core/router.js';
import { QueryParser } from './helpers/parsers.js';
import { MetadataStore } from './core/metadata.js';
import { EndpointMetadata, ParamMetadata, AugmentedRequest } from './core/types.js';
import { RequestContext, Context } from './core/context.js';
import { CorsOptions } from './decorators.js';
import { loadAutoMetadata } from './config.js';
import * as path from 'path';
import * as fs from 'fs';

export interface ServerOptions {
  port: number;
  cors?: CorsOptions;
  shutdownTimeout?: number;
  controllers?: any[];
  interceptors?: any[];
  guards?: any[];
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
  private events: { [K in keyof ServerEvents]?: Set<any> } = {};

  constructor(private options: ServerOptions) {
    super();
    this.setupSignals();
  }

  private init() {
    for (const endpoint of MetadataStore.getEndpoints()) {
      this.router.add(endpoint);
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
      console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
      this.shutdown();
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

  public async shutdown() {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;
    this.internalEmit('beforeShutdown');

    if (this.nodeServer) {
      this.nodeServer.close(() => {
        console.log('✔ Node.js server stopped accepting new connections.');
      });
    }

    const timeout = this.options.shutdownTimeout || 10000;
    const startTime = Date.now();

    console.log(`⌛ Waiting for ${this.activeRequests} active requests to finish (Timeout: ${timeout}ms)...`);

    const checkActive = async () => {
      while (this.activeRequests > 0) {
        if (Date.now() - startTime > timeout) {
          console.warn(`⚠️ Shutdown timed out after ${timeout}ms. Force killing ${this.activeRequests} remaining requests.`);
          break;
        }
        await new Promise(r => setTimeout(r, 100));
      }
    };

    await checkActive();
    console.log('👋 Shutdown complete. Goodbye!');
    this.internalEmit('shutdown');
    
    if (typeof process !== 'undefined') process.exit(0);
    else if ((globalThis as any).Deno) (globalThis as any).Deno.exit(0);
  }

  private async getBody(req: AugmentedRequest) {
    if (req._json !== undefined) return req._json;
    const raw = await this.getRawBody(req);
    return req._json = JSON.parse(new TextDecoder().decode(raw));
  }

  private async getRawBody(req: AugmentedRequest) {
    if (req._raw !== undefined) return req._raw;
    return req._raw = await req.arrayBuffer();
  }

  private async resolveParam(p: ParamMetadata, req: AugmentedRequest, ctx: any) {
    let val: any;
    switch (p.source) {
      case 'Param': val = req.params[p.name!]; break;
      case 'Body': val = await this.getBody(req); break;
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
    
    if (this.isShuttingDown) {
      return new Response('Service Unavailable (Shutting Down)', { status: 503 });
    }

    this.activeRequests++;
    
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method;

      const match = this.router.find(method, path);
      
      let finalMatch = match;
      if (!match && method === 'OPTIONS') {
        finalMatch = this.router.find('GET', path) || 
                     this.router.find('POST', path) || 
                     this.router.find('PUT', path) || 
                     this.router.find('DELETE', path);
      }

      if (!finalMatch) return new Response('Not Found', { status: 404 });

      const req = request as AugmentedRequest;
      req.params = finalMatch.params;
      req.query = QueryParser.parse(url.search.startsWith('?') ? url.search.slice(1) : url.search);
      req.globalCors = this.options.cors;
      req.meta = finalMatch.metadata.meta;

      return await this.execute(finalMatch.metadata, req);
    } catch (err: any) {
      this.internalEmit('error', err);
      console.error('Server Error:', err);
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    } finally {
      this.activeRequests--;
    }
  };

  private async execute(metadata: EndpointMetadata, req: AugmentedRequest): Promise<Response> {
    return Context.run({ request: req, metadata }, async () => {
      const controller = MetadataStore.getController(metadata.controller);
    if (!controller) throw new Error(`Controller ${metadata.controller} not registered`);

    const ctx = { success: true, errors: [], mode: "strict" };

    const finalHandler = async () => {
      // 1. Run Guards FIRST (Security gate)
      for (const g of metadata.guards) {
        const guardInstance = g.type === 'class' ? MetadataStore.getGuard(g.name) : controller;
        const guardMethod = g.type === 'class' ? guardInstance.use : guardInstance[g.name];
        
        // Resolve Guard Parameters
        const guardArgs: any[] = [];
        let resolverIdx = 0;
        for (const p of g.params) {
          if (p.source === 'Request' && !p.name && !p.validator) {
            // Special case for backward compat or if it's a positional static arg?
            // Actually, if we have params metadata, we use it.
            guardArgs.push(await this.resolveParam(p, req, ctx));
          } else if (p.source === 'Param' || p.source === 'Body' || p.source === 'Header' || p.source === 'Query' || p.source === 'Context') {
             guardArgs.push(await this.resolveParam(p, req, ctx));
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
        args.push(await this.resolveParam(p, req, ctx));
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
      const status = err.code || 500;
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

    const { port } = this.options;
    const runtime = this.detectRuntime();

    console.log(`📡 Runtime Detected: ${runtime}`);

    if (runtime === 'Bun') {
      (globalThis as any).Bun.serve({ port, fetch: this.fetch });
      console.log(`🚀 Bun server running at http://localhost:${port}`);
      this.internalEmit('start', port);
    } 
    else if (runtime === 'Deno') {
      (globalThis as any).Deno.serve({ port }, this.fetch);
      this.internalEmit('start', port);
    } 
    else {
      await this.startNode(port);
      this.internalEmit('start', port);
    }
  }

  private detectRuntime(): 'Bun' | 'Deno' | 'Node' {
    if ((globalThis as any).Bun) return 'Bun';
    if ((globalThis as any).Deno) return 'Deno';
    return 'Node';
  }

  private async startNode(port: number) {
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
    this.nodeServer.listen(port, () => console.log(`🚀 Node.js bridge server running at http://localhost:${port}`));
  }
}
