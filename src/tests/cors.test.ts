import { describe, it, expect, beforeEach } from 'vitest';
import { Server } from '../server.js';
import { MetadataStore } from '../core/metadata.js';

describe( 'CORS Integration & Runtime Tests', () => 
{
    beforeEach(() => 
    {
        MetadataStore.clear();
    });

    it( 'should support global server-level CORS options', async () => 
    {
        const server = new Server({
            port : 0,
            cors : {
                origin         : 'https://allowed.com',
                credentials    : true,
                allowedHeaders : ['Content-Type', 'X-Global-Header']
            }
        });

        // Mock dummy controller and action
        class GlobalController 
        {
            getData() { return 'ok' }
        }
        MetadataStore.registerController( 'GlobalController', new GlobalController());

        // Mock an endpoint registration
        MetadataStore.registerEndpoint({
            controller   : 'GlobalController',
            methodName   : 'getData',
            httpMethod   : 'GET',
            path         : '/global-data',
            params       : [],
            guards       : [],
            interceptors : [],
            meta         : {}
        });

        ( server as any ).init();

        // 1. Check actual request headers
        const req1 = new Request( 'http://localhost/global-data', {
            headers : { 'Origin' : 'https://allowed.com' }
        });
        const res1 = await server.fetch( req1 );
        expect( res1.status ).toBe( 200 );
        expect( res1.headers.get( 'Access-Control-Allow-Origin' )).toBe( 'https://allowed.com' );
        expect( res1.headers.get( 'Access-Control-Allow-Credentials' )).toBe( 'true' );

        // 2. Check disallowed origin actual request
        const req2 = new Request( 'http://localhost/global-data', {
            headers : { 'Origin' : 'https://disallowed.com' }
        });
        const res2 = await server.fetch( req2 );
        expect( res2.status ).toBe( 200 );
        expect( res2.headers.get( 'Access-Control-Allow-Origin' )).toBeNull();

        // 3. Check preflight OPTIONS request
        const preflight = new Request( 'http://localhost/global-data', {
            method  : 'OPTIONS',
            headers : {
                'Origin'                         : 'https://allowed.com',
                'Access-Control-Request-Method'  : 'GET',
                'Access-Control-Request-Headers' : 'content-type, x-global-header'
            }
        });
        const preflightRes = await server.fetch( preflight );
        expect( preflightRes.status ).toBe( 204 );
        expect( preflightRes.headers.get( 'Access-Control-Allow-Origin' )).toBe( 'https://allowed.com' );
        expect( preflightRes.headers.get( 'Access-Control-Allow-Methods' )).toContain( 'GET' );
        expect( preflightRes.headers.get( 'Access-Control-Allow-Headers' )).toBe( 'content-type, x-global-header' );
    });

    it( 'should resolve route-level CORS and method overrides over class level', async () => 
    {
    // Dummy controller instance registered in the store
        class MyController 
        {
            getData() { return 'ok' }
            getPublicData() { return 'ok' }
            getCustomData() { return 'ok' }
        }
        MetadataStore.registerController( 'MyController', new MyController());

        // 1. Controller has class-level @Cors
        // 2. Method 1 (getData) inherits class-level Cors
        // 3. Method 2 (getPublicData) overrides with parameterless @Cors() (relaxed defaults)
        // 4. Method 3 (getCustomData) overrides with custom method-level CORS
        MetadataStore.registerEndpoint({
            controller   : 'MyController',
            methodName   : 'getData',
            httpMethod   : 'GET',
            path         : '/api/data',
            params       : [],
            guards       : [],
            interceptors : [],
            cors         : { origin : 'http://class-allowed.com' },
            meta         : {}
        });

        MetadataStore.registerEndpoint({
            controller   : 'MyController',
            methodName   : 'getPublicData',
            httpMethod   : 'GET',
            path         : '/api/public',
            params       : [],
            guards       : [],
            interceptors : [],
            cors         : {}, // Parameterless @Cors()
            meta         : {}
        });

        MetadataStore.registerEndpoint({
            controller   : 'MyController',
            methodName   : 'getCustomData',
            httpMethod   : 'POST',
            path         : '/api/custom',
            params       : [],
            guards       : [],
            interceptors : [],
            cors         : {
                origin         : ( o: string ) => o.startsWith( 'https://sub.' ) && o.endsWith( '.partner.com' ),
                allowedHeaders : ['Content-Type', 'X-Custom-*']
            },
            meta : {}
        });

        const server = new Server({ port : 0 });
        ( server as any ).init();

        // Test inherited class level CORS
        const req1 = new Request( 'http://localhost/api/data', {
            headers : { 'Origin' : 'http://class-allowed.com' }
        });
        const res1 = await server.fetch( req1 );
        expect( res1.headers.get( 'Access-Control-Allow-Origin' )).toBe( 'http://class-allowed.com' );

        // Test parameterless @Cors() override (relaxed, defaults to allow all / reflect origin)
        const req2 = new Request( 'http://localhost/api/public', {
            headers : { 'Origin' : 'http://any-domain.com' }
        });
        const res2 = await server.fetch( req2 );
        expect( res2.headers.get( 'Access-Control-Allow-Origin' )).toBe( '*' );

        // Test dynamic function match and wildcard headers override
        const req3 = new Request( 'http://localhost/api/custom', {
            method  : 'POST',
            headers : { 'Origin' : 'https://sub.test.partner.com' }
        });
        const res3 = await server.fetch( req3 );
        expect( res3.headers.get( 'Access-Control-Allow-Origin' )).toBe( 'https://sub.test.partner.com' );

        // Test dynamic function mismatch
        const req4 = new Request( 'http://localhost/api/custom', {
            method  : 'POST',
            headers : { 'Origin' : 'https://partner.com' }
        });
        const res4 = await server.fetch( req4 );
        expect( res4.headers.get( 'Access-Control-Allow-Origin' )).toBeNull();

        // Test preflight wildcard header match ('X-Custom-*')
        const preflight = new Request( 'http://localhost/api/custom', {
            method  : 'OPTIONS',
            headers : {
                'Origin'                         : 'https://sub.test.partner.com',
                'Access-Control-Request-Method'  : 'POST',
                'Access-Control-Request-Headers' : 'content-type, x-custom-token, x-custom-user, x-invalid-header'
            }
        });
        const preflightRes = await server.fetch( preflight );
        expect( preflightRes.status ).toBe( 204 );
        expect( preflightRes.headers.get( 'Access-Control-Allow-Headers' )).toBe( 'content-type, x-custom-token, x-custom-user' );
    });

    it( 'should handle additional CORS options such as exposedHeaders, maxAge, and fallback allowedHeaders', async () => 
    {
        class AdditionalCorsController 
        {
            getData() { return 'ok' }
        }
        MetadataStore.registerController( 'AdditionalCorsController', new AdditionalCorsController());

        MetadataStore.registerEndpoint({
            controller   : 'AdditionalCorsController',
            methodName   : 'getData',
            httpMethod   : 'GET',
            path         : '/additional-cors',
            params       : [],
            guards       : [],
            interceptors : [],
            cors         : {
                origin         : '*',
                allowedHeaders : ['Content-Type', 'X-Allowed-Fallback'],
                exposedHeaders : ['X-Exposed-1', 'X-Exposed-2'],
                maxAge         : 86400
            },
            meta : {}
        });

        MetadataStore.registerEndpoint({
            controller   : 'AdditionalCorsController',
            methodName   : 'getData',
            httpMethod   : 'POST',
            path         : '/additional-cors-string',
            params       : [],
            guards       : [],
            interceptors : [],
            cors         : {
                origin         : '*',
                exposedHeaders : 'X-Single-Exposed'
            },
            meta : {}
        });

        MetadataStore.registerEndpoint({
            controller   : 'AdditionalCorsController',
            methodName   : 'getData',
            httpMethod   : 'PUT',
            path         : '/additional-cors-specific-origin',
            params       : [],
            guards       : [],
            interceptors : [],
            cors         : {
                origin : 'https://specific.com'
            },
            meta : {}
        });

        MetadataStore.registerEndpoint({
            controller   : 'AdditionalCorsController',
            methodName   : 'getData',
            httpMethod   : 'DELETE',
            path         : '/additional-cors-credentials-wildcard',
            params       : [],
            guards       : [],
            interceptors : [],
            cors         : {
                origin      : '*',
                credentials : true
            },
            meta : {}
        });

        MetadataStore.registerEndpoint({
            controller   : 'AdditionalCorsController',
            methodName   : 'getData',
            httpMethod   : 'POST',
            path         : '/additional-cors-methods-fn',
            params       : [],
            guards       : [],
            interceptors : [],
            cors         : {
                origin  : '*',
                methods : ( m: string ) => m === 'POST'
            },
            meta : {}
        });

        const server = new Server({ port : 0 });
        ( server as any ).init();

        // 1. Preflight OPTIONS request without Access-Control-Request-Headers
        const preflight = new Request( 'http://localhost/additional-cors', {
            method  : 'OPTIONS',
            headers : {
                'Origin'                         : 'https://any.com',
                'Access-Control-Request-Method'  : 'GET'
            }
        });
        const preflightRes = await server.fetch( preflight );
        expect( preflightRes.status ).toBe( 204 );
        expect( preflightRes.headers.get( 'Access-Control-Allow-Headers' )).toBe( 'Content-Type, X-Allowed-Fallback' );
        expect( preflightRes.headers.get( 'Access-Control-Max-Age' )).toBe( '86400' );

        // 2. Actual request checking exposedHeaders as array
        const req = new Request( 'http://localhost/additional-cors', {
            headers : { 'Origin' : 'https://any.com' }
        });
        const res = await server.fetch( req );
        expect( res.status ).toBe( 200 );
        expect( res.headers.get( 'Access-Control-Expose-Headers' )).toBe( 'X-Exposed-1, X-Exposed-2' );

        // 3. Actual request checking exposedHeaders as string
        const req2 = new Request( 'http://localhost/additional-cors-string', {
            method  : 'POST',
            headers : { 'Origin' : 'https://any.com' }
        });
        const res2 = await server.fetch( req2 );
        expect( res2.status ).toBe( 200 );
        expect( res2.headers.get( 'Access-Control-Expose-Headers' )).toBe( 'X-Single-Exposed' );

        // 4. Request with no Origin header when origin config is '*' (should fallback to '*')
        const reqNoOriginWildcard = new Request( 'http://localhost/additional-cors' );
        const resNoOriginWildcard = await server.fetch( reqNoOriginWildcard );
        expect( resNoOriginWildcard.headers.get( 'Access-Control-Allow-Origin' )).toBe( '*' );

        // 5. Request with no Origin header when origin config is a specific string
        const reqNoOriginSpecific = new Request( 'http://localhost/additional-cors-specific-origin', { method : 'PUT' });
        const resNoOriginSpecific = await server.fetch( reqNoOriginSpecific );
        expect( resNoOriginSpecific.headers.get( 'Access-Control-Allow-Origin' )).toBe( 'https://specific.com' );

        // 6. Request with credentials and origin '*' without origin header
        const reqCredentialsNoOrigin = new Request( 'http://localhost/additional-cors-credentials-wildcard', { method : 'DELETE' });
        const resCredentialsNoOrigin = await server.fetch( reqCredentialsNoOrigin );
        expect( resCredentialsNoOrigin.headers.get( 'Access-Control-Allow-Origin' )).toBeNull();

        // 7. Preflight OPTIONS request where methods config is a function
        const preflightMethodsFn = new Request( 'http://localhost/additional-cors-methods-fn', {
            method  : 'OPTIONS',
            headers : {
                'Origin'                         : 'https://any.com',
                'Access-Control-Request-Method'  : 'POST'
            }
        });
        const resMethodsFn = await server.fetch( preflightMethodsFn );
        expect( resMethodsFn.status ).toBe( 204 );
        expect( resMethodsFn.headers.get( 'Access-Control-Allow-Methods' )).toBe( 'POST' );
    });
});

