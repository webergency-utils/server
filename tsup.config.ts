import { defineConfig } from 'tsup';

/**
 * CJS dual-package emit only. ESM + declarations come from `webergency-tsc`
 * (`npm run build:esm`) so Symbol.for / __injections__ AOT is not stripped.
 * Do not enable treeshake or minify — both drop host-class AOT assignments.
 */
export default defineConfig({
    entry :
    {
        index                  : 'src/index.ts',
        'compiler/transformer' : 'src/compiler/transformer.ts',
        'compiler/register'    : 'src/compiler/register.ts',
        'compiler/cli'         : 'src/compiler/cli.ts'
    },
    format    : [ 'cjs' ],
    dts       : { compilerOptions : { stripInternal : true } },
    sourcemap : false,
    clean     : false,
    minify    : false,
    shims     : true,
    splitting : false,
    external  : [
        'typescript',
        '@webergency-utils/typechecker',
        '@webergency-utils/typechecker/runtime',
        '@webergency-utils/typechecker/transformer'
    ],
    esbuildPlugins : [
        {
            name : 'externalize-sibling-transformer',
            setup( build )
            {
                build.onResolve({ filter : /^\.\/transformer\.js$/ }, () => ({
                    path     : './transformer.cjs',
                    external : true
                }));
            }
        }
    ],
    esbuildOptions( options )
    {
        options.packages = 'external';
    }
});
