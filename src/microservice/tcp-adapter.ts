import { MicroserviceAdapter, MessageConnection, MicroserviceNoReply } from './adapter.js';
import { NdjsonLineFramer, TCP_MAX_LINE_BYTES } from './ndjson-framer.js';
import { normalizeHostList, listenNodeServer } from '../adapters/adapter.js';
import { httpStatusFromError } from '../errors.js';
import { clientErrorBody } from '../helpers/error-response.js';
import net from 'node:net';

export { TCP_MAX_LINE_BYTES };

export interface TcpMessageAdapterOptions
{
    port                    : number
    host?                   : string | string[]
    exposeErrors?           : boolean
    maxConcurrentPerSocket? : number
}

const DEFAULT_LOOPBACK_HOSTS = [ '127.0.0.1', '::1' ];
const DEFAULT_MAX_CONCURRENT_PER_SOCKET = 128;

export class TcpMessageAdapter implements MicroserviceAdapter 
{
    private servers                : net.Server[] = [];
    private closingServers         : Promise<void>[] = [];
    private connections            = new Set<net.Socket>();
    private activeHandlers         = 0;
    private drainWaiters           : Array<() => void> = [];
    private readonly port          : number;
    private readonly host?         : string | string[];
    private exposeErrors           : boolean;
    private maxConcurrentPerSocket : number;

    constructor(
        portOrOptions : number | TcpMessageAdapterOptions,
        host?         : string | string[],
        options?      : Omit<TcpMessageAdapterOptions, 'port' | 'host'>
    )
    {
        if( typeof portOrOptions === 'object' && portOrOptions !== null )
        {
            this.port = portOrOptions.port;
            this.host = portOrOptions.host;
            this.exposeErrors = Boolean( portOrOptions.exposeErrors );
            this.maxConcurrentPerSocket = portOrOptions.maxConcurrentPerSocket ?? DEFAULT_MAX_CONCURRENT_PER_SOCKET;
        }
        else
        {
            this.port = portOrOptions;
            this.host = host;
            this.exposeErrors = Boolean( options?.exposeErrors );
            this.maxConcurrentPerSocket = options?.maxConcurrentPerSocket ?? DEFAULT_MAX_CONCURRENT_PER_SOCKET;
        }
    }

    public setExposeErrors( expose: boolean ): void
    {
        this.exposeErrors = expose;
    }

