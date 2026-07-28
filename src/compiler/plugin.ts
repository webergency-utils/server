import ts from 'typescript';
import { ProjectRegistry, createRegistry } from './registry.js';
import { transformer } from './endpoint-analyzer.js';
import { objectToExpression } from './manifest.js';
import { DiagnosticReporter, DiagnosticSink } from './diagnostics.js';

const symbolAssign = ( className: string, symbolKey: string, value: ts.Expression ): ts.Statement =>
    ts.factory.createExpressionStatement(
        ts.factory.createBinaryExpression(
            ts.factory.createElementAccessExpression(
                ts.factory.createIdentifier( className ),
                ts.factory.createCallExpression(
                    ts.factory.createPropertyAccessExpression(
                        ts.factory.createIdentifier( 'Symbol' ),
                        'for'
                    ),
                    undefined,
                    [ts.factory.createStringLiteral( symbolKey )]
                )
            ),
            ts.SyntaxKind.EqualsToken,
            value
        )
    );

const injectableMeta = ( kind: string, token: string ): ts.Expression =>
    ts.factory.createObjectLiteralExpression([
        ts.factory.createPropertyAssignment( 'kind', ts.factory.createStringLiteral( kind )),
        ts.factory.createPropertyAssignment( 'token', ts.factory.createStringLiteral( token ))
    ], true );

/**
 * The registry is program-wide, so a file must only declare the validators its own
 * endpoints reach — otherwise every file would carry every validator in the program.
 * Nested validators are referenced as `__val_<hash>` inside each expression, so the set is
 * closed transitively.
 */
function neededValidators( endpoints: readonly any[], validators: Map<string, ts.Expression> ): Set<string>
{
    const needed = new Set<string>();
    const queue: string[] = [];

    const request = ( hash: unknown ) =>
    {
        if( typeof hash !== 'string' || hash === '' || needed.has( hash )) { return }

        if( !validators.has( hash )) { return }
        needed.add( hash );
        queue.push( hash );
    };

    const scanMetadata = ( value: any ) =>
    {
        if( !value || typeof value !== 'object' ) { return }

        if( Array.isArray( value ))
        {
            for( const item of value ) { scanMetadata( item ) }

            return;
        }

        for( const [ key, nested ] of Object.entries( value ))
        {
            if( key === 'validator' || key === 'returnTypeValidator' ) { request( nested ) }
            else { scanMetadata( nested ) }
        }
    };

    for( const endpoint of endpoints ) { scanMetadata( endpoint ) }

    while( queue.length > 0 )
    {
        const expression = validators.get( queue.pop()! )!;
        const walk = ( node: ts.Node ) =>
        {
            if( ts.isIdentifier( node ) && node.text.startsWith( '__val_' )) { request( node.text.slice( 6 )) }
            ts.forEachChild( node, walk );
        };
        walk( expression );
    }

    return needed;
}

/** Validators are emitted as file-local `const __val_<hash>`, so imports come first. */
function validatorPrepends( registry: ProjectRegistry, needed: Set<string>, existing: readonly ts.Statement[]): ts.Statement[]
{
    const prepends: ts.Statement[] = [];

    if( needed.size === 0 ) { return prepends }

    if( !hasNamespaceImport( existing, '__tcRuntime', '@webergency-utils/typechecker/runtime' ))
    {
        prepends.push(
            ts.factory.createImportDeclaration(
                undefined,
                ts.factory.createImportClause(
                    false,
                    undefined,
                    ts.factory.createNamespaceImport( ts.factory.createIdentifier( '__tcRuntime' ))
                ),
                ts.factory.createStringLiteral( '@webergency-utils/typechecker/runtime' ),
                undefined
            )
        );
    }

    if( !hasVariableDeclaration( existing, 'validators' ) && !hasVariableDeclaration( prepends, 'validators' ))
    {
        prepends.push(
            ts.factory.createVariableStatement(
                undefined,
                ts.factory.createVariableDeclarationList([
                    ts.factory.createVariableDeclaration(
                        ts.factory.createIdentifier( 'validators' ),
                        undefined,
                        undefined,
                        ts.factory.createPropertyAccessExpression(
                            ts.factory.createIdentifier( '__tcRuntime' ),
                            'validators'
                        )
                    )
                ], ts.NodeFlags.Const )
            )
        );
    }

    for( const [ hash, expr ] of registry.validators.entries())
    {
        if( !needed.has( hash )) { continue }

        if( !hasVariableDeclaration( existing, `__val_${hash}` ) && !hasVariableDeclaration( prepends, `__val_${hash}` ))
        {
            prepends.push(
                ts.factory.createVariableStatement(
                    undefined,
                    ts.factory.createVariableDeclarationList([
                        ts.factory.createVariableDeclaration(
                            ts.factory.createIdentifier( `__val_${hash}` ),
                            undefined,
                            undefined,
                            expr
                        )
                    ], ts.NodeFlags.Const )
                )
            );
        }
    }

    return prepends;
}

