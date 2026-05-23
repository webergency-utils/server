#!/usr/bin/env node
import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import { transformer, createRegistry, generateManifestCode, discoverFromEntryPoint } from './transformer.js';

const args = process.argv.slice(2);
let entryPoint: string | null = null;
const controllers: string[] = [];
let output = './_metadata.webergency-server.js';
let watch = args.includes('--watch') || args.includes('-w');

// Basic argument parsing
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--output' || args[i] === '-o') {
    output = args[++i];
  } else if (args[i] === '--entry' || args[i] === '-e') {
    entryPoint = args[++i];
  } else if (!args[i].startsWith('-')) {
    controllers.push(args[i]);
  }
}

// Smart discovery helpers
function findEntryPoint(): string | null {
  const common = ['src/index.ts', 'src/main.ts', 'src/boot.ts', 'index.ts', 'main.ts', 'boot.ts', 'tests/boot.ts'];
  for (const p of common) {
    if (fs.existsSync(path.resolve(process.cwd(), p))) return p;
  }
  return null;
}

if (!entryPoint && controllers.length === 0) {
  entryPoint = findEntryPoint();
  if (!entryPoint) {
    console.error('❌ Error: Could not automatically find an entry point (src/index.ts, src/main.ts, etc.).');
    console.log('Usage: npx webergency-server-build [--entry src/main.ts] [--output file.js] [--watch]');
    process.exit(1);
  }
}

const manifestPath = path.resolve(process.cwd(), output);
const absOutput = path.dirname(manifestPath);

if (!fs.existsSync(absOutput)) fs.mkdirSync(absOutput, { recursive: true });

async function runBuild() {
  console.log('\n🚀 Starting AOT Build...');
  const registry = createRegistry();

  // Initialize program with all potential files for discovery
  const initialFiles = entryPoint ? [path.resolve(process.cwd(), entryPoint)] : controllers.map(c => path.resolve(process.cwd(), c));
  let program = ts.createProgram(initialFiles, {
    experimentalDecorators: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    skipLibCheck: true
  });

  let filesToAnalyze = controllers.map(c => path.resolve(process.cwd(), c));

  if (entryPoint) {
    const discovered = discoverFromEntryPoint(program, entryPoint!, registry);
    filesToAnalyze = Array.from(new Set([...filesToAnalyze, ...discovered]));
    
    // Re-create program with discovered files to ensure all symbols are available
    program = ts.createProgram([path.resolve(process.cwd(), entryPoint!), ...filesToAnalyze], {
      experimentalDecorators: true,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      skipLibCheck: true
    });
  }

  const analyzer = transformer(program, registry)({} as any);
  const analyzedFiles = new Set<string>();
  const queue = [...filesToAnalyze];

  while (queue.length > 0) {
    const file = queue.shift()!;
    if (analyzedFiles.has(file)) continue;
    
    const source = program.getSourceFile(file);
    if (source) {
      analyzer(source);
      analyzedFiles.add(file);
      
      for (const info of [...registry.guards.values(), ...registry.interceptors.values(), ...registry.controllers.values(), ...registry.providers.values()]) {
        if (!analyzedFiles.has(info.path)) {
          queue.push(info.path);
        }
      }
    }
  }

  const manifestCode = generateManifestCode(registry, new Map(), manifestPath);
  fs.writeFileSync(manifestPath, manifestCode);
  console.log(`✅ AOT Manifest updated: ${path.basename(manifestPath)}`);

  try {
    const { SwaggerSpecGenerator } = await import('./swagger.js');
    SwaggerSpecGenerator.generate(registry, program, path.dirname(manifestPath));
  } catch (e: any) {
    console.warn('⚠️ Warning: Failed to generate Swagger docs:', e.message);
  }
}

if (watch) {
  console.log('👀 Watching for changes in src/ folder...');
  runBuild();
  let timeout: NodeJS.Timeout | null = null;
  fs.watch(path.resolve(process.cwd(), 'src'), { recursive: true }, (event, filename) => {
    if (filename?.endsWith('.ts')) {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        runBuild();
      }, 100); // Debounce
    }
  });
} else {
  runBuild();
}
