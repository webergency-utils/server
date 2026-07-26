import { describe, it, expect } from 'vitest';
import { ApplicationRegistry, runWithRegistry } from '../core/registry.js';
import { DIContainer } from '../core/container.js';
import { Scope } from '../decorators.js';
import { Context } from '../core/context.js';

describe( 'DIContainer', () =>
{
    it( 'should resolve circular constructor deps via a lazy proxy', () =>
    {
        // Arrange
        class A
        {
            static __injections__ = { constructorDeps : [ 'B' ], propertyDeps : {} };
            b: any;
            constructor( b: any ){ this.b = b }
            name(){ return 'A' }
        }
        class B
        {
            static __injections__ = { constructorDeps : [ 'A' ], propertyDeps : {} };
            a: any;
            constructor( a: any ){ this.a = a }
            name(){ return 'B' }
        }

        const registry = new ApplicationRegistry();
        registry.registerProvider( 'A', A );
        registry.registerProvider( 'B', B );

        // Act / Assert — proxy traps re-enter resolve and need ALS context
        runWithRegistry( registry, () =>
        {
            const a = DIContainer.resolve( 'A' );

            expect( a.name()).toBe( 'A' );
            expect( a.b.name()).toBe( 'B' );
            expect( a.b.a.name()).toBe( 'A' );
        });
    });

    it( 'should honor TRANSIENT scope and property injection', () =>
    {
        // Arrange
        class Dep
        {
            static __scope__ = Scope.DEFAULT;
            id = Math.random();
        }
        class Host
        {
            static __scope__ = Scope.TRANSIENT;
            static __injections__ = {
                constructorDeps : [],
                propertyDeps    : { dep : 'Dep' }
            };
            dep!: Dep;
        }

        const registry = new ApplicationRegistry();
        registry.registerProvider( 'Dep', Dep );
        registry.registerProvider( 'Host', Host );

        // Act
        const [h1, h2] = runWithRegistry( registry, () => [
            DIContainer.resolve( 'Host' ),
            DIContainer.resolve( 'Host' )
        ]);

        // Assert
        expect( h1 ).not.toBe( h2 );
        expect( h1.dep ).toBeInstanceOf( Dep );
        expect( h1.dep ).toBe( h2.dep );
    });

    it( 'should report resolved scopes and throw for missing providers', () =>
    {
        // Arrange
        class Svc
        {
            static __scope__ = Scope.REQUEST;
        }
        const registry = new ApplicationRegistry();
        registry.registerProvider( 'Svc', Svc );

        // Act / Assert
        runWithRegistry( registry, () =>
        {
            expect( DIContainer.getResolvedScope( 'Svc' )).toBe( Scope.REQUEST );
            expect( () => DIContainer.resolve( 'Missing' )).toThrow( /No provider registered/ );
        });
    });

    it( 'should invoke lifecycle hooks on registered instances', async () =>
    {
        // Arrange
        const calls: string[] = [];
        const registry = new ApplicationRegistry();
        registry.registerController( 'C', {
            onModuleInit : () => { calls.push( 'init' ) }
        });

        // Act
        await registry.invokeHook( 'onModuleInit' );

        // Assert
        expect( calls ).toEqual([ 'init' ]);
        expect( registry.getAllInstances().length ).toBe( 1 );
    });

    it( 'should resolve useValue, useClass, and useFactory providers', () =>
    {
        // Arrange
        class Dep { value = 1 }
        class Host
        {
            static __injections__ = {
                constructorDeps : [ 'Dep', 'any' ],
                propertyDeps    : { extra : 'Dep' }
            };
            dep: Dep;
            unused: any;
            extra!: Dep;
            constructor( dep: Dep, unused: any )
            {
                this.dep = dep;
                this.unused = unused;
            }
        }

        const registry = new ApplicationRegistry();
        registry.registerProvider( 'Dep', Dep );
        registry.registerProvider( 'Const', { useValue : 42 });
        registry.registerProvider( 'Host', { useClass : Host, scope : Scope.DEFAULT });
        registry.registerProvider( 'Made', {
            useFactory : ( d: Dep ) => ({ n : d.value + 1 }),
            inject     : [ 'Dep' ],
            scope      : Scope.TRANSIENT
        });

        // Act / Assert
        runWithRegistry( registry, () =>
        {
            expect( DIContainer.resolve( 'Const' )).toBe( 42 );
            const host = DIContainer.resolve( 'Host' );
            expect( host.dep ).toBeInstanceOf( Dep );
            expect( host.unused ).toBeUndefined();
            expect( host.extra ).toBe( host.dep );
            expect( DIContainer.resolve( 'Made' )).toEqual({ n : 2 });
            expect( DIContainer.getResolvedScope( 'Host' )).toBe( Scope.DEFAULT );
            expect( DIContainer.getResolvedScope( 'Made' )).toBe( Scope.TRANSIENT );
        });
    });

    it( 'should allow writes through a circular proxy', () =>
    {
        // Arrange — DEFAULT caches so proxy set lands on the same instance
        class A
        {
            static __injections__ = { constructorDeps : [ 'B' ], propertyDeps : {} };
            b: any;
            tag = 'a';
            constructor( b: any ){ this.b = b }
        }
        class B
        {
            static __injections__ = { constructorDeps : [ 'A' ], propertyDeps : {} };
            a: any;
            constructor( a: any ){ this.a = a }
            name(){ return 'B' }
        }

        const registry = new ApplicationRegistry();
        registry.registerProvider( 'A', A );
        registry.registerProvider( 'B', B );

        // Act / Assert — Proxy set must land on the real cached instance
        runWithRegistry( registry, () =>
        {
            const a = DIContainer.resolve( 'A' );
            a.b.a.tag = 'mutated';
            expect( a.tag ).toBe( 'mutated' );
            expect( a.b.name()).toBe( 'B' );
        });
    });

    it( 'should resolve REQUEST-scoped circular deps via lazy proxy', () =>
    {
        // Arrange
        class A
        {
            static __scope__ = Scope.REQUEST;
            static __injections__ = { constructorDeps : [ 'B' ], propertyDeps : {} };
            b: any;
            tag = 'a';
            constructor( b: any ){ this.b = b }
            name(){ return 'A' }
        }
        class B
        {
            static __scope__ = Scope.REQUEST;
            static __injections__ = { constructorDeps : [ 'A' ], propertyDeps : {} };
            a: any;
            constructor( a: any ){ this.a = a }
            name(){ return 'B' }
        }

        const registry = new ApplicationRegistry();
        registry.registerProvider( 'A', A );
        registry.registerProvider( 'B', B );

        // Act / Assert
        runWithRegistry( registry, () =>
        {
            Context.run(
                { request : {} as any, metadata : {} as any, requestInstances : new Map() },
                () =>
                {
                    const a = DIContainer.resolve( 'A' );

                    expect( a.name()).toBe( 'A' );
                    expect( a.b.name()).toBe( 'B' );
                    expect( a.b.a.name()).toBe( 'A' );
                    a.b.a.tag = 'mutated';
                    expect( a.tag ).toBe( 'mutated' );
                    expect( DIContainer.resolve( 'A' )).toBe( a );
                }
            );
        });
    });

    it( 'should return bare object providers and inherit useClass scope', () =>
    {
        // Arrange
        class Scoped
        {
            static __scope__ = Scope.REQUEST;
        }
        const registry = new ApplicationRegistry();
        registry.registerProvider( 'Bare', { already : true });
        registry.registerProvider( 'Scoped', { useClass : Scoped });
        registry.registerProvider( 'Primitive', 7 );

        // Act / Assert
        runWithRegistry( registry, () =>
        {
            expect( DIContainer.resolve( 'Bare' )).toEqual({ already : true });
            expect( DIContainer.getResolvedScope( 'Scoped' )).toBe( Scope.REQUEST );
            expect( DIContainer.resolve( 'Primitive' )).toBe( 7 );
        });
    });

    it( 'should throw when REQUEST/TRANSIENT providers are missing', () =>
    {
        // Arrange
        class Req
        {
            static __scope__ = Scope.REQUEST;
            static __injections__ = { constructorDeps : [ 'MissingReq' ], propertyDeps : {} };
            constructor( public m: any ){}
        }
        class TransientHost
        {
            static __scope__ = Scope.TRANSIENT;
            static __injections__ = { constructorDeps : [ 'MissingTx' ], propertyDeps : {} };
            constructor( public m: any ){}
        }
        const registry = new ApplicationRegistry();
        registry.registerProvider( 'Req', Req );
        registry.registerProvider( 'Tx', TransientHost );

        // Act / Assert
        runWithRegistry( registry, () =>
        {
            expect( () => Context.run(
                { request : {} as any, metadata : {} as any, requestInstances : new Map() },
                () => DIContainer.resolve( 'Req' )
            )).toThrow( /No provider registered/ );

            expect( () => DIContainer.resolve( 'Tx' )).toThrow( /No provider registered/ );
        });
    });

    it( 'should resolve TRANSIENT circular deps via lazy proxy', () =>
    {
        // Arrange
        class A
        {
            static __scope__ = Scope.TRANSIENT;
            static __injections__ = { constructorDeps : [ 'B' ], propertyDeps : {} };
            b: any;
            tag = 'a';
            constructor( b: any ){ this.b = b }
            name(){ return 'A' }
        }
        class B
        {
            static __scope__ = Scope.TRANSIENT;
            static __injections__ = { constructorDeps : [ 'A' ], propertyDeps : {} };
            a: any;
            constructor( a: any ){ this.a = a }
            name(){ return 'B' }
        }

        const registry = new ApplicationRegistry();
        registry.registerProvider( 'A', A );
        registry.registerProvider( 'B', B );

        // Act / Assert
        runWithRegistry( registry, () =>
        {
            const a = DIContainer.resolve( 'A' );

            expect( a.name()).toBe( 'A' );
            expect( a.b.name()).toBe( 'B' );
            expect( a.b.a.name()).toBe( 'A' );
            expect( () => { a.b.a.tag = 'x' }).not.toThrow();
            expect( DIContainer.resolve( 'A' )).not.toBe( a );
        });
    });
});
