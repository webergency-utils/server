import { ApplicationRegistry, runWithRegistry } from '../core/registry.js';
import { bootstrapRegistry, BootstrapOptions } from '../core/bootstrap.js';
import { RequestProcessor } from '../core/request-processor.js';
import { MicroserviceAdapter, MicroserviceNoReply } from './adapter.js';

export type MicroserviceOptions = BootstrapOptions;

export class Microservice 
{
    public readonly registry = new ApplicationRegistry();
    private bootstrapped = false;

    constructor(
        private adapter: MicroserviceAdapter,
        private options: MicroserviceOptions = {}
    ) {}

    public ensureReady()
    {
        if( this.bootstrapped ){ return }

        runWithRegistry( this.registry, () =>
        {
            bootstrapRegistry( this.registry, this.options );
            this.registry.resolveAll();
        });
        this.bootstrapped = true;
    }

    async start(): Promise<void> 
    {
        this.ensureReady();

        await runWithRegistry( this.registry, async () =>
        {
            await this.registry.invokeHook( 'onModuleInit' );
        });

        await this.adapter.listen( async ( pattern, payload ) => 
        {
            return runWithRegistry( this.registry, async () =>
            {
                const endpoint = this.registry.getEndpoints().find(
                    ( ep: any ) => ep.httpMethod === 'RPC' && ep.path === pattern
                );

                if( !endpoint ) 
                {
                    throw new Error( `Pattern "${pattern}" not registered` );
                }

                // @EventPattern: fire-and-forget — no reply envelope, errors stay local.
                if( endpoint.meta?.event )
                {
                    try
                    {
                        await RequestProcessor.executeRpc( endpoint, payload );
                    }
                    catch ( err: any )
                    {
                        console.error( `[EventPattern ${pattern}]`, err?.message || err );
                    }

                    return MicroserviceNoReply;
                }

                try 
                {
                    return await RequestProcessor.executeRpc( endpoint, payload );
                }
                catch ( err: any ) 
                {
                    if( err.data ) 
                    {
                        throw err;
                    }
                    throw new Error( err.message || 'Internal RPC error', { cause : err });
                }
            });
        });

        await runWithRegistry( this.registry, async () =>
        {
            await this.registry.invokeHook( 'onApplicationBootstrap' );
        });
    }

    async shutdown(): Promise<void> 
    {
        await runWithRegistry( this.registry, async () =>
        {
            await this.registry.invokeHook( 'onModuleDestroy' );
            await this.registry.invokeHook( 'beforeApplicationShutdown' );
        });
        await this.adapter.close();
        await runWithRegistry( this.registry, async () =>
        {
            await this.registry.invokeHook( 'onApplicationShutdown' );
        });
    }
}
