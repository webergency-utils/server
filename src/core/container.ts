import { store } from './registry.js';
import { Scope } from '../decorators.js';
import { Context } from './context.js';

export class DIContainer {
  public static collectPropertyDeps(cls: any): Record<string, string> {
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

  public static locateProviderInScope(token: string, moduleInstance: any, visited = new Set<any>()): any {
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

  public static isExportedFromModule(token: string, moduleInstance: any, visited = new Set<any>()): boolean {
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

  public static instantiateProvider(token: string, provider: any, contextModule: any): any {
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

  public static syncLegacyCompatibility(token: string, instance: any) {
    if (store.controllerClasses.has(token)) {
      store.controllers.set(token, instance);
    } else if (store.guardClasses.has(token)) {
      store.guards.set(token, instance);
    } else if (store.interceptorClasses.has(token)) {
      store.interceptors.set(token, instance);
    }
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
      for (const m of modules as any[]) {
        if (m.moduleClass && m.moduleClass.name) {
          const scope = this.getResolvedScope(m.moduleClass.name, m);
          if (scope !== Scope.REQUEST) {
            this.resolve(m.moduleClass.name, m);
          }
        }
      }
      for (const m of modules as any[]) {
        for (const ctrl of m.controllers.keys()) {
          const scope = this.getResolvedScope(ctrl, m);
          if (scope !== Scope.REQUEST) {
            this.resolve(ctrl, m);
          }
        }
        for (const prov of m.providers.keys()) {
          if (m.moduleClass && prov === m.moduleClass.name) {
            continue;
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
            const instance = DIContainer.resolve(token, currentContext);
            if (!instance) return undefined;
            const value = Reflect.get(instance, prop, receiver);
            return typeof value === 'function' ? value.bind(instance) : value;
          },
          set(target, prop, value, receiver) {
            const instance = DIContainer.resolve(token, currentContext);
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
            const instance = DIContainer.resolve(token, currentContext);
            if (!instance) return undefined;
            const value = Reflect.get(instance, prop, receiver);
            return typeof value === 'function' ? value.bind(instance) : value;
          },
          set(target, prop, value, receiver) {
            const instance = DIContainer.resolve(token, currentContext);
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
            const instance = DIContainer.resolve(token);
            if (!instance) return undefined;
            const value = Reflect.get(instance, prop, receiver);
            return typeof value === 'function' ? value.bind(instance) : value;
          },
          set(target, prop, value, receiver) {
            const instance = DIContainer.resolve(token);
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
          const instance = DIContainer.resolve(token, currentContext);
          if (!instance) return undefined;
          const value = Reflect.get(instance, prop, receiver);
          return typeof value === 'function' ? value.bind(instance) : value;
        },
        set(target, prop, value, receiver) {
          const instance = DIContainer.resolve(token, currentContext);
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
