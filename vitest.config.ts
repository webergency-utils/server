import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = path.dirname( fileURLToPath( import.meta.url ));
const isBun = typeof ( globalThis as { Bun?: unknown }).Bun !== 'undefined';

export default defineConfig({
    resolve : {
        alias : [
            {
                find        : '@webergency-utils/server/transformer',
                replacement : path.resolve( root, 'src/compiler/transformer.ts' )
            },
            {
                find        : '@webergency-utils/server',
                replacement : path.resolve( root, 'src/index.ts' )
            }
        ]
    },
    test : {
        environment : 'node',
        testTimeout : 20_000,
        include     : ['tests/**/*.test.ts'],
        coverage    : {
            provider : 'v8',
            reporter : ['text', 'json', 'html', 'lcov'],
            include  : ['src/**/*.ts'],
            exclude : [
                '**/*.test.ts',
                'tests/**',
                // Pure type / barrel re-export entrypoints
                'src/index.ts',
                'src/adapters/adapter.ts',
                'src/compiler/transformer.ts',
                // Build / load-time hosts — not part of the runtime library surface
                'src/compiler/cli.ts',
                'src/compiler/register.ts',
                'src/compiler/ts.ts',
                // Cross-runtime adapters: attribute via unit-bun / runtime-deno uploads
                ...( isBun
                    ? ['src/adapters/deno-adapter.ts']
                    : ['src/adapters/bun-adapter.ts', 'src/adapters/deno-adapter.ts'] )
            ]
        }
    }
});
