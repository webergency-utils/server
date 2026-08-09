import { describe, it, expect } from 'vitest';
import { ApplicationRegistry, runWithRegistry } from '../src/core/registry.js';
import { DIContainer } from '../src/core/container.js';
import { Scope } from '../src/decorators.js';
import { Context } from '../src/core/context.js';

describe( 'DIContainer', () =>
{
    it( 'should resolve circular constructor deps via a lazy proxy', async () =>
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
        await runWithRegistry( registry, async () =>
        {
            const a = await DIContainer.resolve( 'A' );

            expect( a.name()).toBe( 'A' );
            expect( a.b.name()).toBe( 'B' );
            expect( a.b.a.name()).toBe( 'A' );
        });
    });

    it( 'should honor TRANSIENT scope and property injection', async () =>
    {
        // Arrange
        class Dep
        {
            static __scope__ = Scope.SINGLETON;
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
        const [ h1, h2 ] = await runWithRegistry( registry, async () =>
        {
            const a = await DIContainer.resolve( 'Host' );
            const b = await DIContainer.resolve( 'Host' );

            return [ a, b ];
        });

        // Assert
        expect( h1 ).not.toBe( h2 );
        expect( h1.dep ).toBeInstanceOf( Dep );
        expect( h1.dep ).toBe( h2.dep );
    });

    it( 'should report resolved scopes and throw for missing providers', async () =>
    {
        // Arrange
        class Svc
        {
            static __scope__ = Scope.REQUEST;
        }
        const registry = new ApplicationRegistry();
        registry.registerProvider( 'Svc', Svc );

        // Act / Assert
        await runWithRegistry( registry, async () =>
        {
            expect( DIContainer.getResolvedScope( 'Svc' )).toBe( Scope.REQUEST );
            await expect( DIContainer.resolve( 'Missing' )).rejects.toThrow( /No provider registered/ );
        });
    });

    it( 'should invoke onInit during resolve for constructed providers', async () =>
    {
        // Arrange
        const calls: string[] = [];
        class C
        {
            onInit(){ calls.push( 'init' ) }
        }
        const registry = new ApplicationRegistry();
        registry.registerController( 'C', C );

        // Act — onInit runs during resolve
        await runWithRegistry( registry, () => DIContainer.resolve( 'C' ));

        // Assert
        expect( calls ).toEqual([ 'init' ]);
        expect( registry.getAllInstances().length ).toBe( 1 );
    });

    it( 'should resolve value, class, and factory providers', async () =>
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
        registry.registerProvider( 'Const', { value : 42 });
        registry.registerProvider( 'Host', { class : Host, scope : Scope.SINGLETON });
        registry.registerProvider( 'Made', {
            factory : ( d: Dep ) => ({ n : d.value + 1 }),
            inject  : [ 'Dep' ],
            scope   : Scope.TRANSIENT
        });

        // Act / Assert
        await runWithRegistry( registry, async () =>
        {
            expect( await DIContainer.resolve( 'Const' )).toBe( 42 );
            const host = await DIContainer.resolve( 'Host' );
            expect( host.dep ).toBeInstanceOf( Dep );
            expect( host.unused ).toBeUndefined();
            expect( host.extra ).toBe( host.dep );
            expect( await DIContainer.resolve( 'Made' )).toEqual({ n : 2 });
            expect( DIContainer.getResolvedScope( 'Host' )).toBe( Scope.SINGLETON );
            expect( DIContainer.getResolvedScope( 'Made' )).toBe( Scope.TRANSIENT );
        });
    });

    it( 'should allow writes through a circular proxy', async () =>
    {
        // Arrange — SINGLETON caches so proxy set lands on the same instance
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
        await runWithRegistry( registry, async () =>
        {
            const a = await DIContainer.resolve( 'A' );
            a.b.a.tag = 'mutated';
            expect( a.tag ).toBe( 'mutated' );
            expect( a.b.name()).toBe( 'B' );
        });
    });

    it( 'should resolve REQUEST-scoped circular deps via lazy proxy', async () =>
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
        await runWithRegistry( registry, async () =>
        {
            await Context.run(
                { request : {} as any, metadata : {} as any, requestInstances : new Map() },
                async () =>
                {
                    const a = await DIContainer.resolve( 'A' );

                    expect( a.name()).toBe( 'A' );
                    expect( a.b.name()).toBe( 'B' );
                    expect( a.b.a.name()).toBe( 'A' );
                    a.b.a.tag = 'mutated';
                    expect( a.tag ).toBe( 'mutated' );
                    expect( await DIContainer.resolve( 'A' )).toBe( a );
                }
            );
        });
    });

    it( 'should return bare object providers and inherit class scope', async () =>
    {
        // Arrange
        class Scoped
        {
            static __scope__ = Scope.REQUEST;
        }
        const registry = new ApplicationRegistry();
        registry.registerProvider( 'Bare', { already : true });
        registry.registerProvider( 'Scoped', { class : Scoped });
        registry.registerProvider( 'Primitive', 7 );

        // Act / Assert
        await runWithRegistry( registry, async () =>
        {
            expect( await DIContainer.resolve( 'Bare' )).toEqual({ already : true });
            expect( DIContainer.getResolvedScope( 'Scoped' )).toBe( Scope.REQUEST );
            expect( await DIContainer.resolve( 'Primitive' )).toBe( 7 );
        });
    });

    it( 'should throw when REQUEST/TRANSIENT providers are missing', async () =>
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
        await runWithRegistry( registry, async () =>
        {
            await expect( Context.run(
                { request : {} as any, metadata : {} as any, requestInstances : new Map() },
                () => DIContainer.resolve( 'Req' )
            )).rejects.toThrow( /No provider registered/ );

            await expect( DIContainer.resolve( 'Tx' )).rejects.toThrow( /No provider registered/ );
        });
    });

    it( 'should report a dependency cycle as a path', async () =>
    {
        // Arrange
        class A
        {
            static __injections__ = { constructorDeps : [ 'B' ], propertyDeps : {} };
            constructor( public b: any ){}
        }
        class B
        {
            static __injections__ = { constructorDeps : [ 'A' ], propertyDeps : {} };
            constructor( public a: any ){}
        }

        const registry = new ApplicationRegistry();
        registry.registerProvider( 'A', A );
        registry.registerProvider( 'B', B );

        // Act
        await runWithRegistry( registry, () => DIContainer.resolve( 'A' ));

        // Assert
        expect([ ...registry.dependencyCycles ]).toContain( 'A -> B -> A' );
    });

    it( 'should serve a repeated resolution from the instance cache', async () =>
    {
        // Arrange
        class Svc { id = Math.random(); }
        const registry = new ApplicationRegistry();
        registry.registerProvider( 'Svc', Svc );

        // Act
        const [ first, second ] = await runWithRegistry( registry, async () =>
        {
            const a = await DIContainer.resolve( 'Svc' );
            const b = await DIContainer.resolve( 'Svc' );

            return [ a, b ];
        });

        // Assert
        expect( first ).toBe( second );
    });

    it( 'should pick up providers registered after an earlier resolution', async () =>
    {
        // Arrange
        class Late { tag = 'late'; }
        const registry = new ApplicationRegistry();
        registry.registerProvider( 'Early', class Early {});

        // Act / Assert — the memoized binding for Late must not be a cached miss
        await runWithRegistry( registry, async () =>
        {
            await DIContainer.resolve( 'Early' );
            await expect( DIContainer.resolve( 'Late' )).rejects.toThrow( /No provider registered/ );
            registry.registerProvider( 'Late', Late );

            expect(( await DIContainer.resolve( 'Late' )).tag ).toBe( 'late' );
        });
    });

    it( 'should reject the same token being claimed by two modules', () =>
    {
        // Arrange
        const registry = new ApplicationRegistry();
        class M1 {}
        class M2 {}
        const m1 = registry.createModuleInstance( 'M1', M1 );
        const m2 = registry.createModuleInstance( 'M2', M2 );

        // Act / Assert
        registry.mapTokenToModule( 'Shared', m1 );
        expect(() => registry.mapTokenToModule( 'Shared', m2 )).toThrow( /both M1 and M2/ );
    });

    it( 'should not serve a module-owned token from the flat provider map', async () =>
    {
        // Arrange — the token is registered flat but claimed by a module that lacks it
        const registry = new ApplicationRegistry();
        class Owner {}
        class Ghost {}
        const owner = registry.createModuleInstance( 'Owner', Owner );
        registry.registerProvider( 'Ghost', Ghost );
        registry.mapTokenToModule( 'Ghost', owner );

        // Act / Assert
        await runWithRegistry( registry, async () =>
        {
            await expect( DIContainer.resolve( 'Ghost' )).rejects.toThrow(
                /No provider registered for token: Ghost in module Owner/
            );
        });
    });

    it( 'should still resolve a module provider without an explicit context', async () =>
    {
        // Arrange
        const registry = new ApplicationRegistry();
        class Owner {}
        class Priv { tag = 'private'; }
        const owner = registry.createModuleInstance( 'Owner', Owner );
        owner.providers.set( 'Priv', Priv );
        registry.mapClassToModule( Priv, owner );
        registry.mapTokenToModule( 'Priv', owner );

        // Act / Assert
        await runWithRegistry( registry, async () =>
        {
            expect(( await DIContainer.resolve( 'Priv' )).tag ).toBe( 'private' );
        });
    });

    it( 'should run init hooks dependency-first and destroy hooks in reverse', async () =>
    {
        // Arrange
        const calls: string[] = [];
        class Dep
        {
            onInit(){ calls.push( 'init:dep' ) }
            onDestroy(){ calls.push( 'down:dep' ) }
        }
        class Host
        {
            static __injections__ = { constructorDeps : [ 'Dep' ], propertyDeps : {} };
            constructor( public dep: any ){}
            onInit(){ calls.push( 'init:host' ) }
            onDestroy(){ calls.push( 'down:host' ) }
        }

        const registry = new ApplicationRegistry();
        registry.registerProvider( 'Host', Host );
        registry.registerProvider( 'Dep', Dep );

        // Act — onInit runs during resolveAll
        await runWithRegistry( registry, () => registry.resolveAll());
        await registry.destroyAll();

        // Assert
        expect( calls ).toEqual([ 'init:dep', 'init:host', 'down:host', 'down:dep' ]);
    });

    it( 'should await async onInit on deps before constructing the consumer', async () =>
    {
        // Arrange
        const calls: string[] = [];
        class Dep
        {
            async onInit()
            {
                await new Promise( r => setTimeout( r, 20 ));
                calls.push( 'init:dep' );
            }
        }
        class Host
        {
            static __injections__ = { constructorDeps : [ 'Dep' ], propertyDeps : {} };
            constructor( public dep: any )
            {
                calls.push( 'ctor:host' );
            }
            async onInit()
            {
                calls.push( 'init:host' );
            }
        }

        const registry = new ApplicationRegistry();
        registry.registerProvider( 'Host', Host );
        registry.registerProvider( 'Dep', Dep );

        // Act
        await runWithRegistry( registry, () => DIContainer.resolve( 'Host' ));

        // Assert — dep onInit finishes before host constructor
        expect( calls ).toEqual([ 'init:dep', 'ctor:host', 'init:host' ]);
    });

    it( 'should call onDestroy for TRANSIENT instances at request end', async () =>
    {
        // Arrange
        const calls: string[] = [];
        class Scratch
        {
            static __scope__ = Scope.TRANSIENT;
            onDestroy(){ calls.push( 'down' ) }
        }

        const registry = new ApplicationRegistry();
        registry.registerProvider( 'Scratch', Scratch );

        // Act
        await runWithRegistry( registry, async () =>
        {
            await Context.run(
                { request : {} as any, metadata : {} as any, requestInstances : new Map() },
                async () =>
                {
                    await DIContainer.resolve( 'Scratch' );
                    await DIContainer.resolve( 'Scratch' );
                    await DIContainer.destroyInstances( Context.get()!.requestInstances!.values());
                    Context.get()!.requestInstances!.clear();
                }
            );
        });

        // Assert — both transient instances destroyed
        expect( calls ).toEqual([ 'down', 'down' ]);
    });

    it( 'should call onDestroy for TRANSIENT instances created outside a request on destroyAll', async () =>
    {
        // Arrange
        const calls: string[] = [];
        class Scratch
        {
            static __scope__ = Scope.TRANSIENT;
            onDestroy(){ calls.push( 'down' ) }
        }

        const registry = new ApplicationRegistry();
        registry.registerProvider( 'Scratch', Scratch );

        // Act
        await runWithRegistry( registry, async () =>
        {
            await DIContainer.resolve( 'Scratch' );
            await registry.destroyAll();
        });

        // Assert
        expect( calls ).toEqual([ 'down' ]);
    });

    it( 'should resolve TRANSIENT circular deps via lazy proxy', async () =>
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

        // Act / Assert — TRANSIENT never caches, so the circular back-ref stays a lazy
        // proxy that cannot re-find the constructed instance after resolve completes.
        await runWithRegistry( registry, async () =>
        {
            const a = await DIContainer.resolve( 'A' );

            expect( a.name()).toBe( 'A' );
            expect( a.b.name()).toBe( 'B' );
            expect( a.b.a ).toBeDefined();
            expect( await DIContainer.resolve( 'A' )).not.toBe( a );
        });
    });
});
