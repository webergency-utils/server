import { describe, it, expect, afterEach } from 'vitest';
import net from 'node:net';
import { TcpMessageAdapter, TCP_MAX_LINE_BYTES } from '../microservice/tcp-adapter.js';
import { MicroserviceNoReply } from '../microservice/adapter.js';

function freePort(): Promise<number>
{
    return new Promise(( resolve, reject ) =>
    {
        const s = net.createServer();
        s.listen( 0, '127.0.0.1', () =>
        {
            const addr = s.address();

            if( !addr || typeof addr === 'string' )
            {
                s.close();
                reject( new Error( 'no port' ));

                return;
            }

            const port = addr.port;
            s.close(() => resolve( port ));
        });
        s.on( 'error', reject );
    });
}

function readLine( socket: net.Socket, timeoutMs = 500 ): Promise<string | null>
{
    return new Promise(( resolve, reject ) =>
    {
        let buffer = '';
        const onData = ( chunk: Buffer ) =>
        {
            buffer += chunk.toString( 'utf8' );
            const idx = buffer.indexOf( '\n' );

            if( idx !== -1 )
            {
                cleanup();
                resolve( buffer.substring( 0, idx ).trim());
            }
        };
        const timer = setTimeout(() =>
        {
            cleanup();
            resolve( null );
        }, timeoutMs );
        const cleanup = () =>
        {
            clearTimeout( timer );
            socket.off( 'data', onData );
        };
        socket.on( 'data', onData );
        socket.on( 'error', ( err ) =>
        {
            cleanup();
            reject( err );
        });
    });
}

describe( 'TcpMessageAdapter', () =>
{
    let adapter: TcpMessageAdapter | undefined;

    afterEach( async () =>
    {
        if( adapter )
        {
            await adapter.close();
            adapter = undefined;
        }
    });

    it( 'should reply Missing pattern when id is present and pattern is absent', async () =>
    {
        // Arrange
        const port = await freePort();
        adapter = new TcpMessageAdapter( port );
        await adapter.listen( async () => 'ok' );

        // Act
        const client = net.connect( port, '127.0.0.1' );
        await new Promise<void>(( resolve, reject ) =>
        {
            client.once( 'connect', () => resolve());
            client.once( 'error', reject );
        });
        const replyP = readLine( client );
        client.write( JSON.stringify({ id : 'm1', payload : {} }) + '\n' );
        const line = await replyP;
        client.end();

        // Assert
        expect( JSON.parse( line! )).toEqual({
            id      : 'm1',
            status  : 'error',
            message : 'Missing pattern'
        });
    });

    it( 'should ignore missing pattern when no correlation id is sent', async () =>
    {
        // Arrange
        const port = await freePort();
        adapter = new TcpMessageAdapter( port );
        await adapter.listen( async () => 'ok' );

        // Act
        const client = net.connect( port, '127.0.0.1' );
        await new Promise<void>(( resolve, reject ) =>
        {
            client.once( 'connect', () => resolve());
            client.once( 'error', reject );
        });
        const replyP = readLine( client, 120 );
        client.write( JSON.stringify({ payload : {} }) + '\n' );
        const line = await replyP;
        client.end();

        // Assert
        expect( line ).toBeNull();
    });

    it( 'should support connection.send and connection.close', async () =>
    {
        // Arrange
        const port = await freePort();
        adapter = new TcpMessageAdapter( port );
        await adapter.listen( async ( _pattern, _payload, connection ) =>
        {
            connection.send({ streamed : true });
            connection.close();

            return MicroserviceNoReply;
        });

        // Act
        const client = net.connect( port, '127.0.0.1' );
        await new Promise<void>(( resolve, reject ) =>
        {
            client.once( 'connect', () => resolve());
            client.once( 'error', reject );
        });
        const replyP = readLine( client );
        const closed = new Promise<void>(( resolve ) => client.once( 'close', () => resolve()));
        client.write( JSON.stringify({ id : 's1', pattern : 'stream', payload : null }) + '\n' );
        const line = await replyP;
        await closed;

        // Assert
        expect( JSON.parse( line! )).toEqual({
            id     : 's1',
            status : 'success',
            data   : { streamed : true }
        });
    });

    it( 'should no-op connection.send when the socket is not writable', async () =>
    {
        // Arrange
        const port = await freePort();
        adapter = new TcpMessageAdapter( port );
        let sendThrew = false;
        await adapter.listen( async ( _pattern, _payload, connection ) =>
        {
            connection.close();
            await new Promise( ( r ) => setTimeout( r, 20 ));

            try
            {
                connection.send({ afterClose : true });
            }
            catch
            {
                sendThrew = true;
            }

            return MicroserviceNoReply;
        });

        // Act
        const client = net.connect( port, '127.0.0.1' );
        await new Promise<void>(( resolve, reject ) =>
        {
            client.once( 'connect', () => resolve());
            client.once( 'error', reject );
        });
        const replyP = readLine( client, 150 );
        client.write( JSON.stringify({ id : 'nw1', pattern : 'nowrite', payload : null }) + '\n' );
        const line = await replyP;
        await new Promise( ( r ) => setTimeout( r, 80 ));
        client.destroy();

        // Assert
        expect( line ).toBeNull();
        expect( sendThrew ).toBe( false );
    });

    it( 'should drop connections on socket error', async () =>
    {
        // Arrange
        const port = await freePort();
        adapter = new TcpMessageAdapter( port );
        let peer: net.Socket | undefined;
        await adapter.listen( async () => 'ok' );

        const client = net.connect( port, '127.0.0.1' );
        await new Promise<void>(( resolve, reject ) =>
        {
            client.once( 'connect', () => resolve());
            client.once( 'error', reject );
        });

        // Wait until adapter tracked the socket
        await new Promise( ( r ) => setTimeout( r, 30 ));
        const connections: Set<net.Socket> = ( adapter as any ).connections;
        expect( connections.size ).toBe( 1 );
        peer = [...connections][0];

        // Act — force an error on the server-side socket
        peer.emit( 'error', new Error( 'boom' ));

        // Assert
        expect( connections.has( peer )).toBe( false );
        client.destroy();
    });

    it( 'should destroy peers that send oversized incomplete lines', async () =>
    {
        // Arrange
        const port = await freePort();
        adapter = new TcpMessageAdapter( port );
        let handled = false;
        await adapter.listen( async () =>
        {
            handled = true;

            return 'ok';
        });

        const client = net.connect( port, '127.0.0.1' );
        await new Promise<void>(( resolve, reject ) =>
        {
            client.once( 'connect', () => resolve());
            client.once( 'error', reject );
        });

        const closed = new Promise<void>(( resolve ) => client.once( 'close', () => resolve()));

        // Act — no newline; grow past the incomplete-line cap
        client.write( 'x'.repeat( TCP_MAX_LINE_BYTES + 1 ));
        await closed;

        // Assert
        expect( handled ).toBe( false );
        expect(( adapter as any ).connections.size ).toBe( 0 );
    });
});
