import { Server } from '../src/server.js';
import { WEBERGENCY_CONTROLLER } from '../src/core/symbols.js';
import { createBench, report } from './support.js';

class BenchHttpController
{
    ping()
    {
        return { ok : true };
    }

    getUser( id: string, tab?: string )
    {
        return { id, tab : tab ?? 'overview' };
    }

    createUser( body: { name : string, age : number })
    {
        return { created : true, name : body.name, age : body.age };
    }
}

( BenchHttpController as any )[WEBERGENCY_CONTROLLER] = {
    prefix       : '/api',
    guards       : [],
    interceptors : [],
    middlewares  : [],
    meta         : {},
    validators   : {},
    parsers      : {
        idStr   : ( raw: string ) => String( raw ),
        bodyObj : ( raw: string ) => JSON.parse( raw )
    },
    parsersQuery : {},
    serializers  : {
        pingOut : ( val: { ok : boolean }) => `{"ok":${val.ok}}`,
        userOut : ( val: { id : string, tab : string }) => JSON.stringify( val )
    },
    branchSerializers : [],
    endpoints         : [
        {
            methodName           : 'ping',
            httpMethod           : 'GET',
            path                 : '/ping',
            params               : [],
            guards               : [],
            interceptors         : [],
            middlewares          : [],
            meta                 : {},
            returnTypeSerializer : 'pingOut'
        },
        {
            methodName : 'getUser',
            httpMethod : 'GET',
            path       : '/users/:id',
            params     : [
                { source : 'Param', name : 'id', parser : 'idStr' },
                { source : 'Query', name : 'tab', optional : true, parser : 'idStr' }
            ],
            guards               : [],
            interceptors         : [],
            middlewares          : [],
            meta                 : {},
            returnTypeSerializer : 'userOut'
        },
        {
            methodName : 'createUser',
            httpMethod : 'POST',
            path       : '/users',
            params     : [
                { source : 'Body', parser : 'bodyObj' }
            ],
            guards       : [],
            interceptors : [],
            middlewares  : [],
            meta         : {}
        }
    ]
};

export async function httpSuite(): Promise<void>
{
    const server = new Server({
        port        : 0,
        signals     : false,
        controllers : [BenchHttpController]
    });
    await server.ensureReady();

    const staticReq = new Request( 'http://localhost/api/ping', {
        headers : { 'x-request-id' : 'bench-req-1' }
    });
    const paramReq = new Request( 'http://localhost/api/users/42?tab=activity', {
        headers : { 'x-request-id' : 'bench-req-2' }
    });
    const postPayload = '{"name":"Ada","age":36}';

    const bench = createBench();

    bench
        .add( 'GET static JSON (AOT serializer)', async () =>
        {
            await server.fetch( staticReq );
        })
        .add( 'GET :id + ?query (AOT parser + serializer)', async () =>
        {
            await server.fetch( paramReq );
        })
        .add( 'POST JSON body', async () =>
        {
            await server.fetch( new Request( 'http://localhost/api/users', {
                method  : 'POST',
                headers : {
                    'content-type' : 'application/json',
                    'x-request-id' : 'bench-req-3'
                },
                body : postPayload
            }));
        });

    await report( 'HTTP pipeline (server.fetch)', bench );
}
