import { EndpointMetadata } from './types.js';
import { Scope } from '../decorators.js';
import { Context } from './context.js';

const GLOBAL_KEY = '__WEBERGENCY_SERVER_METADATA_STORE__';

if (!(globalThis as any)[GLOBAL_KEY]) {
  (globalThis as any)[GLOBAL_KEY] = {
    endpoints: [] as EndpointMetadata[],
    controllers: new Map<string, any>(),
    guards: new Map<string, any>(),
    interceptors: new Map<string, any>(),
    providers: new Map<string, any>(),
    modules: new Map<string, any>(),
    instances: new Map<string, any>(),
    resolving: new Set<string>(),
    controllerClasses: new Set<string>(),
    guardClasses: new Set<string>(),
    interceptorClasses: new Set<string>(),
    moduleInstances: new Map<any, any>(),
    classToModuleMap: new Map<any, any>(),
    tokenToModuleMap: new Map<string, any>(),
    globalModules: new Set<any>()
  };
} else {
  const gStore = (globalThis as any)[GLOBAL_KEY];
  if (!gStore.moduleInstances) gStore.moduleInstances = new Map<any, any>();
  if (!gStore.classToModuleMap) gStore.classToModuleMap = new Map<any, any>();
  if (!gStore.tokenToModuleMap) gStore.tokenToModuleMap = new Map<string, any>();
  if (!gStore.globalModules) gStore.globalModules = new Set<any>();
}

const store = (globalThis as any)[GLOBAL_KEY];

export class MetadataStore {
  public static registerEndpoint(metadata: EndpointMetadata) {
    store.endpoints.push(metadata);
  }

  public static getEndpoints(): EndpointMetadata[] {
    return store.endpoints;
  }

  public static registerProvider(token: string, provider: any) {
    store.providers.set(token, provider);
  }

  public static registerModule(name: string, moduleClass: any) {
    store.modules.set(name, moduleClass);
  }

  public static getModule(name: string): any {
    return store.modules.get(name);
  }

  public static getProvider(token: string): any {
    return store.providers.get(token);
  }

  public static getModuleInstance(moduleClass: any): any {
    return store.moduleInstances.get(moduleClass);
  }

  public static createModuleInstance(name: string, moduleClass: any): any {
    const instance = {
      name,
      moduleClass,
      providers: new Map<string, any>(),
      controllers: new Map<string, any>(),
      exports: new Set<string>(),
      imports: new Set<any>(),
      instances: new Map<string, any>()
    };
    store.moduleInstances.set(moduleClass, instance);
    return instance;
  }

  public static getModuleInstances(): any[] {
    return Array.from(store.moduleInstances.values());
  }

  public static mapClassToModule(cls: any, moduleInstance: any) {
    store.classToModuleMap.set(cls, moduleInstance);
  }

  public static getClassModule(cls: any): any {
    return store.classToModuleMap.get(cls);
  }

  public static mapTokenToModule(token: string, moduleInstance: any) {
    store.tokenToModuleMap.set(token, moduleInstance);
  }

  public static getTokenModule(token: string): any {
    return store.tokenToModuleMap.get(token);
  }

  public static registerGlobalModule(moduleInstance: any) {
    store.globalModules.add(moduleInstance);
  }

  public static getGlobalModules(): any[] {
    return Array.from(store.globalModules);
  }

  public static registerController(name: string, classOrInstance: any) {
    if (typeof classOrInstance === 'function') {
      store.providers.set(name, classOrInstance);
      store.controllerClasses.add(name);
    } else {
      store.controllers.set(name, classOrInstance);
    }
  }

  public static getController(name: string, contextModule?: any): any {
    if (store.controllers.has(name)) {
      return store.controllers.get(name);
    }
    const actualContext = contextModule || this.getTokenModule(name);
    return this.resolve(name, actualContext);
  }

  public static registerGuard(name: string, classOrInstance: any) {
    if (typeof classOrInstance === 'function') {
      store.providers.set(name, classOrInstance);
      store.guardClasses.add(name);
    } else {
      store.guards.set(name, classOrInstance);
    }
  }

