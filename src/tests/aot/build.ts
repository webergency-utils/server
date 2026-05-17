import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import { transformer, createRegistry, generateManifestCode } from '../../transformer.js';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function runAot() {
    const controllerPath = path.resolve(__dirname, 'controllers.ts');
    const manifestPath = path.resolve(__dirname, '_manifest.js');
    const serverRoot = path.resolve(__dirname, '../../index.ts');

    const registry = createRegistry();
    
    // We include both the server root and the controller to ensure all types are resolvable
    const program = ts.createProgram([serverRoot, controllerPath], {
        experimentalDecorators: true,
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        skipLibCheck: true
    });

    const analyzer = transformer(program, registry)({} as any);
    
    // We need to analyze the controller file
    const source = program.getSourceFile(controllerPath);
    if (source) {
        analyzer(source);
    } else {
        throw new Error(`Could not find source file: ${controllerPath}`);
    }

    const manifestCode = generateManifestCode(registry, new Map(), manifestPath);
    fs.writeFileSync(manifestPath, manifestCode);
    return manifestPath;
}

if (import.meta.url.endsWith('build.ts')) {
    runAot();
    console.log('Build complete');
}
