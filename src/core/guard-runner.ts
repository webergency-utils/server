import { EndpointMetadata, AugmentedRequest, ServerResponse } from './types.js';
import { ServerRequest } from './server-request.js';
import { SecurityOptions } from '../decorators.js';
import { getRegistry } from './registry.js';
import { RequestProcessor } from './request-processor.js';

/**
 * Parameter sources a guard may declare. Anything else consumes the next AOT-emitted
 * resolver instead — that is how literal arguments like `@Protect( RoleGuard, 'admin' )`
 * reach the guard.
 */
const GUARD_PARAM_SOURCES = new Set([
    'Request', 'Response', 'WebSocket', 'Param', 'Body', 'RawBody', 'Header', 'Headers',
    'Cookies', 'Cookie', 'Query', 'Context', 'Inject', 'Ip', 'Url', 'Hostname', 'Path', 'Peer'
]);

export interface GuardRunOptions {
    /** Shared validation context; a guard param may fail validation into it. */
    ctx              : any
    controller       : any
    controllerModule : any
    securityConfig?  : SecurityOptions
    /** Backs `@Response`; absent for the WS upgrade and RPC paths, which have no bag. */
    response?        : ServerResponse
    /** Shared `@Request` facade when the HTTP pipeline already built one. */
    serverRequest?   : ServerRequest
    /** Backs `@ConnectedSocket`. Guards always run before a socket exists, so this is null. */
    websocket?       : any
    /** Runs before each guard, e.g. to abort a timed-out request. */
    beforeEach?      : () => void
}

/**
 * Run an endpoint's guards. Shared by the HTTP pipeline, the RPC pipeline, and the
 * WebSocket upgrade so that a guard sees the same parameter sources everywhere.
 */
export async function invokeGuards(
    metadata: EndpointMetadata,
    req: AugmentedRequest,
    options: GuardRunOptions
): Promise<void>
{
    if( metadata.guards.length === 0 ) { return }

    const registry = getRegistry();
    const websocket = options.websocket ?? null;

    for( const g of metadata.guards )
    {
        options.beforeEach?.();

        const guardModule = g.type === 'class' ? registry.getTokenModule( g.name ) : options.controllerModule;
        const guardInstance = g.type === 'class' ? await registry.getGuard( g.name, guardModule ) : options.controller;
        const guardMethod = g.type === 'class' ? guardInstance.use : guardInstance[g.name];

        const args: any[] = [];
        let resolverIdx = 0;

        for( const p of g.params )
        {
            if( GUARD_PARAM_SOURCES.has( p.source ))
            {
                args.push( await RequestProcessor.resolveParam(
                    p,
                    req,
                    options.ctx,
                    options.securityConfig,
                    guardModule,
                    websocket,
                    options.response,
                    options.serverRequest
                ));
            }
            else
            {
                args.push( g.resolvers[resolverIdx++]);
            }
        }

        await guardMethod.apply( guardInstance, args.length > 0 ? args : g.resolvers );
    }
}
