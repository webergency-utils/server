import { ApplicationRegistry, runWithRegistry } from '../src/core/registry.js';
import { Context } from '../src/core/context.js';
import { Scope } from '../src/decorators.js';
import { createBench, report } from './support.js';

class Config
{
    static __scope__ = Scope.DEFAULT;
    static __injections__ = { constructorDeps : [], propertyDeps : {} };
    retries = 3;
}

/** All three hosts share one dependency shape so the numbers only differ by scope. */
class DefaultService
{
    static __scope__ = Scope.DEFAULT;
    static __injections__ = { constructorDeps : [ 'Config' ], propertyDeps : {} };
    config : Config;
    constructor( config: Config ){ this.config = config }
}

class TransientService
{
    static __scope__ = Scope.TRANSIENT;
    static __injections__ = { constructorDeps : [ 'Config' ], propertyDeps : {} };
    config : Config;
    constructor( config: Config ){ this.config = config }
}

class RequestService
{
    static __scope__ = Scope.REQUEST;
    static __injections__ = { constructorDeps : [ 'Config' ], propertyDeps : {} };
    config : Config;
    constructor( config: Config ){ this.config = config }
}

function seed(): ApplicationRegistry
{
    const registry = new ApplicationRegistry();

    registry.registerProvider( 'Config', Config );
    registry.registerProvider( 'DefaultService', DefaultService );
    registry.registerProvider( 'TransientService', TransientService );
    registry.registerProvider( 'RequestService', RequestService );

    return registry;
}

export async function diSuite(): Promise<void>
{
    const registry = seed();
    const requestInstances = new Map<string, any>();
    const bench = createBench();

    bench
        .add( 'resolve default-scoped', () => registry.resolve( 'DefaultService' ))
        .add( 'resolve transient-scoped', () => registry.resolve( 'TransientService' ))
        .add( 'resolve request-scoped', () =>
        {
            // A request resolves each token once, so dropping the cache keeps construction on the measured path.
            requestInstances.clear();

            return registry.resolve( 'RequestService' );
        });

    await runWithRegistry( registry, () =>
    {
        return Context.run(
            { request : {} as any, metadata : {} as any, requestInstances },
            () => report( 'DI resolution by scope', bench )
        );
    });
}
