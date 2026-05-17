import { EndpointMetadata, Validator } from './types.js';

const GLOBAL_KEY = '__WEBERGENCY_SERVER_METADATA_STORE__';

if (!(globalThis as any)[GLOBAL_KEY]) {
  (globalThis as any)[GLOBAL_KEY] = {
    endpoints: [] as EndpointMetadata[],
    controllers: new Map<string, any>(),
    guards: new Map<string, any>(),
    interceptors: new Map<string, any>()
  };
}

const store = (globalThis as any)[GLOBAL_KEY];

export class MetadataStore {
  public static registerEndpoint(metadata: EndpointMetadata) {
    store.endpoints.push(metadata);
  }

  public static getEndpoints(): EndpointMetadata[] {
    return store.endpoints;
  }

  public static registerController(name: string, instance: any) {
    store.controllers.set(name, instance);
  }

  public static getController(name: string): any {
    return store.controllers.get(name);
  }

  public static registerGuard(name: string, instance: any) {
    store.guards.set(name, instance);
  }

  public static getGuard(name: string): any {
    return store.guards.get(name);
  }

  public static registerInterceptor(name: string, instance: any) {
    store.interceptors.set(name, instance);
  }

  public static getInterceptor(name: string): any {
    return store.interceptors.get(name);
  }

}
