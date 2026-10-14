import { AsyncLocalStorage } from 'async_hooks';
import { EndpointMetadata } from './types.js';
import type { ServerRequest } from './server-request.js';
import type { ApplicationRegistry } from './registry.js';

export interface RequestContext {
    request           : ServerRequest
    metadata          : EndpointMetadata
    requestId?        : string
    requestInstances? : Map<string, any>
    registry?         : ApplicationRegistry
}

const storage = new AsyncLocalStorage<RequestContext>();

export class Context 
{
    /**
   * Run a function within a specific request context.
   * This is used by the server to wrap each request.
   */
    static run<T>( ctx: RequestContext, fn: () => T ): T 
    {
        if( ctx.requestId === undefined && ctx.request?.requestID !== undefined )
        {
            ctx.requestId = ctx.request.requestID;
        }

        return storage.run( ctx, fn );
    }

    /**
   * Get the current request context.
   * Works anywhere in the call stack of a request.
   */
    static get(): RequestContext | undefined 
    {
        return storage.getStore();
    }

    /**
   * Helper to get the current request directly.
   */
    static get request(): ServerRequest | undefined 
    {
        return storage.getStore()?.request;
    }

    /**
   * Helper to get current endpoint metadata.
   */
    static get metadata(): EndpointMetadata | undefined 
    {
        return storage.getStore()?.metadata;
    }

    /** Accept-or-generate `X-Request-Id` for the active request, if any. */
    static get requestId(): string | undefined
    {
        const store = storage.getStore();

        return store?.requestId ?? store?.request?.requestID;
    }
}

