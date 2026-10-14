import { ApplicationRegistry, runWithRegistry } from '../core/registry.js';
import { bootstrapRegistry, BootstrapOptions } from '../core/bootstrap.js';
import { RequestProcessor } from '../core/request-processor.js';
import { MicroserviceAdapter, MicroserviceNoReply } from './adapter.js';

export type MicroserviceOptions = BootstrapOptions;

export class Microservice 
{
    public readonly registry = new ApplicationRegistry();
    private bootstrapped = false;
    private readonly rpcHandlers = new Map<string, any>();

    constructor(
        private adapter: MicroserviceAdapter,
        private options: MicroserviceOptions = {}
    ) {}

    public async ensureReady()
    {
        if( this.bootstrapped ){ return }

        await runWithRegistry( this.registry, async () =>
        {
            bootstrapRegistry( this.registry, this.options );
            await this.registry.resolveAll();
        });

        this.rpcHandlers.clear();

        for( const ep of this.registry.getEndpoints())
        {
            if( ep.httpMethod === 'RPC' )
            {
                this.rpcHandlers.set( ep.path, ep );
            }
        }

        this.bootstrapped = true;
    }

    async start(): Promise<void> 
    {
        await this.ensureReady();

        await this.adapter.listen( async ( pattern, payload ) => 
        {
            return runWithRegistry( this.registry, async () =>
            {
                const endpoint = this.rpcHandlers.get( pattern );

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
    }

    async shutdown(): Promise<void> 
    {
        await this.adapter.close();
        this.rpcHandlers.clear();
        await runWithRegistry( this.registry, async () =>
        {
            await this.registry.destroyAll();
        });
    }
}

