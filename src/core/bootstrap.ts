import { ApplicationRegistry } from './registry.js';
import {
    getControllerMeta,
    getInjectableMeta,
    getModuleMeta,
    setInjectableMeta,
    EndpointDefinition
} from './symbols.js';
import type { EndpointMetadata } from './types.js';

export type BootstrapOptions =
{
    module?        : any | any[]
    controllers?   : any[]
    providers?     : any[]
    guards?        : any[]
    interceptors?  : any[]
    responseMode?  : 'strict' | 'relaxed' | 'strip'
};

/**
 * Walk the module/controller graph, ingest Symbol.for AOT meta into the registry.
 * Fail-fast if a declared controller host has no AOT controller meta.
 */
export function bootstrapRegistry( registry: ApplicationRegistry, options: BootstrapOptions ): void
{
    if( options.responseMode )
    {
        registry.setDefaultResponseMode( options.responseMode );
    }

    const activeControllers = new Set<string>();
    const visitedModules = new Set<any>();

    if( options.module )
    {
        const modules = Array.isArray( options.module ) ? options.module : [options.module];

        for( const mod of modules )
        {
            collectModule( registry, mod, activeControllers, visitedModules );
        }
    }
    else
    {
        if( options.controllers )
        {
            for( const ctrl of options.controllers )
            {
                ingestControllerHost( registry, ctrl, activeControllers, undefined );
            }
        }

        if( options.providers )
        {
            for( const provider of options.providers )
            {
                ingestProviderHost( registry, provider, undefined );
            }
        }
    }

    // Top-level guards/interceptors apply with or without a module graph.
    if( options.guards )
    {
        for( const guard of options.guards )
        {
            ingestGuardHost( registry, guard, undefined );
        }
    }

    if( options.interceptors )
    {
        for( const interceptor of options.interceptors )
        {
            ingestInterceptorHost( registry, interceptor, undefined );
        }
    }

    if( registry.missingAotHosts.length > 0 )
    {
        const hosts = [...new Set( registry.missingAotHosts )].join( ', ' );
        throw new Error(
            `Missing AOT metadata for: ${hosts}. Compile with webergency-tsc (or @webergency-utils/server/register) so Symbol.for meta is emitted.`
        );
    }

    // When no module/controllers filter was used but endpoints were manually registered, keep them all.
    void activeControllers;
}

function collectModule(
    registry: ApplicationRegistry,
    moduleOrDynamic: any,
    activeControllers: Set<string>,
    visited: Set<any>
): any
{
    if( !moduleOrDynamic ){ return null }

    let moduleClass = moduleOrDynamic;
    let dynamicExtra: any = null;

    if( typeof moduleOrDynamic === 'object' && 'module' in moduleOrDynamic )
    {
        moduleClass = moduleOrDynamic.module;
        dynamicExtra = moduleOrDynamic;
    }

    if( typeof moduleClass !== 'function' ){ return null }

    if( visited.has( moduleClass ))
    {
        return registry.getModuleInstance( moduleClass );
    }
    visited.add( moduleClass );

    const baseMeta = getModuleMeta( moduleClass );

    if( !baseMeta && !dynamicExtra )
    {
        registry.missingAotHosts.push( moduleClass.name || 'AnonymousModule' );

        return null;
    }

    const meta =
    {
        ...( baseMeta || {} ),
        ...( dynamicExtra || {} ),
        global : !!( baseMeta?.global || moduleClass.__isGlobal__ || dynamicExtra?.global )
    };

    const name = moduleClass.name || 'AnonymousModule';
    registry.registerModule( name, moduleClass );
    const moduleInstance = registry.createModuleInstance( name, moduleClass );

    // Modules are injectable by name (existing DI behaviour)
    registry.registerProvider( name, moduleClass );
    moduleInstance.providers.set( name, moduleClass );
    registry.mapClassToModule( moduleClass, moduleInstance );
    registry.mapTokenToModule( name, moduleInstance );

    if( meta.global )
    {
        registry.registerGlobalModule( moduleInstance );
    }

    if( meta.providers )
    {
        for( const provider of meta.providers )
        {
            ingestProviderHost( registry, provider, moduleInstance );
        }
    }

    if( meta.guards )
    {
        for( const guard of meta.guards )
        {
            ingestGuardHost( registry, guard, moduleInstance );
        }
    }

    if( meta.interceptors )
    {
        for( const interceptor of meta.interceptors )
        {
            ingestInterceptorHost( registry, interceptor, moduleInstance );
        }
    }

    if( meta.controllers )
    {
        for( const ctrl of meta.controllers )
        {
            ingestControllerHost( registry, ctrl, activeControllers, moduleInstance );
        }
    }

    if( meta.exports )
    {
        for( const exp of meta.exports )
        {
            const expName = typeof exp === 'string' ? exp : ( exp.name || exp );
            moduleInstance.exports.add( expName );
        }
    }

    if( meta.imports )
    {
        for( const imp of meta.imports )
        {
            const impInstance = collectModule( registry, imp, activeControllers, visited );

            if( impInstance )
            {
                moduleInstance.imports.add( impInstance );
            }
        }
    }

    return moduleInstance;
}

