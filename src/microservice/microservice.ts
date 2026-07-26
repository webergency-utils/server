import { MetadataStore } from '../core/metadata.js';
import { RequestProcessor } from '../core/request-processor.js';
import { MicroserviceAdapter, MicroserviceNoReply } from './adapter.js';

export class Microservice 
{
    constructor( private adapter: MicroserviceAdapter ) {}

    async start(): Promise<void> 
    {
        await this.adapter.listen( async ( pattern, payload ) => 
        {
            const endpoint = MetadataStore.getEndpoints().find(
                ( ep: any ) => ep.httpMethod === 'RPC' && ep.path === pattern
            );

            if( !endpoint ) 
            {
                throw new Error( `Pattern "${pattern}" not registered` );
            }

            // Nest @EventPattern: fire-and-forget — no reply envelope, errors stay local.
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
                // If execution threw an error with structural data (like validation errors),
                // pass it through. Otherwise wrap it.
                if( err.data ) 
                {
                    throw err;
                }
                throw new Error( err.message || 'Internal RPC error', { cause : err });
            }
        });
    }

    async shutdown(): Promise<void> 
    {
        await this.adapter.close();
    }
}
