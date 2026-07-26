import net from 'node:net';
import { randomUUID } from 'node:crypto';

/** Max incomplete newline-delimited JSON line held in memory. */
const TCP_MAX_LINE_BYTES = 1024 * 1024;

export type TcpClientOptions =
{
    host? : string
    port  : number
};

/**
 * Nest-style TCP microservice client: `send` (request/response) and `emit` (fire-and-forget).
 */
export class TcpClient
{
    private socket? : net.Socket;
    private buffer = '';
    private readonly pending = new Map<string, { resolve: ( v: any ) => void; reject: ( e: Error ) => void }>();
    private readonly host: string;
    private readonly port: number;

    constructor( options: TcpClientOptions )
    {
        this.host = options.host ?? '127.0.0.1';
        this.port = options.port;
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
                this.failAll( new Error( 'Connection closed' ));
                this.socket = undefined;
            });
        });
    }

    /** Request/response — Nest `ClientProxy.send`. */
    async send<T = any>( pattern: string, payload?: any ): Promise<T>
    {
        await this.ensureConnected();
        const id = randomUUID();

        return new Promise<T>(( resolve, reject ) =>
        {
            this.pending.set( id, { resolve, reject });
            this.write({ id, pattern, payload });
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
        this.buffer += chunk.toString( 'utf8' );
        let index;

        while(( index = this.buffer.indexOf( '\n' )) !== -1 )
        {
            const rawLine = this.buffer.substring( 0, index );

            if( Buffer.byteLength( rawLine, 'utf8' ) > TCP_MAX_LINE_BYTES )
            {
                this.rejectOversizedLine();

                return;
            }

            const line = rawLine.trim();
            this.buffer = this.buffer.substring( index + 1 );

            if( !line ){ continue }

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

        if( Buffer.byteLength( this.buffer, 'utf8' ) > TCP_MAX_LINE_BYTES )
        {
            this.rejectOversizedLine();
        }
    }

    private rejectOversizedLine(): void
    {
        this.buffer = '';
        this.failAll( new Error( `TCP response line exceeds ${TCP_MAX_LINE_BYTES} bytes` ));
        this.socket?.destroy();
    }

    private failAll( err: Error ): void
    {
        for( const waiter of this.pending.values())
        {
            waiter.reject( err );
        }
        this.pending.clear();
    }
}
