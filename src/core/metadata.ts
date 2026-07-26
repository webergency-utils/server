/**
 * @deprecated Internal compatibility shim. Prefer ApplicationRegistry + getRegistry().
 * Removed from the public package API in 0.2.0.
 */
import { ApplicationRegistry, getRegistry, tryGetRegistry, runWithRegistry } from './registry.js';
import { EndpointMetadata } from './types.js';
import { Scope } from '../decorators.js';

export { ApplicationRegistry, getRegistry, tryGetRegistry, runWithRegistry };

/**
 * Legacy static facade that delegates to the active ApplicationRegistry (ALS).
 * Used only where call sites have not yet been migrated; not part of the public API.
 */
export class MetadataStore
{
    public static registerEndpoint( metadata: EndpointMetadata )
    {
        getRegistry().registerEndpoint( metadata );
    }

    public static getEndpoints(): EndpointMetadata[]
    {
        return getRegistry().getEndpoints();
    }

    public static registerProvider( token: string, provider: any )
    {
        getRegistry().registerProvider( token, provider );
    }

    public static getProvider( token: string ): any
    {
        return getRegistry().getProvider( token );
    }

    public static registerModule( name: string, moduleClass: any )
    {
        getRegistry().registerModule( name, moduleClass );
    }

    public static getModule( name: string ): any
    {
        return getRegistry().getModule( name );
    }

    public static getModuleInstance( moduleClass: any ): any
    {
        return getRegistry().getModuleInstance( moduleClass );
    }

    public static createModuleInstance( name: string, moduleClass: any ): any
    {
        return getRegistry().createModuleInstance( name, moduleClass );
    }

    public static getModuleInstances(): any[]
    {
        return getRegistry().getModuleInstances();
    }

    public static mapClassToModule( cls: any, moduleInstance: any )
    {
        getRegistry().mapClassToModule( cls, moduleInstance );
    }

    public static getClassModule( cls: any ): any
    {
        return getRegistry().getClassModule( cls );
    }

    public static mapTokenToModule( token: string, moduleInstance: any )
    {
        getRegistry().mapTokenToModule( token, moduleInstance );
    }

    public static getTokenModule( token: string ): any
    {
        return getRegistry().getTokenModule( token );
    }

    public static registerGlobalModule( moduleInstance: any )
    {
        getRegistry().registerGlobalModule( moduleInstance );
    }

    public static getGlobalModules(): any[]
    {
        return getRegistry().getGlobalModules();
    }

    public static registerController( name: string, classOrInstance: any )
    {
        getRegistry().registerController( name, classOrInstance );
    }

    public static getController( name: string, contextModule?: any ): any
    {
        return getRegistry().getController( name, contextModule );
    }

    public static registerGuard( name: string, classOrInstance: any )
    {
        getRegistry().registerGuard( name, classOrInstance );
    }

    public static getGuard( name: string, contextModule?: any ): any
    {
        return getRegistry().getGuard( name, contextModule );
    }

    public static registerInterceptor( name: string, classOrInstance: any )
    {
        getRegistry().registerInterceptor( name, classOrInstance );
    }

    public static getInterceptor( name: string, contextModule?: any ): any
    {
        return getRegistry().getInterceptor( name, contextModule );
    }

    public static getInjectable( name: string, contextModule?: any ): any
    {
        return getRegistry().getInjectable( name, contextModule );
    }

    public static resolveAll()
    {
        getRegistry().resolveAll();
    }

    public static clear()
    {
        const reg = tryGetRegistry();

        if( reg )
        {
            reg.clear();
        }
    }

    public static resolve( token: string, contextModule?: any ): any
    {
        return getRegistry().resolve( token, contextModule );
    }

    public static getResolvedScope( token: string, contextModule?: any, visited = new Set<string>()): Scope
    {
        return getRegistry().getResolvedScope( token, contextModule, visited );
    }

    public static getAllInstances(): any[]
    {
        return getRegistry().getAllInstances();
    }

    public static async invokeHook( hookName: string, ...args: any[])
    {
        return getRegistry().invokeHook( hookName, ...args );
    }

    public static setDefaultResponseMode( mode: 'strict' | 'relaxed' | 'strip' )
    {
        getRegistry().setDefaultResponseMode( mode );
    }

    public static getDefaultResponseMode(): 'strict' | 'relaxed' | 'strip'
    {
        return getRegistry().getDefaultResponseMode();
    }
}

/** @deprecated — use ApplicationRegistry fields via getRegistry() */
export const store =
{
    get endpoints() { return getRegistry().endpoints },
    get controllers() { return getRegistry().controllers },
    get guards() { return getRegistry().guards },
    get interceptors() { return getRegistry().interceptors },
    get providers() { return getRegistry().providers },
    get modules() { return getRegistry().modules },
    get instances() { return getRegistry().instances },
    get resolving() { return getRegistry().resolving },
    get controllerClasses() { return getRegistry().controllerClasses },
    get guardClasses() { return getRegistry().guardClasses },
    get interceptorClasses() { return getRegistry().interceptorClasses },
    get moduleInstances() { return getRegistry().moduleInstances },
    get classToModuleMap() { return getRegistry().classToModuleMap },
    get tokenToModuleMap() { return getRegistry().tokenToModuleMap },
    get globalModules() { return getRegistry().globalModules },
    get defaultResponseMode() { return getRegistry().defaultResponseMode },
    set defaultResponseMode( v: any ) { getRegistry().defaultResponseMode = v }
};
