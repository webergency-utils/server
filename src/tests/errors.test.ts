import { describe, it, expect } from 'vitest';
import {
    ServerError,
    HTTPServerError,
    BadRequestError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ConflictError,
    PreconditionFailedError,
    RateLimitError,
    InternalServerError,
    ServiceUnavailableError,
    httpStatusFromError
} from '../errors.js';

describe( 'Errors', () =>
{
    it( 'should create a basic ServerError', () =>
    {
        const err = new ServerError( 500, 'Basic Error', { foo : 'bar' }, { debug : true });
        expect( err.code ).toBe( 500 );
        expect( err.status ).toBe( 500 );
        expect( err.message ).toBe( 'Basic Error' );
        expect( err.data ).toEqual({ foo : 'bar' });
        expect( err.debug ).toEqual({ debug : true });
    });

    it( 'should create HTTPServerError with auto-message', () =>
    {
        const err = new HTTPServerError( 404 );
        expect( err.code ).toBe( 404 );
        expect( err.status ).toBe( 404 );
        expect( err.message ).toBe( 'Not Found' );
    });

    it( 'should create HTTPServerError with custom message', () =>
    {
        const err = new HTTPServerError( 404, 'Custom Not Found' );
        expect( err.code ).toBe( 404 );
        expect( err.message ).toBe( 'Custom Not Found' );
    });

    it( 'should create HTTPServerError with fallback message', () =>
    {
        const err = new HTTPServerError( 999 );
        expect( err.message ).toBe( 'HTTP Error' );
    });

    it( 'should support all specialized error classes', () =>
    {
        expect( new BadRequestError().code ).toBe( 400 );
        expect( new BadRequestError( 'Custom' ).message ).toBe( 'Custom' );
        expect( new BadRequestError({ data : 1 }).data ).toEqual({ data : 1 });

        expect( new UnauthorizedError().code ).toBe( 401 );
        expect( new ForbiddenError().code ).toBe( 403 );
        expect( new NotFoundError().code ).toBe( 404 );
        expect( new NotFoundError().status ).toBe( 404 );
        expect( new ConflictError().code ).toBe( 409 );
        expect( new PreconditionFailedError().code ).toBe( 412 );
        expect( new RateLimitError().code ).toBe( 429 );
        expect( new InternalServerError().code ).toBe( 500 );
        expect( new ServiceUnavailableError().code ).toBe( 503 );
    });

    it( 'should resolve HTTP status from status, code, or default 500', () =>
    {
        expect( httpStatusFromError( new NotFoundError())).toBe( 404 );
        expect( httpStatusFromError( Object.assign( new Error( 'x' ), { status : 415 }))).toBe( 415 );
        expect( httpStatusFromError( Object.assign( new Error( 'x' ), { code : 429 }))).toBe( 429 );
        expect( httpStatusFromError( new Error( 'plain' ))).toBe( 500 );
        expect( httpStatusFromError( null )).toBe( 500 );
    });
});
