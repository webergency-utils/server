import { Router } from '../src/core/router.js';
import { EndpointMetadata, Method } from '../src/core/types.js';
import { createBench, report } from './support.js';

/** Even values only — the fixture alternates static and parametric paths. */
const SIZES = [10, 100, 1000];

interface Fixture {
    router    : Router
    staticHit : string
    paramHit  : string
    miss      : string
}

function endpoint( httpMethod: Method, path: string, methodName: string ): EndpointMetadata
{
    return {
        controller   : 'BenchController',
        methodName,
        httpMethod,
        path,
        params       : [],
        guards       : [],
        interceptors : [],
        middlewares  : [],
        meta         : {}
    } as EndpointMetadata;
}

/** Fixed-width segments keep every literal length equal, so specificity ties fall back on registration order. */
function segment( index: number ): string
{
    return `resource-${String( index ).padStart( 4, '0' )}`;
}

function fixture( size: number ): Fixture
{
    const router = new Router();

    for( let i = 0; i < size; i++ )
    {
        const path = i % 2 === 0 ? `/api/v1/${segment( i )}/list` : `/api/v1/${segment( i )}/:id/detail`;

        router.add( endpoint( 'GET', path, `handler${i}` ));
    }
    router.compile();

    // The last registered pair sorts last in the parametric bucket, which is the worst case for its linear scan.
    return {
        router,
        staticHit : `/api/v1/${segment( size - 2 )}/list`,
        paramHit  : `/api/v1/${segment( size - 1 )}/7/detail`,
        miss      : '/api/v1/unregistered/path'
    };
}

export async function routerSuite(): Promise<void>
{
    for( const size of SIZES )
    {
        const { router, staticHit, paramHit, miss } = fixture( size );
        const bench = createBench();

        bench
            .add( 'lookup static hit', () => router.lookup( 'GET', staticHit ))
            .add( 'lookup parametric hit', () => router.lookup( 'GET', paramHit ))
            .add( 'lookup miss', () => router.lookup( 'GET', miss ));

        await report( `Routing (${size} registered routes)`, bench );
    }
}
