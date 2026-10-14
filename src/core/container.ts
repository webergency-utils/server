import { ApplicationRegistry, Binding, getRegistry, scopedKey } from './registry.js';
import { Scope } from '../decorators.js';

export type { Binding };
export { scopedKey };

/**
 * Static facade over the active `ApplicationRegistry`'s dependency-injection container.
 */
export class DIContainer
{
    public static collectPropertyDeps( cls: any ): Record<string, string>
    {
        return ApplicationRegistry.collectPropertyDeps( cls );
    }

    public static locateProviderInScope( token: string, moduleInstance: any, visited = new Set<any>()): any
    {
        return getRegistry().locateProviderInScope( token, moduleInstance, visited );
    }

    public static isExportedFromModule( token: string, moduleInstance: any, visited = new Set<any>()): boolean
    {
        return getRegistry().isExportedFromModule( token, moduleInstance, visited );
    }

    public static instantiateProvider( token: string, provider: any, contextModule: any ): Promise<any>
    {
        return getRegistry().instantiateProvider( token, provider, contextModule );
    }

    public static destroyInstance( instance: any ): Promise<void>
    {
        return ApplicationRegistry.destroyInstance( instance );
    }

    public static destroyInstances( instances: Iterable<any> ): Promise<void>
    {
        return ApplicationRegistry.destroyInstances( instances );
    }

    public static syncLegacyCompatibility( token: string, instance: any )
    {
        getRegistry().syncLegacyCompatibility( token, instance );
    }

    public static getBinding( token: string, contextModule?: any ): Binding | null
    {
        return getRegistry().getBinding( token, contextModule );
    }

    public static getResolvedScope( token: string, contextModule?: any, visited = new Set<string>()): Scope
    {
        return getRegistry().getResolvedScope( token, contextModule, visited );
    }

    public static resolveAll(): Promise<void>
    {
        return getRegistry().resolveAll();
    }

    public static resolve( token: string, contextModule?: any ): Promise<any>
    {
        return getRegistry().resolve( token, contextModule );
    }
}