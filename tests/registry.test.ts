import { describe, it, expect } from 'vitest';
import {
    ApplicationRegistry,
    runWithRegistry,
    tryGetRegistry,
    getRegistry
} from '../src/core/registry.js';
import { Scope } from '../src/decorators.js';

describe( 'ApplicationRegistry', () =>
{
    it( 'should manage modules, class maps, and clear state', () =>
    {
        // Arrange
        class Mod {}
        class Svc {}
        const registry = new ApplicationRegistry();

        // Act
        registry.registerModule( 'Mod', Mod );
        const inst = registry.createModuleInstance( 'Mod', Mod );
        registry.mapClassToModule( Svc, inst );
        registry.mapTokenToModule( 'Svc', inst );
        registry.registerGlobalModule( inst );
        registry.registerProvider( 'Svc', Svc );
        registry.setDefaultResponseMode( 'strict' );
        registry.missingAotHosts.push( 'X' );

        // Assert
        expect( registry.getModule( 'Mod' )).toBe( Mod );
        expect( registry.getModuleInstances()).toEqual([ inst ]);
        expect( registry.getClassModule( Svc )).toBe( inst );
        expect( registry.getTokenModule( 'Svc' )).toBe( inst );
        expect( registry.getGlobalModules()).toEqual([ inst ]);
        expect( registry.getDefaultResponseMode()).toBe( 'strict' );

        runWithRegistry( registry, () =>
        {
            expect( registry.getResolvedScope( 'Svc' )).toBe( Scope.SINGLETON );
        });

        registry.clear();
        expect( registry.getModule( 'Mod' )).toBeUndefined();
        expect( registry.getModuleInstances()).toEqual([]);
        expect( registry.providers.size ).toBe( 0 );
        expect( registry.missingAotHosts ).toEqual([]);
        expect( registry.getDefaultResponseMode()).toBe( 'strip' );
    });

    it( 'should resolve guards and interceptors from providers when not cached', async () =>
    {
        // Arrange
        class Guard { canActivate(){ return true } }
        class Interceptor { intercept( n: any ){ return n.handle() } }
        const registry = new ApplicationRegistry();
        registry.registerGuard( 'Guard', Guard );
        registry.registerInterceptor( 'Interceptor', Interceptor );

        // Act / Assert
        await runWithRegistry( registry, async () =>
        {
            expect( await registry.getGuard( 'Guard' )).toBeInstanceOf( Guard );
            expect( await registry.getInterceptor( 'Interceptor' )).toBeInstanceOf( Interceptor );
        });
    });

    it( 'should expose tryGetRegistry only inside ALS context', () =>
    {
        // Arrange
        const registry = new ApplicationRegistry();

        // Act / Assert
        expect( tryGetRegistry()).toBeUndefined();
        runWithRegistry( registry, () =>
        {
            expect( tryGetRegistry()).toBe( registry );
        });
        expect( tryGetRegistry()).toBeUndefined();
        expect( () => getRegistry()).toThrow( /No ApplicationRegistry in context/ );
    });
});
