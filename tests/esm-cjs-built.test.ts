import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = path.resolve( path.dirname( fileURLToPath( import.meta.url )), '..' );
const require = createRequire( import.meta.url );
const hasDist = fs.existsSync( path.join( root, 'dist/index.js' ))
    && fs.existsSync( path.join( root, 'dist/index.cjs' ));

describe.skipIf( !hasDist )( 'Built ESM and CJS dual artifacts', () =>
{
    const files =
    [
        'dist/index.js',
        'dist/index.cjs',
        'dist/index.d.ts',
        'dist/index.d.cts',
        'dist/compiler/transformer.js',
        'dist/compiler/transformer.cjs',
        'dist/compiler/transformer.d.ts',
        'dist/compiler/transformer.d.cts',
        'dist/compiler/register.js',
        'dist/compiler/register.cjs',
        'dist/compiler/cli.js',
        'dist/compiler/cli.cjs'
    ];

    it( 'emits ESM (.js) and CJS (.cjs) artifacts for public entry points', () =>
    {
        for( const file of files )
        {
            expect( fs.existsSync( path.join( root, file )), `Expected ${file}` ).toBe( true );
        }
    });

    it( 'does not publish a /testing entry', () =>
    {
        expect( fs.existsSync( path.join( root, 'dist/testing.js' ))).toBe( false );
        expect( fs.existsSync( path.join( root, 'dist/testing.cjs' ))).toBe( false );
    });

    it( 'requires CommonJS dist/index.cjs successfully', () =>
    {
        const indexCjs = require( path.join( root, 'dist/index.cjs' ));

        expect( indexCjs ).toBeDefined();
        expect( typeof indexCjs.Server ).toBe( 'function' );
        expect( typeof indexCjs.Controller ).toBe( 'function' );
    });

    it( 'requires CommonJS dist/compiler/transformer.cjs successfully', () =>
    {
        const transformerCjs = require( path.join( root, 'dist/compiler/transformer.cjs' ));
        const tf = transformerCjs.default || transformerCjs;

        expect( typeof tf ).toBe( 'function' );
        expect( typeof transformerCjs.createRegistry ).toBe( 'function' );
    });

    it( 'dynamically imports ESM dist/index.js successfully', async () =>
    {
        const indexEsm = await import( path.join( root, 'dist/index.js' ));

        expect( typeof indexEsm.Server ).toBe( 'function' );
        expect( typeof indexEsm.Controller ).toBe( 'function' );
    });

    it( 'exposes the same Server constructor shape over ESM and CJS', async () =>
    {
        const esm = await import( path.join( root, 'dist/index.js' ));
        const cjs = require( path.join( root, 'dist/index.cjs' ));

        expect( esm.Server.name ).toBe( cjs.Server.name );
        expect( Object.keys( esm ).sort()).toEqual( Object.keys( cjs ).sort());
    });
});