/**
 * The AOT emit: `Symbol.for( 'webergency.server.*' )` metadata written onto every class the
 * analysis pass recognised, so the runtime needs no reflection and no decorator side effects.
 */
function metadataAppends( registry: ProjectRegistry, fileName: string, fileEndpoints: readonly any[]): ts.Statement[]
{
    const appends: ts.Statement[] = [];
    const endpointsByController = new Map<string, any[]>();

    for( const ep of fileEndpoints )
    {
        const list = endpointsByController.get( ep.controller ) || [];
        list.push( ep );
        endpointsByController.set( ep.controller, list );
    }

    for( const [name, info] of registry.guards.entries())
    {
        if( info.path !== fileName ){ continue }
        appends.push( symbolAssign( name, 'webergency.server.injectable', injectableMeta( 'guard', name )));
    }

    for( const [name, info] of registry.interceptors.entries())
    {
        if( info.path !== fileName ){ continue }
        appends.push( symbolAssign( name, 'webergency.server.injectable', injectableMeta( 'interceptor', name )));
    }

    for( const [name, info] of registry.providers.entries())
    {
        if( info.path !== fileName ){ continue }

        if( registry.controllers.has( name ) || registry.guards.has( name ) || registry.interceptors.has( name ))
        {
            continue;
        }
        appends.push( symbolAssign( name, 'webergency.server.injectable', injectableMeta( 'provider', name )));
    }

    for( const [name, info] of registry.controllers.entries())
    {
        if( info.path !== fileName ){ continue }
        const endpoints = endpointsByController.get( name ) || [];
        appends.push(
            symbolAssign(
                name,
                'webergency.server.controller',
                ts.factory.createObjectLiteralExpression([
                    ts.factory.createPropertyAssignment(
                        'endpoints',
                        ts.factory.createArrayLiteralExpression(
                            endpoints.map( ep => objectToExpression( ep )),
                            true
                        )
                    )
                ], true )
            )
        );
        appends.push( symbolAssign( name, 'webergency.server.injectable', injectableMeta( 'controller', name )));
    }

    // Modules: mirror runtime @Module() into Symbol.for so published dist does not rely on decorator side-effects alone
    for( const [name, info] of registry.modules.entries())
    {
        if( info.path !== fileName ){ continue }
        appends.push(
            ts.factory.createExpressionStatement(
                ts.factory.createBinaryExpression(
                    ts.factory.createElementAccessExpression(
                        ts.factory.createIdentifier( name ),
                        ts.factory.createCallExpression(
                            ts.factory.createPropertyAccessExpression(
                                ts.factory.createIdentifier( 'Symbol' ),
                                'for'
                            ),
                            undefined,
                            [ts.factory.createStringLiteral( 'webergency.server.module' )]
                        )
                    ),
                    ts.SyntaxKind.EqualsToken,
                    ts.factory.createBinaryExpression(
                        ts.factory.createPropertyAccessExpression(
                            ts.factory.createIdentifier( name ),
                            '__moduleMetadata__'
                        ),
                        ts.SyntaxKind.BarBarToken,
                        ts.factory.createObjectLiteralExpression([])
                    )
                )
            )
        );
    }

    return appends;
}

/** What ts-patch hands a plugin as its fourth argument; only the sink matters here. */
export interface PluginExtras {
    addDiagnostic? : DiagnosticSink
}

interface ProgramAnalysis {
    registry        : ProjectRegistry
    /** Endpoints contributed by each file, so a re-transform replaces rather than appends. */
    endpointsByFile : Map<string, any[]>
}

/**
 * One registry per program instead of per file: a type shared by two controllers is hashed
 * and built once, and provider discovery no longer depends on which file compiles first.
 * Emission stays per file because controller modules cannot import validators from each
 * other without risking cycles between them.
 */
const analyses = new WeakMap<ts.Program, ProgramAnalysis>();

function analysisFor( program: ts.Program ): ProgramAnalysis
{
    let analysis = analyses.get( program );

    if( !analysis )
    {
        analysis = { registry : createRegistry(), endpointsByFile : new Map() };
        analyses.set( program, analysis );
    }

    return analysis;
}

/**
 * @param pluginConfig ts-patch passes its `{ transform: ... }` entry here; unused.
 * @param extras when the host supports it, decorator problems are reported as diagnostics
 *        instead of thrown, so a build shows `error TS90001` and exits non-zero like tsc.
 */
