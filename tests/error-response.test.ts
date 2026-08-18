import { describe, it, expect } from 'vitest';
import { ForbiddenError, InternalServerError } from '../src/errors.js';
import { REDACTED, clientErrorBody, errorLogFields, redactSecrets } from '../src/helpers/error-response.js';

describe( 'redactSecrets', () =>
{
    it( 'should replace password fields and leave other keys', () =>
    {
        const redacted = redactSecrets({
            name            : 'Ada',
            password        : 'secret',
            confirmPassword : 'secret',
            nested          : { password : 'inner', ok : true }
        });

        expect( redacted ).toEqual({
            name            : 'Ada',
            password        : REDACTED,
            confirmPassword : REDACTED,
            nested          : { password : REDACTED, ok : true }
        });
    });
});

describe( 'clientErrorBody', () =>
{
    it( 'should keep custom data and drop stack', () =>
    {
        const err = new ForbiddenError( 'queued', { code : 'approvalRequired', stack : 'Error: leaked' });

        expect( clientErrorBody( err, 403 ) ).toEqual({
            code : 'approvalRequired'
        });
    });

    it( 'should redact secrets and hide debug on 5xx', () =>
    {
        const err = new InternalServerError( 'boom', { password : 'secret', debug : { sql : 'select 1' }, stack : 'x' });

        expect( clientErrorBody( err, 500 ) ).toEqual({
            password : REDACTED
        });
    });
});

describe( 'errorLogFields', () =>
{
    it( 'should keep stack for operators and redact data', () =>
    {
        const err = new InternalServerError( 'boom', { password : 'secret' });
        const fields = errorLogFields( err );

        expect( fields.message ).toBe( 'boom' );
        expect( fields.status ).toBe( 500 );
        expect( fields.data ).toEqual({ password : REDACTED });
        expect( fields.stack ).toEqual( expect.any( String ) );
    });
});
