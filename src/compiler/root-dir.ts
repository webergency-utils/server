import * as path from 'path';

/**
 * When `rootDir` is omitted and every input lives under `src/`, use that as
 * `rootDir` so `outDir: dist` emits `dist/...` rather than `dist/src/...`.
 * An explicit `rootDir` (including `"."`) is left alone — apps may rely on it
 * for `__dirname` relative assets.
 */
export function resolveRootDir(
    rootDir    : string | undefined,
    rootNames  : readonly string[],
    configDir  : string
): string | undefined
{
    if( rootDir )
    {
        return rootDir;
    }

    return inferRootDirFromSources( rootNames, configDir );
}

export function inferRootDirFromSources( rootNames: readonly string[], configDir: string ): string | undefined
{
    if( rootNames.length === 0 ){ return undefined }

    const relPaths = rootNames.map( f => path.relative( configDir, path.resolve( configDir, f )));

    if( relPaths.some( p => p.startsWith( `..${path.sep}` ) || p === '..' ))
    {
        return undefined;
    }

    if( !relPaths.every( p => p === 'src' || p.startsWith( `src${path.sep}` )))
    {
        return undefined;
    }

    return path.join( configDir, 'src' );
}
