import { describe, it, expect, beforeEach } from 'vitest';
import { Server } from '../server.js';
import { MetadataStore } from '../core/metadata.js';
import { mergeSecureHeadersConfigs, generateSecureHeaders } from '../helpers/secure-headers.js';

describe('Secure Headers Helper & Integration Tests', () => {
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

  describe('mergeSecureHeadersConfigs helper', () => {
    it('should return undefined if all configs are undefined', () => {
      const merged = mergeSecureHeadersConfigs([undefined, undefined]);
      expect(merged).toBeUndefined();
    });

    it('should initialize empty object if config is true', () => {
      const merged = mergeSecureHeadersConfigs([true]);
      expect(merged).toEqual({});
    });

    it('should propagate false overrides to disable all headers', () => {
      const merged = mergeSecureHeadersConfigs([true, false]);
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
      const merged = mergeSecureHeadersConfigs([
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

  describe('generateSecureHeaders helper', () => {
    it('should generate default headers when config is true or empty object', () => {
      const headers = generateSecureHeaders(true);
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
      const headers = generateSecureHeaders({
        frameguard: false,
        hsts: false,
        noSniff: true
      });
      expect(headers['X-Frame-Options']).toBeUndefined();
      expect(headers['Strict-Transport-Security']).toBeUndefined();
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
    });

    it('should handle custom CSP config', () => {
      const headers = generateSecureHeaders({
        csp: {
          'default-src': ["'self'"],
          'script-src': ["'self'", 'https://trusted.com']
        }
      });
      expect(headers['Content-Security-Policy']).toBe("default-src 'self'; script-src 'self' https://trusted.com");
    });

    it('should handle custom HSTS and frameguard options', () => {
      const headers = generateSecureHeaders({
        hsts: { maxAge: 3600, includeSubDomains: false, preload: true },
        frameguard: { action: 'deny' }
      });
      expect(headers['Strict-Transport-Security']).toBe('max-age=3600; preload');
      expect(headers['X-Frame-Options']).toBe('DENY');
    });
  });

  describe('Server integration', () => {
    it('should not add secure headers by default if not configured', async () => {
      const server = new Server({ port: 0 });
      class DummyController {
        index() { return 'ok'; }
      }
      MetadataStore.registerController('DummyController', new DummyController());
      MetadataStore.registerEndpoint({
        controller: 'DummyController',
        methodName: 'index',
        httpMethod: 'GET',
        path: '/test',
        params: [],
        guards: [],
        interceptors: [],
        meta: {}
      });
      (server as any).init();

      const res = await server.fetch(new Request('http://localhost/test'));
      expect(res.headers.get('X-Frame-Options')).toBeNull();
      expect(res.headers.get('X-Content-Type-Options')).toBeNull();
    });

    it('should add default headers globally when secureHeaders is true', async () => {
      const server = new Server({
        port: 0,
        secureHeaders: true
      });
      class DummyController {
        index() { return 'ok'; }
      }
      MetadataStore.registerController('DummyController', new DummyController());
      MetadataStore.registerEndpoint({
        controller: 'DummyController',
        methodName: 'index',
        httpMethod: 'GET',
        path: '/test',
        params: [],
        guards: [],
        interceptors: [],
        meta: {}
      });
      (server as any).init();

      const res = await server.fetch(new Request('http://localhost/test'));
      expect(res.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });

    it('should resolve and merge class/method levels', async () => {
      const server = new Server({
        port: 0,
        secureHeaders: {
          frameguard: 'deny',
          hsts: { maxAge: 100 }
        }
      });
      class DummyController {
        index() { return 'ok'; }
      }
      MetadataStore.registerController('DummyController', new DummyController());
      MetadataStore.registerEndpoint({
        controller: 'DummyController',
        methodName: 'index',
        httpMethod: 'GET',
        path: '/test',
        params: [],
        guards: [],
        interceptors: [],
        // Simulates route-level @SecureHeaders({ frameguard: false, csp: "default-src 'self'" })
        secureHeaders: {
          frameguard: false,
          csp: "default-src 'self'"
        },
        meta: {}
      });
      (server as any).init();

      const res = await server.fetch(new Request('http://localhost/test'));
      expect(res.headers.get('X-Frame-Options')).toBeNull(); // disabled by route
      expect(res.headers.get('Strict-Transport-Security')).toBe('max-age=100; includeSubDomains'); // inherited from global
      expect(res.headers.get('Content-Security-Policy')).toBe("default-src 'self'"); // added by route
    });
  });
});