    async listen( handler: ( pattern: string, payload: any, connection: MessageConnection ) => Promise<any> ): Promise<void> 
    {
        const createTcpServer = () => net.createServer(( socket ) => 
        {
            this.connections.add( socket );
            const framer = new NdjsonLineFramer( TCP_MAX_LINE_BYTES );
            let inFlight = 0;

            const handleLine = async ( line: string ): Promise<void> =>
            {
                let id: string | number | undefined;
                let hasId = false;
                let sentViaConnection = false;

                try 
                {
                    const envelope = JSON.parse( line );

                    if( !envelope || typeof envelope !== 'object' || Array.isArray( envelope ))
                    {
                        return;
                    }

                    const rawId = ( envelope as Record<string, unknown> ).id;

                    if( rawId !== undefined && rawId !== null && ( typeof rawId === 'string' || typeof rawId === 'number' ))
                    {
                        id = rawId;
                        hasId = true;
                    }

                    const { pattern, payload } = envelope as { pattern? : unknown, payload? : unknown };

                    if( typeof pattern !== 'string' || pattern.length === 0 ) 
                    {
                        if( hasId && socket.writable ) 
                        {
                            socket.write( JSON.stringify({ id, status : 'error', message : 'Missing pattern' }) + '\n' );
                        }

                        return;
                    }

                    const connection: MessageConnection = {
                        send : ( data: any ) => 
                        {
                            sentViaConnection = true;

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
                    if( result !== MicroserviceNoReply && !sentViaConnection && hasId && socket.writable )
                    {
                        socket.write( JSON.stringify({ id, status : 'success', data : result }) + '\n' );
                    }
                }
                catch( err: any ) 
                {
                    if( !hasId ){ return }

                    try 
                    {
                        if( socket.writable )
                        {
                            if( err instanceof SyntaxError )
                            {
                                socket.write( JSON.stringify({ id, status : 'error', message : 'Malformed request' }) + '\n' );

                                return;
                            }

                            const status = httpStatusFromError( err );
                            const body = clientErrorBody( err, status, this.exposeErrors );
                            const message = typeof body.error === 'string'
                                ? body.error
                                : ( status >= 500 && !this.exposeErrors ? 'Internal server error' : ( err?.message || 'Malformed request' ));
                            const { success : _s, error : _e, ...extra } = body;
                            const replyEnvelope: Record<string, unknown> = { id, status : 'error', message };

                            if( Object.keys( extra ).length > 0 )
                            {
                                replyEnvelope.data = extra;
                            }

                            socket.write( JSON.stringify( replyEnvelope ) + '\n' );
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
                    inFlight++;
                    this.activeHandlers++;

                    if( inFlight >= this.maxConcurrentPerSocket )
                    {
                        socket.pause();
                    }

                    void handleLine( line ).finally(() =>
                    {
                        inFlight--;
                        this.activeHandlers--;

                        if( inFlight < this.maxConcurrentPerSocket && !socket.destroyed )
                        {
                            socket.resume();
                        }

                        if( this.activeHandlers === 0 && this.drainWaiters.length > 0 )
                        {
                            const waiters = this.drainWaiters.splice( 0 );

                            for( const wake of waiters )
                            {
                                wake();
                            }
                        }
                    });
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

        this.servers = [];
        this.closingServers = [];

        if( this.host === undefined )
        {
            let lastErr: unknown;

            for( const h of DEFAULT_LOOPBACK_HOSTS )
            {
                const server = createTcpServer();

                try
                {
                    await listenNodeServer( server, this.port, h );
                    this.servers.push( server );
                }
                catch( err: any )
                {
                    lastErr = err;
                    const code = err?.code;

                    if( code !== 'EADDRNOTAVAIL' && code !== 'EAFNOSUPPORT' )
                    {
                        await Promise.all(
                            this.servers.map( s => new Promise<void>( r => s.close(() => r())))
                        );
                        this.servers = [];

                        throw err;
                    }
                }
            }

            if( this.servers.length === 0 )
            {
                throw lastErr ?? new Error( 'Failed to bind loopback interface' );
            }

            return;
        }

        const hosts = normalizeHostList( this.host );

        if( hosts.length === 0 )
        {
            const server = createTcpServer();
            this.servers = [server];

            return listenNodeServer( server, this.port );
        }

        for( const h of hosts )
        {
            const server = createTcpServer();

            try
            {
                await listenNodeServer( server, this.port, h );
                this.servers.push( server );
            }
            catch( err )
            {
                await Promise.all(
                    this.servers.map( s => new Promise<void>( r => s.close(() => r())))
                );
                this.servers = [];

                throw err;
            }
        }
    }

    async stopAccepting(): Promise<void>
    {
        if( this.servers.length === 0 ){ return }

        const targets = this.servers;
        this.servers = [];
        this.closingServers = targets.map(
            srv => new Promise<void>( resolve => srv.close(() => resolve()))
        );
    }

    async drain( timeoutMs = 10000 ): Promise<void>
    {
        if( this.activeHandlers <= 0 ){ return }

        await new Promise<void>(( resolve ) =>
        {
            const timer = setTimeout( resolve, timeoutMs );
            timer.unref?.();
            this.drainWaiters.push(() =>
            {
                clearTimeout( timer );
                resolve();
            });
        });
    }

    async close(): Promise<void> 
    {
        const sockets = Array.from( this.connections );
        this.connections.clear();

        await Promise.all( sockets.map( socket => new Promise<void>(( resolve ) =>
        {
            if( socket.destroyed )
            {
                resolve();

                return;
            }

            const timer = setTimeout(() =>
            {
                if( !socket.destroyed )
                {
                    socket.destroy();
                }

                resolve();
            }, 50 );
            timer.unref?.();

            socket.once( 'close', () =>
            {
                clearTimeout( timer );
                resolve();
            });

            if( socket.writable )
            {
                socket.end();
            }
            else
            {
                socket.destroy();
            }
        })));

        const targets = this.servers;
        const pendingCloses = this.closingServers;
        this.servers = [];
        this.closingServers = [];

        await Promise.all([
            ...pendingCloses,
            ...targets.map( srv => new Promise<void>( resolve => srv.close(() => resolve())))
        ]);
    }
}
