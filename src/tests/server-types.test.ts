import { describe, it, expect } from 'vitest';
import { Server } from '../server.js';
import { seedInstanceController } from '../testing.js';
import { validators } from '@webergency-utils/typechecker';

describe( 'Server Type Safety (Strict, Relaxed, Strip)', () =>
{
    describe( 'Strict Mode (Default)', () =>
    {
        it( 'should reject unknown properties', async () =>
        {
            const userValidator = ( v: any, path: string, ctx: any ) =>
            {
                if( !validators.object( v, path, ctx, ['name', 'age'])) { return v }
                validators.props( v, v, path, ctx, [
                    ['name', false, validators.string],
                    ['age', false, validators.number]
                ]);

                return v;
            };

            const server = new Server({ port : 3000 });
            seedInstanceController( server.registry, 'TestCtrl', {
                test : ( body: any ) => body
            }, [{
                methodName : 'test',
                httpMethod : 'POST',
                path       : '/strict',
                params     : [{ source : 'Body', validator : userValidator, mode : 'strict' }]
            }]);

            const res1 = await server.fetch( new Request( 'http://localhost/strict', {
                method  : 'POST',
                body    : JSON.stringify({ name : 'John', age : 30 }),
                headers : { 'Content-Type' : 'application/json' }
            }));
            expect( res1.status ).toBe( 200 );

            const res2 = await server.fetch( new Request( 'http://localhost/strict', {
                method  : 'POST',
                body    : JSON.stringify({ name : 'John', age : 30, unknown : 'prop' }),
                headers : { 'Content-Type' : 'application/json' }
            }));
            expect( res2.status ).toBe( 400 );
            const data2 = await res2.json();
            expect( data2.errors[0].error ).toContain( 'PropertyNotAllowed<unknown>' );
        });
    });

    describe( 'Relaxed Mode', () =>
    {
        it( 'should allow unknown properties and keep them', async () =>
        {
            const userValidator = ( v: any, path: string, ctx: any ) =>
            {
                if( !validators.object( v, path, ctx, ['name'])) { return v }
                validators.props( v, v, path, ctx, [
                    ['name', false, validators.string]
                ]);

                return v;
            };

            const server = new Server({ port : 3000 });
            seedInstanceController( server.registry, 'TestCtrl', {
                test : ( body: any ) => body
            }, [{
                methodName : 'test',
                httpMethod : 'POST',
                path       : '/relaxed',
                params     : [{ source : 'Body', validator : userValidator, mode : 'relaxed' }]
            }]);

            const res = await server.fetch( new Request( 'http://localhost/relaxed', {
                method  : 'POST',
                body    : JSON.stringify({ name : 'John', unknown : 'prop' }),
                headers : { 'Content-Type' : 'application/json' }
            }));
            expect( res.status ).toBe( 200 );
            const data = await res.json();
            expect( data.name ).toBe( 'John' );
            expect( data.unknown ).toBe( 'prop' );
        });
    });

    describe( 'Strip Mode', () =>
    {
        it( 'should allow unknown properties but remove them', async () =>
        {
            const userValidator = ( v: any, path: string, ctx: any ) =>
            {
                if( !validators.object( v, path, ctx, ['name'])) { return v }
                const data = ctx.mode === 'strip' ? {} : v;
                validators.props( v, data, path, ctx, [
                    ['name', false, validators.string]
                ]);

                return data;
            };

            const server = new Server({ port : 3000 });
            seedInstanceController( server.registry, 'TestCtrl', {
                test : ( body: any ) => body
            }, [{
                methodName : 'test',
                httpMethod : 'POST',
                path       : '/strip',
                params     : [{ source : 'Body', validator : userValidator, mode : 'strip' }]
            }]);

            const res = await server.fetch( new Request( 'http://localhost/strip', {
                method  : 'POST',
                body    : JSON.stringify({ name : 'John', unknown : 'prop' }),
                headers : { 'Content-Type' : 'application/json' }
            }));
            expect( res.status ).toBe( 200 );
            const data = await res.json();
            expect( data.name ).toBe( 'John' );
            expect( data.unknown ).toBeUndefined();
        });
    });

    describe( 'Unions', () =>
    {
        it( 'should validate unions correctly in different modes', async () =>
        {
            const unionValidator = ( v: any, path: string, ctx: any ) =>
            {
                return validators.union( v, path, ctx, [
                    ( v: any, p: string, c: any ) =>
                    {
                        if( !validators.object( v, p, c, ['type', 'a'])) { return v }
                        const data = c.mode === 'strip' ? {} : v;
                        validators.props( v, data, p, c, [
                            ['type', false, ( v: any, p: string, c: any ) => validators.literal( v, p, c, 'a' )],
                            ['a', false, validators.string]
                        ]);

                        return data;
                    },
                    ( v: any, p: string, c: any ) =>
                    {
                        if( !validators.object( v, p, c, ['type', 'b'])) { return v }
                        const data = c.mode === 'strip' ? {} : v;
                        validators.props( v, data, p, c, [
                            ['type', false, ( v: any, p: string, c: any ) => validators.literal( v, p, c, 'b' )],
                            ['b', false, validators.number]
                        ]);

                        return data;
                    }
                ]);
            };

            const server = new Server({ port : 3000 });
            seedInstanceController( server.registry, 'UnionCtrl', {
                test : ( body: any ) => body
            }, [{
                methodName : 'test',
                httpMethod : 'POST',
                path       : '/union-strip',
                params     : [{ source : 'Body', validator : unionValidator, mode : 'strip' }]
            }]);

            const res1 = await server.fetch( new Request( 'http://localhost/union-strip', {
                method  : 'POST',
                body    : JSON.stringify({ type : 'a', a : 'hello', extra : 123 }),
                headers : { 'Content-Type' : 'application/json' }
            }));
            expect( res1.status ).toBe( 200 );
            const data1 = await res1.json();
            expect( data1 ).toEqual({ type : 'a', a : 'hello' });

            const res2 = await server.fetch( new Request( 'http://localhost/union-strip', {
                method  : 'POST',
                body    : JSON.stringify({ type : 'b', b : 42, extra : 123 }),
                headers : { 'Content-Type' : 'application/json' }
            }));
            expect( res2.status ).toBe( 200 );
            const data2 = await res2.json();
            expect( data2 ).toEqual({ type : 'b', b : 42 });

            const res3 = await server.fetch( new Request( 'http://localhost/union-strip', {
                method  : 'POST',
                body    : JSON.stringify({ type : 'c' }),
                headers : { 'Content-Type' : 'application/json' }
            }));
            expect( res3.status ).toBe( 400 );
        });
    });
});
