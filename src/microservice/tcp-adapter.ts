import { MicroserviceAdapter, MessageConnection, MicroserviceNoReply } from './adapter.js';
import { NdjsonLineFramer, TCP_MAX_LINE_BYTES } from './ndjson-framer.js';
import { normalizeHostList } from '../adapters/adapter.js';
import net from 'node:net';

export { TCP_MAX_LINE_BYTES };

export class TcpMessageAdapter implements MicroserviceAdapter 
{
    private server? : net.Server;
    private servers : net.Server[] = [];
    private connections = new Set<net.Socket>();

    constructor( private port: number, private host?: string | string[] ) {}

    async listen( handler: ( pattern: string, payload: any, connection: MessageConnection ) => Promise<any> ): Promise<void> 
    {
        const createTcpServer = () => net.createServer(( socket ) => 
        {
            this.connections.add( socket );
            const framer = new NdjsonLineFramer( TCP_MAX_LINE_BYTES );

            const handleLine = async ( line: string ): Promise<void> =>
            {
                let id: string | undefined;

                try 
                {
                    const envelope = JSON.parse( line );
                    id = envelope.id;
                    const { pattern, payload } = envelope;

                    if( !pattern ) 
                    {
                        if( id && socket.writable ) 
                        {
                            socket.write( JSON.stringify({ id, status : 'error', message : 'Missing pattern' }) + '\n' );
                        }

                        return;
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
                    if( result !== MicroserviceNoReply && id && socket.writable )
                    {
                        socket.write( JSON.stringify({ id, status : 'success', data : result }) + '\n' );
                    }
                }
                catch( err: any ) 
                {
                    if( !id ){ return }

                    try 
                    {
                        if( socket.writable )
                        {
                            socket.write( JSON.stringify({ id, status : 'error', message : err.message || 'Malformed request' }) + '\n' );
                        }
                    }
                    catch
                    {
                        // ignore write failures on a broken socket
                    }
                }
            };

            socket.on( 'data', ( chunk ) => 
            {
                const { lines, oversized } = framer.push( chunk );

                if( oversized )
                {
                    socket.destroy();

                    return;
                }

                for( const line of lines )
                {
                    void handleLine( line );
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

        const hosts = normalizeHostList( this.host );
        this.servers = [];

        if( hosts.length === 0 )
        {
            const server = createTcpServer();
            this.server = server;
            this.servers = [server];

            return new Promise<void>(( resolve, reject ) => 
            {
                const onError = ( err: Error ) => reject( err );
                server.once( 'error', onError );
                server.listen( this.port, () => 
                {
                    server.off( 'error', onError );
                    resolve();
                });
            });
        }

        for( const h of hosts )
        {
            const server = createTcpServer();

            try
            {
                await new Promise<void>(( resolve, reject ) =>
                {
                    const onError = ( err: Error ) => reject( err );
                    server.once( 'error', onError );
                    server.listen( this.port, h, () =>
                    {
                        server.off( 'error', onError );
                        resolve();
                    });
                });

                this.servers.push( server );
            }
            catch( err )
            {
                await Promise.all(
                    this.servers.map( s => new Promise<void>( r => s.close(() => r())))
                );
                this.servers = [];
                this.server = undefined;

                throw err;
            }
        }

        this.server = this.servers[0];
    }

    async close(): Promise<void> 
    {
        for( const socket of this.connections ) 
        {
            socket.destroy();
        }
        this.connections.clear();

        const targets = this.servers.length > 0 ? this.servers : ( this.server ? [this.server] : []);
        this.servers = [];
        this.server = undefined;

        await Promise.all(
            targets.map( srv => new Promise<void>( resolve => srv.close(() => resolve())))
        );
    }
}
