import ts from 'typescript';

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
                    const arg = expr.arguments[0];

                    if( ts.isStringLiteral( arg )) { return arg.text }

                    if( ts.isIdentifier( arg )) { return arg.text }

                    return arg.getText();
                }
            }
        }
    }

    // Fallback to type
    if( param.type ) 
    {
        const type = checker.getTypeAtLocation( param );
        const symbol = type.getSymbol() || type.aliasSymbol;

        if( symbol ) 
        {
            const name = symbol.getName();
            const primitives = ['Object', 'Function', 'String', 'Number', 'Boolean', 'any', 'unknown', 'never'];

            if( !primitives.includes( name )) 
            {
                return name;
            }
        }
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

export function resolvePropertyDeps( classDecl: ts.ClassDeclaration, checker: ts.TypeChecker ): Record<string, string> 
{
    const deps: Record<string, string> = {};

    for( const member of classDecl.members ) 
    {
        if( ts.isPropertyDeclaration( member ) && member.name ) 
        {
            const propName = member.name.getText();
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
                            const arg = expr.arguments[0];

                            if( ts.isStringLiteral( arg )) { token = arg.text }
                            else if( ts.isIdentifier( arg )) { token = arg.text }
                            else { token = arg.getText() }
                        }

                        if( !token && member.type ) 
                        {
                            const type = checker.getTypeAtLocation( member );
                            const symbol = type.getSymbol() || type.aliasSymbol;

                            if( symbol ) 
                            {
                                token = symbol.getName();
                            }
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
