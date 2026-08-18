import ts from '../../src/compiler/ts.js';
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createBeforeTransformers, readTsPatchPlugins } from '../../src/compiler/emit-transformers.js';
import { resolveRootDir } from '../../src/compiler/root-dir.js';

const here = path.dirname( fileURLToPath( import.meta.url ));
export const fixtureRoot = path.join( here, 'fixture' );
export const fixtureDist = path.join( fixtureRoot, 'dist' );

/**
 * Compile the fixture with the same emit pipeline as `webergency-tsc`
 * (typechecker transformer + server AOT plugin).
 */
export function compileFixture(): void
{
    const tsconfigPath = path.join( fixtureRoot, 'tsconfig.json' );
    const configFile = ts.readConfigFile( tsconfigPath, ts.sys.readFile );

    if( configFile.error )
    {
        throw new Error( ts.flattenDiagnosticMessageText( configFile.error.messageText, '\n' ));
    }

    const configDir = path.dirname( tsconfigPath );
    const parsed = ts.parseJsonConfigFileContent( configFile.config, ts.sys, configDir, {}, tsconfigPath );

    if( parsed.errors.length )
    {
        throw new Error( parsed.errors.map( e => ts.flattenDiagnosticMessageText( e.messageText, '\n' )).join( '\n' ));
    }

    const options = { ...parsed.options, experimentalDecorators : parsed.options.experimentalDecorators ?? true };
    const inferred = resolveRootDir( options.rootDir, parsed.fileNames, configDir );

    if( inferred )
    {
        options.rootDir = inferred;
    }

    if( fs.existsSync( fixtureDist ))
    {
        fs.rmSync( fixtureDist, { recursive : true, force : true });
    }

    const host = ts.createCompilerHost( options );
    const program = ts.createProgram({
        rootNames : parsed.fileNames,
        options,
        host
    });
    const plugins = readTsPatchPlugins( configFile.config?.compilerOptions );
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
    const diagnostics =
    [
        ...ts.getPreEmitDiagnostics( program ),
        ...emitResult.diagnostics,
        ...aotDiagnostics
    ];

    if( emitResult.emitSkipped || diagnostics.some( d => d.category === ts.DiagnosticCategory.Error ))
    {
        const formatHost: ts.FormatDiagnosticsHost =
        {
            getCanonicalFileName : f => f,
            getCurrentDirectory  : () => ts.sys.getCurrentDirectory(),
            getNewLine           : () => ts.sys.newLine
        };

        throw new Error( ts.formatDiagnosticsWithColorAndContext( diagnostics, formatHost ));
    }
}

export async function loadCompiledApp(): Promise<{ AppModule: any, ParseController: any }>
{
    const stamp = Date.now();
    const appUrl = `${pathToFileURL( path.join( fixtureDist, 'app.module.js' )).href}?t=${stamp}`;
    const parseUrl = `${pathToFileURL( path.join( fixtureDist, 'parse.controller.js' )).href}?t=${stamp}`;
    const app = await import( appUrl );
    const parse = await import( parseUrl );

    return { AppModule : app.AppModule, ParseController : parse.ParseController };
}

export function allocatePort(): Promise<number>
{
    return new Promise(( resolve, reject ) =>
    {
        const server = net.createServer();
        server.listen( 0, '127.0.0.1', () =>
        {
            const addr = server.address();
            const port = typeof addr === 'object' && addr ? addr.port : 0;
            server.close( err =>
            {
                if( err ){ reject( err ); return }

                resolve( port );
            });
        });
        server.on( 'error', reject );
    });
}

export type HttpResult =
{
    status  : number
    body    : any
    raw     : string
    headers : Headers
};

export async function httpJson( base: string, pathAndQuery: string, init?: RequestInit ): Promise<HttpResult>
{
    const res = await fetch( `${base}${pathAndQuery}`, init );
    const raw = await res.text();
    let body: any = raw;

    if( raw )
    {
        try
        {
            body = JSON.parse( raw );
        }
        catch
        {
            body = raw;
        }
    }

    return { status : res.status, body, raw, headers : res.headers };
}
