/**
 * Cross-runtime full adapter suite.
 * Real listen() + validation + HTTP + SSE + WebSocket against the native adapter.
 * Uses ApplicationRegistry fixtures (same shape as AOT endpoints) so Node / Bun / Deno
 * can share one script without Vitest aliases or the TypeScript compiler.
 *
 *   npm run build
 *   node --import tsx scripts/runtime-suite.mjs   # tsx optional; plain node works
 *   node scripts/runtime-suite.mjs
 *   bun  scripts/runtime-suite.mjs
 *   deno run --allow-net --allow-env --allow-read --node-modules-dir=manual --min-dep-age=0 scripts/runtime-suite.mjs
 */
import { Server } from '../dist/index.js';
import { seedInstanceController } from '../dist/testing.js';
import { validators } from '@webergency-utils/typechecker';

function detectRuntime()
{
    if( globalThis.Bun ){ return 'Bun' }

    if( globalThis.Deno ){ return 'Deno' }

    return 'Node';
}

function env( name, fallback )
{
    if( globalThis.process?.env?.[name] !== undefined )
    {
        return globalThis.process.env[name];
    }

    if( globalThis.Deno?.env?.get )
    {
        return globalThis.Deno.env.get( name ) ?? fallback;
    }

    return fallback;
}

function assert( condition, message )
{
    if( !condition )
    {
        throw new Error( message );
    }
}

