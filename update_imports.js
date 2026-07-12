import fs from 'fs';
import path from 'path';

const filesToUpdate =
[
    { file : 'dist/compiler/transformer.js', relativePath : './ts.js', isStarImport : false },
    { file : 'dist/compiler/transformer.d.ts', relativePath : './ts.js', isStarImport : false },
    { file : 'dist/compiler/cli.js', relativePath : './ts.js', isStarImport : true },
    { file : 'dist/compiler/swagger.js', relativePath : './ts.js', isStarImport : true },
    { file : 'dist/compiler/swagger.d.ts', relativePath : './ts.js', isStarImport : true }
];

for( const { file, relativePath, isStarImport } of filesToUpdate )
{
    const filePath = path.resolve( file );

    if( fs.existsSync( filePath ))
    {
        let content = fs.readFileSync( filePath, 'utf8' );

        if( isStarImport )
        {
            content = content.replace( "import * as ts from 'typescript';", `import ts from '${relativePath}';` );
        }
        else
        {
            content = content.replace( "import ts from 'typescript';", `import ts from '${relativePath}';` );
        }

        fs.writeFileSync( filePath, content, 'utf8' );
    }
}

console.log( '✅ Imports updated in server dist files' );
