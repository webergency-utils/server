import { describe, it, expect } from 'vitest';
import { QueryParser } from '../src/helpers/parsers.js';

describe( 'QueryParser', () => 
{
    it( 'should parse empty query string as empty object', () => 
    {
        // Arrange & Act
        const result = QueryParser.parse( '' );

        // Assert
        expect( result ).toEqual({});
    });

    it( 'should parse simple key-value pairs', () => 
    {
        // Arrange & Act
        const result = QueryParser.parse( 'name=John&age=30' );

        // Assert
        expect( result ).toEqual({
            name : 'John',
            age  : '30'
        });
    });

    it( 'should parse valueless keys as true', () => 
    {
        // Arrange & Act
        const result = QueryParser.parse( 'isAdmin&active=true' );

        // Assert
        expect( result ).toEqual({
            isAdmin : true,
            active  : 'true'
        });
    });

    it( 'should decode URI components correctly', () => 
    {
        // Arrange & Act
        const result = QueryParser.parse( 'name=John%20Doe&email=john.doe%40example.com' );

        // Assert
        expect( result ).toEqual({
            name  : 'John Doe',
            email : 'john.doe@example.com'
        });
    });

    it( 'should parse square bracket array notation', () => 
    {
        // Arrange & Act
        const result = QueryParser.parse( 'colors[]=red&colors[]=blue' );

        // Assert
        expect( result ).toEqual({
            colors : ['red', 'blue']
        });
    });

    it( 'should parse nested object structures', () => 
    {
        // Arrange & Act
        const result = QueryParser.parse( 'user[name]=Alice&user[role]=admin' );

        // Assert
        expect( result ).toEqual({
            user : {
                name : 'Alice',
                role : 'admin'
            }
        });
    });

    it( 'should convert duplicate keys without brackets to an array', () => 
    {
        // Arrange & Act
        const result = QueryParser.parse( 'item=apple&item=banana' );

        // Assert
        expect( result ).toEqual({
            item : ['apple', 'banana']
        });
    });

    it( 'should push subsequent values to an already converted array (Line 51 coverage)', () => 
    {
        // Arrange & Act
        const result = QueryParser.parse( 'item=apple&item=banana&item=cherry' );

        // Assert
        expect( result ).toEqual({
            item : ['apple', 'banana', 'cherry']
        });
    });

    it( 'should dynamically convert array to object when non-numeric key is assigned (Line 31 coverage)', () => 
    {
        // Arrange & Act
        const result = QueryParser.parse( 'items[]=first&items[name]=second' );

        // Assert
        expect( result ).toEqual({
            items : {
                0    : 'first',
                name : 'second'
            }
        });
    });

    it( 'should append value under a numeric key to an existing object (Line 55 coverage)', () => 
    {
        // Arrange & Act
        const result = QueryParser.parse( 'items[name]=first&items=second' );

        // Assert
        expect( result ).toEqual({
            items : {
                name : 'first',
                0    : 'second'
            }
        });
    });

    it( 'should index nested object appends from the nested keys, not the parent', () =>
    {
        // Arrange — sibling numeric key on the parent must not skew the nested index
        // Act
        const result = QueryParser.parse( '0=keep&items[name]=first&items=second' );

        // Assert
        expect( result ).toEqual({
            0     : 'keep',
            items : {
                name : 'first',
                0    : 'second'
            }
        });
    });

    it( 'should parse explicit numeric keys inside brackets', () => 
    {
        // Arrange & Act
        const result = QueryParser.parse( 'user[0][name]=John' );

        // Assert
        expect( result ).toEqual({
            user : [
                { name : 'John' }
            ]
        });
    });

    it( 'should handle bracket assignments on mixed numeric/non-numeric objects', () => 
    {
        // Arrange & Act
        const result = QueryParser.parse( 'user[name]=Alice&user[0]=Bob&user[]=Charlie' );

        // Assert
        expect( result ).toEqual({
            user : {
                name : 'Alice',
                0    : 'Bob',
                1    : 'Charlie'
            }
        });
    });

    it( 'should merge multiple properties under same object bracket item', () => 
    {
        // Arrange & Act
        const result = QueryParser.parse( 'a[][name]=Alice&a[][age]=30' );

        // Assert
        expect( result ).toEqual({
            a : [
                { name : 'Alice', age : '30' }
            ]
        });
    });

    it( 'should push new object to brackets array if property already exists', () => 
    {
        // Arrange & Act
        const result = QueryParser.parse( 'a[][name]=Alice&a[][name]=Bob' );

        // Assert
        expect( result ).toEqual({
            a : [
                { name : 'Alice' },
                { name : 'Bob' }
            ]
        });
    });

    it( 'should append under nested numeric index 0 when the nested object has no int keys', () => 
    {
        // Arrange & Act — previously mis-indexed to 1 by scanning parent keys
        const result = QueryParser.parse( '0[name]=first&0=second' );

        // Assert
        expect( result ).toEqual({
            0 : {
                name : 'first',
                0    : 'second'
            }
        });
    });

    it( 'should skip parsing logic for empty consecutive separators', () => 
    {
        // Arrange & Act
        const result = QueryParser.parse( 'a=1&&b=2' );

        // Assert
        expect( result ).toEqual({
            a : '1',
            b : '2'
        });
    });

    it( 'should decode + symbol as a space character', () => 
    {
        // Arrange & Act
        const result = QueryParser.parse( 'search=hello+world' );

        // Assert
        expect( result ).toEqual({
            search : 'hello world'
        });
    });

    it( 'should not pollute Object.prototype via __proto__ keys', () =>
    {
        // Arrange
        const marker = `__fuzz_${Date.now()}`;

        // Act
        QueryParser.parse( `__proto__[${marker}]=polluted` );
        QueryParser.parse( `constructor[prototype][${marker}]=polluted` );
        QueryParser.parse( `__proto__[K` );

        // Assert
        expect( Object.prototype ).not.toHaveProperty( marker );
        expect( Object.prototype ).not.toHaveProperty( 'K' );
        expect( QueryParser.parse( `__proto__=x` )).not.toHaveProperty( '__proto__' );
        expect( QueryParser.parse( `safe=1&__proto__[x]=2` )).toEqual({ safe : '1' });
    });

    it( 'should return ordinary objects (not null-prototype)', () =>
    {
        const result = QueryParser.parse( 'user[name]=Ada&tags[]=a' ) as any;

        expect( Object.getPrototypeOf( result )).toBe( Object.prototype );
        expect( result instanceof Object ).toBe( true );
        expect( Object.hasOwn( result, 'user' )).toBe( true );
        expect( Object.getPrototypeOf( result.user )).toBe( Object.prototype );
        expect( typeof result.hasOwnProperty ).toBe( 'function' );
    });
});
