import { describe, it, expect, vi } from 'vitest';
import { invokeGuards } from '../core/guard-runner.js';
import { ApplicationRegistry, runWithRegistry } from '../core/registry.js';
import type { AugmentedRequest, EndpointMetadata, ResponseBag } from '../core/types.js';

function createRequest(): AugmentedRequest
{
    const headerMap = new Map<string, string>([[ 'x-token', 'abc' ]]);

    return {
        headers : {
            get     : ( name: string ) => headerMap.get( name.toLowerCase()) ?? null,
            entries : () => headerMap.entries()
        },
        params : { id : '7' },
        query  : { q : 'hi' },
        url    : 'http://localhost/guarded/7?q=hi',
        meta   : {}
    } as unknown as AugmentedRequest;
}

function createEndpoint( guards: any[]): EndpointMetadata
{
    return {
        controller   : 'Ctrl',
        methodName   : 'handle',
        httpMethod   : 'GET',
        path         : '/guarded/:id',
        params       : [],
        guards,
        interceptors : [],
        middlewares  : [],
        meta         : {}
    } as EndpointMetadata;
}

function createResponseBag(): ResponseBag
{
    return {
        headers : new Map<string, string>(),
        cookies : [],
        status  : undefined
    } as unknown as ResponseBag;
}

describe( 'invokeGuards', () =>
{
    it( 'should resolve every allowed param source and consume resolvers for the rest', async () =>
    {
        // Arrange
        const registry = new ApplicationRegistry();
        const seen: unknown[] = [];
        const response = createResponseBag();
        registry.registerGuard( 'G', { use : ( ...args: unknown[]) => { seen.push( ...args ) }});
        const metadata = createEndpoint([{
            type      : 'class',
            name      : 'G',
            resolvers : [ 'admin', 42 ],
            params    : [
                { source : 'Request' },
                { source : 'Param', name : 'id' },
                { source : 'Query', name : 'q' },
                { source : 'Header', name : 'x-token' },
                { source : 'Response' },
                { source : 'WebSocket' },
                { source : 'Unknown' as any },
                { source : 'AlsoUnknown' as any }
            ],
            isAsync : false
        }]);
        const req = createRequest();

        // Act
        await runWithRegistry( registry, () => invokeGuards( metadata, req, {
            ctx              : { success : true, errors : [], mode : 'strict' },
            controller       : {},
            controllerModule : undefined,
            response
        }));

        // Assert
        const { ServerRequest } = await import( '../core/server-request.js' );
        expect( seen[0]).toBeInstanceOf( ServerRequest );
        expect(( seen[0] as InstanceType<typeof ServerRequest> ).url ).toBe( req.url );
        expect( seen[1]).toBe( '7' );
        expect( seen[2]).toBe( 'hi' );
        expect( seen[3]).toBe( 'abc' );
        expect( seen[4]).toBe( response );
        expect( seen[5]).toBeNull();
        expect( seen[6]).toBe( 'admin' );
        expect( seen[7]).toBe( 42 );
    });

    it( 'should pass the static resolvers when a guard declares no params', async () =>
    {
        // Arrange
        const registry = new ApplicationRegistry();
        const use = vi.fn();
        registry.registerGuard( 'G', { use });
        const metadata = createEndpoint([{
            type      : 'class',
            name      : 'G',
            resolvers : [ 'admin' ],
            params    : [],
            isAsync   : false
        }]);

        // Act
        await runWithRegistry( registry, () => invokeGuards( metadata, createRequest(), {
            ctx              : { success : true, errors : [], mode : 'strict' },
            controller       : {},
            controllerModule : undefined
        }));

        // Assert
        expect( use ).toHaveBeenCalledWith( 'admin' );
    });

    it( 'should call a method guard on the controller instance', async () =>
    {
        // Arrange
        const registry = new ApplicationRegistry();
        const controller = { check : vi.fn() };
        const metadata = createEndpoint([{
            type      : 'method',
            name      : 'check',
            resolvers : [],
            params    : [{ source : 'Request' }],
            isAsync   : false
        }]);
        const req = createRequest();

        // Act
        await runWithRegistry( registry, () => invokeGuards( metadata, req, {
            ctx              : { success : true, errors : [], mode : 'strict' },
            controller,
            controllerModule : undefined
        }));

        // Assert
        expect( controller.check ).toHaveBeenCalledOnce();
        expect( controller.check.mock.calls[0][0]).toBeInstanceOf(
            ( await import( '../core/server-request.js' )).ServerRequest
        );
        expect( controller.check.mock.calls[0][0].url ).toBe( req.url );
    });

    it( 'should run beforeEach ahead of every guard and abort on throw', async () =>
    {
        // Arrange
        const registry = new ApplicationRegistry();
        const second = vi.fn();
        registry.registerGuard( 'First', { use : () => {} });
        registry.registerGuard( 'Second', { use : second });
        const metadata = createEndpoint([
            { type : 'class', name : 'First', resolvers : [], params : [], isAsync : false },
            { type : 'class', name : 'Second', resolvers : [], params : [], isAsync : false }
        ]);
        let calls = 0;
        const beforeEach = () =>
        {
            if( ++calls === 2 ) { throw new Error( 'aborted' ) }
        };

        // Act / Assert
        await expect( runWithRegistry( registry, () => invokeGuards( metadata, createRequest(), {
            ctx              : { success : true, errors : [], mode : 'strict' },
            controller       : {},
            controllerModule : undefined,
            beforeEach
        }))).rejects.toThrow( 'aborted' );
        expect( calls ).toBe( 2 );
        expect( second ).not.toHaveBeenCalled();
    });

    it( 'should not touch the registry when there are no guards', async () =>
    {
        // Arrange
        const registry = new ApplicationRegistry();
        const getGuard = vi.spyOn( registry, 'getGuard' );

        // Act
        await runWithRegistry( registry, () => invokeGuards( createEndpoint([]), createRequest(), {
            ctx              : { success : true, errors : [], mode : 'strict' },
            controller       : {},
            controllerModule : undefined
        }));

        // Assert
        expect( getGuard ).not.toHaveBeenCalled();
    });
});
