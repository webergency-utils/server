import { EndpointMetadata } from './types.js';

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

export class Registry {
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

  public static registerGuard(name: string, classOrInstance: any) {
    if (typeof classOrInstance === 'function') {
      store.providers.set(name, classOrInstance);
      store.guardClasses.add(name);
    } else {
      store.guards.set(name, classOrInstance);
    }
  }

  public static registerInterceptor(name: string, classOrInstance: any) {
    if (typeof classOrInstance === 'function') {
      store.providers.set(name, classOrInstance);
      store.interceptorClasses.add(name);
    } else {
      store.interceptors.set(name, classOrInstance);
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
}
