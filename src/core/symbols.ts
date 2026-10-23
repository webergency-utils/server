import type { EndpointMetadata, GuardMetadata, ParamMetadata } from './types.js';
import type { Scope } from '../decorators.js';
import { Context } from './context.js';

/** Well-known Symbol.for keys for AOT metadata attached to classes / methods. */
export const WEBERGENCY_CONTROLLER = Symbol.for( 'webergency.server.controller' );
export const WEBERGENCY_MODULE = Symbol.for( 'webergency.server.module' );
export const WEBERGENCY_INJECTABLE = Symbol.for( 'webergency.server.injectable' );
export const WEBERGENCY_METADATA = Symbol.for( 'webergency.server.metadata' );
export const WEBERGENCY_GUARD = Symbol.for( 'webergency.server.guard' );
export const WEBERGENCY_BRANCH_SERIALIZERS = Symbol.for( 'webergency.server.branchSerializers' );

export type ControllerAotMeta =
    {
        prefix?   : string
        scope?    : Scope
        endpoints : EndpointDefinition[]
    };

/** Endpoint as stored on the controller class (controller name filled at bootstrap). */
export type EndpointDefinition = Omit<EndpointMetadata, 'controller' | 'params' | 'guards' | 'interceptors' | 'meta'> & {
    controller?   : string
    params?       : ParamMetadata[]
    guards?       : Array<Pick<GuardMetadata, 'type' | 'name'> & Partial<GuardMetadata>>
    interceptors? : string[]
    meta?         : Record<string, any>
};

export type ModuleAotMeta =
    {
        global?       : boolean
        imports?      : any[]
        controllers?  : any[]
        providers?    : any[]
        guards?       : any[]
        interceptors? : any[]
        exports?      : any[]
        files?        : any
        reviver?      : any
    };

export type InjectableAotMeta =
    {
        kind   : 'provider' | 'guard' | 'interceptor' | 'controller'
        token  : string
        scope? : Scope
    };

/** Param AOT for a published guard `use()` — lives on the guard class, not the consumer controller. */
export type GuardAotMeta =
    {
        params   : ParamMetadata[]
        isAsync? : boolean
    };

export function getControllerMeta( target: any ): ControllerAotMeta | undefined
{
    return target?.[WEBERGENCY_CONTROLLER];
}

export function setControllerMeta( target: any, meta: ControllerAotMeta ): void
{
    target[WEBERGENCY_CONTROLLER] = meta;
}

export function getModuleMeta( target: any ): ModuleAotMeta | undefined
{
    // Prefer AOT Symbol; fall back to runtime @Module field for transition in same package tests
    return target?.[WEBERGENCY_MODULE] ?? ( target?.__moduleMetadata__
        ? { ...target.__moduleMetadata__, global : !!target.__isGlobal__ }
        : undefined );
}

export function setModuleMeta( target: any, meta: ModuleAotMeta ): void
{
    target[WEBERGENCY_MODULE] = meta;
}

export function getInjectableMeta( target: any ): InjectableAotMeta | undefined
{
    return target?.[WEBERGENCY_INJECTABLE];
}

export function setInjectableMeta( target: any, meta: InjectableAotMeta ): void
{
    target[WEBERGENCY_INJECTABLE] = meta;
}

export function getGuardMeta( target: any ): GuardAotMeta | undefined
{
    return target?.[WEBERGENCY_GUARD];
}

export function setGuardMeta( target: any, meta: GuardAotMeta ): void
{
    target[WEBERGENCY_GUARD] = meta;
}

export function getCustomMetadataBag( target: any ): Record<string | symbol, any> | undefined
{
    return target?.[WEBERGENCY_METADATA] ?? target?.__metadata__;
}

export function ensureCustomMetadataBag( target: any ): Record<string | symbol, any>
{
    if( !target[WEBERGENCY_METADATA])
    {
        target[WEBERGENCY_METADATA] = target.__metadata__ || {};
    }

    // Keep legacy mirror for any code still reading __metadata__ during migration of call sites
    target.__metadata__ = target[WEBERGENCY_METADATA];

    return target[WEBERGENCY_METADATA];
}

const fallbackBranchSerializers = new WeakMap<object, ( val: any ) => string>();
let fallbackHasEntries = false;

function upgradeBranchSerializersMap( map: WeakMap<object, ( val: any ) => string> ): WeakMap<object, ( val: any ) => string>
{
    if(( map as any ).__webergencyContextAware ){ return map }

    if( map !== fallbackBranchSerializers )
    {
        fallbackHasEntries = true;
    }

    const origGet = map.get.bind( map );
    const origSet = map.set.bind( map );
    const origHas = map.has.bind( map );
    const origDelete = map.delete.bind( map );

    map.get = ( key: object ) => Context.get()?.branchSerializers?.get( key ) ?? ( fallbackHasEntries ? origGet( key ) : undefined );
    map.set = ( key: object, value: ( val: any ) => string ) =>
    {
        const ctx = Context.get();

        if( ctx )
        {
            ( ctx.branchSerializers ?? ( ctx.branchSerializers = new WeakMap())).set( key, value );

            return map;
        }

        fallbackHasEntries = true;

        return origSet( key, value );
    };
    map.has = ( key: object ) => ( Context.get()?.branchSerializers?.has( key ) ?? false ) || ( fallbackHasEntries && origHas( key ));
    map.delete = ( key: object ) =>
    {
        const ctx = Context.get();

        if( ctx?.branchSerializers?.delete( key )){ return true }

        return fallbackHasEntries ? origDelete( key ) : false;
    };
    ( map as any ).__webergencyContextAware = true;

    return map;
}

const contextAwareBranchSerializers = upgradeBranchSerializersMap( fallbackBranchSerializers );
( globalThis as any )[WEBERGENCY_BRANCH_SERIALIZERS] = contextAwareBranchSerializers;

export function hasFallbackBranchSerializers(): boolean
{
    return fallbackHasEntries || ( globalThis as any )[WEBERGENCY_BRANCH_SERIALIZERS] !== contextAwareBranchSerializers;
}

export function getBranchSerializers(): WeakMap<object, ( val: any ) => string>
{
    const current = ( globalThis as any )[WEBERGENCY_BRANCH_SERIALIZERS];

    if( current === contextAwareBranchSerializers )
    {
        return current;
    }

    if( current instanceof WeakMap )
    {
        return upgradeBranchSerializersMap( current as WeakMap<object, ( val: any ) => string> );
    }

    return (( globalThis as any )[WEBERGENCY_BRANCH_SERIALIZERS] = contextAwareBranchSerializers );
}
