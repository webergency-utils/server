import { describe, it, expect, vi, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import ts from '../compiler/ts.js';
import { createRegistry } from '../compiler/transformer.js';
import { SwaggerSpecGenerator } from '../compiler/swagger.js';

describe( 'SwaggerSpecGenerator unit', () =>
{
    const temps: string[] = [];

    afterEach( () =>
    {
        for( const f of temps.splice( 0 ))
        {
            if( fs.existsSync( f )){ fs.unlinkSync( f ) }
        }
        vi.restoreAllMocks();
    });

    it( 'should document Param, object Query, RawBody, Promise returns, and $defs', () =>
    {
        // Arrange
        const dir = fs.mkdtempSync( path.join( os.tmpdir(), 'swagger-unit-' ));
        const ctrlPath = path.join( dir, 'DocController.ts' );
        temps.push( ctrlPath );
        fs.writeFileSync( ctrlPath, `
            export interface Nested { id: string }
            export interface QueryShape { a: string; b?: number }
            export interface TreeNode { value: string; child?: TreeNode }

            export class DocController {
                getOne( id: number, q: QueryShape ) { return { id, q } }
                upload( body: ArrayBuffer ): Promise<{ ok: boolean }> { return Promise.resolve({ ok: true }) }
                nested(): Nested { return { id: '1' } }
                tree( body: TreeNode ): TreeNode { return body }
            }
        `);

        const program = ts.createProgram([ ctrlPath ], {
            target           : ts.ScriptTarget.ES2022,
            module           : ts.ModuleKind.ESNext,
            skipLibCheck     : true,
            strict           : true
        });
        const registry = createRegistry();
        registry.controllers.set( 'DocController', { path : ctrlPath, injections : new Map() });
        registry.endpoints.push(
            {
                controller : 'DocController',
                methodName : 'getOne',
                httpMethod : 'GET',
                path       : '/docs/:id',
                params     : [
                    { source : 'Param', name : 'id' },
                    { source : 'Query' }
                ],
                guards : [], interceptors : [], meta : {}
            },
            {
                controller : 'DocController',
                methodName : 'upload',
                httpMethod : 'POST',
                path       : '/docs/upload',
                params     : [{ source : 'RawBody' }],
                guards : [], interceptors : [], meta : {}
            },
            {
                controller : 'DocController',
                methodName : 'nested',
                httpMethod : 'GET',
                path       : '/docs/nested',
                params     : [],
                guards : [], interceptors : [], meta : {}
            },
            {
                controller : 'DocController',
                methodName : 'tree',
                httpMethod : 'POST',
                path       : '/docs/tree',
                params     : [{ source : 'Body' }],
                guards : [], interceptors : [], meta : {}
            },
            {
                controller : 'DocController',
                methodName : 'nested',
                httpMethod : 'WS',
                path       : '/docs/ws',
                params     : [],
                guards : [], interceptors : [], meta : {}
            }
        );

        vi.spyOn( console, 'log' ).mockImplementation( () => {});

        // Act
        SwaggerSpecGenerator.generate( registry, program, dir );

        // Assert
        const spec = JSON.parse( fs.readFileSync( path.join( dir, 'swagger.json' ), 'utf8' ));
        expect( spec.paths['/docs/{id}'].get.parameters.some(( p: any ) => p.in === 'path' && p.name === 'id' )).toBe( true );
        expect( spec.paths['/docs/{id}'].get.parameters.some(( p: any ) => p.in === 'query' && p.name === 'a' )).toBe( true );
        expect( spec.paths['/docs/upload'].post.requestBody.content['application/octet-stream']).toBeDefined();
        expect( spec.paths['/docs/ws']).toBeUndefined();
        expect( Object.keys( spec.components.schemas ).length ).toBeGreaterThan( 0 );
        expect( JSON.stringify( spec )).toContain( '#/components/schemas/' );

        fs.rmSync( dir, { recursive : true, force : true });
    });
});