export default function compilerPlugin( program: ts.Program, pluginConfig?: unknown, extras?: PluginExtras ) 
{
    // Binding the program sets node parent pointers, without which node.getText() below
    // cannot reach its source file.
    program.getTypeChecker();

    return ( context: ts.TransformationContext ) => 
    {
        return ( sourceFile: ts.SourceFile ) => 
        {
            // 1. Check if the file has any class with a @Controller or @Injectable decorator
            let shouldProcess = false;
            const checkNode = ( node: ts.Node ) => 
            {
                if( ts.isClassDeclaration( node )) 
                {
                    const decorators = ts.getDecorators( node );

                    if( decorators ) 
                    {
                        for( const d of decorators ) 
                        {
                            const text = d.expression.getText();

                            if( text.includes( 'Controller' ) || text.includes( 'Injectable' ) || text.includes( 'Module' )) 
                            {
                                shouldProcess = true;
                                break;
                            }
                        }
                    }
                }

                if( !shouldProcess ) 
                {
                    ts.forEachChild( node, checkNode );
                }
            };
            checkNode( sourceFile );

            if( !shouldProcess ) 
            {
                return sourceFile;
            }

            // 2. Run our standard analysis transformer on this file to collect all endpoints and validators
            const { registry, endpointsByFile } = analysisFor( program );
            const previous = endpointsByFile.get( sourceFile.fileName );

            if( previous )
            {
                // Transforming the same file twice under one program must not double its endpoints.
                const stale = new Set( previous );
                registry.endpoints = registry.endpoints.filter( ep => !stale.has( ep ));
            }

            const firstEndpoint = registry.endpoints.length;
            const diagnostics = new DiagnosticReporter( extras?.addDiagnostic );
            const runTransform = transformer( program, registry, diagnostics )( context );
            const transformedSourceFile = runTransform( sourceFile );

            diagnostics.throwIfErrors();

            const fileEndpoints = registry.endpoints.slice( firstEndpoint );
            endpointsByFile.set( sourceFile.fileName, fileEndpoints );

            // 3. Emit Symbol.for AOT meta on classes (no process-global registry)
            const needed = neededValidators( fileEndpoints, registry.validators );
            const prepends = validatorPrepends( registry, needed, transformedSourceFile.statements );
            const appends = metadataAppends( registry, sourceFile.fileName, fileEndpoints );

            const mergedStatements = [...prepends, ...transformedSourceFile.statements];
            const insertIndex = findInsertionIndex( mergedStatements );

            const finalStatements = [
                ...mergedStatements.slice( 0, insertIndex ),
                ...appends,
                ...mergedStatements.slice( insertIndex )
            ];

            return ts.factory.updateSourceFile( transformedSourceFile, finalStatements );
        };
    };
}

/** Metadata assignments go after the last class declaration but before runtime statements. */
function findInsertionIndex( statements: readonly ts.Statement[]): number 
{
    let lastClassIndex = -1;

    for( let i = 0; i < statements.length; i++ ) 
    {
        if( ts.isClassDeclaration( statements[i])) 
        {
            lastClassIndex = i;
        }
    }

    const startIndex = lastClassIndex !== -1 ? lastClassIndex + 1 : 0;

    for( let i = startIndex; i < statements.length; i++ ) 
    {
        const s = statements[i];

        if( ts.isImportDeclaration( s ) || ts.isInterfaceDeclaration( s ) || ts.isTypeAliasDeclaration( s )) 
        {
            continue;
        }

        if( ts.isVariableStatement( s )) 
        {
            let isPrependedVar = true;

            for( const decl of s.declarationList.declarations ) 
            {
                if( ts.isIdentifier( decl.name )) 
                {
                    const text = decl.name.text;

                    if( text !== 'validators' && text !== 'MetadataStore' && text !== '__server_metadata_store' && !text.startsWith( '__val_' )) 
                    {
                        isPrependedVar = false;
                        break;
                    }
                }
                else 
                {
                    isPrependedVar = false;
                    break;
                }
            }

            if( isPrependedVar ) 
            {
                continue;
            }
        }

        return i;
    }

    return statements.length;
}

function hasVariableDeclaration( statements: readonly ts.Statement[], name: string ): boolean 
{
    for( const statement of statements ) 
    {
        if( ts.isVariableStatement( statement )) 
        {
            for( const decl of statement.declarationList.declarations ) 
            {
                if( ts.isIdentifier( decl.name ) && decl.name.text === name ) 
                {
                    return true;
                }
            }
        }
    }

    return false;
}

function hasNamespaceImport( statements: readonly ts.Statement[], name: string, moduleName: string ): boolean
{
    for( const statement of statements )
    {
        if( !ts.isImportDeclaration( statement )){ continue }

        if( !ts.isStringLiteral( statement.moduleSpecifier )){ continue }

        if( statement.moduleSpecifier.text !== moduleName ){ continue }

        const bindings = statement.importClause?.namedBindings;

        if( bindings && ts.isNamespaceImport( bindings ) && bindings.name.text === name )
        {
            return true;
        }
    }

    return false;
}
