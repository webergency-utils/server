import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import ts from '../src/compiler/ts.js';
import compilerPlugin, { SwaggerSpecGenerator, createRegistry, transformer } from '../src/compiler/transformer.js';
import { resolve as registerResolve, load as registerLoad, getProgramFor } from '../src/compiler/register.js';
import { Server } from '../src/server.js';

function compileMultiFileProgram(
    files       : Record<string, string>,
    diagnostics?: ts.Diagnostic[],
    withSwagger = false
): { outputs : Record<string, string>, swagger? : Record<string, unknown> }
{
    const writtenPaths = Object.keys( files ).map( name => path.resolve( `./${name}` ));

    for( const [ idx, name ] of Object.keys( files ).entries())
    {
        fs.writeFileSync( writtenPaths[idx], files[name]);
    }

    const swaggerDir = withSwagger ? fs.mkdtempSync( path.join( os.tmpdir(), 'wu-swag-' )) : undefined;

    try
    {
        const program = ts.createProgram( writtenPaths, {
            target                 : ts.ScriptTarget.ES2022,
            module                 : ts.ModuleKind.NodeNext,
            moduleResolution       : ts.ModuleResolutionKind.NodeNext,
            skipLibCheck           : true,
            experimentalDecorators : true
        });

        const registry = createRegistry();
        const extras = diagnostics
            ? { addDiagnostic : ( d: ts.Diagnostic ) => { diagnostics.push( d ) } }
            : undefined;
        const plugin = compilerPlugin( program, { registry }, extras );
        const printer = ts.createPrinter();
        const outputs: Record<string, string> = {};

        for( const [ idx, name ] of Object.keys( files ).entries())
        {
            const sf = program.getSourceFile( writtenPaths[idx]);

            if( !sf ) { throw new Error( `Missing source file ${name}` ) }

            const res = ts.transform( sf, [plugin]);
            outputs[name] = printer.printFile( res.transformed[0]);
        }

        let swagger: Record<string, unknown> | undefined;

        if( swaggerDir )
        {
            const analysisPass = transformer( program, registry );

            for( const idx of Object.keys( files ).keys())
            {
                const sf = program.getSourceFile( writtenPaths[idx]);

                if( sf ) { ts.transform( sf, [analysisPass]) }
            }

            SwaggerSpecGenerator.generate( registry, program, swaggerDir );
            swagger = JSON.parse( fs.readFileSync( path.join( swaggerDir, 'swagger.json' ), 'utf8' ));
        }

        return { outputs, swagger };
    }
    finally
    {
        for( const p of writtenPaths )
        {
            if( fs.existsSync( p )) { fs.unlinkSync( p ) }
        }

        if( swaggerDir && fs.existsSync( swaggerDir ))
        {
            fs.rmSync( swaggerDir, { recursive : true, force : true });
        }
    }
}

