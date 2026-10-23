import ts from 'typescript';

export const HTTP_METHOD_DECORATORS = ['Get', 'Post', 'Put', 'Delete', 'Patch', 'Head', 'Options', 'All', 'Ws', 'Sse', 'MessagePattern', 'EventPattern'];

export const PARAM_DECORATORS: Record<string, string> = {
    'Request'         : 'Request',
    'Headers'         : 'Headers',
    'Header'          : 'Header',
    'Ip'              : 'Ip',
    'Url'             : 'Url',
    'Hostname'        : 'Hostname',
    'Path'            : 'Path',
    'Param'           : 'Param',
    'Params'          : 'Param',
    'Query'           : 'Query',
    'Body'            : 'Body',
    'RawBody'         : 'RawBody',
    'BodyHash'        : 'BodyHash',
    'Ctx'             : 'Context',
    'Context'         : 'Context',
    'ConnectedSocket' : 'WebSocket',
    'Payload'         : 'Body',
    'Peer'            : 'Peer',
    'Cookies'         : 'Cookies',
    'Cookie'          : 'Cookie',
    'File'            : 'File',
    'Files'           : 'Files'
};

/**
 * Turn a decorator argument into the plain value the manifest should carry. Anything that
 * is not a literal is printed back to source and emitted verbatim as `__raw_code__`.
 */
export function parseExpression( expr: ts.Expression, sourceFile: ts.SourceFile ): any 
{
    if( ts.isStringLiteral( expr ) || ts.isNoSubstitutionTemplateLiteral( expr )) 
    {
        return expr.text;
    }

    if( ts.isNumericLiteral( expr )) 
    {
        return Number( expr.text );
    }

    if( expr.kind === ts.SyntaxKind.TrueKeyword ) 
    {
        return true;
    }

    if( expr.kind === ts.SyntaxKind.FalseKeyword ) 
    {
        return false;
    }

    if( expr.kind === ts.SyntaxKind.NullKeyword ) 
    {
        return null;
    }

    if( ts.isIdentifier( expr ) && expr.text === 'undefined' ) 
    {
        return undefined;
    }

    if( ts.isArrayLiteralExpression( expr )) 
    {
        return expr.elements.map( e => parseExpression( e, sourceFile ));
    }

    if( ts.isObjectLiteralExpression( expr )) 
    {
        const obj: Record<string, any> = {};

        for( const prop of expr.properties ) 
        {
            if( ts.isPropertyAssignment( prop )) 
            {
                const key = ts.isIdentifier( prop.name ) || ts.isStringLiteral( prop.name ) ? prop.name.text : prop.name.getText( sourceFile );
                obj[key] = parseExpression( prop.initializer, sourceFile );
            }
        }

        return obj;
    }
  
    // Print expression to code for other node types
    const printer = ts.createPrinter({ newLine : ts.NewLineKind.LineFeed });
    const code = printer.printNode( ts.EmitHint.Expression, expr, sourceFile );

    return { __raw_code__ : code };
}

/** Unwrapped expression of a decorator (`@Foo()` -> `Foo`, `@Foo` -> `Foo`). */
export function decoratorIdent( decorator: ts.Decorator ): ts.Expression
{
    const expr = decorator.expression;

    return ts.isCallExpression( expr ) ? expr.expression : expr;
}

/** Name of the decorator being applied, whether or not it is called. */
export function decoratorName( decorator: ts.Decorator ): string
{
    return decoratorIdent( decorator ).getText();
}

/** Find the first decorator whose unwrapped identifier matches `name`. */
export function findDecoratorNamed( decorators: readonly ts.Decorator[] | undefined, name: string ): ts.Decorator | null
{
    if( !decorators ){ return null }

    for( const d of decorators )
    {
        const ident = decoratorIdent( d );

        if( ts.isIdentifier( ident ) && ident.text === name )
        {
            return d;
        }
    }

    return null;
}

/** True when any decorator on the node matches `name` (either `@Name` or `@Name(...)`). */
export function hasDecoratorNamed( decorators: readonly ts.Decorator[] | undefined, name: string ): boolean
{
    return findDecoratorNamed( decorators, name ) !== null;
}

/**
 * `@Cors` / `@Security` share a shape: bare usage means "on with defaults" (`{}`), a call
 * with an argument carries the config, and absence means "inherit".
 */
function extractConfigDecorator( name: string, decorators: readonly ts.Decorator[] | undefined, sourceFile: ts.SourceFile ): any
{
    const d = findDecoratorNamed( decorators, name );

    if( !d ) { return undefined }

    if( ts.isCallExpression( d.expression ) && d.expression.arguments.length > 0 ) 
    {
        return parseExpression( d.expression.arguments[0], sourceFile );
    }

    return {};
}

export function extractCorsConfig( decorators: readonly ts.Decorator[] | undefined, sourceFile: ts.SourceFile ): any 
{
    return extractConfigDecorator( 'Cors', decorators, sourceFile );
}

export function extractSecurityConfig( decorators: readonly ts.Decorator[] | undefined, sourceFile: ts.SourceFile ): any 
{
    return extractConfigDecorator( 'Security', decorators, sourceFile );
}

/**
 * Collect `@File` config from class/method decorators.
 * - `@File({ dest })` → top-level options
 * - `@File('avatar', { maxFileSize })` → `fields.avatar`
 * Multiple decorators merge (fields deep-merged).
 */
