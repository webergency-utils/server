import ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';
import { ProjectRegistry } from './registry.js';
import { DiagnosticReporter, DiagnosticCode } from './diagnostics.js';

function recordDiscoveredClass<T extends { path : string }>(
    map: Map<string, T>,
    entry: T,
    kindLabel: 'controller' | 'provider' | 'module',
    pluralLabel: 'Controllers' | 'Providers' | 'Modules',
    nodeName: ts.Identifier,
    filePath: string,
    discoveredFiles: Set<string>,
    reporter?: DiagnosticReporter
): void
{
    const className = nodeName.text;
    const existing = map.get( className );

    if( existing && existing.path !== filePath )
    {
        reporter?.error(
            nodeName,
            DiagnosticCode.DUPLICATE_CLASS,
            `Duplicate ${kindLabel} class name "${className}" already declared in ${existing.path}. ${pluralLabel} are keyed by class name; rename one of them.`
        );
    }
    else
    {
        map.set( className, entry );
    }

    discoveredFiles.add( filePath );
    console.log( `- Discovered ${kindLabel}: ${className} in ${path.basename( filePath )}` );
}

/**
 * Walk every source file of the program and record decorated classes, plus any AOT
 * manifest shipped by a dependency inside node_modules.
 */
export function discoverFromEntryPoint(
    program: ts.Program,
    entryFile: string,
    registry: ProjectRegistry,
    reporter?: DiagnosticReporter
) 
{
    const checker = program.getTypeChecker();
    const discoveredFiles = new Set<string>();

    for( const sourceFile of program.getSourceFiles()) 
    {
        if( sourceFile.isDeclarationFile ) { continue }

        if( sourceFile.fileName.includes( 'node_modules' )) 
        {
            // Try to find a manifest in this package
            let current = path.dirname( sourceFile.fileName );

            while( current.includes( 'node_modules' ) && current !== path.parse( current ).root ) 
            {
                const manifestPath = path.join( current, '_metadata.webergency-server.js' );

                if( fs.existsSync( manifestPath )) 
                {
                    registry.externalManifests.add( manifestPath );
                    break;
                }

                if( fs.existsSync( path.join( current, 'package.json' ))) { break }
                current = path.dirname( current );
            }
            continue;
        }

        const walk = ( node: ts.Node ) => 
        {
            if( ts.isClassDeclaration( node ) && node.name ) 
            {
                const decorators = ts.getDecorators( node );

                if( decorators ) 
                {
                    for( const dec of decorators ) 
                    {
                        // Prefer symbol name; fall back to the call/identifier text only
                        // (not the full expression — `@Module({ controllers })` contains "Controller").
                        const decSymbol = checker.getSymbolAtLocation( ts.isCallExpression( dec.expression ) ? dec.expression.expression : dec.expression );
                        const decName = decSymbol?.getName();
                        const callText = ts.isCallExpression( dec.expression )
                            ? dec.expression.expression.getText()
                            : dec.expression.getText();
                        const isController = decName === 'Controller' || callText === 'Controller';
                        const isInjectable = decName === 'Injectable' || callText === 'Injectable';
                        const isModule = decName === 'Module' || callText === 'Module';

                        if( isController ) 
                        {
                            recordDiscoveredClass(
                                registry.controllers,
                                { path : sourceFile.fileName, injections : new Map() },
                                'controller',
                                'Controllers',
                                node.name,
                                sourceFile.fileName,
                                discoveredFiles,
                                reporter
                            );
                        }
                        else if( isInjectable ) 
                        {
                            recordDiscoveredClass(
                                registry.providers,
                                { path : sourceFile.fileName },
                                'provider',
                                'Providers',
                                node.name,
                                sourceFile.fileName,
                                discoveredFiles,
                                reporter
                            );
                        }
                        else if( isModule ) 
                        {
                            recordDiscoveredClass(
                                registry.modules,
                                { path : sourceFile.fileName },
                                'module',
                                'Modules',
                                node.name,
                                sourceFile.fileName,
                                discoveredFiles,
                                reporter
                            );
                        }
                    }
                }
            }
            ts.forEachChild( node, walk );
        };

        walk( sourceFile );
    }

    return Array.from( discoveredFiles );
}
