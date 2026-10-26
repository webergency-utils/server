import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockListen = vi.fn( async () => {});
const mockUpgrade = vi.fn(() => new Response( 'upgraded' ));
const mockClose = vi.fn( async () => {});
const mockCloseAllConnections = vi.fn();

vi.mock( '../src/adapters/node-adapter.js', () =>
    ({
        NodeAdapter : class
        {
            nodeServer = { tag : 'mock-https' };
            listen = mockListen;
            upgrade = mockUpgrade;
            close = mockClose;
            closeAllConnections = mockCloseAllConnections;
        }
    }));

import { NodeTlsCompat } from '../src/adapters/node-tls-compat.js';
import { BunAdapter } from '../src/adapters/bun-adapter.js';
import { DenoAdapter } from '../src/adapters/deno-adapter.js';
import { ApplicationRegistry, runWithRegistry } from '../src/core/registry.js';

describe( 'NodeTlsCompat', () =>
{
    beforeEach(() =>
    {
        mockListen.mockClear();
        mockUpgrade.mockClear();
        mockClose.mockClear();
        mockCloseAllConnections.mockClear();
    });

    it( 'should stay inactive until listen, then delegate upgrade/close/closeAllConnections', async () =>
    {
        // Arrange
        const compat = new NodeTlsCompat();
        const handler = async () => new Response( 'ok' );
        const tls = { key : 'k', cert : 'c', requestCert : true };
        const http = { keepAliveTimeout : 1 };

        // Assert — close / closeAll before listen are no-ops
        expect( compat.active ).toBe( false );
        expect( compat.server ).toBeUndefined();
        await compat.close();
        compat.closeAllConnections();
        expect( mockClose ).not.toHaveBeenCalled();
        expect( mockCloseAllConnections ).not.toHaveBeenCalled();

        // Act
        await compat.listen( 8443, handler, tls, http );

        // Assert
        expect( compat.active ).toBe( true );
        expect( compat.server ).toEqual({ tag : 'mock-https' });
        expect( mockListen ).toHaveBeenCalledWith( 8443, handler, tls, http );

        const req = new Request( 'https://localhost/' );
        const meta = { path : '/' };
        const params = { id : '1' };
        const upgraded = compat.upgrade( req, meta, params );

        expect( mockUpgrade ).toHaveBeenCalledWith( req, meta, params );
        expect( upgraded ).toBeInstanceOf( Response );

        compat.closeAllConnections();
        expect( mockCloseAllConnections ).toHaveBeenCalledTimes( 1 );

        await compat.close();
        expect( mockClose ).toHaveBeenCalledTimes( 1 );
        expect( compat.active ).toBe( false );
        expect( compat.server ).toBeUndefined();
    });

    it( 'should forward host argument to NodeAdapter.listen when provided', async () =>
    {
        // Arrange
        const compat = new NodeTlsCompat();
        const handler = async () => new Response( 'ok' );
        const tls = { key : 'k', cert : 'c', requestCert : true };
        const http = { keepAliveTimeout : 1 };

        // Act
        await compat.listen( 8443, handler, tls, http, [ '127.0.0.1', '::1' ]);

        // Assert
        expect( mockListen ).toHaveBeenCalledWith( 8443, handler, tls, http, [ '127.0.0.1', '::1' ]);
        await compat.close();
    });

    it( 'should forward hostname per host in BunAdapter and rollback on partial failure', async () =>
    {
        // Arrange
        const serveCalls: any[] = [];
        const stopSpies: any[] = [];
        ( globalThis as any ).Bun = {
            serve : vi.fn(( opts: any ) =>
            {
                serveCalls.push( opts );

                if( opts.hostname === '192.0.2.99' )
                {
                    throw new Error( 'EADDRNOTAVAIL' );
                }

                const stop = vi.fn();
                stopSpies.push( stop );

                return { stop };
            })
        };

        try
        {
            const adapter = new BunAdapter();
            const handler = async () => new Response( 'ok' );
            const registry = new ApplicationRegistry();

            await runWithRegistry( registry, async () =>
            {
                // Act — multi-host success
                await adapter.listen( 3000, handler, undefined, undefined, [ '127.0.0.1', '::1', '127.0.0.1' ]);

                // Assert
                expect( serveCalls.map(( c ) => c.hostname )).toEqual([ '127.0.0.1', '::1' ]);
                adapter.closeAllConnections();
                expect( stopSpies[0] ).toHaveBeenCalledWith( true );
                expect( stopSpies[1] ).toHaveBeenCalledWith( true );
                await adapter.close();
                expect( stopSpies[0] ).toHaveBeenCalledWith();
                expect( stopSpies[1] ).toHaveBeenCalledWith();

                // Act — rollback on second host failure
                serveCalls.length = 0;
                stopSpies.length = 0;
                await expect(
                    adapter.listen( 3000, handler, undefined, undefined, [ '127.0.0.1', '192.0.2.99' ])
                ).rejects.toThrow( 'EADDRNOTAVAIL' );
                expect( stopSpies[0] ).toHaveBeenCalledWith( true );
            });
        }
        finally
        {
            delete ( globalThis as any ).Bun;
        }
    });

    it( 'should forward hostname per host in DenoAdapter and rollback on partial failure', async () =>
    {
        // Arrange
        const serveCalls: any[] = [];
        const shutdownSpies: any[] = [];
        ( globalThis as any ).Deno = {
            serve : vi.fn(( opts: any ) =>
            {
                serveCalls.push( opts );

                if( opts.hostname === '192.0.2.99' )
                {
                    throw new Error( 'EADDRNOTAVAIL' );
                }

                const shutdown = vi.fn( async () => {});
                shutdownSpies.push( shutdown );
                opts.onListen?.();

                return { shutdown };
            })
        };

        try
        {
            const adapter = new DenoAdapter();
            const handler = async () => new Response( 'ok' );

            // Act — multi-host success
            await adapter.listen( 3000, handler, undefined, undefined, [ '127.0.0.1', '::1', '127.0.0.1' ]);

            // Assert
            expect( serveCalls.map(( c ) => c.hostname )).toEqual([ '127.0.0.1', '::1' ]);
            await adapter.close();
            expect( shutdownSpies[0] ).toHaveBeenCalledTimes( 1 );
            expect( shutdownSpies[1] ).toHaveBeenCalledTimes( 1 );

            // Act — rollback on second host failure
            serveCalls.length = 0;
            shutdownSpies.length = 0;
            await expect(
                adapter.listen( 3000, handler, undefined, undefined, [ '127.0.0.1', '192.0.2.99' ])
            ).rejects.toThrow( 'EADDRNOTAVAIL' );
            expect( shutdownSpies[0] ).toHaveBeenCalledTimes( 1 );
        }
        finally
        {
            delete ( globalThis as any ).Deno;
        }
    });
});
