import { describe, it, expect } from 'vitest';
import { Server } from '../server.js';
import { seedInstanceController } from '../testing.js';
import { isAllowed, handleCors } from '../helpers/cors.js';

describe( 'CORS helpers', () =>
{
    it( 'should evaluate boolean rules, reflect origin:true, and reject unknown rule types', () =>
    {
        // Arrange / Act / Assert
        expect( isAllowed( 'x', true )).toBe( true );
        expect( isAllowed( 'x', false )).toBe( false );
        expect( isAllowed( 'x', { nope : true })).toBe( false );

        const req = new Request( 'http://localhost/', {
            headers : { Origin : 'https://app.example' }
        });
        const headers = handleCors( req, { origin : true });
        expect( headers && !( headers instanceof Response ) ? headers['Access-Control-Allow-Origin'] : null )
            .toBe( 'https://app.example' );
        expect( headers && !( headers instanceof Response ) ? headers['Vary'] : null ).toBe( 'Origin' );

        const starred = handleCors( req, { origin : '*' });
        expect( starred && !( starred instanceof Response ) ? starred['Vary'] : undefined ).toBeUndefined();
    });
});

describe( 'CORS Integration & Runtime Tests', () =>
{
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

        class GlobalController
        {
            getData() { return 'ok' }
        }

        seedInstanceController( server.registry, 'GlobalController', new GlobalController(), [
            {
                methodName : 'getData',
                httpMethod : 'GET',
                path       : '/global-data'
            }
        ]);

        const req1 = new Request( 'http://localhost/global-data', {
            headers : { 'Origin' : 'https://allowed.com' }
        });
        const res1 = await server.fetch( req1 );
        expect( res1.status ).toBe( 200 );
        expect( res1.headers.get( 'Access-Control-Allow-Origin' )).toBe( 'https://allowed.com' );
        expect( res1.headers.get( 'Access-Control-Allow-Credentials' )).toBe( 'true' );

        const req2 = new Request( 'http://localhost/global-data', {
            headers : { 'Origin' : 'https://disallowed.com' }
        });
        const res2 = await server.fetch( req2 );
        expect( res2.status ).toBe( 200 );
        expect( res2.headers.get( 'Access-Control-Allow-Origin' )).toBeNull();

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
        class MyController
        {
            getData() { return 'ok' }
            getPublicData() { return 'ok' }
            getCustomData() { return 'ok' }
        }

        const server = new Server({ port : 0 });
        seedInstanceController( server.registry, 'MyController', new MyController(), [
            {
                methodName : 'getData',
                httpMethod : 'GET',
                path       : '/api/data',
                cors       : { origin : 'http://class-allowed.com' }
            },
            {
                methodName : 'getPublicData',
                httpMethod : 'GET',
                path       : '/api/public',
                cors       : {}
            },
            {
                methodName : 'getCustomData',
                httpMethod : 'POST',
                path       : '/api/custom',
                cors       : {
                    origin         : ( o: string ) => o.startsWith( 'https://sub.' ) && o.endsWith( '.partner.com' ),
                    allowedHeaders : ['Content-Type', 'X-Custom-*']
                }
            }
        ]);

        const req1 = new Request( 'http://localhost/api/data', {
            headers : { 'Origin' : 'http://class-allowed.com' }
        });
        const res1 = await server.fetch( req1 );
        expect( res1.headers.get( 'Access-Control-Allow-Origin' )).toBe( 'http://class-allowed.com' );

        const req2 = new Request( 'http://localhost/api/public', {
            headers : { 'Origin' : 'http://any-domain.com' }
        });
        const res2 = await server.fetch( req2 );
        expect( res2.headers.get( 'Access-Control-Allow-Origin' )).toBe( '*' );

        const req3 = new Request( 'http://localhost/api/custom', {
            method  : 'POST',
            headers : { 'Origin' : 'https://sub.test.partner.com' }
        });
        const res3 = await server.fetch( req3 );
        expect( res3.headers.get( 'Access-Control-Allow-Origin' )).toBe( 'https://sub.test.partner.com' );

        const req4 = new Request( 'http://localhost/api/custom', {
            method  : 'POST',
            headers : { 'Origin' : 'https://partner.com' }
        });
        const res4 = await server.fetch( req4 );
        expect( res4.headers.get( 'Access-Control-Allow-Origin' )).toBeNull();

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

        const server = new Server({ port : 0 });
        seedInstanceController( server.registry, 'AdditionalCorsController', new AdditionalCorsController(), [
            {
                methodName : 'getData',
                httpMethod : 'GET',
                path       : '/additional-cors',
                cors       : {
                    origin         : '*',
                    allowedHeaders : ['Content-Type', 'X-Allowed-Fallback'],
                    exposedHeaders : ['X-Exposed-1', 'X-Exposed-2'],
                    maxAge         : 86400
                }
            },
            {
                methodName : 'getData',
                httpMethod : 'POST',
                path       : '/additional-cors-string',
                cors       : {
                    origin         : '*',
                    exposedHeaders : 'X-Single-Exposed'
                }
            },
            {
                methodName : 'getData',
                httpMethod : 'PUT',
                path       : '/additional-cors-specific-origin',
                cors       : {
                    origin : 'https://specific.com'
                }
            },
            {
                methodName : 'getData',
                httpMethod : 'DELETE',
                path       : '/additional-cors-credentials-wildcard',
                cors       : {
                    origin      : '*',
                    credentials : true
                }
            },
            {
                methodName : 'getData',
                httpMethod : 'POST',
                path       : '/additional-cors-methods-fn',
                cors       : {
                    origin  : '*',
                    methods : ( m: string ) => m === 'POST'
                }
            }
        ]);

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

        const req = new Request( 'http://localhost/additional-cors', {
            headers : { 'Origin' : 'https://any.com' }
        });
        const res = await server.fetch( req );
        expect( res.status ).toBe( 200 );
        expect( res.headers.get( 'Access-Control-Expose-Headers' )).toBe( 'X-Exposed-1, X-Exposed-2' );

        const req2 = new Request( 'http://localhost/additional-cors-string', {
            method  : 'POST',
            headers : { 'Origin' : 'https://any.com' }
        });
        const res2 = await server.fetch( req2 );
        expect( res2.status ).toBe( 200 );
        expect( res2.headers.get( 'Access-Control-Expose-Headers' )).toBe( 'X-Single-Exposed' );

        const reqNoOriginWildcard = new Request( 'http://localhost/additional-cors' );
        const resNoOriginWildcard = await server.fetch( reqNoOriginWildcard );
        expect( resNoOriginWildcard.headers.get( 'Access-Control-Allow-Origin' )).toBe( '*' );

        const reqNoOriginSpecific = new Request( 'http://localhost/additional-cors-specific-origin', { method : 'PUT' });
        const resNoOriginSpecific = await server.fetch( reqNoOriginSpecific );
        expect( resNoOriginSpecific.headers.get( 'Access-Control-Allow-Origin' )).toBe( 'https://specific.com' );

        const reqCredentialsNoOrigin = new Request( 'http://localhost/additional-cors-credentials-wildcard', { method : 'DELETE' });
        const resCredentialsNoOrigin = await server.fetch( reqCredentialsNoOrigin );
        expect( resCredentialsNoOrigin.headers.get( 'Access-Control-Allow-Origin' )).toBeNull();

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
