import ts from 'typescript';
import * as path from 'path';
import { createRequire } from 'node:module';
import typecheckerTransformer from '@webergency-utils/typechecker/transformer';
import compilerPlugin from './plugin.js';
import type { PluginExtras } from './plugin.js';

export const TYPECHECKER_TRANSFORM = '@webergency-utils/typechecker/transformer';
export const SERVER_TRANSFORM = '@webergency-utils/server/transformer';

export type TsPatchPlugin =
{
    name?               : string
    transform?          : string
    after?              : boolean
    afterDeclarations?  : boolean
};

/**
 * `webergency-tsc` is a tsc wrapper, not ts-patch — stock tsc ignores `transform`
 * plugin entries. Always run the typechecker transformer (so `assert<T>()` is
 * rewritten) then any other listed before-transforms, then the server AOT plugin.
 */
export function collectBeforePluginIds( plugins: readonly TsPatchPlugin[] | undefined ): string[]
{
    const listed: string[] = [];

    for( const plugin of plugins ?? [] )
    {
        if( !plugin.transform ){ continue }

        if( plugin.after || plugin.afterDeclarations ){ continue }

        if( plugin.transform === SERVER_TRANSFORM ){ continue }

        if( listed.includes( plugin.transform )){ continue }

        listed.push( plugin.transform );
    }

    if( !listed.includes( TYPECHECKER_TRANSFORM ))
    {
        listed.unshift( TYPECHECKER_TRANSFORM );
    }

    return listed;
}

export function createBeforeTransformers(
    program   : ts.Program,
    extras    : PluginExtras | undefined,
    plugins   : readonly TsPatchPlugin[] | undefined,
    configDir : string
): ts.TransformerFactory<ts.SourceFile>[]
{
    const require = createRequire( path.join( configDir, 'package.json' ));
    const factories: ts.TransformerFactory<ts.SourceFile>[] = [];

    for( const id of collectBeforePluginIds( plugins ))
    {
        const factory = loadTransformerFactory( id, require );
        factories.push( factory( program ) as ts.TransformerFactory<ts.SourceFile> );
    }

    factories.push(
        compilerPlugin( program, undefined, extras ) as unknown as ts.TransformerFactory<ts.SourceFile>
    );

    return factories;
}

type TransformerFactoryFn = ( program: ts.Program, ...rest: unknown[] ) => unknown;

function loadTransformerFactory( id: string, require: NodeRequire ): TransformerFactoryFn
{
    if( id === TYPECHECKER_TRANSFORM )
    {
        return typecheckerTransformer as TransformerFactoryFn;
    }

    const mod = require( id ) as { default?: TransformerFactoryFn } | TransformerFactoryFn;

    if( typeof mod === 'function' )
    {
        return mod;
    }

    if( mod && typeof mod.default === 'function' )
    {
        return mod.default;
    }

    throw new Error( `webergency-tsc: plugin "${id}" did not export a transformer factory` );
}

export function readTsPatchPlugins( compilerOptions: unknown ): TsPatchPlugin[]
{
    if( !compilerOptions || typeof compilerOptions !== 'object' ){ return [] }

    const plugins = ( compilerOptions as { plugins?: unknown }).plugins;

    if( !Array.isArray( plugins )){ return [] }

    return plugins.filter(( p ): p is TsPatchPlugin => !!p && typeof p === 'object' );
}
