import { describe, it, expect } from 'vitest';
import {
    parse,
    pathCompiler,
    pathMatcher,
    pathToRE,
    PathError,
    TokenData
} from '../helpers/match.js';

describe( 'path match helpers', () =>
{
    describe( 'parse', () =>
    {
        it( 'should tokenize a static path', () =>
        {
            // Arrange / Act
            const tokens = parse( '/users/list' );

            // Assert
            expect( tokens ).toBeInstanceOf( TokenData );
            expect( tokens.tokens.length ).toBeGreaterThan( 0 );
        });

        it( 'should tokenize params and wildcards', () =>
        {
            // Arrange / Act
            const data = parse( '/files/:name/*path' );
            const names = data.tokens
                .flatMap( t => Array.isArray( t ) ? t : [t])
                .filter( t => typeof t === 'object' && t && 'name' in t )
                .map( t => ( t as { name: string }).name );

            // Assert
            expect( names ).toContain( 'name' );
            expect( names ).toContain( 'path' );
        });
    });

    describe( 'pathMatcher', () =>
    {
        it( 'should match static and parametric routes', () =>
        {
            // Arrange
            const matchUser = pathMatcher( '/users/:id' );

            // Act
            const hit = matchUser( '/users/42' );
            const miss = matchUser( '/posts/42' );

            // Assert
            expect( hit ).toEqual({ path : '/users/42', params : { id : '42' } });
            expect( miss ).toBe( false );
        });

        it( 'should honor end:false for prefix matches', () =>
        {
            // Arrange
            const match = pathMatcher( '/api', { end : false });

            // Act / Assert
            expect( match( '/api/v1' )).toBeTruthy();
        });

        it( 'should support decode:false', () =>
        {
            // Arrange
            const match = pathMatcher( '/q/:val', { decode : false });

            // Act
            const result = match( '/q/a%20b' );

            // Assert
            expect( result && result.params.val ).toBe( 'a%20b' );
        });
    });

    describe( 'pathCompiler', () =>
    {
        it( 'should compile paths with params', () =>
        {
            // Arrange
            const toPath = pathCompiler( '/users/:id' );

            // Act / Assert
            expect( toPath({ id : '7' })).toBe( '/users/7' );
        });

        it( 'should throw when required params are missing', () =>
        {
            // Arrange
            const toPath = pathCompiler( '/users/:id' );

            // Act / Assert
            expect( () => toPath({})).toThrow( /Missing parameters/ );
        });

        it( 'should accept TokenData input', () =>
        {
            // Arrange
            const data = parse( '/x/:id' );
            const toPath = pathCompiler( data );

            // Act / Assert
            expect( toPath({ id : 'a' })).toBe( '/x/a' );
        });
    });

    describe( 'pathToRE', () =>
    {
        it( 'should build a RegExp and keys list', () =>
        {
            // Arrange / Act
            const { regexp, keys } = pathToRE( '/items/:id' );

            // Assert
            expect( regexp.test( '/items/9' )).toBe( true );
            expect( keys.some( k => k.name === 'id' )).toBe( true );
        });

        it( 'should respect sensitive option', () =>
        {
            // Arrange
            const { regexp } = pathToRE( '/Case', { sensitive : true });

            // Act / Assert
            expect( regexp.test( '/Case' )).toBe( true );
            expect( regexp.test( '/case' )).toBe( false );
        });

        it( 'should accept an array of paths', () =>
        {
            // Arrange
            const { regexp } = pathToRE([ '/a', '/b/:id' ]);

            // Act / Assert
            expect( regexp.test( '/a' )).toBe( true );
            expect( regexp.test( '/b/1' )).toBe( true );
            expect( regexp.test( '/c' )).toBe( false );
        });

        it( 'should allow non-end matches', () =>
        {
            // Arrange
            const { regexp } = pathToRE( '/api', { end : false, trailing : false });

            // Act / Assert
            expect( regexp.test( '/api/extra' )).toBe( true );
        });
    });

    describe( 'optional groups and encoding', () =>
    {
        it( 'should match optional groups', () =>
        {
            // Arrange
            const match = pathMatcher( '/posts{/:slug}' );

            // Act / Assert
            expect( match( '/posts' )).toBeTruthy();
            expect( match( '/posts/hello' )).toEqual({
                path   : '/posts/hello',
                params : { slug : 'hello' }
            });
        });

        it( 'should compile with encode:false', () =>
        {
            // Arrange
            const toPath = pathCompiler( '/q/:val', { encode : false });

            // Act / Assert
            expect( toPath({ val : 'a/b' })).toBe( '/q/a/b' );
        });

        it( 'should match wildcards into arrays when decode is enabled', () =>
        {
            // Arrange
            const match = pathMatcher( '/files/*path' );

            // Act
            const result = match( '/files/a/b' );

            // Assert
            expect( result ).toBeTruthy();
            expect( result && result.params.path ).toEqual([ 'a', 'b' ]);
        });

        it( 'should throw PathError for unsafe params and malformed tokens', () =>
        {
            // Arrange / Act / Assert
            expect( () => pathToRE( '/:a:b' )).toThrow( PathError );
            expect( () => pathToRE( '/x/(unterminated' )).toThrow( PathError );
            expect( () => pathToRE( '/x/:' )).toThrow( PathError );
            expect( () => pathToRE( '/:"unterminated' )).toThrow( PathError );
            expect( () => pathToRE( '/x/{unterminated' )).toThrow( PathError );
            expect( () => pathToRE( '/:id(\\d' )).toThrow( PathError );
            expect( () => pathToRE( '/:id(\\' )).toThrow( PathError );
        });

        it( 'should support custom delimiters and nested path arrays', () =>
        {
            // Arrange
            const { regexp, keys } = pathToRE([[ '/a.:ext', '/b.:ext' ]], { delimiter : '.' });
            const match = pathMatcher( '/x.:ext', { delimiter : '.' });

            // Act / Assert
            expect( regexp.test( '/a.json' )).toBe( true );
            expect( keys.some( k => k.name === 'ext' )).toBe( true );
            expect( match( '/x.md' )).toEqual({ path : '/x.md', params : { ext : 'md' } });
        });

        it( 'should support custom param patterns', () =>
        {
            // Arrange
            const match = pathMatcher( '/id/:id(\\d+)' );

            // Act / Assert
            expect( match( '/id/12' )).toEqual({ path : '/id/12', params : { id : '12' } });
            expect( match( '/id/ab' )).toBe( false );
        });

        it( 'should compile optional groups and wildcards into paths', () =>
        {
            // Arrange
            const posts = pathCompiler( '/posts{/:slug}' );
            const files = pathCompiler( '/files/*path' );
            const id = pathCompiler( '/:id' );

            // Act / Assert
            expect( posts({})).toBe( '/posts' );
            expect( posts({ slug : 'x' })).toBe( '/posts/x' );
            expect( files({ path : [ 'a', 'b' ] })).toBe( '/files/a/b' );
            expect( () => files({})).toThrow( /path/ );
            expect( () => files({ path : [] })).toThrow( TypeError );
            expect( () => files({ path : [ 1 as any ] })).toThrow( TypeError );
            expect( () => id({ id : 1 as any })).toThrow( TypeError );
            expect( pathMatcher( '/a..:ext', { delimiter : '..' })( '/a..md' )).toEqual({
                path   : '/a..md',
                params : { ext : 'md' }
            });
            expect( pathToRE( '/:"qid"' ).keys[0]?.name ).toBe( 'qid' );
            expect( pathToRE( '/:"q\\"id"' ).keys[0]?.name ).toBe( 'q"id' );
        });

        it( 'should tokenize escapes and nested patterns with multi-char delimiters', () =>
        {
            // Arrange / Act — escapes collapse to text; nested () and multi-char delimiter hit negate()
            const escaped = parse( '/a\\:b' );
            const nested = pathToRE( '/id/:id((a|b))' );
            const multi = pathToRE( '/ab:id', { delimiter : '::' });
            const compiled = pathCompiler( '/file{.:ext}' );
            // Adjacent params with intervening text: backtrack.length >= 2 → negate branches 713-718
            const longBacktrack = pathToRE( '/:a-ab:b' );
            const longBacktrackDelim = pathToRE( '/:a-ab:b', { delimiter : '::' });

            // Assert
            expect( escaped.tokens ).toEqual([{ type : 'text', value : '/a:b' }]);
            expect( nested.regexp.test( '/id/a' )).toBe( true );
            expect( nested.keys[0]?.pattern ).toBe( '(a|b)' );
            expect( multi.regexp.test( '/ab1' )).toBe( true );
            expect( compiled({ ext : 'json' })).toBe( '/file.json' );
            expect( compiled({})).toBe( '/file' );
            expect( longBacktrack.keys.map( k => k.name )).toEqual([ 'a', 'b' ]);
            expect( longBacktrack.regexp.test( '/x-aby' )).toBe( true );
            expect( longBacktrackDelim.keys.map( k => k.name )).toEqual([ 'a', 'b' ]);
            expect( longBacktrackDelim.regexp.test( '/x-aby' )).toBe( true );
        });
    });
});
