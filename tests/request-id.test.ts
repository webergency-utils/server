import { describe, it, expect } from 'vitest';
import { resolveRequestId, REQUEST_ID_HEADER } from '../src/helpers/request-id.js';

describe( 'resolveRequestId', () =>
{
    it( 'should keep a non-empty inbound X-Request-Id', () =>
    {
        // Arrange
        const request = new Request( 'http://localhost/', {
            headers : { [REQUEST_ID_HEADER] : 'client-42' }
        });

        // Act / Assert
        expect( resolveRequestId( request )).toBe( 'client-42' );
    });

    it( 'should mint a UUID when the header is missing', () =>
    {
        // Arrange
        const request = new Request( 'http://localhost/' );

        // Act
        const id = resolveRequestId( request );

        // Assert
        expect( id ).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        );
    });

    it( 'should mint a UUID when the header is blank', () =>
    {
        // Arrange
        const request = new Request( 'http://localhost/', {
            headers : { [REQUEST_ID_HEADER] : '   ' }
        });

        // Act
        const id = resolveRequestId( request );

        // Assert
        expect( id ).not.toBe( '   ' );
        expect( id.length ).toBeGreaterThan( 0 );
    });

    it( 'should echo X-Request-Id on CORS preflight and OPTIONS responses', async () =>
    {
        // Arrange
        const { Server } = await import( '../src/server.js' );
        const { setControllerMeta, setInjectableMeta } = await import( '../src/core/symbols.js' );

        class PingCtrl
        {
            ping() { return { ok : true } }
        }
        setInjectableMeta( PingCtrl, { kind : 'controller', token : 'PingCtrl' });
        setControllerMeta( PingCtrl, {
            endpoints :
            [
                {
                    controller   : 'PingCtrl',
                    methodName   : 'ping',
                    httpMethod   : 'GET',
                    path         : '/ping',
                    params       : [],
                    guards       : [],
                    interceptors : [],
                    middlewares  : [],
                    meta         : {}
                }
            ]
        });

        const server = new Server({
            port        : 0,
            signals     : false,
            cors        : { origin : '*' },
            controllers : [ PingCtrl ]
        });

        // Act
        const preflightRes = await server.fetch( new Request( 'http://localhost/ping', {
            method  : 'OPTIONS',
            headers : {
                Origin                          : 'https://example.com',
                'Access-Control-Request-Method' : 'GET',
                [REQUEST_ID_HEADER]             : 'req-preflight-1'
            }
        }));
        const optionsRes = await server.fetch( new Request( 'http://localhost/ping', {
            method  : 'OPTIONS',
            headers : {
                [REQUEST_ID_HEADER] : 'req-options-2'
            }
        }));

        // Assert
        expect( preflightRes.status ).toBe( 204 );
        expect( preflightRes.headers.get( REQUEST_ID_HEADER )).toBe( 'req-preflight-1' );
        expect( optionsRes.status ).toBe( 204 );
        expect( optionsRes.headers.get( REQUEST_ID_HEADER )).toBe( 'req-options-2' );
    });
});
