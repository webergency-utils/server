import fs from 'fs';
import path from 'path';

const filesToUpdate =
[
    { file : 'dist/compiler/transformer.js', relativePath : './ts.js' },
    { file : 'dist/compiler/transformer.d.ts', relativePath : './ts.js' },
    { file : 'dist/compiler/cli.js', relativePath : './ts.js' },
    { file : 'dist/compiler/swagger.js', relativePath : './ts.js' },
    { file : 'dist/compiler/swagger.d.ts', relativePath : './ts.js' }
];

for( const { file, relativePath } of filesToUpdate )
{
    const filePath = path.resolve( file );

    if( fs.existsSync( filePath ))
    {
        let content = fs.readFileSync( filePath, 'utf8' );

        content = content.replace(
            /import\s+(?:(?:\*\s+as\s+)?(\w+))\s+from\s+['"]typescript['"];?/g,
            ( match, name ) => `import ${name} from '${relativePath}';`
        );

        fs.writeFileSync( filePath, content, 'utf8' );
    }
}

console.log( '✅ Imports updated in server dist files' );
