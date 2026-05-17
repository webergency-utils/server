import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Server } from '../server.js';
import { MetadataStore } from '../core/metadata.js';
import { validators } from '@webergency-utils/typechecker';
import { Context } from '../core/context.js';
import { createServer } from 'http';

vi.mock('http', () => ({
    createServer: vi.fn()
}));

describe('Server & Metadata', () => {
    beforeEach(() => {
        // Reset MetadataStore for each test
        const store = (globalThis as any)['__WEBERGENCY_SERVER_METADATA_STORE__'];
        if (store) {
            store.endpoints = [];
            store.controllers.clear();
            store.guards.clear();
            store.interceptors.clear();
        }
    });

    describe('MetadataStore', () => {
        it('should register and retrieve controllers, guards, and interceptors', () => {
            const ctrl = { hello: () => 'world' };
            const guard = { use: () => true };
            const interceptor = { intercept: () => {} };
            
            MetadataStore.registerController('TestCtrl', ctrl);
            MetadataStore.registerGuard('TestGuard', guard);
            MetadataStore.registerInterceptor('TestInt', interceptor);
            
            expect(MetadataStore.getController('TestCtrl')).toBe(ctrl);
            expect(MetadataStore.getGuard('TestGuard')).toBe(guard);
            expect(MetadataStore.getInterceptor('TestInt')).toBe(interceptor);
        });

        it('should register endpoints', () => {
            const ep: any = { controller: 'C', methodName: 'm', path: '/test', httpMethod: 'GET', params: [] };
            MetadataStore.registerEndpoint(ep);
            expect(MetadataStore.getEndpoints()).toContain(ep);
        });
    });

    describe('RequestContext', () => {
        it('should manage async context', async () => {
            const req = { url: 'http://test.com' } as any;
            const meta = { path: '/' } as any;
            const ctx = { request: req, metadata: meta };
            
            await Context.run(ctx, async () => {
                expect(Context.get()).toBe(ctx);
                expect(Context.request).toBe(req);
                expect(Context.metadata).toBe(meta);
            });
            expect(Context.get()).toBeUndefined();
        });
    });

    describe('Runtime Routing', () => {
        it('should handle static and parametric routes', async () => {
            const ctrl = { 
                home: () => 'home',
                user: (id: string) => id 
            };
            MetadataStore.registerController('Ctrl', ctrl);
            MetadataStore.registerEndpoint({
                controller: 'Ctrl', methodName: 'home', httpMethod: 'GET', path: '/', params: [], guards: [], interceptors: [], meta: {}
            });
            MetadataStore.registerEndpoint({
                controller: 'Ctrl', methodName: 'user', httpMethod: 'GET', path: '/users/:id', 
                params: [{ source: 'Param', name: 'id' }], guards: [], interceptors: [], meta: {}
            });

            const server = new Server({ port: 3000 });
            (server as any).init();
            
            const res1 = await server.fetch(new Request('http://localhost/'));
            expect(await res1.text()).toBe('home');

            const res2 = await server.fetch(new Request('http://localhost/users/456'));
            expect(await res2.text()).toBe('456');
        });

        it('should handle OPTIONS and fallback routes', async () => {
            MetadataStore.registerController('C', { post: () => 'ok' });
            MetadataStore.registerEndpoint({
                controller: 'C', methodName: 'post', httpMethod: 'POST', path: '/data', params: [], guards: [], interceptors: [], meta: {}
            });
            const server = new Server({ port: 3000 });
            (server as any).init();
            
            const res = await server.fetch(new Request('http://localhost/data', { method: 'OPTIONS' }));
            expect(res.status).toBe(200);
        });
    });

    describe('Parameter Resolution', () => {
        it('should resolve all sources', async () => {
            const ctrl = {
                test: (query: any, header: any, host: string, url: string, path: string, ip: string, res: any, ctx: any, headers: any) => 
                    ({ query, header, host, url, path, ip, res, ctx, headers })
            };
            MetadataStore.registerController('ParamCtrl', ctrl);
            MetadataStore.registerEndpoint({
                controller: 'ParamCtrl',
                methodName: 'test',
                httpMethod: 'GET',
                path: '/params',
                params: [
                    { source: 'Query', name: 'q' },
                    { source: 'Header', name: 'x-f' },
                    { source: 'Hostname' },
                    { source: 'Url' },
                    { source: 'Path' },
                    { source: 'Ip' },
                    { source: 'Response' },
                    { source: 'Context' },
                    { source: 'Headers' }
                ],
                guards: [], interceptors: [], meta: {}
            });

            const server = new Server({ port: 3000 });
            (server as any).init();
            const res = await server.fetch(new Request('http://example.com/params?q=1', {
                headers: { 'x-f': 'v', 'x-forwarded-for': '1.2.3.4', 'x-test': 'val' }
            }));
            const data = await res.json();
            expect(data.query).toBe('1');
            expect(data.header).toBe('v');
            expect(data.host).toBe('example.com');
            expect(data.url).toBe('http://example.com/params?q=1');
            expect(data.path).toBe('/params');
            expect(data.ip).toBe('1.2.3.4');
            expect(data.res).toBeUndefined();
            expect(data.ctx).toBeDefined();
            expect(data.headers['x-test']).toBe('val');
        });

        it('should handle body and duplex streams', async () => {
            const ctrl = { echo: (body: any) => body };
            MetadataStore.registerController('EchoCtrl', ctrl);
            MetadataStore.registerEndpoint({
                controller: 'EchoCtrl', methodName: 'echo', httpMethod: 'POST', path: '/echo',
                params: [{ source: 'Body' }], guards: [], interceptors: [], meta: {}
            });
            const server = new Server({ port: 3000 });
            (server as any).init();
            
            const res = await server.fetch(new Request('http://localhost/echo', {
                method: 'POST',
                body: JSON.stringify({ a: 1 }),
                headers: { 'Content-Type': 'application/json' }
            }));
            expect(await res.json()).toEqual({ a: 1 });
        });
    });

    describe('Guards & Interceptors', () => {
        it('should execute guards with complex parameters', async () => {
            const guard = { 
                use: vi.fn().mockImplementation((req, body) => {
                    if (body.deny) throw { code: 403, message: 'Denied' };
                })
            };
            MetadataStore.registerGuard('ComplexGuard', guard);
            MetadataStore.registerController('C', { test: () => 'ok' });
            MetadataStore.registerEndpoint({
                controller: 'C', methodName: 'test', httpMethod: 'POST', path: '/complex-g', params: [],
                guards: [{ 
                    name: 'ComplexGuard', type: 'class', resolvers: [], 
                    params: [
                        { source: 'Request' },
                        { source: 'Body' }
                    ] 
                }],
                interceptors: [], meta: {}
            });

            const server = new Server({ port: 3000 });
            (server as any).init();
            
            const req = new Request('http://localhost/complex-g', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deny: true })
            });
            const res = await server.fetch(req);
            expect(res.status).toBe(403);
            expect(guard.use).toHaveBeenCalled();
        });

        it('should execute guard chain and resolvers', async () => {
            const guard = { use: vi.fn().mockImplementation((val) => { 
                if (val === 'deny') throw { code: 403, message: 'Denied' };
            })};
            MetadataStore.registerGuard('G', guard);
            MetadataStore.registerController('C', { ok: () => 'ok' });
            MetadataStore.registerEndpoint({
                controller: 'C', methodName: 'ok', httpMethod: 'GET', path: '/g', params: [],
                guards: [{ name: 'G', type: 'class', resolvers: ['deny'], params: [{ source: 'Unknown' as any }] }],
                interceptors: [], meta: {}
            });

            const server = new Server({ port: 3000 });
            (server as any).init();
            const res = await server.fetch(new Request('http://localhost/g'));
            expect(res.status).toBe(403);
            const data = await res.json();
            expect(data.error).toBe('Denied');
        });

        it('should execute interceptor chain', async () => {
            const i1 = { intercept: async (req, next) => {
                const res = await next();
                res.headers.set('x-1', '1');
                return res;
            }};
            const i2 = { intercept: async (req, next) => {
                const res = await next();
                res.headers.set('x-2', '2');
                return res;
            }};
            MetadataStore.registerInterceptor('I1', i1);
            MetadataStore.registerInterceptor('I2', i2);
            MetadataStore.registerController('C', { ok: () => 'ok' });
            MetadataStore.registerEndpoint({
                controller: 'C', methodName: 'ok', httpMethod: 'GET', path: '/i', params: [],
                guards: [], interceptors: ['I1', 'I2'], meta: {}
            });

            const server = new Server({ port: 3000 });
            (server as any).init();
            const res = await server.fetch(new Request('http://localhost/i'));
            expect(res.headers.get('x-1')).toBe('1');
            expect(res.headers.get('x-2')).toBe('2');
        });
    });

    describe('Server Lifecycle & Events', () => {
        it('should emit request events', async () => {
            const server = new Server({ port: 3000 });
            const onReq = vi.fn();
            server.on('request', onReq);
            
            await server.fetch(new Request('http://localhost/any'));
            expect(onReq).toHaveBeenCalled();
        });

        it('should handle body caching', async () => {
            const server = new Server({ port: 3000 });
            const req: any = new Request('http://localhost/', {
                method: 'POST',
                body: JSON.stringify({ hello: 'world' }),
                headers: { 'Content-Type': 'application/json' }
            });
            
            const body1 = await (server as any).getBody(req);
            const body2 = await (server as any).getBody(req);
            
            expect(body1).toEqual({ hello: 'world' });
            expect(body1).toBe(body2); // Should be the same reference (cached)
        });

        it('should handle server errors gracefully', async () => {
            const ctrl = { boom: () => { throw new Error('Boom'); } };
            MetadataStore.registerController('C', ctrl);
            MetadataStore.registerEndpoint({
                controller: 'C', methodName: 'boom', httpMethod: 'GET', path: '/boom', params: [],
                guards: [], interceptors: [], meta: {}
            });
            const server = new Server({ port: 3000 });
            (server as any).init();
            const res = await server.fetch(new Request('http://localhost/boom'));
            expect(res.status).toBe(500);
            const data = await res.json();
            expect(data.error).toBe('Boom');
        });

        it('should handle custom errors with data', async () => {
            const ctrl = { fail: () => { throw { code: 418, data: { tea: 'pot' } }; } };
            MetadataStore.registerController('C', ctrl);
            MetadataStore.registerEndpoint({
                controller: 'C', methodName: 'fail', httpMethod: 'GET', path: '/fail', params: [],
                guards: [], interceptors: [], meta: {}
            });
            const server = new Server({ port: 3000 });
            (server as any).init();
            const res = await server.fetch(new Request('http://localhost/fail'));
            expect(res.status).toBe(418);
            expect(await res.json()).toEqual({ tea: 'pot' });
        });

        it('should handle router errors', async () => {
            const server = new Server({ port: 3000 });
            vi.spyOn((server as any).router, 'find').mockImplementation(() => { throw new Error('Router Fail'); });
            const res = await server.fetch(new Request('http://localhost/any'));
            expect(res.status).toBe(500);
            expect(await res.json()).toEqual({ success: false, error: 'Router Fail' });
        });

        it('should validate parameters and return 400 with multiple errors', async () => {
            const ctrl = { test: (a: number, b: number) => ({ a, b }) };
            MetadataStore.registerController('ValCtrl', ctrl);
            MetadataStore.registerEndpoint({
                controller: 'ValCtrl', methodName: 'test', httpMethod: 'GET', path: '/val-fail',
                params: [
                    { source: 'Query', name: 'a', validator: validators.number },
                    { source: 'Query', name: 'b', validator: validators.number }
                ],
                guards: [], interceptors: [], meta: {}
            });
            const server = new Server({ port: 3000 });
            (server as any).init();
            const res = await server.fetch(new Request('http://localhost/val-fail?a=x&b=y'));
            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.errors.length).toBe(2);
        });

        it('should respect shutdown state', async () => {
            const server = new Server({ port: 3000 });
            (server as any).isShuttingDown = true;
            const res = await server.fetch(new Request('http://localhost/any'));
            expect(res.status).toBe(503);
        });

        it('should execute graceful shutdown sequence', async () => {
            const server = new Server({ port: 3000 });
            const before = vi.fn();
            const after = vi.fn();
            server.on('beforeShutdown', before);
            server.on('shutdown', after);
            
            // Mock exit to prevent process from dying
            const spy = vi.spyOn(process, 'exit').mockImplementation(() => { return undefined as never; });
            
            await server.shutdown();
            
            expect(server['isShuttingDown']).toBe(true);
            expect(before).toHaveBeenCalled();
            expect(after).toHaveBeenCalled();
            expect(spy).toHaveBeenCalled();
            
            // Second call should return early
            before.mockClear();
            await server.shutdown();
            expect(before).not.toHaveBeenCalled();
            
            spy.mockRestore();
        });

        it('should handle shutdown timeout', async () => {
            const server = new Server({ port: 3004, shutdownTimeout: 10 });
            (server as any).activeRequests = 1;
            
            const spy = vi.spyOn(process, 'exit').mockImplementation(() => { return undefined as never; });
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            
            await server.shutdown();
            
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Shutdown timed out'));
            spy.mockRestore();
            warnSpy.mockRestore();
        });

        it('should close Node.js server on shutdown', async () => {
            const server = new Server({ port: 3005 });
            const mockNodeServer = { close: vi.fn(cb => cb()) };
            (server as any).nodeServer = mockNodeServer;
            
            const spy = vi.spyOn(process, 'exit').mockImplementation(() => { return undefined as never; });
            await server.shutdown();
            
            expect(mockNodeServer.close).toHaveBeenCalled();
            spy.mockRestore();
        });

        it('should detect different runtimes', () => {
            const server = new Server({ port: 3000 });
            
            // Mock Bun
            (globalThis as any).Bun = {};
            expect((server as any).detectRuntime()).toBe('Bun');
            delete (globalThis as any).Bun;

            // Mock Deno
            (globalThis as any).Deno = {};
            expect((server as any).detectRuntime()).toBe('Deno');
            delete (globalThis as any).Deno;

            // Default to Node
            expect((server as any).detectRuntime()).toBe('Node');
        });

        it('should start Node.js bridge server', async () => {
            // Mock http.createServer
            const mockServer = {
                listen: vi.fn((port, cb) => cb()),
                close: vi.fn(cb => cb())
            };
            const { createServer } = await import('http');
            const mockCreateServer = vi.mocked(createServer).mockReturnValue(mockServer as any);

            const server = new Server({ port: 3000 });
            await server.start();

            expect(mockCreateServer).toHaveBeenCalled();
            expect(mockServer.listen).toHaveBeenCalledWith(3000, expect.any(Function));

            // Test the request handler inside createServer
            const handler = mockCreateServer.mock.calls[0][0];
            const mockReq = {
                method: 'POST',
                url: '/test',
                headers: { host: 'localhost' },
                socket: {},
                pipe: vi.fn()
            };
            const mockRes = {
                statusCode: 0,
                setHeader: vi.fn(),
                end: vi.fn(),
                on: vi.fn(),
                once: vi.fn(),
                emit: vi.fn(),
                write: vi.fn()
            };

            // Mock Metadata for the request to match
            MetadataStore.registerController('NodeCtrl', { test: () => ({ ok: true }) });
            MetadataStore.registerEndpoint({
                controller: 'NodeCtrl', methodName: 'test', httpMethod: 'POST', path: '/test',
                params: [], guards: [], interceptors: [], meta: {}
            });
            (server as any).init();

            await handler(mockReq as any, mockRes as any);

            expect(mockRes.statusCode).toBe(200);
            expect(mockRes.setHeader).toHaveBeenCalledWith('content-type', 'application/json');
        });

        it('should start Bun server', async () => {
            (globalThis as any).Bun = { serve: vi.fn() };
            const server = new Server({ port: 3001 });
            await server.start();
            expect((globalThis as any).Bun.serve).toHaveBeenCalledWith({ port: 3001, fetch: server.fetch });
            delete (globalThis as any).Bun;
        });

        it('should start Deno server', async () => {
            (globalThis as any).Deno = { serve: vi.fn() };
            const server = new Server({ port: 3002 });
            await server.start();
            expect((globalThis as any).Deno.serve).toHaveBeenCalledWith({ port: 3002 }, server.fetch);
            delete (globalThis as any).Deno;
        });

        it('should handle Node.js bridge with empty body', async () => {
            const mockServer = { listen: vi.fn((p, cb) => cb()), close: vi.fn() };
            const { createServer } = await import('http');
            vi.mocked(createServer).mockReturnValue(mockServer as any);

            const server = new Server({ port: 3003 });
            await server.start();
            const handler = vi.mocked(createServer).mock.calls[vi.mocked(createServer).mock.calls.length - 1][0];

            const mockReq = { method: 'GET', url: '/empty-test', headers: { host: 'l' }, socket: {} };
            const mockRes = { statusCode: 0, setHeader: vi.fn(), end: vi.fn(), on: vi.fn(), once: vi.fn(), emit: vi.fn(), write: vi.fn() };

            // Mock an endpoint that returns null/empty
            MetadataStore.registerController('EmptyCtrl', { test: () => new Response(null) });
            MetadataStore.registerEndpoint({
                controller: 'EmptyCtrl', methodName: 'test', httpMethod: 'GET', path: '/empty-test',
                params: [], guards: [], interceptors: [], meta: {}
            });
            (server as any).init();

            await handler(mockReq as any, mockRes as any);
            expect(mockRes.end).toHaveBeenCalled();
        });

        it('should handle raw body caching', async () => {
            const server = new Server({ port: 3000 });
            const body = new TextEncoder().encode(JSON.stringify({ a: 1 }));
            const req: any = new Request('http://localhost/', {
                method: 'POST',
                body: body
            });
            
            const raw1 = await (server as any).getRawBody(req);
            const raw2 = await (server as any).getRawBody(req);
            
            expect(new Uint8Array(raw1)).toEqual(body);
            expect(raw1).toBe(raw2); // Cached reference
        });

        it('should log routes and incoming requests when logs: true is specified', async () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
            
            const server = new Server({ port: 3004, logs: true });
            
            // Register controller and endpoint
            MetadataStore.registerController('LogCtrl', { getLog: () => ({ hello: 'log' }) });
            MetadataStore.registerEndpoint({
                controller: 'LogCtrl', methodName: 'getLog', httpMethod: 'GET', path: '/log-test',
                params: [], guards: [], interceptors: [], meta: {}
            });
            
            await server.start();
            
            // Verify registration log
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('📝 Registered route: GET    /log-test -> LogCtrl.getLog'));
            
            // Simulate incoming request
            const request = new Request('http://localhost:3004/log-test', { method: 'GET' });
            const response = await server.fetch(request);
            
            // Verify request and response logs
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('📡 --> GET /log-test'));
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('📡 <-- GET /log-test - 200'));
            
            expect(response.status).toBe(200);
            
            consoleSpy.mockRestore();
        });
    });
});

