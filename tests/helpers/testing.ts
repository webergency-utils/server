/**
 * In-repo test helpers for attaching AOT-shaped Symbol meta without running the compiler.
 * Not a public package export.
 */
import {
    setControllerMeta,
    setInjectableMeta,
    setModuleMeta,
    EndpointDefinition,
    ControllerAotMeta
}
from '../../src/core/symbols.js';
import { ApplicationRegistry, runWithRegistry } from '../../src/core/registry.js';
import type { EndpointMetadata } from '../../src/core/types.js';

export { ApplicationRegistry, runWithRegistry };
export {
    setControllerMeta,
    setInjectableMeta,
    setModuleMeta,
    WEBERGENCY_CONTROLLER,
    WEBERGENCY_MODULE,
    WEBERGENCY_INJECTABLE,
    WEBERGENCY_METADATA
}
from '../../src/core/symbols.js';

/** Attach controller endpoint meta as the AOT transformer would. */
export function defineController(
    cls: any,
    endpoints: EndpointDefinition[],
    extra?: Partial<ControllerAotMeta>
)
{
    const name = cls.name || 'AnonymousController';
    setControllerMeta( cls, {
        ...extra,
        endpoints : endpoints.map( ep => ({
            ...ep,
            params       : ep.params ?? [],
            guards       : ep.guards ?? [],
            interceptors : ep.interceptors ?? [],
            meta         : ep.meta ?? {},
            controller   : name
        }))
    });
    setInjectableMeta( cls, { kind : 'controller', token : name, scope : extra?.scope });
}

/**
 * Seed a Server's registry with a plain instance controller (legacy unit-test style).
 * Prefer defineController + class hosts for new tests.
 */
export function seedInstanceController(
    registry: ApplicationRegistry,
    name: string,
    instance: any,
    endpoints: Omit<EndpointMetadata, 'controller'>[]
)
{
    runWithRegistry( registry, () =>
    {
        registry.registerController( name, instance );

        for( const ep of endpoints )
        {
            registry.registerEndpoint({
                ...ep,
                params       : ep.params ?? [],
                guards       : ep.guards ?? [],
                interceptors : ep.interceptors ?? [],
                meta         : ep.meta ?? {},
                controller   : name
            } as EndpointMetadata );
        }
    });
}