  public static getGuard(name: string, contextModule?: any): any {
    if (store.guards.has(name)) {
      return store.guards.get(name);
    }
    const actualContext = contextModule || this.getTokenModule(name);
    return this.resolve(name, actualContext);
  }

  public static registerInterceptor(name: string, classOrInstance: any) {
    if (typeof classOrInstance === 'function') {
      store.providers.set(name, classOrInstance);
      store.interceptorClasses.add(name);
    } else {
      store.interceptors.set(name, classOrInstance);
    }
  }

  public static getInterceptor(name: string, contextModule?: any): any {
    if (store.interceptors.has(name)) {
      return store.interceptors.get(name);
    }
    const actualContext = contextModule || this.getTokenModule(name);
    return this.resolve(name, actualContext);
  }

  public static getInjectable(name: string, contextModule?: any): any {
    return this.resolve(name, contextModule);
  }

  public static getResolvedScope(token: string, contextModule?: any, visited = new Set<string>()): Scope {
    const key = `${token}::${contextModule ? contextModule.name : 'global'}`;
    if (visited.has(key)) {
      return Scope.DEFAULT;
    }
    visited.add(key);

    const provider = contextModule ? this.locateProviderInScope(token, contextModule) : store.providers.get(token);
    if (!provider) {
      return Scope.DEFAULT;
    }

    let explicitScope: Scope | undefined;
    let providerClass: any;

    if (typeof provider === 'function') {
      providerClass = provider;
      explicitScope = provider.__scope__;
    } else if (provider && typeof provider === 'object') {
      if (provider.scope !== undefined) {
        explicitScope = provider.scope;
      }
      providerClass = provider.useClass;
      if (providerClass && explicitScope === undefined) {
        explicitScope = providerClass.__scope__;
      }
    }

    if (explicitScope === Scope.REQUEST) {
      return Scope.REQUEST;
    }

    let deps: string[] = [];
    if (providerClass) {
      const injections = providerClass.__injections__ || {};
      const constructorDeps = injections.constructorDeps || [];
      const propertyDeps = Object.values(this.collectPropertyDeps(providerClass)) as string[];
      deps = [...constructorDeps, ...propertyDeps];
    } else if (provider && typeof provider === 'object') {
      if ('useFactory' in provider) {
        deps = provider.inject || [];
      }
    }

    let declaringModule = contextModule;
    if (providerClass && store.classToModuleMap.has(providerClass)) {
      declaringModule = store.classToModuleMap.get(providerClass);
    }

    for (const depToken of deps) {
      if (depToken === 'any') continue;
      const depScope = this.getResolvedScope(depToken, declaringModule, new Set(visited));
      if (depScope === Scope.REQUEST) {
        return Scope.REQUEST;
      }
    }

    if (explicitScope === Scope.TRANSIENT) {
      return Scope.TRANSIENT;
    }

    return Scope.DEFAULT;
  }

  public static resolveAll() {
    const modules = Array.from(store.moduleInstances.values());
    if (modules.length > 0) {
      // 1. Resolve modules themselves first (if not request-scoped)
      for (const m of modules as any[]) {
        if (m.moduleClass && m.moduleClass.name) {
          const scope = this.getResolvedScope(m.moduleClass.name, m);
          if (scope !== Scope.REQUEST) {
            this.resolve(m.moduleClass.name, m);
          }
        }
      }
      // 2. Resolve controllers and other providers (if not request-scoped)
      for (const m of modules as any[]) {
        for (const ctrl of m.controllers.keys()) {
          const scope = this.getResolvedScope(ctrl, m);
          if (scope !== Scope.REQUEST) {
            this.resolve(ctrl, m);
          }
        }
        for (const prov of m.providers.keys()) {
          if (m.moduleClass && prov === m.moduleClass.name) {
            continue; // Already resolved
          }
          const scope = this.getResolvedScope(prov, m);
          if (scope !== Scope.REQUEST) {
            this.resolve(prov, m);
          }
        }
      }
    } else {
      for (const token of store.providers.keys()) {
        const scope = this.getResolvedScope(token);
        if (scope !== Scope.REQUEST) {
          this.resolve(token);
        }
      }
    }
  }

