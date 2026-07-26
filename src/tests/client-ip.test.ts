import { describe, it, expect } from 'vitest';
import {
    resolveClientIp,
    normalizeIp,
    ipInCidr,
    compileTrustProxy,
    TRUST_PROXY_LOOPBACK
} from '../helpers/client-ip.js';

describe( 'client-ip', () =>
{
    describe( 'normalizeIp / ipInCidr', () =>
    {
        it( 'should normalize IPv4-mapped IPv6 to dotted IPv4', () =>
        {
            expect( normalizeIp( '::ffff:10.1.2.3' )).toBe( '10.1.2.3' );
            expect( normalizeIp( '[::ffff:10.1.2.3]' )).toBe( '10.1.2.3' );
        });

        it( 'should match private CIDR ranges', () =>
        {
            expect( ipInCidr( '10.1.2.3', '10.0.0.0/8' )).toBe( true );
            expect( ipInCidr( '11.0.0.1', '10.0.0.0/8' )).toBe( false );
            expect( ipInCidr( '172.16.5.1', '172.16.0.0/12' )).toBe( true );
            expect( ipInCidr( '172.32.0.1', '172.16.0.0/12' )).toBe( false );
            expect( ipInCidr( '192.168.1.1', '192.168.0.0/16' )).toBe( true );
            expect( ipInCidr( '127.0.0.1', '127.0.0.0/8' )).toBe( true );
            expect( ipInCidr( '::1', '::1/128' )).toBe( true );
        });

        it( 'should handle bracketed IPv6, garbage input, and non-mapped v6 vs v4 CIDR', () =>
        {
            // Arrange / Act / Assert
            expect( normalizeIp( '[2001:db8::1]' )).toBe( '2001:db8::1' );
            expect( normalizeIp( 'not-an-ip' )).toBeNull();
            expect( ipInCidr( '2001:db8::1', '10.0.0.0/8' )).toBe( false );
            expect( ipInCidr( '::ffff:10.1.2.3', '10.0.0.0/8' )).toBe( true );
            expect( ipInCidr( '', '10.0.0.0/8' )).toBe( false );
            expect( compileTrustProxy([ '[::1]/128' ])?.length ).toBe( 1 );
        });
    });

    describe( 'resolveClientIp', () =>
    {
        it( 'should ignore XFF when trustProxy is unset', () =>
        {
            const req =
            {
                headers        : new Headers({ 'x-forwarded-for' : '203.0.113.9' }),
                remoteAddress  : '10.0.0.5'
            };

            expect( resolveClientIp( req )).toBe( '10.0.0.5' );
            expect( resolveClientIp( req, [])).toBe( '10.0.0.5' );
        });

        it( 'should default to 127.0.0.1 when no remoteAddress', () =>
        {
            const req = { headers : new Headers({ 'x-forwarded-for' : '203.0.113.9' }) };
            expect( resolveClientIp( req )).toBe( '127.0.0.1' );
        });

        it( 'should honor XFF only when peer is in CIDR allowlist', () =>
        {
            const req =
            {
                headers       : new Headers({ 'x-forwarded-for' : '203.0.113.9, 10.0.0.2' }),
                remoteAddress : '10.0.0.5'
            };

            expect( resolveClientIp( req, [ '10.0.0.0/8', '172.16.0.0/12' ])).toBe( '203.0.113.9' );
        });

        it( 'should skip trusted hops from the right of XFF', () =>
        {
            const req =
            {
                headers       : new Headers({ 'x-forwarded-for' : '198.51.100.1, 10.0.0.9, 10.0.0.2' }),
                remoteAddress : '10.0.0.1'
            };

            expect( resolveClientIp( req, [ '10.0.0.0/8' ])).toBe( '198.51.100.1' );
        });

        it( 'should not trust XFF when peer is outside allowlist', () =>
        {
            const req =
            {
                headers       : new Headers({ 'x-forwarded-for' : '203.0.113.9' }),
                remoteAddress : '198.51.100.50'
            };

            expect( resolveClientIp( req, [ '10.0.0.0/8' ])).toBe( '198.51.100.50' );
        });

        it( 'should trust only loopback peers with TRUST_PROXY_LOOPBACK', () =>
        {
            const loopback =
            {
                headers       : new Headers({ 'x-forwarded-for' : '203.0.113.9' }),
                remoteAddress : '127.0.0.1'
            };
            const lan =
            {
                headers       : new Headers({ 'x-forwarded-for' : '203.0.113.9' }),
                remoteAddress : '10.0.0.1'
            };

            expect( resolveClientIp( loopback, TRUST_PROXY_LOOPBACK )).toBe( '203.0.113.9' );
            expect( resolveClientIp( lan, TRUST_PROXY_LOOPBACK )).toBe( '10.0.0.1' );
        });

        it( 'should trust IPv4-mapped loopback peers with TRUST_PROXY_LOOPBACK', () =>
        {
            // Arrange — Node often reports IPv4 loopback as ::ffff:127.0.0.1
            const dotted =
            {
                headers       : new Headers({ 'x-forwarded-for' : '203.0.113.9' }),
                remoteAddress : '::ffff:127.0.0.1'
            };
            const hex =
            {
                headers       : new Headers({ 'x-forwarded-for' : '198.51.100.1' }),
                remoteAddress : '::ffff:7f00:1'
            };

            // Act / Assert
            expect( compileTrustProxy( TRUST_PROXY_LOOPBACK )?.some( r => r.kind === 'v6' && r.bits === 104 )).toBe( true );
            expect( resolveClientIp( dotted, TRUST_PROXY_LOOPBACK )).toBe( '203.0.113.9' );
            expect( resolveClientIp( hex, TRUST_PROXY_LOOPBACK )).toBe( '198.51.100.1' );
        });

        it( 'should match IPv4 against IPv4-mapped IPv6 CIDRs and the reverse', () =>
        {
            // Arrange / Act / Assert
            expect( ipInCidr( '10.1.2.3', '::ffff:10.0.0.0/104' )).toBe( true );
            expect( ipInCidr( '::ffff:10.1.2.3', '10.0.0.0/8' )).toBe( true );
            expect( ipInCidr( '2001:db8::1', '10.0.0.0/8' )).toBe( false );
            // Hex-form mapped v6 is not collapsed by normalizeIp → v6-vs-v4 CIDR branch
            expect( ipInCidr( '0:0:0:0:0:ffff:a01:203', '10.0.0.0/8' )).toBe( true );
            expect( ipInCidr( '1:0:0:0:0:ffff:a01:203', '10.0.0.0/8' )).toBe( false );
            expect( compileTrustProxy( undefined )).toBeNull();
            expect( compileTrustProxy([])).toBeNull();
            expect( compileTrustProxy([ 'not-a-cidr' ])).toBeNull();
            expect( compileTrustProxy( TRUST_PROXY_LOOPBACK )?.length ).toBe( 3 );
        });

        it( 'should return the leftmost hop when the whole chain is trusted', () =>
        {
            // Arrange
            const req =
            {
                headers       : new Headers({ 'x-forwarded-for' : '10.0.0.9, 10.0.0.2' }),
                remoteAddress : '10.0.0.1'
            };

            // Act / Assert
            expect( resolveClientIp( req, [ '10.0.0.0/8' ])).toBe( '10.0.0.9' );
        });
    });
});
