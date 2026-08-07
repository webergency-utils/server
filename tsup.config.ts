import { defineConfig } from 'tsup';

export default defineConfig({
    entry :
    {
        index                  : 'src/index.ts',
        'compiler/transformer' : 'src/compiler/transformer.ts',
        'compiler/register'    : 'src/compiler/register.ts',
        'compiler/cli'         : 'src/compiler/cli.ts'
    },
    format    : ['cjs', 'esm'],
    dts       : true,
    sourcemap : true,
    clean     : true,
    shims     : true,
    splitting : false,
    external  : [
        'typescript',
        '@webergency-utils/typechecker',
        '@webergency-utils/typechecker/runtime',
        '@webergency-utils/typechecker/transformer'
    ],
    esbuildOptions( options )
    {
        options.packages = 'external';
    }
});
