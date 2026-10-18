import { describe, it, expect } from 'vitest';
import { createHash, createHmac } from 'node:crypto';
import { computeBodyHash, HasherInstance } from '../src/helpers/body-hash.js';

describe( 'BodyHash helper', () =>
{
    const payload = '{"hello":"world"}';
    const raw = new TextEncoder().encode( payload ).buffer;

    it( 'should hash body using string algorithm and default base64url encoding', () =>
    {
        const expected = createHash( 'sha256' ).update( Buffer.from( raw )).digest( 'base64url' );
        const hash = computeBodyHash( raw, 'sha256' );

        expect( hash ).toBe( expected );
    });

    it( 'should support hex and base64 encodings', () =>
    {
        const expectedHex = createHash( 'sha256' ).update( Buffer.from( raw )).digest( 'hex' );
        const hexHash = computeBodyHash( raw, 'sha256', { encoding : 'hex' });

        expect( hexHash ).toBe( expectedHex );

        const expectedBase64 = createHash( 'sha256' ).update( Buffer.from( raw )).digest( 'base64' );
        const base64Hash = computeBodyHash( raw, 'sha256', { encoding : 'base64' });

        expect( base64Hash ).toBe( expectedBase64 );
    });

    it( 'should return raw Buffer when encoding is buffer', () =>
    {
        const expectedBuf = createHash( 'sha256' ).update( Buffer.from( raw )).digest();
        const bufHash = computeBodyHash( raw, 'sha256', { encoding : 'buffer' });

        expect( Buffer.isBuffer( bufHash )).toBe( true );
        expect( bufHash ).toEqual( expectedBuf );
    });

    it( 'should compute HMAC when key is provided', () =>
    {
        const secret = 'super-secret-key';
        const expected = createHmac( 'sha256', secret ).update( Buffer.from( raw )).digest( 'base64url' );
        const hmac = computeBodyHash( raw, 'sha256', { key : secret });

        expect( hmac ).toBe( expected );

        const expectedHex = createHmac( 'sha256', secret ).update( Buffer.from( raw )).digest( 'hex' );
        const hmacHex = computeBodyHash( raw, 'sha256', { key : secret, encoding : 'hex' });

        expect( hmacHex ).toBe( expectedHex );
    });

    it( 'should support variable length for XOF algorithms like shake256', () =>
    {
        const expected = createHash( 'shake256', { outputLength : 32 }).update( Buffer.from( raw )).digest( 'hex' );
        const hash = computeBodyHash( raw, 'shake256', { length : 32, encoding : 'hex' });

        expect( hash ).toBe( expected );
    });

    it( 'should support custom Hasher class', () =>
    {
        class TestHasher implements HasherInstance
        {
            #chunks : Buffer[] = [];

            update( data: any ): this
            {
                this.#chunks.push( Buffer.from( data ));

                return this;
            }

            digest( encoding?: any ): any
            {
                const joined = Buffer.concat( this.#chunks );
                const hash = createHash( 'md5' ).update( joined ).digest();

                if( encoding === 'buffer' || !encoding ){ return hash }

                return hash.toString( encoding );
            }
        }

        const expected = createHash( 'md5' ).update( Buffer.from( raw )).digest( 'base64url' );
        const result = computeBodyHash( raw, TestHasher );

        expect( result ).toBe( expected );
    });

    it( 'should support custom Hasher instance', () =>
    {
        let captured = '';

        const instance: HasherInstance = {
            update( data: any )
            {
                captured = Buffer.from( data ).toString( 'utf8' );

                return this;
            },
            digest()
            {
                return `custom:${captured}`;
            }
        };

        const result = computeBodyHash( raw, instance );

        expect( result ).toBe( `custom:${payload}` );
    });

    it( 'should throw if hasher is missing', () =>
    {
        expect(() => computeBodyHash( raw, undefined as any )).toThrow( 'BodyHash decorator requires an algorithm name or Hasher' );
    });
});
