import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WsHeartbeat } from '../src/adapters/ws-heartbeat.js';
import { upgradeQuery } from '../src/adapters/ws-upgrade.js';

function createTransport( ping: () => boolean | void = () => {})
{
    const closes: Array<[number, string]> = [];

    return {
        closes,
        ping,
        close : ( code: number, reason: string ) => { closes.push([ code, reason ]) }
    };
}

describe( 'WsHeartbeat', () =>
{
    beforeEach(() => { vi.useFakeTimers() });
    afterEach(() => { vi.useRealTimers() });

    describe( 'start', () =>
    {
        it( 'should not ping when pingInterval is unset', () =>
        {
            // Arrange
            const ping = vi.fn();
            const heartbeat = new WsHeartbeat( createTransport( ping ));

            // Act
            heartbeat.start();
            vi.advanceTimersByTime( 10_000 );

            // Assert
            expect( ping ).not.toHaveBeenCalled();
        });

        it( 'should ping on every interval while the peer answers', () =>
        {
            // Arrange
            const ping = vi.fn();
            const heartbeat = new WsHeartbeat( createTransport( ping ), { pingInterval : 100 });

            // Act
            heartbeat.start();

            for( let i = 0; i < 3; i++ )
            {
                vi.advanceTimersByTime( 100 );
                heartbeat.pong();
            }

            // Assert
            expect( ping ).toHaveBeenCalledTimes( 3 );
            heartbeat.stop();
        });

        it( 'should be idempotent so a second start does not double the interval', () =>
        {
            // Arrange
            const ping = vi.fn();
            const heartbeat = new WsHeartbeat( createTransport( ping ), { pingInterval : 100 });

            // Act
            heartbeat.start();
            heartbeat.start();
            vi.advanceTimersByTime( 100 );

            // Assert
            expect( ping ).toHaveBeenCalledTimes( 1 );
            heartbeat.stop();
        });
    });

    describe( 'liveness', () =>
    {
        it( 'should close with 1002 when the previous ping went unanswered and no pingTimeout is set', () =>
        {
            // Arrange
            const transport = createTransport();
            const heartbeat = new WsHeartbeat( transport, { pingInterval : 100 });

            // Act
            heartbeat.start();
            vi.advanceTimersByTime( 200 );

            // Assert
            expect( transport.closes ).toEqual([[ 1002, 'Ping Timeout' ]]);
        });

        it( 'should stay open while pongs keep arriving', () =>
        {
            // Arrange
            const transport = createTransport();
            const heartbeat = new WsHeartbeat( transport, { pingInterval : 100 });

            // Act
            heartbeat.start();

            for( let i = 0; i < 5; i++ )
            {
                vi.advanceTimersByTime( 100 );
                heartbeat.pong();
            }

            // Assert
            expect( transport.closes ).toEqual([]);
            heartbeat.stop();
        });

        it( 'should close after pingTimeout elapses without a pong', () =>
        {
            // Arrange
            const transport = createTransport();
            const heartbeat = new WsHeartbeat( transport, { pingInterval : 100, pingTimeout : 50 });

            // Act
            heartbeat.start();
            vi.advanceTimersByTime( 100 );

            // Assert — still open until the answer window closes
            expect( transport.closes ).toEqual([]);
            vi.advanceTimersByTime( 50 );
            expect( transport.closes ).toEqual([[ 1002, 'Ping Timeout' ]]);
        });

        it( 'should cancel the pingTimeout when a pong arrives in time', () =>
        {
            // Arrange
            const transport = createTransport();
            const heartbeat = new WsHeartbeat( transport, { pingInterval : 100, pingTimeout : 50 });

            // Act
            heartbeat.start();
            vi.advanceTimersByTime( 100 );
            heartbeat.pong();
            vi.advanceTimersByTime( 50 );

            // Assert
            expect( transport.closes ).toEqual([]);
            heartbeat.stop();
        });

        it( 'should treat a transport that cannot ping as always alive', () =>
        {
            // Arrange
            const transport = createTransport(() => false );
            const heartbeat = new WsHeartbeat( transport, { pingInterval : 100 });

            // Act
            heartbeat.start();
            vi.advanceTimersByTime( 500 );

            // Assert
            expect( transport.closes ).toEqual([]);
            heartbeat.stop();
        });

        it( 'should close with 1002 when ping throws', () =>
        {
            // Arrange
            const transport = createTransport(() => { throw new Error( 'socket gone' ) });
            const heartbeat = new WsHeartbeat( transport, { pingInterval : 100 });

            // Act
            heartbeat.start();
            vi.advanceTimersByTime( 100 );

            // Assert
            expect( transport.closes ).toEqual([[ 1002, 'Ping failed' ]]);
        });
    });

    describe( 'stop', () =>
    {
        it( 'should clear both timers so nothing fires afterwards', () =>
        {
            // Arrange
            const ping = vi.fn();
            const transport = createTransport( ping );
            const heartbeat = new WsHeartbeat( transport, { pingInterval : 100, pingTimeout : 50 });

            // Act
            heartbeat.start();
            vi.advanceTimersByTime( 100 );
            heartbeat.stop();
            vi.advanceTimersByTime( 1000 );

            // Assert
            expect( ping ).toHaveBeenCalledTimes( 1 );
            expect( transport.closes ).toEqual([]);
        });
    });
});

describe( 'upgradeQuery', () =>
{
    it( 'should flatten the search params of an upgrade request', () =>
    {
        // Arrange
        const request = new Request( 'http://localhost/ws?room=lobby&user=ada' );

        // Act
        const query = upgradeQuery( request );

        // Assert
        expect( query ).toEqual({ room : 'lobby', user : 'ada' });
    });

    it( 'should return an empty object when there is no query string', () =>
    {
        // Arrange
        const request = new Request( 'http://localhost/ws' );

        // Act
        const query = upgradeQuery( request );

        // Assert
        expect( query ).toEqual({});
    });

    it( 'should keep the last value of a repeated key', () =>
    {
        // Arrange
        const request = new Request( 'http://localhost/ws?tag=a&tag=b' );

        // Act
        const query = upgradeQuery( request );

        // Assert
        expect( query ).toEqual({ tag : 'b' });
    });
});
