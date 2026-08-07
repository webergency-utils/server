import ts from '../../src/compiler/ts.js';
import * as fs from 'fs';
import * as path from 'path';
import compilerPlugin, { transformer, createRegistry } from '../../src/compiler/transformer.js';
import { SwaggerSpecGenerator } from '../../src/compiler/swagger.js';
import { fileURLToPath } from 'url';

const __dirname = path.dirname( fileURLToPath( import.meta.url ));

/**
 * Compile AOT controllers with the transformer (Symbol.for meta + inlined validators).
 * Returns path to controllers.compiled.js for dynamic import.
 */
export function runAot() 
{
    const controllerPath = path.resolve( __dirname, 'controllers.ts' );
    const compiledControllersPath = path.resolve( __dirname, 'controllers.compiled.js' );
    const serverRoot = path.resolve( __dirname, '../../src/index.ts' );

    const registry = createRegistry();
    
    const program = ts.createProgram([serverRoot, controllerPath], {
        experimentalDecorators : true,
        target                 : ts.ScriptTarget.ES2022,
        module                 : ts.ModuleKind.NodeNext,
        moduleResolution       : ts.ModuleResolutionKind.NodeNext,
        skipLibCheck           : true
    });

    const source = program.getSourceFile( controllerPath );

    if( !source ) 
    {
        throw new Error( `Could not find source file: ${controllerPath}` );
    }

    program.emit(
        source,
        ( fileName, data ) => 
        {
            fs.writeFileSync( compiledControllersPath, data );
        },
        undefined,
        false,
        {
            before : [compilerPlugin( program )]
        }
    );

    const analyzer = transformer( program, registry )({} as any );
    analyzer( source );

    SwaggerSpecGenerator.generate( registry, program, __dirname );

    return compiledControllersPath;
}

if( import.meta.url.endsWith( 'build.ts' )) 
{
    runAot();
    console.log( 'Build complete' );
}
