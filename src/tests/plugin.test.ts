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
        expect( compiled ).toContain( 'import * as __tcRuntime from "@webergency-utils/typechecker/runtime"' );
        expect( compiled ).toContain( 'const validators = __tcRuntime.validators' );
        expect( compiled ).not.toContain( '__WEBERGENCY_TYPECHECKER_VALIDATORS__' );
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

    it( 'should place Symbol metadata after classes while skipping interfaces and prepended vars', () =>
    {
        const code = `
      import { Controller, Get, Injectable, Inject } from '../decorators.js';

      interface SkipMe { n: number }
      type Alias = string;
      const validators = {};
      const __val_skip = 1;

      @Injectable()
      export class Dep { value = 1 }

      @Controller('/place')
      export class PlaceController {
        constructor(@Inject('Dep') private dep: Dep) {}
        @Get()
        hi() { return this.dep.value }
      }

      const userCode = 1;
    `;

        const compiled = compileAndTransform( code );

        expect( compiled ).toContain( 'Symbol.for("webergency.server.controller")' );
        expect( compiled.indexOf( 'Symbol.for("webergency.server.controller")' ))
            .toBeLessThan( compiled.lastIndexOf( 'userCode' ));
    });

    it( 'should transform SSE, Override/Unuse, and boolean Cors/Security metadata', () =>
    {
        const code = `
      import { Controller, Get, Sse, Cors, Security, Protect, Unuse, OverrideProtect, Use, OverrideUse } from '../decorators.js';

      class G { use() {} }
      class M { use() {} }

      @Cors(true)
      @Security(false)
      @Controller('/edge')
      export class EdgeController {
        @Sse('/stream')
        async *stream(): AsyncIterable<string> { yield 'x' }

        @Get('/g')
        @OverrideProtect(G, true, false, ['a'])
        @Unuse(M)
        @OverrideUse(M)
        guarded() { return 'ok' }
      }
    `;

        const compiled = compileAndTransform( code );
        expect( compiled ).toContain( 'sse: true' );
        expect( compiled ).toContain( 'Symbol.for("webergency.server.controller")' );
    });

    it( 'should throw when @Inject is called with empty parentheses', () =>
    {
        const code = `
      import { Controller, Get, Inject, Injectable } from '../decorators.js';

      @Injectable()
      class Dep {}

      @Controller('/bad')
      export class BadController {
        constructor(@Inject() private dep: Dep) {}
        @Get()
        hi() { return 1 }
      }
    `;

        expect( () => compileAndTransform( code )).toThrow( /must not be called with empty parentheses/ );
    });

    it( 'should resolve bare, typed, property, and non-literal @Inject tokens', () =>
    {
        const code = `
      import { Controller, Get, Inject, Injectable } from '../decorators.js';

      const TOKEN = { key: 'Tok' as const };

      @Injectable()
      export class Dep { value = 1 }

      @Controller('/inject')
      export class InjectController {
        @Inject
        typedProp: Dep;

        @Inject(Dep)
        namedProp: Dep;

        @Inject('Dep')
        stringProp: Dep;

        @Inject(TOKEN.key)
        nonLiteralProp: string;

        constructor(
          @Inject private bare: Dep,
          @Inject(Dep) named: Dep,
          @Inject(TOKEN.key) nonLiteral: string,
          untyped: string
        ) {}

        @Get()
        hi(dep: Dep, @Inject other: Dep, @Inject(Dep) named: Dep, @Inject(TOKEN.key) nl: string) { return dep }
      }
    `;

        const compiled = compileAndTransform( code );

        expect( compiled ).toContain( 'Symbol.for("webergency.server.controller")' );
        expect( compiled ).toContain( 'propertyDeps' );
        expect( compiled ).toContain( 'constructorDeps' );
        expect( compiled ).toContain( 'Dep' );
    });

    it( 'should accept bare Cors/Security identifiers and nullish options', () =>
    {
        const code = `
      import { Controller, Get, Cors, Security } from '../decorators.js';

      class BaseCtrl {}

      @Cors
      @Security
      @Controller('/bare')
      export class BareController extends BaseCtrl {
        @Get('/plain')
        plain() { return 'ok' }

        @Get('/n')
        @Cors(null)
        nullish() { return 'ok' }

        @Get('/u')
        @Cors({ origin: undefined })
        @Security()
        undefOrigin() { return 'ok' }
      }
    `;

        const compiled = compileAndTransform( code );

        expect( compiled ).toContain( 'cors: {}' );
        expect( compiled ).toContain( 'security: {}' );
        expect( compiled ).toContain( 'cors: null' );
        expect( compiled ).toContain( 'origin: undefined' );
    });

    it( 'should cover class-level Override/Unuse and guard static args with late guard decl', () =>
    {
        const code = `
      import { Controller, Get, Head, Sse, Protect, OverrideProtect, Use, OverrideUse, Unuse, Intercept, OverrideIntercept } from '../decorators.js';

      class M { use() {} }
      class M2 { use() {} }
      class I { intercept(n: any) { return n() } }

      @Use(M)
      @Controller('/parent')
      export class ParentController {
        @Get()
        root() { return 1 }
      }

      @Unuse(M)
      @Controller('/stripped')
      export class StrippedController extends ParentController {
        @Get('/s')
        stripped() { return 0 }
      }

      @Unuse(M)
      @OverrideUse(M2)
      @OverrideProtect(G, 'role', 7, true, false, ['x', 'y'])
      @OverrideIntercept(I)
      @Unuse
      @Controller('/child')
      export class ChildController extends ParentController {
        g: G;

        @Get('/m')
        @OverrideIntercept(I)
        @Protect(G, 1)
        @Protect()
        mid() { return 2 }

        @Head('/h')
        async headOk(): Promise<void> {}

        @Get('/p')
        async promised(): Promise<{ ok: boolean }> { return { ok: true } }

        @Sse('/any')
        async *anyStream(): AsyncIterable<any> { yield 1 as any }
      }

      class G {
        use(role: string) { return true }
      }
    `;

        const compiled = compileAndTransform( code );

        expect( compiled ).toContain( 'Symbol.for("webergency.server.controller")' );
        expect( compiled ).toContain( 'role' );
        expect( compiled ).toContain( 'returnTypeValidator' );
        expect( compiled ).toContain( 'sse: true' );
    });

    it( 'should insert Symbol metadata after binding patterns and __val_ vars', () =>
    {
        const code = `
      import { Controller, Get, Sse } from '../decorators.js';

      @Controller('/insert')
      export class InsertController {
        @Get()
        hi() { return 1 }

        @Sse('/sse')
        async *stream(): AsyncIterable<{ data: string }> { yield { data: 'x' } }
      }

      const __val_keep = 1;
      interface AfterIface { n: number }
      type AfterAlias = string;
      const { destructured } = { destructured: 1 };
      const afterCode = 1;
    `;

        const compiled = compileAndTransform( code );
        const symbolAt = compiled.indexOf( 'Symbol.for("webergency.server.controller")' );

        expect( symbolAt ).toBeGreaterThan( -1 );
        expect( symbolAt ).toBeLessThan( compiled.indexOf( 'destructured' ));
        expect( symbolAt ).toBeLessThan( compiled.indexOf( 'afterCode' ));
        expect( compiled ).toContain( 'sse: true' );
    });
});
