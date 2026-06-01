import { describe, it, expect, beforeAll } from 'vitest';
import { Server, MetadataStore, Interceptor } from '../../index.js';
import { runAot } from './build.js';



describe( 'AOT Interceptor Error Sanitization', () => 
{
    let server: Server;

    beforeAll( async () => 
    {
        // Build AOT
        const manifestPath = runAot();
        MetadataStore.clear();

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