  public static getAllInstances(): any[] {
    const instances = new Set<any>();

    // 1. Modules, Providers & Controllers in each module
    for (const m of store.moduleInstances.values()) {
      if (m.moduleClass && m.moduleClass.name) {
        const modInst = m.instances.get(m.moduleClass.name);
        if (modInst) instances.add(modInst);
      }
      for (const inst of m.instances.values()) {
        if (inst && typeof inst === 'object') {
          instances.add(inst);
        }
      }
    }

    // 2. Fallback/legacy global instances
    for (const inst of store.instances.values()) {
      if (inst && typeof inst === 'object') {
        instances.add(inst);
      }
    }
    for (const inst of store.controllers.values()) {
      if (inst && typeof inst === 'object') {
        instances.add(inst);
      }
    }
    for (const inst of store.guards.values()) {
      if (inst && typeof inst === 'object') {
        instances.add(inst);
      }
    }
    for (const inst of store.interceptors.values()) {
      if (inst && typeof inst === 'object') {
        instances.add(inst);
      }
    }

    return Array.from(instances);
  }

  public static async invokeHook(hookName: string, ...args: any[]) {
    const instances = this.getAllInstances();
    for (const instance of instances) {
      if (instance && typeof instance[hookName] === 'function') {
        await instance[hookName](...args);
      }
    }
  }

  public static clear() {
    store.endpoints.length = 0;
    store.controllers.clear();
    store.guards.clear();
    store.interceptors.clear();
    store.providers.clear();
    store.modules.clear();
    store.instances.clear();
    store.resolving.clear();
    store.controllerClasses.clear();
    store.guardClasses.clear();
    store.interceptorClasses.clear();
    if (store.moduleInstances) store.moduleInstances.clear();
    if (store.classToModuleMap) store.classToModuleMap.clear();
    if (store.tokenToModuleMap) store.tokenToModuleMap.clear();
    if (store.globalModules) store.globalModules.clear();
  }

  private static collectPropertyDeps(cls: any): Record<string, string> {
    const deps: Record<string, string> = {};
    let current = cls;
    while (current && current !== Function.prototype && current !== Object.prototype) {
      if (Object.prototype.hasOwnProperty.call(current, '__injections__') && current.__injections__?.propertyDeps) {
        Object.assign(deps, current.__injections__.propertyDeps);
      }
      current = Object.getPrototypeOf(current);
    }
    return deps;
  }

  private static locateProviderInScope(token: string, moduleInstance: any, visited = new Set<any>()): any {
    if (visited.has(moduleInstance)) return null;
    visited.add(moduleInstance);

    if (moduleInstance.providers.has(token)) {
      return moduleInstance.providers.get(token);
    }

    if (moduleInstance.controllers.has(token)) {
      return moduleInstance.controllers.get(token);
    }

    for (const impM of moduleInstance.imports) {
      if (this.isExportedFromModule(token, impM, visited)) {
        return impM.providers.get(token) || impM.controllers.get(token) || this.locateProviderInScope(token, impM, new Set(visited));
      }
    }

    for (const globalM of store.globalModules) {
      if (globalM !== moduleInstance && this.isExportedFromModule(token, globalM, visited)) {
        return globalM.providers.get(token) || globalM.controllers.get(token) || this.locateProviderInScope(token, globalM, new Set(visited));
      }
    }

    return null;
  }

  private static isExportedFromModule(token: string, moduleInstance: any, visited = new Set<any>()): boolean {
    if (moduleInstance.exports.has(token)) {
      return true;
    }

    for (const exp of moduleInstance.exports) {
      let expMInstance = store.moduleInstances.get(exp);
      if (!expMInstance && typeof exp === 'string' && store.modules.has(exp)) {
        const expModuleClass = store.modules.get(exp);
        expMInstance = store.moduleInstances.get(expModuleClass);
      }
      
      if (expMInstance && this.isExportedFromModule(token, expMInstance, visited)) {
        return true;
      }
    }

    return false;
  }

