import { createHash, createHmac, type BinaryToTextEncoding } from 'node:crypto';

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
    if( typeof hasher !== 'function' ){ return hasher as HasherInstance }

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
        if( options?.key !== undefined )
        {
            const hmac = createHmac( hasher, options.key );
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
