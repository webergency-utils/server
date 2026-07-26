/**
 * Optional load-time AOT host for development without a prior dist emit.
 *
 * Usage:
 *   node --import @webergency-utils/server/register ./app.ts
 *
 * Applies the Webergency AOT transformer, then strips types via TypeScript
 * transpileModule so Node can execute the result as ESM.
 */
import ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import compilerPlugin from './transformer.js';

const programCache = new Map<string, ts.Program>();

function getProgramFor( fileName: string ): ts.Program
{
    const configPath = ts.findConfigFile( path.dirname( fileName ), ts.sys.fileExists, 'tsconfig.json' );
    const cacheKey = configPath || path.dirname( fileName );

    if( programCache.has( cacheKey ))
    {
        return programCache.get( cacheKey )!;
    }

    let options: ts.CompilerOptions =
    {
        experimentalDecorators : true,
        target                 : ts.ScriptTarget.ES2022,
        module                 : ts.ModuleKind.ESNext,
        moduleResolution       : ts.ModuleResolutionKind.Bundler,
        skipLibCheck           : true
    };
    let rootNames = [fileName];

    if( configPath )
    {
        const configFile = ts.readConfigFile( configPath, ts.sys.readFile );
        const parsed = ts.parseJsonConfigFileContent(
            configFile.config,
            ts.sys,
            path.dirname( configPath )
        );
        options = { ...parsed.options, experimentalDecorators : true };
        rootNames = parsed.fileNames.length ? parsed.fileNames : [fileName];
    }

    const program = ts.createProgram({ rootNames, options });
    programCache.set( cacheKey, program );

    return program;
}

export function transformSource( fileName: string, sourceText: string ): string
{
    if( !/\.[cm]?tsx?$/.test( fileName ))
    {
        return sourceText;
    }

    const program = getProgramFor( fileName );
    const sourceFile = ts.createSourceFile(
        fileName,
        sourceText,
        ts.ScriptTarget.ES2022,
        true,
        fileName.endsWith( 'x' ) ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );

    const transformer = compilerPlugin( program );
    const result = ts.transform( sourceFile, [transformer as unknown as ts.TransformerFactory<ts.SourceFile>]);
    const transformed = result.transformed[0];
    const printer = ts.createPrinter({ newLine : ts.NewLineKind.LineFeed });
    const transformedText = printer.printFile( transformed );
    result.dispose();

    const transpiled = ts.transpileModule( transformedText, {
        compilerOptions :
        {
            experimentalDecorators : true,
            target                 : ts.ScriptTarget.ES2022,
            module                 : ts.ModuleKind.ESNext,
            sourceMap              : false
        },
        fileName
    });

    return transpiled.outputText;
}

function fileURLToPathCompat( url: string ): string
{
    const u = new URL( url );

    return decodeURIComponent( u.pathname.startsWith( '/' ) && /^\/[A-Za-z]:/.test( u.pathname )
        ? u.pathname.slice( 1 )
        : u.pathname );
}

export async function load( url: string, context: any, nextLoad: any )
{
    if( url.startsWith( 'file:' ) && /\.[cm]?tsx?$/.test( url ))
    {
        const filePath = fileURLToPathCompat( url );

        if( !fs.existsSync( filePath ))
        {
            return nextLoad( url, context );
        }

        const sourceText = fs.readFileSync( filePath, 'utf8' );
        const transformed = transformSource( filePath, sourceText );

        return {
            format       : 'module',
            shortCircuit : true,
            source       : transformed
        };
    }

    return nextLoad( url, context );
}

export async function resolve( specifier: string, context: any, nextResolve: any )
{
    // Allow extensionless and .ts imports relative to parent
    if( specifier.startsWith( '.' ) || specifier.startsWith( '/' ))
    {
        const parent = context.parentURL ? fileURLToPathCompat( context.parentURL ) : process.cwd();
        const base = path.resolve( path.dirname( parent ), specifier );
        const candidates = [
            base,
            base + '.ts',
            base + '.tsx',
            base + '.mts',
            base + '.cts',
            path.join( base, 'index.ts' )
        ];

        for( const candidate of candidates )
        {
            if( fs.existsSync( candidate ) && fs.statSync( candidate ).isFile())
            {
                return {
                    shortCircuit : true,
                    url          : pathToFileURL( candidate ).href
                };
            }
        }
    }

    return nextResolve( specifier, context );
}

( globalThis as any ).__WEBERGENCY_SERVER_REGISTER__ = true;
