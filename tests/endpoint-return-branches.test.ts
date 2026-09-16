import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import ts from '../src/compiler/ts.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import compilerPlugin, { transformer, createRegistry } from '../src/compiler/transformer.js';
import { SwaggerSpecGenerator } from '../src/compiler/swagger.js';
import { Server } from '../src/server.js';
import { getControllerMeta } from '../src/core/symbols.js';

const __dirname = path.dirname( fileURLToPath( import.meta.url ));

describe( 'Endpoint Return Branches & Isolation', () =>
{
    const tempTsFile = path.resolve( __dirname, 'temp-branch-controllers.ts' );
    const tempJsFile = path.resolve( __dirname, 'temp-branch-controllers.compiled.mjs' );

    let server: Server;
    let controllerInstance: any;
    let swaggerSpec: any;

    const sourceCode = `
import { Controller, Get, Query, ResponseMode } from '../src/decorators.js';

@Controller( '/branches' )
export class BranchTestController
{
    @Get( '/ep1' )
    ep1( @Query( 'cond' ) cond: string )
    {
        if( cond === 'yes' )
        {
            return { foo : 'bar' };
        }

        return {};
    }

    @Get( '/ep2' )
    ep2( @Query( 'cond' ) cond: string )
    {
        if( cond === 'yes' )
        {
            return {};
        }

        return { foo : 'bar' };
    }

    @Get( '/isolated-fail' )
    isolatedFail( @Query( 'branch' ) branch: string, @Query( 'bad' ) bad: string )
    {
        if( branch === 'a' )
        {
            const res: { foo : string } = bad === 'yes' ? ( {} as any ) : { foo : 'branch-a' };

            return res;
        }

        return {};
    }

    @Get( '/frozen' )
    frozen( @Query( 'type' ) type: string )
    {
        if( type === 'foo' )
        {
            return Object.freeze({ foo : 'frozen-bar' });
        }

        return Object.freeze({});
    }

    @Get( '/async' )
    async asyncBranch( @Query( 'cond' ) cond: string )
    {
        if( cond === 'yes' )
        {
            return Promise.resolve({ foo : 'async-bar' });
        }

        return Promise.resolve({});
    }

    @Get( '/maybe-void' )
    maybeVoid( @Query( 'cond' ) cond: string )
    {
        if( cond === 'yes' )
        {
            return;
        }

        return { foo : 'maybe-bar' };
    }
}

@Controller( '/strict-branches' )
@ResponseMode( 'strict' )
export class StrictBranchController
{
    @Get( '/check' )
    check( @Query( 'mode' ) mode: string, @Query( 'leak' ) leak: string )
    {
        if( mode === 'foo' )
        {
            return { foo : 'strict-bar' };
        }

        const res: {} = leak === 'yes' ? { extra : 'not-allowed' } : {};

        return res;
    }
}
`;

    beforeAll( async () =>
    {
        fs.writeFileSync( tempTsFile, sourceCode );

        const registry = createRegistry();
        const serverRoot = path.resolve( __dirname, '../src/index.ts' );

        const program = ts.createProgram([ serverRoot, tempTsFile ], {
            experimentalDecorators : true,
            target                 : ts.ScriptTarget.ES2022,
            module                 : ts.ModuleKind.NodeNext,
            moduleResolution       : ts.ModuleResolutionKind.NodeNext,
            skipLibCheck           : true
        });

        const source = program.getSourceFile( tempTsFile );

        if( !source )
        {
            throw new Error( `Could not find source file: ${tempTsFile}` );
        }

        program.emit(
            source,
            ( fileName, data ) =>
            {
                fs.writeFileSync( tempJsFile, data );
            },
            undefined,
            false,
            {
                before : [ compilerPlugin( program ) ]
            }
        );

        const analyzer = transformer( program, registry )({} as any );
        analyzer( source );

        const swaggerOutputDir = path.resolve( __dirname, 'scratch-swagger' );

        if( !fs.existsSync( swaggerOutputDir ))
        {
            fs.mkdirSync( swaggerOutputDir, { recursive : true });
        }
        SwaggerSpecGenerator.generate( registry, program, swaggerOutputDir );
        swaggerSpec = JSON.parse( fs.readFileSync( path.join( swaggerOutputDir, 'swagger.json' ), 'utf8' ));

        const targetUrl = pathToFileURL( tempJsFile );
        targetUrl.search = `t=${Date.now()}`;
        const mod = await import( targetUrl.href );
        const classes = Object.values( mod ).filter( v => typeof v === 'function' ) as any[];
        const controllers = classes.filter( c => getControllerMeta( c ));

        server = new Server({
            port : 3000,
            controllers
        });
        await server.ensureReady();

        controllerInstance = new mod.BranchTestController();
    });

    afterAll(() =>
    {
        if( fs.existsSync( tempTsFile ))
        {
            fs.unlinkSync( tempTsFile );
        }

        if( fs.existsSync( tempJsFile ))
        {
            fs.unlinkSync( tempJsFile );
        }

        const swaggerOutputDir = path.resolve( __dirname, 'scratch-swagger' );

        if( fs.existsSync( swaggerOutputDir ))
        {
            fs.rmSync( swaggerOutputDir, { recursive : true, force : true });
        }
    });

    it( 'should emit __withSer and branch return wraps in compiled code', () =>
    {
        const compiled = fs.readFileSync( tempJsFile, 'utf8' );

        expect( compiled ).toContain( '__withSer' );
        expect( compiled ).toContain( 'globalThis[Symbol.for("webergency.server.branchSerializers")]' );
    });

    it( 'should return { foo: "bar" } and {} on ep1 branches with HTTP 200', async () =>
    {
        const resYes = await server.fetch( new Request( 'http://localhost/branches/ep1?cond=yes' ));
        expect( resYes.status ).toBe( 200 );
        expect( await resYes.json()).toEqual({ foo : 'bar' });

        const resNo = await server.fetch( new Request( 'http://localhost/branches/ep1?cond=no' ));
        expect( resNo.status ).toBe( 200 );
        expect( await resNo.json()).toEqual({});
    });

    it( 'should return {} and { foo: "bar" } on ep2 branches with HTTP 200', async () =>
    {
        const resYes = await server.fetch( new Request( 'http://localhost/branches/ep2?cond=yes' ));
        expect( resYes.status ).toBe( 200 );
        expect( await resYes.json()).toEqual({});

        const resNo = await server.fetch( new Request( 'http://localhost/branches/ep2?cond=no' ));
        expect( resNo.status ).toBe( 200 );
        expect( await resNo.json()).toEqual({ foo : 'bar' });
    });

    it( 'should enforce strict branch isolation (Branch 1 returning Type B fails HTTP 500)', async () =>
    {
        const resOkA = await server.fetch( new Request( 'http://localhost/branches/isolated-fail?branch=a&bad=no' ));
        expect( resOkA.status ).toBe( 200 );
        expect( await resOkA.json()).toEqual({ foo : 'branch-a' });

        const resFail = await server.fetch( new Request( 'http://localhost/branches/isolated-fail?branch=a&bad=yes' ));
        expect( resFail.status ).toBe( 500 );
        const body = await resFail.json();
        expect( body.success ).toBe( false );
        expect( body.error ).toContain( 'Response validation failed' );

        const resOkB = await server.fetch( new Request( 'http://localhost/branches/isolated-fail?branch=b&bad=no' ));
        expect( resOkB.status ).toBe( 200 );
        expect( await resOkB.json()).toEqual({});
    });

    it( 'should handle Object.freeze return values without error or mutation', async () =>
    {
        const resFoo = await server.fetch( new Request( 'http://localhost/branches/frozen?type=foo' ));
        expect( resFoo.status ).toBe( 200 );
        expect( await resFoo.json()).toEqual({ foo : 'frozen-bar' });

        const resEmpty = await server.fetch( new Request( 'http://localhost/branches/frozen?type=empty' ));
        expect( resEmpty.status ).toBe( 200 );
        expect( await resEmpty.json()).toEqual({});
    });

    it( 'should handle async / Promise return expressions cleanly', async () =>
    {
        const resYes = await server.fetch( new Request( 'http://localhost/branches/async?cond=yes' ));
        expect( resYes.status ).toBe( 200 );
        expect( await resYes.json()).toEqual({ foo : 'async-bar' });

        const resNo = await server.fetch( new Request( 'http://localhost/branches/async?cond=no' ));
        expect( resNo.status ).toBe( 200 );
        expect( await resNo.json()).toEqual({});
    });

    it( 'should handle void / return; alongside object returns', async () =>
    {
        const resYes = await server.fetch( new Request( 'http://localhost/branches/maybe-void?cond=yes' ));
        expect( resYes.status ).toBe( 200 );

        const resNo = await server.fetch( new Request( 'http://localhost/branches/maybe-void?cond=no' ));
        expect( resNo.status ).toBe( 200 );
        expect( await resNo.json()).toEqual({ foo : 'maybe-bar' });
    });

    it( 'should support direct method invocation in unit tests returning raw objects', async () =>
    {
        const rawYes = await controllerInstance.ep1( 'yes' );
        expect( rawYes ).toEqual({ foo : 'bar' });
        expect( rawYes instanceof Response ).toBe( false );

        const rawNo = await controllerInstance.ep1( 'no' );
        expect( rawNo ).toEqual({});
        expect( rawNo instanceof Response ).toBe( false );
    });

    it( 'should enforce strict mode across branches', async () =>
    {
        const resCheckFoo = await server.fetch( new Request( 'http://localhost/strict-branches/check?mode=foo&leak=no' ));
        expect( resCheckFoo.status ).toBe( 200 );
        expect( await resCheckFoo.json()).toEqual({ foo : 'strict-bar' });

        const resCheckEmpty = await server.fetch( new Request( 'http://localhost/strict-branches/check?mode=empty&leak=no' ));
        expect( resCheckEmpty.status ).toBe( 200 );
        expect( await resCheckEmpty.json()).toEqual({});

        const resLeak = await server.fetch( new Request( 'http://localhost/strict-branches/check?mode=empty&leak=yes' ));
        expect( resLeak.status ).toBe( 500 );
        const leakBody = await resLeak.json();
        expect( leakBody.success ).toBe( false );
        expect( leakBody.error ).toContain( 'PropertyNotAllowed<extra>' );
    });

    it( 'should document union return types in Swagger spec', () =>
    {
        const ep1Schema = swaggerSpec.paths['/branches/ep1'].get.responses['200'].content['application/json'].schema;
        expect( ep1Schema ).toBeDefined();
        const schemaString = JSON.stringify( ep1Schema ) + JSON.stringify( swaggerSpec.components?.schemas || {});
        expect( schemaString ).toContain( 'foo' );
    });
});
