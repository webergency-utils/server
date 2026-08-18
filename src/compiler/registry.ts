import ts from 'typescript';

/**
 * Everything the AOT pass learns about a program: which classes exist and where, the
 * endpoints found on them, and the validator/parser/serializer expressions to emit. One
 * registry is shared across the whole program so each expression is built once and reused.
 */
export type ModuleGraphInfo =
{
    path          : string
    global?       : boolean
    /** Original decorator array elements — emit must reuse these nodes so import aliases resolve. */
    controllers?  : ts.Expression[]
    providers?    : ts.Expression[]
    guards?       : ts.Expression[]
    interceptors? : ts.Expression[]
    imports?      : ts.Expression[]
    exports?      : ts.Expression[]
    files?        : any
    reviver?      : any
};

export interface ProjectRegistry {
    controllers       : Map<string, { path : string, injections : Map<string, string> }>
    providers         : Map<string, { path : string, scope? : number }>
    modules           : Map<string, ModuleGraphInfo>
    guards            : Map<string, { path : string, params? : any[], isAsync? : boolean }>
    interceptors      : Map<string, { path : string }>
    endpoints         : any[]
    validators        : Map<string, ts.Expression>
    parsers           : Map<string, ts.Expression>
    serializers       : Map<string, ts.Expression>
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
        parsers           : new Map(),
        serializers       : new Map(),
        externalManifests : new Set()
    };
}
