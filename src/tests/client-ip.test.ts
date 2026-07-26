import { describe, it, expect } from 'vitest';
import { resolveClientIp, normalizeIp, ipInCidr } from '../helpers/client-ip.js';

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
            expect( resolveClientIp( req, false )).toBe( '10.0.0.5' );
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

        it( 'should treat trustProxy:true as loopback-only', () =>
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

            expect( resolveClientIp( loopback, true )).toBe( '203.0.113.9' );
            expect( resolveClientIp( lan, true )).toBe( '10.0.0.1' );
        });
    });
});
