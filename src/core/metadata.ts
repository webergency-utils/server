import { EndpointMetadata } from './types.js';
import { Scope } from '../decorators.js';
import { DIContainer } from './container.js';

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

export const store = (globalThis as any)[GLOBAL_KEY];

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

  public static getProvider(token: string): any {
    return store.providers.get(token);
  }

  public static registerModule(name: string, moduleClass: any) {
    store.modules.set(name, moduleClass);
  }

  public static getModule(name: string): any {
    return store.modules.get(name);
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
    const actualContext = contextModule || store.tokenToModuleMap.get(name);
    return DIContainer.resolve(name, actualContext);
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
    const actualContext = contextModule || store.tokenToModuleMap.get(name);
    return DIContainer.resolve(name, actualContext);
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
    const actualContext = contextModule || store.tokenToModuleMap.get(name);
    return DIContainer.resolve(name, actualContext);
  }

  public static getInjectable(name: string, contextModule?: any): any {
    return DIContainer.resolve(name, contextModule);
  }

  public static resolveAll() {
    DIContainer.resolveAll();
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
    store.defaultResponseMode = undefined;
  }

  public static resolve(token: string, contextModule?: any): any {
    return DIContainer.resolve(token, contextModule);
  }

  public static getResolvedScope(token: string, contextModule?: any, visited = new Set<string>()): Scope {
    return DIContainer.getResolvedScope(token, contextModule, visited);
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

  public static setDefaultResponseMode(mode: 'strict' | 'relaxed' | 'strip') {
    store.defaultResponseMode = mode;
  }

  public static getDefaultResponseMode(): 'strict' | 'relaxed' | 'strip' {
    return store.defaultResponseMode || 'strip';
  }
}
