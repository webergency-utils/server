import { describe, it, expect, beforeAll } from 'vitest';
import { Server, MetadataStore, Interceptor } from '../../index.js';
import { runAot } from './build.js';

// 1. Define the Sanitizer Interceptor
class GlobalErrorSanitizer implements Interceptor 
{
    async intercept( req: any, next: Function ) 
    {
        const response = await next();
        
        // If we detect a validation error (400)
        if( response.status === 400 ) 
        {
            const clone = response.clone();
            try 
            {
                const data = await clone.json();

                if( data.success === false && data.errors ) 
                {
                    // Hide details and return a generic 500 as requested
                    return new Response( JSON.stringify({ 
                        success : false, 
                        message : 'Internal Server Error' 
                    }), { 
                        status  : 500,
                        headers : { 'Content-Type' : 'application/json' }
                    });
                }
            }
            catch ( e ) 
            {
                // Not JSON, ignore
            }
        }
        
        return response;
    }
}

describe( 'AOT Interceptor Error Sanitization', () => 
{
    let server: Server;

    beforeAll( async () => 
    {
        // Build AOT
        const manifestPath = runAot();
        MetadataStore.clear();
        
        // Register the global interceptor
        MetadataStore.registerInterceptor( 'GlobalErrorSanitizer', new GlobalErrorSanitizer());
        
        // Import manifest
        await import( `file://${manifestPath}?t=${Date.now()}` );
        
        server = new Server({ port : 3001 });
        ( server as any ).init();
    });

    it( 'should sanitize validation errors using interceptor', async () => 
    {
        // Send invalid data to an endpoint that usually returns 400 with details
        const res = await server.fetch( new Request( 'http://localhost/type-safety/strict-intercepted', {
            method  : 'POST',
            body    : JSON.stringify({ name : 'John', age : 'invalid' }), // Should be number
            headers : { 'Content-Type' : 'application/json' }
        }));

        // The interceptor should have caught the 400 and returned 500
        expect( res.status ).toBe( 500 );
        
        const data = await res.json();
        expect( data.success ).toBe( false );
        expect( data.message ).toBe( 'Internal Server Error' );
        expect( data.errors ).toBeUndefined(); // Details are hidden!
    });
});
