import ts from 'typescript';
import { transformer, createRegistry } from './src/transformer.js';
import * as path from 'path';
import * as fs from 'fs';

const code = `
import { Controller, Post, Body, Query, Get } from '@webergency-utils/server';

export interface User {
    name: string;
    age: number;
}

@Controller('/users')
export class UserController {
    @Post('/strict')
    createStrict(@Body('strict') data: User) {
        return data;
    }

    @Post('/strip')
    createStrip(@Body('strip') data: User) {
        return data;
    }

    @Get('/search')
    search(@Query('q', 'strip') q: string) {
        return q;
    }
}
`;

const fileName = 'test-controller.ts';
const sourceFile = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true);

const program = ts.createProgram([fileName], {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.Latest,
    experimentalDecorators: true,
    emitDecoratorMetadata: true
}, {
    getSourceFile: (name) => name === fileName ? sourceFile : undefined,
    writeFile: () => {},
    getDefaultLibFileName: () => 'lib.d.ts',
    useCaseSensitiveFileNames: () => true,
    getCanonicalFileName: (f) => f,
    getCurrentDirectory: () => process.cwd(),
    getNewLine: () => '\n',
    fileExists: (f) => f === fileName,
    readFile: (f) => f === fileName ? code : undefined,
    directoryExists: () => true,
    getDirectories: () => []
});

const registry = createRegistry();
const transformerFactory = transformer(program, registry);
ts.transform(sourceFile, [transformerFactory]);

console.log(JSON.stringify(registry.endpoints, null, 2));
