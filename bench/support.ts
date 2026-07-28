import { Bench, Task } from 'tinybench';

const NAME_WIDTH = 34;
const OPS = new Intl.NumberFormat( 'en-US', { maximumFractionDigits : 0 });

/** Short cycles: the whole suite has to stay cheap enough to run on every push. */
export function createBench(): Bench
{
    return new Bench({ time : 250, warmup : true, warmupTime : 50 });
}

function format( task: Task ): string
{
    const result = task.result;
    const name = task.name.padEnd( NAME_WIDTH );

    if( !result || !( 'latency' in result ))
    {
        return `${name} no result`;
    }

    const ops = OPS.format( result.throughput.mean ).padStart( 12 );
    const micros = ( result.latency.mean * 1000 ).toFixed( 3 ).padStart( 10 );

    return `${name} ${ops} ops/s  ${micros} us/op  +-${result.latency.rme.toFixed( 2 )}%`;
}

export async function report( title: string, bench: Bench ): Promise<void>
{
    await bench.run();

    console.log( `\n${title}` );
    console.log( '-'.repeat( title.length ));

    for( const task of bench.tasks ){ console.log( `  ${format( task )}` ) }
}
