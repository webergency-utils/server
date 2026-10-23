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
    private socket? : net.Socket;
    private readonly framer  = new NdjsonLineFramer( TCP_MAX_LINE_BYTES );
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
        if( this.socket ){ return }

        await new Promise<void>(( resolve, reject ) =>
        {
            const socket = net.connect( this.port, this.host, () =>
            {
                this.socket = socket;
                resolve();
            });

            socket.on( 'data', ( chunk ) => this.onData( Buffer.isBuffer( chunk ) ? chunk : Buffer.from( chunk )));
            socket.on( 'error', ( err ) =>
            {
                this.failAll( err );
                reject( err );
            });
            socket.on( 'close', () =>
            {
                this.framer.reset();
                this.failAll( new Error( 'Connection closed' ));
                this.socket = undefined;
            });
        });
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
        const socket = this.socket;
        this.socket = undefined;
        this.framer.reset();
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

    private onData( chunk: Buffer ): void
    {
        const { lines, oversized } = this.framer.push( chunk );

        if( oversized )
        {
            this.rejectOversizedLine();

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

            const waiter = response.id ? this.pending.get( response.id ) : undefined;

            if( !waiter ){ continue }

            if( waiter.timer !== undefined ){ clearTimeout( waiter.timer ) }
            this.pending.delete( response.id );

            if( response.status === 'success' )
            {
                waiter.resolve( response.data );
            }
            else
            {
                waiter.reject( new Error( response.message || 'RPC Error' ));
            }
        }
    }

    private rejectOversizedLine(): void
    {
        this.framer.reset();
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

