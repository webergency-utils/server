import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import
{
    HTTP_METHOD_DECORATORS,
    PARAM_DECORATORS,
    parseExpression,
    decoratorName,
    extractCorsConfig,
    extractSecurityConfig,
    extractFileConfig,
    extractResponseMode,
    hasPublicDecorator,
    hasSeoDecorator,
    hasInternalDecorator
}
from '../src/compiler/decorator-config.js';

function parseSource( source: string )
{
    return ts.createSourceFile( 'fixture.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS );
}

function classDecorators( source: string )
{
    const sourceFile = parseSource( source );
    let classDecl: ts.ClassDeclaration | undefined;

    ts.forEachChild( sourceFile, ( node ) =>
    {
        if( ts.isClassDeclaration( node ))
        {
            classDecl = node;
        }
    });

    return { decorators : ts.getDecorators( classDecl! ), sourceFile };
}

function methodDecorators( source: string )
{
    const sourceFile = parseSource( source );
    let method: ts.MethodDeclaration | undefined;

    ts.forEachChild( sourceFile, ( node ) =>
    {
        if( ts.isClassDeclaration( node ))
        {
            for( const member of node.members )
            {
                if( ts.isMethodDeclaration( member ))
                {
                    method = member;
                }
            }
        }
    });

    return { decorators : ts.getDecorators( method! ), sourceFile };
}

function firstArgExpression( source: string ): { expr: ts.Expression, sourceFile: ts.SourceFile }
{
    const sourceFile = parseSource( `const x = ${source};` );
    let expr: ts.Expression | undefined;

    ts.forEachChild( sourceFile, ( node ) =>
    {
        if( ts.isVariableStatement( node ))
        {
            const init = node.declarationList.declarations[0].initializer;

            if( init )
            {
                expr = init;
            }
        }
    });

    return { expr : expr!, sourceFile };
}

describe( 'decorator-config constants', () =>
{
    it( 'should expose HTTP method and param decorator maps', () =>
    {
        // Assert
        expect( HTTP_METHOD_DECORATORS ).toContain( 'Get' );
        expect( HTTP_METHOD_DECORATORS ).toContain( 'Ws' );
        expect( PARAM_DECORATORS.Request ).toBe( 'Request' );
        expect( PARAM_DECORATORS.File ).toBe( 'File' );
        expect( PARAM_DECORATORS.Ctx ).toBe( 'Context' );
    });
});

describe( 'parseExpression', () =>
{
    it( 'should parse literals, arrays, objects, and raw code', () =>
    {
        // Arrange / Act / Assert
        expect( parseExpression( firstArgExpression( "'hi'" ).expr, firstArgExpression( "'hi'" ).sourceFile )).toBe( 'hi' );
        expect( parseExpression( firstArgExpression( '`tpl`' ).expr, firstArgExpression( '`tpl`' ).sourceFile )).toBe( 'tpl' );
        expect( parseExpression( firstArgExpression( '42' ).expr, firstArgExpression( '42' ).sourceFile )).toBe( 42 );
        expect( parseExpression( firstArgExpression( 'true' ).expr, firstArgExpression( 'true' ).sourceFile )).toBe( true );
        expect( parseExpression( firstArgExpression( 'false' ).expr, firstArgExpression( 'false' ).sourceFile )).toBe( false );
        expect( parseExpression( firstArgExpression( 'null' ).expr, firstArgExpression( 'null' ).sourceFile )).toBeNull();
        expect( parseExpression( firstArgExpression( 'undefined' ).expr, firstArgExpression( 'undefined' ).sourceFile )).toBeUndefined();
        expect( parseExpression( firstArgExpression( '[1, "a"]' ).expr, firstArgExpression( '[1, "a"]' ).sourceFile )).toEqual([ 1, 'a' ]);

        const obj = firstArgExpression( '{ a: 1, "b": true, [c]: 2 }' );
        const parsed = parseExpression( obj.expr, obj.sourceFile );

        expect( parsed.a ).toBe( 1 );
        expect( parsed.b ).toBe( true );
        expect( parsed.c || parsed['[c]'] || Object.values( parsed ).some( v => v === 2 )).toBeTruthy();

        const raw = firstArgExpression( 'Date.now()' );
        expect( parseExpression( raw.expr, raw.sourceFile )).toEqual({ __raw_code__ : 'Date.now()' });
    });
});

describe( 'decoratorName', () =>
{
    it( 'should read bare and call-expression decorator names', () =>
    {
        // Arrange
        const bare = classDecorators( '@Public class C {}' );
        const call = classDecorators( '@Cors({ origin: true }) class C {}' );

        // Act / Assert
        expect( decoratorName( bare.decorators![0])).toBe( 'Public' );
        expect( decoratorName( call.decorators![0])).toBe( 'Cors' );
    });
});

describe( 'extractCorsConfig / extractSecurityConfig', () =>
{
    it( 'should return undefined without decorators and parse bare / argued forms', () =>
    {
        // Assert
        expect( extractCorsConfig( undefined, parseSource( '' ))).toBeUndefined();
        expect( extractSecurityConfig( undefined, parseSource( '' ))).toBeUndefined();

        // Arrange
        const bare = classDecorators( '@Cors @Security class C {}' );
        const argued = classDecorators( '@Cors({ origin: "*" }) @Security({ maxBodySize: "1mb" }) class C {}' );

        // Act / Assert
        expect( extractCorsConfig( bare.decorators, bare.sourceFile )).toEqual({});
        expect( extractSecurityConfig( bare.decorators, bare.sourceFile )).toEqual({});
        expect( extractCorsConfig( argued.decorators, argued.sourceFile )).toEqual({ origin : '*' });
        expect( extractSecurityConfig( argued.decorators, argued.sourceFile )).toEqual({ maxBodySize : '1mb' });
    });
});

describe( 'extractFileConfig', () =>
{
    it( 'should return undefined without decorators', () =>
    {
        // Assert
        expect( extractFileConfig( undefined, parseSource( '' ))).toBeUndefined();
    });

    it( 'should treat bare @File and @File() as empty options', () =>
    {
        // Arrange
        const bare = classDecorators( '@File class C {}' );
        const emptyCall = classDecorators( '@File() class C {}' );

        // Act / Assert
        expect( extractFileConfig( bare.decorators, bare.sourceFile )).toEqual({});
        expect( extractFileConfig( emptyCall.decorators, emptyCall.sourceFile )).toEqual({});
    });

    it( 'should map @File field name and options into fields', () =>
    {
        // Arrange
        const named = classDecorators( `@File('avatar') class C {}` );
        const withOpts = classDecorators( `@File('avatar', { maxFileSize: '2mb' }) class C {}` );

        // Act
        const a = extractFileConfig( named.decorators, named.sourceFile );
        const b = extractFileConfig( withOpts.decorators, withOpts.sourceFile );

        // Assert
        expect( a ).toEqual({ fields : { avatar : {} } });
        expect( b ).toEqual({ fields : { avatar : { maxFileSize : '2mb' } } });
    });

    it( 'should merge object configs and deep-merge fields across decorators', () =>
    {
        // Arrange
        const source = `
@File({ dest: '/a', fields: { avatar: { maxFileSize: '1mb' } } })
@File({ maxFiles: 3, fields: { avatar: { dest: '/avatars' }, doc: { keepExtensions: false } } })
@File('extra', { maxFileSize: '5mb' })
class C {}
`;
        const { decorators, sourceFile } = classDecorators( source );

        // Act
        const merged = extractFileConfig( decorators, sourceFile );

        // Assert
        expect( merged.dest ).toBe( '/a' );
        expect( merged.maxFiles ).toBe( 3 );
        expect( merged.fields.avatar ).toEqual({ maxFileSize : '1mb', dest : '/avatars' });
        expect( merged.fields.doc ).toEqual({ keepExtensions : false });
        expect( merged.fields.extra ).toEqual({ maxFileSize : '5mb' });
    });

    it( 'should keep prior merge when bare @File follows an object config', () =>
    {
        // Arrange
        const source = `
@File({ dest: '/keep' })
@File
@File()
class C {}
`;
        const { decorators, sourceFile } = classDecorators( source );

        // Act
        const merged = extractFileConfig( decorators, sourceFile );

        // Assert
        expect( merged ).toEqual({ dest : '/keep' });
    });
});

describe( 'extractResponseMode', () =>
{
    it( 'should return undefined without decorators and prefer the last ResponseMode', () =>
    {
        // Assert
        expect( extractResponseMode( undefined )).toBeUndefined();

        // Arrange
        const { decorators } = methodDecorators( `
class C {
  @ResponseMode('raw')
  @ResponseMode('stream')
  h() {}
}
` );

        // Act / Assert
        expect( extractResponseMode( decorators )).toBe( 'stream' );
    });
});

describe( 'hasPublicDecorator / hasSeoDecorator / hasInternalDecorator', () =>
{
    it( 'should return false without decorators and detect named forms', () =>
    {
        // Assert
        expect( hasPublicDecorator( undefined )).toBe( false );
        expect( hasSeoDecorator( undefined )).toBe( false );
        expect( hasInternalDecorator( undefined )).toBe( false );

        // Arrange
        const flags = classDecorators( '@Public @Seo @Internal() class C {}' );

        // Act / Assert
        expect( hasPublicDecorator( flags.decorators )).toBe( true );
        expect( hasSeoDecorator( flags.decorators )).toBe( true );
        expect( hasInternalDecorator( flags.decorators )).toBe( true );

        const none = classDecorators( '@Cors class C {}' );

        expect( hasPublicDecorator( none.decorators )).toBe( false );
        expect( hasSeoDecorator( none.decorators )).toBe( false );
        expect( hasInternalDecorator( none.decorators )).toBe( false );
    });
});
