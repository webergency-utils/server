/**
 * Keep only the listed source files in an lcov.info (in-place).
 * Usage: node scripts/filter-lcov.mjs <lcov-path> <SF-suffix> [<SF-suffix>...]
 */
import fs from 'node:fs';

const [,, lcovPath, ...suffixes] = process.argv;

if( !lcovPath || suffixes.length === 0 )
{
    console.error( 'Usage: node scripts/filter-lcov.mjs <lcov-path> <SF-suffix>...' );
    process.exit( 1 );
}

const raw = fs.readFileSync( lcovPath, 'utf8' );
const blocks = raw.split( 'end_of_record\n' );
const kept = [];

for( const block of blocks )
{
    if( !block.trim()){ continue }
    const sf = block.split( '\n' ).find( l => l.startsWith( 'SF:' ));

    if( !sf ){ continue }
    const path = sf.slice( 3 ).replace( /\\/g, '/' );

    if( suffixes.some( s => path.endsWith( s ) || path.includes( `/${s}` ) || path.endsWith( s.replace( /^src\//, '' ))))
    {
        kept.push( block.endsWith( '\n' ) ? block : block + '\n' );
        if( !block.includes( 'end_of_record' ))
        {
            kept[kept.length - 1] += 'end_of_record\n';
        }
    }
}

fs.writeFileSync( lcovPath, kept.join( '' ));
console.log( `Filtered ${lcovPath}: kept ${kept.length} record(s) for ${suffixes.join( ', ' )}` );
