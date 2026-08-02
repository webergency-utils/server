import { Readable } from 'node:stream';

/** Node.js `stream.Readable` / `fs.ReadStream` (and duck-typed pipes). */
export function isNodeReadable( value: unknown ): boolean
{
    if( value == null || typeof value !== 'object' ){ return false }

    if( value instanceof Readable ){ return true }

    // Duck-type: avoid treating Web ReadableStream as a Node stream
    if( typeof ReadableStream !== 'undefined' && value instanceof ReadableStream ){ return false }

    const v = value as Record<string, unknown>;

    return typeof v.pipe === 'function'
        && typeof v.on === 'function'
        && typeof v.read === 'function'
        && v.readable !== undefined;
}

/**
 * Convert a handler / `ServerResponse.stream` body into Fetch `BodyInit`.
 * Node `Readable` / `fs.ReadStream` use `Readable.toWeb` — a backpressured pipe bridge
 * that does **not** buffer the full payload in memory.
 */
export function toStreamOrBinaryBody( value: unknown ): BodyInit | undefined
{
    if( value == null ){ return undefined }

    if( typeof Blob !== 'undefined' && value instanceof Blob ){ return value }

    if( value instanceof ArrayBuffer ){ return value }

    if( ArrayBuffer.isView( value )){ return value as BodyInit }

    if( typeof ReadableStream !== 'undefined' && value instanceof ReadableStream ){ return value }

    if( isNodeReadable( value ))
    {
        return Readable.toWeb( value as Readable ) as unknown as ReadableStream;
    }

    return undefined;
}

/** Bodies that must not go through JSON.stringify. */
export function isBinaryOrStreamBody( value: unknown ): boolean
{
    return toStreamOrBinaryBody( value ) !== undefined;
}
