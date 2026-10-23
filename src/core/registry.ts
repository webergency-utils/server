import { AsyncLocalStorage } from 'async_hooks';
import { EndpointMetadata } from './types.js';
import { Scope } from '../decorators.js';
import { Context } from './context.js';
import { getInjectableMeta } from './symbols.js';

/** Tear-down runs dependents before the providers they depend on. */
const REVERSE_ORDER_HOOKS = new Set([ 'onDestroy' ]);

/**
 * Everything about a token that does not depend on the rest of the graph: which provider
 * serves it, which module declares it, its declared scope, and what it needs injected.
 * Cached per `(token, consumer module)` so post-bootstrap resolution is map lookups.
 */
export interface Binding
{
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

export class ApplicationRegistry
{
    endpoints            : EndpointMetadata[] = [];
    controllers        = new Map<string, any>();
    guards             = new Map<string, any>();
    interceptors       = new Map<string, any>();
    providers          = new Map<string, any>();
    modules            = new Map<string, any>();
    instances          = new Map<string, any>();
    /** In-flight singleton creation + onInit promises keyed like instances (`token::module`). */
    inflightSingletons = new Map<string, Promise<any>>();
    /**
     * TRANSIENT (and similar) instances created outside a request — destroyed on
     * `destroyAll()` / app shutdown.
     */
    ephemeralInstances = new Set<any>();
    controllerClasses  = new Set<string>();
    guardClasses       = new Set<string>();
    interceptorClasses = new Set<string>();
    moduleInstances    = new Map<any, any>();
    classToModuleMap   = new Map<any, any>();
    tokenToModuleMap   = new Map<string, any>();
    globalModules      = new Set<any>();
    defaultResponseMode? : 'strict' | 'relaxed' | 'strip';
    /** Controllers/providers seen during walk that lacked AOT Symbol meta. */
    missingAotHosts      : string[] = [];
    /** Provider lookups memoized per `(token, module)` so resolution is not a repeated walk. */
    bindings           = new Map<string, Binding>();
    /** Resolved scopes memoized per `(token, module)`. */
    scopes             = new Map<string, Scope>();
    /** Dependency cycles found while resolving scopes, reported as `A -> B -> A`. */
    dependencyCycles   = new Set<string>();
    /** Monotonic counter bumped whenever registrations change so EndpointPlan caches invalidate. */
    cacheVersion       = 0;
    /** Paths registered (method+path) for duplicate detection. */
    private routeKeys  = new Set<string>();

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

    public static async destroyInstance( instance: any ): Promise<void>
    {
        if( !instance || typeof instance !== 'object' ){ return }

        if( typeof instance.onDestroy !== 'function' ){ return }

        if( instance.__webergencyOnDestroyDone ){ return }

        instance.__webergencyOnDestroyDone = true;
        await instance.onDestroy();
    }

    /** Destroy instances in reverse registration order (last created first). */
    public static async destroyInstances( instances: Iterable<any> ): Promise<void>
    {
        const list = Array.from( instances ).reverse();

        for( const instance of list )
        {
            try
            {
                await ApplicationRegistry.destroyInstance( instance );
            }
            catch( err )
            {
                console.error( '[onDestroy]', err );
            }
        }
    }

    /** Registration changes what a token resolves to, so the memoized views are dropped. */
    private invalidateResolutionCache()
    {
        this.bindings.clear();
        this.scopes.clear();
        this.cacheVersion++;
    }

    recordDependencyCycle( path: string[])
    {
        const tokens = path.map( key => key.split( '::' )[0]);
        // Trim the ancestors that merely led to the cycle so the report is just the loop.
        const start = tokens.indexOf( tokens[tokens.length - 1]);

        this.dependencyCycles.add( tokens.slice( start ).join( ' -> ' ));
    }

    registerEndpoint( metadata: EndpointMetadata )
    {
        const group = metadata.seo ? 'seo' : metadata.internal ? 'internal' : 'public';
        const key = `${group}:${metadata.httpMethod.toUpperCase()} ${metadata.path}`;

        if( this.routeKeys.has( key ))
        {
            throw new Error( `Duplicate route registered: ${key}` );
        }

        this.routeKeys.add( key );
        this.endpoints.push( metadata );
    }

