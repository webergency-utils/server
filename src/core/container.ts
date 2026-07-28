import { store } from './metadata.js';
import { getRegistry } from './registry.js';
import { Scope } from '../decorators.js';
import { Context } from './context.js';

/**
 * Everything about a token that does not depend on the rest of the graph: which provider
 * serves it, which module declares it, its declared scope, and what it needs injected.
 * Cached per `(token, consumer module)` so post-bootstrap resolution is map lookups.
 */
export interface Binding {
    provider        : any
    declaringModule : any
    explicitScope   : Scope | undefined
    deps            : string[]
}

/** Instances, bindings, and resolution guards are all keyed by token *and* module. */
export function scopedKey( token: string, moduleInstance?: any ): string
{
    return `${token}::${moduleInstance ? moduleInstance.name : 'global'}`;
}

export class DIContainer 
{
    public static collectPropertyDeps( cls: any ): Record<string, string> 
    {
        const deps: Record<string, string> = {};
        let current = cls;

        while( current && current !== Function.prototype && current !== Object.prototype ) 
        {
            if( Object.prototype.hasOwnProperty.call( current, '__injections__' ) && current.__injections__?.propertyDeps ) 
            {
                Object.assign( deps, current.__injections__.propertyDeps );
            }
            current = Object.getPrototypeOf( current );
        }

        return deps;
    }

    public static locateProviderInScope( token: string, moduleInstance: any, visited = new Set<any>()): any 
    {
        if( visited.has( moduleInstance )) { return null }
        visited.add( moduleInstance );

        if( moduleInstance.providers.has( token )) 
        {
            return moduleInstance.providers.get( token );
        }

        if( moduleInstance.controllers.has( token )) 
        {
            return moduleInstance.controllers.get( token );
        }

        for( const impM of moduleInstance.imports ) 
        {
            // A copy, so marking modules visited while checking exports does not hide them
            // from the provider walk below.
            if( this.isExportedFromModule( token, impM, new Set( visited ))) 
            {
                return impM.providers.get( token ) || impM.controllers.get( token ) || this.locateProviderInScope( token, impM, new Set( visited ));
            }
        }

        for( const globalM of store.globalModules ) 
        {
            if( globalM !== moduleInstance && this.isExportedFromModule( token, globalM, new Set( visited ))) 
            {
                return globalM.providers.get( token ) || globalM.controllers.get( token ) || this.locateProviderInScope( token, globalM, new Set( visited ));
            }
        }

        return null;
    }

    public static isExportedFromModule( token: string, moduleInstance: any, visited = new Set<any>()): boolean 
    {
        // Re-exports can form a cycle, so a module is only inspected once per walk.
        if( visited.has( moduleInstance )) { return false }
        visited.add( moduleInstance );

        if( moduleInstance.exports.has( token )) 
        {
            return true;
        }

        for( const exp of moduleInstance.exports ) 
        {
            let expMInstance = store.moduleInstances.get( exp );

            if( !expMInstance && typeof exp === 'string' && store.modules.has( exp )) 
            {
                const expModuleClass = store.modules.get( exp );
                expMInstance = store.moduleInstances.get( expModuleClass );
            }
      
            if( expMInstance && this.isExportedFromModule( token, expMInstance, visited )) 
            {
                return true;
            }
        }

        return false;
    }

    public static instantiateProvider( token: string, provider: any, contextModule: any ): any 
    {
        if( typeof provider === 'function' ) 
        {
            return this.construct( provider, contextModule );
        }

        if( provider && typeof provider === 'object' ) 
        {
            if( 'useValue' in provider ) 
            {
                return provider.useValue;
            }

            if( 'useClass' in provider ) 
            {
                return this.construct( provider.useClass, contextModule );
            }

            if( 'useFactory' in provider ) 
            {
                const factoryDeps = provider.inject || [];
                const args = factoryDeps.map(( depToken: string ) => this.resolve( depToken, contextModule ));

                return provider.useFactory( ...args );
            }

            return provider;
        }

        return provider;
    }

    private static construct( cls: any, contextModule: any ): any
    {
        const injections = cls.__injections__ || {};
        const constructorDeps = injections.constructorDeps || [];
        const args = constructorDeps.map(( depToken: string ) => 
        {
            if( depToken === 'any' ) { return undefined }

            return this.resolve( depToken, contextModule );
        });

        const instance = new cls( ...args );

        for( const [ propName, depToken ] of Object.entries( this.collectPropertyDeps( cls ))) 
        {
            instance[propName] = this.resolve( depToken, contextModule );
        }

        return instance;
    }

