import { describe, it, expect } from 'vitest';
import { Reflector } from '../src/core/reflector.js';
import { ensureCustomMetadataBag } from '../src/core/symbols.js';

describe( 'Reflector', () =>
{
    it( 'should return undefined for missing targets or keys', () =>
    {
        // Arrange
        const reflector = new Reflector();

        // Act / Assert
        expect( reflector.get( 'k', undefined )).toBeUndefined();
        expect( reflector.get( 'k', {})).toBeUndefined();
        expect( reflector.getAllAndOverride( 'k', [{}, {}])).toBeUndefined();
        expect( reflector.getAllAndMerge( 'k', [{}, {}])).toEqual([]);
    });

    it( 'should override with the first defined target value', () =>
    {
        // Arrange
        const reflector = new Reflector();
        const a = {};
        const b = {};
        ensureCustomMetadataBag( a ).role = 'user';
        ensureCustomMetadataBag( b ).role = 'admin';

        // Act / Assert
        expect( reflector.getAllAndOverride( 'role', [a, b])).toBe( 'user' );
        expect( reflector.getAllAndOverride( 'role', [ {}, b ])).toBe( 'admin' );
    });

    it( 'should merge arrays, objects, and scalars', () =>
    {
        // Arrange
        const reflector = new Reflector();
        const a = {};
        const b = {};
        const c = {};
        ensureCustomMetadataBag( a ).tags = [ 'a' ];
        ensureCustomMetadataBag( b ).tags = [ 'b' ];
        ensureCustomMetadataBag( a ).cfg = { x : 1 };
        ensureCustomMetadataBag( b ).cfg = { y : 2 };
        ensureCustomMetadataBag( c ).flag = true;
        const d = {};
        ensureCustomMetadataBag( d ).flag = false;

        // Act / Assert
        expect( reflector.getAllAndMerge( 'tags', [a, b])).toEqual([ 'a', 'b' ]);
        expect( reflector.getAllAndMerge( 'cfg', [a, b])).toEqual({ x : 1, y : 2 });
        expect( reflector.getAllAndMerge( 'flag', [c, d])).toEqual([ true, false ]);
        expect( reflector.getAllAndMerge( 'tags', [a, { __metadata__ : { tags : 'solo' } }])).toEqual([ 'a', 'solo' ]);
    });
});
