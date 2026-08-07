import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { runAot } from './aot/build.js';

const __dirname = path.dirname( fileURLToPath( import.meta.url ));
const swaggerJsonPath = path.resolve( __dirname, 'aot', 'swagger.json' );

describe( 'Swagger/OpenAPI Spec Generator', () => 
{
    beforeAll(() => 
    {
        runAot();
    });
    it( 'should generate a valid swagger.json file', () => 
    {
        expect( fs.existsSync( swaggerJsonPath )).toBe( true );

        const spec = JSON.parse( fs.readFileSync( swaggerJsonPath, 'utf8' ));

        // Check basic metadata
        expect( spec.openapi ).toBe( '3.0.0' );
        expect( spec.info.title ).toBe( 'Webergency Application API' );
        expect( spec.info.version ).toBe( '1.0.0' );

        // Check paths object is present
        expect( spec.paths ).toBeDefined();
    });

    it( 'should map requestBody parameters and schemas correctly', () => 
    {
        const spec = JSON.parse( fs.readFileSync( swaggerJsonPath, 'utf8' ));

        const strictRoute = spec.paths['/type-safety/strict']?.post;
        expect( strictRoute ).toBeDefined();
        expect( strictRoute.summary ).toBe( 'TypeSafetyController.strict' );

        // Check requestBody
        const reqBody = strictRoute.requestBody;
        expect( reqBody.required ).toBe( true );
        const bodySchema = reqBody.content['application/json'].schema;
        expect( bodySchema.type ).toBe( 'object' );
        expect( bodySchema.properties.name.type ).toBe( 'string' );
        expect( bodySchema.properties.age.type ).toBe( 'number' );
        expect( bodySchema.required ).toContain( 'name' );
        expect( bodySchema.required ).toContain( 'age' );

        // Check response
        const resSchema = strictRoute.responses['200'].content['application/json'].schema;
        expect( resSchema.type ).toBe( 'object' );
        expect( resSchema.properties.success.type ).toBe( 'boolean' );
        expect( resSchema.properties.data ).toEqual( bodySchema );
    });

    it( 'should map query parameters and schemas correctly', () => 
    {
        const spec = JSON.parse( fs.readFileSync( swaggerJsonPath, 'utf8' ));

        const tagsRoute = spec.paths['/type-safety/tags']?.get;
        expect( tagsRoute ).toBeDefined();
    
        const params = tagsRoute.parameters;
        expect( params ).toHaveLength( 2 );

        const passParam = params.find(( p: any ) => p.name === 'pass' );
        expect( passParam ).toBeDefined();
        expect( passParam.in ).toBe( 'query' );
        expect( passParam.required ).toBe( true );
        expect( passParam.schema.type ).toBe( 'string' );
        expect( passParam.schema.minLength ).toBe( 8 );

        const ageParam = params.find(( p: any ) => p.name === 'age' );
        expect( ageParam ).toBeDefined();
        expect( ageParam.in ).toBe( 'query' );
        expect( ageParam.required ).toBe( true );
        expect( ageParam.schema.type ).toBe( 'number' );
        expect( ageParam.schema.minimum ).toBe( 18 );
    });

    it( 'should support array queries and union schemas', () => 
    {
        const spec = JSON.parse( fs.readFileSync( swaggerJsonPath, 'utf8' ));

        const arrayQueryRoute = spec.paths['/type-safety/array-query']?.get;
        expect( arrayQueryRoute ).toBeDefined();
        expect( arrayQueryRoute.parameters[0].name ).toBe( 'tags' );
        expect( arrayQueryRoute.parameters[0].schema.type ).toBe( 'array' );
        expect( arrayQueryRoute.parameters[0].schema.items.type ).toBe( 'string' );
    });

    it( 'should omit WS connection routes but document SSE as standard HTTP verb', () => 
    {
        const spec = JSON.parse( fs.readFileSync( swaggerJsonPath, 'utf8' ));

        // WS connection routes are not standard HTTP APIs and should be skipped in Swagger
        expect( spec.paths['/realtime/ws']).toBeUndefined();
        expect( spec.paths['/realtime/ws-params/{room}']).toBeUndefined();

        // SSE is structured as a standard HTTP GET route returning a stream description
        const sseRoute = spec.paths['/realtime/sse']?.get;
        expect( sseRoute ).toBeDefined();
        expect( sseRoute.responses['200'].content['application/json'].schema.description ).toContain( 'Stream' );
    });

    it( 'should map microservice RPC and pattern routes as rpc operations', () => 
    {
        const spec = JSON.parse( fs.readFileSync( swaggerJsonPath, 'utf8' ));

        const sumRoute = spec.paths['math.sum']?.rpc;
        expect( sumRoute ).toBeDefined();
        expect( sumRoute.summary ).toBe( 'MathMicroserviceController.sum' );
        expect( sumRoute.requestBody.content['application/json'].schema.properties.a.type ).toBe( 'number' );
        expect( sumRoute.responses['200'].content['application/json'].schema.type ).toBe( 'number' );
    });

    it( 'should correctly map tag parity constraints for string format and array/number constraints', () => 
    {
        const spec = JSON.parse( fs.readFileSync( swaggerJsonPath, 'utf8' ));

        // Number constraints
        const numberRoute = spec.paths['/tag-parity/number']?.get;
        expect( numberRoute ).toBeDefined();
        const minParam = numberRoute.parameters.find(( p: any ) => p.name === 'min' );
        expect( minParam.schema.exclusiveMinimum ).toBe( 10 );
        const maxParam = numberRoute.parameters.find(( p: any ) => p.name === 'max' );
        expect( maxParam.schema.exclusiveMaximum ).toBe( 20 );
        const multParam = numberRoute.parameters.find(( p: any ) => p.name === 'mult' );
        expect( multParam.schema.multipleOf ).toBe( 5 );

        // String format constraints
        const stringRoute = spec.paths['/tag-parity/string']?.get;
        expect( stringRoute ).toBeDefined();
        const emailParam = stringRoute.parameters.find(( p: any ) => p.name === 'email' );
        expect( emailParam.schema.format ).toBe( 'email' );
        const uuidParam = stringRoute.parameters.find(( p: any ) => p.name === 'uuid' );
        expect( uuidParam.schema.format ).toBe( 'uuid' );

        // Array constraints
        const arrayRoute = spec.paths['/tag-parity/array']?.post;
        expect( arrayRoute ).toBeDefined();
        const arraySchema = arrayRoute.requestBody.content['application/json'].schema;
        expect( arraySchema.minItems ).toBe( 2 );
        expect( arraySchema.maxItems ).toBe( 3 );

        // Unique items constraints
        const uniqueRoute = spec.paths['/tag-parity/unique-array']?.post;
        expect( uniqueRoute ).toBeDefined();
        const uniqueSchema = uniqueRoute.requestBody.content['application/json'].schema;
        expect( uniqueSchema.uniqueItems ).toBe( true );
    });

    it( 'should document @Head and @All routes correctly in Swagger spec', () => 
    {
        const spec = JSON.parse( fs.readFileSync( swaggerJsonPath, 'utf8' ));

        // Check HEAD route
        const headRoute = spec.paths['/type-safety/head-explicit']?.head;
        expect( headRoute ).toBeDefined();
        expect( headRoute.summary ).toBe( 'TypeSafetyController.headExplicit' );

        // Check ALL route mapped to get, post, put, delete, patch
        const allPath = spec.paths['/type-safety/all-verbs'];
        expect( allPath ).toBeDefined();
        expect( allPath.get ).toBeDefined();
        expect( allPath.post ).toBeDefined();
        expect( allPath.put ).toBeDefined();
        expect( allPath.delete ).toBeDefined();
        expect( allPath.patch ).toBeDefined();

        expect( allPath.get.summary ).toBe( 'TypeSafetyController.allVerbs (GET)' );
        expect( allPath.post.summary ).toBe( 'TypeSafetyController.allVerbs (POST)' );
    });
});
