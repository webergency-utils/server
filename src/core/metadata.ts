import { EndpointMetadata } from './types.js';
import { Scope } from '../decorators.js';
import { Registry } from './registry.js';
import { DIContainer } from './container.js';
import { LifecycleManager } from './lifecycle-manager.js';

export class MetadataStore {
  public static registerEndpoint(metadata: EndpointMetadata) {
    Registry.registerEndpoint(metadata);
  }

  public static getEndpoints(): EndpointMetadata[] {
    return Registry.getEndpoints();
  }

  public static registerProvider(token: string, provider: any) {
    Registry.registerProvider(token, provider);
  }

  public static getProvider(token: string): any {
    return Registry.getProvider(token);
  }

  public static registerModule(name: string, moduleClass: any) {
    Registry.registerModule(name, moduleClass);
  }

  public static getModule(name: string): any {
    return Registry.getModule(name);
  }

  public static getModuleInstance(moduleClass: any): any {
    return Registry.getModuleInstance(moduleClass);
  }

  public static createModuleInstance(name: string, moduleClass: any): any {
    return Registry.createModuleInstance(name, moduleClass);
  }

  public static getModuleInstances(): any[] {
    return Registry.getModuleInstances();
  }

  public static mapClassToModule(cls: any, moduleInstance: any) {
    Registry.mapClassToModule(cls, moduleInstance);
  }

  public static getClassModule(cls: any): any {
    return Registry.getClassModule(cls);
  }

  public static mapTokenToModule(token: string, moduleInstance: any) {
    Registry.mapTokenToModule(token, moduleInstance);
  }

  public static getTokenModule(token: string): any {
    return Registry.getTokenModule(token);
  }

  public static registerGlobalModule(moduleInstance: any) {
    Registry.registerGlobalModule(moduleInstance);
  }

  public static getGlobalModules(): any[] {
    return Registry.getGlobalModules();
  }

  public static registerController(name: string, classOrInstance: any) {
    Registry.registerController(name, classOrInstance);
  }

  public static getController(name: string, contextModule?: any): any {
    const store = (globalThis as any)['__WEBERGENCY_SERVER_METADATA_STORE__'];
    if (store && store.controllers.has(name)) {
      return store.controllers.get(name);
    }
    const actualContext = contextModule || Registry.getTokenModule(name);
    return DIContainer.resolve(name, actualContext);
  }

  public static registerGuard(name: string, classOrInstance: any) {
    Registry.registerGuard(name, classOrInstance);
  }

  public static getGuard(name: string, contextModule?: any): any {
    const store = (globalThis as any)['__WEBERGENCY_SERVER_METADATA_STORE__'];
    if (store && store.guards.has(name)) {
      return store.guards.get(name);
    }
    const actualContext = contextModule || Registry.getTokenModule(name);
    return DIContainer.resolve(name, actualContext);
  }

  public static registerInterceptor(name: string, classOrInstance: any) {
    Registry.registerInterceptor(name, classOrInstance);
  }

  public static getInterceptor(name: string, contextModule?: any): any {
    const store = (globalThis as any)['__WEBERGENCY_SERVER_METADATA_STORE__'];
    if (store && store.interceptors.has(name)) {
      return store.interceptors.get(name);
    }
    const actualContext = contextModule || Registry.getTokenModule(name);
    return DIContainer.resolve(name, actualContext);
  }

  public static getInjectable(name: string, contextModule?: any): any {
    return DIContainer.resolve(name, contextModule);
  }

  public static resolveAll() {
    DIContainer.resolveAll();
  }

  public static clear() {
    Registry.clear();
  }

  public static resolve(token: string, contextModule?: any): any {
    return DIContainer.resolve(token, contextModule);
  }

  public static getResolvedScope(token: string, contextModule?: any, visited = new Set<string>()): Scope {
    return DIContainer.getResolvedScope(token, contextModule, visited);
  }

  public static getAllInstances(): any[] {
    return LifecycleManager.getAllInstances();
  }

  public static async invokeHook(hookName: string, ...args: any[]) {
    await LifecycleManager.invokeHook(hookName, ...args);
  }
}
