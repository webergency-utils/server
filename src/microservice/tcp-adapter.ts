import { MicroserviceAdapter, MessageConnection } from './adapter.js';
import net from 'node:net';

export class TcpMessageAdapter implements MicroserviceAdapter 
{
    private server? : net.Server;
    private connections = new Set<net.Socket>();

    constructor( private port: number ) {}

    async listen( handler: ( pattern: string, payload: any, connection: MessageConnection ) => Promise<any> ): Promise<void> 
    {
        this.server = net.createServer(( socket ) => 
        {
            this.connections.add( socket );
            let buffer = '';

            socket.on( 'data', async ( chunk ) => 
            {
                buffer += chunk.toString( 'utf8' );
                let index;

                while(( index = buffer.indexOf( '\n' )) !== -1 ) 
                {
                    const line = buffer.substring( 0, index ).trim();
                    buffer = buffer.substring( index + 1 );

                    if( !line ) { continue }

                    try 
                    {
                        const envelope = JSON.parse( line );
                        const { id, pattern, payload } = envelope;

                        if( !pattern ) 
                        {
                            if( id ) 
                            {
                                socket.write( JSON.stringify({ id, status : 'error', message : 'Missing pattern' }) + '\n' );
                            }
                            continue;
                        }

                        const connection: MessageConnection = {
              send : ( data: any ) => 
              {
                  if( socket.writable ) 
                  {
                      socket.write( JSON.stringify({ id, status : 'success', data }) + '\n' );
                  }
              },
              close : () => 
              {
                  socket.end();
              }
            };

                        const result = await handler( pattern, payload, connection );
            
                        if( id && result !== undefined ) 
                        {
                            socket.write( JSON.stringify({ id, status : 'success', data : result }) + '\n' );
                        }
                    }
                    catch ( err: any ) 
                    {
                        try 
                        {
                            socket.write( JSON.stringify({ status : 'error', message : err.message || 'Malformed request' }) + '\n' );
                        }
                        catch ( e ) {}
                    }
                }
            });

            socket.on( 'close', () => 
            {
                this.connections.delete( socket );
            });

            socket.on( 'error', () => 
            {
                this.connections.delete( socket );
            });
        });

        return new Promise<void>(( resolve, reject ) => 
        {
            this.server!.listen( this.port, () => 
            {
                resolve();
            });
            this.server!.on( 'error', ( err ) => reject( err ));
        });
    }

    async close(): Promise<void> 
    {
        for( const socket of this.connections ) 
        {
            socket.destroy();
        }
        this.connections.clear();

        if( this.server ) 
        {
            return new Promise<void>(( resolve ) => 
            {
                this.server!.close(() => resolve());
            });
        }
    }
}