    getEndpoints(): EndpointMetadata[]
    {
        return this.endpoints;
    }

    registerProvider( token: string, provider: any )
    {
        this.providers.set( token, provider );
        this.invalidateResolutionCache();
    }

    getProvider( token: string ): any
    {
        return this.providers.get( token );
    }

    registerModule( name: string, moduleClass: any )
    {
        this.modules.set( name, moduleClass );
    }

    getModule( name: string ): any
    {
        return this.modules.get( name );
    }

    getModuleInstance( moduleClass: any ): any
    {
        return this.moduleInstances.get( moduleClass );
    }

    createModuleInstance( name: string, moduleClass: any ): any
    {
        const instance =
        {
            name,
            moduleClass,
            providers   : new Map<string, any>(),
            controllers : new Map<string, any>(),
            exports     : new Set<string>(),
            imports     : new Set<any>(),
            instances   : new Map<string, any>()
        };
        this.moduleInstances.set( moduleClass, instance );

        return instance;
    }

    getModuleInstances(): any[]
    {
        return Array.from( this.moduleInstances.values());
    }

    mapClassToModule( cls: any, moduleInstance: any )
    {
        this.classToModuleMap.set( cls, moduleInstance );
    }

    getClassModule( cls: any ): any
    {
        return this.classToModuleMap.get( cls );
    }

    mapTokenToModule( token: string, moduleInstance: any )
    {
        const existing = this.tokenToModuleMap.get( token );

        if( existing && existing !== moduleInstance )
        {
            throw new Error(
                existing.name === moduleInstance.name
                    ? `Two different modules are both named ${moduleInstance.name}, so token "${token}" is ambiguous. Modules are identified by class name — rename one of them.`
                    : `Token "${token}" is registered by both ${existing.name} and ${moduleInstance.name}. Rename one of them, or move the provider into a shared module and export it.`
            );
        }

        this.tokenToModuleMap.set( token, moduleInstance );
        this.invalidateResolutionCache();
    }

    getTokenModule( token: string ): any
    {
        return this.tokenToModuleMap.get( token );
    }

    registerGlobalModule( moduleInstance: any )
    {
        this.globalModules.add( moduleInstance );
    }

    getGlobalModules(): any[]
    {
        return Array.from( this.globalModules );
    }

    registerController( name: string, classOrInstance: any )
    {
        if( typeof classOrInstance === 'function' )
        {
            this.providers.set( name, classOrInstance );
            this.controllerClasses.add( name );
            this.invalidateResolutionCache();
        }
        else
        {
            this.controllers.set( name, classOrInstance );
            this.cacheVersion++;
        }
    }

    getController( name: string, contextModule?: any ): Promise<any>
    {
        if( this.controllers.has( name ))
        {
            return Promise.resolve( this.controllers.get( name ));
        }
        const actualContext = contextModule || this.tokenToModuleMap.get( name );

        return this.resolve( name, actualContext );
    }

    registerGuard( name: string, classOrInstance: any )
    {
        if( typeof classOrInstance === 'function' )
        {
            this.providers.set( name, classOrInstance );
            this.guardClasses.add( name );
            this.invalidateResolutionCache();
        }
        else
        {
            this.guards.set( name, classOrInstance );
            this.cacheVersion++;
        }
    }

    getGuard( name: string, contextModule?: any ): Promise<any>
    {
        if( this.guards.has( name ))
        {
            return Promise.resolve( this.guards.get( name ));
        }
        const actualContext = contextModule || this.tokenToModuleMap.get( name );

        return this.resolve( name, actualContext );
    }

    registerInterceptor( name: string, classOrInstance: any )
    {
        if( typeof classOrInstance === 'function' )
        {
            this.providers.set( name, classOrInstance );
            this.interceptorClasses.add( name );
            this.invalidateResolutionCache();
        }
        else
        {
            this.interceptors.set( name, classOrInstance );
            this.cacheVersion++;
        }
    }

    getInterceptor( name: string, contextModule?: any ): Promise<any>
    {
        if( this.interceptors.has( name ))
        {
            return Promise.resolve( this.interceptors.get( name ));
        }
        const actualContext = contextModule || this.tokenToModuleMap.get( name );

        return this.resolve( name, actualContext );
    }

