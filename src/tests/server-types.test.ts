import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Server } from '../server.js';
import { MetadataStore } from '../core/metadata.js';
import { validators } from '@webergency-utils/typechecker';

describe('Server Type Safety (Strict, Relaxed, Strip)', () => {
    beforeEach(() => {
        MetadataStore.clear();
    });

    const createTestServer = () => {
        const server = new Server({ port: 3000 });
        (server as any).init();
        return server;
    };

    describe('Strict Mode (Default)', () => {
        it('should reject unknown properties', async () => {
            const userValidator = (v: any, path: string, ctx: any) => {
                if (!validators.object(v, path, ctx, ['name', 'age'])) return v;
                validators.props(v, v, path, ctx, [
                    ['name', false, validators.string],
                    ['age', false, validators.number]
                ]);
                return v;
            };

            MetadataStore.registerController('TestCtrl', {
                test: (body: any) => body
            });
            MetadataStore.registerEndpoint({
                controller: 'TestCtrl',
                methodName: 'test',
                httpMethod: 'POST',
                path: '/strict',
                params: [{ source: 'Body', validator: userValidator, mode: 'strict' }],
                guards: [], interceptors: [], meta: {}
            });

            const server = createTestServer();
            
            // Valid request
            const res1 = await server.fetch(new Request('http://localhost/strict', {
                method: 'POST',
                body: JSON.stringify({ name: 'John', age: 30 }),
                headers: { 'Content-Type': 'application/json' }
            }));
            expect(res1.status).toBe(200);

            // Invalid request (unknown property)
            const res2 = await server.fetch(new Request('http://localhost/strict', {
                method: 'POST',
                body: JSON.stringify({ name: 'John', age: 30, unknown: 'prop' }),
                headers: { 'Content-Type': 'application/json' }
            }));
            expect(res2.status).toBe(400);
            const data2 = await res2.json();
            expect(data2.errors[0].error).toContain('PropertyNotAllowed<unknown>');
        });
    });

    describe('Relaxed Mode', () => {
        it('should allow unknown properties and keep them', async () => {
            const userValidator = (v: any, path: string, ctx: any) => {
                if (!validators.object(v, path, ctx, ['name'])) return v;
                validators.props(v, v, path, ctx, [
                    ['name', false, validators.string]
                ]);
                return v;
            };

            MetadataStore.registerController('TestCtrl', {
                test: (body: any) => body
            });
            MetadataStore.registerEndpoint({
                controller: 'TestCtrl',
                methodName: 'test',
                httpMethod: 'POST',
                path: '/relaxed',
                params: [{ source: 'Body', validator: userValidator, mode: 'relaxed' }],
                guards: [], interceptors: [], meta: {}
            });

            const server = createTestServer();
            
            const res = await server.fetch(new Request('http://localhost/relaxed', {
                method: 'POST',
                body: JSON.stringify({ name: 'John', unknown: 'prop' }),
                headers: { 'Content-Type': 'application/json' }
            }));
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.name).toBe('John');
            expect(data.unknown).toBe('prop');
        });
    });

    describe('Strip Mode', () => {
        it('should allow unknown properties but remove them', async () => {
            const userValidator = (v: any, path: string, ctx: any) => {
                if (!validators.object(v, path, ctx, ['name'])) return v;
                let data = ctx.mode === 'strip' ? {} : v;
                validators.props(v, data, path, ctx, [
                    ['name', false, validators.string]
                ]);
                return data;
            };

            MetadataStore.registerController('TestCtrl', {
                test: (body: any) => body
            });
            MetadataStore.registerEndpoint({
                controller: 'TestCtrl',
                methodName: 'test',
                httpMethod: 'POST',
                path: '/strip',
                params: [{ source: 'Body', validator: userValidator, mode: 'strip' }],
                guards: [], interceptors: [], meta: {}
            });

            const server = createTestServer();
            
            const res = await server.fetch(new Request('http://localhost/strip', {
                method: 'POST',
                body: JSON.stringify({ name: 'John', unknown: 'prop' }),
                headers: { 'Content-Type': 'application/json' }
            }));
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.name).toBe('John');
            expect(data.unknown).toBeUndefined();
        });
    });

    describe('Unions', () => {
        it('should validate unions correctly in different modes', async () => {
            // type Union = { type: 'a', a: string } | { type: 'b', b: number }
            const unionValidator = (v: any, path: string, ctx: any) => {
                return validators.union(v, path, ctx, [
                    (v: any, p: string, c: any) => {
                        if (!validators.object(v, p, c, ['type', 'a'])) return v;
                        let data = c.mode === 'strip' ? {} : v;
                        validators.props(v, data, p, c, [
                            ['type', false, (v: any, p: string, c: any) => validators.literal(v, p, c, 'a')],
                            ['a', false, validators.string]
                        ]);
                        return data;
                    },
                    (v: any, p: string, c: any) => {
                        if (!validators.object(v, p, c, ['type', 'b'])) return v;
                        let data = c.mode === 'strip' ? {} : v;
                        validators.props(v, data, p, c, [
                            ['type', false, (v: any, p: string, c: any) => validators.literal(v, p, c, 'b')],
                            ['b', false, validators.number]
                        ]);
                        return data;
                    }
                ]);
            };

            MetadataStore.registerController('UnionCtrl', {
                test: (body: any) => body
            });

            // Register with strip mode
            MetadataStore.registerEndpoint({
                controller: 'UnionCtrl', methodName: 'test', httpMethod: 'POST', path: '/union-strip',
                params: [{ source: 'Body', validator: unionValidator, mode: 'strip' }],
                guards: [], interceptors: [], meta: {}
            });

            const server = createTestServer();

            // Valid 'a' with extra prop
            const res1 = await server.fetch(new Request('http://localhost/union-strip', {
                method: 'POST',
                body: JSON.stringify({ type: 'a', a: 'hello', extra: 123 }),
                headers: { 'Content-Type': 'application/json' }
            }));
            expect(res1.status).toBe(200);
            const data1 = await res1.json();
            expect(data1).toEqual({ type: 'a', a: 'hello' });

            // Valid 'b' with extra prop
            const res2 = await server.fetch(new Request('http://localhost/union-strip', {
                method: 'POST',
                body: JSON.stringify({ type: 'b', b: 42, extra: 123 }),
                headers: { 'Content-Type': 'application/json' }
            }));
            expect(res2.status).toBe(200);
            const data2 = await res2.json();
            expect(data2).toEqual({ type: 'b', b: 42 });

            // Invalid (no match)
            const res3 = await server.fetch(new Request('http://localhost/union-strip', {
                method: 'POST',
                body: JSON.stringify({ type: 'c' }),
                headers: { 'Content-Type': 'application/json' }
            }));
            expect(res3.status).toBe(400);
        });
    });
});