function failExit( code )
{
    if( globalThis.Deno?.exit )
    {
        globalThis.Deno.exit( code );
    }
    else if( globalThis.process?.exit )
    {
        globalThis.process.exit( code );
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

function waitForClose( ws )
{
    return new Promise(( resolve ) =>
    {
        ws.addEventListener( 'close', ( event ) => resolve( event ), { once : true });
    });
}

function userValidator( v, path, ctx )
{
    const obj = validators.object( v, path, ctx, [ 'name', 'age' ], 'User' );

    if( obj === false ){ return v }

    const data = validators.objectShell( obj, ctx );
    validators.props( obj, data, path, ctx, [
        [ 'name', false, validators.string ],
        [ 'age', false, validators.number ]
    ]);
    validators.stripExtras( data, ctx, [ 'name', 'age' ]);

    return data;
}

function statusValidator( v, path, ctx )
{
    return validators.union( v, path, ctx, [
        ( x, p, c ) => validators.literal( x, p, c, 'active' ),
        ( x, p, c ) => validators.literal( x, p, c, 'inactive' )
    ]);
}

function registerFixtures( server, runtime )
{
    const controller =
    {
        hello : () => ({ ok : true, runtime }),

        strict : ( data ) => ({ success : true, data }),

        strip : ( data ) => ({ success : true, data }),

        status : ( s ) => ({ success : true, s }),

        arrayQuery : ( tags ) => ({ success : true, tags }),

        coerce : ( age, active, date ) => ({
            success : true,
            age,
            active,
            date : date instanceof Date ? date.toISOString() : date
        }),

        echo : ( ws ) =>
        {
            ws.on( 'message', ( msg ) =>
            {
                ws.send( `Echo: ${msg}` );
            });
        },

        wsParams : ( ws, room, token ) =>
        {
            ws.send( `Room: ${room}, Token: ${token}` );
            ws.on( 'message', ( msg ) =>
            {
                ws.send( msg );
            });
        },

        wsLimited : ( ws ) =>
        {
            ws.on( 'message', ( msg ) =>
            {
                ws.send( msg );
            });
        },

        sse : async function* ()
        {
            yield { event : 'update', data : { val : 1 } };
            yield { event : 'update', data : { val : 2 } };
        }
    };

    const base =
    {
        guards       : [],
        interceptors : [],
        middlewares  : [],
        meta         : {}
    };

    seedInstanceController( server.registry, 'RuntimeSuiteController', controller, [
        {
            ...base,
            methodName : 'hello',
            httpMethod : 'GET',
            path       : '/suite/hello',
            params     : []
        },
        {
            ...base,
            methodName : 'strict',
            httpMethod : 'POST',
            path       : '/suite/strict',
            params     : [{ source : 'Body', name : '', validator : userValidator, mode : 'strict' }]
        },
        {
            ...base,
            methodName : 'strip',
            httpMethod : 'POST',
            path       : '/suite/strip',
            params     : [{ source : 'Body', name : '', validator : userValidator, mode : 'strip' }]
        },
        {
            ...base,
            methodName : 'status',
            httpMethod : 'GET',
            path       : '/suite/status',
            params     : [{ source : 'Query', name : 's', validator : statusValidator, mode : 'strip' }]
        },
        {
            ...base,
            methodName : 'arrayQuery',
            httpMethod : 'GET',
            path       : '/suite/array-query',
            params     : [{
                source    : 'Query',
                name      : 'tags',
                validator : ( v, path, ctx ) => validators.array( v, path, ctx, validators.string ),
                mode      : 'strip'
            }]
        },
        {
            ...base,
            methodName : 'coerce',
            httpMethod : 'GET',
            path       : '/suite/coerce',
            params     : [
                { source : 'Query', name : 'age', validator : validators.number },
                { source : 'Query', name : 'active', validator : validators.boolean },
                { source : 'Query', name : 'date', validator : validators.date }
            ]
        },
        {
            ...base,
            methodName : 'echo',
            httpMethod : 'WS',
            path       : '/suite/ws',
            params     : [{ source : 'WebSocket' }]
        },
        {
            ...base,
            methodName : 'wsParams',
            httpMethod : 'WS',
            path       : '/suite/ws-params/:room',
            params     : [
                { source : 'WebSocket' },
                { source : 'Param', name : 'room', validator : validators.string },
                { source : 'Query', name : 'token', validator : validators.string }
            ]
        },
        {
            ...base,
            methodName : 'wsLimited',
            httpMethod : 'WS',
            path       : '/suite/ws-limited',
            params     : [{ source : 'WebSocket' }],
            meta       : { ws : true, wsOptions : { maxPayload : 10 } }
        },
        {
            ...base,
            methodName : 'sse',
            httpMethod : 'GET',
            path       : '/suite/sse',
            params     : [],
            meta       : { sse : true }
        }
    ]);
}

async function main()
{
    const runtime = detectRuntime();
    const port = Number( env( 'SMOKE_PORT', '3899' ));
    const base = `http://127.0.0.1:${port}`;
    const wsBase = `ws://127.0.0.1:${port}`;

    console.log( `[runtime-suite] ${runtime} starting on :${port}` );

    const server = new Server({ port, logs : false });
    registerFixtures( server, runtime );
    await server.start();

    let passed = 0;

    const check = async ( name, fn ) =>
    {
        await fn();
        passed += 1;
        console.log( `  ✓ ${name}` );
    };

    try
    {
        await check( 'GET hello identifies runtime', async () =>
        {
            const res = await fetch( `${base}/suite/hello` );
            assert( res.status === 200, `status ${res.status}` );
            const data = await res.json();
            assert( data.ok === true, 'ok' );
            assert( data.runtime === runtime, `runtime ${data.runtime}` );
        });

        await check( 'GET status query union accepts active', async () =>
        {
            const res = await fetch( `${base}/suite/status?s=active` );
            assert( res.status === 200, `status ${res.status}` );
            const data = await res.json();
            assert( data.s === 'active', 's=active' );
        });

        await check( 'GET status query union rejects invalid', async () =>
        {
            const res = await fetch( `${base}/suite/status?s=invalid` );
            assert( res.status === 400, `expected 400 got ${res.status}` );
        });

        await check( 'POST strict JSON rejects string age', async () =>
        {
            const res = await fetch( `${base}/suite/strict`, {
                method  : 'POST',
                headers : { 'Content-Type' : 'application/json' },
                body    : JSON.stringify({ name : 'Ada', age : '30' })
            });
            assert( res.status === 400, `expected 400 got ${res.status}` );
        });

        await check( 'POST strict JSON rejects unknown props', async () =>
        {
            const res = await fetch( `${base}/suite/strict`, {
                method  : 'POST',
                headers : { 'Content-Type' : 'application/json' },
                body    : JSON.stringify({ name : 'Ada', age : 30, extra : true })
            });
            assert( res.status === 400, `expected 400 got ${res.status}` );
        });

        await check( 'POST strip JSON strips unknown props', async () =>
        {
            const res = await fetch( `${base}/suite/strip`, {
                method  : 'POST',
                headers : { 'Content-Type' : 'application/json' },
                body    : JSON.stringify({ name : 'Ada', age : 30, extra : true })
            });
            assert( res.status === 200, `status ${res.status}` );
            const data = await res.json();
            assert( data.data.name === 'Ada', 'name' );
            assert( data.data.age === 30, 'age' );
            assert( data.data.extra === undefined, 'extra stripped' );
        });

        await check( 'POST urlencoded body uses from:query coercion', async () =>
        {
            const res = await fetch( `${base}/suite/strict`, {
                method  : 'POST',
                headers : { 'Content-Type' : 'application/x-www-form-urlencoded' },
                body    : 'name=Ada&age=30'
            });
            assert( res.status === 200, `urlencoded status ${res.status}` );
            const data = await res.json();
            assert( data.data.age === 30, `age coerced, got ${data.data.age}` );
        });

        await check( 'GET coerce query primitives', async () =>
        {
            const dateStr = '2024-01-01T00:00:00.000Z';
            const res = await fetch( `${base}/suite/coerce?age=25&active=true&date=${dateStr}` );
            assert( res.status === 200, `status ${res.status}` );
            const data = await res.json();
            assert( data.age === 25, 'age' );
            assert( data.active === true, 'active' );
            assert( data.date === dateStr, `date ${data.date}` );
        });

        await check( 'GET array query wrapArrays', async () =>
        {
            const res = await fetch( `${base}/suite/array-query?tags=a` );
            assert( res.status === 200, `status ${res.status}` );
            const data = await res.json();
            assert( Array.isArray( data.tags ) && data.tags[0] === 'a', `tags ${JSON.stringify( data.tags )}` );
        });

        await check( 'SSE stream over adapter', async () =>
        {
            const res = await fetch( `${base}/suite/sse` );
            assert( res.status === 200, `status ${res.status}` );
            assert( res.headers.get( 'content-type' )?.includes( 'text/event-stream' ), 'sse content-type' );
            const text = await res.text();
            assert( text.includes( 'data: {"val":1}' ), 'sse chunk 1' );
            assert( text.includes( 'data: {"val":2}' ), 'sse chunk 2' );
        });

        await check( 'WebSocket echo', async () =>
        {
            const ws = new WebSocket( `${wsBase}/suite/ws` );
            await waitForOpen( ws );
            const replyP = waitForMessage( ws );
            ws.send( 'hello-runtime' );
            const reply = await replyP;
            assert( reply === 'Echo: hello-runtime', `reply ${reply}` );
            ws.close();
            await waitForClose( ws );
        });

        await check( 'WebSocket path + query params', async () =>
        {
            const ws = new WebSocket( `${wsBase}/suite/ws-params/vip-room?token=super-secret` );
            // Listen before open — server may send the welcome as soon as the socket opens.
            const welcomeP = waitForMessage( ws );
            await waitForOpen( ws );
            const welcome = await welcomeP;
            assert( welcome === 'Room: vip-room, Token: super-secret', `welcome ${welcome}` );
            ws.close();
            await waitForClose( ws );
        });

        await check( 'WebSocket maxPayload', async () =>
        {
            const ws = new WebSocket( `${wsBase}/suite/ws-limited` );
            await waitForOpen( ws );

            const okP = waitForMessage( ws );
            ws.send( '12345' );
            assert( await okP === '12345', 'short payload echoed' );

            const closed = waitForClose( ws );
            ws.send( 'this-is-too-long' );
            const event = await closed;
            assert( event.code === 1009, `expected close 1009 got ${event.code}` );
        });

        console.log( `[runtime-suite] ${runtime} passed (${passed} checks)` );
    }
    finally
    {
        await server.shutdown();
    }
}

main().catch(( err ) =>
{
    console.error( '[runtime-suite] failed:', err );
    failExit( 1 );
});
