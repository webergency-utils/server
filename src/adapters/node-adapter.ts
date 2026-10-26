import { ServerAdapter, TlsOptions, NodeHttpOptions, normalizeHostList, listenNodeServer } from './adapter.js';
import { MultiBuffer, WebsocketFrame, FrameReadState } from '../helpers/ws-frame.js';
import { RequestProcessor } from '../core/request-processor.js';
import { toAllowList } from '../core/router.js';
import { getRegistry } from '../core/registry.js';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import crypto from 'node:crypto';
import { attachClientCert } from '../helpers/peer-cert.js';
import { WsHeartbeat, WsHeartbeatOptions } from './ws-heartbeat.js';
import { upgradeQuery } from './ws-upgrade.js';

const EMPTY_BUFFER = Buffer.alloc( 0 );

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

function resolveRequestUrl( req: any ): string
{
    const protocol = ( req.socket as any )?.encrypted ? 'https' : 'http';
    const host = req.headers?.host || 'localhost';

    return typeof req.url === 'string' && req.url.startsWith( '/' )
        ? `${protocol}://${host}${req.url}`
        : new URL( req.url || '/', `${protocol}://${host}` ).href;
}

function endUpgradeSocket( socket: any, rawHttp: string ): void
{
    if( socket.destroyed ){ return }

    try
    {
        if( typeof socket.end === 'function' )
        {
            socket.end( rawHttp );
        }
        else
        {
            socket.write( rawHttp );
            socket.destroy();
        }
    }
    catch
    {
        socket.destroy();
    }
}

export class NodeAdapter implements ServerAdapter 
{
    private nodeServers : any[] = [];

    public get nodeServer(): any
    {
        return this.nodeServers[0];
    }

    public set nodeServer( val: any )
    {
        if( val === undefined )
        {
            this.nodeServers = [];
        }
        else if( this.nodeServers.length === 0 )
        {
            this.nodeServers = [val];
        }
        else
        {
            this.nodeServers[0] = val;
        }
    }

