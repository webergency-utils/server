/**
 * Cross-runtime adapter smoke: real listen() + HTTP fetch + WebSocket echo.
 * Run against built dist so Node / Bun / Deno share one entry:
 *
 *   npm run build
 *   node scripts/runtime-smoke.mjs
 *   bun  scripts/runtime-smoke.mjs
 *   deno run --allow-net --allow-env --allow-read --node-modules-dir=manual --min-dep-age=0 scripts/runtime-smoke.mjs
 */
import { Server, MetadataStore } from '../dist/index.js';

function detectRuntime()
{
    if( globalThis.Bun ){ return 'Bun' }

    if( globalThis.Deno ){ return 'Deno' }

    return 'Node';
}

function assert( condition, message )
{
    if( !condition )
    {
        throw new Error( message );
    }
}

function waitForOpen( ws )
{
    return new Promise(( resolve, reject ) =>
    {
        const timer = setTimeout(() => reject( new Error( 'WebSocket open timeout' )), 5000 );
        ws.addEventListener( 'open', () =>
        {
            clearTimeout( timer );
            resolve();
        }, { once : true });
        ws.addEventListener( 'error', ( err ) =>
        {
            clearTimeout( timer );
            reject( err?.error || err || new Error( 'WebSocket error' ));
        }, { once : true });
    });
}

function waitForMessage( ws )
{
    return new Promise(( resolve, reject ) =>
    {
        const timer = setTimeout(() => reject( new Error( 'WebSocket message timeout' )), 5000 );
        ws.addEventListener( 'message', ( event ) =>
        {
            clearTimeout( timer );
            resolve( event.data );
        }, { once : true });
    });
}

async function main()
{
    const runtime = detectRuntime();
    const port = Number( process.env.SMOKE_PORT || 3899 );

    console.log( `[runtime-smoke] starting on ${runtime} :${port}` );

    MetadataStore.clear();

    const controller =
    {
        hello : () => ({ ok : true, runtime }),
        echo  : ( ws ) =>
        {
            ws.on( 'message', ( msg ) =>
            {
                ws.send( `Echo: ${msg}` );
            });
        }
    };

    MetadataStore.registerController( 'RuntimeSmokeController', controller );
    MetadataStore.registerEndpoint({
        controller   : 'RuntimeSmokeController',
        methodName   : 'hello',
        httpMethod   : 'GET',
        path         : '/smoke/hello',
        params       : [],
        guards       : [],
        interceptors : [],
        meta         : {}
    });
    MetadataStore.registerEndpoint({
        controller   : 'RuntimeSmokeController',
        methodName   : 'echo',
        httpMethod   : 'WS',
        path         : '/smoke/ws',
        params       : [{ source : 'WebSocket' }],
        guards       : [],
        interceptors : [],
        meta         : {}
    });

    const server = new Server({ port, logs : false });
    await server.start();

    try
    {
        const httpRes = await fetch( `http://127.0.0.1:${port}/smoke/hello` );
        assert( httpRes.status === 200, `HTTP status ${httpRes.status}` );
        const body = await httpRes.json();
        assert( body.ok === true, 'HTTP body.ok' );
        assert( body.runtime === runtime, `expected runtime ${runtime}, got ${body.runtime}` );
        console.log( '[runtime-smoke] HTTP ok' );

        assert( typeof WebSocket === 'function', 'global WebSocket is required' );
        const ws = new WebSocket( `ws://127.0.0.1:${port}/smoke/ws` );
        await waitForOpen( ws );
        const replyPromise = waitForMessage( ws );
        ws.send( 'hello-runtime' );
        const reply = await replyPromise;
        assert( reply === 'Echo: hello-runtime', `unexpected WS reply: ${reply}` );
        ws.close();
        console.log( '[runtime-smoke] WebSocket ok' );
    }
    finally
    {
        await server.shutdown();
    }

    console.log( `[runtime-smoke] ${runtime} passed` );
}

main().catch(( err ) =>
{
    console.error( '[runtime-smoke] failed:', err );
    process.exitCode = 1;

    if( globalThis.Deno )
    {
        globalThis.Deno.exit( 1 );
    }
    else if( typeof process !== 'undefined' )
    {
        process.exit( 1 );
    }
});
