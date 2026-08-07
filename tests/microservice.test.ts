import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, afterEach } from 'vitest';
import { Microservice } from '../src/microservice/microservice.js';
import { TcpMessageAdapter } from '../src/microservice/tcp-adapter.js';
import { TcpClient } from '../src/microservice/tcp-client.js';
import { MicroserviceAdapter, MicroserviceNoReply, MessageConnection } from '../src/microservice/adapter.js';
import { runAot } from './aot/build.js';
import { getControllerMeta, getInjectableMeta } from '../src/core/symbols.js';
import { defineController } from './helpers/testing.js';
import net from 'node:net';

describe( 'Microservice Integration Tests', () =>
{
    let microservice: Microservice;
    const port = 3999;

    beforeAll( async () =>
    {
        const compiled = runAot();
        const mod = await import( `file://${compiled}?t=${Date.now()}` );
        const classes = Object.values( mod ).filter( v => typeof v === 'function' ) as any[];
        const controllers = classes.filter( c => getControllerMeta( c ));
        const guards = classes.filter( c => getInjectableMeta( c )?.kind === 'guard' );
        const interceptors = classes.filter( c => getInjectableMeta( c )?.kind === 'interceptor' );
        const providers = classes.filter( c => getInjectableMeta( c )?.kind === 'provider' );

        const adapter = new TcpMessageAdapter( port );
        microservice = new Microservice( adapter, { controllers, guards, interceptors, providers });
        await microservice.start();
    });

    afterAll( async () =>
    {
        if( microservice )
        {
            await microservice.shutdown();
        }
    });

    beforeEach(() =>
    {
        const ctrl = microservice.registry.getController( 'MathMicroserviceController' );
        ctrl.lastNotify = undefined;
    });

    const sendRpc = ( pattern: string, payload: any ): Promise<any> =>
    {
        return new Promise(( resolve, reject ) =>
        {
            const client = net.connect( port, 'localhost', () =>
            {
                const envelope = {
                    id      : 'test-req-id',
                    pattern,
                    payload
                };
                client.write( JSON.stringify( envelope ) + '\n' );
            });

            let buffer = '';
            client.on( 'data', ( chunk ) =>
            {
                buffer += chunk.toString( 'utf8' );

                if( buffer.includes( '\n' ))
                {
                    const line = buffer.substring( 0, buffer.indexOf( '\n' )).trim();
                    client.end();
                    try
                    {
                        const response = JSON.parse( line );

                        if( response.status === 'success' )
                        {
                            resolve( response.data );
                        }
                        else
                        {
                            reject( new Error( response.message || 'RPC Error' ));
                        }
                    }
                    catch ( e )
                    {
                        reject( e );
                    }
                }
            });

            client.on( 'error', ( err ) => reject( err ));
        });
    };

    it( 'should successfully execute MessagePattern math.sum and return correct payload', async () =>
    {
        const res = await sendRpc( 'math.sum', { a : 10, b : 20 });
        expect( res ).toBe( 30 );
    });

    it( 'should successfully execute MessagePattern math.greet with string payload', async () =>
    {
        const res = await sendRpc( 'math.greet', 'World' );
        expect( res ).toBe( 'Hello, World!' );
    });

    it( 'should automatically reject message with payload validation error', async () =>
    {
        await expect( sendRpc( 'math.sum', { a : 'invalid', b : 20 })).rejects.toThrow();
    });

    it( 'should automatically reject message with missing payload property validation error', async () =>
    {
        await expect( sendRpc( 'math.sum', { b : 20 })).rejects.toThrow();
    });

    it( 'TcpClient.send should round-trip MessagePattern', async () =>
    {
        const client = new TcpClient({ port });
        await client.connect();

        try
        {
            expect( await client.send( 'math.sum', { a : 1, b : 2 })).toBe( 3 );
        }
        finally
        {
            await client.close();
        }
    });

    it( 'TcpClient.emit should fire EventPattern without a reply', async () =>
    {
        const client = new TcpClient({ port });
        await client.connect();

        const replies: string[] = [];
        const socket = ( client as any ).socket as net.Socket;
        const onData = ( chunk: Buffer ) => replies.push( chunk.toString( 'utf8' ));
        socket.on( 'data', onData );

        try
        {
            await client.emit( 'logs.notify', 'hello-event' );
            await new Promise( r => setTimeout( r, 80 ));
            const ctrl = microservice.registry.getController( 'MathMicroserviceController' );
            expect( ctrl.lastNotify ).toBe( 'hello-event' );
            expect( replies.join( '' )).toBe( '' );
        }
        finally
        {
            socket.off( 'data', onData );
            await client.close();
        }
    });

    it( 'EventPattern should not reply even when a correlation id is sent', async () =>
    {
        await new Promise<void>(( resolve, reject ) =>
        {
            const client = net.connect( port, 'localhost', () =>
            {
                client.write( JSON.stringify({
                    id      : 'should-not-get-reply',
                    pattern : 'logs.notify',
                    payload : 'with-id'
                }) + '\n' );
            });

            let gotData = false;
            client.on( 'data', () => { gotData = true });
            client.on( 'error', reject );

            setTimeout(() =>
            {
                client.end();
                try
                {
                    expect( gotData ).toBe( false );
                    const ctrl = microservice.registry.getController( 'MathMicroserviceController' );
                    expect( ctrl.lastNotify ).toBe( 'with-id' );
                    resolve();
                }
                catch ( e )
                {
                    reject( e );
                }
            }, 80 );
        });
    });
});

