import { describe, it, expect, vi } from 'vitest';
import { Server } from '../src/server.js';
import { ServerResponse } from '../src/core/types.js';
import { seedInstanceController, runWithRegistry, ApplicationRegistry } from './helpers/testing.js';
import { Router } from '../src/core/router.js';

function setupServer( setup: ( registry: ApplicationRegistry ) => void, options: Record<string, unknown> = {}): Server
{
    const server = new Server({ port : 0, ...options });
    runWithRegistry( server.registry, () => setup( server.registry ));

    return server;
}

function ep( methodName: string, httpMethod: string, path: string, extra: Record<string, any> = {}): any
{
    return {
        methodName,
        httpMethod,
        path,
        params       : [],
        guards       : [],
        interceptors : [],
        middlewares  : [],
        meta         : {},
        ...extra
    };
}

describe( 'SEO routes + internal forward', () =>
{
    it( 'matches SEO before a colliding public route', async () =>
    {
        const server = setupServer( registry =>
        {
            seedInstanceController( registry, 'SeoC', {
                resolve : () => ({ method : 'GET', path : '/posts/1' })
            }, [ ep( 'resolve', 'GET', '/blog/:slug', { seo : true }) ]);

            seedInstanceController( registry, 'PubC', {
                blog  : () => ({ from : 'public-blog' }),
                posts : () => ({ from : 'posts' })
            }, [
                ep( 'blog', 'GET', '/blog/:slug' ),
                ep( 'posts', 'GET', '/posts/:id' )
            ]);
        });

        const res = await server.fetch( new Request( 'http://localhost/blog/hello' ));
        expect( res.status ).toBe( 200 );
        expect( await res.json()).toEqual({ from : 'posts' });
        expect( res.headers.get( 'Location' )).toBeNull();
    });

    it( 'falls through void SEO to the public router', async () =>
    {
        const server = setupServer( registry =>
        {
            seedInstanceController( registry, 'SeoC', {
                resolve : () => undefined
            }, [ ep( 'resolve', 'GET', '/blog/:slug', { seo : true }) ]);

            seedInstanceController( registry, 'PubC', {
                blog : () => ({ from : 'public' })
            }, [ ep( 'blog', 'GET', '/blog/:slug' ) ]);
        });

        const res = await server.fetch( new Request( 'http://localhost/blog/x' ));
        expect( res.status ).toBe( 200 );
        expect( await res.json()).toEqual({ from : 'public' });
    });

    it( 'falls through void SEO to the next SEO match then public', async () =>
    {
        const server = setupServer( registry =>
        {
            seedInstanceController( registry, 'SeoC', {
                specific : () => undefined,
                catchAll : () => ({ method : 'GET', path : '/pages/home' })
            }, [
                ep( 'specific', 'GET', '/p/:slug', { seo : true }),
                ep( 'catchAll', 'GET', '/*path', { seo : true })
            ]);

            seedInstanceController( registry, 'PubC', {
                page : () => ({ page : 'home' })
            }, [ ep( 'page', 'GET', '/pages/:id' ) ]);
        });

        const res = await server.fetch( new Request( 'http://localhost/p/anything' ));
        expect( res.status ).toBe( 200 );
        expect( await res.json()).toEqual({ page : 'home' });
    });

    it( 'forwards to an @Internal endpoint; direct Internal URL is 404', async () =>
    {
        const server = setupServer( registry =>
        {
            seedInstanceController( registry, 'SeoC', {
                resolve : () => ({ method : 'GET', path : '/_internal/secret' })
            }, [ ep( 'resolve', 'GET', '/pretty', { seo : true }) ]);

            seedInstanceController( registry, 'InnerC', {
                secret : () => ({ ok : true })
            }, [ ep( 'secret', 'GET', '/_internal/secret', { internal : true }) ]);
        });

        const forwarded = await server.fetch( new Request( 'http://localhost/pretty' ));
        expect( forwarded.status ).toBe( 200 );
        expect( await forwarded.json()).toEqual({ ok : true });
        expect( forwarded.headers.get( 'Location' )).toBeNull();

        const direct = await server.fetch( new Request( 'http://localhost/_internal/secret' ));
        expect( direct.status ).toBe( 404 );
    });

    it( 'injects query and body on forward', async () =>
    {
        const server = setupServer( registry =>
        {
            seedInstanceController( registry, 'SeoC', {
                resolve : () => ({
                    method : 'POST',
                    path   : '/checkout',
                    query  : { src : 'seo' },
                    body   : { coupon : 'SAVE' }
                })
            }, [ ep( 'resolve', 'GET', '/buy', { seo : true }) ]);

            seedInstanceController( registry, 'ShopC', {
                checkout : ( _req: any, body: any, query: any ) => ({ body, query })
            }, [
                ep( 'checkout', 'POST', '/checkout', {
                    params : [
                        { source : 'Request' },
                        { source : 'Body' },
                        { source : 'Query' }
                    ]
                })
            ]);
        });

        const res = await server.fetch( new Request( 'http://localhost/buy' ));
        expect( res.status ).toBe( 200 );
        const json = await res.json();
        expect( json.query.src ).toBe( 'seo' );
        expect( json.body.coupon ).toBe( 'SAVE' );
    });

    it( 'supports ServerResponse.forward from a public handler', async () =>
    {
        const server = setupServer( registry =>
        {
            seedInstanceController( registry, 'LegacyC', {
                legacy : ( res: ServerResponse ) => res.forward({ method : 'GET', path : '/new' })
            }, [
                ep( 'legacy', 'GET', '/legacy', {
                    params : [{ source : 'Response' }]
                })
            ]);

            seedInstanceController( registry, 'NewC', {
                neu : () => ({ neu : true })
            }, [ ep( 'neu', 'GET', '/new' ) ]);
        });

        const res = await server.fetch( new Request( 'http://localhost/legacy' ));
        expect( res.status ).toBe( 200 );
        expect( await res.json()).toEqual({ neu : true });
        expect( res.headers.get( 'Location' )).toBeNull();
    });

    it( 'allows nested forwards through a chain', async () =>
    {
        const server = setupServer( registry =>
        {
            seedInstanceController( registry, 'A', {
                a : () => ({ method : 'GET', path : '/b' })
            }, [ ep( 'a', 'GET', '/a', { seo : true }) ]);

            seedInstanceController( registry, 'B', {
                b : ( res: ServerResponse ) => res.forward({ method : 'GET', path : '/c' })
            }, [
                ep( 'b', 'GET', '/b', {
                    params : [{ source : 'Response' }]
                })
            ]);

            seedInstanceController( registry, 'C', {
                c : () => ({ c : true })
            }, [ ep( 'c', 'GET', '/c' ) ]);
        });

        const res = await server.fetch( new Request( 'http://localhost/a' ));
        expect( res.status ).toBe( 200 );
        expect( await res.json()).toEqual({ c : true });
        expect( res.headers.get( 'Location' )).toBeNull();
    });

    it( 'rejects forward cycles', async () =>
    {
        const server = setupServer( registry =>
        {
            seedInstanceController( registry, 'A', {
                a : () => ({ method : 'GET', path : '/b' })
            }, [ ep( 'a', 'GET', '/a', { seo : true }) ]);

            seedInstanceController( registry, 'B', {
                b : ( res: ServerResponse ) => res.forward({ method : 'GET', path : '/a-public' })
            }, [
                ep( 'b', 'GET', '/b', {
                    params : [{ source : 'Response' }]
                })
            ]);

            seedInstanceController( registry, 'Loop', {
                loop : ( res: ServerResponse ) => res.forward({ method : 'GET', path : '/b' })
            }, [
                ep( 'loop', 'GET', '/a-public', {
                    params : [{ source : 'Response' }]
                })
            ]);
        });

        const res = await server.fetch( new Request( 'http://localhost/a' ));
        expect( res.status ).toBe( 500 );
        const body = await res.json();
        expect( body.error ).toContain( 'Forward cycle' );
    });

    it( 'rejects missing forward target with 500', async () =>
    {
        const server = setupServer( registry =>
        {
            seedInstanceController( registry, 'SeoC', {
                resolve : () => ({ method : 'GET', path : '/missing' })
            }, [ ep( 'resolve', 'GET', '/go', { seo : true }) ]);
        });

        const res = await server.fetch( new Request( 'http://localhost/go' ));
        expect( res.status ).toBe( 500 );
        const body = await res.json();
        expect( body.error ).toContain( 'Forward target not found' );
    });

    it( 'rejects invalid SEO return with 500', async () =>
    {
        const server = setupServer( registry =>
        {
            seedInstanceController( registry, 'SeoC', {
                resolve : () => ({ not : 'a forward' })
            }, [ ep( 'resolve', 'GET', '/bad', { seo : true }) ]);
        });

        const res = await server.fetch( new Request( 'http://localhost/bad' ));
        expect( res.status ).toBe( 500 );
        const body = await res.json();
        expect( body.error ).toContain( 'SeoForward' );
    });

    it( 'logs 404 after SEO fallthrough with no public match', async () =>
    {
        // Arrange
        const logger =
        {
            info  : vi.fn(),
            warn  : vi.fn(),
            error : vi.fn(),
            debug : vi.fn()
        };
        const server = setupServer( registry =>
        {
            seedInstanceController( registry, 'SeoC', {
                resolve : () => undefined
            }, [ ep( 'resolve', 'GET', '/seo-only', { seo : true }) ]);
        }, { logs : true, logger });

        // Act
        const res = await server.fetch( new Request( 'http://localhost/seo-only' ));

        // Assert
        expect( res.status ).toBe( 404 );
        expect( logger.info ).toHaveBeenCalledWith(
            expect.stringContaining( '404 Not Found' ),
            expect.objectContaining({ type : 'request_end', status : 404 })
        );
    });

    it( 'rejects @Seo + @Internal at boot', async () =>
    {
        await expect(
            setupServer( registry =>
            {
                seedInstanceController( registry, 'Bad', {
                    x : () => undefined
                }, [ ep( 'x', 'GET', '/x', { seo : true, internal : true }) ]);
            }).ensureReady()
        ).rejects.toThrow( /both @Seo and @Internal/ );
    });

    it( 'rejects public/internal path conflict at boot', async () =>
    {
        await expect(
            setupServer( registry =>
            {
                seedInstanceController( registry, 'Pub', {
                    a : () => 1
                }, [ ep( 'a', 'GET', '/same' ) ]);
                seedInstanceController( registry, 'Inn', {
                    b : () => 2
                }, [ ep( 'b', 'GET', '/same', { internal : true }) ]);
            }).ensureReady()
        ).rejects.toThrow( /conflicts/ );
    });
});

describe( 'Router.matchAll', () =>
{
    it( 'returns every dynamic match in specificity order', () =>
    {
        const router = new Router();
        router.add({
            controller   : 'C',
            methodName   : 'specific',
            httpMethod   : 'GET',
            path         : '/u/:id',
            params       : [],
            guards       : [],
            interceptors : [],
            middlewares  : [],
            meta         : {}
        });
        router.add({
            controller   : 'C',
            methodName   : 'catchAll',
            httpMethod   : 'GET',
            path         : '/*rest',
            params       : [],
            guards       : [],
            interceptors : [],
            middlewares  : [],
            meta         : {}
        });
        router.compile();

        const matches = router.matchAll( 'GET', '/u/1' );
        expect( matches.map( m => m.metadata.methodName )).toEqual([ 'specific', 'catchAll' ]);
    });
});