    getInjectable( name: string, contextModule?: any ): Promise<any>
    {
        return this.resolve( name, contextModule );
    }

    clear()
    {
        this.endpoints.length = 0;
        this.controllers.clear();
        this.guards.clear();
        this.interceptors.clear();
        this.providers.clear();
        this.modules.clear();
        this.instances.clear();
        this.inflightSingletons.clear();
        this.ephemeralInstances.clear();
        this.controllerClasses.clear();
        this.guardClasses.clear();
        this.interceptorClasses.clear();
        this.moduleInstances.clear();
        this.classToModuleMap.clear();
        this.tokenToModuleMap.clear();
        this.globalModules.clear();
        this.routeKeys.clear();
        this.missingAotHosts.length = 0;
        this.bindings.clear();
        this.scopes.clear();
        this.dependencyCycles.clear();
        this.defaultResponseMode = undefined;
        this.cacheVersion++;
    }

    locateProviderInScope( token: string, moduleInstance: any, visited = new Set<any>()): any
    {
        if( visited.has( moduleInstance )){ return null }
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

        for( const globalM of this.globalModules )
        {
            if( globalM !== moduleInstance && this.isExportedFromModule( token, globalM, new Set( visited )))
            {
                return globalM.providers.get( token ) || globalM.controllers.get( token ) || this.locateProviderInScope( token, globalM, new Set( visited ));
            }
        }

        return null;
    }

    isExportedFromModule( token: string, moduleInstance: any, visited = new Set<any>()): boolean
    {
        // Re-exports can form a cycle, so a module is only inspected once per walk.
        if( visited.has( moduleInstance )){ return false }
        visited.add( moduleInstance );

        if( moduleInstance.exports.has( token ))
        {
            return true;
        }

        for( const exp of moduleInstance.exports )
        {
            let expMInstance = this.moduleInstances.get( exp );

            if( !expMInstance && typeof exp === 'string' && this.modules.has( exp ))
            {
                const expModuleClass = this.modules.get( exp );
                expMInstance = this.moduleInstances.get( expModuleClass );
            }

            if( expMInstance && this.isExportedFromModule( token, expMInstance, visited ))
            {
                return true;
            }
        }

        return false;
    }

    async instantiateProvider(
        token: string,
        provider: any,
        contextModule: any,
        resolutionStack?: Set<string>
    ): Promise<any>
    {
        if( typeof provider === 'function' )
        {
            return this.construct( provider, contextModule, resolutionStack );
        }

        if( provider && typeof provider === 'object' )
        {
            if( 'value' in provider )
            {
                return provider.value;
            }

            if( 'class' in provider )
            {
                return this.construct( provider.class, contextModule, resolutionStack );
            }

            if( 'factory' in provider )
            {
                const factoryDeps = provider.inject || [];
                const args: any[] = [];

                for( const depToken of factoryDeps )
                {
                    args.push( await this.resolve( depToken, contextModule, resolutionStack ));
                }

                return await provider.factory( ...args );
            }

            return provider;
        }

        return provider;
    }

    /**
     * Resolve each constructor dep (including its onInit) before `new`, then property deps.
     * Caller caches the instance then runs onInit.
     */
    private async construct(
        cls: any,
        contextModule: any,
        resolutionStack?: Set<string>
    ): Promise<any>
    {
        const injections = cls.__injections__ || {};
        const constructorDeps = injections.constructorDeps || [];
        const args: any[] = [];

        for( const depToken of constructorDeps )
        {
            if( depToken === 'any' )
            {
                args.push( undefined );
            }
            else
            {
                args.push( await this.resolve( depToken, contextModule, resolutionStack ));
            }
        }

        const instance = new cls( ...args );

        for( const [ propName, depToken ] of Object.entries( ApplicationRegistry.collectPropertyDeps( cls )))
        {
            instance[propName] = await this.resolve( depToken as string, contextModule, resolutionStack );
        }

        return instance;
    }

    private runOnInit( instance: any ): Promise<void> | void
    {
        if( !instance || typeof instance !== 'object' ){ return }

        if( typeof instance.onInit !== 'function' ){ return }

        if( instance.__webergencyOnInitDone ){ return }

        instance.__webergencyOnInitDone = true;

        return Promise.resolve( instance.onInit()).then(() => undefined );
    }

