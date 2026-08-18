import { describe, it, expect } from 'vitest';
import ts from '../src/compiler/ts.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
    collectBeforePluginIds,
    createBeforeTransformers,
    readTsPatchPlugins,
    SERVER_TRANSFORM,
    TYPECHECKER_TRANSFORM
} from '../src/compiler/emit-transformers.js';

describe( 'collectBeforePluginIds', () =>
{
    it( 'should always include the typechecker transformer first', () =>
    {
        // Arrange / Act
        const ids = collectBeforePluginIds( [] );

        // Assert
        expect( ids ).toEqual([ TYPECHECKER_TRANSFORM ]);
    });

    it( 'should keep listed before-transforms after typechecker and skip the server plugin', () =>
    {
        // Arrange / Act
        const ids = collectBeforePluginIds([
            { transform : TYPECHECKER_TRANSFORM },
            { transform : SERVER_TRANSFORM },
            { transform : 'some-other/transformer' }
        ]);

        // Assert
        expect( ids ).toEqual([ TYPECHECKER_TRANSFORM, 'some-other/transformer' ]);
    });

    it( 'should skip after and afterDeclarations plugins', () =>
    {
        // Arrange / Act
        const ids = collectBeforePluginIds([
            { transform : 'before/one' },
            { transform : 'after/one', after : true },
            { transform : 'decls/one', afterDeclarations : true }
        ]);

        // Assert
        expect( ids ).toEqual([ TYPECHECKER_TRANSFORM, 'before/one' ]);
    });

    it( 'should not list the same transform twice', () =>
    {
        // Arrange / Act
        const ids = collectBeforePluginIds([
            { transform : TYPECHECKER_TRANSFORM },
            { transform : TYPECHECKER_TRANSFORM }
        ]);

        // Assert
        expect( ids ).toEqual([ TYPECHECKER_TRANSFORM ]);
    });
});

describe( 'readTsPatchPlugins', () =>
{
    it( 'should return an empty list when compilerOptions is missing plugins', () =>
    {
        expect( readTsPatchPlugins( undefined )).toEqual( [] );
        expect( readTsPatchPlugins({}) ).toEqual( [] );
        expect( readTsPatchPlugins({ plugins : 'nope' }) ).toEqual( [] );
    });

    it( 'should return object plugin entries from compilerOptions', () =>
    {
        // Arrange
        const plugins = [{ transform : TYPECHECKER_TRANSFORM }];

        // Act
        const result = readTsPatchPlugins({ plugins });

        // Assert
        expect( result ).toEqual( plugins );
    });
});

describe( 'createBeforeTransformers', () =>
{
    it( 'should rewrite assert so the typechecker transformer is applied', () =>
    {
        // Arrange
        const dir = fs.mkdtempSync( path.join( os.tmpdir(), 'weberg-emit-' ));
        const file = path.join( dir, 'config.ts' );
        fs.writeFileSync( file, `
            import { assert } from '@webergency-utils/typechecker';
            type Env = { PORT: string };
            export const env = assert<Env>( process.env, { from: 'query', mode: 'strip' } );
        ` );

        try
        {
            const options: ts.CompilerOptions =
            {
                target                 : ts.ScriptTarget.ES2022,
                module                 : ts.ModuleKind.CommonJS,
                moduleResolution       : ts.ModuleResolutionKind.Node10,
                skipLibCheck           : true,
                experimentalDecorators : true,
                outDir                 : path.join( dir, 'out' )
            };
            let emitted = '';
            const host = ts.createCompilerHost( options );
            host.writeFile = ( _name, data ) => { emitted = data };
            const program = ts.createProgram( [file], options, host );

            // Act
            program.emit(
                undefined,
                host.writeFile,
                undefined,
                undefined,
                { before : createBeforeTransformers( program, undefined, [], dir ) }
            );

            // Assert
            expect( emitted ).toContain( '__val_' );
            expect( emitted ).not.toMatch( /assert<\s*Env\s*>/ );
        }
        finally
        {
            fs.rmSync( dir, { recursive : true, force : true });
        }
    });
});
