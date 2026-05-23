import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import compilerPlugin from '../transformer.js';

describe('TypeScript Compiler Plugin Transformer', () => {
  function compileAndTransform(sourceCode: string): string {
    const tempFile = path.resolve('./temp_test_controller.ts');
    fs.writeFileSync(tempFile, sourceCode);

    try {
      const program = ts.createProgram([tempFile], {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        skipLibCheck: true,
        experimentalDecorators: true
      });

      const sourceFile = program.getSourceFile(tempFile);
      if (!sourceFile) throw new Error("Could not load source file");

      const result = ts.transform(sourceFile, [compilerPlugin(program)]);
      const printer = ts.createPrinter();
      return printer.printFile(result.transformed[0]);
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  }

  it('should transform a simple controller and append self-registrations', () => {
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

    const compiled = compileAndTransform(code);

    // Should initialize __server_metadata_store from globalThis
    expect(compiled).toContain('__server_metadata_store = globalThis.__WEBERGENCY_SERVER_METADATA_STORE__');

    // Should import typechecker runtime
    expect(compiled).toContain('import "@webergency-utils/typechecker/runtime"');

    // Should declare validator constant
    expect(compiled).toContain("const __val_");

    // Should register controller
    expect(compiled).toContain('__server_metadata_store.providers.set("UserController", UserController)');
    expect(compiled).toContain('__server_metadata_store.controllerClasses.add("UserController")');

    // Should register GET /users/:id endpoint
    expect(compiled).toContain('httpMethod: "GET"');
    expect(compiled).toContain('path: "/users/:id"');

    // Should register POST /users endpoint with validator
    expect(compiled).toContain('httpMethod: "POST"');
    expect(compiled).toContain('path: "/users"');
    expect(compiled).toContain("validator: __val_");
  });

  it('should transform CORS decorators at class and method level', () => {
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

    const compiled = compileAndTransform(code);

    // getPublic has @Cors() without params, which resolves to {}
    expect(compiled).toContain('cors: {}');

    // getRestricted has method level @Cors with inline arrow function and array of wildcards
    expect(compiled).toContain('origin: (o) => o === \'http://trusted\'');
    expect(compiled).toContain('allowedHeaders: [\'Content-Type\', \'X-Custom-*\']');
  });
});

