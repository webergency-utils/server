import { Context } from './context.js';
import { MetadataStore } from './metadata.js';
import { RequestReader } from '../helpers/request-reader.js';
import { EndpointMetadata, ParamMetadata, AugmentedRequest } from './types.js';
import { SecurityOptions } from '../decorators.js';

export class RequestProcessor {
  public static async resolveParam(
    p: ParamMetadata,
    req: AugmentedRequest,
    ctx: any,
    securityConfig?: SecurityOptions,
    contextModule?: any
  ): Promise<any> {
    let val: any;
    switch (p.source) {
      case 'Param': val = req.params[p.name!]; break;
      case 'Body': val = await RequestReader.getBody(req, securityConfig); break;
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

  public static async execute(
    metadata: EndpointMetadata,
    req: AugmentedRequest,
    securityConfig?: SecurityOptions
  ): Promise<Response> {
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
              guardArgs.push(await this.resolveParam(p, req, ctx, securityConfig, guardModule));
            } else if (p.source === 'Param' || p.source === 'Body' || p.source === 'Header' || p.source === 'Query' || p.source === 'Context' || p.source === 'Inject') {
               guardArgs.push(await this.resolveParam(p, req, ctx, securityConfig, guardModule));
            } else {
              guardArgs.push(g.resolvers[resolverIdx++]);
            }
          }

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
}
