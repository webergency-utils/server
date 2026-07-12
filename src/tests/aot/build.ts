import ts from '../../compiler/ts.js';
import * as fs from 'fs';
import * as path from 'path';
import compilerPlugin, { transformer, createRegistry, generateManifestCode } from '../../compiler/transformer.js';
import { SwaggerSpecGenerator } from '../../compiler/swagger.js';
import { fileURLToPath } from 'url';

const __dirname = path.dirname( fileURLToPath( import.meta.url ));

export function runAot() 
{
    const controllerPath = path.resolve( __dirname, 'controllers.ts' );
    const manifestPath = path.resolve( __dirname, '_manifest.js' );
    const serverRoot = path.resolve( __dirname, '../../index.ts' );

    const registry = createRegistry();
    
    // We include both the server root and the controller to ensure all types are resolvable
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

    // 1. Compile controllers.ts using the compiler plugin and emit to controllers.compiled.js
    const compiledControllersPath = path.resolve( __dirname, 'controllers.compiled.js' );
    program.emit(
        source,
        ( fileName, data ) => 
        {
            fs.writeFileSync( compiledControllersPath, data );
        },
        undefined,
        false,
        {
            before : [ compilerPlugin( program ) ]
        }
    );

    // 2. We also need to analyze the controller file to populate our registry
    const analyzer = transformer( program, registry )({} as any );
    analyzer( source );

    // Generate swagger.json during AOT build of tests (using original paths in registry)
    SwaggerSpecGenerator.generate( registry, program, path.dirname( manifestPath ));

    // 3. Mutate paths in registry so they point to the compiled file
    const compiledVirtualTsPath = path.resolve( __dirname, 'controllers.compiled.ts' );

    for( const key of registry.controllers.keys()) 
    {
        registry.controllers.get( key )!.path = compiledVirtualTsPath;
    }

    for( const key of registry.providers.keys()) 
    {
        registry.providers.get( key )!.path = compiledVirtualTsPath;
    }

    for( const key of registry.guards.keys()) 
    {
        registry.guards.get( key )!.path = compiledVirtualTsPath;
    }

    for( const key of registry.interceptors.keys()) 
    {
        registry.interceptors.get( key )!.path = compiledVirtualTsPath;
    }

    const manifestCode = generateManifestCode( registry, new Map(), manifestPath );
    fs.writeFileSync( manifestPath, manifestCode );

    return manifestPath;
}

if( import.meta.url.endsWith( 'build.ts' )) 
{
    runAot();
    console.log( 'Build complete' );
}