    /**
     * Remember an instance for onDestroy: on the active request if any, otherwise on the
     * process ephemeral set (app shutdown).
     */
    private trackEphemeral( instance: any, token: string ): void
    {
        if( !instance || typeof instance !== 'object' ){ return }

        const ctx = Context.get();

        if( ctx )
        {
            const store = ctx.requestInstances ?? ( ctx.requestInstances = new Map<string, any>());
            store.set( `transient:${token}:${store.size}`, instance );

            return;
        }

        this.ephemeralInstances.add( instance );
    }

    syncLegacyCompatibility( token: string, instance: any )
    {
        if( this.controllerClasses.has( token ))
        {
            this.controllers.set( token, instance );
        }
        else if( this.guardClasses.has( token ))
        {
            this.guards.set( token, instance );
        }
        else if( this.interceptorClasses.has( token ))
        {
            this.interceptors.set( token, instance );
        }
    }

    /** The class behind a provider, if it has one. */
    private static providerClassOf( provider: any ): any
    {
        if( typeof provider === 'function' ){ return provider }

        if( provider && typeof provider === 'object' && 'class' in provider ){ return provider.class }

        return null;
    }

    getBinding( token: string, contextModule?: any ): Binding | null
    {
        const key = scopedKey( token, contextModule );
        const cached = this.bindings.get( key );

        if( cached ){ return cached }

        const provider = contextModule
            ? this.locateProviderInScope( token, contextModule )
            // A module-owned token must resolve through its module so `exports` is enforced;
            // only root-level (module-less) registrations are reachable flat.
            : ( this.tokenToModuleMap.has( token ) ? null : this.providers.get( token ));

        if( !provider ){ return null }

        const providerClass = ApplicationRegistry.providerClassOf( provider );
        let explicitScope: Scope | undefined;
        let deps: string[] = [];

        if( typeof provider === 'function' )
        {
            explicitScope = provider.__scope__ ?? getInjectableMeta( provider )?.scope;
        }
        else if( provider && typeof provider === 'object' )
        {
            explicitScope = provider.scope !== undefined
                ? provider.scope
                : ( providerClass?.__scope__ ?? getInjectableMeta( providerClass )?.scope );
        }

        if( providerClass )
        {
            const injections = providerClass.__injections__ || {};
            const propertyDeps = Object.values( ApplicationRegistry.collectPropertyDeps( providerClass )) as string[];
            deps = [ ...( injections.constructorDeps || []), ...propertyDeps ];
        }
        else if( provider && typeof provider === 'object' && 'factory' in provider )
        {
            deps = provider.inject || [];
        }

        const declaringModule = providerClass && this.classToModuleMap.has( providerClass )
            ? this.classToModuleMap.get( providerClass )
            : contextModule;

        const binding: Binding = { provider, declaringModule, explicitScope, deps };
        this.bindings.set( key, binding );

        return binding;
    }

    getResolvedScope( token: string, contextModule?: any, visited = new Set<string>()): Scope
    {
        const key = scopedKey( token, contextModule );
        const memoized = this.scopes.get( key );

        if( memoized !== undefined ){ return memoized }

        if( visited.has( key ))
        {
            // Circular deps are supported through lazy proxies, so this is reported rather
            // than thrown — but the scope of a cycle member cannot be decided here.
            this.recordDependencyCycle([ ...visited, key ]);

            return Scope.SINGLETON;
        }

        const binding = this.getBinding( token, contextModule );

        if( !binding ){ return Scope.SINGLETON }

        if( binding.explicitScope === Scope.REQUEST )
        {
            this.scopes.set( key, Scope.REQUEST );

            return Scope.REQUEST;
        }

        const next = new Set( visited ).add( key );
        const cyclesBefore = this.dependencyCycles.size;
        let scope = binding.explicitScope === Scope.TRANSIENT ? Scope.TRANSIENT : Scope.SINGLETON;

        for( const depToken of binding.deps )
        {
            if( depToken === 'any' ){ continue }

            if( this.getResolvedScope( depToken, binding.declaringModule, next ) === Scope.REQUEST )
            {
                // A provider is request-scoped as soon as anything it depends on is.
                scope = Scope.REQUEST;
                break;
            }
        }

        // A scope decided while a cycle was being broken is provisional, so it is not cached.
        if( this.dependencyCycles.size === cyclesBefore ){ this.scopes.set( key, scope ) }

        return scope;
    }

