import { ServerAdapter, TlsOptions } from './adapter.js';
import { EventEmitter } from 'node:events';
import { needsNodeTlsCompat, tlsMaterialToString, attachClientCert } from '../helpers/peer-cert.js';

export class DenoAdapter implements ServerAdapter
{
    private server? : any;
    private abortController? : AbortController;
    private isNodeCompat = false;
    private nodeAdapterInstance? : any;

    async listen( port: number, handler: ( request: Request ) => Promise<Response>, tls?: TlsOptions ): Promise<void>
    {
        // Native Deno.serve supports cert/key TLS, but not requestCert/SNI/@Peer.
        // mTLS and SNI callbacks use Node's https adapter under Deno.
        if( needsNodeTlsCompat( tls ))
        {
            this.isNodeCompat = true;
            const { NodeAdapter } = await import( './node-adapter.js' );
            this.nodeAdapterInstance = new NodeAdapter();
            await this.nodeAdapterInstance.listen( port, handler, tls );
            this.server = this.nodeAdapterInstance.nodeServer;

            return;
        }

        this.isNodeCompat = false;
        this.abortController = new AbortController();
        const options: any = {
            port,
            signal : this.abortController.signal
        };

        if( tls )
        {
            const cert = tlsMaterialToString( tls.cert as any );
            const key = tlsMaterialToString( tls.key as any );

            if( !cert || !key )
            {
                throw new Error( 'Deno TLS requires both tls.cert and tls.key PEM material' );
            }

            options.cert = cert;
            options.key = key;
        }

        this.server = ( globalThis as any ).Deno.serve( options, ( req: Request, info: any ) =>
        {
            if( info?.remoteAddr?.hostname )
            {
                ( req as any ).remoteAddress = info.remoteAddr.hostname;
            }

            // Best-effort if a future Deno ConnInfo exposes peer certificates.
            if( info?.peerCertificate || info?.tls?.peerCertificate )
            {
                attachClientCert( req, info.peerCertificate || info.tls.peerCertificate );
            }

            return handler( req );
        });
    }

    async upgrade( request: Request, metadata: any, params: any ): Promise<Response>
    {
        if( this.isNodeCompat && this.nodeAdapterInstance )
        {
            return this.nodeAdapterInstance.upgrade( request, metadata, params );
        }

        // Import before upgrade so we can attach `open` without missing a sync readyState change.
        const { RequestProcessor } = await import( '../core/request-processor.js' );
        const url = new URL( request.url );
        const query = Object.fromEntries( url.searchParams.entries());
        const { socket, response } = ( globalThis as any ).Deno.upgradeWebSocket( request );
        const connection = new DenoServerWebSocket( socket, request.headers, params, query, metadata.meta?.wsOptions );

        const start = () =>
        {
            RequestProcessor.runWs( metadata, connection, request as any );
        };

        // Deno WebSockets cannot send until `open` (unlike Node/Bun upgrade paths).
        if( socket.readyState === 1 )
        {
            start();
        }
        else
        {
            socket.addEventListener( 'open', start, { once : true });
        }

        return response;
    }

    async close(): Promise<void>
    {
        if( this.isNodeCompat && this.nodeAdapterInstance )
        {
            await this.nodeAdapterInstance.close();

            return;
        }

        if( this.abortController )
        {
            this.abortController.abort();
        }

        if( this.server )
        {
            if( typeof this.server.shutdown === 'function' )
            {
                await this.server.shutdown();
            }
            await this.server.finished;
        }
    }
}

class DenoServerWebSocket
{
    private emitter            : any;
    private pingIntervalTimer? : any;
    private pingTimeoutTimer?  : any;
    private lastPongReceived = true;
    private isOpen = false;
    private pending: any[] = [];

    constructor(
        private socket: any,
        public headers: Headers,
        public params: Record<string, string>,
        public query: Record<string, string>,
        private wsOptions?: { pingInterval? : number, pingTimeout? : number, maxPayload? : number }
    )
    {
        this.emitter = new EventEmitter();

        if( this.socket.readyState === 1 )
        {
            this.isOpen = true;
            this.startHeartbeat();
        }
        else
        {
            this.socket.addEventListener( 'open', () =>
            {
                this.isOpen = true;
                this.flushPending();
                this.startHeartbeat();
            }, { once : true });
        }

        this.socket.addEventListener( 'message', ( e: any ) =>
        {
            const maxPayload = this.wsOptions?.maxPayload;

            if( maxPayload !== undefined )
            {
                const len = typeof e.data === 'string' ? new TextEncoder().encode( e.data ).length : ( e.data.byteLength !== undefined ? e.data.byteLength : e.data.length || 0 );

                if( len > maxPayload )
                {
                    this.close( 1009, 'Message Too Big' );

                    return;
                }
            }
            this.emitter.emit( 'message', e.data );
        });
        this.socket.addEventListener( 'close', ( e: any ) =>
        {
            this.clearTimers();
            this.emitter.emit( 'close', e.code, e.reason );
        });
        this.socket.addEventListener( 'error', ( e: any ) =>
        {
            this.clearTimers();
            this.emitter.emit( 'error', e.error );
        });

        this.socket.addEventListener( 'pong', () =>
        {
            this.lastPongReceived = true;

            if( this.pingTimeoutTimer )
            {
                clearTimeout( this.pingTimeoutTimer );
                this.pingTimeoutTimer = undefined;
            }
        });
    }

    private flushPending()
    {
        for( const data of this.pending )
        {
            this.socket.send( data );
        }
        this.pending = [];
    }

    private startHeartbeat()
    {
        if( !this.wsOptions?.pingInterval ){ return }

        this.pingIntervalTimer = setInterval(() =>
        {
            if( !this.lastPongReceived )
            {
                if( !this.wsOptions?.pingTimeout )
                {
                    this.close( 1002, 'Ping Timeout' );

                    return;
                }
            }

            this.lastPongReceived = false;
            try
            {
                if( typeof this.socket.ping === 'function' )
                {
                    this.socket.ping();
                }
                else
                {
                    this.lastPongReceived = true;
                }
            }
            catch( e )
            {
                this.close( 1002, 'Ping failed' );

                return;
            }

            if( this.wsOptions?.pingTimeout )
            {
                this.pingTimeoutTimer = setTimeout(() =>
                {
                    if( !this.lastPongReceived )
                    {
                        this.close( 1002, 'Ping Timeout' );
                    }
                }, this.wsOptions.pingTimeout );
            }
        }, this.wsOptions.pingInterval );
    }

    private clearTimers()
    {
        if( this.pingIntervalTimer )
        {
            clearInterval( this.pingIntervalTimer );
            this.pingIntervalTimer = undefined;
        }

        if( this.pingTimeoutTimer )
        {
            clearTimeout( this.pingTimeoutTimer );
            this.pingTimeoutTimer = undefined;
        }
    }

    send( data: any )
    {
        if( !this.isOpen )
        {
            this.pending.push( data );

            return;
        }

        this.socket.send( data );
    }

    close( code?: number, reason?: string )
    {
        this.clearTimers();
        this.pending = [];
        this.socket.close( code, reason );
    }

    on( event: string, cb: Function )
    {
        this.emitter.on( event, cb as any );
    }

    off( event: string, cb: Function )
    {
        this.emitter.off( event, cb as any );
    }
}
