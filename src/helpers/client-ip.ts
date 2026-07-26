/**
 * Client IP resolution with optional trusted-proxy CIDR allowlists.
 *
 * Default: ignore X-Forwarded-For; use the TCP peer (`remoteAddress`) or 127.0.0.1.
 * When the peer matches `trustProxy`, walk XFF from the right and return the
 * left-most address that is not itself a trusted proxy hop.
 */

/** Peer CIDR allowlist for trusting `X-Forwarded-For`. Omit / `[]` = never trust XFF. */
export type TrustProxy = string[];

/** Common local-dev allowlist: IPv4 loopback, IPv6 loopback, and IPv4-mapped loopback. */
export const TRUST_PROXY_LOOPBACK: TrustProxy =
[
    '127.0.0.0/8',
    '::1/128',
    '::ffff:127.0.0.0/104'
];

type IpBytes =
{
    kind  : 'v4' | 'v6'
    bytes : Uint8Array
};

type Cidr =
{
    kind : 'v4' | 'v6'
    net  : Uint8Array
    bits : number
};

function parseIpv4( ip: string ): Uint8Array | null
{
    const parts = ip.split( '.' );

    if( parts.length !== 4 ){ return null }

    const bytes = new Uint8Array( 4 );

    for( let i = 0; i < 4; i++ )
    {
        if( !/^\d+$/.test( parts[i])){ return null }

        const n = Number( parts[i]);

        if( n > 255 ){ return null }

        bytes[i] = n;
    }

    return bytes;
}

function parseIpv6( ip: string ): Uint8Array | null
{
    let input = ip;

    if( input.startsWith( '[' ) && input.endsWith( ']' ))
    {
        input = input.slice( 1, -1 );
    }

    const mapped = input.match( /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i );

    if( mapped )
    {
        const v4 = parseIpv4( mapped[1]);

        if( !v4 ){ return null }

        const bytes = new Uint8Array( 16 );
        bytes[10] = 0xff;
        bytes[11] = 0xff;
        bytes[12] = v4[0];
        bytes[13] = v4[1];
        bytes[14] = v4[2];
        bytes[15] = v4[3];

        return bytes;
    }

    const halves = input.split( '::' );

    if( halves.length > 2 ){ return null }

    const head = halves[0] ? halves[0].split( ':' ) : [];
    const tail = halves.length === 2 && halves[1] ? halves[1].split( ':' ) : ( halves.length === 1 ? [] : [] );
    const mid = 8 - head.length - ( halves.length === 2 ? tail.length : 0 );

    if( halves.length === 2 && mid < 0 ){ return null }

    if( halves.length === 1 && head.length !== 8 ){ return null }

    const groups: number[] = [];

    for( const g of head )
    {
        if( !/^[0-9a-fA-F]{1,4}$/.test( g )){ return null }

        groups.push( parseInt( g, 16 ));
    }

    if( halves.length === 2 )
    {
        for( let i = 0; i < mid; i++ ){ groups.push( 0 ) }

        for( const g of tail )
        {
            if( !/^[0-9a-fA-F]{1,4}$/.test( g )){ return null }

            groups.push( parseInt( g, 16 ));
        }
    }

    if( groups.length !== 8 ){ return null }

    const bytes = new Uint8Array( 16 );

    for( let i = 0; i < 8; i++ )
    {
        bytes[i * 2] = ( groups[i] >> 8 ) & 0xff;
        bytes[i * 2 + 1] = groups[i] & 0xff;
    }

    return bytes;
}

/** Normalize display form; expand IPv4-mapped IPv6 to dotted IPv4 when possible. */
export function normalizeIp( raw?: string | null ): string | null
{
    if( !raw ){ return null }

    let ip = raw.trim();

    if( !ip ){ return null }

    if( ip.startsWith( '[' ))
    {
        const end = ip.indexOf( ']' );

        if( end !== -1 ){ ip = ip.slice( 1, end ) }
    }

    const zone = ip.indexOf( '%' );

    if( zone !== -1 ){ ip = ip.slice( 0, zone ) }

    const mapped = ip.match( /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i );

    if( mapped ){ return mapped[1] }

    if( parseIpv4( ip )){ return ip }

    if( parseIpv6( ip )){ return ip.toLowerCase() }

    return null;
}

function parseIpBytes( ip: string ): IpBytes | null
{
    const v4 = parseIpv4( ip );

    if( v4 ){ return { kind : 'v4', bytes : v4 } }

    const v6 = parseIpv6( ip );

    if( v6 ){ return { kind : 'v6', bytes : v6 } }

    return null;
}

/** Strip display wrappers without collapsing IPv4-mapped addresses to IPv4. */
function stripIpDisplay( raw: string ): string
{
    let ip = raw.trim();

    if( ip.startsWith( '[' ))
    {
        const end = ip.indexOf( ']' );

        if( end !== -1 ){ ip = ip.slice( 1, end ) }
    }

    const zone = ip.indexOf( '%' );

    if( zone !== -1 ){ ip = ip.slice( 0, zone ) }

    return ip;
}

