import { parseQueryString, reviveTree } from '@webergency-utils/typechecker/runtime';

/**
 * JSON.parse-style reviver: `( key, value ) => any`.
 * Applied after wire parse for both `from: 'json'` and `from: 'query'`.
 */
export type Reviver = ( key: string, value: any ) => any;

/**
 * Nearest defined layer wins. `undefined` inherits; `null` opts out (no reviver).
 * Pass most-specific first: Endpoint → Module → Server.
 */
export function resolveReviver( ...layers: Array<Reviver | null | undefined> ): Reviver | undefined
{
    for( const layer of layers )
    {
        if( layer !== undefined )
        {
            return layer ?? undefined;
        }
    }

    return undefined;
}

/**
 * Runtime shape of typechecker `parse<any>( text, { from: 'json', reviver } )`:
 * `JSON.parse` then `reviveTree`. Invalid JSON → 400.
 */
export function parseAnyJson( text: string, reviver?: Reviver ): any
{
    let obj: any;

    try
    {
        obj = JSON.parse( text );
    }
    catch
    {
        throw Object.assign( new Error( 'Invalid JSON body' ), { status : 400 });
    }

    return reviver ? reviveTree( obj, reviver ) : obj;
}

/**
 * Runtime shape of typechecker `parse<any>( text, { from: 'query', reviver } )`:
 * `parseQueryString` then `reviveTree`.
 */
export function parseAnyQuery( text: string, reviver?: Reviver ): any
{
    const obj = parseQueryString( text );

    return reviver ? reviveTree( obj, reviver ) : obj;
}

/** `reviveTree` from typechecker when a reviver is set; otherwise the value unchanged. */
export function reviveAny( value: any, reviver?: Reviver ): any
{
    return reviver ? reviveTree( value, reviver ) : value;
}
