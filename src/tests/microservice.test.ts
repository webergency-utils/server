import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Microservice } from '../microservice/microservice.js';
import { TcpMessageAdapter } from '../microservice/tcp-adapter.js';
import { MetadataStore } from '../core/metadata.js';
import { runAot } from './aot/build.js';
import net from 'node:net';

describe( 'Microservice Integration Tests', () => 
{
    let microservice: Microservice;
    const port = 3999;

    beforeAll( async () => 
    {
        const manifestPath = runAot();
        MetadataStore.clear();
        await import( `file://${manifestPath}?t=${Date.now()}` );

        const adapter = new TcpMessageAdapter( port );
        microservice = new Microservice( adapter );
        await microservice.start();
    });

    afterAll( async () => 
    {
        if( microservice )
        {
            await microservice.shutdown();
        }
    });

    const sendRpc = ( pattern: string, payload: any ): Promise<any> => 
    {
        return new Promise(( resolve, reject ) => 
        {
            const client = net.connect( port, 'localhost', () => 
            {
                const envelope = {
                    id : 'test-req-id',
                    pattern,
                    payload
                };
                client.write( JSON.stringify( envelope ) + '\n' );
            });

            let buffer = '';
            client.on( 'data', ( chunk ) => 
            {
                buffer += chunk.toString( 'utf8' );

                if( buffer.includes( '\n' )) 
                {
                    const line = buffer.substring( 0, buffer.indexOf( '\n' )).trim();
                    client.end();
                    try 
                    {
                        const response = JSON.parse( line );

                        if( response.status === 'success' ) 
                        {
                            resolve( response.data );
                        }
                        else 
                        {
                            reject( new Error( response.message || 'RPC Error' ));
                        }
                    }
                    catch ( e ) 
                    {
                        reject( e );
                    }
                }
            });

            client.on( 'error', ( err ) => reject( err ));
        });
    };

    it( 'should successfully execute MessagePattern math.sum and return correct payload', async () => 
    {
        const res = await sendRpc( 'math.sum', { a : 10, b : 20 });
        expect( res ).toBe( 30 );
    });

    it( 'should successfully execute MessagePattern math.greet with string payload', async () => 
    {
        const res = await sendRpc( 'math.greet', 'World' );
        expect( res ).toBe( 'Hello, World!' );
    });

    it( 'should automatically reject message with payload validation error', async () => 
    {
        await expect( sendRpc( 'math.sum', { a : 'invalid', b : 20 })).rejects.toThrow();
    });

    it( 'should automatically reject message with missing payload property validation error', async () => 
    {
        await expect( sendRpc( 'math.sum', { b : 20 })).rejects.toThrow();
    });
});