function parseCidr( cidr: string ): Cidr | null
{
    const trimmed = cidr.trim();
    const slash = trimmed.indexOf( '/' );
    const addr = slash === -1 ? trimmed : trimmed.slice( 0, slash );
    // Keep ::ffff:x.x.x.x as v6 so prefixes like /96–/104 stay valid (TRUST_PROXY_LOOPBACK).
    const parsed = parseIpBytes( stripIpDisplay( addr ));

    if( !parsed ){ return null }

    const defaultBits = parsed.kind === 'v4' ? 32 : 128;
    let bits = defaultBits;

    if( slash !== -1 )
    {
        const bitStr = trimmed.slice( slash + 1 );

        if( !/^\d+$/.test( bitStr )){ return null }

        bits = Number( bitStr );

        if( bits < 0 || bits > defaultBits ){ return null }
    }

    return { kind : parsed.kind, net : parsed.bytes, bits };
}

function ipMatchesCidr( ip: IpBytes, cidr: Cidr ): boolean
{
    if( ip.kind === cidr.kind )
    {
        const bytes = Math.floor( cidr.bits / 8 );
        const rem = cidr.bits % 8;

        for( let i = 0; i < bytes; i++ )
        {
            if( ip.bytes[i] !== cidr.net[i]){ return false }
        }

        if( rem === 0 ){ return true }

        const mask = ( 0xff << ( 8 - rem )) & 0xff;

        return ( ip.bytes[bytes] & mask ) === ( cidr.net[bytes] & mask );
    }

    // Match IPv4 against ::ffff:0:0/96-style ranges by projecting to v6-mapped form.
    if( ip.kind === 'v4' && cidr.kind === 'v6' )
    {
        const mapped = new Uint8Array( 16 );
        mapped[10] = 0xff;
        mapped[11] = 0xff;
        mapped[12] = ip.bytes[0];
        mapped[13] = ip.bytes[1];
        mapped[14] = ip.bytes[2];
        mapped[15] = ip.bytes[3];

        return ipMatchesCidr({ kind : 'v6', bytes : mapped }, cidr );
    }

    if( ip.kind === 'v6' && cidr.kind === 'v4' )
    {
        // Only IPv4-mapped addresses can match an IPv4 CIDR.
        if( ip.bytes[10] !== 0xff || ip.bytes[11] !== 0xff ){ return false }

        for( let i = 0; i < 10; i++ )
        {
            if( ip.bytes[i] !== 0 ){ return false }
        }

        return ipMatchesCidr({
            kind  : 'v4',
            bytes : ip.bytes.slice( 12 )
        }, cidr );
    }

    return false;
}

export function ipInCidr( ip: string, cidr: string ): boolean
{
    const normalized = normalizeIp( ip );
    const range = parseCidr( cidr );

    if( !normalized || !range ){ return false }

    const parsed = parseIpBytes( normalized );

    if( !parsed ){ return false }

    return ipMatchesCidr( parsed, range );
}

export function compileTrustProxy( trustProxy?: TrustProxy ): Cidr[] | null
{
    if( !Array.isArray( trustProxy ) || trustProxy.length === 0 ){ return null }

    const ranges: Cidr[] = [];

    for( const entry of trustProxy )
    {
        const cidr = parseCidr( entry );

        if( cidr ){ ranges.push( cidr ) }
    }

    return ranges.length > 0 ? ranges : null;
}

function isTrusted( ip: string, ranges: Cidr[]): boolean
{
    const parsed = parseIpBytes( ip );

    if( !parsed ){ return false }

    for( const range of ranges )
    {
        if( ipMatchesCidr( parsed, range )){ return true }
    }

    return false;
}

export type ClientIpRequest =
{
    headers        : Headers
    remoteAddress? : string | null
    trustProxy?    : TrustProxy
};

/**
 * Resolve the client IP for @Ip and rate limiting.
 *
 * @param trustProxy - omit/`[]`: never trust XFF; otherwise CIDR allowlist of immediate peers that may set XFF.
 */
export function resolveClientIp( req: ClientIpRequest, trustProxy?: TrustProxy ): string
{
    const remote = normalizeIp( req.remoteAddress ) || '127.0.0.1';
    const ranges = compileTrustProxy( trustProxy !== undefined ? trustProxy : req.trustProxy );

    if( !ranges || !isTrusted( remote, ranges ))
    {
        return remote;
    }

    const header = req.headers.get( 'x-forwarded-for' );
    const hops: string[] = [];

    if( header )
    {
        for( const part of header.split( ',' ))
        {
            const hop = normalizeIp( part );

            if( hop ){ hops.push( hop ) }
        }
    }

    const chain = hops.length > 0 ? [ ...hops, remote ] : [ remote ];

    for( let i = chain.length - 1; i >= 0; i-- )
    {
        if( !isTrusted( chain[i], ranges ))
        {
            return chain[i];
        }
    }

    return chain[0];
}
