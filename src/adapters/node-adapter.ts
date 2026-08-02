import { ServerAdapter, TlsOptions, NodeHttpOptions } from './adapter.js';
import { SimpleMultibuffer, WebsocketFrame, FrameReadState } from '../helpers/ws-frame.js';
import { RequestProcessor } from '../core/request-processor.js';
import { toAllowList } from '../core/router.js';
import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';
import { attachClientCert } from '../helpers/peer-cert.js';
import { WsHeartbeat, WsHeartbeatOptions } from './ws-heartbeat.js';
import { upgradeQuery } from './ws-upgrade.js';

/** Applied whenever the caller omits a timeout so the listener is never left unprotected. */
export const DEFAULT_NODE_HTTP: Required<NodeHttpOptions> = {
    headersTimeout   : 60_000,
    requestTimeout   : 300_000,
    keepAliveTimeout : 5_000
};

function applyHttpTimeouts( server: any, http?: NodeHttpOptions ): void
{
    server.headersTimeout = http?.headersTimeout ?? DEFAULT_NODE_HTTP.headersTimeout;
    server.requestTimeout = http?.requestTimeout ?? DEFAULT_NODE_HTTP.requestTimeout;
    server.keepAliveTimeout = http?.keepAliveTimeout ?? DEFAULT_NODE_HTTP.keepAliveTimeout;
}

export class NodeAdapter implements ServerAdapter 
{
    private nodeServer? : any;

    async listen(
        port: number,
        handler: ( request: Request ) => Promise<Response>,
        tls?: TlsOptions,
        http?: NodeHttpOptions
    ): Promise<void> 
    {
        const { getRegistry } = await import( '../core/registry.js' );
        const registry = getRegistry();

        const connectionHandler = async ( req: any, res: any ) => 
        {
            // RFC 9110 asterisk-form (`OPTIONS * HTTP/1.1`) asks about server-wide
            // capabilities. It is not a path, so it must never reach URL parsing or routing.
            if( req.url === '*' ) 
            {
                const allowed = toAllowList( registry.getEndpoints().map(( ep: any ) => ep.httpMethod ));
                res.statusCode = 204;

                if( allowed.length > 0 ) { res.setHeader( 'Allow', allowed.join( ', ' )) }
                res.end();

                return;
            }

            const protocol = ( req.socket as any ).encrypted ? 'https' : 'http';
            const url = `${protocol}://${req.headers.host}${req.url}`;
            const fetchReq = new Request( url, {
                method  : req.method,
                headers : req.headers as any,
                body    : ['GET', 'HEAD'].includes( req.method || '' ) ? undefined : ( req as any ),
                // @ts-expect-error: duplex half required for fetch Request
                duplex  : 'half'
            });

            if( req.socket?.remoteAddress )
            {
                ( fetchReq as any ).remoteAddress = req.socket.remoteAddress;
            }

            if( req.socket && typeof req.socket.getPeerCertificate === 'function' ) 
            {
                attachClientCert( fetchReq, req.socket.getPeerCertificate());
            }
            const response = await handler( fetchReq );
            res.statusCode = response.status;
            response.headers.forEach(( value, key ) => res.setHeader( key, value ));

            if( response.body ) 
            {
                const { Readable } = await import( 'node:stream' );
                // Pipe Fetch body → Node response with backpressure (no full buffering).
                const nodeBody = Readable.fromWeb( response.body as any );
                nodeBody.on( 'error', ( err: Error ) =>
                {
                    if( !res.destroyed ){ res.destroy( err ) }
                });
                res.on( 'close', () =>
                {
                    if( !nodeBody.destroyed ){ nodeBody.destroy() }
                });
                nodeBody.pipe( res );
            }
            else { res.end() }
        };

        if( tls ) 
        {
            const { createServer } = await import( 'https' );
            const options: any = {
        key                : tls.key as any,
        cert               : tls.cert as any,
        ca                 : tls.ca as any,
        ciphers            : tls.ciphers,
        minVersion         : tls.minVersion,
        maxVersion         : tls.maxVersion,
        requestCert        : tls.requestCert,
        rejectUnauthorized : tls.rejectUnauthorized
      };

            if( tls.sniCallback ) 
            {
                const { createSecureContext } = await import( 'node:tls' );
                options.SNICallback = async ( servername: string, callback: any ) => 
                {
                    try 
                    {
                        const credentials = await tls.sniCallback!( servername );

                        if( credentials ) 
                        {
                            const ctx = createSecureContext({
                                key        : credentials.key as any,
                                cert       : credentials.cert as any,
                                ca         : credentials.ca as any,
                                ciphers    : tls.ciphers,
                                minVersion : tls.minVersion,
                                maxVersion : tls.maxVersion
                            });
                            callback( null, ctx );
                        }
                        else 
                        {
                            callback( new Error( `No secure context for servername: ${servername}` ));
                        }
                    }
                    catch ( err ) 
                    {
                        callback( err );
                    }
                };
            }

            this.nodeServer = createServer( options, connectionHandler );
        }
        else 
        {
            const { createServer } = await import( 'http' );
            this.nodeServer = createServer( connectionHandler );
        }

        applyHttpTimeouts( this.nodeServer, http );

        const hasWs = registry.getEndpoints().some(( ep: any ) => ep.httpMethod === 'WS' );

        if( hasWs && this.nodeServer && typeof this.nodeServer.on === 'function' ) 
        {
            this.nodeServer.on( 'upgrade', async ( req: any, socket: any, head: any ) => 
            {
                const protocol = ( req.socket as any ).encrypted ? 'https' : 'http';
                const url = `${protocol}://${req.headers.host}${req.url}`;
                const fetchReq = new Request( url, {
                    method  : 'GET',
                    headers : req.headers as any
                });
                ( fetchReq as any ).nodeSocket = socket;
                ( fetchReq as any ).nodeHead = head;

                if( req.socket?.remoteAddress )
                {
                    ( fetchReq as any ).remoteAddress = req.socket.remoteAddress;
                }

                await handler( fetchReq );
            });
        }
    
        return new Promise<void>(( resolve ) => 
        {
            this.nodeServer.listen( port, () => 
            {
                resolve();
            });
        });
    }

