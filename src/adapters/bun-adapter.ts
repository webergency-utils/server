import { ServerAdapter, TlsOptions } from './adapter.js';
import { EventEmitter } from 'node:events';

export class BunAdapter implements ServerAdapter 
{
    private server? : any;

    async listen( port: number, handler: ( request: Request ) => Promise<Response>, tls?: TlsOptions ): Promise<void> 
    {
        const { MetadataStore } = await import( '../core/metadata.js' );
        const hasWs = MetadataStore.getEndpoints().some(( ep: any ) => ep.httpMethod === 'WS' );

        const serveOptions: any = {
      port
    };

        if( tls ) 
        {
            serveOptions.tls = {
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
                serveOptions.tls.SNICallback = async ( servername: string, callback: any ) => 
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
        }

        if( hasWs ) 
        {
            const { RequestProcessor } = await import( '../core/request-processor.js' );
            serveOptions.fetch = function ( req: Request, server: any ) 
            {
                ( req as any ).bunServer = server;

                if( server && typeof server.getPeerCertificate === 'function' ) 
                {
                    const rawCert = server.getPeerCertificate( req );

                    if( rawCert && Object.keys( rawCert ).length > 0 ) 
                    {
                        const serial = rawCert.serialNumber || '';
                        ( req as any ).clientCert = {
              subject : rawCert.subject || {},
              issuer  : rawCert.issuer || {},
              valid   : {
                  from : rawCert.valid_from ? new Date( rawCert.valid_from ) : new Date( 0 ),
                  to   : rawCert.valid_to ? new Date( rawCert.valid_to ) : new Date( 0 )
              },
              fingerprint    : rawCert.fingerprint || '',
              fingerprint256 : rawCert.fingerprint256,
              serialNumber   : serial,
              serial         : serial
            };
                    }
                }

                return handler( req );
            };
            serveOptions.websocket = {
        open( ws: any ) 
        {
            const { metadata, params, query, headers, request } = ws.data;
            const connection = new BunServerWebSocket( ws, headers, params, query, metadata.meta?.wsOptions );
            RequestProcessor.executeWs( metadata, connection, request );
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
            serveOptions.fetch = ( req: Request, server: any ) => 
            {
                if( server && typeof server.getPeerCertificate === 'function' ) 
                {
                    const rawCert = server.getPeerCertificate( req );

                    if( rawCert && Object.keys( rawCert ).length > 0 ) 
                    {
                        const serial = rawCert.serialNumber || '';
                        ( req as any ).clientCert = {
              subject : rawCert.subject || {},
              issuer  : rawCert.issuer || {},
              valid   : {
                  from : rawCert.valid_from ? new Date( rawCert.valid_from ) : new Date( 0 ),
                  to   : rawCert.valid_to ? new Date( rawCert.valid_to ) : new Date( 0 )
              },
              fingerprint    : rawCert.fingerprint || '',
              fingerprint256 : rawCert.fingerprint256,
              serialNumber   : serial,
              serial         : serial
            };
                    }
                }

                return handler( req );
            };
        }

        this.server = ( globalThis as any ).Bun.serve( serveOptions );
    }

    upgrade( request: Request, metadata: any, params: any ): Response 
    {
        const bunServer = ( request as any ).bunServer;
        const url = new URL( request.url );
        const query = Object.fromEntries( url.searchParams.entries());
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
        if( this.server && typeof this.server.stop === 'function' ) 
        {
            this.server.stop();
        }
    }
}

class BunServerWebSocket 
{
    private pingIntervalTimer? : any;
    private pingTimeoutTimer?  : any;
    private lastPongReceived = true;

    constructor(
        private ws: any,
        public headers: Headers,
        public params: Record<string, string>,
        public query: Record<string, string>,
        private wsOptions?: { pingInterval? : number, pingTimeout? : number, maxPayload? : number }
    ) 
    {
    // Ping/Pong Heartbeat logic
        if( this.wsOptions?.pingInterval ) 
        {
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
                    this.ws.ping();
                }
                catch ( e ) 
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

        this.ws.data.emitter.on( 'pong', () => 
        {
            this.lastPongReceived = true;

            if( this.pingTimeoutTimer ) 
            {
                clearTimeout( this.pingTimeoutTimer );
                this.pingTimeoutTimer = undefined;
            }
        });

        this.ws.data.emitter.on( 'close', () => 
        {
            this.clearTimers();
        });
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
        this.ws.send( data );
    }

    close( code?: number, reason?: string ) 
    {
        this.clearTimers();
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
