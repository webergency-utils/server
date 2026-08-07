/**
 * In-repo helper for runtime adapter scripts (not a package export).
 */
import { runWithRegistry } from '../dist/index.js';

export function seedInstanceController( registry, name, instance, endpoints )
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
            });
        }
    });
}