describe( 'Microservice handler branches', () =>
{
    type Handler = (
        pattern    : string,
        payload    : any,
        connection : MessageConnection
    ) => Promise<any>;

    let handler: Handler | undefined;
    let ms: Microservice | undefined;
    const noopConnection: MessageConnection =
    {
        send  : () => {},
        close : () => {}
    };

    afterEach( async () =>
    {
        vi.restoreAllMocks();

        if( ms )
        {
            await ms.shutdown();
            ms = undefined;
        }
        handler = undefined;
    });

    async function startWith( controllers: any[] )
    {
        const adapter: MicroserviceAdapter =
        {
            listen : async ( h ) => { handler = h },
            close  : async () => {}
        };
        ms = new Microservice( adapter, { controllers });
        await ms.start();
    }

    it( 'should throw when the RPC pattern is not registered', async () =>
    {
        // Arrange
        class Ctrl
        {
            ok(){ return 1 }
        }
        defineController( Ctrl, [{
            methodName   : 'ok',
            httpMethod   : 'RPC',
            path         : 'known.ok',
            params       : [],
            guards       : [],
            interceptors : [],
            meta         : {}
        }]);
        await startWith( [Ctrl] );

        // Act / Assert
        await expect( handler!( 'unknown.pattern', {}, noopConnection ))
            .rejects.toThrow( /Pattern "unknown.pattern" not registered/ );
    });

    it( 'should log EventPattern errors and return MicroserviceNoReply', async () =>
    {
        // Arrange
        class EvCtrl
        {
            boom(){ throw new Error( 'event-boom' ) }
        }
        defineController( EvCtrl, [{
            methodName   : 'boom',
            httpMethod   : 'RPC',
            path         : 'ev.boom',
            params       : [],
            guards       : [],
            interceptors : [],
            meta         : { event : true }
        }]);
        const spy = vi.spyOn( console, 'error' ).mockImplementation( () => {} );
        await startWith( [EvCtrl] );

        // Act
        const result = await handler!( 'ev.boom', {}, noopConnection );

        // Assert
        expect( result ).toBe( MicroserviceNoReply );
        expect( spy ).toHaveBeenCalledWith( '[EventPattern ev.boom]', 'event-boom' );
    });

    it( 'should wrap MessagePattern errors that lack .data', async () =>
    {
        // Arrange
        class MsgCtrl
        {
            boom(){ throw new Error( 'msg-boom' ) }
        }
        defineController( MsgCtrl, [{
            methodName   : 'boom',
            httpMethod   : 'RPC',
            path         : 'msg.boom',
            params       : [],
            guards       : [],
            interceptors : [],
            meta         : {}
        }]);
        await startWith( [MsgCtrl] );

        // Act / Assert
        await expect( handler!( 'msg.boom', {}, noopConnection )).rejects.toMatchObject({
            message : 'msg-boom',
            cause   : expect.objectContaining({ message : 'msg-boom' })
        });
    });
});
