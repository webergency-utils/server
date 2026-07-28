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
    'Ctx'             : 'Context',
    'Context'         : 'Context',
    'ConnectedSocket' : 'WebSocket',
    'Payload'         : 'Body',
    'Peer'            : 'Peer',
    'Cookies'         : 'Cookies',
    'Cookie'          : 'Cookie'
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

/** Name of the decorator being applied, whether or not it is called. */
export function decoratorName( decorator: ts.Decorator ): string
{
    const expr = decorator.expression;

    return ts.isCallExpression( expr ) ? expr.expression.getText() : expr.getText();
}

/**
 * `@Cors` / `@Security` share a shape: bare usage means "on with defaults" (`{}`), a call
 * with an argument carries the config, and absence means "inherit".
 */
function extractConfigDecorator( name: string, decorators: readonly ts.Decorator[] | undefined, sourceFile: ts.SourceFile ): any
{
    if( !decorators ) { return undefined }

    for( const d of decorators ) 
    {
        const matches =
            ( ts.isCallExpression( d.expression ) && ts.isIdentifier( d.expression.expression ) && d.expression.expression.text === name ) ||
            ( ts.isIdentifier( d.expression ) && d.expression.text === name );

        if( matches ) 
        {
            if( ts.isCallExpression( d.expression ) && d.expression.arguments.length > 0 ) 
            {
                return parseExpression( d.expression.arguments[0], sourceFile );
            }

            return {};
        }
    }

    return undefined;
}

export function extractCorsConfig( decorators: readonly ts.Decorator[] | undefined, sourceFile: ts.SourceFile ): any 
{
    return extractConfigDecorator( 'Cors', decorators, sourceFile );
}

export function extractSecurityConfig( decorators: readonly ts.Decorator[] | undefined, sourceFile: ts.SourceFile ): any 
{
    return extractConfigDecorator( 'Security', decorators, sourceFile );
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
