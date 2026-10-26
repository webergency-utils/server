import { describe, it, expect } from 'vitest';
import { Server } from '../src/server.js';
import { ForwardIntent } from '../src/core/types.js';
import { ServerRequest } from '../src/core/server-request.js';
import { seedInstanceController } from './helpers/testing.js';
import { mergeSecurityConfigs, generateSecurityHeaders, isHostAllowed } from '../src/helpers/security.js';

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
                allowedHosts                 : true,
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

        it( 'should merge allowedHosts and allow child true or false override', () =>
        {
            const overriddenList = mergeSecurityConfigs([
                { allowedHosts : ['a.com'] },
                { allowedHosts : ['b.com'] }
            ]);
            expect( overriddenList?.allowedHosts ).toEqual(['b.com']);

            const overriddenTrue = mergeSecurityConfigs([
                { allowedHosts : ['a.com'] },
                { allowedHosts : true }
            ]);
            expect( overriddenTrue?.allowedHosts ).toBe( true );

            const overriddenFalse = mergeSecurityConfigs([
                { allowedHosts : ['a.com'] },
                false
            ]);
            expect( overriddenFalse?.allowedHosts ).toBe( true );
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

    describe( 'isHostAllowed helper and ServerRequest allowedHosts', () =>
    {
        it( 'should match exact hostnames and leading-dot subdomain wildcards case-insensitively', () =>
        {
            const cfg = { allowedHosts : [ 'localhost', '.example.com' ] };

            expect( isHostAllowed( 'localhost', cfg )).toBe( true );
            expect( isHostAllowed( 'localhost:3000', cfg )).toBe( true );
            expect( isHostAllowed( 'EXAMPLE.COM', cfg )).toBe( true );
            expect( isHostAllowed( 'example.com:443', cfg )).toBe( true );
            expect( isHostAllowed( 'sub.example.com:8080', cfg )).toBe( true );
            expect( isHostAllowed( 'a.b.example.com', cfg )).toBe( true );
        });

        it( 'should match IPv6 bracket literals configured with or without brackets', () =>
        {
            const cfgBracketed = { allowedHosts : ['[::1]'] };
            const cfgBare = { allowedHosts : ['::1'] };

            expect( isHostAllowed( '[::1]:3000', cfgBracketed )).toBe( true );
            expect( isHostAllowed( '[::1]', cfgBracketed )).toBe( true );
            expect( isHostAllowed( '[::1]:3000', cfgBare )).toBe( true );
            expect( isHostAllowed( '[::1]', cfgBare )).toBe( true );
        });

        it( 'should reject missing, malformed, or non-matching Host headers', () =>
        {
            const cfg = { allowedHosts : [ 'localhost', '.example.com', '[::1]' ] };

            expect( isHostAllowed( null, cfg )).toBe( false );
            expect( isHostAllowed( '', cfg )).toBe( false );
            expect( isHostAllowed( '   ', cfg )).toBe( false );
            expect( isHostAllowed( 'evil.com', cfg )).toBe( false );
            expect( isHostAllowed( 'badexample.com', cfg )).toBe( false );
            expect( isHostAllowed( 'example.com:0', cfg )).toBe( false );
            expect( isHostAllowed( 'example.com:abc', cfg )).toBe( false );
            expect( isHostAllowed( 'example.com:99999', cfg )).toBe( false );
            expect( isHostAllowed( '[::1', cfg )).toBe( false );
            expect( isHostAllowed( '[]', cfg )).toBe( false );
            expect( isHostAllowed( '[::1]:abc', cfg )).toBe( false );
            expect( isHostAllowed( '[::1]extra', cfg )).toBe( false );
            expect( isHostAllowed( '::1:3000', cfg )).toBe( false );
            expect( isHostAllowed( ':3000', cfg )).toBe( false );
            expect( isHostAllowed( 'localhost, evil.com', cfg )).toBe( false );
            expect( isHostAllowed( 'local host', cfg )).toBe( false );
            expect( isHostAllowed( '.', cfg )).toBe( false );
            expect( isHostAllowed( 'example.com..', cfg )).toBe( false );
            expect( isHostAllowed( 'localhost.', cfg )).toBe( true );
            expect( isHostAllowed( 'sub.example.com.:8080', cfg )).toBe( true );
        });

        it( 'should allow any host when allowedHosts is undefined, true, or empty array', () =>
        {
            expect( isHostAllowed( null, {})).toBe( true );
            expect( isHostAllowed( 'anything.com', { allowedHosts : true })).toBe( true );
            expect( isHostAllowed( 'anything.com', { allowedHosts : [] })).toBe( true );
        });

        it( 'should forward direct allowedHosts option on ServerRequest init', () =>
        {
            const sreq = new ServerRequest(
                new Request( 'http://localhost/test' ),
                { allowedHosts : ['localhost'] }
            );
            expect( sreq ).toBeDefined();
            // Verify ServerRequest recognizes allowedHosts alone as a direct SecurityOptions field
            // by checking that a second ServerRequest.from call does not overwrite existing #security
            const reused = ServerRequest.from( sreq, { maxBodySize : '5b' });
            const sreqWithBody = new ServerRequest(
                new Request( 'http://localhost/test', { method : 'POST', body : '"12345678901"' }),
                { allowedHosts : ['localhost'] }
            );
            ServerRequest.from( sreqWithBody, { maxBodySize : '5b' });

            return expect( reused.rawBody()).resolves.toBeDefined()
                .then(() => expect( sreqWithBody.rawBody()).resolves.toBeDefined());
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
            const { NotFoundError } = await import( '../src/errors.js' );
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

        it( 'should enforce allowedHosts across GET, POST, and WS upgrades and return 403 Forbidden', async () =>
        {
            const server = new Server({
                port     : 0,
                security : { allowedHosts : [ 'localhost', '.example.com' ] }
            });
            class DummyController
            {
                getOk(){ return 'ok' }
                postOk(){ return 'ok' }
                wsOk(){}
            }
            seedInstanceController( server.registry, 'DummyController', new DummyController(), [
                {
                    methodName : 'getOk',
                    httpMethod : 'GET',
                    path       : '/host-test'
                },
                {
                    methodName : 'postOk',
                    httpMethod : 'POST',
                    path       : '/host-test'
                },
                {
                    methodName : 'wsOk',
                    httpMethod : 'WS',
                    path       : '/ws-host-test'
                }
            ]);

            // Matching hosts -> 200
            const getLocal = await server.fetch( new Request( 'http://localhost/host-test', {
                headers : { host : 'localhost:3000' }
            }));
            expect( getLocal.status ).toBe( 200 );

            const getSub = await server.fetch( new Request( 'http://localhost/host-test', {
                headers : { host : 'api.example.com:8080' }
            }));
            expect( getSub.status ).toBe( 200 );

            // Disallowed host -> 403 Forbidden
            const getEvil = await server.fetch( new Request( 'http://localhost/host-test', {
                headers : { host : 'evil.com' }
            }));
            expect( getEvil.status ).toBe( 403 );
            expect( await getEvil.json()).toEqual({
                success : false,
                error   : 'Forbidden: Disallowed Host'
            });

            // Missing Host header -> 403 Forbidden
            const getMissing = await server.fetch( new Request( 'http://localhost/host-test' ));
            expect( getMissing.status ).toBe( 403 );

            // Malformed Host header -> 403 Forbidden
            const postMalformed = await server.fetch( new Request( 'http://localhost/host-test', {
                method  : 'POST',
                headers : { host : 'localhost:99999' }
            }));
            expect( postMalformed.status ).toBe( 403 );

            // WS upgrade with disallowed Host -> 403 Forbidden
            const wsEvil = await server.fetch( new Request( 'http://localhost/ws-host-test', {
                headers : { upgrade : 'websocket', host : 'evil.com' }
            }));
            expect( wsEvil.status ).toBe( 403 );
        });

        it( 'should support route-level allowedHosts overrides and keep /health and /ready probes accessible', async () =>
        {
            const server = new Server({
                port     : 0,
                health   : true,
                security : { allowedHosts : ['api.example.com'] }
            });
            class DummyController
            {
                webhook(){ return 'webhook-ok' }
                partner(){ return 'partner-ok' }
            }
            seedInstanceController( server.registry, 'DummyController', new DummyController(), [
                {
                    methodName : 'webhook',
                    httpMethod : 'POST',
                    path       : '/webhook',
                    security   : { allowedHosts : true }
                },
                {
                    methodName : 'partner',
                    httpMethod : 'GET',
                    path       : '/partner',
                    security   : { allowedHosts : ['partner.org'] }
                }
            ]);

            // Route with allowedHosts: true accepts any Host
            const webhookRes = await server.fetch( new Request( 'http://localhost/webhook', {
                method  : 'POST',
                headers : { host : 'any-caller.internal' }
            }));
            expect( webhookRes.status ).toBe( 200 );

            // Route with allowedHosts: ['partner.org'] accepts partner.org and rejects api.example.com
            const partnerOk = await server.fetch( new Request( 'http://localhost/partner', {
                headers : { host : 'partner.org' }
            }));
            expect( partnerOk.status ).toBe( 200 );

            const partnerBlocked = await server.fetch( new Request( 'http://localhost/partner', {
                headers : { host : 'api.example.com' }
            }));
            expect( partnerBlocked.status ).toBe( 403 );

            // Pre-routing /health and /ready probes bypass allowedHosts when queried by pod IP
            const healthRes = await server.fetch( new Request( 'http://10.0.0.12:3000/health', {
                headers : { host : '10.0.0.12:3000' }
            }));
            expect( healthRes.status ).toBe( 200 );

            const readyRes = await server.fetch( new Request( 'http://10.0.0.12:3000/ready', {
                headers : { host : '10.0.0.12:3000' }
            }));
            expect( readyRes.status ).toBe( 200 );
        });

        it( 'should enforce target route allowedHosts when forwarded from a permissive route', async () =>
        {
            const server = new Server({
                port     : 0,
                security : { allowedHosts : ['internal.example.com'] }
            });
            class ForwardController
            {
                entry()
                {
                    throw new ForwardIntent({ method : 'GET', path : '/restricted' });
                }

                restricted()
                {
                    return 'secret-ok';
                }
            }
            seedInstanceController( server.registry, 'ForwardController', new ForwardController(), [
                {
                    methodName : 'entry',
                    httpMethod : 'GET',
                    path       : '/entry',
                    security   : { allowedHosts : true }
                },
                {
                    methodName : 'restricted',
                    httpMethod : 'GET',
                    path       : '/restricted',
                    security   : { allowedHosts : ['internal.example.com'] }
                }
            ]);

            const blocked = await server.fetch( new Request( 'http://localhost/entry', {
                headers : { host : 'evil.com' }
            }));
            expect( blocked.status ).toBe( 403 );

            const allowed = await server.fetch( new Request( 'http://localhost/entry', {
                headers : { host : 'internal.example.com' }
            }));
            expect( allowed.status ).toBe( 200 );
            expect( await allowed.text()).toBe( 'secret-ok' );
        });
    });
});
