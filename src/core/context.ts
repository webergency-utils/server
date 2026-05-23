import { AsyncLocalStorage } from 'async_hooks';
import { AugmentedRequest, EndpointMetadata } from './types.js';

export interface RequestContext {
  request: AugmentedRequest;
  metadata: EndpointMetadata;
  requestInstances?: Map<string, any>;
  // We can add more here later, like target class/method
}

const storage = new AsyncLocalStorage<RequestContext>();

export class Context {
  /**
   * Run a function within a specific request context.
   * This is used by the server to wrap each request.
   */
  static run<T>(ctx: RequestContext, fn: () => T): T {
    return storage.run(ctx, fn);
  }

  /**
   * Get the current request context.
   * Works anywhere in the call stack of a request.
   */
  static get(): RequestContext | undefined {
    return storage.getStore();
  }

  /**
   * Helper to get the current request directly.
   */
  static get request(): AugmentedRequest | undefined {
    return storage.getStore()?.request;
  }

  /**
   * Helper to get current endpoint metadata.
   */
  static get metadata(): EndpointMetadata | undefined {
    return storage.getStore()?.metadata;
  }
}
