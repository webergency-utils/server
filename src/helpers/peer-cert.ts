import { PeerCert, PeerCertSubject } from '../core/types.js';
import { TlsOptions } from '../adapters/adapter.js';

/** True when the runtime needs Node's https/tls surface (mTLS or SNI callbacks). */
export function needsNodeTlsCompat( tls?: TlsOptions ): boolean
{
    if( !tls ){ return false }

    return !!( tls.requestCert || tls.sniCallback );
}

export function tlsMaterialToString( value: string | Buffer | Uint8Array | undefined | null ): string | undefined
{
    if( value === undefined || value === null ){ return undefined }

    if( typeof value === 'string' ){ return value }

    return new TextDecoder().decode( value );
}

function asSubject( value: any ): PeerCertSubject
{
    if( !value || typeof value !== 'object' ){ return {} }

    return value as PeerCertSubject;
}

/**
 * Normalize Node/Bun/Deno peer-certificate shapes into PeerCert.
 * Returns undefined when no usable certificate is present.
 */
export function normalizePeerCert( raw: any ): PeerCert | undefined
{
    if( !raw || typeof raw !== 'object' ){ return undefined }

    const keys = Object.keys( raw );

    if( keys.length === 0 ){ return undefined }

    const serial = String( raw.serialNumber || raw.serial || '' );
    const subject = asSubject( raw.subject );
    const issuer = asSubject( raw.issuer );
    const hasIdentity = !!(
        serial
        || raw.fingerprint
        || raw.fingerprint256
        || Object.keys( subject ).length
        || Object.keys( issuer ).length
    );

    if( !hasIdentity ){ return undefined }

    return {
        subject,
        issuer,
        valid : {
            from : raw.valid?.from
                ? new Date( raw.valid.from )
                : ( raw.valid_from ? new Date( raw.valid_from ) : new Date( 0 )),
            to : raw.valid?.to
                ? new Date( raw.valid.to )
                : ( raw.valid_to ? new Date( raw.valid_to ) : new Date( 0 ))
        },
        fingerprint    : String( raw.fingerprint || '' ),
        fingerprint256 : raw.fingerprint256 ? String( raw.fingerprint256 ) : undefined,
        serialNumber   : serial,
        serial
    };
}

/** Attach PeerCert onto a Fetch Request from a raw certificate object. */
export function attachClientCert( req: Request, raw: any ): void
{
    const cert = normalizePeerCert( raw );

    if( cert )
    {
        ( req as any ).clientCert = cert;
    }
}

/**
 * Best-effort Bun peer certificate extraction.
 * Prefer server helpers; fall back to Node-like socket APIs when present.
 */
export function attachBunClientCert( req: Request, server: any ): void
{
    if( !server ){ return }

    try
    {
        if( typeof server.getPeerCertificate === 'function' )
        {
            attachClientCert( req, server.getPeerCertificate( req ));

            if(( req as any ).clientCert ){ return }
        }
    }
    catch
    {
        // ignore unsupported Bun APIs
    }

    try
    {
        const socket = ( req as any ).socket || ( req as any ).raw?.socket;

        if( socket && typeof socket.getPeerCertificate === 'function' )
        {
            attachClientCert( req, socket.getPeerCertificate());
        }
    }
    catch
    {
        // ignore
    }
}