function resolveProviderToken( provider: any ): { token: string, actual: any }
{
    if( provider && typeof provider === 'object' && 'token' in provider )
    {
        const token = typeof provider.token === 'string' ? provider.token : provider.token?.name;

        return { token, actual : provider };
    }

    const token = provider?.name || provider;

    return { token, actual : provider };
}

function ingestProviderHost( registry: ApplicationRegistry, provider: any, moduleInstance: any | undefined )
{
    const { token, actual } = resolveProviderToken( provider );

    if( !token ){ return }

    if( typeof actual === 'function' )
    {
        const inj = getInjectableMeta( actual );

        // Providers may only have __injections__ from AOT without injectable Symbol — still register
        if( !inj && !actual.__injections__ && !actual.__scope__ )
        {
            // Allow plain @Injectable() classes that only set __scope__ at runtime; AOT sets WEBERGENCY_INJECTABLE
            // Missing both AOT injectable and runtime scope is OK for bare classes used as providers
        }

        if( !inj )
        {
            setInjectableMeta( actual, { kind : 'provider', token });
        }
    }

    if( moduleInstance )
    {
        moduleInstance.providers.set( token, actual );

        if( typeof actual === 'function' )
        {
            registry.mapClassToModule( actual, moduleInstance );
        }
        registry.mapTokenToModule( token, moduleInstance );
    }

    registry.registerProvider( token, actual );
}

function ingestGuardHost( registry: ApplicationRegistry, guard: any, moduleInstance: any | undefined )
{
    const name = guard?.name || guard;

    if( typeof guard === 'function' )
    {
        const inj = getInjectableMeta( guard );

        if( !inj )
        {
            setInjectableMeta( guard, { kind : 'guard', token : name });
        }
    }

    if( moduleInstance )
    {
        moduleInstance.providers.set( name, guard );
        registry.mapClassToModule( guard, moduleInstance );
        registry.mapTokenToModule( name, moduleInstance );
    }

    registry.registerGuard( name, guard );
}

function ingestInterceptorHost( registry: ApplicationRegistry, interceptor: any, moduleInstance: any | undefined )
{
    const name = interceptor?.name || interceptor;

    if( typeof interceptor === 'function' )
    {
        const inj = getInjectableMeta( interceptor );

        if( !inj )
        {
            setInjectableMeta( interceptor, { kind : 'interceptor', token : name });
        }
    }

    if( moduleInstance )
    {
        moduleInstance.providers.set( name, interceptor );
        registry.mapClassToModule( interceptor, moduleInstance );
        registry.mapTokenToModule( name, moduleInstance );
    }

    registry.registerInterceptor( name, interceptor );
}

function ingestControllerHost(
    registry: ApplicationRegistry,
    ctrl: any,
    activeControllers: Set<string>,
    moduleInstance: any | undefined
)
{
    // Support test pattern: plain object instance already registered — skip
    if( ctrl && typeof ctrl === 'object' && typeof ctrl !== 'function' )
    {
        return;
    }

    if( typeof ctrl !== 'function' ){ return }

    const ctrlName = ctrl.name || 'AnonymousController';
    activeControllers.add( ctrlName );

    const aot = getControllerMeta( ctrl );

    if( !aot )
    {
        registry.missingAotHosts.push( ctrlName );

        return;
    }

    if( moduleInstance )
    {
        moduleInstance.controllers.set( ctrlName, ctrl );
        registry.mapClassToModule( ctrl, moduleInstance );
        registry.mapTokenToModule( ctrlName, moduleInstance );
    }

    registry.registerController( ctrlName, ctrl );

    const inj = getInjectableMeta( ctrl );

    if( !inj )
    {
        setInjectableMeta( ctrl, { kind : 'controller', token : ctrlName, scope : aot.scope });
    }

    for( const ep of aot.endpoints )
    {
        registerEndpointDef( registry, ctrlName, ep );
    }
}

function registerEndpointDef( registry: ApplicationRegistry, controllerName: string, ep: EndpointDefinition )
{
    const metadata: EndpointMetadata =
    {
        ...ep,
        controller : controllerName,
        params     : ep.params || [],
        guards     : ep.guards || [],
        interceptors : ep.interceptors || [],
        meta       : ep.meta || {}
    } as EndpointMetadata;

    registry.registerEndpoint( metadata );
}