    public static syncLegacyCompatibility( token: string, instance: any ) 
    {
        if( store.controllerClasses.has( token )) 
        {
            store.controllers.set( token, instance );
        }
        else if( store.guardClasses.has( token )) 
        {
            store.guards.set( token, instance );
        }
        else if( store.interceptorClasses.has( token )) 
        {
            store.interceptors.set( token, instance );
        }
    }

    /** The class behind a provider, if it has one. */
    private static providerClassOf( provider: any ): any
    {
        if( typeof provider === 'function' ){ return provider }

        if( provider && typeof provider === 'object' && 'useClass' in provider ){ return provider.useClass }

        return null;
    }

    public static getBinding( token: string, contextModule?: any ): Binding | null
    {
        const registry = getRegistry();
        const key = scopedKey( token, contextModule );
        const cached = registry.bindings.get( key );

        if( cached ){ return cached }

        const provider = contextModule
            ? this.locateProviderInScope( token, contextModule )
            // A module-owned token must resolve through its module so `exports` is enforced;
            // only root-level (module-less) registrations are reachable flat.
            : ( registry.tokenToModuleMap.has( token ) ? null : registry.providers.get( token ));

        if( !provider ){ return null }

        const providerClass = this.providerClassOf( provider );
        let explicitScope: Scope | undefined;
        let deps: string[] = [];

        if( typeof provider === 'function' )
        {
            explicitScope = provider.__scope__;
        }
        else if( provider && typeof provider === 'object' )
        {
            explicitScope = provider.scope !== undefined ? provider.scope : providerClass?.__scope__;
        }

        if( providerClass )
        {
            const injections = providerClass.__injections__ || {};
            const propertyDeps = Object.values( this.collectPropertyDeps( providerClass )) as string[];
            deps = [ ...( injections.constructorDeps || []), ...propertyDeps ];
        }
        else if( provider && typeof provider === 'object' && 'useFactory' in provider )
        {
            deps = provider.inject || [];
        }

        const declaringModule = providerClass && registry.classToModuleMap.has( providerClass )
            ? registry.classToModuleMap.get( providerClass )
            : contextModule;

        const binding: Binding = { provider, declaringModule, explicitScope, deps };
        registry.bindings.set( key, binding );

        return binding;
    }

    public static getResolvedScope( token: string, contextModule?: any, visited = new Set<string>()): Scope 
    {
        const registry = getRegistry();
        const key = scopedKey( token, contextModule );
        const memoized = registry.scopes.get( key );

        if( memoized !== undefined ){ return memoized }

        if( visited.has( key )) 
        {
            // Circular deps are supported through lazy proxies, so this is reported rather
            // than thrown — but the scope of a cycle member cannot be decided here.
            registry.recordDependencyCycle([ ...visited, key ]);

            return Scope.DEFAULT;
        }

        const binding = this.getBinding( token, contextModule );

        if( !binding ) { return Scope.DEFAULT }

        if( binding.explicitScope === Scope.REQUEST ) 
        {
            registry.scopes.set( key, Scope.REQUEST );

            return Scope.REQUEST;
        }

        const next = new Set( visited ).add( key );
        const cyclesBefore = registry.dependencyCycles.size;
        let scope = binding.explicitScope === Scope.TRANSIENT ? Scope.TRANSIENT : Scope.DEFAULT;

        for( const depToken of binding.deps ) 
        {
            if( depToken === 'any' ) { continue }

            if( this.getResolvedScope( depToken, binding.declaringModule, next ) === Scope.REQUEST ) 
            {
                // A provider is request-scoped as soon as anything it depends on is.
                scope = Scope.REQUEST;
                break;
            }
        }

        // A scope decided while a cycle was being broken is provisional, so it is not cached.
        if( registry.dependencyCycles.size === cyclesBefore ){ registry.scopes.set( key, scope ) }

        return scope;
    }

    public static resolveAll() 
    {
        const modules = Array.from( store.moduleInstances.values());

        if( modules.length > 0 ) 
        {
            for( const m of modules as any[]) 
            {
                if( m.moduleClass && m.moduleClass.name ) 
                {
                    const scope = this.getResolvedScope( m.moduleClass.name, m );

                    if( scope !== Scope.REQUEST ) 
                    {
                        this.resolve( m.moduleClass.name, m );
                    }
                }
            }

            for( const m of modules as any[]) 
            {
                for( const ctrl of m.controllers.keys()) 
                {
                    const scope = this.getResolvedScope( ctrl, m );

                    if( scope !== Scope.REQUEST ) 
                    {
                        this.resolve( ctrl, m );
                    }
                }

                for( const prov of m.providers.keys()) 
                {
                    if( m.moduleClass && prov === m.moduleClass.name ) 
                    {
                        continue;
                    }
                    const scope = this.getResolvedScope( prov, m );

                    if( scope !== Scope.REQUEST ) 
                    {
                        this.resolve( prov, m );
                    }
                }
            }
        }
        else 
        {
            for( const token of store.providers.keys()) 
            {
                const scope = this.getResolvedScope( token );

                if( scope !== Scope.REQUEST ) 
                {
                    this.resolve( token );
                }
            }
        }
    }

