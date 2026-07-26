import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RateLimiter } from '../helpers/rate-limiter.js';

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
});
