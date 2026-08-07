import { describe, it, expect, beforeEach } from 'vitest';
import { Server } from '../src/server.js';
import { seedInstanceController, runWithRegistry } from './helpers/testing.js';
import { validators } from '@webergency-utils/typechecker';
import { Controller, Post, Body, Get, Query } from '../src/decorators.js';

class TypeSafetyController
{
    @Post( '/union' )
    testUnion( @Body() data: any )
    {
        return data;
    }

    @Post( '/nested' )
    testNested( @Body() data: any )
    {
        return data;
    }

    @Get( '/query-union' )
    testQueryUnion( @Query( 'q' ) q: any )
    {
        return q;
    }
}

const registerTypeSafetyEndpoints = ( server: Server, mode: 'strict' | 'relaxed' | 'strip' ) =>
{
    const ctrl = new TypeSafetyController();
    const primitiveUnion = ( v: any, p: string, c: any ) =>
        validators.union( v, p, c, [validators.string, validators.number]);

    const objectUnion = ( v: any, p: string, c: any ) => validators.union( v, p, c, [
        ( v: any, p: string, c: any ) =>
        {
            if( !validators.object( v, p, c, ['type', 'a'])) { return v }
            const d = c.mode === 'strip' ? {} : v;
            validators.props( v, d, p, c, [
                ['type', false, ( v: any, p: string, c: any ) => validators.literal( v, p, c, 'a' )],
                ['a', false, validators.string]
            ]);

            return d;
        },
        ( v: any, p: string, c: any ) =>
        {
            if( !validators.object( v, p, c, ['type', 'b'])) { return v }
            const d = c.mode === 'strip' ? {} : v;
            validators.props( v, d, p, c, [
                ['type', false, ( v: any, p: string, c: any ) => validators.literal( v, p, c, 'b' )],
                ['b', false, validators.number]
            ]);

            return d;
        }
    ]);

    const nestedValidator = ( v: any, p: string, c: any ) =>
    {
        if( !validators.object( v, p, c, ['user', 'status'])) { return v }
        const d = c.mode === 'strip' ? {} : v;
        validators.props( v, d, p, c, [
            ['user', false, ( v: any, p: string, c: any ) =>
            {
                if( !validators.object( v, p, c, ['id'])) { return v }
                const d2 = c.mode === 'strip' ? {} : v;
                validators.props( v, d2, p, c, [
                    ['id', false, ( v: any, p: string, c: any ) => validators.union( v, p, c, [validators.string, validators.number])]
                ]);

                return d2;
            }],
            ['status', false, ( v: any, p: string, c: any ) => validators.union( v, p, c, [
                ( v: any, p: string, c: any ) => validators.literal( v, p, c, 'ok' ),
                ( v: any, p: string, c: any ) => validators.literal( v, p, c, 'fail' )
            ])]
        ]);

        return d;
    };

    seedInstanceController( server.registry, 'TypeSafetyController', ctrl, [
        {
            methodName : 'testUnion',
            httpMethod : 'POST',
            path       : '/union-primitive',
            params     : [{ source : 'Body', validator : primitiveUnion, mode }]
        },
        {
            methodName : 'testUnion',
            httpMethod : 'POST',
            path       : '/union-object',
            params     : [{ source : 'Body', validator : objectUnion, mode }]
        },
        {
            methodName : 'testNested',
            httpMethod : 'POST',
            path       : '/nested',
            params     : [{ source : 'Body', validator : nestedValidator, mode }]
        }
    ]);
};