    async upgrade( request: Request, metadata: any, params: any ): Promise<Response> 
    {
        const socket = ( request as any ).nodeSocket;
        const head = ( request as any ).nodeHead;

        if( !socket ) 
        {
            return new Response( 'No Node socket available', { status : 400 });
        }

        const wsKey = request.headers.get( 'sec-websocket-key' );

        if( !wsKey ) 
        {
            return new Response( 'Missing sec-websocket-key', { status : 400 });
        }

        const magicString = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
        const acceptKey = crypto
            .createHash( 'sha1' )
            .update( wsKey + magicString )
            .digest( 'base64' );

        socket.write(
            'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${acceptKey}\r\n\r\n`
        );

        const query = upgradeQuery( request );

        const connection = new NodeServerWebSocket( socket, head, request.headers, params, query, metadata.meta?.wsOptions );
        RequestProcessor.runWs( metadata, connection, request as any );

        return new Response( null, { status : 200 });
    }

    async close(): Promise<void> 
    {
        if( !this.nodeServer ) { return }

        // Stop accepting new connections without waiting for active ones — Server.shutdown
        // drains activeRequests, then calls closeAllConnections for anything left.
        this.nodeServer.close(() => {});

        if( typeof this.nodeServer.closeIdleConnections === 'function' )
        {
            this.nodeServer.closeIdleConnections();
        }
    }

    closeAllConnections(): void
    {
        if( this.nodeServer && typeof this.nodeServer.closeAllConnections === 'function' )
        {
            this.nodeServer.closeAllConnections();
        }
    }
}

class NodeServerWebSocket 
{
    private emitter = new EventEmitter();
    private rx_buffer = new SimpleMultibuffer();
    private tx_buffer = new SimpleMultibuffer();
    /** Fragmented messages span reads, so the reader's state lives with the connection. */
    private frameState         : FrameReadState = {};
    private readonly heartbeat : WsHeartbeat;

    constructor(
        private socket: any,
        head: Buffer,
        public headers: Headers,
        public params: Record<string, string>,
        public query: Record<string, string>,
        private wsOptions?: WsHeartbeatOptions & { maxPayload? : number }
    ) 
    {
        this.heartbeat = new WsHeartbeat({
            ping  : () => { this.send( Buffer.alloc( 0 ), { opcode : 0x09 }) },
            close : ( code, reason ) => this.close( code, reason )
        }, this.wsOptions );

        this.socket.setTimeout( 0 );
        this.socket.setNoDelay();

        if( head && head.length > 0 ) 
        {
            this.rx_buffer.append( head );
        }

        const emit = ( event: string, ...args: any[]) => 
        {
            this.emitter.emit( event, ...args );
        };

        this.socket.on( 'data', ( data: Buffer ) => 
        {
            this.rx_buffer.append( data );
            WebsocketFrame.read( this.rx_buffer, emit, { maxPayload : this.wsOptions?.maxPayload }, this.frameState );
        });

        this.socket.on( 'end', () => this.close( 1000 ));
        this.socket.on( 'close', () => this.close( 1000 ));
        this.socket.on( 'error', ( err: any ) => 
        {
            this.emitter.emit( 'error', err );
        });

        this.on( 'ping', ( payload: Buffer ) => 
        {
            this.send( payload, { opcode : 0x0a });
        });
        this.on( 'pong', () => this.heartbeat.pong());
        this.on( 'limit_exceeded', () => 
        {
            this.close( 1009, 'Message Too Big' );
        });
        this.on( 'protocol_error', ( code: number, reason: string ) => 
        {
            this.close( code, reason );
        });
        this.on( 'closing', ( code: number, reason: string ) => 
        {
            this.close( code, reason );
        });

        this.heartbeat.start();
    }

    send( data: any, options: { opcode? : number } = {}) 
    {
        WebsocketFrame.write( this.tx_buffer, data, options );

        while( this.tx_buffer.length > 0 ) 
        {
            this.socket.write( this.tx_buffer.spliceConcat( 0, this.tx_buffer.length ));
        }
    }

    close( code?: number, reason?: string ) 
    {
        this.heartbeat.stop();

        let payload = Buffer.alloc( code !== undefined ? 2 : 0 );

        if( code !== undefined ) 
        {
            payload.writeUInt16BE( code, 0 );

            if( reason ) 
            {
                payload = Buffer.concat([payload, Buffer.from( reason, 'utf8' )]);
            }
        }
    
        try 
        {
            WebsocketFrame.write( this.tx_buffer, payload, { opcode : 0x08 });

            while( this.tx_buffer.length > 0 ) 
            {
                this.socket.write( this.tx_buffer.spliceConcat( 0, this.tx_buffer.length ));
            }
        }
        catch ( e ) {}

        this.socket.end();
        this.socket.destroy();
        this.socket.removeAllListeners();
        this.emitter.emit( 'close' );
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
