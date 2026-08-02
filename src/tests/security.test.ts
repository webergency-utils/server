import { describe, it, expect } from 'vitest';
import { Server } from '../server.js';
import { seedInstanceController } from '../testing.js';
import { mergeSecurityConfigs, generateSecurityHeaders } from '../helpers/security.js';

describe( 'Security Helper & Integration Tests', () =>
{
    describe( 'mergeSecurityConfigs helper', () =>
    {
        it( 'should return undefined if all configs are undefined', () =>
        {
            const merged = mergeSecurityConfigs([undefined, undefined]);
            expect( merged ).toBeUndefined();
        });

        it( 'should initialize empty object if config is true', () =>
        {
            const merged = mergeSecurityConfigs([true]);
            expect( merged ).toEqual({});
        });

        it( 'should propagate false overrides to disable all headers', () =>
        {
            const merged = mergeSecurityConfigs([true, false]);
            expect( merged ).toEqual({
                maxBodySize                  : 0,
                frameguard                   : false,
                noSniff                      : false,
                hsts                         : false,
                downloadOptions              : false,
                permittedCrossDomainPolicies : false,
                referrerPolicy               : false,
                xssFilter                    : false,
                csp                          : false,
                coep                         : false,
                coop                         : false,
                corp                         : false
            });
        });

        it( 'should merge objects hierarchically', () =>
        {
            const merged = mergeSecurityConfigs([
                { frameguard : 'deny', hsts : { maxAge : 100 } },
                { frameguard : 'sameorigin', csp : { 'default-src' : ["'self'"] } }
            ]);
            expect( merged ).toEqual({
                frameguard : 'sameorigin',
                hsts       : { maxAge : 100 },
                csp        : { 'default-src' : ["'self'"] }
            });
        });
    });

    describe( 'generateSecurityHeaders helper', () =>
    {
        it( 'should generate default headers when config is true or empty object', () =>
        {
            const headers = generateSecurityHeaders( true );
            expect( headers['X-Frame-Options']).toBe( 'SAMEORIGIN' );
            expect( headers['X-Content-Type-Options']).toBe( 'nosniff' );
            expect( headers['Strict-Transport-Security']).toBe( 'max-age=15552000; includeSubDomains' );
            expect( headers['X-Download-Options']).toBe( 'noopen' );
            expect( headers['X-Permitted-Cross-Domain-Policies']).toBe( 'none' );
            expect( headers['Referrer-Policy']).toBe( 'no-referrer' );
            expect( headers['X-XSS-Protection']).toBe( '0' );
            expect( headers['Content-Security-Policy']).toBeUndefined();
        });

        it( 'should respect false to omit specific headers', () =>
        {
            const headers = generateSecurityHeaders({
                frameguard : false,
                hsts       : false,
                noSniff    : true
            });
            expect( headers['X-Frame-Options']).toBeUndefined();
            expect( headers['Strict-Transport-Security']).toBeUndefined();
            expect( headers['X-Content-Type-Options']).toBe( 'nosniff' );
        });

        it( 'should emit CSP string, object, and cross-origin policies', () =>
        {
            // Arrange / Act
            const asTrue = generateSecurityHeaders({
                csp  : true,
                coep : true,
                coop : true,
                corp : true
            });
            const asString = generateSecurityHeaders({
                csp            : "default-src 'none'",
                coep           : 'credentialless',
                coop           : 'same-origin-allow-popups',
                corp           : 'cross-origin',
                referrerPolicy : 'strict-origin',
                frameguard     : 'deny',
                hsts           : { maxAge : 60, includeSubDomains : false, preload : true }
            });
            const asObject = generateSecurityHeaders({
                csp : {
                    'default-src' : ["'self'"],
                    'img-src'     : '*'
                }
            });

            // Assert
            expect( asTrue['Content-Security-Policy']).toBe( "default-src 'self'" );
            expect( asTrue['Cross-Origin-Embedder-Policy']).toBe( 'require-corp' );
            expect( asTrue['Cross-Origin-Opener-Policy']).toBe( 'same-origin' );
            expect( asTrue['Cross-Origin-Resource-Policy']).toBe( 'same-origin' );

            expect( asString['Content-Security-Policy']).toBe( "default-src 'none'" );
            expect( asString['Cross-Origin-Embedder-Policy']).toBe( 'credentialless' );
            expect( asString['Cross-Origin-Opener-Policy']).toBe( 'same-origin-allow-popups' );
            expect( asString['Cross-Origin-Resource-Policy']).toBe( 'cross-origin' );
            expect( asString['Referrer-Policy']).toBe( 'strict-origin' );
            expect( asString['X-Frame-Options']).toBe( 'DENY' );
            expect( asString['Strict-Transport-Security']).toBe( 'max-age=60; preload' );

            expect( asObject['Content-Security-Policy']).toContain( "default-src 'self'" );
            expect( asObject['Content-Security-Policy']).toContain( 'img-src *' );
        });

        it( 'should support frameguard action objects and custom cross-domain policy', () =>
        {
            // Arrange / Act
            const headers = generateSecurityHeaders({
                frameguard                   : { action : 'sameorigin' },
                permittedCrossDomainPolicies : 'master-only',
                downloadOptions              : true
            });

            // Assert
            expect( headers['X-Frame-Options']).toBe( 'SAMEORIGIN' );
            expect( headers['X-Permitted-Cross-Domain-Policies']).toBe( 'master-only' );
            expect( headers['X-Download-Options']).toBe( 'noopen' );
        });

        it( 'should ignore obsolete or incomplete frameguard actions like allow-from', () =>
        {
            // Arrange / Act
            const headers = generateSecurityHeaders({
                frameguard : { action : 'allow-from' as 'deny' }
            });

            // Assert
            expect( headers['X-Frame-Options']).toBeUndefined();
        });

        it( 'should drop referrerPolicy and cross-domain policy values outside the allowlist', () =>
        {
            // Arrange / Act
            const headers = generateSecurityHeaders({
                referrerPolicy               : 'no-referrer; injected' as 'no-referrer',
                permittedCrossDomainPolicies : 'anything-goes' as 'none'
            });

            // Assert
            expect( headers['Referrer-Policy']).toBeUndefined();
            expect( headers['X-Permitted-Cross-Domain-Policies']).toBeUndefined();
        });

        it( 'should emit Permissions-Policy from true, string, and object forms', () =>
        {
            // Arrange / Act
            const asTrue = generateSecurityHeaders({ permissionsPolicy : true });
            const asString = generateSecurityHeaders({ permissionsPolicy : 'fullscreen=(self)' });
            const asObject = generateSecurityHeaders({
                permissionsPolicy : {
                    camera      : [],
                    geolocation : ["'self'"],
                    microphone  : '*'
                }
            });
            const off = generateSecurityHeaders( true );

            // Assert
            expect( asTrue['Permissions-Policy']).toBe( 'camera=(), microphone=(), geolocation=()' );
            expect( asString['Permissions-Policy']).toBe( 'fullscreen=(self)' );
            expect( asObject['Permissions-Policy']).toBe( "camera=(), geolocation=('self'), microphone=(*)" );
            expect( off['Permissions-Policy']).toBeUndefined();
        });
    });

    describe( 'Server integration - Request Protections', () =>
    {
        it( 'should enforce maxBodySize limits and return 413', async () =>
        {
            const server = new Server({
                port     : 0,
                security : { maxBodySize : '10b' }
            });
            class DummyController
            {
                index( body: any ) { return 'ok' }
            }
            seedInstanceController( server.registry, 'DummyController', new DummyController(), [{
                methodName : 'index',
                httpMethod : 'POST',
                path       : '/body-test',
                params     : [{ source : 'Body' }]
            }]);

            const resOk = await server.fetch( new Request( 'http://localhost/body-test', {
                method  : 'POST',
                body    : '"hello"',
                headers : { 'Content-Type' : 'application/json' }
            }));
            expect( resOk.status ).toBe( 200 );

            const resTooBig = await server.fetch( new Request( 'http://localhost/body-test', {
                method  : 'POST',
                body    : '"hello world"',
                headers : { 'Content-Type' : 'application/json' }
            }));
            expect( resTooBig.status ).toBe( 413 );
        });

        it( 'should enforce timeout limits and return 408', async () =>
        {
            const server = new Server({ port : 0 });
            class DummyController
            {
                async delay()
                {
                    await new Promise( r => setTimeout( r, 50 ));

                    return 'done';
                }
            }
            seedInstanceController( server.registry, 'DummyController', new DummyController(), [{
                methodName : 'delay',
                httpMethod : 'GET',
                path       : '/timeout-test',
                security   : { timeout : 10 }
            }]);

            const res = await server.fetch( new Request( 'http://localhost/timeout-test' ));
            expect( res.status ).toBe( 408 );
        });

        it( 'should abort the request signal when timeout fires', async () =>
        {
            const server = new Server({ port : 0 });
            let aborted = false;

            class DummyController
            {
                async delay( req: any )
                {
                    for( let i = 0; i < 40; i++ )
                    {
                        if( req.signal?.aborted )
                        {
                            aborted = true;
                            break;
                        }

                        await new Promise( r => setTimeout( r, 5 ));
                    }

                    return 'done';
                }
            }
            seedInstanceController( server.registry, 'DummyController', new DummyController(), [{
                methodName : 'delay',
                httpMethod : 'GET',
                path       : '/timeout-abort',
                params     : [{ source : 'Request' }],
                security   : { timeout : 10 }
            }]);

            const res = await server.fetch( new Request( 'http://localhost/timeout-abort' ));
            expect( res.status ).toBe( 408 );
            await new Promise( r => setTimeout( r, 30 ));
            expect( aborted ).toBe( true );
        });

        it( 'should map ServerError.code through the outer fetch catch', async () =>
        {
            const server = new Server({ port : 0 });
            const { NotFoundError } = await import( '../errors.js' );
            ( server as any ).router.lookup = () =>
            {
                throw new NotFoundError( 'missing route internals' );
            };

            const res = await server.fetch( new Request( 'http://localhost/any' ));
            expect( res.status ).toBe( 404 );
            const body = await res.json();
            expect( body.error ).toContain( 'missing route internals' );
        });

        it( 'should enforce allowedContentTypes and return 415', async () =>
        {
            const server = new Server({
                port     : 0,
                security : { allowedContentTypes : ['application/json'] }
            });
            class DummyController
            {
                index(){ return 'ok' }
            }
            seedInstanceController( server.registry, 'DummyController', new DummyController(), [{
                methodName : 'index',
                httpMethod : 'POST',
                path       : '/type-test'
            }]);

            const resOk = await server.fetch( new Request( 'http://localhost/type-test', {
                method  : 'POST',
                headers : { 'Content-Type' : 'application/json' }
            }));
            expect( resOk.status ).toBe( 200 );

            const resBad = await server.fetch( new Request( 'http://localhost/type-test', {
                method  : 'POST',
                headers : { 'Content-Type' : 'text/plain' }
            }));
            expect( resBad.status ).toBe( 415 );

            const resMissing = await server.fetch( new Request( 'http://localhost/type-test', {
                method : 'POST',
                body   : '{"a":1}'
            }));
            expect( resMissing.status ).toBe( 415 );

            const resEmpty = await server.fetch( new Request( 'http://localhost/type-test', {
                method : 'POST'
            }));
            expect( resEmpty.status ).toBe( 200 );
        });

        it( 'should enforce rateLimit and return 429', async () =>
        {
            const server = new Server({ port : 0 });
            class DummyController
            {
                index(){ return 'ok' }
            }
            seedInstanceController( server.registry, 'DummyController', new DummyController(), [{
                methodName : 'index',
                httpMethod : 'GET',
                path       : '/rate-test',
                security   : { rateLimit : { max : 2, window : '1s' } }
            }]);

            const res1 = await server.fetch( new Request( 'http://localhost/rate-test' ));
            expect( res1.status ).toBe( 200 );

            const res2 = await server.fetch( new Request( 'http://localhost/rate-test' ));
            expect( res2.status ).toBe( 200 );

            const res3 = await server.fetch( new Request( 'http://localhost/rate-test' ));
            expect( res3.status ).toBe( 429 );
            expect( res3.headers.get( 'Retry-After' )).toBe( '1' );
        });

        it( 'should not let spoofed XFF bypass rate limits without trustProxy', async () =>
        {
            const server = new Server({ port : 0 });
            class DummyController
            {
                index(){ return 'ok' }
            }
            seedInstanceController( server.registry, 'DummyController', new DummyController(), [{
                methodName : 'index',
                httpMethod : 'GET',
                path       : '/rate-xff',
                security   : { rateLimit : { max : 1, window : '1s' } }
            }]);

            const first = await server.fetch( new Request( 'http://localhost/rate-xff', {
                headers : { 'x-forwarded-for' : '203.0.113.1' }
            }));
            const second = await server.fetch( new Request( 'http://localhost/rate-xff', {
                headers : { 'x-forwarded-for' : '203.0.113.2' }
            }));

            expect( first.status ).toBe( 200 );
            expect( second.status ).toBe( 429 );
        });

        it( 'should rate-limit by XFF client when trustProxy matches the peer', async () =>
        {
            const server = new Server({
                port       : 0,
                trustProxy : [ '10.0.0.0/8' ]
            });
            class DummyController
            {
                index(){ return 'ok' }
            }
            seedInstanceController( server.registry, 'DummyController', new DummyController(), [{
                methodName : 'index',
                httpMethod : 'GET',
                path       : '/rate-trusted',
                security   : { rateLimit : { max : 1, window : '1s' } }
            }]);

            const make = ( client: string ) =>
            {
                const req = new Request( 'http://localhost/rate-trusted', {
                    headers : { 'x-forwarded-for' : client }
                });
                ( req as any ).remoteAddress = '10.0.0.5';

                return server.fetch( req );
            };

            expect(( await make( '203.0.113.1' )).status ).toBe( 200 );
            expect(( await make( '203.0.113.1' )).status ).toBe( 429 );
            expect(( await make( '203.0.113.2' )).status ).toBe( 200 );
        });
    });
});