export function extractFileConfig( decorators: readonly ts.Decorator[] | undefined, sourceFile: ts.SourceFile ): any
{
    if( !decorators ){ return undefined }

    let merged: any = undefined;

    for( const d of decorators )
    {
        const isCall = ts.isCallExpression( d.expression );
        const ident = isCall ? d.expression.expression : d.expression;

        if( !ts.isIdentifier( ident ) || ident.text !== 'File' ){ continue }

        if( !isCall )
        {
            merged = merged ? { ...merged } : {};

            continue;
        }

        const args = d.expression.arguments;

        if( args.length === 0 )
        {
            merged = merged ? { ...merged } : {};

            continue;
        }

        const first = parseExpression( args[0], sourceFile );

        if( typeof first === 'string' )
        {
            const fieldOpts = args.length > 1 ? parseExpression( args[1], sourceFile ) : {};
            merged = merged ? { ...merged } : {};
            merged.fields = { ...( merged.fields || {}), [first] : { ...( merged.fields?.[first] || {}), ...( fieldOpts || {}) } };
        }
        else if( first && typeof first === 'object' )
        {
            const fields =
            {
                ...( merged?.fields || {}),
                ...( first.fields || {})
            };

            if( merged?.fields && first.fields )
            {
                for( const key of Object.keys( first.fields ))
                {
                    fields[key] = { ...( merged.fields[key] || {}), ...first.fields[key] };
                }
            }

            merged =
            {
                ...( merged || {}),
                ...first,
                fields : Object.keys( fields ).length ? fields : undefined
            };
        }
    }

    return merged;
}

/**
 * `@Reviver(fn)` / `@Reviver(null)`. Later decorator wins.
 * Bare `@Reviver` / `@Reviver()` are invalid (diagnosed in the analyzer) and ignored here.
 */
export function extractReviver( decorators: readonly ts.Decorator[] | undefined, sourceFile: ts.SourceFile ): any
{
    if( !decorators ){ return undefined }

    let present = false;
    let value: any = undefined;

    for( const d of decorators )
    {
        if( !ts.isCallExpression( d.expression )){ continue }

        const ident = d.expression.expression;

        if( !ts.isIdentifier( ident ) || ident.text !== 'Reviver' ){ continue }

        if( d.expression.arguments.length === 0 ){ continue }

        present = true;
        value = parseExpression( d.expression.arguments[0], sourceFile );
    }

    return present ? value : undefined;
}

/** Later `@ResponseMode` wins, matching the original scan-to-the-end behaviour. */
export function extractResponseMode( decorators: readonly ts.Decorator[] | undefined ): string | undefined
{
    if( !decorators ) { return undefined }

    let mode: string | undefined;

    for( const d of decorators ) 
    {
        if( ts.isCallExpression( d.expression ) && d.expression.expression.getText() === 'ResponseMode' ) 
        {
            const arg = d.expression.arguments[0];

            if( arg && ts.isStringLiteral( arg )) 
            {
                mode = arg.text;
            }
        }
    }

    return mode;
}

/** `@Public` anywhere in the list drops every guard from the target. */
export function hasPublicDecorator( decorators: readonly ts.Decorator[] | undefined ): boolean
{
    if( !decorators ) { return false }

    for( const d of decorators )
    {
        if( d.expression.getText().includes( 'Public' )) { return true }
    }

    return false;
}

export function hasSeoDecorator( decorators: readonly ts.Decorator[] | undefined ): boolean
{
    return hasDecoratorNamed( decorators, 'Seo' );
}

export function hasInternalDecorator( decorators: readonly ts.Decorator[] | undefined ): boolean
{
    return hasDecoratorNamed( decorators, 'Internal' );
}

/** True when a class declaration implements an interface by name (e.g. `Guard` or `Interceptor`). */
export function classImplementsInterface( node: ts.ClassDeclaration, interfaceName: string ): boolean
{
    if( !node.heritageClauses ){ return false }

    for( const clause of node.heritageClauses )
    {
        if( clause.token !== ts.SyntaxKind.ImplementsKeyword ){ continue }

        for( const typeNode of clause.types )
        {
            const text = typeNode.expression.getText();

            if( text === interfaceName || text.endsWith( `.${interfaceName}` ))
            {
                return true;
            }
        }
    }

    return false;
}

/**
 * True when a class is a standalone Guard (`implements Guard` or has a `use` method with
 * parameter decorators) even if it omits `@Injectable()`.
 */
export function isStandaloneGuardClass( node: ts.ClassDeclaration ): boolean
{
    if( classImplementsInterface( node, 'Guard' ))
    {
        return true;
    }

    const useMethod = node.members.find(
        m => ts.isMethodDeclaration( m ) && m.name.getText() === 'use'
    ) as ts.MethodDeclaration | undefined;

    if( !useMethod ){ return false }

    for( const param of useMethod.parameters )
    {
        const decs = ts.getDecorators( param );

        if( decs && decs.length > 0 )
        {
            return true;
        }
    }

    return false;
}

/**
 * True when a class declaration carries a framework decorator (`@Controller`, `@Injectable`,
 * `@Module`) or is a standalone `Guard` / `Interceptor`.
 */
export function isRelevantSourceClass( node: ts.ClassDeclaration ): boolean
{
    const decorators = ts.getDecorators( node );

    if( decorators )
    {
        for( const d of decorators )
        {
            const text = d.expression.getText();

            if( text.includes( 'Controller' ) || text.includes( 'Injectable' ) || text.includes( 'Module' ))
            {
                return true;
            }
        }
    }

    return isStandaloneGuardClass( node ) || classImplementsInterface( node, 'Interceptor' );
}

