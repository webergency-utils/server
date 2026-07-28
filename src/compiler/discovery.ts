import ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';
import { ProjectRegistry } from './registry.js';

/**
 * Walk every source file of the program and record decorated classes, plus any AOT
 * manifest shipped by a dependency inside node_modules.
 */
export function discoverFromEntryPoint( program: ts.Program, entryFile: string, registry: ProjectRegistry ) 
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
                            const className = node.name.text;
                            const filePath = sourceFile.fileName;
                            registry.controllers.set( className, { path : filePath, injections : new Map() });
                            discoveredFiles.add( filePath );
                            console.log( `- Discovered controller: ${className} in ${path.basename( filePath )}` );
                        }
                        else if( isInjectable ) 
                        {
                            const className = node.name.text;
                            const filePath = sourceFile.fileName;
                            registry.providers.set( className, { path : filePath });
                            discoveredFiles.add( filePath );
                            console.log( `- Discovered provider: ${className} in ${path.basename( filePath )}` );
                        }
                        else if( isModule ) 
                        {
                            const className = node.name.text;
                            const filePath = sourceFile.fileName;
                            registry.modules.set( className, { path : filePath });
                            discoveredFiles.add( filePath );
                            console.log( `- Discovered module: ${className} in ${path.basename( filePath )}` );
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
