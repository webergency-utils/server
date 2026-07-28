import { validators } from '@webergency-utils/typechecker';
import type { IValidationError, ValidationMode } from '@webergency-utils/typechecker';
import { createBench, report } from './support.js';

interface Ctx {
    success : boolean
    errors  : IValidationError[]
    mode    : ValidationMode
}

const USER_KEYS = new Set([ 'name', 'age', 'active' ]);

const user = { name : 'ada', age : 36, active : true };
const query = { page : '2', limit : '25', sort : 'created', q : 'lovelace' };

function context(): Ctx
{
    return { success : true, errors : [], mode : 'strict' };
}

/** Mirrors what the AOT transformer emits for `{ name: string, age: number, active: boolean }`. */
function validateUser( value: any, path: string, ctx: Ctx ): any
{
    const obj = validators.object( value, path, ctx, USER_KEYS, 'User' );

    if( obj === false ){ return value }

    const data = validators.objectShell( obj, ctx );

    validators.props( obj, data, path, ctx, [
        [ 'name', false, validators.string ],
        [ 'age', false, validators.number ],
        [ 'active', false, validators.boolean ]
    ]);
    validators.stripExtras( data, ctx, USER_KEYS );

    return data;
}

/** Mirrors `Record<string, string>` — the shape query parameters arrive in. */
function validateQuery( value: any, path: string, ctx: Ctx ): any
{
    return validators.record( value, path, ctx, validators.string );
}

export async function validatorSuite(): Promise<void>
{
    const bench = createBench();

    bench
        .add( 'object, 3 properties', () => validateUser( user, '', context()))
        .add( 'record, 4 query keys', () => validateQuery( query, '', context()));

    await report( 'Validator throughput', bench );
}
