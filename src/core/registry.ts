import { AsyncLocalStorage } from 'async_hooks';
import { EndpointMetadata } from './types.js';
import { Scope } from '../decorators.js';
import { DIContainer, Binding } from './container.js';

/** Tear-down runs dependents before the providers they depend on. */
const REVERSE_ORDER_HOOKS = new Set([ 'onDestroy' ]);

export class ApplicationRegistry
{
    endpoints            : EndpointMetadata[] = [];
    controllers        = new Map<string, any>();
    guards             = new Map<string, any>();
    interceptors       = new Map<string, any>();
    providers          = new Map<string, any>();
    modules            = new Map<string, any>();
    instances          = new Map<string, any>();
    resolving          = new Set<string>();
    /** In-flight onInit gates keyed like instances (`token::module`). */
    initPromises       = new Map<string, Promise<void>>();
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
    /** Paths registered (method+path) for duplicate detection. */
    private routeKeys  = new Set<string>();

    /** Registration changes what a token resolves to, so the memoized views are dropped. */
    private invalidateResolutionCache()
    {
        this.bindings.clear();
        this.scopes.clear();
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
        }
        else
        {
            this.controllers.set( name, classOrInstance );
        }
    }

    getController( name: string, contextModule?: any ): Promise<any>
    {
        if( this.controllers.has( name ))
        {
            return Promise.resolve( this.controllers.get( name ));
        }
        const actualContext = contextModule || this.tokenToModuleMap.get( name );

        return DIContainer.resolve( name, actualContext );
    }

    registerGuard( name: string, classOrInstance: any )
    {
        if( typeof classOrInstance === 'function' )
        {
            this.providers.set( name, classOrInstance );
            this.guardClasses.add( name );
        }
        else
        {
            this.guards.set( name, classOrInstance );
        }
    }

    getGuard( name: string, contextModule?: any ): Promise<any>
    {
        if( this.guards.has( name ))
        {
            return Promise.resolve( this.guards.get( name ));
        }
        const actualContext = contextModule || this.tokenToModuleMap.get( name );

        return DIContainer.resolve( name, actualContext );
    }

    registerInterceptor( name: string, classOrInstance: any )
    {
        if( typeof classOrInstance === 'function' )
        {
            this.providers.set( name, classOrInstance );
            this.interceptorClasses.add( name );
        }
        else
        {
            this.interceptors.set( name, classOrInstance );
        }
    }

    getInterceptor( name: string, contextModule?: any ): Promise<any>
    {
        if( this.interceptors.has( name ))
        {
            return Promise.resolve( this.interceptors.get( name ));
        }
        const actualContext = contextModule || this.tokenToModuleMap.get( name );

        return DIContainer.resolve( name, actualContext );
    }

    getInjectable( name: string, contextModule?: any ): Promise<any>
    {
        return DIContainer.resolve( name, contextModule );
    }

    async resolveAll(): Promise<void>
    {
        await DIContainer.resolveAll();
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
        this.resolving.clear();
        this.initPromises.clear();
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
    }

    resolve( token: string, contextModule?: any ): Promise<any>
    {
        return DIContainer.resolve( token, contextModule );
    }

    getResolvedScope( token: string, contextModule?: any, visited = new Set<string>()): Scope
    {
        return DIContainer.getResolvedScope( token, contextModule, visited );
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
                ...Object.values( DIContainer.collectPropertyDeps( cls ) || {})
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
        await DIContainer.destroyInstances( this.ephemeralInstances );
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
    return registryAls.run( registry, fn );
}

export function getRegistry(): ApplicationRegistry
{
    const registry = registryAls.getStore();

    if( !registry )
    {
        throw new Error( 'No ApplicationRegistry in context. Call Server.start()/fetch() or runWithRegistry() first.' );
    }

    return registry;
}

export function tryGetRegistry(): ApplicationRegistry | undefined
{
    return registryAls.getStore();
}
