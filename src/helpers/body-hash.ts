import { createHash, createHmac, timingSafeEqual, type BinaryToTextEncoding } from 'node:crypto';

export type BodyHashEncoding = BinaryToTextEncoding | 'buffer';

export interface HasherInstance
{
    update( data: ArrayBuffer | Buffer | Uint8Array | string ): this
    digest( encoding?: BinaryToTextEncoding ): string | Buffer | Uint8Array
}

export interface HasherConstructor
{
    new( ...args: any[]): HasherInstance
}

export type HasherFactory = () => HasherInstance;

export type HasherInput =
    | string
    | HasherInstance
    | HasherConstructor
    | HasherFactory;

export interface BodyHashOptions
{
    encoding? : BodyHashEncoding
    key?      : string | Buffer
    length?   : number
}

function instantiateHasher( hasher: HasherInput ): HasherInstance
{
    if( typeof hasher !== 'function' )
    {
        const copyFn = ( hasher as { copy? : unknown }).copy;

        if( typeof copyFn === 'function' )
        {
            return ( copyFn as () => HasherInstance ).call( hasher );
        }

        return hasher as HasherInstance;
    }

    const isClass = (
        /^class\s/.test( Function.prototype.toString.call( hasher )) ||
        Boolean( hasher.prototype && typeof hasher.prototype.update === 'function' )
    );

    if( isClass )
    {
        return new ( hasher as HasherConstructor )();
    }

    try
    {
        return new ( hasher as HasherConstructor )();
    }
    catch
    {
        return ( hasher as HasherFactory )();
    }
}

export function computeBodyHash(
    raw: ArrayBuffer,
    hasher?: HasherInput,
    options?: BodyHashOptions
): string | Buffer | Uint8Array
{
    if( !hasher ){ throw new Error( 'BodyHash decorator requires an algorithm name or Hasher' ) }

    const encoding: BodyHashEncoding = options?.encoding ?? 'base64url';
    const buf = Buffer.from( raw );

    if( typeof hasher === 'string' )
    {
        if( options && 'key' in options )
        {
            const key = options.key;

            if(
                typeof key === 'string'
                    ? key.length === 0
                    : !( key instanceof Uint8Array ) || key.byteLength === 0
            )
            {
                throw new Error( 'BodyHash HMAC key must be a non-empty string or Buffer' );
            }

            const hmac = createHmac( hasher, key! );
            hmac.update( buf );

            return encoding === 'buffer' ? hmac.digest() : hmac.digest( encoding );
        }

        const hash = createHash( hasher, options?.length ? { outputLength : options.length } : undefined );
        hash.update( buf );

        return encoding === 'buffer' ? hash.digest() : hash.digest( encoding );
    }

    const instance = instantiateHasher( hasher );
    instance.update( buf );

    if( encoding === 'buffer' )
    {
        const result = instance.digest();

        if( typeof result === 'string' ){ return Buffer.from( result ) }

        return result;
    }

    const result = instance.digest( encoding as BinaryToTextEncoding );

    if( Buffer.isBuffer( result ) || result instanceof Uint8Array )
    {
        return Buffer.from( result ).toString( encoding as BufferEncoding );
    }

    return result;
}

function toVerifyBuffer( input: string | Buffer | Uint8Array ): Buffer
{
    if( typeof input === 'string' ){ return Buffer.from( input, 'utf8' ) }

    if( Buffer.isBuffer( input )){ return input }

    return Buffer.from( input.buffer, input.byteOffset, input.byteLength );
}

/** Constant-time digest comparison helper for `@BodyHash` webhook verification. */
export function verifyBodyHash(
    computed: string | Buffer | Uint8Array,
    expected: string | Buffer | Uint8Array | null | undefined
): boolean
{
    if( expected === null || expected === undefined ){ return false }

    const a = toVerifyBuffer( computed );
    const b = toVerifyBuffer( expected );

    if( a.byteLength === 0 || a.byteLength !== b.byteLength )
    {
        return false;
    }

    return timingSafeEqual( a, b );
}
