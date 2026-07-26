import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = path.dirname( fileURLToPath( import.meta.url ));

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
        include     : ['src/tests/**/*.test.ts'],
        coverage    : {
            provider : 'v8',
            reporter : ['text', 'json', 'html'],
            include  : ['src/**/*.ts'],
            exclude  : ['src/**/*.test.ts', 'src/cli.ts', 'src/transformer.ts', 'src/fuzz-runtime.ts']
        }
    }
});
