import { describe, it, expect, vi, afterEach } from 'vitest';
import crypto from 'node:crypto';
import net from 'node:net';
import { NodeAdapter } from '../adapters/node-adapter.js';
import { ApplicationRegistry, runWithRegistry } from '../core/registry.js';
import { RequestProcessor } from '../core/request-processor.js';
import { SimpleMultibuffer, WebsocketFrame } from '../helpers/ws-frame.js';

const { mockCreateSecureContext, mockHttpsCreateServer } = vi.hoisted(() =>
    ({
        mockCreateSecureContext : vi.fn(() => ({ mock : true })),
        mockHttpsCreateServer   : vi.fn()
    }));

vi.mock( 'node:tls', async( importOriginal ) =>
{
    const actual = await importOriginal<typeof import( 'node:tls' )>();

    return {
        ...actual,
        createSecureContext : ( ...args : any[]) => mockCreateSecureContext( ...args )
    };
});

vi.mock( 'https', async( importOriginal ) =>
{
    const actual = await importOriginal<typeof import( 'https' )>();

    return {
        ...actual,
        createServer : ( ...args : any[]) => mockHttpsCreateServer( ...args )
    };
});

const isNodeRuntime =
    typeof ( globalThis as { Bun? : unknown }).Bun === 'undefined'
    && typeof ( globalThis as { Deno? : unknown }).Deno === 'undefined';

function createMockSocket()
{
    const listeners = new Map<string, ( ...args : any[]) => void>();

    return {
        write              : vi.fn(),
        setTimeout         : vi.fn(),
        setNoDelay         : vi.fn(),
        end                : vi.fn(),
        destroy            : vi.fn(),
        removeAllListeners : vi.fn(),
        on                 : vi.fn(( event : string, cb : ( ...args : any[]) => void ) =>
        {
            listeners.set( event, cb );
        }),
        emit( event : string, ...args : any[])
        {
            listeners.get( event )?.( ...args );
        }
    };
}

/** Client-to-server frames must be masked, so simulated client traffic sets the mask bit. */
function wsFrame( opcode : number, payload : Buffer | string = Buffer.alloc( 0 ))
{
    const buf = new SimpleMultibuffer();
    WebsocketFrame.write( buf, payload, { opcode, mask : true });

    return buf.spliceConcat( 0, buf.length );
}

