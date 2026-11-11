import ts from 'typescript';
import { hasDecoratorNamed, isStandaloneGuardClass, classImplementsInterface } from './decorator-config.js';

export function getBaseClass( classDecl: ts.ClassDeclaration, checker: ts.TypeChecker ): ts.ClassDeclaration | null 
{
    if( !classDecl.heritageClauses ) { return null }

    for( const clause of classDecl.heritageClauses ) 
    {
        if( clause.token === ts.SyntaxKind.ExtendsKeyword ) 
        {
            const typeNode = clause.types[0];

            if( typeNode ) 
            {
                const type = checker.getTypeAtLocation( typeNode );
                const symbol = type.getSymbol() || type.aliasSymbol;
                const decl = symbol?.valueDeclaration || symbol?.declarations?.[0];

                if( decl && ts.isClassDeclaration( decl )) 
                {
                    return decl;
                }
            }
        }
    }

    return null;
}

/** Resolves a parameter or property type symbol/AST node to a non-primitive DI token name. Handles default imports & aliased symbols. */
export function resolveTokenFromType( typeNode: ts.TypeNode | undefined, type: ts.Type, checker: ts.TypeChecker ): string | null
{
    let symbol = type.getSymbol() || type.aliasSymbol;

    if( !symbol && typeNode ) 
    {
        symbol = checker.getSymbolAtLocation( typeNode );
    }

    let name: string | undefined;

    if( symbol ) 
    {
        let targetSymbol = symbol;

        if( targetSymbol.flags & ts.SymbolFlags.Alias ) 
        {
            try 
            {
                const aliased = checker.getAliasedSymbol( targetSymbol );

                if( aliased ) { targetSymbol = aliased }
            }
            catch{}
        }

        name = targetSymbol.getName();

        if( name === 'default' ) 
        {
            const decl = targetSymbol.valueDeclaration || targetSymbol.declarations?.[0] || symbol.valueDeclaration || symbol.declarations?.[0];

            if( decl && ts.isClassDeclaration( decl ) && decl.name ) 
            {
                name = decl.name.text;
            }
        }
    }

    if(( !name || name === 'default' ) && typeNode && ts.isTypeReferenceNode( typeNode )) 
    {
        const typeNameText = typeNode.typeName.getText();

        if( typeNameText && typeNameText !== 'default' ) 
        {
            name = typeNameText;
        }
    }

    const primitives = ['Object', 'Function', 'String', 'Number', 'Boolean', 'any', 'unknown', 'never', 'default'];

    if( name && !primitives.includes( name )) 
    {
        return name;
    }

    return null;
}

/**
 * Resolves an explicit `@Inject(...)` argument expression to a canonical DI token string.
 * Imported/aliased class identifiers resolve to the target class declaration's own name so
 * they match bootstrap registration (`import { DbService as Db } from ...` -> `'DbService'`).
 */
export function resolveInjectArgToken( arg: ts.Expression, checker: ts.TypeChecker ): string
{
    if( ts.isStringLiteral( arg ) || ts.isNoSubstitutionTemplateLiteral( arg ))
    {
        return arg.text;
    }

    if( ts.isIdentifier( arg ))
    {
        let symbol = checker.getSymbolAtLocation( arg );

        if( symbol && ( symbol.flags & ts.SymbolFlags.Alias ))
        {
            try
            {
                const aliased = checker.getAliasedSymbol( symbol );

                if( aliased ) { symbol = aliased }
            }
            catch{}
        }

        const decl = symbol?.valueDeclaration || symbol?.declarations?.[0];

        if( decl && ts.isClassDeclaration( decl ) && decl.name )
        {
            return decl.name.text;
        }

        return arg.text;
    }

    return arg.getText();
}

/**
 * True when a parameter's type resolves to a class decorated with `@Injectable` / `@Controller`
 * or implementing `Guard` / `Interceptor` / `Middleware` — independent of file compilation order.
 */
