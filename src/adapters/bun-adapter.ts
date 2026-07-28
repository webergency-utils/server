import { ServerAdapter, TlsOptions, NodeHttpOptions } from './adapter.js';
import { EventEmitter } from 'node:events';
import { needsNodeTlsCompat, attachBunClientCert } from '../helpers/peer-cert.js';
import { NodeTlsCompat } from './node-tls-compat.js';
import { WsHeartbeat, WsHeartbeatOptions } from './ws-heartbeat.js';
import { upgradeQuery } from './ws-upgrade.js';

export class BunAdapter implements ServerAdapter
{
    private server? : any;
    private readonly nodeTls = new NodeTlsCompat();

    async listen(
        port: number,
        handler: ( request: Request ) => Promise<Response>,
        tls?: TlsOptions,
        http?: NodeHttpOptions
    ): Promise<void>
    {
        // Bun.serve TLS works for cert/key, but peer certificates for @Peer are unreliable.
        // mTLS (requestCert) and SNI callbacks use Node's https adapter under Bun.
        if( needsNodeTlsCompat( tls ))
        {
            await this.nodeTls.listen( port, handler, tls, http );
            this.server = this.nodeTls.server;

            return;
        }

        const { getRegistry } = await import( '../core/registry.js' );
        const hasWs = getRegistry().getEndpoints().some(( ep: any ) => ep.httpMethod === 'WS' );

        const serveOptions: any = {
            port
        };

        if( tls )
        {
            serveOptions.tls = {
                key        : tls.key as any,
                cert       : tls.cert as any,
                ca         : tls.ca as any,
                ciphers    : tls.ciphers,
                minVersion : tls.minVersion,
                maxVersion : tls.maxVersion
            };
        }

        const wrapFetch = ( req: Request, server: any ) =>
        {
            ( req as any ).bunServer = server;

            if( server && typeof server.requestIP === 'function' )
            {
                try
                {
                    const info = server.requestIP( req );

                    if( info?.address )
                    {
                        ( req as any ).remoteAddress = info.address;
                    }
                }
                catch
                {
                    // ignore missing IP APIs
                }
            }

            attachBunClientCert( req, server );

            return handler( req );
        };

        if( hasWs )
        {
            const { RequestProcessor } = await import( '../core/request-processor.js' );
            serveOptions.fetch = wrapFetch;
            serveOptions.websocket = {
                open( ws: any )
                {
                    const { metadata, params, query, headers, request } = ws.data;
                    const connection = new BunServerWebSocket( ws, headers, params, query, metadata.meta?.wsOptions );
                    RequestProcessor.runWs( metadata, connection, request );
                },
                message( ws: any, msg: any )
                {
                    const maxPayload = ws.data.metadata.meta?.wsOptions?.maxPayload;

                    if( maxPayload !== undefined )
                    {
                        const len = typeof msg === 'string' ? Buffer.byteLength( msg ) : ( msg.byteLength !== undefined ? msg.byteLength : msg.length );

                        if( len > maxPayload )
                        {
                            ws.close( 1009, 'Message Too Big' );

                            return;
                        }
                    }
                    ws.data.emitter.emit( 'message', msg );
                },
                pong( ws: any )
                {
                    ws.data.emitter.emit( 'pong' );
                },
                close( ws: any, code: number, reason: string )
                {
                    ws.data.emitter.emit( 'close', code, reason );
                },
                error( ws: any, err: any )
                {
                    ws.data.emitter.emit( 'error', err );
                }
            };
        }
        else
        {
            serveOptions.fetch = wrapFetch;
        }

        this.server = ( globalThis as any ).Bun.serve( serveOptions );
    }

    upgrade( request: Request, metadata: any, params: any ): Response | Promise<Response>
    {
        if( this.nodeTls.active )
        {
            return this.nodeTls.upgrade( request, metadata, params );
        }

        const bunServer = ( request as any ).bunServer;
        const query = upgradeQuery( request );
        const emitter = new EventEmitter();

        const success = bunServer.upgrade( request, {
            data : {
                metadata,
                params,
                query,
                headers : request.headers,
                request,
                emitter
            }
        });

        if( success )
        {
            return new Response( null, { status : 200 });
        }

        return new Response( 'WebSocket upgrade failed', { status : 400 });
    }

    async close(): Promise<void>
    {
        if( this.nodeTls.active )
        {
            await this.nodeTls.close();

            return;
        }

        if( this.server && typeof this.server.stop === 'function' )
        {
            this.server.stop();
        }
    }

    closeAllConnections(): void
    {
        if( this.nodeTls.active )
        {
            this.nodeTls.closeAllConnections();
        }
    }
}

class BunServerWebSocket
{
    private readonly heartbeat : WsHeartbeat;

    constructor(
        private ws: any,
        public headers: Headers,
        public params: Record<string, string>,
        public query: Record<string, string>,
        wsOptions?: WsHeartbeatOptions & { maxPayload? : number }
    )
    {
        this.heartbeat = new WsHeartbeat({
            ping  : () => { this.ws.ping() },
            close : ( code, reason ) => this.close( code, reason )
        }, wsOptions );
        this.heartbeat.start();

        this.ws.data.emitter.on( 'pong', () => this.heartbeat.pong());
        this.ws.data.emitter.on( 'close', () => this.heartbeat.stop());
    }

    send( data: any )
    {
        this.ws.send( data );
    }

    close( code?: number, reason?: string )
    {
        this.heartbeat.stop();
        this.ws.close( code, reason );
    }

    on( event: string, cb: Function )
    {
        this.ws.data.emitter.on( event, cb as any );
    }

    off( event: string, cb: Function )
    {
        this.ws.data.emitter.off( event, cb as any );
    }
}
