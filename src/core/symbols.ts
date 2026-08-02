import type { EndpointMetadata } from './types.js';
import type { Scope } from '../decorators.js';

/** Well-known Symbol.for keys for AOT metadata attached to classes / methods. */
export const WEBERGENCY_CONTROLLER = Symbol.for( 'webergency.server.controller' );
export const WEBERGENCY_MODULE = Symbol.for( 'webergency.server.module' );
export const WEBERGENCY_INJECTABLE = Symbol.for( 'webergency.server.injectable' );
export const WEBERGENCY_METADATA = Symbol.for( 'webergency.server.metadata' );

export type ControllerAotMeta =
{
    prefix?   : string
    scope?    : Scope
    endpoints : EndpointDefinition[]
};

/** Endpoint as stored on the controller class (controller name filled at bootstrap). */
export type EndpointDefinition = Omit<EndpointMetadata, 'controller'> & {
    controller? : string
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
};

export type InjectableAotMeta =
{
    kind   : 'provider' | 'guard' | 'interceptor' | 'controller'
    token  : string
    scope? : Scope
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
