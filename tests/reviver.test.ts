import { describe, it, expect } from 'vitest';
import { resolveReviver, parseAnyJson, parseAnyQuery, reviveAny, type Reviver } from '../src/helpers/reviver.js';

const mark: Reviver = ( _key, value ) => value === 'x' ? 'y' : value;
const other: Reviver = ( _key, value ) => value === 'x' ? 'z' : value;

describe( 'resolveReviver', () =>
{
    it( 'should return undefined when every layer is unset', () =>
    {
        expect( resolveReviver()).toBeUndefined();
        expect( resolveReviver( undefined, undefined )).toBeUndefined();
    });

    it( 'should take the first defined layer and skip unset parents', () =>
    {
        expect( resolveReviver( undefined, mark, other )).toBe( mark );
        expect( resolveReviver( other, mark )).toBe( other );
    });

    it( 'should treat null as an opt-out even when a parent reviver exists', () =>
    {
        expect( resolveReviver( null, mark )).toBeUndefined();
        expect( resolveReviver( undefined, null, mark )).toBeUndefined();
    });
});

describe( 'parseAnyJson', () =>
{
    it( 'should JSON.parse then reviveTree when a reviver is set', () =>
    {
        expect( parseAnyJson( '{"v":"x"}', mark )).toEqual({ v : 'y' });
        expect( parseAnyJson( '{"v":"x"}' )).toEqual({ v : 'x' });
    });

    it( 'should throw 400 for invalid JSON', () =>
    {
        let err: unknown;

        try
        {
            parseAnyJson( '{' );
        }
        catch( e )
        {
            err = e;
        }

        expect( err ).toMatchObject({ status : 400, message : expect.stringContaining( 'Invalid JSON body' ) });
    });
});

describe( 'parseAnyQuery', () =>
{
    it( 'should parseQueryString then reviveTree when a reviver is set', () =>
    {
        expect( parseAnyQuery( 'v=x', mark )).toEqual({ v : 'y' });
        expect( parseAnyQuery( 'v=x' )).toEqual({ v : 'x' });
    });
});

describe( 'reviveAny', () =>
{
    it( 'should return the value unchanged without a reviver', () =>
    {
        const bag = { v : 'x' };

        expect( reviveAny( bag )).toBe( bag );
        expect( reviveAny( bag, mark )).toEqual({ v : 'y' });
    });
});