    async listen(
        port: number,
        handler: ( request: Request ) => Promise<Response>,
        tls?: TlsOptions,
        http?: NodeHttpOptions,
        host?: string | string[]
    ): Promise<void> 
    {
        const registry = getRegistry();
        let cachedAllowEndpointCount = -1;
        let cachedAllowHeader = '';

        const connectionHandler = async ( req: any, res: any ) => 
        {
            // RFC 9110 asterisk-form (`OPTIONS * HTTP/1.1`) asks about server-wide
            // capabilities. It is not a path, so it must never reach URL parsing or routing.
            if( req.url === '*' ) 
            {
                const endpoints = registry.getEndpoints();

                if( endpoints.length !== cachedAllowEndpointCount )
                {
                    cachedAllowEndpointCount = endpoints.length;
                    const allowed = toAllowList( endpoints.map(( ep: any ) => ep.httpMethod ));
                    cachedAllowHeader = allowed.join( ', ' );
                }

                res.statusCode = 204;

                if( cachedAllowHeader.length > 0 ) { res.setHeader( 'Allow', cachedAllowHeader ) }
                res.end();

                return;
            }

            const method = req.method || 'GET';
            let fetchReq: Request;

            try
            {
                fetchReq = new Request( resolveRequestUrl( req ), {
                    method,
                    headers : req.headers as any,
                    body    : ( method === 'GET' || method === 'HEAD' ) ? undefined : ( req as any ),
                    // @ts-expect-error: duplex half required for fetch Request
                    duplex  : 'half'
                });
            }
            catch
            {
                res.statusCode = 400;
                res.end( 'Bad Request' );

                return;
            }

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
            response.headers.forEach(( value, key ) =>
            {
                if( key.toLowerCase() !== 'set-cookie' )
                {
                    res.setHeader( key, value );
                }
            });

            const setCookies = typeof response.headers.getSetCookie === 'function'
                ? response.headers.getSetCookie()
                : [];

            if( setCookies.length > 0 )
            {
                res.setHeader( 'set-cookie', setCookies );
            }

            if( response.body ) 
            {
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

        let serverFactory: () => any;

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

            serverFactory = () => createServer( options, connectionHandler );
        }
        else 
        {
            const { createServer } = await import( 'http' );
            serverFactory = () => createServer( connectionHandler );
        }

        const hasWs = registry.getEndpoints().some(( ep: any ) => ep.httpMethod === 'WS' );

        const configureServer = ( server: any ) =>
        {
            applyHttpTimeouts( server, http );

            if( hasWs && server && typeof server.on === 'function' ) 
            {
                server.on( 'upgrade', async ( req: any, socket: any, head: any ) => 
                {
                    let fetchReq: Request;

                    try
                    {
                        fetchReq = new Request( resolveRequestUrl( req ), {
                            method  : 'GET',
                            headers : req.headers as any
                        });
                    }
                    catch
                    {
                        endUpgradeSocket( socket, 'HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n' );

                        return;
                    }

                    ( fetchReq as any ).nodeSocket = socket;
                    ( fetchReq as any ).nodeHead = head;

                    if( req.socket?.remoteAddress )
                    {
                        ( fetchReq as any ).remoteAddress = req.socket.remoteAddress;
                    }

                    try
                    {
                        const response = await handler( fetchReq );

                        if( !( fetchReq as any ).__wsUpgraded && !socket.destroyed )
                        {
                            const bodyText = await response.text();
                            const status = response.status || 400;
                            const statusText = response.statusText || ( status === 404 ? 'Not Found' : 'Bad Request' );
                            const rawHttp =
                                `HTTP/1.1 ${status} ${statusText}\r\n` +
                                'Connection: close\r\n' +
                                `Content-Length: ${Buffer.byteLength( bodyText )}\r\n\r\n` +
                                bodyText;

                            endUpgradeSocket( socket, rawHttp );
                        }
                    }
                    catch
                    {
                        endUpgradeSocket( socket, 'HTTP/1.1 500 Internal Server Error\r\nConnection: close\r\n\r\n' );
                    }
                });
            }
        };

        const hosts = normalizeHostList( host );
        this.nodeServers = [];

        if( hosts.length === 0 )
        {
            const server = serverFactory();
            configureServer( server );
            this.nodeServers.push( server );

            return listenNodeServer( server, port );
        }

        for( const h of hosts )
        {
            const server = serverFactory();
            configureServer( server );

            try
            {
                await listenNodeServer( server, port, h );
                this.nodeServers.push( server );
            }
            catch( err )
            {
                await Promise.all(
                    this.nodeServers.map( s => new Promise<void>( r => s.close(() => r())))
                );
                this.nodeServers = [];

                throw err;
            }
        }
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

        ( request as any ).__wsUpgraded = true;
        const query = upgradeQuery( request );

        const connection = new NodeServerWebSocket( socket, head, request.headers, params, query, metadata.meta?.wsOptions );
        RequestProcessor.runWs( metadata, connection, request as any );

        return new Response( null, { status : 200 });
    }

    async close(): Promise<void> 
    {
        if( this.nodeServers.length === 0 ) { return }

        // Stop accepting new connections without waiting for active ones — Server.shutdown
        // drains activeRequests, then calls closeAllConnections for anything left.
        for( const server of this.nodeServers )
        {
            server.close(() => {});

            if( typeof server.closeIdleConnections === 'function' )
            {
                server.closeIdleConnections();
            }
        }
    }

    closeAllConnections(): void
    {
        for( const server of this.nodeServers )
        {
            if( server && typeof server.closeAllConnections === 'function' )
            {
                server.closeAllConnections();
            }
        }
    }
}

class NodeServerWebSocket 
{
    private emitter = new EventEmitter();
    private rx_buffer = new MultiBuffer();
    private tx_buffer = new MultiBuffer();
    /** Fragmented messages span reads, so the reader's state lives with the connection. */
    private frameState         : FrameReadState = {};
    private readonly heartbeat : WsHeartbeat;
    private closed = false;

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
            ping  : () => { this.send( EMPTY_BUFFER, { opcode : 0x09 }) },
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

        const onSocketClose = () => this.finalizeClose( 1000, '', false );
        this.socket.on( 'end', onSocketClose );
        this.socket.on( 'close', onSocketClose );
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

    private flushTx(): void
    {
        if( this.tx_buffer.length === 0 ) { return }

        const chunks = this.tx_buffer.splice( 0, this.tx_buffer.length );

        for( const chunk of chunks )
        {
            this.socket.write( chunk );
        }
    }

    send( data: any, options: { opcode? : number } = {}) 
    {
        if( this.closed ){ return }

        WebsocketFrame.write( this.tx_buffer, data, options );
        this.flushTx();
    }

    private finalizeClose( code?: number, reason?: string, sendCloseFrame = true )
    {
        if( this.closed ){ return }
        this.closed = true;
        this.heartbeat.stop();

        if( sendCloseFrame && !this.socket.destroyed && this.socket.writable )
        {
            let payload = code !== undefined ? Buffer.allocUnsafe( 2 ) : EMPTY_BUFFER;

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
                this.flushTx();
            }
            catch ( e ) {}
        }

        try
        {
            this.socket.end();
            this.socket.destroy();
            this.socket.removeAllListeners();
        }
        catch ( e ) {}

        this.emitter.emit( 'close', code ?? 1000, reason ?? '' );
    }

    close( code?: number, reason?: string ) 
    {
        this.finalizeClose( code, reason, true );
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
