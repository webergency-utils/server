import { describe, it, expect } from 'vitest';
import ts from '../compiler/ts.js';
import * as fs from 'fs';
import * as path from 'path';
import compilerPlugin from '../compiler/transformer.js';

describe( 'TypeScript Compiler Plugin Transformer', () =>
{
    function compileAndTransform( sourceCode: string, diagnostics?: ts.Diagnostic[]): string
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

            const extras = diagnostics
                ? { addDiagnostic : ( d: ts.Diagnostic ) => { diagnostics.push( d ) }}
                : undefined;
            const result = ts.transform( sourceFile, [compilerPlugin( program, undefined, extras )]);
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

    /** Transform several files under one program, as a real build does. */
    function compileFiles( files: Record<string, string> ): Record<string, string>
    {
        const written = Object.keys( files ).map( name => path.resolve( `./${name}` ));

        for( const [ index, name ] of Object.keys( files ).entries())
        {
            fs.writeFileSync( written[index], files[name]);
        }

        try
        {
            const program = ts.createProgram( written, {
                target                 : ts.ScriptTarget.ES2022,
                module                 : ts.ModuleKind.NodeNext,
                moduleResolution       : ts.ModuleResolutionKind.NodeNext,
                skipLibCheck           : true,
                experimentalDecorators : true
            });
            const plugin = compilerPlugin( program );
            const printer = ts.createPrinter();
            const output: Record<string, string> = {};

            for( const [ index, name ] of Object.keys( files ).entries())
            {
                const sourceFile = program.getSourceFile( written[index]);

                if( !sourceFile ) { throw new Error( `Could not load ${name}` ) }
                const result = ts.transform( sourceFile, [plugin]);
                output[name] = printer.printFile( result.transformed[0]);
            }

            return output;
        }
        finally
        {
            for( const file of written )
            {
                if( fs.existsSync( file )) { fs.unlinkSync( file ) }
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
        expect( compiled ).toContain( 'const __parse_' );
        expect( compiled ).toContain( 'httpMethod: "GET"' );
        expect( compiled ).toContain( 'path: "/users/:id"' );
        expect( compiled ).toContain( 'httpMethod: "POST"' );
        expect( compiled ).toContain( 'path: "/users"' );
        expect( compiled ).toContain( 'parser: __parse_' );
        expect( compiled ).toContain( 'parserQuery: __parse_' );
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

        expect(() => compileAndTransform( code )).toThrow( /must not be called with empty parentheses/ );
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
        expect( compiled ).toContain( 'returnTypeSerializer' );
        expect( compiled ).toContain( 'serializeAny' );
        expect( compiled ).toContain( 'sse: true' );
    });

    it( 'should attach serializer for any and unknown HTTP return types', () =>
    {
        const code = `
      import { Controller, Get } from '../decorators.js';

      @Controller('/opaque')
      export class OpaqueController {
        @Get('/any')
        any(): any { return { free: true } }

        @Get('/unknown')
        unknown(): Promise<unknown> { return Promise.resolve( 1 ) }
      }
    `;

        const compiled = compileAndTransform( code );

        expect( compiled ).toContain( 'returnTypeSerializer' );
        expect( compiled ).toContain( 'serializeAny' );
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

    it( 'should hash a shared type once per program and keep unrelated validators out of a file', () =>
    {
        const shared = `
      export interface Shared { id: string; count: number }
    `;
        const first = `
      import { Controller, Post, Body } from '../decorators.js';
      import type { Shared } from './temp_shared_types.js';

      interface OnlyHere { nickname: string }

      @Controller('/first')
      export class FirstController {
        @Post('/shared')
        shared(@Body() body: Shared) { return body }

        @Post('/local')
        local(@Body() body: OnlyHere) { return body }
      }
    `;
        const second = `
      import { Controller, Post, Body } from '../decorators.js';
      import type { Shared } from './temp_shared_types.js';

      @Controller('/second')
      export class SecondController {
        @Post('/shared')
        shared(@Body() body: Shared) { return body }
      }
    `;

        const output = compileFiles({
            'temp_shared_types.ts'      : shared,
            'temp_first_controller.ts'  : first,
            'temp_second_controller.ts' : second
        });

        const declared = ( code: string ) => new Set(( code.match( /const (__val_[0-9a-f]+) =/g ) || []).map( m => m.slice( 6, -2 )));
        const declaredParsers = ( code: string ) => new Set(( code.match( /const (__parse_[0-9a-f]+_[a-z]+_[a-z]+) =/g ) || []).map( m => m.slice( 6, -2 )));
        const firstVals = declared( output['temp_first_controller.ts']);
        const secondVals = declared( output['temp_second_controller.ts']);
        const firstParsers = declaredParsers( output['temp_first_controller.ts']);
        const secondParsers = declaredParsers( output['temp_second_controller.ts']);

        // The shared type resolves to the same hash in both files...
        expect([ ...secondVals ].some( hash => firstVals.has( hash ))).toBe( true );
        expect([ ...secondParsers ].some( hash => firstParsers.has( hash ))).toBe( true );
        // ...while the type only one controller uses stays out of the other file.
        expect( output['temp_first_controller.ts']).toContain( 'nickname' );
        expect( output['temp_second_controller.ts']).not.toContain( 'nickname' );
        expect( secondVals.size ).toBeLessThan( firstVals.size );
        expect( secondParsers.size ).toBeLessThan( firstParsers.size );
        expect( output['temp_first_controller.ts']).toContain( 'parser: __parse_' );
        expect( output['temp_first_controller.ts']).toContain( 'returnTypeSerializer: __ser_' );    });

    it( 'should report an unresolved @Protect argument instead of dropping the guard', () =>
    {
        const code = `
      import { Controller, Get, Protect } from '../decorators.js';

      const NotAGuard = { use() {} };

      @Controller('/typo')
      export class TypoController {
        @Get()
        @Protect(NotAGuard)
        hi() { return 1 }
      }
    `;

        expect(() => compileAndTransform( code )).toThrow( /must reference a class declaration/ );
    });

    it( 'should resolve an imported guard class through its import alias', () =>
    {
        const output = compileFiles({
            'temp_imported_guard.ts' : `
        import { Injectable } from '../decorators.js';

        @Injectable()
        export class IAMGuard {
          use() { return true }
        }
      `,
            'temp_imported_guard_controller.ts' : `
        import { Controller, Get, Protect } from '../decorators.js';
        import { IAMGuard } from './temp_imported_guard.js';

        @Controller('/secured')
        export class SecuredController {
          @Get()
          @Protect(IAMGuard)
          hi() { return 1 }
        }
      `
        });

        expect( output['temp_imported_guard_controller.ts']).toMatch( /guards\s*:\s*\[[\s\S]*IAMGuard/ );
        expect( output['temp_imported_guard_controller.ts']).not.toContain( 'could not be resolved' );
    });

    it( 'should report an unresolved @Use argument', () =>
    {
        const code = `
      import { Controller, Get, Use } from '../decorators.js';

      const notAMiddleware = () => {};

      @Use(notAMiddleware)
      @Controller('/typo-use')
      export class TypoUseController {
        @Get()
        hi() { return 1 }
      }
    `;

        expect(() => compileAndTransform( code )).toThrow( /"@Use" must reference a class declaration/ );
    });

    it( 'should hand problems to a host that accepts diagnostics rather than throwing', () =>
    {
        const code = `
      import { Controller, Get, Head, Inject, Injectable } from '../decorators.js';

      @Injectable()
      class Dep {}

      @Controller('/diag')
      export class DiagController {
        constructor(@Inject() private dep: Dep) {}

        @Get()
        hi() { return 1 }

        @Head('/h')
        head() { return 'not void' }
      }
    `;
        const diagnostics: ts.Diagnostic[] = [];

        const compiled = compileAndTransform( code, diagnostics );

        expect( compiled ).toContain( 'Symbol.for("webergency.server.controller")' );
        expect( diagnostics ).toHaveLength( 2 );
        expect( diagnostics.every( d => d.category === ts.DiagnosticCategory.Error )).toBe( true );
        expect( diagnostics.every( d => d.source === 'webergency' )).toBe( true );
        expect( diagnostics.map( d => d.code )).toEqual([ 90001, 90003 ]);
        expect( diagnostics[0].file?.fileName ).toContain( 'temp_test_controller.ts' );
        expect( ts.flattenDiagnosticMessageText( diagnostics[1].messageText, '\n' ))
            .toMatch( /must return void or Promise<void>/ );
    });
});
