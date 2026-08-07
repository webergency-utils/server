import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RateLimiter } from '../src/helpers/rate-limiter.js';

describe( 'RateLimiter', () => 
{
    let rateLimiter: RateLimiter;

    beforeEach(() => 
    {
        rateLimiter = new RateLimiter();
        vi.useFakeTimers();
        vi.setSystemTime( new Date( '2026-01-01T00:00:00.000Z' ));
    });

    afterEach(() => 
    {
        vi.useRealTimers();
    });

    it( 'should allow requests within limit and block when limit is exceeded', () => 
    {
        // Arrange
        const ip = '127.0.0.1';
        const path = '/api/test';
        const limitConfig = { max : 2, window : '1m' };

        // Act & Assert
        // First request: count 1, allowed
        const allowed1 = rateLimiter.checkLimit( ip, path, limitConfig );
        expect( allowed1 ).toBe( true );

        // Second request: count 2, allowed
        const allowed2 = rateLimiter.checkLimit( ip, path, limitConfig );
        expect( allowed2 ).toBe( true );

        // Third request: count 3, blocked
        const allowed3 = rateLimiter.checkLimit( ip, path, limitConfig );
        expect( allowed3 ).toBe( false );
    });

    it( 'should reset count after window expires', () => 
    {
        // Arrange
        const ip = '127.0.0.1';
        const path = '/api/test';
        const limitConfig = { max : 1, window : '10s' };

        // Act
        const allowed1 = rateLimiter.checkLimit( ip, path, limitConfig );
        const allowed2 = rateLimiter.checkLimit( ip, path, limitConfig ); // Blocked

        // Advance time past the 10s window (10001 ms)
        vi.advanceTimersByTime( 10001 );

        const allowed3 = rateLimiter.checkLimit( ip, path, limitConfig ); // Allowed again

        // Assert
        expect( allowed1 ).toBe( true );
        expect( allowed2 ).toBe( false );
        expect( allowed3 ).toBe( true );
    });

    it( 'should support window option as a number in milliseconds', () => 
    {
        // Arrange
        const ip = '127.0.0.1';
        const path = '/api/test';
        const limitConfig = { max : 1, window : 5000 }; // 5 seconds

        // Act
        const allowed1 = rateLimiter.checkLimit( ip, path, limitConfig );
        const allowed2 = rateLimiter.checkLimit( ip, path, limitConfig ); // Blocked

        // Advance time past 5s (5001 ms)
        vi.advanceTimersByTime( 5001 );

        const allowed3 = rateLimiter.checkLimit( ip, path, limitConfig ); // Allowed

        // Assert
        expect( allowed1 ).toBe( true );
        expect( allowed2 ).toBe( false );
        expect( allowed3 ).toBe( true );
    });

    it( 'should parse window option with seconds (s) unit', () => 
    {
        // Arrange
        const ip = '127.0.0.1';
        const path = '/api/test';
        const limitConfig = { max : 1, window : '5s' };

        // Act
        rateLimiter.checkLimit( ip, path, limitConfig );
        const blockedBefore = rateLimiter.checkLimit( ip, path, limitConfig );

        vi.advanceTimersByTime( 5001 );

        const allowedAfter = rateLimiter.checkLimit( ip, path, limitConfig );

        // Assert
        expect( blockedBefore ).toBe( false );
        expect( allowedAfter ).toBe( true );
    });

    it( 'should parse window option with minutes (m) unit', () => 
    {
        // Arrange
        const ip = '127.0.0.1';
        const path = '/api/test';
        const limitConfig = { max : 1, window : '2m' }; // 2 minutes = 120,000 ms

        // Act
        rateLimiter.checkLimit( ip, path, limitConfig );
        const blockedBefore = rateLimiter.checkLimit( ip, path, limitConfig );

        vi.advanceTimersByTime( 120001 );

        const allowedAfter = rateLimiter.checkLimit( ip, path, limitConfig );

        // Assert
        expect( blockedBefore ).toBe( false );
        expect( allowedAfter ).toBe( true );
    });

    it( 'should parse window option with hours (h) unit', () => 
    {
        // Arrange
        const ip = '127.0.0.1';
        const path = '/api/test';
        const limitConfig = { max : 1, window : '1h' }; // 1 hour = 3,600,000 ms

        // Act
        rateLimiter.checkLimit( ip, path, limitConfig );
        const blockedBefore = rateLimiter.checkLimit( ip, path, limitConfig );

        vi.advanceTimersByTime( 3600001 );

        const allowedAfter = rateLimiter.checkLimit( ip, path, limitConfig );

        // Assert
        expect( blockedBefore ).toBe( false );
        expect( allowedAfter ).toBe( true );
    });

    it( 'should fallback to default window (1m) when window option is missing', () => 
    {
        // Arrange
        const ip = '127.0.0.1';
        const path = '/api/test';
        const limitConfig = { max : 1 }; // No window provided

        // Act
        rateLimiter.checkLimit( ip, path, limitConfig );
        const blockedBefore = rateLimiter.checkLimit( ip, path, limitConfig );

        // Advance past default 60s
        vi.advanceTimersByTime( 60001 );

        const allowedAfter = rateLimiter.checkLimit( ip, path, limitConfig );

        // Assert
        expect( blockedBefore ).toBe( false );
        expect( allowedAfter ).toBe( true );
    });

    it( 'should fallback to default window (1m) when window option string is malformed', () => 
    {
        // Arrange
        const ip = '127.0.0.1';
        const path = '/api/test';
        const limitConfig = { max : 1, window : 'invalid-window' };

        // Act
        rateLimiter.checkLimit( ip, path, limitConfig );
        const blockedBefore = rateLimiter.checkLimit( ip, path, limitConfig );

        // Advance past default 60s
        vi.advanceTimersByTime( 60001 );

        const allowedAfter = rateLimiter.checkLimit( ip, path, limitConfig );

        // Assert
        expect( blockedBefore ).toBe( false );
        expect( allowedAfter ).toBe( true );
    });

    it( 'should keep separate limits for different ip and path keys', () => 
    {
        // Arrange
        const ip1 = '127.0.0.1';
        const ip2 = '192.168.1.1';
        const path1 = '/api/users';
        const path2 = '/api/products';
        const limitConfig = { max : 1, window : '1m' };

        // Act
        const ip1Path1Allowed = rateLimiter.checkLimit( ip1, path1, limitConfig );
        const ip2Path1Allowed = rateLimiter.checkLimit( ip2, path1, limitConfig );
        const ip1Path2Allowed = rateLimiter.checkLimit( ip1, path2, limitConfig );

        // Assert
        expect( ip1Path1Allowed ).toBe( true );
        expect( ip2Path1Allowed ).toBe( true );
        expect( ip1Path2Allowed ).toBe( true );
    });

    it( 'should evict expired entries so rotating IPs cannot grow the store unbounded', () =>
    {
        // Arrange
        const store: Map<string, unknown> = ( rateLimiter as any ).rateLimitStore;
        const limitConfig = { max : 1, window : 50 };

        for( let i = 0; i < 20; i++ )
        {
            rateLimiter.checkLimit( `203.0.113.${i}`, '/api', limitConfig );
        }

        expect( store.size ).toBe( 20 );

        // Act — expire windows, then drive enough ops to trigger a sweep
        vi.advanceTimersByTime( 100 );

        for( let i = 0; i < 64; i++ )
        {
            rateLimiter.checkLimit( '198.51.100.1', '/api', limitConfig );
        }

        // Assert — stale rotating-IP keys are gone; only the active key remains
        expect( store.size ).toBe( 1 );
        expect( store.has( '/api:198.51.100.1' )).toBe( true );
    });

    it( 'should cap the store at maxKeys even while every key is still active', () =>
    {
        // Arrange — a long window means nothing expires during the test
        const limiter = new RateLimiter( 10 );
        const store: Map<string, unknown> = ( limiter as any ).rateLimitStore;
        const limitConfig = { max : 100, window : '1h' };

        // Act
        for( let i = 0; i < 200; i++ )
        {
            limiter.checkLimit( `203.0.113.${i}`, '/api', limitConfig );
        }

        // Assert — bounded, and the most recent keys survived
        expect( store.size ).toBe( 10 );
        expect( store.has( '/api:203.0.113.199' )).toBe( true );
        expect( store.has( '/api:203.0.113.0' )).toBe( false );
    });

    it( 'should evict least-recently-used keys first', () =>
    {
        // Arrange
        const limiter = new RateLimiter( 2 );
        const store: Map<string, unknown> = ( limiter as any ).rateLimitStore;
        const limitConfig = { max : 100, window : '1h' };

        // Act — touch 'a' again so 'b' becomes the least recently used
        limiter.checkLimit( 'a', '/api', limitConfig );
        limiter.checkLimit( 'b', '/api', limitConfig );
        limiter.checkLimit( 'a', '/api', limitConfig );
        limiter.checkLimit( 'c', '/api', limitConfig );

        // Assert
        expect( store.size ).toBe( 2 );
        expect( store.has( '/api:b' )).toBe( false );
        expect( store.has( '/api:a' )).toBe( true );
        expect( store.has( '/api:c' )).toBe( true );
    });

    it( 'should report a Retry-After hint in seconds when blocked', () =>
    {
        // Arrange
        const limitConfig = { max : 1, window : '30s' };

        // Act
        const first = rateLimiter.consume( '127.0.0.1', '/api', limitConfig );
        vi.advanceTimersByTime( 10000 );
        const blocked = rateLimiter.consume( '127.0.0.1', '/api', limitConfig );

        // Assert
        expect( first ).toEqual({ allowed : true, retryAfter : 0 });
        expect( blocked.allowed ).toBe( false );
        expect( blocked.retryAfter ).toBe( 20 );
    });

    it( 'should never report a Retry-After below 1 second', () =>
    {
        // Arrange
        const limitConfig = { max : 1, window : 100 };

        // Act
        rateLimiter.consume( '127.0.0.1', '/api', limitConfig );
        vi.advanceTimersByTime( 99 );
        const blocked = rateLimiter.consume( '127.0.0.1', '/api', limitConfig );

        // Assert
        expect( blocked.allowed ).toBe( false );
        expect( blocked.retryAfter ).toBe( 1 );
    });

    it( 'should permit a 2x burst across the boundary with the fixed window', () =>
    {
        // Arrange
        const limitConfig = { max : 2, window : '10s' };

        // Act — spend the allowance at the end of one window, then again in the next
        vi.advanceTimersByTime( 9000 );
        const a = rateLimiter.checkLimit( 'ip', '/api', limitConfig );
        const b = rateLimiter.checkLimit( 'ip', '/api', limitConfig );
        vi.advanceTimersByTime( 10000 );
        const c = rateLimiter.checkLimit( 'ip', '/api', limitConfig );
        const d = rateLimiter.checkLimit( 'ip', '/api', limitConfig );

        // Assert — 4 requests in ~1s of wall time is the documented fixed-window weakness
        expect([ a, b, c, d ]).toEqual([ true, true, true, true ]);
    });

    it( 'should smooth the boundary burst with the sliding window', () =>
    {
        // Arrange
        const limitConfig = { max : 2, window : '10s', strategy : 'sliding' as const };

        // Act
        const a = rateLimiter.checkLimit( 'ip', '/api', limitConfig );
        const b = rateLimiter.checkLimit( 'ip', '/api', limitConfig );

        // Immediately into the next window the previous count still weighs ~100%
        vi.advanceTimersByTime( 10000 );
        const c = rateLimiter.checkLimit( 'ip', '/api', limitConfig );

        // Assert
        expect([ a, b ]).toEqual([ true, true ]);
        expect( c ).toBe( false );
    });

    it( 'should release the sliding allowance as the previous window ages out', () =>
    {
        // Arrange
        const limitConfig = { max : 2, window : '10s', strategy : 'sliding' as const };

        // Act
        rateLimiter.checkLimit( 'ip', '/api', limitConfig );
        rateLimiter.checkLimit( 'ip', '/api', limitConfig );

        vi.advanceTimersByTime( 10000 );
        const immediately = rateLimiter.checkLimit( 'ip', '/api', limitConfig );

        // Most of the previous window has now scrolled out of view
        vi.advanceTimersByTime( 9000 );
        const later = rateLimiter.checkLimit( 'ip', '/api', limitConfig );

        // Assert
        expect( immediately ).toBe( false );
        expect( later ).toBe( true );
    });
});
