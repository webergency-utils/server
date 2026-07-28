/**
 * Benchmark suite for the hot paths of @webergency-utils/server.
 *
 *   npm run bench
 *
 * Reported for information only — the numbers are machine dependent and never gate a build.
 */
import { routerSuite } from './router.bench.js';
import { diSuite } from './di.bench.js';
import { validatorSuite } from './validator.bench.js';

async function main(): Promise<void>
{
    console.log( `@webergency-utils/server benchmarks on node ${process.version}` );

    await routerSuite();
    await diSuite();
    await validatorSuite();
}

main().catch(( error ) =>
{
    console.error( '[bench] failed:', error );
    process.exitCode = 1;
});
