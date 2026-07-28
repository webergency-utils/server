import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { transformSource, getProgramFor } from '../compiler/register.js';

let dir : string;

function write( name: string, contents: string ): string
{
    const file = path.join( dir, name );
    fs.writeFileSync( file, contents );

    return file;
}

/** Push a file's mtime into the future so the change is visible regardless of clock resolution. */
function touch( file: string, offsetMs: number ): void
{
    const when = new Date( Date.now() + offsetMs );
    fs.utimesSync( file, when, when );
}

const SOURCE = 'export class Greeter { greet(): string { return \'hi\' } }\n';

describe( 'register', () =>
{
    beforeEach(() =>
    {
        dir = fs.mkdtempSync( path.join( os.tmpdir(), 'weberg-register-' ));
        write( 'tsconfig.json', JSON.stringify({
            compilerOptions : { target : 'ES2022', module : 'ESNext', experimentalDecorators : true }
        }));
    });

    afterEach(() =>
    {
        vi.restoreAllMocks();
        fs.rmSync( dir, { recursive : true, force : true });
    });

    describe( 'transformSource', () =>
    {
        it( 'should pass through files that are not TypeScript', () =>
        {
            // Arrange
            const source = 'export const a = 1;\n';

            // Act
            const output = transformSource( path.join( dir, 'a.js' ), source );

            // Assert
            expect( output ).toBe( source );
        });

        it( 'should strip types so Node can execute the result', () =>
        {
            // Arrange
            const file = write( 'greeter.ts', SOURCE );

            // Act
            const output = transformSource( file, SOURCE );

            // Assert
            expect( output ).toContain( 'class Greeter' );
            expect( output ).not.toContain( ': string' );
        });

        it( 'should reflect the new contents after the source file is modified', () =>
        {
            // Arrange
            const file = write( 'greeter.ts', SOURCE );
            transformSource( file, SOURCE );

            // Act
            const updated = SOURCE.replace( 'hi', 'hello' );
            write( 'greeter.ts', updated );
            touch( file, 5_000 );

            // Assert
            expect( transformSource( file, updated )).toContain( 'hello' );
        });
    });

    describe( 'getProgramFor', () =>
    {
        it( 'should reuse the cached program while nothing changes on disk', () =>
        {
            // Arrange
            const file = write( 'greeter.ts', SOURCE );

            // Act
            const first = getProgramFor( file );
            const second = getProgramFor( file );

            // Assert
            expect( second ).toBe( first );
        });

        it( 'should rebuild the program after the source file is modified', () =>
        {
            // Arrange
            const file = write( 'greeter.ts', SOURCE );
            const first = getProgramFor( file );

            // Act
            write( 'greeter.ts', SOURCE.replace( 'hi', 'hello' ));
            touch( file, 5_000 );

            // Assert
            const second = getProgramFor( file );
            expect( second ).not.toBe( first );
            expect( second.getSourceFile( file )?.text ).toContain( 'hello' );
        });

        it( 'should rebuild the program after tsconfig.json is modified', () =>
        {
            // Arrange
            const file = write( 'greeter.ts', SOURCE );
            const first = getProgramFor( file );

            // Act
            touch( path.join( dir, 'tsconfig.json' ), 5_000 );

            // Assert
            expect( getProgramFor( file )).not.toBe( first );
        });
    });
});
