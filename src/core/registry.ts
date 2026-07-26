import { AsyncLocalStorage } from 'async_hooks';
import { EndpointMetadata } from './types.js';
import { Scope } from '../decorators.js';
import { DIContainer } from './container.js';

export class ApplicationRegistry
{
    endpoints          : EndpointMetadata[] = [];
    controllers        = new Map<string, any>();
    guards             = new Map<string, any>();
    interceptors       = new Map<string, any>();
    providers          = new Map<string, any>();
    modules            = new Map<string, any>();
    instances          = new Map<string, any>();
    resolving          = new Set<string>();
    controllerClasses  = new Set<string>();
    guardClasses       = new Set<string>();
    interceptorClasses = new Set<string>();
    moduleInstances    = new Map<any, any>();
    classToModuleMap   = new Map<any, any>();
    tokenToModuleMap   = new Map<string, any>();
    globalModules      = new Set<any>();
    defaultResponseMode? : 'strict' | 'relaxed' | 'strip';
    /** Controllers/providers seen during walk that lacked AOT Symbol meta. */
    missingAotHosts    : string[] = [];
    /** Paths registered (method+path) for duplicate detection. */
    private routeKeys  = new Set<string>();

    registerEndpoint( metadata: EndpointMetadata )
    {
        const key = `${metadata.httpMethod.toUpperCase()} ${metadata.path}`;

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
        this.tokenToModuleMap.set( token, moduleInstance );
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

    getController( name: string, contextModule?: any ): any
    {
        if( this.controllers.has( name ))
        {
            return this.controllers.get( name );
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

    getGuard( name: string, contextModule?: any ): any
    {
        if( this.guards.has( name ))
        {
            return this.guards.get( name );
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

    getInterceptor( name: string, contextModule?: any ): any
    {
        if( this.interceptors.has( name ))
        {
            return this.interceptors.get( name );
        }
        const actualContext = contextModule || this.tokenToModuleMap.get( name );

        return DIContainer.resolve( name, actualContext );
    }

    getInjectable( name: string, contextModule?: any ): any
    {
        return DIContainer.resolve( name, contextModule );
    }

    resolveAll()
    {
        DIContainer.resolveAll();
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
        this.controllerClasses.clear();
        this.guardClasses.clear();
        this.interceptorClasses.clear();
        this.moduleInstances.clear();
        this.classToModuleMap.clear();
        this.tokenToModuleMap.clear();
        this.globalModules.clear();
        this.routeKeys.clear();
        this.missingAotHosts.length = 0;
        this.defaultResponseMode = undefined;
    }

    resolve( token: string, contextModule?: any ): any
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

    async invokeHook( hookName: string, ...args: any[])
    {
        const instances = this.getAllInstances();

        for( const instance of instances )
        {
            if( instance && typeof instance[hookName] === 'function' )
            {
                await instance[hookName]( ...args );
            }
        }
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
