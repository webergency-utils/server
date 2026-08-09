import { describe, it, expect } from 'vitest';
import { ApplicationRegistry } from '../src/core/registry.js';
import { bootstrapRegistry } from '../src/core/bootstrap.js';
import
{
    getInjectableMeta,
    setControllerMeta,
    setModuleMeta
}
from '../src/core/symbols.js';

describe( 'bootstrapRegistry', () =>
{
    it( 'should fail fast when a controller host lacks AOT meta', () =>
    {
        // Arrange
        class BareCtrl {}
        const registry = new ApplicationRegistry();

        // Act / Assert
        expect( () => bootstrapRegistry( registry, { controllers : [BareCtrl] })).toThrow( /Missing AOT metadata/ );
    });

    it( 'should fail fast when a module class lacks AOT meta', () =>
    {
        // Arrange
        class BareMod {}
        const registry = new ApplicationRegistry();

        // Act / Assert
        expect( () => bootstrapRegistry( registry, { module : BareMod })).toThrow( /Missing AOT metadata for: BareMod/ );
        expect( registry.missingAotHosts ).toContain( 'BareMod' );
    });

    it( 'should ingest controller Symbol meta into the registry', () =>
    {
        // Arrange
        class HelloCtrl
        {
            hi(){ return 'hi' }
        }
        setControllerMeta( HelloCtrl, {
            endpoints : [{
                methodName   : 'hi',
                httpMethod   : 'GET',
                path         : '/hi',
                params       : [],
                guards       : [],
                interceptors : [],
                meta         : {}
            }]
        });
        const registry = new ApplicationRegistry();

        // Act
        bootstrapRegistry( registry, { controllers : [HelloCtrl] });

        // Assert
        expect( registry.getEndpoints()).toHaveLength( 1 );
        expect( registry.getEndpoints()[0].path ).toBe( '/hi' );
        expect( registry.controllerClasses.has( 'HelloCtrl' )).toBe( true );
    });

    it( 'should reject duplicate routes during registration', () =>
    {
        // Arrange
        const registry = new ApplicationRegistry();
        registry.registerEndpoint({
            controller   : 'A',
            methodName   : 'a',
            httpMethod   : 'GET',
            path         : '/dup',
            params       : [],
            guards       : [],
            interceptors : [],
            meta         : {}
        } as any );

        // Act / Assert
        expect( () => registry.registerEndpoint({
            controller   : 'B',
            methodName   : 'b',
            httpMethod   : 'GET',
            path         : '/dup',
            params       : [],
            guards       : [],
            interceptors : [],
            meta         : {}
        } as any )).toThrow( /Duplicate route/ );
    });

    it( 'should walk a module graph with providers and global flag', () =>
    {
        // Arrange
        class Svc {}
        class Ctrl
        {
            x(){ return 1 }
        }
        setControllerMeta( Ctrl, {
            endpoints : [{
                methodName   : 'x',
                httpMethod   : 'GET',
                path         : '/x',
                params       : [],
                guards       : [],
                interceptors : [],
                meta         : {}
            }]
        });
        class AppMod {}
        setModuleMeta( AppMod, {
            global      : true,
            controllers : [Ctrl],
            providers   : [Svc],
            exports     : [Svc]
        });
        const registry = new ApplicationRegistry();

        // Act
        bootstrapRegistry( registry, { module : AppMod });

        // Assert
        expect( registry.getGlobalModules().length ).toBe( 1 );
        expect( registry.getProvider( 'Svc' )).toBe( Svc );
        expect( registry.getEndpoints()[0].controller ).toBe( 'Ctrl' );
    });

    it( 'should register provider token objects with token / class', () =>
    {
        // Arrange
        class Impl {}
        class AppMod {}
        setModuleMeta( AppMod, {
            providers : [{ token : 'TOKEN', class : Impl }]
        });
        const registry = new ApplicationRegistry();

        // Act
        bootstrapRegistry( registry, { module : AppMod });

        // Assert
        expect( registry.getProvider( 'TOKEN' )).toEqual({ token : 'TOKEN', class : Impl });
    });

    it( 'should attach injectable meta for bare guard and interceptor under a module', () =>
    {
        // Arrange
        class BareGuard
        {
            use(){ return true }
        }
        class BareInterceptor
        {
            intercept( next: () => any ){ return next() }
        }
        class AppMod {}
        setModuleMeta( AppMod, {
            guards       : [BareGuard],
            interceptors : [BareInterceptor]
        });
        const registry = new ApplicationRegistry();

        // Act
        bootstrapRegistry( registry, { module : AppMod });

        // Assert
        expect( getInjectableMeta( BareGuard )).toEqual({ kind : 'guard', token : 'BareGuard' });
        expect( getInjectableMeta( BareInterceptor )).toEqual({ kind : 'interceptor', token : 'BareInterceptor' });
        expect( registry.guardClasses.has( 'BareGuard' )).toBe( true );
        expect( registry.interceptorClasses.has( 'BareInterceptor' )).toBe( true );
        expect( registry.getProvider( 'BareGuard' )).toBe( BareGuard );
        expect( registry.getProvider( 'BareInterceptor' )).toBe( BareInterceptor );
    });

    it( 'should skip plain object controller hosts', () =>
    {
        // Arrange
        const registry = new ApplicationRegistry();
        const plain = { hi(){ return 'hi' } };

        // Act
        bootstrapRegistry( registry, { controllers : [plain as any] });

        // Assert
        expect( registry.getEndpoints()).toHaveLength( 0 );
        expect( registry.missingAotHosts ).toHaveLength( 0 );
        expect( registry.controllerClasses.size ).toBe( 0 );
    });

    it( 'should ingest top-level guards and interceptors even when module is set', () =>
    {
        // Arrange
        class TopGuard { use(){ return true } }
        class TopInterceptor { intercept( next: () => any ){ return next() } }
        class AppMod {}
        setModuleMeta( AppMod, {});
        const registry = new ApplicationRegistry();

        // Act
        bootstrapRegistry( registry, {
            module       : AppMod,
            guards       : [TopGuard],
            interceptors : [TopInterceptor]
        });

        // Assert
        expect( registry.guardClasses.has( 'TopGuard' )).toBe( true );
        expect( registry.interceptorClasses.has( 'TopInterceptor' )).toBe( true );
    });
});
