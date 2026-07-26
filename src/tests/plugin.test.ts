import { describe, it, expect } from 'vitest';
import ts from '../compiler/ts.js';
import * as fs from 'fs';
import * as path from 'path';
import compilerPlugin from '../compiler/transformer.js';

describe( 'TypeScript Compiler Plugin Transformer', () =>
{
    function compileAndTransform( sourceCode: string ): string
    {
        const tempFile = path.resolve( './temp_test_controller.ts' );
        fs.writeFileSync( tempFile, sourceCode );

        try
        {
            const program = ts.createProgram([tempFile], {
                target                 : ts.ScriptTarget.ES2022,
                module                 : ts.ModuleKind.NodeNext,
                moduleResolution       : ts.ModuleResolutionKind.NodeNext,
                skipLibCheck           : true,
                experimentalDecorators : true
            });

            const sourceFile = program.getSourceFile( tempFile );

            if( !sourceFile ) { throw new Error( 'Could not load source file' ) }

            const result = ts.transform( sourceFile, [compilerPlugin( program )]);
            const printer = ts.createPrinter();

            return printer.printFile( result.transformed[0]);
        }
        finally
        {
            if( fs.existsSync( tempFile ))
            {
                fs.unlinkSync( tempFile );
            }
        }
    }

    it( 'should transform a simple controller and attach Symbol AOT metadata', () =>
    {
        const code = `
      import { Controller, Get, Post, Body, Param } from '../decorators.js';

      interface User {
        id: string;
        name: string;
      }

      @Controller('/users')
      export class UserController {
        @Get('/:id')
        getUser(@Param('id') id: string) {
          return { id, name: 'Alice' };
        }

        @Post()
        createUser(@Body('strip') user: User) {
          return user;
        }
      }
    `;

        const compiled = compileAndTransform( code );

        expect( compiled ).toContain( 'Symbol.for("webergency.server.controller")' );
        expect( compiled ).toContain( 'import "@webergency-utils/typechecker/runtime"' );
        expect( compiled ).toContain( 'const __val_' );
        expect( compiled ).toContain( 'httpMethod: "GET"' );
        expect( compiled ).toContain( 'path: "/users/:id"' );
        expect( compiled ).toContain( 'httpMethod: "POST"' );
        expect( compiled ).toContain( 'path: "/users"' );
        expect( compiled ).toContain( 'validator: __val_' );
        expect( compiled ).toContain( 'kind: "controller"' );
        expect( compiled ).not.toContain( 'MetadataStore' );
    });

    it( 'should transform CORS decorators at class and method level', () =>
    {
        const code = `
      import { Controller, Get, Post, Cors } from '../decorators.js';

      @Cors({ origin: 'http://localhost', credentials: true })
      @Controller('/api')
      export class ApiController {
        @Get('/public')
        @Cors()
        getPublic() {
          return { ok: true };
        }

        @Post('/restricted')
        @Cors({ origin: (o) => o === 'http://trusted', allowedHeaders: ['Content-Type', 'X-Custom-*'] })
        getRestricted() {
          return { ok: true };
        }
      }
    `;

        const compiled = compileAndTransform( code );

        expect( compiled ).toContain( 'cors: {}' );
        expect( compiled ).toContain( 'origin: (o) => o === \'http://trusted\'' );
        expect( compiled ).toContain( 'allowedHeaders: [\'Content-Type\', \'X-Custom-*\']' );
    });

    it( 'should throw an error if @Head decorated method does not return void or Promise<void>', () =>
    {
        const code = `
      import { Controller, Head } from '../decorators.js';

      @Controller('/test')
      export class TestController {
        @Head('/ping')
        ping(): string {
          return "pong";
        }
      }
    `;

        expect(() => compileAndTransform( code )).toThrow( /must return void or Promise<void>/ );
    });
});