export function isInjectableTypeSymbol( typeNode: ts.TypeNode | undefined, type: ts.Type, checker: ts.TypeChecker ): boolean
{
    let symbol = type.getSymbol() || type.aliasSymbol;

    if( !symbol && typeNode )
    {
        symbol = checker.getSymbolAtLocation( typeNode );
    }

    if( !symbol ) { return false }

    if( symbol.flags & ts.SymbolFlags.Alias )
    {
        try
        {
            const aliased = checker.getAliasedSymbol( symbol );

            if( aliased ) { symbol = aliased }
        }
        catch{}
    }

    const decl = symbol.valueDeclaration || symbol.declarations?.[0];

    if( !decl || !ts.isClassDeclaration( decl )) { return false }

    const decs = ts.getDecorators( decl );

    return hasDecoratorNamed( decs, 'Injectable' )
        || hasDecoratorNamed( decs, 'Controller' )
        || isStandaloneGuardClass( decl )
        || classImplementsInterface( decl, 'Interceptor' )
        || classImplementsInterface( decl, 'Middleware' );
}

/** `@Inject( 'Token' )` wins; otherwise the parameter type name is the token. */
function resolveParamInjectionToken( param: ts.ParameterDeclaration, checker: ts.TypeChecker ): string 
{
    const decorators = ts.getDecorators( param );

    if( decorators ) 
    {
        for( const dec of decorators ) 
        {
            const expr = dec.expression;
            const ident = ts.isCallExpression( expr ) ? expr.expression : expr;

            if( ts.isIdentifier( ident ) && ident.text === 'Inject' ) 
            {
                if( ts.isCallExpression( expr ) && expr.arguments.length > 0 ) 
                {
                    return resolveInjectArgToken( expr.arguments[0], checker );
                }
            }
        }
    }

    // Fallback to type
    if( param.type ) 
    {
        const type = checker.getTypeAtLocation( param );
        const token = resolveTokenFromType( param.type, type, checker );

        if( token ) { return token }
    }

    return 'any';
}

function resolveConstructorDeps( constructorDecl: ts.ConstructorDeclaration, checker: ts.TypeChecker ): string[] 
{
    return constructorDecl.parameters.map( param => resolveParamInjectionToken( param, checker ));
}

/** A class without its own constructor inherits the base class dependency list. */
export function findConstructorDeps( classDecl: ts.ClassDeclaration, checker: ts.TypeChecker ): string[] | undefined 
{
    const constructorDecl = classDecl.members.find( ts.isConstructorDeclaration );

    if( constructorDecl ) 
    {
        return resolveConstructorDeps( constructorDecl, checker );
    }
    const baseClass = getBaseClass( classDecl, checker );

    if( baseClass ) 
    {
        return findConstructorDeps( baseClass, checker );
    }

    return undefined;
}

function extractPropertyKeyName( name: ts.PropertyName ): string | null
{
    if( ts.isIdentifier( name ) || ts.isStringLiteral( name ) || ts.isNumericLiteral( name ))
    {
        return name.text;
    }

    if( ts.isComputedPropertyName( name ))
    {
        const expr = name.expression;

        if( ts.isStringLiteral( expr ) || ts.isNoSubstitutionTemplateLiteral( expr ) || ts.isNumericLiteral( expr ))
        {
            return expr.text;
        }
    }

    return null;
}

export function resolvePropertyDeps( classDecl: ts.ClassDeclaration, checker: ts.TypeChecker ): Record<string, string> 
{
    const deps: Record<string, string> = {};

    for( const member of classDecl.members ) 
    {
        if( ts.isPropertyDeclaration( member ) && member.name ) 
        {
            const propName = extractPropertyKeyName( member.name );

            if( !propName ) { continue }

            const decorators = ts.getDecorators( member );

            if( decorators ) 
            {
                for( const dec of decorators ) 
                {
                    const expr = dec.expression;
                    const ident = ts.isCallExpression( expr ) ? expr.expression : expr;

                    if( ts.isIdentifier( ident ) && ident.text === 'Inject' ) 
                    {
                        let token: string | undefined;

                        if( ts.isCallExpression( expr ) && expr.arguments.length > 0 ) 
                        {
                            token = resolveInjectArgToken( expr.arguments[0], checker );
                        }

                        if( !token && member.type ) 
                        {
                            const type = checker.getTypeAtLocation( member );
                            const resolved = resolveTokenFromType( member.type, type, checker );

                            if( resolved ) { token = resolved }
                        }

                        if( token ) 
                        {
                            deps[propName] = token;
                        }
                    }
                }
            }
        }
    }

    return deps;
}
