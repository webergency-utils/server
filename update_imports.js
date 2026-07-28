import fs from 'fs';
import path from 'path';

/**
 * The compiler modules import `typescript` directly for a readable source tree, but the
 * published build must go through ./ts.js so a TypeScript 6 host can be picked up at
 * runtime. Every emitted compiler file except the shim itself is rewritten.
 */
const compilerDir = path.resolve( 'dist/compiler' );
const skip = new Set([ 'ts.js', 'ts.d.ts' ]);

if( fs.existsSync( compilerDir ))
{
    for( const entry of fs.readdirSync( compilerDir ))
    {
        if( skip.has( entry )) { continue }

        if( !entry.endsWith( '.js' ) && !entry.endsWith( '.d.ts' )) { continue }

        const filePath = path.join( compilerDir, entry );
        const content = fs.readFileSync( filePath, 'utf8' );
        const updated = content.replace(
            /import\s+(?:(?:\*\s+as\s+)?(\w+))\s+from\s+['"]typescript['"];?/g,
            ( match, name ) => `import ${name} from './ts.js';`
        );

        if( updated !== content )
        {
            fs.writeFileSync( filePath, updated, 'utf8' );
        }
    }
}

console.log( '✅ Imports updated in server dist files' );