    /**
     * Stand-in returned while `token` is already being constructed, so two providers may
     * depend on each other. Every trap re-resolves, by which time the real instance exists.
     */
    private static lazyProxy( token: string, contextModule?: any ): any
    {
        return new Proxy({}, {
            get( _target, prop ) 
            {
                const instance = DIContainer.resolve( token, contextModule );

                if( !instance ) { return undefined }
                const value = Reflect.get( instance, prop, instance );

                return typeof value === 'function' ? value.bind( instance ) : value;
            },
            set( _target, prop, value ) 
            {
                const instance = DIContainer.resolve( token, contextModule );

                return Reflect.set( instance, prop, value, instance );
            }
        });
    }

    private static missingProvider( token: string, contextModule?: any ): Error
    {
        return new Error( `No provider registered for token: ${token}${contextModule ? ` in module ${contextModule.name}` : ''}` );
    }

    public static resolve( token: string, contextModule?: any ): any 
    {
        const registry = getRegistry();
        let currentContext = contextModule;

        if( !currentContext && registry.tokenToModuleMap.has( token )) 
        {
            currentContext = registry.tokenToModuleMap.get( token );
        }

        // Cache first: singletons are the common case, and the scope walk below is the
        // expensive part. Only DEFAULT-scoped instances are ever stored in these maps.
        const instanceKey = scopedKey( token, currentContext );

        if( currentContext )
        {
            if( currentContext.instances.has( token )){ return currentContext.instances.get( token ) }
        }
        else if( registry.instances.has( instanceKey ))
        {
            return registry.instances.get( instanceKey );
        }

        const scope = this.getResolvedScope( token, currentContext );

        if( scope === Scope.REQUEST ) 
        {
            const ctx = Context.get();

            if( !ctx || !ctx.requestInstances ) 
            {
                throw new Error( `Cannot resolve request-scoped provider ${token} outside of a request context` );
            }

            const binding = this.getBinding( token, currentContext );

            if( !binding ) { throw this.missingProvider( token, currentContext ) }

            const cacheKey = scopedKey( token, binding.declaringModule );

            if( ctx.requestInstances.has( cacheKey )) 
            {
                return ctx.requestInstances.get( cacheKey );
            }

            if( registry.resolving.has( cacheKey )) 
            {
                return this.lazyProxy( token, currentContext );
            }

            registry.resolving.add( cacheKey );
            try 
            {
                const instance = this.instantiateProvider( token, binding.provider, binding.declaringModule );
                ctx.requestInstances.set( cacheKey, instance );

                return instance;
            }
            finally 
            {
                registry.resolving.delete( cacheKey );
            }
        }

        const binding = this.getBinding( token, currentContext );

        if( scope === Scope.TRANSIENT ) 
        {
            if( !binding ) { throw this.missingProvider( token, currentContext ) }

            const guardKey = scopedKey( token, binding.declaringModule );

            if( registry.resolving.has( guardKey )) 
            {
                return this.lazyProxy( token, currentContext );
            }

            registry.resolving.add( guardKey );
            try 
            {
                return this.instantiateProvider( token, binding.provider, binding.declaringModule );
            }
            finally 
            {
                registry.resolving.delete( guardKey );
            }
        }

        if( !binding ) 
        {
            throw this.missingProvider( token, currentContext );
        }

        // Guarded by declaring module, not by consumer, so a cycle reached from two different
        // modules still resolves to the same in-progress entry.
        const guardKey = scopedKey( token, binding.declaringModule );

        if( registry.resolving.has( guardKey )) 
        {
            return this.lazyProxy( token, currentContext );
        }

        registry.resolving.add( guardKey );
        try 
        {
            const instance = this.instantiateProvider( token, binding.provider, currentContext ? binding.declaringModule : null );

            if( currentContext ){ currentContext.instances.set( token, instance ) }
            registry.instances.set( instanceKey, instance );
            this.syncLegacyCompatibility( token, instance );

            return instance;
        }
        finally 
        {
            registry.resolving.delete( guardKey );
        }
    }
}
