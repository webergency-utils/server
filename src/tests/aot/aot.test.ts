import { describe, it, expect, beforeAll } from 'vitest';
import { Server } from '../../server.js';
import { runAot } from './build.js';
import * as path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Actual AOT Integration Test', () => {
    let server: Server;

    beforeAll(async () => {
        const manifestPath = runAot();
        const store = (globalThis as any)['__WEBERGENCY_SERVER_METADATA_STORE__'];
        if (store) {
            store.endpoints = [];
            store.controllers.clear();
        }
        await import(`file://${manifestPath}?t=${Date.now()}`);
        server = new Server({ port: 3000 });
        (server as any).init();
    });

    it('should validate User in STRICT mode', async () => {
        const res = await server.fetch(new Request('http://localhost/type-safety/strict', {
            method: 'POST',
            body: JSON.stringify({ name: 'John', age: 30, unknown: 'prop' }),
            headers: { 'Content-Type': 'application/json' }
        }));
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.errors[0]).toEqual({
            path: 'body',
            expected: 'property not allowed: unknown',
            value: 'prop'
        });
    });

    it('should validate User in STRIP mode', async () => {
        const res = await server.fetch(new Request('http://localhost/type-safety/strip', {
            method: 'POST',
            body: JSON.stringify({ name: 'John', age: 30, unknown: 'prop' }),
            headers: { 'Content-Type': 'application/json' }
        }));
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.data.unknown).toBeUndefined();
    });

    it('should validate UNIONS correctly with STRIP mode', async () => {
        const res1 = await server.fetch(new Request('http://localhost/type-safety/union', {
            method: 'POST',
            body: JSON.stringify({ type: 'simple', val: 'hello', extra: 1 }),
            headers: { 'Content-Type': 'application/json' }
        }));
        expect(res1.status).toBe(200);
        const data1 = await res1.json();
        expect(data1.data).toEqual({ type: 'simple', val: 'hello' });

        const res2 = await server.fetch(new Request('http://localhost/type-safety/union', {
            method: 'POST',
            body: JSON.stringify({ type: 'complex', data: { id: 1, tags: ['a'], other: 2 }, extra: 3 }),
            headers: { 'Content-Type': 'application/json' }
        }));
        expect(res2.status).toBe(200);
        const data2 = await res2.json();
        expect(data2.data).toEqual({ type: 'complex', data: { id: 1, tags: ['a'] } });
    });

    it('should validate Query Union (Status)', async () => {
        const res1 = await server.fetch(new Request('http://localhost/type-safety/status?s=active'));
        expect(res1.status).toBe(200);
        expect((await res1.json()).s).toBe('active');

        const res2 = await server.fetch(new Request('http://localhost/type-safety/status?s=invalid'));
        expect(res2.status).toBe(400);
    });

    it('should validate Mixed Array with STRIP mode', async () => {
        const res = await server.fetch(new Request('http://localhost/type-safety/mixed-array', {
            method: 'POST',
            body: JSON.stringify(['a', 1, 'b', 2]),
            headers: { 'Content-Type': 'application/json' }
        }));
        expect(res.status).toBe(200);
        expect((await res.json()).data).toEqual(['a', 1, 'b', 2]);
    });

    it('should validate Nested objects with optional properties', async () => {
        const res1 = await server.fetch(new Request('http://localhost/type-safety/nested', {
            method: 'POST',
            body: JSON.stringify({ id: 1, tags: ['t1'], user: { name: 'J', age: 20, extra: 1 }, extra: 2 }),
            headers: { 'Content-Type': 'application/json' }
        }));
        expect(res1.status).toBe(200);
        const data1 = await res1.json();
        expect(data1.data).toEqual({ id: 1, tags: ['t1'], user: { name: 'J', age: 20 } });

        const res2 = await server.fetch(new Request('http://localhost/type-safety/nested', {
            method: 'POST',
            body: JSON.stringify({ id: 2, tags: [] }),
            headers: { 'Content-Type': 'application/json' }
        }));
        expect(res2.status).toBe(200);
        const data2 = await res2.json();
        expect(data2.data).toEqual({ id: 2, tags: [] });
    });

    it('should validate Intersection types', async () => {
        const res = await server.fetch(new Request('http://localhost/type-safety/intersection', {
            method: 'POST',
            body: JSON.stringify({ a: 'val', b: 123, extra: 'remove' }),
            headers: { 'Content-Type': 'application/json' }
        }));
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.data).toEqual({ a: 'val', b: 123 });
    });

    it('should handle array query parameters with new QueryParser', async () => {
        const res1 = await server.fetch(new Request('http://localhost/type-safety/array-query?tags=a&tags=b'));
        expect(res1.status).toBe(200);
        expect((await res1.json()).tags).toEqual(['a', 'b']);

        const res2 = await server.fetch(new Request('http://localhost/type-safety/array-query?tags[]=c&tags[]=d'));
        expect(res2.status).toBe(200);
        expect((await res2.json()).tags).toEqual(['c', 'd']);
    });

    it('should coerce various boolean types in query parameters', async () => {
        const resFlag = await server.fetch(new Request('http://localhost/type-safety/coerce?age=25&active&date=2024-01-01&pattern=/test/&big=123'));
        const dataFlag = await resFlag.json();
        expect(dataFlag.active).toBe(true);

        const resMissing = await server.fetch(new Request('http://localhost/type-safety/coerce?age=25&date=2024-01-01&pattern=/test/&big=123'));
        const dataMissing = await resMissing.json();
        expect(dataMissing.active).toBe(false);

        const truthy = ['true', '1', 'yes', 'on'];
        const falsy = ['false', '0', 'no', 'off'];

        for (const val of truthy) {
            const res = await server.fetch(new Request(`http://localhost/type-safety/coerce?age=25&active=${val}&date=2024-01-01&pattern=/test/&big=123`));
            const data = await res.json();
            expect(data.active, `Value "${val}" should be true`).toBe(true);
        }

        for (const val of falsy) {
            const res = await server.fetch(new Request(`http://localhost/type-safety/coerce?age=25&active=${val}&date=2024-01-01&pattern=/test/&big=123`));
            const data = await res.json();
            expect(data.active, `Value "${val}" should be false`).toBe(false);
        }
    });

    it('should coerce primitive types in query parameters', async () => {
        const dateStr = '2024-01-01T00:00:00.000Z';
        const url = `http://localhost/type-safety/coerce?age=25&active=true&date=${dateStr}&pattern=/^test/i&big=123`;
        const res = await server.fetch(new Request(url));
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.age).toBe(25);
        expect(data.active).toBe(true);
        expect(data.date).toBe(dateStr);
        expect(data.pattern).toBe('/^test/i');
    });

    it('should respect two-phase union validation (no coercion if string matches)', async () => {
        const res = await server.fetch(new Request('http://localhost/type-safety/coerce-union?val=123'));
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.val).toBe('123');
        expect(data.type).toBe('string');
    });

    it('should coerce single value to array in query parameters', async () => {
        const res = await server.fetch(new Request('http://localhost/type-safety/array-query?tags=a'));
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.tags).toEqual(['a']);
    });

    it('should coerce BigInt in query parameters', async () => {
        const res = await server.fetch(new Request('http://localhost/type-safety/coerce?age=25&active=true&date=2024-01-01&pattern=/test/&big=9007199254740991'));
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.big).toBe('9007199254740991');
    });

    it('should coerce deep boolean in nested objects when missing', async () => {
        const res = await server.fetch(new Request('http://localhost/type-safety/deep-boolean?user[name]=John'));
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.user.active).toBe(false);
    });

    it('should NOT coerce types in Body (should remain strict)', async () => {
        const res1 = await server.fetch(new Request('http://localhost/type-safety/strict', {
            method: 'POST',
            body: JSON.stringify({ name: 'John', age: '30' }),
            headers: { 'Content-Type': 'application/json' }
        }));
        expect(res1.status).toBe(400);
        const data1 = await res1.json();
        expect(data1.errors[0]).toEqual({
            path: 'body.age',
            expected: 'number',
            value: '30'
        });

        const res2 = await server.fetch(new Request('http://localhost/type-safety/mixed-array', {
            method: 'POST',
            body: JSON.stringify('a'),
            headers: { 'Content-Type': 'application/json' }
        }));
        expect(res2.status).toBe(400);
        const data2 = await res2.json();
        expect(data2.errors[0]).toEqual({
            path: 'body',
            expected: 'array',
            value: 'a'
        });
    });

    it('should validate Template Literal Types', async () => {
        const res1 = await server.fetch(new Request('http://localhost/type-safety/template-literal?id=id-123'));
        expect(res1.status).toBe(200);
        const data1 = await res1.json();
        expect(data1.id).toBe('id-123');

        const res2 = await server.fetch(new Request('http://localhost/type-safety/template-literal?id=invalid-123'));
        expect(res2.status).toBe(400);
        const data2 = await res2.json();
        expect(data2.errors[0].path).toBe('id');
        expect(data2.errors[0].expected).toContain('id-');
    });

    it('should validate Tag-based constraints (MinLength, Minimum)', async () => {
        const res1 = await server.fetch(new Request('http://localhost/type-safety/tags?pass=secret123&age=20'));
        expect(res1.status).toBe(200);
        const data1 = await res1.json();
        expect(data1.pass).toBe('secret123');

        const res2 = await server.fetch(new Request('http://localhost/type-safety/tags?pass=short&age=15'));
        expect(res2.status).toBe(400);
        const data2 = await res2.json();
        
        // Should report both errors
        expect(data2.errors).toHaveLength(2);
        expect(data2.errors.find((e: any) => e.path === 'pass').expected).toBe('MinLength<8>');
        expect(data2.errors.find((e: any) => e.path === 'age').expected).toBe('Minimum<18>');
    });

    describe('Expanded Tag Parity', () => {
        it('should validate ExclusiveMinimum/Maximum and MultipleOf', async () => {
            const res1 = await server.fetch(new Request('http://localhost/tag-parity/number?min=11&max=19&mult=10'));
            expect(res1.status).toBe(200);

            const res2 = await server.fetch(new Request('http://localhost/tag-parity/number?min=10&max=20&mult=7'));
            expect(res2.status).toBe(400);
            const data2 = await res2.json();
            expect(data2.errors).toHaveLength(3);
            expect(data2.errors.find((e: any) => e.path === 'min').expected).toBe('ExclusiveMinimum<10>');
            expect(data2.errors.find((e: any) => e.path === 'max').expected).toBe('ExclusiveMaximum<20>');
            expect(data2.errors.find((e: any) => e.path === 'mult').expected).toBe('MultipleOf<5>');
        });

        it('should validate String Formats (email, uuid, date)', async () => {
            const res1 = await server.fetch(new Request('http://localhost/tag-parity/string?email=test@example.com&uuid=550e8400-e29b-41d4-a716-446655440000&date=2024-05-16'));
            expect(res1.status).toBe(200);

            const res2 = await server.fetch(new Request('http://localhost/tag-parity/string?email=invalid&uuid=invalid&date=invalid'));
            expect(res2.status).toBe(400);
            const data2 = await res2.json();
            expect(data2.errors).toHaveLength(3);
            expect(data2.errors.find((e: any) => e.path === 'email').expected).toBe('Format<email>');
            expect(data2.errors.find((e: any) => e.path === 'uuid').expected).toBe('Format<uuid>');
            expect(data2.errors.find((e: any) => e.path === 'date').expected).toBe('Format<date>');
        });

        it('should validate Array Item Counts (MinItems, MaxItems)', async () => {
            const res1 = await server.fetch(new Request('http://localhost/tag-parity/array', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(['a', 'b'])
            }));
            expect(res1.status).toBe(200);

            const res2 = await server.fetch(new Request('http://localhost/tag-parity/array', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(['a'])
            }));
            expect(res2.status).toBe(400);
            const data2 = await res2.json();
            expect(data2.errors[0].expected).toBe('MinItems<2>');

            const res3 = await server.fetch(new Request('http://localhost/tag-parity/array', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(['a', 'b', 'c', 'd'])
            }));
            expect(res3.status).toBe(400);
            const data3 = await res3.json();
            expect(data3.errors[0].expected).toBe('MaxItems<3>');
        });

        it('should validate Array Unique Items (UniqueItems)', async () => {
            const res1 = await server.fetch(new Request('http://localhost/tag-parity/unique-array', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify([1, 2, 3])
            }));
            expect(res1.status).toBe(200);

            const res2 = await server.fetch(new Request('http://localhost/tag-parity/unique-array', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify([1, 2, 2])
            }));
            expect(res2.status).toBe(400);
            const data2 = await res2.json();
            expect(data2.errors[0].expected).toBe('UniqueItems');
        });

        it('should support custom validator functions with auto-imports', async () => {
            const res1 = await server.fetch(new Request('http://localhost/type-safety/custom-validator', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ val: 2 })
            }));
            expect(res1.status).toBe(200);
            const data1 = await res1.json();
            expect(data1.data.val).toBe(2);

            const res2 = await server.fetch(new Request('http://localhost/type-safety/custom-validator', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ val: 3 })
            }));
            expect(res2.status).toBe(400);
            const data2 = await res2.json();
            expect(data2.errors[0].expected).toBe('Custom<isEvenNumber>');
        });

        it('should correctly apply secure headers extracted during AOT', async () => {
            const res1 = await server.fetch(new Request('http://localhost/secure-controller/default'));
            expect(res1.status).toBe(200);
            expect(res1.headers.get('X-Frame-Options')).toBe('DENY');

            const res2 = await server.fetch(new Request('http://localhost/secure-controller/override'));
            expect(res2.status).toBe(200);
            expect(res2.headers.get('X-Frame-Options')).toBeNull();
        });
    });
});
