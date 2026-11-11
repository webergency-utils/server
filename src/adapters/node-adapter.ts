import { ServerAdapter, TlsOptions, NodeHttpOptions, normalizeHostList, listenNodeServer } from './adapter.js';
import { MultiBuffer, WebsocketFrame, FrameReadState } from '../helpers/ws-frame.js';
import { RequestProcessor } from '../core/request-processor.js';
import { getDirectResponseBody, hasDirectResponseBody } from '../core/types.js';
import { toAllowList } from '../core/router.js';
import { getRegistry } from '../core/registry.js';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import crypto from 'node:crypto';
import { attachClientCert } from '../helpers/peer-cert.js';
import { extractHostname } from '../helpers/security.js';
import { WsHeartbeat, WsHeartbeatOptions } from './ws-heartbeat.js';
import { upgradeQuery, isValidWsHandshakeKey, truncateWsReason } from './ws-upgrade.js';

const EMPTY_BUFFER = Buffer.alloc( 0 );
const MAX_BUFFERED_WS_MESSAGES = 32;
const MAX_HOST_CACHE_SIZE = 64;
const validatedHostCache = new Map<string, string>();

/** Applied whenever the caller omits a timeout so the listener is never left unprotected. */
export const DEFAULT_NODE_HTTP: Required<Pick<NodeHttpOptions, 'headersTimeout' | 'requestTimeout' | 'keepAliveTimeout'>> = {
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

function validateHostAuthority( rawHost: unknown ): string
{
    if( rawHost === undefined || rawHost === null || rawHost === '' )
    {
        return 'localhost';
    }

    if( typeof rawHost !== 'string' )
    {
        throw new TypeError( 'Invalid Host header' );
    }

    const cached = validatedHostCache.get( rawHost );

    if( cached !== undefined )
    {
        return cached;
    }

    const trimmed = rawHost.trim();

    if( !trimmed )
    {
        return 'localhost';
    }

    const hostname = extractHostname( trimmed );

    if( !hostname )
    {
        throw new TypeError( 'Invalid Host header' );
    }

    let portSuffix = '';

    if( trimmed.startsWith( '[' ))
    {
        const close = trimmed.indexOf( ']' );
        portSuffix = trimmed.slice( close + 1 );
    }
    else
    {
        const colon = trimmed.indexOf( ':' );

        if( colon !== -1 )
        {
            portSuffix = trimmed.slice( colon );
        }
    }

    if( portSuffix.length > 0 )
    {
        if( !/^:\d{1,5}$/.test( portSuffix ))
        {
            throw new TypeError( 'Invalid Host header port' );
        }

        const portNum = Number( portSuffix.slice( 1 ));

        if( portNum < 1 || portNum > 65535 )
        {
            throw new TypeError( 'Invalid Host header port' );
        }
    }

    if( validatedHostCache.size >= MAX_HOST_CACHE_SIZE )
    {
        const oldest = validatedHostCache.keys().next().value;

        if( oldest !== undefined )
        {
            validatedHostCache.delete( oldest );
        }
    }

    validatedHostCache.set( rawHost, trimmed );

    return trimmed;
}

function hasInvalidTargetChar( s: string ): boolean
{
    for( let i = 0; i < s.length; i++ )
    {
        const code = s.charCodeAt( i );

        if( code <= 0x20 || code === 0x7f )
        {
            return true;
        }
    }

    return false;
}

function resolveRequestUrl( req: any ): string
{
    const protocol = ( req.socket as any )?.encrypted ? 'https' : 'http';
    const authority = validateHostAuthority( req.headers?.host );
    const rawTarget = req.url;

    if( rawTarget === undefined || rawTarget === null || rawTarget === '' )
    {
        return `${protocol}://${authority}/`;
    }

    if( typeof rawTarget !== 'string' || hasInvalidTargetChar( rawTarget ))
    {
        throw new TypeError( 'Invalid request target' );
    }

    if( rawTarget.startsWith( '/' ))
    {
        return `${protocol}://${authority}${rawTarget}`;
    }

    if( /^https?:\/\//i.test( rawTarget ))
    {
        const parsed = new URL( rawTarget );

        return `${protocol}://${authority}${parsed.pathname || '/'}${parsed.search}`;
    }

    throw new TypeError( 'Invalid request target' );
}

function defaultReasonPhrase( status: number ): string
{
    if( status === 401 ){ return 'Unauthorized' }

    if( status === 403 ){ return 'Forbidden' }

    if( status === 404 ){ return 'Not Found' }

    if( status === 426 ){ return 'Upgrade Required' }

    if( status === 429 ){ return 'Too Many Requests' }

    if( status >= 500 ){ return 'Internal Server Error' }

    return 'Bad Request';
}

function formatUpgradeRejection( response: Response, bodyText: string ): string
{
    const status = response.status || 400;
    const statusText = ( response.statusText || defaultReasonPhrase( status )).replace( /[\r\n]+/g, ' ' );
    let headerLines = '';

    response.headers.forEach(( value, key ) =>
    {
        const lower = key.toLowerCase();

        if( lower === 'connection' || lower === 'content-length' || lower === 'transfer-encoding' )
        {
            return;
        }

        const safeKey = key.replace( /[^\x21-\x7e]/g, '' );
        const safeVal = value.replace( /[\r\n]+/g, ' ' );

        if( safeKey )
        {
            headerLines += `${safeKey}: ${safeVal}\r\n`;
        }
    });

    return (
        `HTTP/1.1 ${status} ${statusText}\r\n` +
        headerLines +
        'Connection: close\r\n' +
        `Content-Length: ${Buffer.byteLength( bodyText )}\r\n\r\n` +
        bodyText
    );
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
    private wsConnections = new Set<NodeServerWebSocket>();

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
            const method = req.method || 'GET';

            // RFC 9110 asterisk-form (`OPTIONS * HTTP/1.1`) asks about server-wide
            // capabilities. It is not a path, so it must never reach URL parsing or routing.
            if( req.url === '*' && method === 'OPTIONS' ) 
            {
                try
                {
                    validateHostAuthority( req.headers?.host );
                }
                catch
                {
                    res.statusCode = 400;
                    res.end( 'Bad Request' );

                    return;
                }

                const endpoints = registry.getEndpoints();

                if( endpoints.length !== cachedAllowEndpointCount )
                {
                    cachedAllowEndpointCount = endpoints.length;
                    const publicMethods = endpoints
                        .filter(( ep: any ) => !ep.meta?.internal )
                        .map(( ep: any ) => ep.httpMethod );
                    const allowed = toAllowList( publicMethods );
                    cachedAllowHeader = allowed.join( ', ' );
                }

                res.statusCode = 204;

                if( cachedAllowHeader.length > 0 ) { res.setHeader( 'Allow', cachedAllowHeader ) }
                res.end();

                return;
            }

            let fetchReq: Request;

            try
            {
                const url = resolveRequestUrl( req );
                fetchReq = ( method === 'GET' || method === 'HEAD' )
                    ? new Request( url, {
                        method,
                        headers : req.headers as any
                    })
                    : new Request( url, {
                        method,
                        headers : req.headers as any,
                        body    : req as any,
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

            let lazyAbortController: AbortController | undefined;
            const rawDisconnected = (): boolean => Boolean(
                req.aborted
                || ( res.destroyed && !res.writableEnded && !res.finished )
            );
            ( fetchReq as any ).__isDisconnected = (): boolean =>
                lazyAbortController !== undefined ? lazyAbortController.signal.aborted : rawDisconnected();
            ( fetchReq as any ).__getDisconnectSignal = (): AbortSignal =>
            {
                if( lazyAbortController === undefined )
                {
                    const ac = new AbortController();
                    lazyAbortController = ac;

                    if( rawDisconnected())
                    {
                        ac.abort();
                    }
                    else
                    {
                        const abortOnDisconnect = () =>
                        {
                            if( !ac.signal.aborted )
                            {
                                ac.abort();
                            }
                        };

                        if( typeof req.on === 'function' )
                        {
                            req.on( 'aborted', abortOnDisconnect );
                        }

                        if( typeof res.on === 'function' )
                        {
                            res.on( 'close', () =>
                            {
                                if( !res.writableEnded && !res.finished )
                                {
                                    abortOnDisconnect();
                                }
                            });
                        }
                    }
                }

                return lazyAbortController.signal;
            };

            if( req.socket?.remoteAddress )
            {
                ( fetchReq as any ).remoteAddress = req.socket.remoteAddress;
            }

            if( req.socket && typeof req.socket.getPeerCertificate === 'function' ) 
            {
                attachClientCert( fetchReq, req.socket.getPeerCertificate(), req.socket.authorized );
            }

            let response: Response;

            try
            {
                response = await handler( fetchReq );
            }
            catch
            {
                if( !res.headersSent && !res.destroyed )
                {
                    res.statusCode = 500;
                    res.end( 'Internal Server Error' );
                }

                return;
            }
            res.statusCode = response.status;
            let hasSetCookie = false;

            response.headers.forEach(( value, key ) =>
            {
                if( key === 'set-cookie' || ( key.length === 10 && key.toLowerCase() === 'set-cookie' ))
                {
                    hasSetCookie = true;
                }
                else
                {
                    res.setHeader( key, value );
                }
            });

            if( hasSetCookie && typeof response.headers.getSetCookie === 'function' )
            {
                const setCookies = response.headers.getSetCookie();

                if( setCookies.length > 0 )
                {
                    res.setHeader( 'set-cookie', setCookies );
                }
            }

            if( hasDirectResponseBody( response ) && !response.bodyUsed )
            {
                const direct = getDirectResponseBody( response ) ?? null;

                if( direct === null || direct === '' || method === 'HEAD' )
                {
                    res.end();
                }
                else
                {
                    res.end( direct );
                }

                return;
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
                    if( socket && typeof socket.on === 'function' )
                    {
                        socket.on( 'error', () =>
                        {
                            try
                            {
                                socket.destroy();
                            }
                            catch
                            {
                                // ignore socket destroy error
                            }
                        });
                    }

                    if( req.method && req.method !== 'GET' )
                    {
                        endUpgradeSocket( socket, 'HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n' );

                        return;
                    }

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

                    const peerSocket = req.socket || socket;

                    if( peerSocket?.remoteAddress )
                    {
                        ( fetchReq as any ).remoteAddress = peerSocket.remoteAddress;
                    }

                    if( peerSocket && typeof peerSocket.getPeerCertificate === 'function' )
                    {
                        attachClientCert( fetchReq, peerSocket.getPeerCertificate(), peerSocket.authorized );
                    }

                    try
                    {
                        const response = await handler( fetchReq );

                        if( !( fetchReq as any ).__wsUpgraded && !socket.destroyed )
                        {
                            const bodyText = await response.text();
                            endUpgradeSocket( socket, formatUpgradeRejection( response, bodyText ));
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

        if( request.method && request.method !== 'GET' )
        {
            return new Response( 'WebSocket upgrade requires GET', { status : 400 });
        }

        const wsVersion = request.headers.get( 'sec-websocket-version' );

        if( wsVersion !== null && !wsVersion.split( ',' ).some( v => v.trim() === '13' ))
        {
            return new Response( 'Unsupported Sec-WebSocket-Version', {
                status  : 426,
                headers : { 'Sec-WebSocket-Version' : '13' }
            });
        }

        const wsKey = request.headers.get( 'sec-websocket-key' );

        if( !wsKey ) 
        {
            return new Response( 'Missing sec-websocket-key', { status : 400 });
        }

        if( !isValidWsHandshakeKey( wsKey ))
        {
            return new Response( 'Invalid sec-websocket-key', { status : 400 });
        }

        const cleanWsKey = wsKey.trim();
        const magicString = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
        const acceptKey = crypto
            .createHash( 'sha1' )
            .update( cleanWsKey + magicString )
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
        this.wsConnections.add( connection );
        connection.on( 'close', () =>
        {
            this.wsConnections.delete( connection );
        });
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
        for( const ws of [ ...this.wsConnections ])
        {
            ws.close( 1001, 'Going Away' );
        }
        this.wsConnections.clear();

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
    private bufferedMessages   : any[] = [];
    private setupComplete      = false;
    private closed             = false;

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

        const emit = ( event: string, ...args: any[]) => 
        {
            if( event === 'message' && !this.setupComplete && this.emitter.listenerCount( 'message' ) === 0 )
            {
                if( this.bufferedMessages.length < MAX_BUFFERED_WS_MESSAGES )
                {
                    this.bufferedMessages.push( args[0]);
                }

                return;
            }

            this.emitter.emit( event, ...args );
        };

        this.socket.on( 'data', ( data: Buffer ) => 
        {
            this.rx_buffer.append( data );
            WebsocketFrame.read( this.rx_buffer, emit, { maxPayload : this.wsOptions?.maxPayload }, this.frameState );
        });

        const onSocketClose = () => this.finalizeClose( 1006, '', false );
        this.socket.on( 'end', onSocketClose );
        this.socket.on( 'close', onSocketClose );
        this.socket.on( 'error', ( err: any ) => 
        {
            if( this.emitter.listenerCount( 'error' ) > 0 )
            {
                this.emitter.emit( 'error', err );
            }
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

        if( head && head.length > 0 ) 
        {
            this.rx_buffer.append( head );
            WebsocketFrame.read( this.rx_buffer, emit, { maxPayload : this.wsOptions?.maxPayload }, this.frameState );
        }

        this.heartbeat.start();
    }

    public flushBufferedMessages(): void
    {
        this.setupComplete = true;

        if( this.closed || this.bufferedMessages.length === 0 )
        {
            this.bufferedMessages = [];

            return;
        }

        const pending = this.bufferedMessages.splice( 0 );

        if( this.emitter.listenerCount( 'message' ) === 0 )
        {
            return;
        }

        for( const msg of pending )
        {
            if( this.closed ){ break }

            this.emitter.emit( 'message', msg );
        }
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
        this.bufferedMessages = [];
        this.heartbeat.stop();

        const safeReason = reason ? truncateWsReason( reason ) : '';

        if( sendCloseFrame && !this.socket.destroyed && this.socket.writable !== false )
        {
            let payload = code !== undefined ? Buffer.allocUnsafe( 2 ) : EMPTY_BUFFER;

            if( code !== undefined ) 
            {
                payload.writeUInt16BE( code, 0 );

                if( safeReason ) 
                {
                    payload = Buffer.concat([payload, Buffer.from( safeReason, 'utf8' )]);
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

        this.emitter.emit( 'close', code ?? 1000, safeReason );
    }

    close( code?: number, reason?: string ) 
    {
        this.finalizeClose( code, reason, true );
    }

    on( event: string, cb: Function ) 
    {
        this.emitter.on( event, cb as any );

        if( event === 'message' && this.bufferedMessages.length > 0 && !this.setupComplete )
        {
            queueMicrotask(() => this.flushBufferedMessages());
        }
    }

    off( event: string, cb: Function ) 
    {
        this.emitter.off( event, cb as any );
    }
}
