import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Server } from '../../src/index.js';
import { runAot } from './build.js';
import { getControllerMeta, getInjectableMeta } from '../../src/core/symbols.js';

describe( 'AOT Interceptor Error Sanitization', () =>
{
    let server: Server;

    beforeAll( async () =>
    {
        const compiled = runAot();
        const mod = await import( `file://${compiled}?t=${Date.now()}` );
        const classes = Object.values( mod ).filter( v => typeof v === 'function' ) as any[];
        const controllers = classes.filter( c => getControllerMeta( c ));
        const guards = classes.filter( c => getInjectableMeta( c )?.kind === 'guard' );
        const interceptors = classes.filter( c => getInjectableMeta( c )?.kind === 'interceptor' );
        const providers = classes.filter( c => getInjectableMeta( c )?.kind === 'provider' );
        server = new Server({ port : 3001, controllers, guards, interceptors, providers });
    });

    it( 'should sanitize validation errors using interceptor', async () =>
    {
        const res = await server.fetch( new Request( 'http://localhost/type-safety/strict-intercepted', {
            method  : 'POST',
            body    : JSON.stringify({ name : 'John', age : 'invalid' }),
            headers : { 'Content-Type' : 'application/json' }
        }));

        expect( res.status ).toBe( 500 );

        const data = await res.json();
        expect( data.success ).toBe( false );
        expect( data.message ).toBe( 'Internal Server Error' );
        expect( data.errors ).toBeUndefined();
    });
});
