const intRE = /^[0-9]+$/;

/** Keys that must never be used as object property paths (prototype pollution). */
function isUnsafeKey( key: string | number ): boolean
{
    return key === '__proto__' || key === 'prototype' || key === 'constructor';
}

function createPlainObject(): Record<string | number, any>
{
    return Object.create( null );
}

const Query = new Proxy( Object, {
    construct : () =>
    {
        const query: any = createPlainObject();

        Object.defineProperty( query, 'assign', {
            value : ( key: string | number, value: any ) =>
            {
                const keys = key.toString().replace( /\]\[/g, '[' ).replace( /]$/, '' ).split( '[' );
                let obj = query, parent, parent_key;

                for( let i = 0; i < keys.length; ++i )
                {
                    let k: string | number = keys[i];

                    if( isUnsafeKey( k )){ return }

                    if( k && intRE.test( k.toString())){ k = parseInt( k ) }
                    else if( k === '' )
                    {
                        k = Array.isArray( obj ) ? obj.length - 1 : Math.max( -1, ...Object.keys( obj ).map( k => intRE.test( k ) ? parseInt( k ) : -1 ));

                        if( k === -1 || i === keys.length - 1 || Object.prototype.hasOwnProperty.call( obj[k] || createPlainObject(), keys[i + 1]))
                        {
                            k += 1;
                        }
                    }

                    if( typeof k === 'string' && Array.isArray( obj ))
                    {
                        parent[parent_key!] = obj = obj.reduce(( o: any, v: any, i: number ) => ( o[i] = v, o ), createPlainObject());
                    }

                    if( i < keys.length - 1 )
                    {
                        if( !obj[k])
                        {
                            obj[k] = ( keys[i + 1] === '' || intRE.test( keys[i + 1])) ? [] : createPlainObject();
                        }

                        if( isUnsafeKey( keys[i + 1])){ return }

                        parent = obj;
                        parent_key = k;
                        obj = obj[k];
                    }
                    else
                    {
                        if( obj[k] !== undefined )
                        {
                            if( Array.isArray( obj[k]))
                            {
                                obj[k].push( value );
                            }
                            else if( typeof obj[k] === 'object' && obj[k] !== null )
                            {
                                obj[k][Math.max( -1, ...Object.keys( obj ).map( k => intRE.test( k ) ? parseInt( k ) : -1 )) + 1] = value;
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
                }
            }
        });

        return query;
    }
});

export class QueryParser
{
    public static parse<T>( querystring: string ): T
    {
        const data = new ( Query as any )();
        let value, pair, last_pair = 0;
        const sep = '&', eq = '=';

        if( !querystring ){ return data as T }

        do
        {
            pair = querystring.indexOf( sep, last_pair );

            if( pair === -1 ){ pair = querystring.length }

            if( pair - last_pair > 1 )
            {
                if( ~( value = querystring.indexOf( eq, last_pair )) && value < pair )
                {
                    data.assign(
                        decodeURIComponent( querystring.substring( last_pair, value ).replace( /\+/g, ' ' )),
                        decodeURIComponent( querystring.substring( value + 1, pair ).replace( /\+/g, ' ' ))
                    );
                }
                else
                {
                    data.assign( decodeURIComponent( querystring.substring( last_pair, pair ).replace( /\+/g, ' ' )), true );
                }
            }

            last_pair = pair + 1;
        }
        while( last_pair < querystring.length );

        return data as T;
    }
}
