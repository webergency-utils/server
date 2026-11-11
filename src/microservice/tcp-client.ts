import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { NdjsonLineFramer, TCP_MAX_LINE_BYTES } from './ndjson-framer.js';

export interface TcpClientOptions
{
    host?      : string
    port       : number
    timeoutMs? : number
}

/**
 * Nest-style TCP microservice client: `send` (request/response) and `emit` (fire-and-forget).
 */
export class TcpClient
{
    private socket?     : net.Socket;
    private connecting? : Promise<void>;
    private closed      = false;
    private readonly pending = new Map<string, {
        resolve : ( v: any ) => void
        reject  : ( e: Error ) => void
        timer?  : ReturnType<typeof setTimeout>
    }>();
    private readonly host      : string;
    private readonly port      : number;
    private readonly timeoutMs : number | undefined;

    constructor( options: TcpClientOptions )
    {
        this.host = options.host ?? '127.0.0.1';
        this.port = options.port;
        this.timeoutMs = options.timeoutMs;
    }

    async connect(): Promise<void>
    {
        this.closed = false;

        if( this.socket ){ return }

        if( this.connecting )
        {
            return this.connecting;
        }

        const p = new Promise<void>(( resolve, reject ) =>
        {
            const framer = new NdjsonLineFramer( TCP_MAX_LINE_BYTES );
            let settled = false;

            const socket = net.connect( this.port, this.host, () =>
            {
                if( this.closed )
                {
                    settled = true;
                    socket.destroy();
                    reject( new Error( 'Client closed' ));

                    return;
                }

                settled = true;
                this.socket = socket;
                resolve();
            });

            socket.on( 'data', ( chunk ) =>
            {
                if( this.socket !== socket ){ return }

                this.onData( framer, Buffer.isBuffer( chunk ) ? chunk : Buffer.from( chunk ));
            });

            socket.on( 'error', ( err ) =>
            {
                if( this.socket === socket )
                {
                    this.failAll( err );
                }

                if( !settled )
                {
                    settled = true;
                    reject( err );
                }
            });

            socket.on( 'close', () =>
            {
                framer.reset();

                if( this.socket === socket )
                {
                    this.socket = undefined;
                    this.failAll( new Error( 'Connection closed' ));
                }
                else if( !settled )
                {
                    settled = true;
                    reject( new Error( 'Connection closed' ));
                }
            });
        });

        this.connecting = p;

        try
        {
            await p;
        }
        finally
        {
            if( this.connecting === p )
            {
                this.connecting = undefined;
            }
        }
    }

    /** Request/response — Nest `ClientProxy.send`. */
    async send<T = any>( pattern: string, payload?: any, timeoutMs?: number ): Promise<T>
    {
        await this.ensureConnected();
        const id = randomUUID();
        const effectiveTimeout = timeoutMs ?? this.timeoutMs;

        return new Promise<T>(( resolve, reject ) =>
        {
            let timer: ReturnType<typeof setTimeout> | undefined;

            if( effectiveTimeout !== undefined && effectiveTimeout > 0 )
            {
                timer = setTimeout(() =>
                {
                    this.pending.delete( id );
                    reject( new Error( `RPC request timed out after ${effectiveTimeout}ms (${pattern})` ));
                }, effectiveTimeout );
            }

            this.pending.set( id, { resolve, reject, timer });

            try
            {
                this.write({ id, pattern, payload });
            }
            catch( err )
            {
                if( timer !== undefined ){ clearTimeout( timer ) }
                this.pending.delete( id );
                reject( err as Error );
            }
        });
    }

    /** Fire-and-forget — Nest `ClientProxy.emit`. No correlation id, no reply expected. */
    async emit( pattern: string, payload?: any ): Promise<void>
    {
        await this.ensureConnected();
        this.write({ pattern, payload });
    }

    async close(): Promise<void>
    {
        this.closed = true;
        const socket = this.socket;
        this.socket = undefined;
        this.failAll( new Error( 'Client closed' ));

        if( !socket ){ return }

        socket.destroy();
    }

    private async ensureConnected(): Promise<void>
    {
        if( !this.socket ){ await this.connect() }
    }

    private write( envelope: Record<string, any> ): void
    {
        if( !this.socket?.writable )
        {
            throw new Error( 'TcpClient is not connected' );
        }

        this.socket.write( JSON.stringify( envelope ) + '\n' );
    }

    private onData( framer: NdjsonLineFramer, chunk: Buffer ): void
    {
        const { lines, oversized } = framer.push( chunk );

        if( oversized )
        {
            this.rejectOversizedLine( framer );

            return;
        }

        for( const line of lines )
        {
            let response: any;

            try
            {
                response = JSON.parse( line );
            }
            catch
            {
                continue;
            }

            if( !response || typeof response !== 'object' )
            {
                continue;
            }

            const hasId = response.id !== undefined && response.id !== null;
            const key = hasId ? String( response.id ) : '';
            const waiter = hasId ? this.pending.get( key ) : undefined;

            if( !waiter ){ continue }

            if( waiter.timer !== undefined ){ clearTimeout( waiter.timer ) }
            this.pending.delete( key );

            if( response.status === 'success' )
            {
                waiter.resolve( response.data );
            }
            else
            {
                const err = new Error( response.message || 'RPC Error' );

                if( response.data !== undefined )
                {
                    Object.assign( err, { data : response.data });
                }

                waiter.reject( err );
            }
        }
    }

    private rejectOversizedLine( framer: NdjsonLineFramer ): void
    {
        framer.reset();
        this.failAll( new Error( `TCP response line exceeds ${TCP_MAX_LINE_BYTES} bytes` ));
        this.socket?.destroy();
    }

    private failAll( err: Error ): void
    {
        for( const waiter of this.pending.values())
        {
            if( waiter.timer !== undefined ){ clearTimeout( waiter.timer ) }
            waiter.reject( err );
        }
        this.pending.clear();
    }
}

