import { ApplicationRegistry, runWithRegistry } from '../core/registry.js';
import { bootstrapRegistry, BootstrapOptions } from '../core/bootstrap.js';
import { RequestProcessor } from '../core/request-processor.js';
import { MicroserviceAdapter, MicroserviceNoReply } from './adapter.js';

export type MicroserviceOptions = BootstrapOptions & {
    exposeErrors? : boolean
};

export class Microservice 
{
    public readonly registry = new ApplicationRegistry();
    private bootstrapped = false;
    private bootstrapping? : Promise<void>;
    private isShuttingDown = false;
    private activeRequests = 0;
    private drainResolvers : Array<() => void> = [];
    private readonly rpcHandlers = new Map<string, any>();

    constructor(
        private adapter: MicroserviceAdapter,
        private options: MicroserviceOptions = {}
    )
    {
        if( options.exposeErrors !== undefined && typeof ( adapter as any )?.setExposeErrors === 'function' )
        {
            ( adapter as any ).setExposeErrors( options.exposeErrors );
        }
    }

    public async ensureReady()
    {
        if( this.bootstrapped ){ return }

        if( this.bootstrapping )
        {
            return this.bootstrapping;
        }

        const p = ( async () =>
        {
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
        })();

        this.bootstrapping = p;

        try
        {
            await p;
        }
        finally
        {
            this.bootstrapping = undefined;
        }
    }

    async start(): Promise<void> 
    {
        await this.ensureReady();

        await this.adapter.listen( async ( pattern, payload ) => 
        {
            const endpoint = this.rpcHandlers.get( pattern );

            if( this.isShuttingDown )
            {
                if( endpoint?.meta?.event )
                {
                    return MicroserviceNoReply;
                }

                throw Object.assign( new Error( 'Service Unavailable (Shutting Down)' ), {
                    status : 503,
                    data   : { unavailable : true }
                });
            }

            this.activeRequests++;

            try
            {
                return await runWithRegistry( this.registry, async () =>
                {
                    if( !endpoint ) 
                    {
                        throw Object.assign( new Error( `Pattern "${pattern}" not registered` ), { status : 404 });
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
            }
            finally
            {
                if( --this.activeRequests === 0 && this.drainResolvers.length > 0 )
                {
                    const resolvers = this.drainResolvers.splice( 0 );

                    for( const resolve of resolvers )
                    {
                        resolve();
                    }
                }
            }
        });
    }

    async shutdown( timeoutMs = 10000 ): Promise<void> 
    {
        this.isShuttingDown = true;
        const hasTwoPhaseClose = typeof this.adapter.stopAccepting === 'function';

        if( hasTwoPhaseClose )
        {
            await this.adapter.stopAccepting!();
        }
        else
        {
            await this.adapter.close();
        }

        if( this.activeRequests > 0 )
        {
            await new Promise<void>(( resolve ) =>
            {
                const timer = setTimeout( resolve, timeoutMs );
                timer.unref?.();
                this.drainResolvers.push(() =>
                {
                    clearTimeout( timer );
                    resolve();
                });
            });
        }

        if( hasTwoPhaseClose )
        {
            if( typeof this.adapter.drain === 'function' )
            {
                await this.adapter.drain( timeoutMs );
            }

            await this.adapter.close();
        }

        await runWithRegistry( this.registry, async () =>
        {
            await this.registry.destroyAll();
        });
    }
}

