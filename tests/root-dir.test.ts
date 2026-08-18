import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { inferRootDirFromSources, resolveRootDir } from '../src/compiler/root-dir.js';

describe( 'inferRootDirFromSources', () =>
{
    const configDir = path.resolve( '/proj' );

    it( 'should return undefined when there are no source files', () =>
    {
        // Arrange
        const rootNames: string[] = [];

        // Act
        const result = inferRootDirFromSources( rootNames, configDir );

        // Assert
        expect( result ).toBeUndefined();
    });

    it( 'should infer src when every file lives under src', () =>
    {
        // Arrange
        const rootNames =
        [
            path.join( configDir, 'src', 'app.module.ts' ),
            path.join( configDir, 'src', 'controllers', 'mail.controller.ts' )
        ];

        // Act
        const result = inferRootDirFromSources( rootNames, configDir );

        // Assert
        expect( result ).toBe( path.join( configDir, 'src' ));
    });

    it( 'should accept a source file whose relative path is exactly src', () =>
    {
        // Arrange
        const rootNames = [ path.join( configDir, 'src' ) ];

        // Act
        const result = inferRootDirFromSources( rootNames, configDir );

        // Assert
        expect( result ).toBe( path.join( configDir, 'src' ));
    });

    it( 'should return undefined when a file sits next to src at the project root', () =>
    {
        // Arrange
        const rootNames =
        [
            path.join( configDir, 'src', 'main.ts' ),
            path.join( configDir, 'index.ts' )
        ];

        // Act
        const result = inferRootDirFromSources( rootNames, configDir );

        // Assert
        expect( result ).toBeUndefined();
    });

    it( 'should return undefined when a file lives outside the config directory', () =>
    {
        // Arrange
        const rootNames = [ path.resolve( '/elsewhere/src/main.ts' ) ];

        // Act
        const result = inferRootDirFromSources( rootNames, configDir );

        // Assert
        expect( result ).toBeUndefined();
    });
});

describe( 'resolveRootDir', () =>
{
    const configDir = path.resolve( '/proj' );
    const srcFiles =
    [
        path.join( configDir, 'src', 'app.module.ts' )
    ];

    it( 'should infer src when rootDir is omitted and sources are under src', () =>
    {
        // Arrange / Act
        const result = resolveRootDir( undefined, srcFiles, configDir );

        // Assert
        expect( result ).toBe( path.join( configDir, 'src' ));
    });

    it( 'should keep an explicit project-root rootDir of "."', () =>
    {
        // Arrange / Act
        const result = resolveRootDir( '.', srcFiles, configDir );

        // Assert
        expect( result ).toBe( '.' );
    });

    it( 'should keep an absolute project-root rootDir', () =>
    {
        // Arrange / Act
        const result = resolveRootDir( configDir, srcFiles, configDir );

        // Assert
        expect( result ).toBe( configDir );
    });

    it( 'should keep an explicit non-root rootDir such as lib', () =>
    {
        // Arrange
        const libDir = path.join( configDir, 'lib' );

        // Act
        const result = resolveRootDir( libDir, srcFiles, configDir );

        // Assert
        expect( result ).toBe( libDir );
    });

    it( 'should keep the configured rootDir when sources are not all under src', () =>
    {
        // Arrange
        const mixed =
        [
            path.join( configDir, 'src', 'main.ts' ),
            path.join( configDir, 'index.ts' )
        ];

        // Act
        const result = resolveRootDir( '.', mixed, configDir );

        // Assert
        expect( result ).toBe( '.' );
    });
});
