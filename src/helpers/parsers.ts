const intRE = /^[0-9]+$/;

/** Maximum bracket nesting depth when unflattening form/multipart keys (`a[b][c]...`). */
export const MAX_FORM_DEPTH = 32;

/** Maximum numeric bracket index that may allocate a JS Array (`a[0]`..`a[1000]`). Larger indices stay object keys. */
export const MAX_ARRAY_INDEX = 1000;

/** Keys that must never be used as object property paths (prototype pollution). */
function isUnsafeKey( key: string | number ): boolean
{
    return key === '__proto__' || key === 'prototype' || key === 'constructor';
}

function createPlainObject(): Record<string | number, any>
{
    // Ordinary objects: denylist already blocks pollution vectors.
    // Null-prototype objects break instanceof Object / hasOwnProperty for consumers.
    return {};
}

function maxNumericKey( obj: Record<string, unknown> ): number
{
    let max = -1;
    const keys = Object.keys( obj );

    for( let i = 0; i < keys.length; i++ )
    {
        const nk = keys[i];

        if( intRE.test( nk ))
        {
            const parsed = parseInt( nk, 10 );

            if( parsed > max && Number.isSafeInteger( parsed ))
            {
                max = parsed;
            }
        }
    }

    return max;
}

function isBoundedArrayIndexKey( key: string ): boolean
{
    if( !key || !intRE.test( key ))
    {
        return false;
    }

    const parsed = parseInt( key, 10 );

    return parsed >= 0 && parsed <= MAX_ARRAY_INDEX;
}

/**
 * Mutable bag with PHP/Rails-style `assign(key, value)` bracket unflattening.
 * Used by multipart `MultipartPayload.toObject()` (files are not query text).
 */
export type FormBag =
    {
        assign( key: string | number, value: any ): void
        [key: string] : any
    };

function assignLeafValue( obj: any, k: string | number, value: any ): void
{
    if( Object.hasOwn( obj, k ) && obj[k] !== undefined )
    {
        if( Array.isArray( obj[k]))
        {
            obj[k].push( value );
        }
        else if(
            typeof obj[k] === 'object'
            && obj[k] !== null
            && Object.getPrototypeOf( obj[k]) === Object.prototype
        )
        {
            // Nested plain form object — append under a numeric key
            // (e.g. items[name]=first&items=second → { name, 0: second }).
            // Class instances (UploadedFile, …) array-coerce like scalars.
            const nested = obj[k];
            obj[k][maxNumericKey( nested ) + 1] = value;
        }
        else
        {
            ( obj[k] = [obj[k]]).push( value );
        }
    }
    else
    {
        obj[k] = value;
    }
}

function assignFormValue( query: any, key: string | number, value: any ): void
{
    const keyStr = typeof key === 'string' ? key : key.toString();

    if( keyStr.length > 0 && keyStr.indexOf( '[' ) === -1 )
    {
        if( isUnsafeKey( keyStr )){ return }

        assignLeafValue( query, keyStr, value );

        return;
    }

    const rawKeys = keyStr.replace( /\]\[/g, '[' ).replace( /]$/, '' ).split( '[' );
    const keys = rawKeys.length > MAX_FORM_DEPTH
        ? [ ...rawKeys.slice( 0, MAX_FORM_DEPTH - 1 ), rawKeys.slice( MAX_FORM_DEPTH - 1 ).join( '.' ) ]
        : rawKeys;
    let obj = query, parent, parent_key;

    for( let i = 0; i < keys.length; ++i )
    {
        let k: string | number = keys[i];

        if( isUnsafeKey( k )){ return }

        if( typeof k === 'string' && isBoundedArrayIndexKey( k ))
        {
            k = parseInt( k, 10 );
        }
        else if( k === '' )
        {
            k = Array.isArray( obj ) ? obj.length - 1 : maxNumericKey( obj );

            if( k === -1 || i === keys.length - 1 || Object.hasOwn( obj[k] || createPlainObject(), keys[i + 1]))
            {
                k += 1;
            }
        }

        if( typeof k === 'string' && Array.isArray( obj ))
        {
            parent[parent_key!] = obj = obj.reduce(( o: any, v: any, idx: number ) => ( o[idx] = v, o ), createPlainObject());
        }

        if( i < keys.length - 1 )
        {
            const nextKey = keys[i + 1];

            if( isUnsafeKey( nextKey )){ return }

            if( !Object.hasOwn( obj, k ) || !obj[k])
            {
                obj[k] = ( nextKey === '' || isBoundedArrayIndexKey( nextKey )) ? [] : createPlainObject();
            }

            parent = obj;
            parent_key = k;
            obj = obj[k];
        }
        else
        {
            assignLeafValue( obj, k, value );
        }
    }
}

/** Empty form bag with the same `assign` semantics as urlencoded query parsing. */
export function createFormBag(): FormBag
{
    const query: any = createPlainObject();

    Object.defineProperty( query, 'assign', {
        value : ( key: string | number, value: any ) => assignFormValue( query, key, value )
    });

    return query;
}