describe( 'NodeAdapter', () =>
{
    afterEach( async () =>
    {
        vi.useRealTimers();
        vi.restoreAllMocks();
        mockCreateSecureContext.mockClear();
        mockHttpsCreateServer.mockReset();
    });

    describe( 'upgrade', () =>
    {
        it( 'should return 400 when nodeSocket is missing', async () =>
        {
            // Arrange
            const adapter = new NodeAdapter();
            const req = new Request( 'http://localhost/ws', {
                headers : { 'sec-websocket-key' : 'dGhlIHNhbXBsZSBub25jZQ==' }
            });

            // Act
            const res = await adapter.upgrade( req, { meta : {} }, {});

            // Assert
            expect( res.status ).toBe( 400 );
            expect( await res.text()).toBe( 'No Node socket available' );
        });

        it( 'should return 400 when sec-websocket-key is missing', async () =>
        {
            // Arrange
            const adapter = new NodeAdapter();
            const req = new Request( 'http://localhost/ws' ) as any;
            req.nodeSocket = createMockSocket();

            // Act
            const res = await adapter.upgrade( req, { meta : {} }, {});

            // Assert
            expect( res.status ).toBe( 400 );
            expect( await res.text()).toBe( 'Missing sec-websocket-key' );
        });

        it( 'should handshake, run the WS processor, and support off()', async () =>
        {
            // Arrange
            const written : string[] = [];
            const socket = createMockSocket();
            socket.write.mockImplementation(( chunk : string | Buffer ) => { written.push( String( chunk )) });
            let captured : any;
            const spy = vi.spyOn( RequestProcessor, 'runWs' ).mockImplementation(( _m, conn ) =>
            {
                captured = conn;
            });

            const key = 'dGhlIHNhbXBsZSBub25jZQ==';
            const req = new Request( 'http://localhost/ws?x=1', {
                headers : { 'sec-websocket-key' : key }
            }) as any;
            req.nodeSocket = socket;
            req.nodeHead = Buffer.from([ 0x01 ]);

            const adapter = new NodeAdapter();

            // Act
            const res = await adapter.upgrade(
                req,
                { meta : { wsOptions : {} }, controller : 'C', methodName : 'ws', params : [] },
                { id : '1' }
            );

            // Assert
            const accept = crypto
                .createHash( 'sha1' )
                .update( key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11' )
                .digest( 'base64' );
            expect( res.status ).toBe( 200 );
            expect( written[0]).toContain( '101 Switching Protocols' );
            expect( written[0]).toContain( `Sec-WebSocket-Accept: ${accept}` );
            expect( spy ).toHaveBeenCalledOnce();

            const cb = () => {};
            captured.on( 'close', cb );
            expect(() => captured.off( 'close', cb )).not.toThrow();
            captured.close( 1000 );
        });

        it( 'should write ping frames on pingInterval', async () =>
        {
            // Arrange
            vi.useFakeTimers();
            const socket = createMockSocket();
            const written : Buffer[] = [];
            socket.write.mockImplementation(( chunk : string | Buffer ) =>
            {
                if( typeof chunk === 'string' ){ return true }
                written.push( Buffer.from( chunk ));

                return true;
            });
            vi.spyOn( RequestProcessor, 'runWs' ).mockImplementation(() => {});

            const req = new Request( 'http://localhost/ws', {
                headers : { 'sec-websocket-key' : 'dGhlIHNhbXBsZSBub25jZQ==' }
            }) as any;
            req.nodeSocket = socket;
            req.nodeHead = Buffer.alloc( 0 );

            const adapter = new NodeAdapter();
            await adapter.upgrade(
                req,
                { meta : { wsOptions : { pingInterval : 100, pingTimeout : 50 } }, controller : 'C', methodName : 'ws', params : [] },
                {}
            );

            // Act
            await vi.advanceTimersByTimeAsync( 100 );

            // Assert
            expect( written.some( b => ( b[0] & 0x0f ) === 0x09 )).toBe( true );
            expect( socket.end ).not.toHaveBeenCalled();
        });

        it( 'should clear ping timeout when a pong is received', async () =>
        {
            // Arrange
            vi.useFakeTimers();
            const socket = createMockSocket();
            socket.write.mockImplementation(() => true );
            let conn : any;
            vi.spyOn( RequestProcessor, 'runWs' ).mockImplementation(( _m, c ) => { conn = c });

            const req = new Request( 'http://localhost/ws', {
                headers : { 'sec-websocket-key' : 'dGhlIHNhbXBsZSBub25jZQ==' }
            }) as any;
            req.nodeSocket = socket;
            req.nodeHead = Buffer.alloc( 0 );

            const adapter = new NodeAdapter();
            await adapter.upgrade(
                req,
                { meta : { wsOptions : { pingInterval : 100, pingTimeout : 50 } }, controller : 'C', methodName : 'ws', params : [] },
                {}
            );

            // Act — fire ping, then pong before pingTimeout elapses
            vi.advanceTimersByTime( 100 );
            expect( socket.end ).not.toHaveBeenCalled();
            expect( conn.heartbeat.timeoutTimer ).toBeDefined();
            conn.emitter.emit( 'pong', Buffer.alloc( 0 ));
            expect( conn.heartbeat.timeoutTimer ).toBeUndefined();
            vi.advanceTimersByTime( 50 );

            // Assert — timeout was cleared; connection stays open
            expect( socket.end ).not.toHaveBeenCalled();
        });

        it( 'should auto-pong when a ping frame arrives', async () =>
        {
            // Arrange
            const socket = createMockSocket();
            const written : Buffer[] = [];
            socket.write.mockImplementation(( chunk : string | Buffer ) =>
            {
                if( typeof chunk === 'string' ){ return true }
                written.push( Buffer.from( chunk ));

                return true;
            });
            vi.spyOn( RequestProcessor, 'runWs' ).mockImplementation(() => {});

            const req = new Request( 'http://localhost/ws', {
                headers : { 'sec-websocket-key' : 'dGhlIHNhbXBsZSBub25jZQ==' }
            }) as any;
            req.nodeSocket = socket;
            req.nodeHead = Buffer.alloc( 0 );

            const adapter = new NodeAdapter();
            await adapter.upgrade(
                req,
                { meta : { wsOptions : {} }, controller : 'C', methodName : 'ws', params : [] },
                {}
            );

            // Act
            socket.emit( 'data', wsFrame( 0x09, Buffer.from( 'hi' )));

            // Assert
            expect( written.some( b => ( b[0] & 0x0f ) === 0x0a )).toBe( true );
        });

        it( 'should close on ping timeout when pong is missing', async () =>
        {
            // Arrange
            vi.useFakeTimers();
            const socket = createMockSocket();
            socket.write.mockImplementation(() => true );
            vi.spyOn( RequestProcessor, 'runWs' ).mockImplementation(() => {});

            const req = new Request( 'http://localhost/ws', {
                headers : { 'sec-websocket-key' : 'dGhlIHNhbXBsZSBub25jZQ==' }
            }) as any;
            req.nodeSocket = socket;
            req.nodeHead = Buffer.alloc( 0 );

            const adapter = new NodeAdapter();
            await adapter.upgrade(
                req,
                { meta : { wsOptions : { pingInterval : 100, pingTimeout : 50 } }, controller : 'C', methodName : 'ws', params : [] },
                {}
            );

            // Act
            await vi.advanceTimersByTimeAsync( 100 );
            await vi.advanceTimersByTimeAsync( 50 );

            // Assert
            expect( socket.end ).toHaveBeenCalled();
            expect( socket.destroy ).toHaveBeenCalled();
        });

        it( 'should close when ping send fails', async () =>
        {
            // Arrange
            vi.useFakeTimers();
            const socket = createMockSocket();
            socket.write.mockImplementation(( chunk : string | Buffer ) =>
            {
                if( typeof chunk === 'string' && String( chunk ).includes( 'Switching Protocols' ))
                {
                    return true;
                }

                throw new Error( 'write failed' );
            });
            vi.spyOn( RequestProcessor, 'runWs' ).mockImplementation(() => {});

            const req = new Request( 'http://localhost/ws', {
                headers : { 'sec-websocket-key' : 'dGhlIHNhbXBsZSBub25jZQ==' }
            }) as any;
            req.nodeSocket = socket;
            req.nodeHead = Buffer.alloc( 0 );

            const adapter = new NodeAdapter();
            await adapter.upgrade(
                req,
                { meta : { wsOptions : { pingInterval : 100, pingTimeout : 50 } }, controller : 'C', methodName : 'ws', params : [] },
                {}
            );

            // Act
            await vi.advanceTimersByTimeAsync( 100 );

            // Assert
            expect( socket.end ).toHaveBeenCalled();
            expect( socket.destroy ).toHaveBeenCalled();
        });

        it( 'should close on second interval when pingTimeout is omitted', async () =>
        {
            // Arrange
            vi.useFakeTimers();
            const socket = createMockSocket();
            socket.write.mockImplementation(() => true );
            vi.spyOn( RequestProcessor, 'runWs' ).mockImplementation(() => {});

            const req = new Request( 'http://localhost/ws', {
                headers : { 'sec-websocket-key' : 'dGhlIHNhbXBsZSBub25jZQ==' }
            }) as any;
            req.nodeSocket = socket;
            req.nodeHead = Buffer.alloc( 0 );

            const adapter = new NodeAdapter();
            await adapter.upgrade(
                req,
                { meta : { wsOptions : { pingInterval : 100 } }, controller : 'C', methodName : 'ws', params : [] },
                {}
            );

            // Act — first tick sends ping; second tick sees missing pong and closes
            vi.advanceTimersByTime( 100 );
            expect( socket.end ).not.toHaveBeenCalled();
            vi.advanceTimersByTime( 100 );

            // Assert
            expect( socket.end ).toHaveBeenCalled();
        });

        it( 'should emit error, close on limit_exceeded, and honor closing frames', async () =>
        {
            // Arrange
            const socket = createMockSocket();
            socket.write.mockImplementation(() => true );
            let conn : any;
            vi.spyOn( RequestProcessor, 'runWs' ).mockImplementation(( _m, c ) => { conn = c });

            const req = new Request( 'http://localhost/ws', {
                headers : { 'sec-websocket-key' : 'dGhlIHNhbXBsZSBub25jZQ==' }
            }) as any;
            req.nodeSocket = socket;
            req.nodeHead = Buffer.alloc( 0 );

            const adapter = new NodeAdapter();
            await adapter.upgrade(
                req,
                { meta : { wsOptions : { maxPayload : 1 } }, controller : 'C', methodName : 'ws', params : [] },
                {}
            );

            const onError = vi.fn();
            conn.on( 'error', onError );

            // Act / Assert — socket error is forwarded
            socket.emit( 'error', new Error( 'boom' ));
            expect( onError ).toHaveBeenCalledWith( expect.objectContaining({ message : 'boom' }));

            // Act / Assert — oversized frame → limit_exceeded → close 1009
            socket.end.mockClear();
            socket.emit( 'data', wsFrame( 0x01, Buffer.from( 'ab' )));
            expect( socket.end ).toHaveBeenCalled();

            // Fresh connection for closing opcode
            const socket2 = createMockSocket();
            socket2.write.mockImplementation(() => true );
            let conn2 : any;
            vi.spyOn( RequestProcessor, 'runWs' ).mockImplementation(( _m, c ) => { conn2 = c });
            const req2 = new Request( 'http://localhost/ws', {
                headers : { 'sec-websocket-key' : 'dGhlIHNhbXBsZSBub25jZQ==' }
            }) as any;
            req2.nodeSocket = socket2;
            req2.nodeHead = Buffer.alloc( 0 );
            await adapter.upgrade(
                req2,
                { meta : { wsOptions : {} }, controller : 'C', methodName : 'ws', params : [] },
                {}
            );

            // Act — closing frame
            const closePayload = Buffer.alloc( 2 );
            closePayload.writeUInt16BE( 1000, 0 );
            socket2.emit( 'data', wsFrame( 0x08, closePayload ));

            // Assert
            expect( socket2.end ).toHaveBeenCalled();
            expect( conn2 ).toBeDefined();
        });
    });

    describe( 'TLS SNI', () =>
    {
        it( 'should invoke SNICallback for success, null credentials, and throw', async () =>
        {
            // Arrange
            const mockCtx = { mock : true };
            mockCreateSecureContext.mockReturnValue( mockCtx );
            const mockServer =
            {
                listen : vi.fn(( _port : number, cb : () => void ) => cb()),
                on     : vi.fn(),
                close  : vi.fn(( cb ?: () => void ) => cb?.())
            };
            mockHttpsCreateServer.mockReturnValue( mockServer );

            const sniCallback = vi.fn()
                .mockResolvedValueOnce({ key : 'k', cert : 'c', ca : 'ca' })
                .mockResolvedValueOnce( null )
                .mockRejectedValueOnce( new Error( 'sni boom' ));

            const adapter = new NodeAdapter();
            const registry = new ApplicationRegistry();

            // Act
            await runWithRegistry( registry, async () =>
            {
                await adapter.listen( 8443, async () => new Response( 'ok' ), {
                    key        : 'server-key',
                    cert       : 'server-cert',
                    sniCallback,
                    ciphers    : 'ECDHE',
                    minVersion : 'TLSv1.2',
                    maxVersion : 'TLSv1.3'
                });
            });

            const options = mockHttpsCreateServer.mock.calls[0][0] as any;
            expect( typeof options.SNICallback ).toBe( 'function' );

            const okCb = vi.fn();
            await options.SNICallback( 'ok.example', okCb );
            expect( mockCreateSecureContext ).toHaveBeenCalledWith( expect.objectContaining({
                key        : 'k',
                cert       : 'c',
                ca         : 'ca',
                ciphers    : 'ECDHE',
                minVersion : 'TLSv1.2',
                maxVersion : 'TLSv1.3'
            }));
            expect( okCb ).toHaveBeenCalledWith( null, mockCtx );

            const nullCb = vi.fn();
            await options.SNICallback( 'missing.example', nullCb );
            expect( nullCb.mock.calls[0][0]).toBeInstanceOf( Error );
            expect( nullCb.mock.calls[0][0].message ).toContain( 'No secure context' );

            const errCb = vi.fn();
            await options.SNICallback( 'boom.example', errCb );
            expect( errCb ).toHaveBeenCalledWith( expect.objectContaining({ message : 'sni boom' }));

            // Assert
            expect( sniCallback ).toHaveBeenCalledTimes( 3 );
            await adapter.close();
        });
    });

    it( 'should attach remoteAddress on HTTP requests', async () =>
    {
        // Arrange
        const adapter = new NodeAdapter();
        const registry = new ApplicationRegistry();
        let seen : string | undefined;

        // Act
        await runWithRegistry( registry, async () =>
        {
            await adapter.listen( 0, async ( req ) =>
            {
                seen = ( req as any ).remoteAddress;

                return new Response( 'ok' );
            });
        });

        const port = ( adapter as any ).nodeServer.address().port;
        const res = await fetch( `http://127.0.0.1:${port}/` );

        // Assert
        expect( res.status ).toBe( 200 );
        expect( seen ).toMatch( /127\.0\.0\.1|::1|::ffff:127\.0\.0\.1/ );

        await adapter.close();
    });

    // Bun's node:http shim does not surface an asterisk-form request target as `req.url`.
    it.skipIf( !isNodeRuntime )( 'should answer asterisk-form OPTIONS * with Allow and without routing', async () =>
    {
        // Arrange
        const adapter = new NodeAdapter();
        const registry = new ApplicationRegistry();
        let routed = 0;

        registry.registerEndpoint({
            controller   : 'C',
            methodName   : 'get',
            httpMethod   : 'GET',
            path         : '/x',
            params       : [],
            guards       : [],
            interceptors : [],
            meta         : {}
        } as any );

        await runWithRegistry( registry, async () =>
        {
            await adapter.listen( 0, async () =>
            {
                routed++;

                return new Response( 'ok' );
            });
        });

        const port = ( adapter as any ).nodeServer.address().port;

        // Act
        const raw = await new Promise<string>(( resolve, reject ) =>
        {
            let data = '';
            const socket = net.connect( port, '127.0.0.1', () =>
            {
                socket.write( 'OPTIONS * HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n' );
            });

            socket.setTimeout( 3000, () =>
            {
                socket.destroy();
                reject( new Error( `timed out waiting for a response, got: ${JSON.stringify( data )}` ));
            });
            socket.on( 'data', ( chunk : Buffer ) =>
            {
                data += chunk.toString();

                if( data.includes( '\r\n\r\n' ))
                {
                    socket.destroy();
                    resolve( data );
                }
            });
            socket.on( 'error', reject );
        });

        // Assert
        expect( raw ).toContain( '204' );
        expect( raw ).toMatch( /Allow: [^\r\n]*GET/ );
        expect( raw ).toMatch( /Allow: [^\r\n]*OPTIONS/ );
        expect( routed ).toBe( 0 );

        await adapter.close();
    });

    describe( 'HTTP timeouts', () =>
    {
        it( 'should apply the documented defaults when no timeouts are passed', async () =>
        {
            // Arrange
            const adapter = new NodeAdapter();
            const registry = new ApplicationRegistry();

            // Act
            await runWithRegistry( registry, async () =>
            {
                await adapter.listen( 0, async () => new Response( 'ok' ));
            });

            const server = ( adapter as any ).nodeServer;

            // Assert
            expect( server.headersTimeout ).toBe( 60_000 );
            expect( server.requestTimeout ).toBe( 300_000 );
            expect( server.keepAliveTimeout ).toBe( 5_000 );

            await adapter.close();
        });

        it( 'should honor explicit timeout overrides', async () =>
        {
            // Arrange
            const adapter = new NodeAdapter();
            const registry = new ApplicationRegistry();

            // Act
            await runWithRegistry( registry, async () =>
            {
                await adapter.listen( 0, async () => new Response( 'ok' ), undefined, {
                    headersTimeout   : 12_000,
                    requestTimeout   : 34_000,
                    keepAliveTimeout : 1_500
                });
            });

            const server = ( adapter as any ).nodeServer;

            // Assert
            expect( server.headersTimeout ).toBe( 12_000 );
            expect( server.requestTimeout ).toBe( 34_000 );
            expect( server.keepAliveTimeout ).toBe( 1_500 );

            await adapter.close();
        });
    });

    describe( 'shutdown drain', () =>
    {
        it( 'should close idle keep-alives on close and all sockets on closeAllConnections', async () =>
        {
            // Arrange
            const adapter = new NodeAdapter();
            const registry = new ApplicationRegistry();
            await runWithRegistry( registry, async () =>
            {
                await adapter.listen( 0, async () => new Response( 'ok' ));
            });

            const server = ( adapter as any ).nodeServer;
            const closeIdle = vi.spyOn( server, 'closeIdleConnections' );
            const closeAll = vi.spyOn( server, 'closeAllConnections' );

            // Act
            await adapter.close();
            adapter.closeAllConnections();

            // Assert
            expect( closeIdle ).toHaveBeenCalled();
            expect( closeAll ).toHaveBeenCalledTimes( 1 );
        });
    });
});
