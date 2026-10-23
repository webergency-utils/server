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

interface IpBytes
{
    kind  : 'v4' | 'v6'
    bytes : Uint8Array
}

interface Cidr
{
    kind : 'v4' | 'v6'
    net  : Uint8Array
    bits : number
}

function parseIpv4( ip: string ): Uint8Array | null
{
    const len = ip.length;

    if( len < 7 || len > 15 ){ return null }

    const bytes = new Uint8Array( 4 );
    let part = 0;
    let val = 0;
    let digits = 0;

    for( let i = 0; i < len; i++ )
    {
        const code = ip.charCodeAt( i );

        if( code === 46 /* . */ )
        {
            if( digits === 0 || part === 3 ){ return null }

            bytes[part++] = val;
            val = 0;
            digits = 0;
        }
        else if( code >= 48 && code <= 57 )
        {
            val = val * 10 + ( code - 48 );
            digits++;

            if( val > 255 ){ return null }
        }
        else
        {
            return null;
        }
    }

    if( digits === 0 || part !== 3 ){ return null }

    bytes[3] = val;

    return bytes;
}

function hasMappedV4Prefix( ip: string ): boolean
{
    if( ip.length < 14 || ip.length > 22 ){ return false }

    return ip.startsWith( '::ffff:' ) || ip.slice( 0, 7 ).toLowerCase() === '::ffff:';
}

function parseIpv6( input: string ): Uint8Array | null
{
    if( hasMappedV4Prefix( input ))
    {
        const v4 = parseIpv4( input.slice( 7 ));

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
    const tail = halves.length === 2 && halves[1] ? halves[1].split( ':' ) : [];
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

const LOOPBACK_V4_BYTES: IpBytes = { kind : 'v4', bytes : new Uint8Array([ 127, 0, 0, 1 ]) };
const LOOPBACK_V6_BYTES: IpBytes = {
    kind  : 'v6',
    bytes : new Uint8Array([ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1 ])
};

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

/** Normalize display form; expand IPv4-mapped IPv6 to dotted IPv4 when possible. */
export function normalizeIp( raw?: string | null ): string | null
{
    if( !raw ){ return null }

    if( raw === '127.0.0.1' || raw === '::1' ){ return raw }

    if( raw === '::ffff:127.0.0.1' ){ return '127.0.0.1' }

    const ip = stripIpDisplay( raw );

    if( !ip ){ return null }

    if( hasMappedV4Prefix( ip ))
    {
        const v4Str = ip.slice( 7 );

        if( parseIpv4( v4Str )){ return v4Str }
    }

    if( parseIpv4( ip )){ return ip }

    if( parseIpv6( ip )){ return ip.toLowerCase() }

    return null;
}

function normalizeAndParseIp( raw?: string | null ): { ip : string, parsed : IpBytes } | null
{
    if( !raw ){ return null }

    if( raw === '127.0.0.1' || raw === '::ffff:127.0.0.1' )
    {
        return { ip : '127.0.0.1', parsed : LOOPBACK_V4_BYTES };
    }

    if( raw === '::1' )
    {
        return { ip : '::1', parsed : LOOPBACK_V6_BYTES };
    }

    const ip = stripIpDisplay( raw );

    if( !ip ){ return null }

    if( hasMappedV4Prefix( ip ))
    {
        const v4Str = ip.slice( 7 );
        const v4 = parseIpv4( v4Str );

        if( v4 ){ return { ip : v4Str, parsed : { kind : 'v4', bytes : v4 } } }
    }

    const v4 = parseIpv4( ip );

    if( v4 ){ return { ip, parsed : { kind : 'v4', bytes : v4 } } }

    const v6 = parseIpv6( ip );

    if( v6 ){ return { ip : ip.toLowerCase(), parsed : { kind : 'v6', bytes : v6 } } }

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

    // ip.kind === 'v6' && cidr.kind === 'v4': only IPv4-mapped addresses can match an IPv4 CIDR.
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

export function ipInCidr( ip: string, cidr: string ): boolean
{
    const entry = normalizeAndParseIp( ip );
    const range = parseCidr( cidr );

    if( !entry || !range ){ return false }

    return ipMatchesCidr( entry.parsed, range );
}

export type CompiledTrustProxy = readonly Cidr[];

const trustProxyCache = new WeakMap<TrustProxy, Cidr[] | null>();

export function compileTrustProxy( trustProxy?: TrustProxy | CompiledTrustProxy | null ): Cidr[] | null
{
    if( !Array.isArray( trustProxy ) || trustProxy.length === 0 ){ return null }

    const first = trustProxy[0] as string | Cidr;

    if( typeof first === 'object' && first !== null && 'net' in first )
    {
        return trustProxy as unknown as Cidr[];
    }

    const raw = trustProxy as TrustProxy;

    if( trustProxyCache.has( raw ))
    {
        return trustProxyCache.get( raw )!;
    }

    const ranges: Cidr[] = [];

    for( const entry of raw )
    {
        const cidr = parseCidr( entry );

        if( cidr ){ ranges.push( cidr ) }
    }

    const compiled = ranges.length > 0 ? ranges : null;
    trustProxyCache.set( raw, compiled );

    return compiled;
}

function isTrustedBytes( parsed: IpBytes, ranges: readonly Cidr[]): boolean
{
    for( const range of ranges )
    {
        if( ipMatchesCidr( parsed, range )){ return true }
    }

    return false;
}

export interface ClientIpRequest
{
    headers             : Headers
    remoteAddress?      : string | null
    trustProxy?         : TrustProxy
    compiledTrustProxy? : CompiledTrustProxy | null
}

/**
 * Resolve the client IP for @Ip and rate limiting.
 *
 * @param trustProxy - omit/`[]`: never trust XFF; otherwise CIDR allowlist of immediate peers that may set XFF.
 */
export function resolveClientIp( req: ClientIpRequest, trustProxy?: TrustProxy | CompiledTrustProxy | null ): string
{
    const ranges = trustProxy !== undefined
        ? compileTrustProxy( trustProxy )
        : ( req.compiledTrustProxy !== undefined ? req.compiledTrustProxy : compileTrustProxy( req.trustProxy ));

    if( !ranges )
    {
        return normalizeIp( req.remoteAddress ) || '127.0.0.1';
    }

    const remoteEntry = normalizeAndParseIp( req.remoteAddress );
    const remote = remoteEntry ? remoteEntry.ip : '127.0.0.1';
    const remoteParsed = remoteEntry ? remoteEntry.parsed : LOOPBACK_V4_BYTES;

    if( !isTrustedBytes( remoteParsed, ranges ))
    {
        return remote;
    }

    const header = req.headers.get( 'x-forwarded-for' );

    if( !header )
    {
        return remote;
    }

    let end = header.length;
    let lastValidHop = remote;

    while( end > 0 )
    {
        const comma = header.lastIndexOf( ',', end - 1 );
        const part = header.slice( comma + 1, end );
        const hopEntry = normalizeAndParseIp( part );

        if( hopEntry )
        {
            if( !isTrustedBytes( hopEntry.parsed, ranges ))
            {
                return hopEntry.ip;
            }

            lastValidHop = hopEntry.ip;
        }

        if( comma === -1 ){ break }

        end = comma;
    }

    return lastValidHop;
}
