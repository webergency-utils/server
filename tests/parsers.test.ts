import { describe, it, expect } from 'vitest';
import { createFormBag } from '../src/helpers/parsers.js';

function bagFrom( pairs: Array<[string, any]> )
{
    const bag = createFormBag();

    for( const [ key, value ] of pairs )
    {
        bag.assign( key, value );
    }

    return bag;
}

describe( 'createFormBag', () =>
{
    it( 'should start empty', () =>
    {
        expect( createFormBag() ).toEqual({});
    });

    it( 'should assign simple keys', () =>
    {
        expect( bagFrom([[ 'name', 'John' ], [ 'age', '30' ]]) ).toEqual({
            name : 'John',
            age  : '30'
        });
    });

    it( 'should parse square bracket array notation', () =>
    {
        expect( bagFrom([[ 'colors[]', 'red' ], [ 'colors[]', 'blue' ]]) ).toEqual({
            colors : [ 'red', 'blue' ]
        });
    });

    it( 'should parse nested object structures', () =>
    {
        expect( bagFrom([[ 'user[name]', 'Alice' ], [ 'user[role]', 'admin' ]]) ).toEqual({
            user : {
                name : 'Alice',
                role : 'admin'
            }
        });
    });

    it( 'should convert duplicate keys without brackets to an array', () =>
    {
        expect( bagFrom([[ 'item', 'apple' ], [ 'item', 'banana' ]]) ).toEqual({
            item : [ 'apple', 'banana' ]
        });
    });

    it( 'should push subsequent values to an already converted array', () =>
    {
        expect( bagFrom([[ 'item', 'apple' ], [ 'item', 'banana' ], [ 'item', 'cherry' ]]) ).toEqual({
            item : [ 'apple', 'banana', 'cherry' ]
        });
    });

    it( 'should dynamically convert array to object when a non-numeric key is assigned', () =>
    {
        expect( bagFrom([[ 'items[]', 'first' ], [ 'items[name]', 'second' ]]) ).toEqual({
            items : {
                0    : 'first',
                name : 'second'
            }
        });
    });

    it( 'should append a value under a numeric key to an existing object', () =>
    {
        expect( bagFrom([[ 'items[name]', 'first' ], [ 'items', 'second' ]]) ).toEqual({
            items : {
                name : 'first',
                0    : 'second'
            }
        });
    });

    it( 'should index nested object appends from the nested keys, not the parent', () =>
    {
        expect( bagFrom([[ '0', 'keep' ], [ 'items[name]', 'first' ], [ 'items', 'second' ]]) ).toEqual({
            0     : 'keep',
            items : {
                name : 'first',
                0    : 'second'
            }
        });
    });

    it( 'should parse explicit numeric keys inside brackets', () =>
    {
        expect( bagFrom([[ 'user[0][name]', 'John' ]]) ).toEqual({
            user : [
                { name : 'John' }
            ]
        });
    });

    it( 'should handle bracket assignments on mixed numeric/non-numeric objects', () =>
    {
        expect( bagFrom([[ 'user[name]', 'Alice' ], [ 'user[0]', 'Bob' ], [ 'user[]', 'Charlie' ]]) ).toEqual({
            user : {
                name : 'Alice',
                0    : 'Bob',
                1    : 'Charlie'
            }
        });
    });

    it( 'should merge multiple properties under the same object bracket item', () =>
    {
        expect( bagFrom([[ 'a[][name]', 'Alice' ], [ 'a[][age]', '30' ]]) ).toEqual({
            a : [
                { name : 'Alice', age : '30' }
            ]
        });
    });

    it( 'should push a new object to a brackets array if the property already exists', () =>
    {
        expect( bagFrom([[ 'a[][name]', 'Alice' ], [ 'a[][name]', 'Bob' ]]) ).toEqual({
            a : [
                { name : 'Alice' },
                { name : 'Bob' }
            ]
        });
    });

    it( 'should append under nested numeric index 0 when the nested object has no int keys', () =>
    {
        expect( bagFrom([[ '0[name]', 'first' ], [ '0', 'second' ]]) ).toEqual({
            0 : {
                name : 'first',
                0    : 'second'
            }
        });
    });

    it( 'should array-coerce class instances instead of treating them as nested form objects', () =>
    {
        class FileLike
        {
            constructor( public name: string ) {}
        }

        const first = new FileLike( 'a' );
        const second = new FileLike( 'b' );
        const result = bagFrom([[ 'docs', first ], [ 'docs', second ]]);

        expect( result.docs ).toEqual([ first, second ]);
    });

    it( 'should not pollute Object.prototype via __proto__ keys', () =>
    {
        const marker = `__fuzz_${Date.now()}`;

        bagFrom([[ `__proto__[${marker}]`, 'polluted' ]]);
        bagFrom([[ `constructor[prototype][${marker}]`, 'polluted' ]]);
        bagFrom([[ '__proto__[K', 'x' ]]);

        expect( Object.prototype ).not.toHaveProperty( marker );
        expect( Object.prototype ).not.toHaveProperty( 'K' );
        expect( bagFrom([[ '__proto__', 'x' ]]) ).not.toHaveProperty( '__proto__' );
        expect( bagFrom([[ 'safe', '1' ], [ '__proto__[x]', '2' ]]) ).toEqual({ safe : '1' });
    });

    it( 'should return ordinary objects (not null-prototype)', () =>
    {
        const result = bagFrom([[ 'user[name]', 'Ada' ], [ 'tags[]', 'a' ]]) as any;

        expect( Object.getPrototypeOf( result )).toBe( Object.prototype );
        expect( result instanceof Object ).toBe( true );
        expect( Object.hasOwn( result, 'user' )).toBe( true );
        expect( Object.getPrototypeOf( result.user )).toBe( Object.prototype );
        expect( typeof result.hasOwnProperty ).toBe( 'function' );
    });
});
