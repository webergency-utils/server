import { describe, it, expect } from 'vitest';
import { Router, toAllowList } from '../src/core/router.js';
import { EndpointMetadata, Method } from '../src/core/types.js';

function endpoint( httpMethod: Method, path: string, methodName = 'handler' ): EndpointMetadata
{
    return {
        controller   : 'Ctrl',
        methodName,
        httpMethod,
        path,
        params       : [],
        guards       : [],
        interceptors : [],
        middlewares  : [],
        meta         : {}
    } as EndpointMetadata;
}

function router( ...routes: EndpointMetadata[]): Router
{
    const instance = new Router();

    for( const route of routes ){ instance.add( route ) }
    instance.compile();

    return instance;
}

describe( 'Router', () =>
{
    it( 'should match an exact path without consulting the dynamic buckets', () =>
    {
        // Arrange
        const instance = router( endpoint( 'GET', '/users' ));

        // Act
        const hit = instance.lookup( 'GET', '/users' );

        // Assert
        expect( hit.match?.metadata.path ).toBe( '/users' );
        expect( hit.match?.params ).toEqual({});
    });

    it( 'should accept an optional trailing slash on a static path', () =>
    {
        // Arrange
        const instance = router( endpoint( 'GET', '/users' ));

        // Act / Assert
        expect( instance.lookup( 'GET', '/users/' ).match ).not.toBeNull();
    });

    it( 'should prefer a static path over a parametric one regardless of registration order', () =>
    {
        // Arrange — the parametric route is registered first, so registration order would lose
        const instance = router(
            endpoint( 'GET', '/users/:id', 'byId' ),
            endpoint( 'GET', '/users/me', 'me' )
        );

        // Act
        const hit = instance.lookup( 'GET', '/users/me' );

        // Assert
        expect( hit.match?.metadata.methodName ).toBe( 'me' );
        expect( instance.lookup( 'GET', '/users/42' ).match?.metadata.methodName ).toBe( 'byId' );
    });

    it( 'should prefer a parametric segment over a wildcard regardless of registration order', () =>
    {
        // Arrange
        const instance = router(
            endpoint( 'GET', '/files/*rest', 'wild' ),
            endpoint( 'GET', '/files/:name', 'named' )
        );

        // Act / Assert
        expect( instance.lookup( 'GET', '/files/report.pdf' ).match?.metadata.methodName ).toBe( 'named' );
        expect( instance.lookup( 'GET', '/files/a/b/c' ).match?.metadata.methodName ).toBe( 'wild' );
    });

    it( 'should keep params from the matched pattern', () =>
    {
        // Arrange
        const instance = router( endpoint( 'GET', '/users/:id/posts/:postId' ));

        // Act
        const hit = instance.lookup( 'GET', '/users/7/posts/9' );

        // Assert
        expect({ ...hit.match?.params }).toEqual({ id : '7', postId : '9' });
    });

    it( 'should fall back from HEAD to GET', () =>
    {
        // Arrange
        const instance = router( endpoint( 'GET', '/page' ));

        // Act / Assert
        expect( instance.lookup( 'HEAD', '/page' ).match?.metadata.httpMethod ).toBe( 'GET' );
    });

    it( 'should answer any verb from an ALL route', () =>
    {
        // Arrange
        const instance = router( endpoint( 'ALL', '/any/:id' ));

        // Act / Assert
        expect( instance.lookup( 'PATCH', '/any/1' ).match ).not.toBeNull();
        expect( instance.lookup( 'OPTIONS', '/any/1' ).match ).not.toBeNull();
        expect( instance.lookup( 'WS', '/any/1' ).match ).toBeNull();
    });

    it( 'should report the Allow list and a config fallback for a wrong-verb request', () =>
    {
        // Arrange
        const instance = router(
            endpoint( 'POST', '/orders', 'create' ),
            endpoint( 'PATCH', '/orders', 'update' )
        );

        // Act
        const miss = instance.lookup( 'GET', '/orders' );

        // Assert
        expect( miss.match ).toBeNull();
        expect( miss.allowed ).toEqual([ 'POST', 'PATCH', 'OPTIONS' ]);
        expect( miss.fallback?.metadata.methodName ).toBe( 'create' );
    });

    it( 'should report no Allow list for an unknown path', () =>
    {
        // Arrange
        const instance = router( endpoint( 'GET', '/known' ));

        // Act
        const miss = instance.lookup( 'GET', '/unknown' );

        // Assert
        expect( miss.allowed ).toEqual([]);
        expect( miss.fallback ).toBeNull();
    });

    it( 'should build the Allow list from parametric routes too', () =>
    {
        // Arrange
        const instance = router( endpoint( 'DELETE', '/items/:id' ));

        // Act / Assert
        expect( instance.allowedMethods( '/items/3' )).toEqual([ 'DELETE', 'OPTIONS' ]);
    });

    it( 'should never advertise WS or RPC in the Allow list', () =>
    {
        // Arrange
        const instance = router(
            endpoint( 'WS', '/socket' ),
            endpoint( 'RPC', '/socket' )
        );

        // Act / Assert
        expect( instance.allowedMethods( '/socket' )).toEqual([]);
        expect( instance.lookup( 'GET', '/socket' ).allowed ).toEqual([]);
    });

    it( 'should warn when a later pattern can never be reached', () =>
    {
        // Arrange / Act — identical shapes, only the param name differs
        const instance = router(
            endpoint( 'GET', '/u/:id', 'first' ),
            endpoint( 'GET', '/u/:key', 'second' )
        );

        // Assert
        expect( instance.warnings ).toHaveLength( 1 );
        expect( instance.warnings[0]).toContain( 'Ctrl.second' );
        expect( instance.warnings[0]).toContain( 'is unreachable' );
        expect( instance.lookup( 'GET', '/u/1' ).match?.metadata.methodName ).toBe( 'first' );
    });

    it( 'should warn when an ALL route shadows a later verb-specific route', () =>
    {
        // Arrange / Act
        const instance = router(
            endpoint( 'ALL', '/thing/:id', 'catchAll' ),
            endpoint( 'GET', '/thing/:id', 'get' )
        );

        // Assert
        expect( instance.warnings.some( w => w.includes( 'Ctrl.get' ))).toBe( true );
    });

    it( 'should not warn for distinct patterns that share a prefix', () =>
    {
        // Arrange / Act
        const instance = router(
            endpoint( 'GET', '/u/:id', 'byId' ),
            endpoint( 'GET', '/u/:id/posts', 'posts' ),
            endpoint( 'POST', '/u/:id', 'update' )
        );

        // Assert
        expect( instance.warnings ).toEqual([]);
    });

    it( 'should pick up routes added after the first lookup', () =>
    {
        // Arrange
        const instance = router( endpoint( 'GET', '/first' ));
        expect( instance.lookup( 'GET', '/second' ).match ).toBeNull();

        // Act
        instance.add( endpoint( 'GET', '/second' ));

        // Assert
        expect( instance.lookup( 'GET', '/second' ).match ).not.toBeNull();
    });
});

describe( 'toAllowList', () =>
{
    it( 'should expand ALL, imply HEAD from GET, and always include OPTIONS', () =>
    {
        // Act / Assert
        expect( toAllowList(['ALL'])).toEqual([ 'GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS' ]);
        expect( toAllowList(['GET'])).toEqual([ 'GET', 'HEAD', 'OPTIONS' ]);
        expect( toAllowList(['POST'])).toEqual([ 'POST', 'OPTIONS' ]);
        expect( toAllowList([ 'WS', 'RPC' ])).toEqual([]);
    });
});