  private static instantiateProvider(token: string, provider: any, contextModule: any): any {
    if (typeof provider === 'function') {
      const injections = provider.__injections__ || {};
      const constructorDeps = injections.constructorDeps || [];
      const args = constructorDeps.map((depToken: string) => {
        if (depToken === 'any') return undefined;
        return this.resolve(depToken, contextModule);
      });

      const instance = new provider(...args);

      const propertyDeps = this.collectPropertyDeps(provider);
      for (const [propName, depToken] of Object.entries(propertyDeps)) {
        instance[propName] = this.resolve(depToken, contextModule);
      }
      return instance;
    }

    if (provider && typeof provider === 'object') {
      if ('useValue' in provider) {
        return provider.useValue;
      }
      if ('useClass' in provider) {
        const cls = provider.useClass;
        const injections = cls.__injections__ || {};
        const constructorDeps = injections.constructorDeps || [];
        const args = constructorDeps.map((depToken: string) => {
          if (depToken === 'any') return undefined;
          return this.resolve(depToken, contextModule);
        });

        const instance = new cls(...args);

        const propertyDeps = this.collectPropertyDeps(cls);
        for (const [propName, depToken] of Object.entries(propertyDeps)) {
          instance[propName] = this.resolve(depToken, contextModule);
        }
        return instance;
      }
      if ('useFactory' in provider) {
        const factoryDeps = provider.inject || [];
        const args = factoryDeps.map((depToken: string) => this.resolve(depToken, contextModule));
        return provider.useFactory(...args);
      }
      return provider;
    }

    return provider;
  }

  private static syncLegacyCompatibility(token: string, instance: any) {
    if (store.controllerClasses.has(token)) {
      store.controllers.set(token, instance);
    } else if (store.guardClasses.has(token)) {
      store.guards.set(token, instance);
    } else if (store.interceptorClasses.has(token)) {
      store.interceptors.set(token, instance);
    }
  }

