import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Server } from '../server.js';
import { Scope, Meta, SetMetadata } from '../decorators.js';
import { Reflector } from '../core/reflector.js';
import { MetadataStore } from '../core/metadata.js';
import { validators } from '@webergency-utils/typechecker';
import { Context } from '../core/context.js';
import { createServer } from 'http';

vi.mock('http', () => ({
    createServer: vi.fn()
}));

vi.mock('https', () => ({
    createServer: vi.fn()
}));

describe('Server & Metadata', () => {
    beforeEach(() => {
        MetadataStore.clear();
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

        it('should start HTTPS server when tls is provided', async () => {
            const mockServer = {
                listen: vi.fn((port, cb) => cb()),
                close: vi.fn(cb => cb())
            };
            const { createServer } = await import('https');
            const mockCreateServer = vi.mocked(createServer).mockReturnValue(mockServer as any);

            const tlsOptions = { key: 'key-data', cert: 'cert-data' };
            const server = new Server({ port: 4430, tls: tlsOptions });
            await server.start();

            expect(mockCreateServer).toHaveBeenCalledWith(tlsOptions, expect.any(Function));
            expect(mockServer.listen).toHaveBeenCalledWith(4430, expect.any(Function));
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
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Registered route: GET    /log-test -> LogCtrl.getLog'));
            
            // Simulate incoming request
            const request = new Request('http://localhost:3004/log-test', { method: 'GET' });
            const response = await server.fetch(request);
            
            // Verify request and response logs
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('--> GET /log-test'));
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('<-- GET /log-test - 200'));
            
            expect(response.status).toBe(200);
            
            consoleSpy.mockRestore();
        });
    });

    describe('Logger Integration', () => {
        it('should dispatch registration, request, and lifecycle events with structured LogContext metadata', async () => {
            const logs: any[] = [];
            const customLogger = {
                info: (msg: string, ctx: any) => logs.push({ level: 'info', msg, ctx }),
                warn: (msg: string, ctx: any) => logs.push({ level: 'warn', msg, ctx }),
                error: (msg: string, ctx: any) => logs.push({ level: 'error', msg, ctx })
            };

            const server = new Server({ port: 3005, logs: true, logger: customLogger });

            // 1. Verify Registration Log
            MetadataStore.registerController('MockCtrl', { mockAction: () => 'ok' });
            MetadataStore.registerEndpoint({
                controller: 'MockCtrl', methodName: 'mockAction', httpMethod: 'GET', path: '/mock-log',
                params: [], guards: [], interceptors: [], meta: {}
            });

            await server.start();

            const regLog = logs.find(l => l.ctx?.type === 'registration');
            expect(regLog).toBeDefined();
            expect(regLog.ctx.method).toBe('GET');
            expect(regLog.ctx.path).toBe('/mock-log');
            expect(regLog.ctx.controller).toBe('MockCtrl');
            expect(regLog.ctx.action).toBe('mockAction');

            // 2. Verify Request & Response Log
            const request = new Request('http://localhost:3005/mock-log', { method: 'GET' });
            await server.fetch(request);

            const startLog = logs.find(l => l.ctx?.type === 'request_start');
            expect(startLog).toBeDefined();
            expect(startLog.ctx.method).toBe('GET');
            expect(startLog.ctx.path).toBe('/mock-log');

            const endLog = logs.find(l => l.ctx?.type === 'request_end');
            expect(endLog).toBeDefined();
            expect(endLog.ctx.method).toBe('GET');
            expect(endLog.ctx.path).toBe('/mock-log');
            expect(endLog.ctx.status).toBe(200);
            expect(endLog.ctx.duration).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Module System', () => {
        it('should traverse a module tree, register controllers/providers, and map routes', async () => {
            const logs: any[] = [];
            const logger = {
                info: (msg: any, ctx: any) => logs.push({ msg, ctx }),
                warn: (msg: any, ctx: any) => {},
                error: (msg: any, ctx: any) => {},
                debug: (msg: any, ctx: any) => {},
            };

            class ServiceA {
                getValue() { return 'A'; }
            }

            class ServiceB {
                constructor(public a: ServiceA) {}
                getValue() { return this.a.getValue() + 'B'; }
            }

            class ServiceC {
                getValue() { return 'C'; }
            }

            class ChildController {
                constructor(public b: ServiceB) {}
                async hello() {
                    return this.b.getValue();
                }
            }

            class ParentController {
                constructor(public c: ServiceC) {}
                async greet() {
                    return this.c.getValue();
                }
            }

            // Set up injections metadata manually as if compile-time AOT generated them
            (ServiceB as any).__injections__ = { constructorDeps: ['ServiceA'] };
            (ChildController as any).__injections__ = { constructorDeps: ['ServiceB'] };
            (ParentController as any).__injections__ = { constructorDeps: ['ServiceC'] };

            // Define modules
            const SubModule = {
                __moduleMetadata__: {
                    providers: [ServiceA, ServiceB],
                    controllers: [ChildController]
                }
            };

            const RootModule = {
                __moduleMetadata__: {
                    imports: [SubModule],
                    providers: [ServiceC],
                    controllers: [ParentController]
                }
            };

            // Register endpoints as if AOT did it
            MetadataStore.registerEndpoint({
                controller: 'ChildController', methodName: 'hello', httpMethod: 'GET', path: '/child', params: [], guards: [], interceptors: [], meta: {}
            });
            MetadataStore.registerEndpoint({
                controller: 'ParentController', methodName: 'greet', httpMethod: 'GET', path: '/parent', params: [], guards: [], interceptors: [], meta: {}
            });
            MetadataStore.registerEndpoint({
                controller: 'OtherController', methodName: 'ignored', httpMethod: 'GET', path: '/ignored', params: [], guards: [], interceptors: [], meta: {}
            });

            const server = new Server({ port: 3006, module: RootModule, logger, logs: false });
            (server as any).init();

            // Verify DI containers resolved correctly
            const parentInst = MetadataStore.getController('ParentController');
            const childInst = MetadataStore.getController('ChildController');

            expect(parentInst).toBeDefined();
            expect(parentInst.c.getValue()).toBe('C');

            expect(childInst).toBeDefined();
            expect(childInst.b.getValue()).toBe('AB');

            // Verify routes are registered
            const res1 = await server.fetch(new Request('http://localhost/parent'));
            expect(await res1.text()).toBe('C');

            const res2 = await server.fetch(new Request('http://localhost/child'));
            expect(await res2.text()).toBe('AB');

            // Route from OtherController should not be registered (route filtering)
            const res3 = await server.fetch(new Request('http://localhost/ignored'));
            expect(res3.status).toBe(404);
        });

        it('should support dynamic modules', async () => {
            class ConfigService {
                constructor() {}
                get() { return 'dynamic-config'; }
            }

            class DynamicController {
                constructor(public config: ConfigService) {}
                async handle() { return this.config.get(); }
            }
            (DynamicController as any).__injections__ = { constructorDeps: ['ConfigService'] };

            // Dynamic module mimicking NestJS DynamicModule
            const DynamicModule = {
                module: class DynamicModule {},
                providers: [ConfigService],
                controllers: [DynamicController]
            };

            const RootModule = {
                __moduleMetadata__: {
                    imports: [DynamicModule]
                }
            };

            MetadataStore.registerEndpoint({
                controller: 'DynamicController', methodName: 'handle', httpMethod: 'GET', path: '/dynamic', params: [], guards: [], interceptors: [], meta: {}
            });

            const server = new Server({ port: 3007, module: RootModule });
            (server as any).init();

            const ctrl = MetadataStore.getController('DynamicController');
            expect(ctrl).toBeDefined();
            expect(ctrl.config.get()).toBe('dynamic-config');

            const res = await server.fetch(new Request('http://localhost/dynamic'));
            expect(await res.text()).toBe('dynamic-config');
        });

        it('should handle circular module dependencies gracefully', async () => {
            const ModuleA: any = {
                __moduleMetadata__: {}
            };
            const ModuleB: any = {
                __moduleMetadata__: {
                    imports: [ModuleA]
                }
            };
            ModuleA.__moduleMetadata__.imports = [ModuleB];

            const server = new Server({ port: 3008, module: ModuleA });
            expect(() => (server as any).init()).not.toThrow();
        });

        it('should support multiple root modules', async () => {
            class ServiceX {
                getValue() { return 'X'; }
            }
            class ServiceY {
                getValue() { return 'Y'; }
            }
            class ControllerX {
                constructor(public x: ServiceX) {}
                async hello() { return this.x.getValue(); }
            }
            class ControllerY {
                constructor(public y: ServiceY) {}
                async hello() { return this.y.getValue(); }
            }
            (ControllerX as any).__injections__ = { constructorDeps: ['ServiceX'] };
            (ControllerY as any).__injections__ = { constructorDeps: ['ServiceY'] };

            const ModuleX = {
                __moduleMetadata__: {
                    providers: [ServiceX],
                    controllers: [ControllerX]
                }
            };
            const ModuleY = {
                __moduleMetadata__: {
                    providers: [ServiceY],
                    controllers: [ControllerY]
                }
            };

            MetadataStore.registerEndpoint({
                controller: 'ControllerX', methodName: 'hello', httpMethod: 'GET', path: '/x', params: [], guards: [], interceptors: [], meta: {}
            });
            MetadataStore.registerEndpoint({
                controller: 'ControllerY', methodName: 'hello', httpMethod: 'GET', path: '/y', params: [], guards: [], interceptors: [], meta: {}
            });

            const server = new Server({ port: 3009, module: [ModuleX, ModuleY] });
            (server as any).init();

            const resX = await server.fetch(new Request('http://localhost/x'));
            expect(await resX.text()).toBe('X');

            const resY = await server.fetch(new Request('http://localhost/y'));
            expect(await resY.text()).toBe('Y');
        });

        it('should enforce module encapsulation (fail if provider is not exported)', async () => {
            class HiddenService {
                getValue() { return 'hidden'; }
            }
            class ConsumerController {
                constructor(public hidden: HiddenService) {}
                async hello() { return this.hidden.getValue(); }
            }
            (ConsumerController as any).__injections__ = { constructorDeps: ['HiddenService'] };

            const ModuleA = {
                __moduleMetadata__: {
                    providers: [HiddenService]
                }
            };
            const RootModule = {
                __moduleMetadata__: {
                    imports: [ModuleA],
                    controllers: [ConsumerController]
                }
            };

            MetadataStore.registerEndpoint({
                controller: 'ConsumerController', methodName: 'hello', httpMethod: 'GET', path: '/consume', params: [], guards: [], interceptors: [], meta: {}
            });

            const server = new Server({ port: 3010, module: RootModule });
            expect(() => (server as any).init()).toThrow(
                /No provider registered for token: HiddenService in module DynamicModule/
            );
        });

        it('should support module re-exports', async () => {
            class SharedService {
                getValue() { return 'shared'; }
            }
            class ConsumerController {
                constructor(public shared: SharedService) {}
                async hello() { return this.shared.getValue(); }
            }
            (ConsumerController as any).__injections__ = { constructorDeps: ['SharedService'] };

            const ModuleC = {
                __moduleMetadata__: {
                    providers: [SharedService],
                    exports: [SharedService]
                }
            };
            const ModuleB = {
                __moduleMetadata__: {
                    imports: [ModuleC],
                    exports: [ModuleC]
                }
            };
            const RootModule = {
                __moduleMetadata__: {
                    imports: [ModuleB],
                    controllers: [ConsumerController]
                }
            };

            MetadataStore.registerEndpoint({
                controller: 'ConsumerController', methodName: 'hello', httpMethod: 'GET', path: '/reexport', params: [], guards: [], interceptors: [], meta: {}
            });

            const server = new Server({ port: 3011, module: RootModule });
            (server as any).init();

            const res = await server.fetch(new Request('http://localhost/reexport'));
            expect(await res.text()).toBe('shared');
        });

        it('should support circular dependency injection in modules', async () => {
            class ServiceA {
                static __injections__ = { constructorDeps: ['ServiceB'], propertyDeps: {} };
                constructor(public b: any) {}
                hello() { return 'A' + this.b.getValue(); }
                getValue() { return 'A'; }
            }
            class ServiceB {
                static __injections__ = { constructorDeps: ['ServiceA'], propertyDeps: {} };
                constructor(public a: any) {}
                hello() { return 'B' + this.a.getValue(); }
                getValue() { return 'B'; }
            }
            class CircularController {
                constructor(public a: ServiceA) {}
                async hello() { return this.a.hello(); }
            }
            (CircularController as any).__injections__ = { constructorDeps: ['ServiceA'] };

            const CircularModule = {
                __moduleMetadata__: {
                    providers: [ServiceA, ServiceB],
                    controllers: [CircularController]
                }
            };

            MetadataStore.registerEndpoint({
                controller: 'CircularController', methodName: 'hello', httpMethod: 'GET', path: '/circ', params: [], guards: [], interceptors: [], meta: {}
            });

            const server = new Server({ port: 3012, module: CircularModule });
            (server as any).init();

            const res = await server.fetch(new Request('http://localhost/circ'));
            expect(await res.text()).toBe('AB');

            const ctrl = MetadataStore.getController('CircularController');
            expect(ctrl.a.b.hello()).toBe('BA');
        });

        it('should support @Global() modules', async () => {
            class GlobalService {
                getValue() { return 'global'; }
            }
            class ConsumerController {
                constructor(public glob: GlobalService) {}
                async hello() { return this.glob.getValue(); }
            }
            (ConsumerController as any).__injections__ = { constructorDeps: ['GlobalService'] };

            const GlobalModule = {
                __isGlobal__: true,
                __moduleMetadata__: {
                    providers: [GlobalService],
                    exports: [GlobalService]
                }
            };
            const RootModule = {
                __moduleMetadata__: {
                    imports: [GlobalModule],
                    controllers: []
                }
            };
            const ConsumerModule = {
                __moduleMetadata__: {
                    controllers: [ConsumerController]
                }
            };

            MetadataStore.registerEndpoint({
                controller: 'ConsumerController', methodName: 'hello', httpMethod: 'GET', path: '/consume-global', params: [], guards: [], interceptors: [], meta: {}
            });

            const server = new Server({ port: 3013, module: [RootModule, ConsumerModule] });
            (server as any).init();

            const res = await server.fetch(new Request('http://localhost/consume-global'));
            expect(await res.text()).toBe('global');
        });
    });

    describe('Injection Scopes', () => {
        beforeEach(() => {
            MetadataStore.clear();
        });

        it('should resolve TRANSIENT provider with new instance every time', () => {
            let instanceCount = 0;
            class TransientService {
                static __scope__ = Scope.TRANSIENT;
                public id: number;
                constructor() {
                    instanceCount++;
                    this.id = instanceCount;
                }
            }
            MetadataStore.registerProvider('TransientService', TransientService);

            const inst1 = MetadataStore.resolve('TransientService');
            const inst2 = MetadataStore.resolve('TransientService');

            expect(inst1).toBeInstanceOf(TransientService);
            expect(inst2).toBeInstanceOf(TransientService);
            expect(inst1.id).toBe(1);
            expect(inst2.id).toBe(2);
            expect(inst1).not.toBe(inst2);
        });

        it('should propagate REQUEST scope to dependent classes and resolve per-request', async () => {
            let reqServiceInstCount = 0;
            class RequestService {
                static __scope__ = Scope.REQUEST;
                public id: number;
                constructor() {
                    reqServiceInstCount++;
                    this.id = reqServiceInstCount;
                }
            }

            class DependentService {
                static __injections__ = { constructorDeps: ['RequestService'], propertyDeps: {} };
                constructor(public reqService: RequestService) {}
            }

            class RequestController {
                static __injections__ = { constructorDeps: ['DependentService'], propertyDeps: {} };
                constructor(public depService: DependentService) {}
                async hello() {
                    return {
                        reqId: this.depService.reqService.id,
                        depServiceType: typeof this.depService
                    };
                }
            }

            const ScopeModule = {
                __moduleMetadata__: {
                    providers: [RequestService, DependentService],
                    controllers: [RequestController]
                }
            };

            MetadataStore.registerEndpoint({
                controller: 'RequestController',
                methodName: 'hello',
                httpMethod: 'GET',
                path: '/scope-test',
                params: [],
                guards: [],
                interceptors: [],
                meta: {}
            });

            const server = new Server({ port: 3014, module: ScopeModule });
            (server as any).init();

            // Resolve outside request context should throw
            expect(() => MetadataStore.resolve('RequestService')).toThrow(/Cannot resolve request-scoped provider/);

            // Fetch request 1
            const res1 = await server.fetch(new Request('http://localhost/scope-test'));
            const data1 = (await res1.json()) as any;
            expect(data1.reqId).toBe(1);

            // Fetch request 2
            const res2 = await server.fetch(new Request('http://localhost/scope-test'));
            const data2 = (await res2.json()) as any;
            expect(data2.reqId).toBe(2);
        });
    });

    describe('Lifecycle Hooks', () => {
        beforeEach(() => {
            MetadataStore.clear();
        });

        it('should call all lifecycle hooks in sequence during start and shutdown', async () => {
            const sequence: string[] = [];

            class HookService {
                async onModuleInit() {
                    sequence.push('provider:onModuleInit');
                }
                async onApplicationBootstrap() {
                    sequence.push('provider:onApplicationBootstrap');
                }
                async onModuleDestroy() {
                    sequence.push('provider:onModuleDestroy');
                }
                async beforeApplicationShutdown(signal?: string) {
                    sequence.push(`provider:beforeApplicationShutdown:${signal}`);
                }
                async onApplicationShutdown(signal?: string) {
                    sequence.push(`provider:onApplicationShutdown:${signal}`);
                }
            }

            class HookController {
                async onModuleInit() {
                    sequence.push('controller:onModuleInit');
                }
                async onApplicationBootstrap() {
                    sequence.push('controller:onApplicationBootstrap');
                }
                async onModuleDestroy() {
                    sequence.push('controller:onModuleDestroy');
                }
                async beforeApplicationShutdown(signal?: string) {
                    sequence.push(`controller:beforeApplicationShutdown:${signal}`);
                }
                async onApplicationShutdown(signal?: string) {
                    sequence.push(`controller:onApplicationShutdown:${signal}`);
                }
            }

            class HookModule {
                static __moduleMetadata__ = {
                    providers: [HookService],
                    controllers: [HookController]
                };
                async onModuleInit() {
                    sequence.push('module:onModuleInit');
                }
                async onApplicationBootstrap() {
                    sequence.push('module:onApplicationBootstrap');
                }
                async onModuleDestroy() {
                    sequence.push('module:onModuleDestroy');
                }
                async beforeApplicationShutdown(signal?: string) {
                    sequence.push(`module:beforeApplicationShutdown:${signal}`);
                }
                async onApplicationShutdown(signal?: string) {
                    sequence.push(`module:onApplicationShutdown:${signal}`);
                }
            }

            const server = new Server({ port: 3015, module: HookModule });
            
            // Mock exit to prevent process from dying
            const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { return undefined as never; });

            // Start the server
            await server.start();

            expect(sequence).toContain('provider:onModuleInit');
            expect(sequence).toContain('controller:onModuleInit');
            expect(sequence).toContain('module:onModuleInit');
            expect(sequence).toContain('provider:onApplicationBootstrap');
            expect(sequence).toContain('controller:onApplicationBootstrap');
            expect(sequence).toContain('module:onApplicationBootstrap');

            // Shutdown the server
            await server.shutdown('SIGINT');

            expect(sequence).toContain('provider:onModuleDestroy');
            expect(sequence).toContain('controller:onModuleDestroy');
            expect(sequence).toContain('module:onModuleDestroy');
            expect(sequence).toContain('provider:beforeApplicationShutdown:SIGINT');
            expect(sequence).toContain('controller:beforeApplicationShutdown:SIGINT');
            expect(sequence).toContain('module:beforeApplicationShutdown:SIGINT');
            expect(sequence).toContain('provider:onApplicationShutdown:SIGINT');
            expect(sequence).toContain('controller:onApplicationShutdown:SIGINT');
            expect(sequence).toContain('module:onApplicationShutdown:SIGINT');

            exitSpy.mockRestore();
        });
    });

    describe('Custom Decorators & Reflector', () => {
        it('should correctly attach metadata on class constructors using Meta and SetMetadata', () => {
            @Meta({ roles: ['admin'], isClass: true })
            class CustomCtrl {}

            @SetMetadata('roles', ['user'])
            class UserCtrl {}

            const reflector = new Reflector();
            expect(reflector.get('roles', CustomCtrl)).toEqual(['admin']);
            expect(reflector.get('isClass', CustomCtrl)).toBe(true);
            expect(reflector.get('roles', UserCtrl)).toEqual(['user']);
            expect(reflector.get('nonexistent', CustomCtrl)).toBeUndefined();
        });

        it('should correctly attach metadata on methods using Meta and SetMetadata', () => {
            class CustomCtrl {
                @Meta({ permissions: ['read'] })
                readAction() {}

                @SetMetadata('permissions', ['write'])
                writeAction() {}
            }

            const reflector = new Reflector();
            
            // Standard JS decorators attach descriptor.value
            const readMethod = CustomCtrl.prototype.readAction;
            const writeMethod = CustomCtrl.prototype.writeAction;

            expect(reflector.get('permissions', readMethod)).toEqual(['read']);
            expect(reflector.get('permissions', writeMethod)).toEqual(['write']);
        });

        it('should resolve metadata hierarchies using getAllAndOverride and getAllAndMerge', () => {
            @Meta({ roles: ['admin'], scope: 'global' })
            class CustomCtrl {
                @Meta({ roles: ['user'] })
                userAction() {}

                noRolesAction() {}
            }

            const reflector = new Reflector();
            const classObj = CustomCtrl;
            const userMethod = CustomCtrl.prototype.userAction;
            const guestMethod = CustomCtrl.prototype.noRolesAction;

            // getAllAndOverride: returns the first defined metadata value in the array of targets
            expect(reflector.getAllAndOverride('roles', [userMethod, classObj])).toEqual(['user']);
            expect(reflector.getAllAndOverride('roles', [guestMethod, classObj])).toEqual(['admin']);
            expect(reflector.getAllAndOverride('scope', [userMethod, classObj])).toBe('global');

            // getAllAndMerge: merges arrays or objects
            // Roles: array merge
            expect(reflector.getAllAndMerge('roles', [userMethod, classObj])).toEqual(['user', 'admin']);
            expect(reflector.getAllAndMerge('roles', [guestMethod, classObj])).toEqual(['admin']);

            // Object merge
            @Meta({ options: { a: 1, b: 2 } })
            class OptionCtrl {
                @Meta({ options: { b: 3, c: 4 } })
                action() {}
            }
            const optionMethod = OptionCtrl.prototype.action;
            expect(reflector.getAllAndMerge('options', [optionMethod, OptionCtrl])).toEqual({ a: 1, b: 3, c: 4 });
        });

        it('should integrate Reflector in request lifecycle guards', async () => {
            const sequence: string[] = [];

            // A mock guard checking metadata
            class AuthGuard {
                async use(req: Request) {
                    const ctx = Context.get();
                    if (!ctx) {
                        sequence.push('no-context');
                        return;
                    }
                    const reflector = new Reflector();
                    const controllerClass = MetadataStore.getProvider(ctx.metadata.controller);
                    const handlerMethod = controllerClass?.prototype?.[ctx.metadata.methodName];

                    const requiredRoles = reflector.getAllAndOverride<string[]>('roles', [handlerMethod, controllerClass]);
                    
                    const roleHeader = req.headers.get('x-role');
                    if (requiredRoles && (!roleHeader || !requiredRoles.includes(roleHeader))) {
                        const err = new Error('Forbidden');
                        (err as any).status = 403;
                        throw err;
                    }
                    sequence.push('authorized');
                }
            }

            class TestController {
                async adminEndpoint() {
                    return { ok: true, section: 'admin' };
                }

                async userEndpoint() {
                    return { ok: true, section: 'user' };
                }
            }

            // Manually register metadata similar to what AOT does:
            MetadataStore.registerGuard('AuthGuard', AuthGuard);
            MetadataStore.registerController('TestController', TestController);

            // Register controller constructor as provider so getProvider works
            MetadataStore.registerProvider('TestController', TestController);

            // Attach metadata to controller and methods manually (simulating decorator evaluation)
            Meta({ roles: ['admin'] })(TestController);
            Meta({ roles: ['user', 'admin'] })(TestController.prototype, 'userEndpoint', Object.getOwnPropertyDescriptor(TestController.prototype, 'userEndpoint')!);

            MetadataStore.registerEndpoint({
                controller: 'TestController',
                methodName: 'adminEndpoint',
                httpMethod: 'GET',
                path: '/admin',
                params: [],
                guards: [
                    { type: 'class', name: 'AuthGuard', resolvers: [], params: [{ source: 'Request' }], isAsync: true }
                ],
                interceptors: [],
                meta: {}
            });

            MetadataStore.registerEndpoint({
                controller: 'TestController',
                methodName: 'userEndpoint',
                httpMethod: 'GET',
                path: '/user',
                params: [],
                guards: [
                    { type: 'class', name: 'AuthGuard', resolvers: [], params: [{ source: 'Request' }], isAsync: true }
                ],
                interceptors: [],
                meta: {}
            });

            const server = new Server({ port: 3000 });
            (server as any).init();

            // 1. Calling /admin with no role -> 403 Forbidden
            const res1 = await server.fetch(new Request('http://localhost/admin'));
            expect(res1.status).toBe(403);

            // 2. Calling /admin with admin role -> 200 OK
            const res2 = await server.fetch(new Request('http://localhost/admin', {
                headers: { 'x-role': 'admin' }
            }));
            expect(res2.status).toBe(200);
            expect(await res2.json()).toEqual({ ok: true, section: 'admin' });

            // 3. Calling /user with user role -> 200 OK
            const res3 = await server.fetch(new Request('http://localhost/user', {
                headers: { 'x-role': 'user' }
            }));
            expect(res3.status).toBe(200);
            expect(await res3.json()).toEqual({ ok: true, section: 'user' });

            // 4. Calling /user with guest role -> 403 Forbidden
            const res4 = await server.fetch(new Request('http://localhost/user', {
                headers: { 'x-role': 'guest' }
            }));
            expect(res4.status).toBe(403);
        });
    });
});



