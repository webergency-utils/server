import { ServerAdapter, TlsOptions, NodeHttpOptions, normalizeHostList } from './adapter.js';
import { EventEmitter } from 'node:events';
import { needsNodeTlsCompat, tlsMaterialToString, attachClientCert } from '../helpers/peer-cert.js';
import { NodeTlsCompat } from './node-tls-compat.js';
import { WsHeartbeat, WsHeartbeatOptions } from './ws-heartbeat.js';
import { upgradeQuery, isWsPayloadTooLarge } from './ws-upgrade.js';

export class DenoAdapter implements ServerAdapter
{
    private servers          : any[] = [];
    private abortController? : AbortController;
    private readonly nodeTls = new NodeTlsCompat();

    async listen(
        port: number,
        handler: ( request: Request ) => Promise<Response>,
        tls?: TlsOptions,
        http?: NodeHttpOptions,
        host?: string | string[]
    ): Promise<void>
    {
        // Native Deno.serve supports cert/key TLS, but not requestCert/SNI/@Peer.
        // mTLS and SNI callbacks use Node's https adapter under Deno.
        if( needsNodeTlsCompat( tls ))
        {
            await this.nodeTls.listen( port, handler, tls, http, host );
            this.servers = this.nodeTls.server ? [this.nodeTls.server] : [];

            return;
        }

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

        const serveHandler = ( req: Request, info: any ) =>
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
        };

        const hosts = normalizeHostList( host );
        this.servers = [];

        if( hosts.length === 0 )
        {
            this.servers = [( globalThis as any ).Deno.serve( options, serveHandler )];

            return;
        }

        for( const h of hosts )
        {
            try
            {
                const srv = ( globalThis as any ).Deno.serve({ ...options, hostname : h }, serveHandler );
                this.servers.push( srv );
            }
            catch( err )
            {
                this.abortController.abort();
                await Promise.all(
                    this.servers.map( async ( s ) =>
                    {
                        if( typeof s?.shutdown === 'function' ){ await s.shutdown() }

                        await s?.finished;
                    })
                );
                this.servers = [];

                throw err;
            }
        }
    }

    async upgrade( request: Request, metadata: any, params: any ): Promise<Response>
    {
        if( this.nodeTls.active )
        {
            return this.nodeTls.upgrade( request, metadata, params );
        }

        // Import before upgrade so we can attach `open` without missing a sync readyState change.
        const { RequestProcessor } = await import( '../core/request-processor.js' );
        const query = upgradeQuery( request );
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
            let started = false;
            socket.addEventListener( 'open', () =>
            {
                started = true;
                start();
            }, { once : true });

            const cleanupIfAborted = () =>
            {
                const handedOffCtx = ( request as any ).__wsRequestContext;

                if( !started && handedOffCtx )
                {
                    delete ( request as any ).__wsRequestContext;
                    void RequestProcessor.cleanupRequestContext( handedOffCtx );
                }
            };

            socket.addEventListener( 'close', cleanupIfAborted, { once : true });
            socket.addEventListener( 'error', cleanupIfAborted, { once : true });
        }

        return response;
    }

    async close(): Promise<void>
    {
        if( this.nodeTls.active )
        {
            await this.nodeTls.close();

            return;
        }

        if( this.abortController )
        {
            this.abortController.abort();
        }

        await Promise.all(
            this.servers.map( async ( srv ) =>
            {
                if( typeof srv?.shutdown === 'function' )
                {
                    await srv.shutdown();
                }

                await srv?.finished;
            })
        );
    }

    closeAllConnections(): void
    {
        if( this.nodeTls.active )
        {
            this.nodeTls.closeAllConnections();
        }
    }
}

class DenoServerWebSocket
{
    private emitter            : any;
    private readonly heartbeat : WsHeartbeat;
    private isOpen             = false;
    private pending            : any[] = [];

    constructor(
        private socket: any,
        public headers: Headers,
        public params: Record<string, string>,
        public query: Record<string, string>,
        private wsOptions?: WsHeartbeatOptions & { maxPayload? : number }
    )
    {
        this.emitter = new EventEmitter();
        this.heartbeat = new WsHeartbeat({
            // Deno's WebSocket has no ping(); reporting that keeps the socket alive.
            ping  : () => typeof this.socket.ping === 'function' ? void this.socket.ping() : false,
            close : ( code, reason ) => this.close( code, reason )
        }, this.wsOptions );

        if( this.socket.readyState === 1 )
        {
            this.isOpen = true;
            this.heartbeat.start();
        }
        else
        {
            this.socket.addEventListener( 'open', () =>
            {
                this.isOpen = true;
                this.flushPending();
                this.heartbeat.start();
            }, { once : true });
        }

        this.socket.addEventListener( 'message', ( e: any ) =>
        {
            if( isWsPayloadTooLarge( e.data, this.wsOptions?.maxPayload ))
            {
                this.close( 1009, 'Message Too Big' );

                return;
            }
            this.emitter.emit( 'message', e.data );
        });
        this.socket.addEventListener( 'close', ( e: any ) =>
        {
            this.heartbeat.stop();
            this.emitter.emit( 'close', e.code, e.reason );
        });
        this.socket.addEventListener( 'error', ( e: any ) =>
        {
            this.heartbeat.stop();
            this.emitter.emit( 'error', e.error );
        });

        this.socket.addEventListener( 'pong', () => this.heartbeat.pong());
    }

    private flushPending()
    {
        for( const data of this.pending )
        {
            this.socket.send( data );
        }
        this.pending = [];
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
        this.heartbeat.stop();
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