    async resolveAll(): Promise<void>
    {
        const modules = Array.from( this.moduleInstances.values());

        if( modules.length > 0 )
        {
            for( const m of modules as any[])
            {
                if( m.moduleClass && m.moduleClass.name )
                {
                    const scope = this.getResolvedScope( m.moduleClass.name, m );

                    if( scope !== Scope.REQUEST && scope !== Scope.TRANSIENT )
                    {
                        await this.resolve( m.moduleClass.name, m );
                    }
                }
            }

            for( const m of modules as any[])
            {
                for( const ctrl of m.controllers.keys())
                {
                    const scope = this.getResolvedScope( ctrl, m );

                    if( scope !== Scope.REQUEST && scope !== Scope.TRANSIENT )
                    {
                        await this.resolve( ctrl, m );
                    }
                }

                for( const prov of m.providers.keys())
                {
                    if( m.moduleClass && prov === m.moduleClass.name )
                    {
                        continue;
                    }
                    const scope = this.getResolvedScope( prov, m );

                    if( scope !== Scope.REQUEST && scope !== Scope.TRANSIENT )
                    {
                        await this.resolve( prov, m );
                    }
                }
            }
        }
        else
        {
            for( const token of this.providers.keys())
            {
                const scope = this.getResolvedScope( token );

                if( scope !== Scope.REQUEST && scope !== Scope.TRANSIENT )
                {
                    await this.resolve( token );
                }
            }
        }
    }

    /** Sync cache read for circular lazy proxies (may be pre-onInit). */
    private getCached( token: string, currentContext?: any ): any
    {
        const scope = this.getResolvedScope( token, currentContext );

        if( scope === Scope.REQUEST )
        {
            const ctx = Context.get();
            const binding = this.getBinding( token, currentContext );

            if( !ctx?.requestInstances || !binding ){ return undefined }

            return ctx.requestInstances.get( scopedKey( token, binding.declaringModule ));
        }

        const instanceKey = scopedKey( token, currentContext );

        if( currentContext?.instances.has( token ))
        {
            return currentContext.instances.get( token );
        }

        return this.instances.get( instanceKey );
    }

    /**
     * Stand-in returned while `token` is already being constructed, so two providers may
     * depend on each other. Traps read the sync cache (filled before onInit completes).
     */
    private lazyProxy( token: string, contextModule?: any ): any
    {
        return new Proxy({}, {
            get : ( _target, prop ) =>
            {
                const instance = this.getCached( token, contextModule );

                if( !instance ){ return undefined }
                const value = Reflect.get( instance, prop, instance );

                return typeof value === 'function' ? value.bind( instance ) : value;
            },
            set : ( _target, prop, value ) =>
            {
                const instance = this.getCached( token, contextModule );

                if( !instance ){ return false }

                return Reflect.set( instance, prop, value, instance );
            }
        });
    }

    private missingProvider( token: string, contextModule?: any ): Error
    {
        return new Error( `No provider registered for token: ${token}${contextModule ? ` in module ${contextModule.name}` : ''}` );
    }

