import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockListen = vi.fn( async () => {} );
const mockUpgrade = vi.fn(() => new Response( 'upgraded' ));
const mockClose = vi.fn( async () => {} );
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
});
