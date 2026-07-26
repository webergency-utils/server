import { describe, it, expect, vi, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import ts from '../compiler/ts.js';
import { createRegistry, discoverFromEntryPoint } from '../compiler/transformer.js';

describe( 'discoverFromEntryPoint', () =>
{
    const tempFiles: string[] = [];

    afterEach( () =>
    {
        for( const file of tempFiles.splice( 0 ))
        {
            if( fs.existsSync( file )){ fs.unlinkSync( file ) }
        }
        vi.restoreAllMocks();
    });

    it( 'should discover Controller, Injectable, and Module from program sources', () =>
    {
        // Arrange
        const tempFile = path.resolve( './temp_discover_entry.ts' );
        tempFiles.push( tempFile );
        vi.spyOn( console, 'log' ).mockImplementation( () => {});

        fs.writeFileSync( tempFile, `
            function Controller( path?: string ){ return ( _: any ) => {} }
            function Injectable(){ return ( _: any ) => {} }
            function Module( _meta?: any ){ return ( _: any ) => {} }

            @Controller( '/api' )
            class ApiController {}

            @Injectable()
            class ApiService {}

            @Module({ controllers : [ ApiController ] })
            class AppModule {}
        `);

        const program = ts.createProgram([ tempFile ], {
            target                 : ts.ScriptTarget.ES2022,
            module                 : ts.ModuleKind.NodeNext,
            moduleResolution       : ts.ModuleResolutionKind.NodeNext,
            skipLibCheck           : true,
            experimentalDecorators : true
        });
        const registry = createRegistry();

        // Act
        const files = discoverFromEntryPoint( program, tempFile, registry );

        // Assert
        expect( files.some( f => f.includes( 'temp_discover_entry.ts' ))).toBe( true );
        expect( registry.controllers.has( 'ApiController' )).toBe( true );
        expect( registry.providers.has( 'ApiService' )).toBe( true );
        expect( registry.modules.has( 'AppModule' )).toBe( true );
    });

    it( 'should collect external manifests under node_modules', () =>
    {
        // Arrange
        const root = fs.mkdtempSync( path.join( os.tmpdir(), 'webergency-discover-' ));
        const pkgDir = path.join( root, 'node_modules', 'some-pkg' );
        fs.mkdirSync( pkgDir, { recursive : true });
        const srcFile = path.join( pkgDir, 'index.ts' );
        const manifest = path.join( pkgDir, '_metadata.webergency-server.js' );
        tempFiles.push( srcFile, manifest );
        fs.writeFileSync( srcFile, 'export const x = 1;\n' );
        fs.writeFileSync( manifest, 'export {};\n' );
        vi.spyOn( console, 'log' ).mockImplementation( () => {});

        const program = ts.createProgram([ srcFile ], {
            target           : ts.ScriptTarget.ES2022,
            module           : ts.ModuleKind.ESNext,
            skipLibCheck     : true
        });
        const registry = createRegistry();

        // Act
        discoverFromEntryPoint( program, srcFile, registry );

        // Assert
        expect([ ...registry.externalManifests ]).toContain( manifest );

        fs.rmSync( root, { recursive : true, force : true });
    });

    it( 'should stop node_modules walk at package.json without a manifest', () =>
    {
        // Arrange
        const root = fs.mkdtempSync( path.join( os.tmpdir(), 'webergency-discover-pkg-' ));
        const pkgDir = path.join( root, 'node_modules', 'pkg-only' );
        const nestedDir = path.join( pkgDir, 'dist' );
        fs.mkdirSync( nestedDir, { recursive : true });
        const srcFile = path.join( nestedDir, 'index.ts' );
        const pkgJson = path.join( pkgDir, 'package.json' );
        tempFiles.push( srcFile, pkgJson );
        fs.writeFileSync( srcFile, 'export const x = 1;\n' );
        fs.writeFileSync( pkgJson, JSON.stringify({ name : 'pkg-only', version : '1.0.0' }));
        vi.spyOn( console, 'log' ).mockImplementation( () => {});

        const program = ts.createProgram([ srcFile ], {
            target       : ts.ScriptTarget.ES2022,
            module       : ts.ModuleKind.ESNext,
            skipLibCheck : true
        });
        const registry = createRegistry();

        // Act
        discoverFromEntryPoint( program, srcFile, registry );

        // Assert
        expect( registry.externalManifests.size ).toBe( 0 );

        fs.rmSync( root, { recursive : true, force : true });
    });
});
