import { describe, it, expect, beforeEach } from 'vitest';
import { Server } from '../server.js';
import { MetadataStore } from '../core/metadata.js';
import { mergeSecurityConfigs, generateSecurityHeaders } from '../helpers/security.js';

describe('Security Helper & Integration Tests', () => {
  beforeEach(() => {
    MetadataStore.clear();
  });

  describe('mergeSecurityConfigs helper', () => {
    it('should return undefined if all configs are undefined', () => {
      const merged = mergeSecurityConfigs([undefined, undefined]);
      expect(merged).toBeUndefined();
    });

    it('should initialize empty object if config is true', () => {
      const merged = mergeSecurityConfigs([true]);
      expect(merged).toEqual({});
    });

    it('should propagate false overrides to disable all headers', () => {
      const merged = mergeSecurityConfigs([true, false]);
      expect(merged).toEqual({
        frameguard: false,
        noSniff: false,
        hsts: false,
        downloadOptions: false,
        permittedCrossDomainPolicies: false,
        referrerPolicy: false,
        xssFilter: false,
        csp: false,
        coep: false,
        coop: false,
        corp: false
      });
    });

    it('should merge objects hierarchically', () => {
      const merged = mergeSecurityConfigs([
        { frameguard: 'deny', hsts: { maxAge: 100 } },
        { frameguard: 'sameorigin', csp: { 'default-src': ["'self'"] } }
      ]);
      expect(merged).toEqual({
        frameguard: 'sameorigin',
        hsts: { maxAge: 100 },
        csp: { 'default-src': ["'self'"] }
      });
    });
  });

  describe('generateSecurityHeaders helper', () => {
    it('should generate default headers when config is true or empty object', () => {
      const headers = generateSecurityHeaders(true);
      expect(headers['X-Frame-Options']).toBe('SAMEORIGIN');
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['Strict-Transport-Security']).toBe('max-age=15552000; includeSubDomains');
      expect(headers['X-Download-Options']).toBe('noopen');
      expect(headers['X-Permitted-Cross-Domain-Policies']).toBe('none');
      expect(headers['Referrer-Policy']).toBe('no-referrer');
      expect(headers['X-XSS-Protection']).toBe('0');
      expect(headers['Content-Security-Policy']).toBeUndefined();
    });

    it('should respect false to omit specific headers', () => {
      const headers = generateSecurityHeaders({
        frameguard: false,
        hsts: false,
        noSniff: true
      });
      expect(headers['X-Frame-Options']).toBeUndefined();
      expect(headers['Strict-Transport-Security']).toBeUndefined();
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
    });
  });

  describe('Server integration - Request Protections', () => {
    it('should enforce maxBodySize limits and return 413', async () => {
      const server = new Server({
        port: 0,
        security: { maxBodySize: '10b' }
      });
      class DummyController {
        index(body: any) { return 'ok'; }
      }
      MetadataStore.registerController('DummyController', new DummyController());
      MetadataStore.registerEndpoint({
        controller: 'DummyController',
        methodName: 'index',
        httpMethod: 'POST',
        path: '/body-test',
        params: [{ source: 'Body' }],
        guards: [],
        interceptors: [],
        meta: {}
      });
      (server as any).init();

      // Within limit (7 bytes)
      const resOk = await server.fetch(new Request('http://localhost/body-test', {
        method: 'POST',
        body: '"hello"'
      }));
      expect(resOk.status).toBe(200);

      // Exceeds limit (13 bytes)
      const resTooBig = await server.fetch(new Request('http://localhost/body-test', {
        method: 'POST',
        body: '"hello world"'
      }));
      expect(resTooBig.status).toBe(413);
    });

    it('should enforce timeout limits and return 408', async () => {
      const server = new Server({ port: 0 });
      class DummyController {
        async delay() {
          await new Promise(r => setTimeout(r, 50));
          return 'done';
        }
      }
      MetadataStore.registerController('DummyController', new DummyController());
      MetadataStore.registerEndpoint({
        controller: 'DummyController',
        methodName: 'delay',
        httpMethod: 'GET',
        path: '/timeout-test',
        params: [],
        guards: [],
        interceptors: [],
        security: { timeout: 10 },
        meta: {}
      });
      (server as any).init();

      const res = await server.fetch(new Request('http://localhost/timeout-test'));
      expect(res.status).toBe(408);
    });

    it('should enforce allowedContentTypes and return 415', async () => {
      const server = new Server({
        port: 0,
        security: { allowedContentTypes: ['application/json'] }
      });
      class DummyController {
        index() { return 'ok'; }
      }
      MetadataStore.registerController('DummyController', new DummyController());
      MetadataStore.registerEndpoint({
        controller: 'DummyController',
        methodName: 'index',
        httpMethod: 'POST',
        path: '/type-test',
        params: [],
        guards: [],
        interceptors: [],
        meta: {}
      });
      (server as any).init();

      // Correct content type
      const resOk = await server.fetch(new Request('http://localhost/type-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }));
      expect(resOk.status).toBe(200);

      // Incorrect content type
      const resBad = await server.fetch(new Request('http://localhost/type-test', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' }
      }));
      expect(resBad.status).toBe(415);
    });

    it('should enforce rateLimit and return 429', async () => {
      const server = new Server({ port: 0 });
      class DummyController {
        index() { return 'ok'; }
      }
      MetadataStore.registerController('DummyController', new DummyController());
      MetadataStore.registerEndpoint({
        controller: 'DummyController',
        methodName: 'index',
        httpMethod: 'GET',
        path: '/rate-test',
        params: [],
        guards: [],
        interceptors: [],
        security: { rateLimit: { max: 2, window: '1s' } },
        meta: {}
      });
      (server as any).init();

      const res1 = await server.fetch(new Request('http://localhost/rate-test'));
      expect(res1.status).toBe(200);

      const res2 = await server.fetch(new Request('http://localhost/rate-test'));
      expect(res2.status).toBe(200);

      const res3 = await server.fetch(new Request('http://localhost/rate-test'));
      expect(res3.status).toBe(429);
    });
  });
});
