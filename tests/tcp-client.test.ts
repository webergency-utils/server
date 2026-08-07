import { describe, it, expect, afterEach } from 'vitest';
import net from 'node:net';
import { TcpClient } from '../src/microservice/tcp-client.js';

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

describe( 'TcpClient', () =>
{
    let server: net.Server | undefined;
    let client: TcpClient | undefined;

    afterEach( async () =>
    {
        if( client )
        {
            await client.close();
            client = undefined;
        }

        if( server )
        {
            await new Promise<void>(( resolve ) => server!.close(() => resolve()));
            server = undefined;
        }
    });

    it( 'should reject connect when the peer is unreachable', async () =>
    {
        // Arrange
        const port = await freePort();
        client = new TcpClient({ host : '127.0.0.1', port });

        // Act / Assert
        await expect( client.connect()).rejects.toThrow();
    });

    it( 'should throw when writing while the socket is not writable', async () =>
    {
        // Arrange
        const port = await freePort();
        server = net.createServer(( socket ) =>
        {
            socket.on( 'data', () => {});
        });
        await new Promise<void>(( resolve ) => server!.listen( port, '127.0.0.1', () => resolve()));
        client = new TcpClient({ host : '127.0.0.1', port });
        await client.connect();
        Object.defineProperty(( client as any ).socket, 'writable', { get : () => false });

        // Act / Assert
        await expect( client.send( 'p', {} )).rejects.toThrow( /TcpClient is not connected/ );
    });

    it( 'should ignore non-JSON reply lines and accept a later success', async () =>
    {
        // Arrange
        const port = await freePort();
        server = net.createServer(( socket ) =>
        {
            socket.on( 'data', ( chunk ) =>
            {
                const line = chunk.toString( 'utf8' ).trim();
                const env = JSON.parse( line );
                socket.write( 'not-json\n' );
                socket.write( JSON.stringify({ id : env.id, status : 'success', data : 42 }) + '\n' );
            });
        });
        await new Promise<void>(( resolve ) => server!.listen( port, '127.0.0.1', () => resolve()));
        client = new TcpClient({ host : '127.0.0.1', port });
        await client.connect();

        // Act
        const result = await client.send( 'math', { a : 1 });

        // Assert
        expect( result ).toBe( 42 );
    });

    it( 'should reject when the peer replies with error status', async () =>
    {
        // Arrange
        const port = await freePort();
        server = net.createServer(( socket ) =>
        {
            socket.on( 'data', ( chunk ) =>
            {
                const env = JSON.parse( chunk.toString( 'utf8' ).trim());
                socket.write( JSON.stringify({
                    id      : env.id,
                    status  : 'error',
                    message : 'RPC failed'
                }) + '\n' );
            });
        });
        await new Promise<void>(( resolve ) => server!.listen( port, '127.0.0.1', () => resolve()));
        client = new TcpClient({ host : '127.0.0.1', port });
        await client.connect();

        // Act / Assert
        await expect( client.send( 'math', {} )).rejects.toThrow( /RPC failed/ );
    });

    it( 'should fail pending sends when closed mid-flight', async () =>
    {
        // Arrange
        const port = await freePort();
        server = net.createServer(( socket ) =>
        {
            // never reply
            socket.on( 'data', () => {});
        });
        await new Promise<void>(( resolve ) => server!.listen( port, '127.0.0.1', () => resolve()));
        client = new TcpClient({ host : '127.0.0.1', port });
        await client.connect();

        // Act
        const pending = client.send( 'slow', {} );
        await new Promise( ( r ) => setTimeout( r, 20 ));
        await client.close();
        client = undefined;

        // Assert
        await expect( pending ).rejects.toThrow( /Client closed|Connection closed/ );
    });

    it( 'should reject pending sends when the peer streams an oversized incomplete line', async () =>
    {
        // Arrange
        const port = await freePort();
        server = net.createServer(( socket ) =>
        {
            socket.on( 'data', () =>
            {
                // No newline — force the client receive buffer past its cap
                socket.write( 'y'.repeat( 1024 * 1024 + 1 ));
            });
        });
        await new Promise<void>(( resolve ) => server!.listen( port, '127.0.0.1', () => resolve()));
        client = new TcpClient({ host : '127.0.0.1', port });
        await client.connect();

        // Act / Assert
        await expect( client.send( 'p', {} )).rejects.toThrow( /exceeds/ );
        client = undefined;
    });
});
