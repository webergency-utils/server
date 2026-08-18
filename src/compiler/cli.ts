#!/usr/bin/env node
/**
 * webergency-tsc — drop-in tsc wrapper that always applies the typechecker
 * transformer and the Webergency AOT transformer.
 *
 * Usage (same args as tsc):
 *   webergency-tsc -p tsconfig.json
 *   webergency-tsc --outDir dist src/index.ts
 */
import ts from 'typescript';
import * as path from 'path';
import { resolveRootDir } from './root-dir.js';
import { createBeforeTransformers, readTsPatchPlugins, TsPatchPlugin } from './emit-transformers.js';

const args = process.argv.slice( 2 );

function printUsage()
{
    console.error( 'Usage: webergency-tsc [tsc options…]\n  Compiles TypeScript with the typechecker transformer and Webergency AOT (Symbol.for meta + validators).' );
}

if( args.includes( '-h' ) || args.includes( '--help' ))
{
    printUsage();
    process.exit( 0 );
}

let projectPath: string | undefined;
const passthrough: string[] = [];

for( let i = 0; i < args.length; i++ )
{
    const a = args[i];

    if( a === '-p' || a === '--project' )
    {
        projectPath = args[++i];
        continue;
    }

    passthrough.push( a );
}

const parsedCli = ts.parseCommandLine( passthrough );

if( parsedCli.errors.length )
{
    const host =
    {
        getCurrentDirectory  : () => ts.sys.getCurrentDirectory(),
        getCanonicalFileName : ( f: string ) => f,
        getNewLine           : () => ts.sys.newLine
    };
    console.error( ts.formatDiagnosticsWithColorAndContext( parsedCli.errors, host as any ));
    process.exit( 1 );
}

let options: ts.CompilerOptions = { ...parsedCli.options };
let rootNames: string[] = parsedCli.fileNames;
let plugins: TsPatchPlugin[] = [];

const configPath = projectPath
    ? path.resolve( process.cwd(), projectPath )
    : ( rootNames.length === 0
        ? ts.findConfigFile( process.cwd(), ts.sys.fileExists, 'tsconfig.json' )
        : undefined );

let configDir = process.cwd();

if( configPath )
{
    configDir = path.dirname( configPath );
    const configFile = ts.readConfigFile( configPath, ts.sys.readFile );

    if( configFile.error )
    {
        console.error( ts.flattenDiagnosticMessageText( configFile.error.messageText, '\n' ));
        process.exit( 1 );
    }

    const parsed = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        configDir,
        parsedCli.options,
        configPath
    );

    if( parsed.errors.length )
    {
        console.error( parsed.errors.map( e => ts.flattenDiagnosticMessageText( e.messageText, '\n' )).join( '\n' ));
        process.exit( 1 );
    }

    options = parsed.options;
    rootNames = parsed.fileNames;
    plugins = readTsPatchPlugins( configFile.config?.compilerOptions );
}
else if( rootNames.length === 0 )
{
    printUsage();
    process.exit( 1 );
}

const resolvedRootDir = resolveRootDir( options.rootDir, rootNames, configDir );

if( resolvedRootDir )
{
    options.rootDir = resolvedRootDir;
}

options.experimentalDecorators = options.experimentalDecorators ?? true;

const host = ts.createCompilerHost( options );
const program = ts.createProgram({
    rootNames,
    options,
    host
});

// Decorator problems arrive here during emit and are printed alongside tsc's own output.
const aotDiagnostics: ts.Diagnostic[] = [];

const emitResult = program.emit(
    undefined,
    undefined,
    undefined,
    undefined,
    {
        before : createBeforeTransformers(
            program,
            { addDiagnostic : ( d ) => { aotDiagnostics.push( d as ts.Diagnostic ) } },
            plugins,
            configDir
        )
    }
);

const diagnostics = [
    ...ts.getPreEmitDiagnostics( program ),
    ...emitResult.diagnostics,
    ...aotDiagnostics
];

if( diagnostics.length )
{
    const formatHost: ts.FormatDiagnosticsHost =
    {
        getCanonicalFileName : f => f,
        getCurrentDirectory  : () => ts.sys.getCurrentDirectory(),
        getNewLine           : () => ts.sys.newLine
    };
    console.error( ts.formatDiagnosticsWithColorAndContext( diagnostics, formatHost ));
}

if( emitResult.emitSkipped || diagnostics.some( d => d.category === ts.DiagnosticCategory.Error ))
{
    process.exit( 1 );
}

console.log( '✔ webergency-tsc emit complete' );
