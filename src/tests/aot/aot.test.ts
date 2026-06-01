import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Server } from '../../server.js';
import { MetadataStore } from '../../core/metadata.js';
import { runAot } from './build.js';
import * as path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname( fileURLToPath( import.meta.url ));

describe( 'Actual AOT Integration Test', () => 
{
    let server: Server;

    beforeAll( async () => 
    {
        const manifestPath = runAot();
        MetadataStore.clear();
        await import( `file://${manifestPath}?t=${Date.now()}` );
        server = new Server({ port : 3000 });
        ( server as any ).init();
    });

    it( 'should validate User in STRICT mode', async () => 
    {
        const res = await server.fetch( new Request( 'http://localhost/type-safety/strict', {
            method  : 'POST',
            body    : JSON.stringify({ name : 'John', age : 30, unknown : 'prop' }),
            headers : { 'Content-Type' : 'application/json' }
        }));
        expect( res.status ).toBe( 400 );
        const data = await res.json();
        expect( data.errors[0]).toEqual({
            path  : 'body',
            error : 'PropertyNotAllowed<unknown>',
            value : 'prop'
        });
    });

    it( 'should validate User in STRIP mode', async () => 
    {
        const res = await server.fetch( new Request( 'http://localhost/type-safety/strip', {
            method  : 'POST',
            body    : JSON.stringify({ name : 'John', age : 30, unknown : 'prop' }),
            headers : { 'Content-Type' : 'application/json' }
        }));
        const bodyText = await res.text();
        expect( res.status, bodyText ).toBe( 200 );
        const data = JSON.parse( bodyText );
        expect( data.data.unknown ).toBeUndefined();
    });

    it( 'should validate UNIONS correctly with STRIP mode', async () => 
    {
        const res1 = await server.fetch( new Request( 'http://localhost/type-safety/union', {
            method  : 'POST',
            body    : JSON.stringify({ type : 'simple', val : 'hello', extra : 1 }),
            headers : { 'Content-Type' : 'application/json' }
        }));
        expect( res1.status ).toBe( 200 );
        const data1 = await res1.json();
        expect( data1.data ).toEqual({ type : 'simple', val : 'hello' });

        const res2 = await server.fetch( new Request( 'http://localhost/type-safety/union', {
            method  : 'POST',
            body    : JSON.stringify({ type : 'complex', data : { id : 1, tags : ['a'], other : 2 }, extra : 3 }),
            headers : { 'Content-Type' : 'application/json' }
        }));
        expect( res2.status ).toBe( 200 );
        const data2 = await res2.json();
        expect( data2.data ).toEqual({ type : 'complex', data : { id : 1, tags : ['a'] } });
    });

    it( 'should validate Query Union (Status)', async () => 
    {
        const res1 = await server.fetch( new Request( 'http://localhost/type-safety/status?s=active' ));
        expect( res1.status ).toBe( 200 );
        expect(( await res1.json()).s ).toBe( 'active' );

        const res2 = await server.fetch( new Request( 'http://localhost/type-safety/status?s=invalid' ));
        expect( res2.status ).toBe( 400 );
    });

    it( 'should validate Mixed Array with STRIP mode', async () => 
    {
        const res = await server.fetch( new Request( 'http://localhost/type-safety/mixed-array', {
            method  : 'POST',
            body    : JSON.stringify(['a', 1, 'b', 2]),
            headers : { 'Content-Type' : 'application/json' }
        }));
        expect( res.status ).toBe( 200 );
        expect(( await res.json()).data ).toEqual(['a', 1, 'b', 2]);
    });

    it( 'should validate Nested objects with optional properties', async () => 
    {
        const res1 = await server.fetch( new Request( 'http://localhost/type-safety/nested', {
            method  : 'POST',
            body    : JSON.stringify({ id : 1, tags : ['t1'], user : { name : 'J', age : 20, extra : 1 }, extra : 2 }),
            headers : { 'Content-Type' : 'application/json' }
        }));
        expect( res1.status ).toBe( 200 );
        const data1 = await res1.json();
        expect( data1.data ).toEqual({ id : 1, tags : ['t1'], user : { name : 'J', age : 20 } });

        const res2 = await server.fetch( new Request( 'http://localhost/type-safety/nested', {
            method  : 'POST',
            body    : JSON.stringify({ id : 2, tags : [] }),
            headers : { 'Content-Type' : 'application/json' }
        }));
        expect( res2.status ).toBe( 200 );
        const data2 = await res2.json();
        expect( data2.data ).toEqual({ id : 2, tags : [] });
    });

    it( 'should validate Intersection types', async () => 
    {
        const res = await server.fetch( new Request( 'http://localhost/type-safety/intersection', {
            method  : 'POST',
            body    : JSON.stringify({ a : 'val', b : 123, extra : 'remove' }),
            headers : { 'Content-Type' : 'application/json' }
        }));
        expect( res.status ).toBe( 200 );
        const data = await res.json();
        expect( data.data ).toEqual({ a : 'val', b : 123 });
    });

    it( 'should handle array query parameters with new QueryParser', async () => 
    {
        const res1 = await server.fetch( new Request( 'http://localhost/type-safety/array-query?tags=a&tags=b' ));
        expect( res1.status ).toBe( 200 );
        expect(( await res1.json()).tags ).toEqual(['a', 'b']);

        const res2 = await server.fetch( new Request( 'http://localhost/type-safety/array-query?tags[]=c&tags[]=d' ));
        expect( res2.status ).toBe( 200 );
        expect(( await res2.json()).tags ).toEqual(['c', 'd']);
    });

    it( 'should coerce various boolean types in query parameters', async () => 
    {
        const resFlag = await server.fetch( new Request( 'http://localhost/type-safety/coerce?age=25&active&date=2024-01-01&pattern=/test/&big=123' ));
        const dataFlag = await resFlag.json();
        expect( dataFlag.active ).toBe( true );

        const resMissing = await server.fetch( new Request( 'http://localhost/type-safety/coerce?age=25&date=2024-01-01&pattern=/test/&big=123' ));
        const dataMissing = await resMissing.json();
        expect( dataMissing.active ).toBe( false );

        const truthy = ['true', '1', 'yes', 'on'];
        const falsy = ['false', '0', 'no', 'off'];

        for( const val of truthy ) 
        {
            const res = await server.fetch( new Request( `http://localhost/type-safety/coerce?age=25&active=${val}&date=2024-01-01&pattern=/test/&big=123` ));
            const data = await res.json();
            expect( data.active, `Value "${val}" should be true` ).toBe( true );
        }

        for( const val of falsy ) 
        {
            const res = await server.fetch( new Request( `http://localhost/type-safety/coerce?age=25&active=${val}&date=2024-01-01&pattern=/test/&big=123` ));
            const data = await res.json();
            expect( data.active, `Value "${val}" should be false` ).toBe( false );
        }
    });

    it( 'should coerce primitive types in query parameters', async () => 
    {
        const dateStr = '2024-01-01T00:00:00.000Z';
        const url = `http://localhost/type-safety/coerce?age=25&active=true&date=${dateStr}&pattern=/^test/i&big=123`;
        const res = await server.fetch( new Request( url ));
        expect( res.status ).toBe( 200 );
        const data = await res.json();
        expect( data.age ).toBe( 25 );
        expect( data.active ).toBe( true );
        expect( data.date ).toBe( dateStr );
        expect( data.pattern ).toBe( '/^test/i' );
    });

    it( 'should respect two-phase union validation (no coercion if string matches)', async () => 
    {
        const res = await server.fetch( new Request( 'http://localhost/type-safety/coerce-union?val=123' ));
        expect( res.status ).toBe( 200 );
        const data = await res.json();
        expect( data.val ).toBe( '123' );
        expect( data.type ).toBe( 'string' );
    });

    it( 'should coerce single value to array in query parameters', async () => 
    {
        const res = await server.fetch( new Request( 'http://localhost/type-safety/array-query?tags=a' ));
        expect( res.status ).toBe( 200 );
        const data = await res.json();
        expect( data.tags ).toEqual(['a']);
    });

    it( 'should coerce BigInt in query parameters', async () => 
    {
        const res = await server.fetch( new Request( 'http://localhost/type-safety/coerce?age=25&active=true&date=2024-01-01&pattern=/test/&big=9007199254740991' ));
        expect( res.status ).toBe( 200 );
        const data = await res.json();
        expect( data.big ).toBe( '9007199254740991' );
    });

    it( 'should coerce deep boolean in nested objects when missing', async () => 
    {
        const res = await server.fetch( new Request( 'http://localhost/type-safety/deep-boolean?user[name]=John' ));
        expect( res.status ).toBe( 200 );
        const data = await res.json();
        expect( data.user.active ).toBe( false );
    });

    it( 'should NOT coerce types in Body (should remain strict)', async () => 
    {
        const res1 = await server.fetch( new Request( 'http://localhost/type-safety/strict', {
            method  : 'POST',
            body    : JSON.stringify({ name : 'John', age : '30' }),
            headers : { 'Content-Type' : 'application/json' }
        }));
        expect( res1.status ).toBe( 400 );
        const data1 = await res1.json();
        expect( data1.errors[0]).toEqual({
            path  : 'body.age',
            error : 'Type<number>',
            value : '30'
        });

        const res2 = await server.fetch( new Request( 'http://localhost/type-safety/mixed-array', {
            method  : 'POST',
            body    : JSON.stringify( 'a' ),
            headers : { 'Content-Type' : 'application/json' }
        }));
        expect( res2.status ).toBe( 400 );
        const data2 = await res2.json();
        expect( data2.errors[0]).toEqual({
            path  : 'body',
            error : 'Type<Array>',
            value : 'a'
        });
    });

    it( 'should validate Template Literal Types', async () => 
    {
        const res1 = await server.fetch( new Request( 'http://localhost/type-safety/template-literal?id=id-123' ));
        expect( res1.status ).toBe( 200 );
        const data1 = await res1.json();
        expect( data1.id ).toBe( 'id-123' );

        const res2 = await server.fetch( new Request( 'http://localhost/type-safety/template-literal?id=invalid-123' ));
        expect( res2.status ).toBe( 400 );
        const data2 = await res2.json();
        expect( data2.errors[0].path ).toBe( 'id' );
        expect( data2.errors[0].error ).toContain( 'id-' );
    });

    it( 'should validate Tag-based constraints (MinLength, Minimum)', async () => 
    {
        const res1 = await server.fetch( new Request( 'http://localhost/type-safety/tags?pass=secret123&age=20' ));
        expect( res1.status ).toBe( 200 );
        const data1 = await res1.json();
        expect( data1.pass ).toBe( 'secret123' );

        const res2 = await server.fetch( new Request( 'http://localhost/type-safety/tags?pass=short&age=15' ));
        expect( res2.status ).toBe( 400 );
        const data2 = await res2.json();
        
        // Should report both errors
        expect( data2.errors ).toHaveLength( 2 );
        expect( data2.errors.find(( e: any ) => e.path === 'pass' ).error ).toBe( 'MinLength<8>' );
        expect( data2.errors.find(( e: any ) => e.path === 'age' ).error ).toBe( 'Minimum<18>' );
    });

    describe( 'Expanded Tag Parity', () => 
    {
        it( 'should validate ExclusiveMinimum/Maximum and MultipleOf', async () => 
        {
            const res1 = await server.fetch( new Request( 'http://localhost/tag-parity/number?min=11&max=19&mult=10' ));
            expect( res1.status ).toBe( 200 );

            const res2 = await server.fetch( new Request( 'http://localhost/tag-parity/number?min=10&max=20&mult=7' ));
            expect( res2.status ).toBe( 400 );
            const data2 = await res2.json();
            expect( data2.errors ).toHaveLength( 3 );
            expect( data2.errors.find(( e: any ) => e.path === 'min' ).error ).toBe( 'ExclusiveMinimum<10>' );
            expect( data2.errors.find(( e: any ) => e.path === 'max' ).error ).toBe( 'ExclusiveMaximum<20>' );
            expect( data2.errors.find(( e: any ) => e.path === 'mult' ).error ).toBe( 'MultipleOf<5>' );
        });

        it( 'should validate String Formats (email, uuid, date)', async () => 
        {
            const res1 = await server.fetch( new Request( 'http://localhost/tag-parity/string?email=test@example.com&uuid=550e8400-e29b-41d4-a716-446655440000&date=2024-05-16' ));
            expect( res1.status ).toBe( 200 );

            const res2 = await server.fetch( new Request( 'http://localhost/tag-parity/string?email=invalid&uuid=invalid&date=invalid' ));
            expect( res2.status ).toBe( 400 );
            const data2 = await res2.json();
            expect( data2.errors ).toHaveLength( 3 );
            expect( data2.errors.find(( e: any ) => e.path === 'email' ).error ).toBe( 'Format<email>' );
            expect( data2.errors.find(( e: any ) => e.path === 'uuid' ).error ).toBe( 'Format<uuid>' );
            expect( data2.errors.find(( e: any ) => e.path === 'date' ).error ).toBe( 'Format<date>' );
        });

        it( 'should validate Array Item Counts (MinItems, MaxItems)', async () => 
        {
            const res1 = await server.fetch( new Request( 'http://localhost/tag-parity/array', {
                method  : 'POST',
                headers : { 'Content-Type' : 'application/json' },
                body    : JSON.stringify(['a', 'b'])
            }));
            expect( res1.status ).toBe( 200 );

            const res2 = await server.fetch( new Request( 'http://localhost/tag-parity/array', {
                method  : 'POST',
                headers : { 'Content-Type' : 'application/json' },
                body    : JSON.stringify(['a'])
            }));
            expect( res2.status ).toBe( 400 );
            const data2 = await res2.json();
            expect( data2.errors[0].error ).toBe( 'MinItems<2>' );

            const res3 = await server.fetch( new Request( 'http://localhost/tag-parity/array', {
                method  : 'POST',
                headers : { 'Content-Type' : 'application/json' },
                body    : JSON.stringify(['a', 'b', 'c', 'd'])
            }));
            expect( res3.status ).toBe( 400 );
            const data3 = await res3.json();
            expect( data3.errors[0].error ).toBe( 'MaxItems<3>' );
        });

        it( 'should validate Array Unique Items (UniqueItems)', async () => 
        {
            const res1 = await server.fetch( new Request( 'http://localhost/tag-parity/unique-array', {
                method  : 'POST',
                headers : { 'Content-Type' : 'application/json' },
                body    : JSON.stringify([1, 2, 3])
            }));
            expect( res1.status ).toBe( 200 );

            const res2 = await server.fetch( new Request( 'http://localhost/tag-parity/unique-array', {
                method  : 'POST',
                headers : { 'Content-Type' : 'application/json' },
                body    : JSON.stringify([1, 2, 2])
            }));
            expect( res2.status ).toBe( 400 );
            const data2 = await res2.json();
            expect( data2.errors[0].error ).toBe( 'UniqueItems' );
        });

        it( 'should support custom validator functions with auto-imports', async () => 
        {
            const res1 = await server.fetch( new Request( 'http://localhost/type-safety/custom-validator', {
                method  : 'POST',
                headers : { 'Content-Type' : 'application/json' },
                body    : JSON.stringify({ val : 2 })
            }));
            expect( res1.status ).toBe( 200 );
            const data1 = await res1.json();
            expect( data1.data.val ).toBe( 2 );

            const res2 = await server.fetch( new Request( 'http://localhost/type-safety/custom-validator', {
                method  : 'POST',
                headers : { 'Content-Type' : 'application/json' },
                body    : JSON.stringify({ val : 3 })
            }));
            expect( res2.status ).toBe( 400 );
            const data2 = await res2.json();
            expect( data2.errors[0].error ).toBe( 'Custom<isEvenNumber>' );
        });

        it( 'should correctly apply security config extracted during AOT', async () => 
        {
            const res1 = await server.fetch( new Request( 'http://localhost/secure-controller/default' ));
            expect( res1.status ).toBe( 200 );
            expect( res1.headers.get( 'X-Frame-Options' )).toBe( 'DENY' );

            const res2 = await server.fetch( new Request( 'http://localhost/secure-controller/override' ));
            expect( res2.status ).toBe( 200 );
            expect( res2.headers.get( 'X-Frame-Options' )).toBeNull();
        });

        it( 'should inherit security decorators from base controller', async () => 
        {
            const res1 = await server.fetch( new Request( 'http://localhost/inherited/test' ));
            expect( res1.status ).toBe( 200 );
            expect( res1.headers.get( 'X-Frame-Options' )).toBe( 'DENY' );

            // Should override frameguard: false but still inherit timeout: 500
            const res2 = await server.fetch( new Request( 'http://localhost/inherited/override' ));
            expect( res2.status ).toBe( 200 );
            expect( res2.headers.get( 'X-Frame-Options' )).toBeNull();
        });

        describe( 'Dependency Injection (DI) system', () => 
        {
            it( 'should resolve deep nested constructor, property, and inherited injections', async () => 
            {
                const res = await server.fetch( new Request( 'http://localhost/di/test' ));
                const bodyText = await res.text();
                expect( res.status, `Response error: ${bodyText}` ).toBe( 200 );
                const data = JSON.parse( bodyText );
                expect( data.msg ).toBe( '[LOG] DB URL is mongodb://localhost:27017' );
                expect( data.dbUrl ).toBe( 'mongodb://localhost:27017' );
                expect( data.logged ).toBe( '[LOG] hello' );
            });

            it( 'should resolve parameter injection in endpoint handler method', async () => 
            {
                const res = await server.fetch( new Request( 'http://localhost/di/param-inject' ));
                const bodyText = await res.text();
                expect( res.status, `Response error: ${bodyText}` ).toBe( 200 );
                const data = JSON.parse( bodyText );
                expect( data.dbUrl ).toBe( 'mongodb://localhost:27017' );
            });

            it( 'should resolve DI constructor, property, and parameter injection in Guard', async () => 
            {
                const res = await server.fetch( new Request( 'http://localhost/di/guarded' ));
                const bodyText = await res.text();
                expect( res.status, `Response error: ${bodyText}` ).toBe( 200 );
                const data = JSON.parse( bodyText );
                expect( data.success ).toBe( true );
            });

            it( 'should resolve circular dependency using lazy proxies', () => 
            {
                // Register CircA and CircB which depend on each other
                const CircA = class CircA 
                {
                    static __injections__ = {
                        constructorDeps : ['CircB'],
                        propertyDeps    : {}
                    };
                    constructor( public b: any ) {}
                    getValue() { return 'A' }
                };
                const CircB = class CircB 
                {
                    static __injections__ = {
                        constructorDeps : ['CircA'],
                        propertyDeps    : {}
                    };
                    constructor( public a: any ) {}
                    getValue() { return 'B' }
                };

                MetadataStore.registerProvider( 'CircA', CircA );
                MetadataStore.registerProvider( 'CircB', CircB );

                const circA = MetadataStore.resolve( 'CircA' );
                expect( circA ).toBeDefined();
                expect( circA.b ).toBeDefined();
                expect( circA.b.a ).toBeDefined();
                expect( circA.b.a.getValue()).toBe( 'A' );
            });
        });

        describe( '@Head and @All routing', () => 
        {
            it( 'should handle explicit HEAD requests and return headers with empty body', async () => 
            {
                const res = await server.fetch( new Request( 'http://localhost/type-safety/head-explicit', {
                    method : 'HEAD'
                }));
                expect( res.status ).toBe( 200 );
                expect( await res.text()).toBe( '' );
            });

            it( 'should fallback to GET route for HEAD request and strip response body', async () => 
            {
                const res = await server.fetch( new Request( 'http://localhost/type-safety/get-fallback', {
                    method : 'HEAD'
                }));
                expect( res.status ).toBe( 200 );
                expect( res.headers.get( 'content-type' )).toContain( 'application/json' );
                expect( await res.text()).toBe( '' );
            });

            it( 'should resolve @All routes for multiple HTTP verbs', async () => 
            {
                for( const verb of ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']) 
                {
                    const res = await server.fetch( new Request( 'http://localhost/type-safety/all-verbs', {
                        method : verb
                    }));
                    expect( res.status ).toBe( 200 );
                    const data = await res.json();
                    expect( data.message ).toBe( 'hello from all verbs' );
                }
            });
        });

        describe( 'Return Type Validation and Stripping', () => 
        {
            it( 'should succeed and keep exact return type properties', async () => 
            {
                const res = await server.fetch( new Request( 'http://localhost/return-type/exact' ));
                expect( res.status ).toBe( 200 );
                const data = await res.json();
                expect( data ).toEqual({ name : 'Alice', age : 25 });
            });

            it( 'should strip extra properties from the response object', async () => 
            {
                const res = await server.fetch( new Request( 'http://localhost/return-type/strip' ));
                expect( res.status ).toBe( 200 );
                const data = await res.json();
                expect( data ).toEqual({ name : 'Bob', age : 30 });
                expect( data.extraField ).toBeUndefined();
            });

            it( 'should throw an error (HTTP 500) if the response does not conform to the return type', async () => 
            {
                const res = await server.fetch( new Request( 'http://localhost/return-type/invalid' ));
                expect( res.status ).toBe( 500 );
                const data = await res.json();
                expect( data.success ).toBe( false );
                expect( data.error ).toContain( 'Response validation failed' );
            });

            it( 'should infer union return type and validate correctly', async () => 
            {
                const resA = await server.fetch( new Request( 'http://localhost/return-type/inferred-branch?branch=a' ));
                expect( resA.status ).toBe( 200 );
                expect( await resA.json()).toEqual({ name : 'Jack', age : 50 });

                const resB = await server.fetch( new Request( 'http://localhost/return-type/inferred-branch?branch=b' ));
                expect( resB.status ).toBe( 200 );
                expect( await resB.json()).toEqual({ name : 'Jill', age : 60 });
            });

            it( 'should validate and strip RPC return values', async () => 
            {
                const { RequestProcessor } = await import( '../../core/request-processor.js' );
                const exactMeta = MetadataStore.getEndpoints().find( ep => ep.methodName === 'rpcExact' )!;
                const stripMeta = MetadataStore.getEndpoints().find( ep => ep.methodName === 'rpcStrip' )!;
                const invalidMeta = MetadataStore.getEndpoints().find( ep => ep.methodName === 'rpcInvalid' )!;

                const resExact = await RequestProcessor.executeRpc( exactMeta, {});
                expect( resExact ).toEqual({ name : 'Dave', age : 40 });

                const resStrip = await RequestProcessor.executeRpc( stripMeta, {});
                expect( resStrip ).toEqual({ name : 'Eve', age : 45 });
                expect( resStrip.secret ).toBeUndefined();

                await expect( RequestProcessor.executeRpc( invalidMeta, {})).rejects.toThrow( 'Response validation failed' );
            });

            it( 'should fail validation in strict mode if extra properties are returned', async () => 
            {
                const res = await server.fetch( new Request( 'http://localhost/response-mode-strict/fail' ));
                expect( res.status ).toBe( 500 );
                const data = await res.json();
                expect( data.success ).toBe( false );
                expect( data.error ).toContain( 'Response validation failed' );
            });

            it( 'should support overriding controller-level strict mode to relaxed mode on method', async () => 
            {
                const res = await server.fetch( new Request( 'http://localhost/response-mode-strict/override-relaxed' ));
                expect( res.status ).toBe( 200 );
                const data = await res.json();
                expect( data ).toEqual({ name : 'RelaxedOverride', age : 20, extra : 'kept' });
            });

            it( 'should inherit response validation mode from base controller', async () => 
            {
                const res = await server.fetch( new Request( 'http://localhost/response-mode-inherited/inherited-relaxed' ));
                expect( res.status ).toBe( 200 );
                const data = await res.json();
                expect( data ).toEqual({ name : 'InheritedRelaxed', age : 30, extra : 'inherited-kept' });
            });

            it( 'should support method-level strict mode overriding inherited relaxed mode', async () => 
            {
                const res = await server.fetch( new Request( 'http://localhost/response-mode-inherited/override-strict' ));
                expect( res.status ).toBe( 500 );
                const data = await res.json();
                expect( data.success ).toBe( false );
                expect( data.error ).toContain( 'Response validation failed' );
            });

            it( 'should configure defaultResponseMode when initializing Server', () => 
            {
                const s = new Server({ port : 3999, responseMode : 'strict' });
                expect( MetadataStore.getDefaultResponseMode()).toBe( 'strict' );

                // Reset default response mode
                MetadataStore.setDefaultResponseMode( 'strip' );
            });
        });

        describe( 'Unprotect Decorator', () => 
        {
            it( 'should support class-level Unprotect removing a specific inherited guard', () => 
            {
                const ep = MetadataStore.getEndpoints().find( e => e.path === '/unprotected-class/test' )!;
                expect( ep ).toBeDefined();
                const guardNames = ep.guards.map( g => g.name );
                expect( guardNames ).not.toContain( 'SimpleGuard' );
                expect( guardNames ).toContain( 'AnotherGuard' );
            });

            it( 'should support class-level Unprotect (no params) removing all inherited guards', () => 
            {
                const ep = MetadataStore.getEndpoints().find( e => e.path === '/unprotected-class-all/test' )!;
                expect( ep ).toBeDefined();
                expect( ep.guards ).toHaveLength( 0 );
            });

            it( 'should support method-level Unprotect removing a specific inherited guard', () => 
            {
                const ep = MetadataStore.getEndpoints().find( e => e.path === '/unprotected-method/one' )!;
                expect( ep ).toBeDefined();
                const guardNames = ep.guards.map( g => g.name );
                expect( guardNames ).not.toContain( 'SimpleGuard' );
                expect( guardNames ).toContain( 'AnotherGuard' );
            });

            it( 'should support method-level Unprotect (no params) removing all inherited guards', () => 
            {
                const ep = MetadataStore.getEndpoints().find( e => e.path === '/unprotected-method/all' )!;
                expect( ep ).toBeDefined();
                expect( ep.guards ).toHaveLength( 0 );
            });
        });

        describe( 'Unintercept Decorator', () => 
        {
            it( 'should support class-level Unintercept removing a specific inherited interceptor', () => 
            {
                const ep = MetadataStore.getEndpoints().find( e => e.path === '/unintercepted-class/test' )!;
                expect( ep ).toBeDefined();
                expect( ep.interceptors ).not.toContain( 'SimpleInterceptor' );
                expect( ep.interceptors ).toContain( 'AnotherInterceptor' );
            });

            it( 'should support class-level Unintercept (no params) removing all inherited interceptors', () => 
            {
                const ep = MetadataStore.getEndpoints().find( e => e.path === '/unintercepted-class-all/test' )!;
                expect( ep ).toBeDefined();
                expect( ep.interceptors ).toHaveLength( 0 );
            });

            it( 'should support method-level Unintercept removing a specific inherited interceptor', () => 
            {
                const ep = MetadataStore.getEndpoints().find( e => e.path === '/unintercepted-method/one' )!;
                expect( ep ).toBeDefined();
                expect( ep.interceptors ).not.toContain( 'SimpleInterceptor' );
                expect( ep.interceptors ).toContain( 'AnotherInterceptor' );
            });

            it( 'should support method-level Unintercept (no params) removing all inherited interceptors', () => 
            {
                const ep = MetadataStore.getEndpoints().find( e => e.path === '/unintercepted-method/all' )!;
                expect( ep ).toBeDefined();
                expect( ep.interceptors ).toHaveLength( 0 );
            });
        });

    });

    describe( 'WS & SSE Integration', () => 
    {
        let testServer: Server;
        const port = 3888;

        beforeAll( async () => 
        {
            testServer = new Server({ port, logs : false });
            await testServer.start();
        });

        afterAll( async () => 
        {
            const exitSpy = vi.spyOn( process, 'exit' ).mockImplementation(() => undefined as never );
            await testServer.shutdown();
            exitSpy.mockRestore();
        });

        it( 'should handle SSE stream correctly', async () => 
        {
            const res = await testServer.fetch( new Request( `http://localhost:${port}/realtime/sse` ));
            expect( res.status ).toBe( 200 );
            expect( res.headers.get( 'content-type' )).toBe( 'text/event-stream' );
            
            const reader = res.body!.getReader();
            const decoder = new TextDecoder();
            let content = '';

            while( true ) 
            {
                const { done, value } = await reader.read();

                if( done ) { break }
                content += decoder.decode( value );
            }
            expect( content ).toContain( 'event: update\ndata: {"val":1}\n\n' );
            expect( content ).toContain( 'event: update\ndata: {"val":2}\n\n' );
        });

        it( 'should establish WebSocket connection and echo messages', async () => 
        {
            const ws = new WebSocket( `ws://localhost:${port}/realtime/ws` );
            
            await new Promise<void>(( resolve, reject ) => 
            {
                ws.onopen = () => resolve();
                ws.onerror = ( err ) => reject( err );
            });

            const responsePromise = new Promise<string>(( resolve ) => 
            {
                ws.onmessage = ( event ) => resolve( event.data );
            });

            ws.send( 'Hello from client' );
            const response = await responsePromise;
            expect( response ).toBe( 'Echo: Hello from client' );

            ws.close();
            await new Promise<void>(( resolve ) => 
            {
                ws.onclose = () => resolve();
            });
        });

        it( 'should handle WebSocket path and query parameters', async () => 
        {
            const ws = new WebSocket( `ws://localhost:${port}/realtime/ws-params/vip-room?token=super-secret` );
            
            const welcomePromise = new Promise<string>(( resolve ) => 
            {
                ws.onmessage = ( event ) => resolve( event.data );
            });

            const welcome = await welcomePromise;
            expect( welcome ).toBe( 'Room: vip-room, Token: super-secret' );

            const echoPromise = new Promise<string>(( resolve ) => 
            {
                ws.onmessage = ( event ) => resolve( event.data );
            });

            ws.send( 'ping' );
            const echo = await echoPromise;
            expect( echo ).toBe( 'ping' );

            ws.close();
            await new Promise<void>(( resolve ) => 
            {
                ws.onclose = () => resolve();
            });
        });

        it( 'should enforce maxPayload limits on WebSocket endpoints', async () => 
        {
            const ws = new WebSocket( `ws://localhost:${port}/realtime/ws-limited` );
            
            await new Promise<void>(( resolve, reject ) => 
            {
                ws.onopen = () => resolve();
                ws.onerror = ( err ) => reject( err );
            });

            // Send standard length message (<= 10 bytes)
            const echoPromise = new Promise<string>(( resolve ) => 
            {
                ws.onmessage = ( event ) => resolve( event.data );
            });
            ws.send( '12345' );
            const echo = await echoPromise;
            expect( echo ).toBe( '12345' );

            // Send too large message (> 10 bytes)
            const closePromise = new Promise<{ code : number, reason : string }>(( resolve ) => 
            {
                ws.onclose = ( event ) => resolve({ code : event.code, reason : event.reason });
            });
            ws.send( '123456789012345' );
            const closeEvent = await closePromise;
            expect( closeEvent.code ).toBe( 1009 ); // Message Too Big
        });

        it( 'should close connection on ping/pong heartbeat timeout', async () => 
        {
            const net = await import( 'node:net' );
            const closedPromise = new Promise<void>(( resolve, reject ) => 
            {
                const client = net.connect( port, 'localhost', () => 
                {
                    client.write(
                        'GET /realtime/ws-heartbeat HTTP/1.1\r\n' +
                        'Host: localhost\r\n' +
                        'Upgrade: websocket\r\n' +
                        'Connection: Upgrade\r\n' +
                        'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n' +
                        'Sec-WebSocket-Version: 13\r\n\r\n'
                    );
                    client.resume();
                });
                
                const timeout = setTimeout(() => 
                {
                    client.destroy();
                    reject( new Error( 'Socket did not close on heartbeat timeout' ));
                }, 3000 );

                client.on( 'close', () => 
                {
                    clearTimeout( timeout );
                    resolve();
                });
                client.on( 'error', ( err ) => 
                {
                    clearTimeout( timeout );
                    reject( err );
                });
            });

            await closedPromise;
        });
    });

    describe( 'Middleware Integration', () => 
    {
        it( 'should run simple and callback middlewares in order before guards, and copy headers to response', async () => 
        {
            const res = await server.fetch( new Request( 'http://localhost/middleware-test/both' ));
            expect( res.status ).toBe( 200 );
            const data = await res.json();
            expect( data.one ).toBe( 'active' );
            expect( data.two ).toBe( 'callback-active' );
            expect( res.headers.get( 'x-middleware-res-one' )).toBe( 'response-active' );
            expect( res.headers.get( 'x-middleware-res-two' )).toBe( 'response-callback-active' );
        });

        it( 'should support OverrideUse decorator on method level', async () => 
        {
            const res = await server.fetch( new Request( 'http://localhost/middleware-test/override' ));
            expect( res.status ).toBe( 200 );
            const data = await res.json();
            expect( data.one ).toBe( 'active' );
            expect( data.two ).toBeNull(); // callback middleware was overridden/removed
            expect( res.headers.get( 'x-middleware-res-one' )).toBe( 'response-active' );
            expect( res.headers.get( 'x-middleware-res-two' )).toBeNull();
        });

        it( 'should support Unuse on method level removing specific middlewares', async () => 
        {
            const res = await server.fetch( new Request( 'http://localhost/middleware-unmiddleware/remove-one' ));
            expect( res.status ).toBe( 200 );
            const data = await res.json();
            expect( data.one ).toBeNull(); // simple middleware was removed
            expect( data.two ).toBe( 'callback-active' );
            expect( res.headers.get( 'x-middleware-res-one' )).toBeNull();
            expect( res.headers.get( 'x-middleware-res-two' )).toBe( 'response-callback-active' );
        });

        it( 'should support Unuse on method level removing all middlewares', async () => 
        {
            const res = await server.fetch( new Request( 'http://localhost/middleware-unmiddleware/remove-all' ));
            expect( res.status ).toBe( 200 );
            const data = await res.json();
            expect( data.one ).toBeNull();
            expect( data.two ).toBeNull();
            expect( res.headers.get( 'x-middleware-res-one' )).toBeNull();
            expect( res.headers.get( 'x-middleware-res-two' )).toBeNull();
        });
    });

    describe( 'Guard and Interceptor Execution Order', () => 
    {
        it( 'should run guards before interceptors and bypass interceptors on guard failure', async () => 
        {
            const { CountingInterceptor } = await import( './controllers.compiled.js' );
            CountingInterceptor.callCount = 0;

            const res = await server.fetch( new Request( 'http://localhost/guard-interceptor-order/test' ));
            expect( res.status ).toBe( 403 );
            expect( CountingInterceptor.callCount ).toBe( 0 ); // Interceptor was bypassed
        });
    });

    describe( 'Public Decorator Guard Bypass', () => 
    {
        it( 'should bypass all class and method guards if controller has @Public', async () => 
        {
            const res = await server.fetch( new Request( 'http://localhost/class-public/test' ));
            expect( res.status ).toBe( 200 );
            expect( await res.text() ).toBe( 'ok' );
        });

        it( 'should bypass all class and method guards if method has @Public', async () => 
        {
            const res = await server.fetch( new Request( 'http://localhost/method-public/test' ));
            expect( res.status ).toBe( 200 );
            expect( await res.text() ).toBe( 'ok' );
        });
    });

    describe( 'AOT compiler validation rules', () => 
    {
        it( 'should throw compile error if @Peer is called with parentheses', async () => 
        {
            const { transformer, createRegistry } = await import( '../../compiler/transformer.js' );
            const ts = await import( 'typescript' );
            const fs = await import( 'fs' );
            const path = await import( 'path' );

            const tempFilePath = path.resolve( __dirname, 'temp-peer-error.ts' );
            const sourceCode = `
                import { Controller, Get, Peer } from '../../index.js';
                @Controller('/test')
                class Test {
                    @Get()
                    hello(@Peer() cert: any) {}
                }
            `;

            fs.writeFileSync( tempFilePath, sourceCode );

            const serverRoot = path.resolve( __dirname, '../../index.ts' );
            const registry = createRegistry();
            const program = ts.createProgram([serverRoot, tempFilePath], {
                experimentalDecorators : true,
                target                 : ts.ScriptTarget.ES2022,
                module                 : ts.ModuleKind.NodeNext,
                moduleResolution       : ts.ModuleResolutionKind.NodeNext,
                skipLibCheck           : true
            });

            const sourceFile = program.getSourceFile( tempFilePath );
            const runTransform = () => 
            {
                const compileTransformer = transformer( program, registry )({} as any );
                compileTransformer( sourceFile! );
            };

            try 
            {
                expect( runTransform ).toThrow( /Decorator "@Peer" must not be called with parentheses/ );
            }
            finally 
            {
                if( fs.existsSync( tempFilePath )) 
                {
                    fs.unlinkSync( tempFilePath );
                }
            }
        });
    });
});