describe( 'Compiler, Register, CLI & OpenAPI Audit Fixes (#1–#8 & S1)', () =>
{
    it( 'S1 & Bug #1 & Bug #2: should preserve @Protect on PublicProfile paths, emit @Response properly, and support @Payload("field") end-to-end', async () =>
    {
        // Arrange
        const prefix = `tmp_aot_1_2_${Date.now()}`;
        const tsName = `${prefix}.ts`;
        const jsPath = path.resolve( `./${prefix}.mjs` );

        const source = `
            import {
                Controller,
                Get,
                Post,
                Protect,
                Response,
                Payload,
                Guard,
                ForbiddenError,
                ServerRequest,
                ServerResponse
            } from './src/index.js';

            export class PublicTokenGuard implements Guard
            {
                use( req: ServerRequest )
                {
                    if( req.header( 'x-token' ) !== 'valid' )
                    {
                        throw new ForbiddenError( 'Invalid token' );
                    }
                }
            }

            @Controller( '/api/PublicProfile' )
            @Protect( PublicTokenGuard )
            export class PublicProfileController
            {
                @Get( '/me' )
                me( @Response res: ServerResponse )
                {
                    res.header( 'X-Via-Response-Bag', 'yes' );

                    return { ok : true, isBag : typeof res.status === 'function' };
                }

                @Post( '/extract' )
                extract( @Payload( 'userId' ) userId: number )
                {
                    return { doubled : userId * 2 };
                }
            }
        `;

        const { outputs } = compileMultiFileProgram({ [tsName] : source });
        const jsOut = ts.transpileModule( outputs[tsName], {
            compilerOptions : {
                target                 : ts.ScriptTarget.ES2022,
                module                 : ts.ModuleKind.ES2022,
                experimentalDecorators : true
            }
        }).outputText;
        fs.writeFileSync( jsPath, jsOut );

        try
        {
            const mod = await import( pathToFileURL( jsPath ).href );
            const server = new Server({
                port        : 0,
                signals     : false,
                controllers : [mod.PublicProfileController],
                guards      : [mod.PublicTokenGuard]
            });

            // Act — unauthenticated request MUST be blocked by PublicTokenGuard (S1)
            const unauth = await server.fetch( new Request( 'http://localhost/api/PublicProfile/me' ));
            const authed = await server.fetch( new Request( 'http://localhost/api/PublicProfile/me', {
                headers : { 'x-token' : 'valid' }
            }));
            const validPayload = await server.fetch( new Request( 'http://localhost/api/PublicProfile/extract', {
                method  : 'POST',
                headers : {
                    'x-token'      : 'valid',
                    'content-type' : 'application/json'
                },
                body : JSON.stringify({ userId : 21, ignored : 'x' })
            }));
            const invalidPayload = await server.fetch( new Request( 'http://localhost/api/PublicProfile/extract', {
                method  : 'POST',
                headers : {
                    'x-token'      : 'valid',
                    'content-type' : 'application/json'
                },
                body : JSON.stringify({ userId : 'not-a-number' })
            }));

            // Assert
            expect( unauth.status ).toBe( 403 );
            expect( authed.status ).toBe( 200 );
            expect( authed.headers.get( 'x-via-response-bag' )).toBe( 'yes' );
            expect( await authed.json()).toEqual({ ok : true, isBag : true });
            expect( validPayload.status ).toBe( 200 );
            expect( await validPayload.json()).toEqual({ doubled : 42 });
            expect( invalidPayload.status ).toBe( 400 );
        }
        finally
        {
            if( fs.existsSync( jsPath )) { fs.unlinkSync( jsPath ) }
        }
    });

    it( 'Bug #1 & Bug #5: should emit compile-time diagnostics when @Response() has parentheses or @Inject is placed on #private fields', () =>
    {
        // Arrange
        const badResponseName = `tmp_bad_resp_${Date.now()}.ts`;
        const badPrivateName = `tmp_bad_priv_${Date.now()}.ts`;

        // Act & Assert 1 — @Response() with parentheses throws compile error
        expect(() => compileMultiFileProgram({
            [badResponseName] : `
                import { Controller, Get, Response, ServerResponse } from './src/index.js';

                @Controller( '/bad' )
                export class BadRespCtrl
                {
                    @Get( '/' )
                    index( @Response() res: ServerResponse )
                    {
                        return { ok : Boolean( res ) };
                    }
                }
            `
        })).toThrow( /must not be called with parentheses/ );

        // Act & Assert 2 — @Inject on #private field throws compile error
        expect(() => compileMultiFileProgram({
            [badPrivateName] : `
                import { Injectable, Inject } from './src/index.js';

                @Injectable()
                export class BadPrivSvc
                {
                    @Inject( 'CFG' )
                    #secret!: string;
                }
            `
        })).toThrow( /ECMAScript private field/ );
    });

    it( 'Bug #3, #4, #5: should resolve out-of-order parameter DI, aliased @Inject imports, standalone Middleware/Interceptor, and quoted property keys', () =>
    {
        // Arrange
        const prefix = `tmp_di_order_${Date.now()}`;
        const ctrlFile = `${prefix}_a_ctrl.ts`;
        const svcFile = `${prefix}_z_svc.ts`;

        // Controller is transformed BEFORE service file!
        const { outputs } = compileMultiFileProgram({
            [ctrlFile] : `
                import { Controller, Get, Inject, Middleware, Interceptor, ServerRequest, ServerResponse } from './src/index.js';
                import { LateUserService as AliasedUserService } from './${prefix}_z_svc.js';

                export class AuditMiddleware implements Middleware
                {
                    use( _req: ServerRequest, _res: ServerResponse, next: () => void )
                    {
                        next();
                    }
                }

                export class TimingInterceptor implements Interceptor
                {
                    async use( _req: ServerRequest, next: () => Promise<unknown> )
                    {
                        return next();
                    }
                }

                @Controller( '/users' )
                export class UserOrderController
                {
                    @Inject( AliasedUserService )
                    accessor!: AliasedUserService;

                    @Inject( 'DASH-KEY' )
                    'dash-prop'!: string;

                    @Get( '/' )
                    list( svc: AliasedUserService )
                    {
                        return { ok : Boolean( svc ) };
                    }
                }
            `,
            [svcFile] : `
                import { Injectable } from './src/index.js';

                @Injectable()
                export class LateUserService
                {
                    findAll() { return []; }
                }
            `
        });

        // Assert
        const ctrlOut = outputs[ctrlFile];
        expect( ctrlOut ).toMatch( /source:\s*"Inject",\s*name:\s*"LateUserService"/ );
        expect( ctrlOut ).toContain( 'accessor: "LateUserService"' );
        expect( ctrlOut ).toContain( '"dash-prop": "DASH-KEY"' );
        expect( ctrlOut ).toContain( 'Symbol.for("webergency.server.injectable")' );
        expect( ctrlOut ).toMatch( /kind:\s*"provider",\s*token:\s*"AuditMiddleware"/ );
        expect( ctrlOut ).toMatch( /kind:\s*"interceptor",\s*token:\s*"TimingInterceptor"/ );
        expect( ctrlOut ).not.toContain( 'kind: "guard"' );
    });

    it( 'Bug #6: should resolve NodeNext .js/.mjs/.cjs specifiers to .ts/.mts/.cts and invalidate Program cache when imported files change', async () =>
    {
        // Arrange
        const dir = fs.mkdtempSync( path.join( os.tmpdir(), 'wu-reg-fix-' ));
        fs.writeFileSync( path.join( dir, 'tsconfig.json' ), JSON.stringify({
            compilerOptions : {
                target                 : 'ES2022',
                module                 : 'NodeNext',
                moduleResolution       : 'NodeNext',
                experimentalDecorators : true
            }
        }));
        const dtoFile = path.join( dir, 'dto.ts' );
        const entryFile = path.join( dir, 'entry.ts' );
        fs.writeFileSync( dtoFile, 'export interface ItemDto { id: number }\n' );
        fs.writeFileSync( entryFile, 'import type { ItemDto } from \'./dto.js\';\nexport const x: ItemDto = { id: 1 };\n' );

        try
        {
            // Act 1 — resolve('./dto.js?v=1') from parent entry.ts
            const resolved = await registerResolve(
                './dto.js?v=1',
                { parentURL : pathToFileURL( entryFile ).href },
                async () => ({ url : 'fallback' })
            );

            // Act 2 — load URL with query string
            const loaded = await registerLoad(
                resolved.url,
                {},
                async () => ({ format : 'module', source : '' })
            );

            // Act 3 — program cache invalidation when imported dto.ts mtime advances
            const prog1 = getProgramFor( entryFile );
            const future = new Date( Date.now() + 5000 );
            fs.utimesSync( dtoFile, future, future );
            const prog2 = getProgramFor( entryFile );

            // Assert
            expect( resolved.shortCircuit ).toBe( true );
            expect( resolved.url ).toBe( `${pathToFileURL( dtoFile ).href}?v=1` );
            expect( loaded.shortCircuit ).toBe( true );
            expect( String( loaded.source )).toContain( 'export {}' );
            expect( prog2 ).not.toBe( prog1 );
        }
        finally
        {
            fs.rmSync( dir, { recursive : true, force : true });
        }
    });

    it( 'Bug #7: should support --version, --project=<dir>, --noEmit, and inherited extends plugins in webergency-tsc CLI', () =>
    {
        // Arrange
        const cliPath = path.resolve( './src/compiler/cli.ts' );
        const tsxBin = path.resolve( './node_modules/.bin/tsx' );
        const projDir = fs.mkdtempSync( path.join( os.tmpdir(), 'wu-cli-fix-' ));

        try
        {
            fs.writeFileSync( path.join( projDir, 'tsconfig.base.json' ), JSON.stringify({
                compilerOptions : {
                    target                 : 'ES2022',
                    module                 : 'NodeNext',
                    moduleResolution       : 'NodeNext',
                    experimentalDecorators : true,
                    plugins                : [{ transform : '@webergency-utils/server/transformer' }]
                }
            }));
            fs.writeFileSync( path.join( projDir, 'tsconfig.json' ), JSON.stringify({
                extends         : './tsconfig.base.json',
                compilerOptions : {
                    outDir : './dist'
                },
                include : [ 'src/**/*.ts' ]
            }));
            fs.mkdirSync( path.join( projDir, 'src' ));
            fs.writeFileSync( path.join( projDir, 'src', 'hello.ts' ), 'export const answer: number = 42;\n' );

            // Act
            const versionOut = execFileSync( tsxBin, [ cliPath, '--version' ], { encoding : 'utf8' }).trim();
            const noEmitOut = execFileSync( tsxBin, [ cliPath, `--project=${projDir}`, '--noEmit' ], { encoding : 'utf8' });

            // Assert
            expect( versionOut ).toMatch( /webergency-tsc.*\d+\.\d+\.\d+/ );
            expect( noEmitOut ).toContain( 'webergency-tsc' );
            expect( fs.existsSync( path.join( projDir, 'dist' ))).toBe( false );
        }
        finally
        {
            fs.rmSync( projDir, { recursive : true, force : true });
        }
    });

    it( 'Bug #8: should export SwaggerSpecGenerator and generate valid OpenAPI paths, inherited methods, $ref query DTOs, named @Payload, @Sse, and @All operations', () =>
    {
        // Arrange
        const fileName = `tmp_swagger_${Date.now()}.ts`;
        const source = `
            import { Controller, Get, Post, All, Sse, Query, Payload } from './src/index.js';

            export interface FilterQueryDto
            {
                search : string
                limit? : number
            }

            export class BaseCrudController
            {
                @Get( '/health' )
                health()
                {
                    return { alive : true };
                }
            }

            @Controller( '/items' )
            export class ItemsController extends BaseCrudController
            {
                @Get( '/:id(\\\\d+)/*rest' )
                findItem( @Query() query: FilterQueryDto )
                {
                    return { query };
                }

                @Post( '/field' )
                postField( @Payload( 'title' ) title: string )
                {
                    return { title };
                }

                @Sse( '/stream' )
                async *events()
                {
                    yield { data : { tick : 1 } };
                }

                @All( '/any' )
                handleAll()
                {
                    return { ok : true };
                }
            }
        `;

        // Act
        const { swagger } = compileMultiFileProgram({ [fileName] : source }, undefined, true );
        const paths = ( swagger as { paths : Record<string, Record<string, Record<string, unknown>>> }).paths;

        // Assert
        expect( typeof SwaggerSpecGenerator.generate ).toBe( 'function' );
        expect( paths['/items/health']?.get ).toBeDefined();
        expect( paths['/items/{id}/{rest}']?.get ).toBeDefined();

        const getItemParams = paths['/items/{id}/{rest}'].get.parameters as Array<{ name : string, in : string, required : boolean }>;
        expect( getItemParams ).toEqual( expect.arrayContaining([
            expect.objectContaining({ name : 'id', in : 'path', required : true }),
            expect.objectContaining({ name : 'rest', in : 'path', required : true }),
            expect.objectContaining({ name : 'search', in : 'query', required : true }),
            expect.objectContaining({ name : 'limit', in : 'query', required : false })
        ]));

        const postFieldReqBody = paths['/items/field'].post.requestBody as {
            content : { 'application/json' : { schema : { properties : Record<string, unknown> } } }
        };
        expect( postFieldReqBody.content['application/json'].schema.properties.title ).toBeDefined();

        const sseResponses = paths['/items/stream'].get.responses as {
            '200' : { content : Record<string, unknown> }
        };
        expect( sseResponses['200'].content['text/event-stream']).toBeDefined();

        const anyOps = paths['/items/any'];
        expect( anyOps.get.operationId ).not.toBe( anyOps.post.operationId );
        expect( anyOps.head ).toBeDefined();
        expect( anyOps.options ).toBeDefined();
    });
});
