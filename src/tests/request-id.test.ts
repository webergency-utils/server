import { describe, it, expect } from 'vitest';
import { resolveRequestId, REQUEST_ID_HEADER } from '../helpers/request-id.js';

describe( 'resolveRequestId', () =>
{
    it( 'should keep a non-empty inbound X-Request-Id', () =>
    {
        // Arrange
        const request = new Request( 'http://localhost/', {
            headers : { [REQUEST_ID_HEADER] : 'client-42' }
        });

        // Act / Assert
        expect( resolveRequestId( request )).toBe( 'client-42' );
    });

    it( 'should mint a UUID when the header is missing', () =>
    {
        // Arrange
        const request = new Request( 'http://localhost/' );

        // Act
        const id = resolveRequestId( request );

        // Assert
        expect( id ).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        );
    });

    it( 'should mint a UUID when the header is blank', () =>
    {
        // Arrange
        const request = new Request( 'http://localhost/', {
            headers : { [REQUEST_ID_HEADER] : '   ' }
        });

        // Act
        const id = resolveRequestId( request );

        // Assert
        expect( id ).not.toBe( '   ' );
        expect( id.length ).toBeGreaterThan( 0 );
    });
});