describe( 'Actual Server & Controllers Integration', () =>
{
    describe( 'STRICT MODE', () =>
    {
        let server: Server;

        beforeEach(() =>
        {
            server = new Server({ port : 3000 });
            registerTypeSafetyEndpoints( server, 'strict' );
        });

        it( 'should reject unknown properties in object union', async () =>
        {
            const res = await server.fetch( new Request( 'http://localhost/union-object', {
                method  : 'POST',
                body    : JSON.stringify({ type : 'a', a : 'hello', unknown : 1 }),
                headers : { 'Content-Type' : 'application/json' }
            }));
            expect( res.status ).toBe( 400 );
            const data = await res.json();
            const hasError = data.errors.some(( e: any ) =>
                ( e.error && e.error.includes( 'PropertyNotAllowed<unknown>' ))
                || ( e.issues && e.issues.some(( i: any ) => i.error && i.error.includes( 'PropertyNotAllowed<unknown>' )))
            );
            expect( hasError ).toBe( true );
        });

        it( 'should accept valid union members', async () =>
        {
            const res = await server.fetch( new Request( 'http://localhost/union-primitive', {
                method  : 'POST',
                body    : JSON.stringify( 'hello' ),
                headers : { 'Content-Type' : 'application/json' }
            }));
            expect( res.status ).toBe( 200 );
            expect( await res.text()).toBe( 'hello' );
        });
    });

    describe( 'RELAXED MODE', () =>
    {
        let server: Server;

        beforeEach(() =>
        {
            server = new Server({ port : 3000 });
            registerTypeSafetyEndpoints( server, 'relaxed' );
        });

        it( 'should allow and keep unknown properties', async () =>
        {
            const res = await server.fetch( new Request( 'http://localhost/union-object', {
                method  : 'POST',
                body    : JSON.stringify({ type : 'b', b : 42, extra : 'prop' }),
                headers : { 'Content-Type' : 'application/json' }
            }));
            expect( res.status ).toBe( 200 );
            const data = await res.json();
            expect( data.extra ).toBe( 'prop' );
            expect( data.b ).toBe( 42 );
        });
    });

    describe( 'STRIP MODE', () =>
    {
        let server: Server;

        beforeEach(() =>
        {
            server = new Server({ port : 3000 });
            registerTypeSafetyEndpoints( server, 'strip' );
        });

        it( 'should strip unknown properties deeply', async () =>
        {
            const payload = {
                user   : { id : 123, secret : 'hide-me' },
                status : 'ok',
                other  : 'remove-me'
            };
            const res = await server.fetch( new Request( 'http://localhost/nested', {
                method  : 'POST',
                body    : JSON.stringify( payload ),
                headers : { 'Content-Type' : 'application/json' }
            }));
            expect( res.status ).toBe( 200 );
            const data = await res.json();
            expect( data.user.id ).toBe( 123 );
            expect( data.user.secret ).toBeUndefined();
            expect( data.status ).toBe( 'ok' );
            expect( data.other ).toBeUndefined();
        });

        it( 'should work with primitive unions and stripping', async () =>
        {
            const res = await server.fetch( new Request( 'http://localhost/union-primitive', {
                method  : 'POST',
                body    : JSON.stringify( 100 ),
                headers : { 'Content-Type' : 'application/json' }
            }));
            expect( res.status ).toBe( 200 );
            expect( await res.json()).toBe( 100 );
        });
    });

    describe( 'Guard Parameter Resolution', () =>
    {
        it( 'should resolve @Cookies, @Cookie, @Headers, @Ip, @Url, @Hostname, @Path in guards', async () =>
        {
            let capturedGuardArgs: any[] = [];

            class ParameterGuard
            {
                async use( cookies: any, cookieSession: any, headers: any, ip: any, url: any, hostname: any, path: any )
                {
                    capturedGuardArgs = [cookies, cookieSession, headers, ip, url, hostname, path];

                    return true;
                }
            }

            class GuardTestController
            {
                @Get( '/guarded-endpoint' )
                testEndpoint()
                {
                    return { ok : true };
                }
            }

            const server = new Server({ port : 3000 });
            runWithRegistry( server.registry, () =>
            {
                server.registry.registerController( 'GuardTestController', new GuardTestController());
                server.registry.registerGuard( 'ParameterGuard', ParameterGuard );
                server.registry.registerEndpoint({
                    controller   : 'GuardTestController',
                    methodName   : 'testEndpoint',
                    httpMethod   : 'GET',
                    path         : '/guarded-endpoint',
                    params       : [],
                    guards       : [{
                        name      : 'ParameterGuard',
                        type      : 'class',
                        params    : [
                            { source : 'Cookies' },
                            { source : 'Cookie', name : 'session' },
                            { source : 'Headers' },
                            { source : 'Ip' },
                            { source : 'Url' },
                            { source : 'Hostname' },
                            { source : 'Path' }
                        ],
                        resolvers : []
                    }],
                    interceptors : [],
                    meta         : {}
                });
            });

            const res = await server.fetch( new Request( 'http://localhost/guarded-endpoint', {
                headers : {
                    'Cookie'          : 'session=abc123xyz; theme=dark',
                    'X-Custom-Header' : 'test-val'
                }
            }));

            expect( res.status ).toBe( 200 );
            expect( capturedGuardArgs ).toHaveLength( 7 );
            expect( capturedGuardArgs[0] ).toEqual({ session : 'abc123xyz', theme : 'dark' });
            expect( capturedGuardArgs[1] ).toBe( 'abc123xyz' );
            expect( capturedGuardArgs[2]['x-custom-header'] ).toBe( 'test-val' );
            expect( capturedGuardArgs[3] ).toBe( '127.0.0.1' );
            expect( capturedGuardArgs[4] ).toBe( 'http://localhost/guarded-endpoint' );
            expect( capturedGuardArgs[5] ).toBe( 'localhost' );
            expect( capturedGuardArgs[6] ).toBe( '/guarded-endpoint' );
        });
    });
});
