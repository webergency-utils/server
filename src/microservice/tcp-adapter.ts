import { MicroserviceAdapter, MessageConnection, MicroserviceNoReply } from './adapter.js';
import net from 'node:net';

/** Max incomplete newline-delimited JSON line held in memory per socket. */
export const TCP_MAX_LINE_BYTES = 1024 * 1024;

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
                    const rawLine = buffer.substring( 0, index );

                    if( Buffer.byteLength( rawLine, 'utf8' ) > TCP_MAX_LINE_BYTES )
                    {
                        buffer = '';
                        socket.destroy();

                        return;
                    }

                    const line = rawLine.trim();
                    buffer = buffer.substring( index + 1 );

                    if( !line ) { continue }

                    let id: string | undefined;

                    try 
                    {
                        const envelope = JSON.parse( line );
                        id = envelope.id;
                        const { pattern, payload } = envelope;

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

                        // EventPattern → MicroserviceNoReply; MessagePattern replies when id is present.
                        if( result !== MicroserviceNoReply && id )
                        {
                            socket.write( JSON.stringify({ id, status : 'success', data : result }) + '\n' );
                        }
                    }
                    catch ( err: any ) 
                    {
                        if( !id ){ continue }

                        try 
                        {
                            socket.write( JSON.stringify({ id, status : 'error', message : err.message || 'Malformed request' }) + '\n' );
                        }
                        catch
                        {
                            // ignore write failures on a broken socket
                        }
                    }
                }

                if( Buffer.byteLength( buffer, 'utf8' ) > TCP_MAX_LINE_BYTES )
                {
                    buffer = '';
                    socket.destroy();
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