  public static resolve(token: string, contextModule?: any): any {
    let currentContext = contextModule;
    if (!currentContext && store.tokenToModuleMap.has(token)) {
      currentContext = store.tokenToModuleMap.get(token);
    }

    const scope = this.getResolvedScope(token, currentContext);

    if (scope === Scope.REQUEST) {
      const ctx = Context.get();
      if (!ctx || !ctx.requestInstances) {
        throw new Error(`Cannot resolve request-scoped provider ${token} outside of a request context`);
      }

      const provider = currentContext ? this.locateProviderInScope(token, currentContext) : store.providers.get(token);
      if (!provider) {
        throw new Error(`No provider registered for token: ${token}${currentContext ? ` in module ${currentContext.name}` : ''}`);
      }

      let declaringModule = currentContext;
      const providerClass = typeof provider === 'function' ? provider : (provider && typeof provider === 'object' && 'useClass' in provider ? provider.useClass : null);
      if (providerClass && store.classToModuleMap.has(providerClass)) {
        declaringModule = store.classToModuleMap.get(providerClass);
      }

      const cacheKey = `${token}::${declaringModule ? declaringModule.name : 'global'}`;
      if (ctx.requestInstances.has(cacheKey)) {
        return ctx.requestInstances.get(cacheKey);
      }

      if (store.resolving.has(token)) {
        return new Proxy({}, {
          get(target, prop, receiver) {
            const instance = MetadataStore.resolve(token, currentContext);
            if (!instance) return undefined;
            const value = Reflect.get(instance, prop, receiver);
            return typeof value === 'function' ? value.bind(instance) : value;
          },
          set(target, prop, value, receiver) {
            const instance = MetadataStore.resolve(token, currentContext);
            return Reflect.set(instance, prop, value, receiver);
          }
        });
      }

      store.resolving.add(token);
      try {
        const instance = this.instantiateProvider(token, provider, declaringModule);
        ctx.requestInstances.set(cacheKey, instance);
        return instance;
      } finally {
        store.resolving.delete(token);
      }
    }

    if (scope === Scope.TRANSIENT) {
      const provider = currentContext ? this.locateProviderInScope(token, currentContext) : store.providers.get(token);
      if (!provider) {
        throw new Error(`No provider registered for token: ${token}${currentContext ? ` in module ${currentContext.name}` : ''}`);
      }

      let declaringModule = currentContext;
      const providerClass = typeof provider === 'function' ? provider : (provider && typeof provider === 'object' && 'useClass' in provider ? provider.useClass : null);
      if (providerClass && store.classToModuleMap.has(providerClass)) {
        declaringModule = store.classToModuleMap.get(providerClass);
      }

      if (store.resolving.has(token)) {
        return new Proxy({}, {
          get(target, prop, receiver) {
            const instance = MetadataStore.resolve(token, currentContext);
            if (!instance) return undefined;
            const value = Reflect.get(instance, prop, receiver);
            return typeof value === 'function' ? value.bind(instance) : value;
          },
          set(target, prop, value, receiver) {
            const instance = MetadataStore.resolve(token, currentContext);
            return Reflect.set(instance, prop, value, receiver);
          }
        });
      }

      store.resolving.add(token);
      try {
        const instance = this.instantiateProvider(token, provider, declaringModule);
        return instance;
      } finally {
        store.resolving.delete(token);
      }
    }

    if (!currentContext) {
      if (store.instances.has(token)) {
        return store.instances.get(token);
      }
      if (store.resolving.has(token)) {
        return new Proxy({}, {
          get(target, prop, receiver) {
            const instance = MetadataStore.resolve(token);
            if (!instance) return undefined;
            const value = Reflect.get(instance, prop, receiver);
            return typeof value === 'function' ? value.bind(instance) : value;
          },
          set(target, prop, value, receiver) {
            const instance = MetadataStore.resolve(token);
            return Reflect.set(instance, prop, value, receiver);
          }
        });
      }

      store.resolving.add(token);
      try {
        const provider = store.providers.get(token);
        if (!provider) {
          throw new Error(`No provider registered for token: ${token}`);
        }
        const instance = this.instantiateProvider(token, provider, null);
        store.instances.set(token, instance);
        this.syncLegacyCompatibility(token, instance);
        return instance;
      } finally {
        store.resolving.delete(token);
      }
    }

    if (currentContext.instances.has(token)) {
      return currentContext.instances.get(token);
    }

    if (store.resolving.has(token)) {
      return new Proxy({}, {
        get(target, prop, receiver) {
          const instance = MetadataStore.resolve(token, currentContext);
          if (!instance) return undefined;
          const value = Reflect.get(instance, prop, receiver);
          return typeof value === 'function' ? value.bind(instance) : value;
        },
        set(target, prop, value, receiver) {
          const instance = MetadataStore.resolve(token, currentContext);
          return Reflect.set(instance, prop, value, receiver);
        }
      });
    }

    const provider = this.locateProviderInScope(token, currentContext);
    if (!provider) {
      throw new Error(`No provider registered for token: ${token} in module ${currentContext.name}`);
    }

    store.resolving.add(token);
    try {
      let declaringModule = currentContext;
      const providerClass = typeof provider === 'function' ? provider : (provider && typeof provider === 'object' && 'useClass' in provider ? provider.useClass : null);
      if (providerClass && store.classToModuleMap.has(providerClass)) {
        declaringModule = store.classToModuleMap.get(providerClass);
      }

      const instance = this.instantiateProvider(token, provider, declaringModule);
      currentContext.instances.set(token, instance);

      store.instances.set(token, instance);
      this.syncLegacyCompatibility(token, instance);

      return instance;
    } finally {
      store.resolving.delete(token);
    }
  }
}