    async resolve( token: string, contextModule?: any, resolutionStack?: Set<string> ): Promise<any>
    {
        let currentContext = contextModule;

        if( !currentContext && this.tokenToModuleMap.has( token ))
        {
            currentContext = this.tokenToModuleMap.get( token );
        }

        const instanceKey = scopedKey( token, currentContext );

        if( currentContext )
        {
            if( currentContext.instances.has( token ))
            {
                if( !resolutionStack?.has( instanceKey ))
                {
                    const pending = this.inflightSingletons.get( instanceKey );

                    if( pending ){ return await pending }
                }

                return currentContext.instances.get( token );
            }
        }
        else if( this.instances.has( instanceKey ))
        {
            if( !resolutionStack?.has( instanceKey ))
            {
                const pending = this.inflightSingletons.get( instanceKey );

                if( pending ){ return await pending }
            }

            return this.instances.get( instanceKey );
        }

        const scope = this.getResolvedScope( token, currentContext );

        if( scope === Scope.REQUEST )
        {
            const ctx = Context.get();

            if( !ctx )
            {
                throw new Error( `Cannot resolve request-scoped provider ${token} outside of a request context` );
            }

            const requestStore = ctx.requestInstances ?? ( ctx.requestInstances = new Map<string, any>());
            const binding = this.getBinding( token, currentContext );

            if( !binding ){ throw this.missingProvider( token, currentContext ) }

            const cacheKey = scopedKey( token, binding.declaringModule );

            if( requestStore.has( cacheKey ))
            {
                if( !resolutionStack?.has( cacheKey ))
                {
                    const pending = ctx.requestInflight?.get( cacheKey );

                    if( pending ){ return await pending }
                }

                return requestStore.get( cacheKey );
            }

            if( resolutionStack?.has( cacheKey ))
            {
                return this.lazyProxy( token, currentContext );
            }

            const reqInflight = ctx.requestInflight ?? ( ctx.requestInflight = new Map<string, Promise<any>>());
            const existingInflight = reqInflight.get( cacheKey );

            if( existingInflight )
            {
                return await existingInflight;
            }

            const nextStack = new Set( resolutionStack );
            nextStack.add( cacheKey );

            const createPromise = ( async () =>
            {
                try
                {
                    const instance = await this.instantiateProvider( token, binding.provider, binding.declaringModule, nextStack );
                    requestStore.set( cacheKey, instance );
                    const initPromise = this.runOnInit( instance );

                    if( initPromise ){ await initPromise }

                    return instance;
                }
                finally
                {
                    reqInflight.delete( cacheKey );
                }
            })();

            reqInflight.set( cacheKey, createPromise );

            return await createPromise;
        }

        const binding = this.getBinding( token, currentContext );

        if( scope === Scope.TRANSIENT )
        {
            if( !binding ){ throw this.missingProvider( token, currentContext ) }

            const guardKey = scopedKey( token, binding.declaringModule );

            if( resolutionStack?.has( guardKey ))
            {
                return this.lazyProxy( token, currentContext );
            }

            const nextStack = new Set( resolutionStack );
            nextStack.add( guardKey );

            const instance = await this.instantiateProvider( token, binding.provider, binding.declaringModule, nextStack );
            const initPromise = this.runOnInit( instance );

            if( initPromise ){ await initPromise }

            this.trackEphemeral( instance, token );

            return instance;
        }

        if( !binding )
        {
            throw this.missingProvider( token, currentContext );
        }

        const guardKey = scopedKey( token, binding.declaringModule );

        if( resolutionStack?.has( guardKey ) || resolutionStack?.has( instanceKey ))
        {
            return this.lazyProxy( token, currentContext );
        }

        const existingSingleton = this.inflightSingletons.get( instanceKey );

        if( existingSingleton )
        {
            return await existingSingleton;
        }

        const nextStack = new Set( resolutionStack );
        nextStack.add( guardKey );
        nextStack.add( instanceKey );

        const createSingleton = ( async () =>
        {
            try
            {
                // Cache before onInit so circular proxies can see the instance; non-cyclic
                // waiters on inflightSingletons still block until onInit completes.
                const instance = await this.instantiateProvider(
                    token,
                    binding.provider,
                    currentContext ? binding.declaringModule : null,
                    nextStack
                );

                if( currentContext ){ currentContext.instances.set( token, instance ) }
                this.instances.set( instanceKey, instance );
                const initPromise = this.runOnInit( instance );

                if( initPromise ){ await initPromise }

                this.syncLegacyCompatibility( token, instance );

                return instance;
            }
            finally
            {
                this.inflightSingletons.delete( instanceKey );
            }
        })();

        this.inflightSingletons.set( instanceKey, createSingleton );

        return await createSingleton;
    }

    getAllInstances(): any[]
    {
        const instances = new Set<any>();

        for( const m of this.moduleInstances.values())
        {
            if( m.moduleClass && m.moduleClass.name )
            {
                const modInst = m.instances.get( m.moduleClass.name );

                if( modInst ){ instances.add( modInst ) }
            }

            for( const inst of m.instances.values())
            {
                if( inst && typeof inst === 'object' )
                {
                    instances.add( inst );
                }
            }
        }

        for( const inst of this.instances.values())
        {
            if( inst && typeof inst === 'object' )
            {
                instances.add( inst );
            }
        }

        for( const inst of this.controllers.values())
        {
            if( inst && typeof inst === 'object' )
            {
                instances.add( inst );
            }
        }

        for( const inst of this.guards.values())
        {
            if( inst && typeof inst === 'object' )
            {
                instances.add( inst );
            }
        }

        for( const inst of this.interceptors.values())
        {
            if( inst && typeof inst === 'object' )
            {
                instances.add( inst );
            }
        }

        return Array.from( instances );
    }

