import { describe, it, expect } from 'vitest';
import {
    normalizePeerCert,
    needsNodeTlsCompat,
    tlsMaterialToString,
    attachClientCert,
    attachBunClientCert
} from '../helpers/peer-cert.js';

describe( 'peer-cert helpers', () =>
{
    it( 'should detect Node TLS compat needs for mTLS and SNI', () =>
    {
        expect( needsNodeTlsCompat()).toBe( false );
        expect( needsNodeTlsCompat({ key : 'k', cert : 'c' })).toBe( false );
        expect( needsNodeTlsCompat({ key : 'k', cert : 'c', requestCert : true })).toBe( true );
        expect( needsNodeTlsCompat({
            key         : 'k',
            cert        : 'c',
            sniCallback : async () => null
        })).toBe( true );
    });

    it( 'should convert PEM buffers to strings', () =>
    {
        expect( tlsMaterialToString( 'pem' )).toBe( 'pem' );
        expect( tlsMaterialToString( new TextEncoder().encode( 'abc' ))).toBe( 'abc' );
        expect( tlsMaterialToString( undefined )).toBeUndefined();
    });

    it( 'should normalize Node-style peer certificates', () =>
    {
        const cert = normalizePeerCert({
            subject        : { CN : 'client' },
            issuer         : { CN : 'ca' },
            valid_from     : 'Jan 1 00:00:00 2024 GMT',
            valid_to       : 'Jan 1 00:00:00 2025 GMT',
            fingerprint    : 'AA:BB',
            fingerprint256 : 'CC:DD',
            serialNumber   : '01'
        });

        expect( cert?.subject.CN ).toBe( 'client' );
        expect( cert?.issuer.CN ).toBe( 'ca' );
        expect( cert?.serial ).toBe( '01' );
        expect( cert?.serialNumber ).toBe( '01' );
        expect( cert?.fingerprint ).toBe( 'AA:BB' );
        expect( cert?.valid.from ).toBeInstanceOf( Date );
    });

    it( 'should ignore empty peer certificate objects', () =>
    {
        expect( normalizePeerCert({})).toBeUndefined();
        expect( normalizePeerCert( null )).toBeUndefined();
    });

    it( 'should attach clientCert onto a Request', () =>
    {
        const req = new Request( 'http://localhost/' );
        attachClientCert( req, {
            subject      : { CN : 'peer' },
            serialNumber : '99'
        });
        expect(( req as any ).clientCert.subject.CN ).toBe( 'peer' );
        expect(( req as any ).clientCert.serial ).toBe( '99' );
    });

    it( 'should read Bun peer cert from server.getPeerCertificate when available', () =>
    {
        const req = new Request( 'http://localhost/' );
        const server = {
            getPeerCertificate : () => ({
                subject      : { CN : 'bun-client' },
                serialNumber : '77'
            })
        };

        attachBunClientCert( req, server );
        expect(( req as any ).clientCert.subject.CN ).toBe( 'bun-client' );
    });

    it( 'should fall back to req.socket.getPeerCertificate on Bun', () =>
    {
        const req = new Request( 'http://localhost/' );
        ( req as any ).socket = {
            getPeerCertificate : () => ({
                subject      : { CN : 'socket-client' },
                serialNumber : '55'
            })
        };

        attachBunClientCert( req, {});
        expect(( req as any ).clientCert.subject.CN ).toBe( 'socket-client' );
    });
});
