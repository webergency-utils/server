import ts from 'typescript';

/**
 * Everything the AOT pass learns about a program: which classes exist and where, the
 * endpoints found on them, and the validator expressions to emit. One registry is shared
 * across the whole program so a validator is built once and reused by every file.
 */
export interface ProjectRegistry {
    controllers       : Map<string, { path : string, injections : Map<string, string> }>
    providers         : Map<string, { path : string }>
    modules           : Map<string, { path : string }>
    guards            : Map<string, { path : string, params? : any[] }>
    interceptors      : Map<string, { path : string }>
    endpoints         : any[]
    validators        : Map<string, ts.Expression>
    externalManifests : Set<string>
}

export function createRegistry(): ProjectRegistry 
{
    return {
        controllers       : new Map(),
        providers         : new Map(),
        modules           : new Map(),
        guards            : new Map(),
        interceptors      : new Map(),
        endpoints         : [],
        validators        : new Map(),
        externalManifests : new Set()
    };
}