    /**
     * Instances ordered so that a provider is visited after everything it depends on.
     * Instances with no known token (e.g. objects registered directly) keep their
     * discovery order at the end.
     */
    private topologicalInstances(): any[]
    {
        const byInstance = new Map<any, string>();

        for( const [ token, instance ] of this.tokenInstances())
        {
            if( instance && typeof instance === 'object' && !byInstance.has( instance ))
            {
                byInstance.set( instance, token );
            }
        }

        const instanceOf = new Map<string, any>();

        for( const [ instance, token ] of byInstance ){ instanceOf.set( token, instance ) }

        const ordered: any[] = [];
        const done = new Set<any>();
        const visiting = new Set<string>();

        const visit = ( token: string ) =>
        {
            const instance = instanceOf.get( token );

            if( !instance || done.has( instance ) || visiting.has( token )){ return }
            visiting.add( token );

            const cls = instance.constructor;
            const injections = cls?.__injections__ || {};
            const deps = [
                ...( injections.constructorDeps || []),
                ...Object.values( ApplicationRegistry.collectPropertyDeps( cls ) || {})
            ] as string[];

            for( const dep of deps )
            {
                if( dep !== 'any' ){ visit( dep ) }
            }

            visiting.delete( token );
            done.add( instance );
            ordered.push( instance );
        };

        for( const token of instanceOf.keys()){ visit( token ) }

        for( const instance of this.getAllInstances())
        {
            if( !done.has( instance ))
            {
                done.add( instance );
                ordered.push( instance );
            }
        }

        return ordered;
    }

    /** Every `(token, instance)` pair known to the registry, module-scoped first. */
    private *tokenInstances(): Generator<[ string, any ]>
    {
        for( const m of this.moduleInstances.values())
        {
            for( const entry of m.instances ){ yield entry as [ string, any ] }
        }

        for( const [ key, instance ] of this.instances ){ yield [ key.split( '::' )[0], instance ] }

        for( const map of [ this.controllers, this.guards, this.interceptors ])
        {
            for( const entry of map ){ yield entry as [ string, any ] }
        }
    }

    async invokeHook( hookName: string, ...args: any[])
    {
        const instances = this.topologicalInstances();

        if( REVERSE_ORDER_HOOKS.has( hookName )){ instances.reverse() }

        for( const instance of instances )
        {
            if( instance && typeof instance[hookName] === 'function' )
            {
                await instance[hookName]( ...args );
            }
        }
    }

    /** Call onDestroy on all long-lived and process-owned ephemeral instances (dependents first). */
    async destroyAll(): Promise<void>
    {
        await this.invokeHook( 'onDestroy' );
        await ApplicationRegistry.destroyInstances( this.ephemeralInstances );
        this.ephemeralInstances.clear();
    }

    setDefaultResponseMode( mode: 'strict' | 'relaxed' | 'strip' )
    {
        this.defaultResponseMode = mode;
    }

    getDefaultResponseMode(): 'strict' | 'relaxed' | 'strip'
    {
        return this.defaultResponseMode || 'strip';
    }
}

const registryAls = new AsyncLocalStorage<ApplicationRegistry>();

export function runWithRegistry<T>( registry: ApplicationRegistry, fn: () => T ): T
{
    if( tryGetRegistry() === registry )
    {
        return fn();
    }

    return registryAls.run( registry, fn );
}

export function getRegistry(): ApplicationRegistry
{
    const registry = Context.get()?.registry ?? registryAls.getStore();

    if( !registry )
    {
        throw new Error( 'No ApplicationRegistry in context. Call Server.start()/fetch() or runWithRegistry() first.' );
    }

    return registry;
}

export function tryGetRegistry(): ApplicationRegistry | undefined
{
    return Context.get()?.registry ?? registryAls.getStore();
}
