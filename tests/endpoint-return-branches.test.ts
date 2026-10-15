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

    @Get( '/payment-terms' )
    async paymentTerms( @Query( 'mode' ) mode: string ): Promise<object | string | null>
    {
        if( mode === 'obj' )
        {
            const result: object = { terms : 'net-30', amount : 1500, nested : { approved : true } };

            return result;
        }

        if( mode === 'partial' )
        {
            const result: { terms : string } = { terms : 'net-60', extraDynamic : 42 } as any;

            return result;
        }

        if( mode === 'null' )
        {
            return null;
        }

        return '';
    }

    @Get( '/competing-shapes' )
    async competingShapes( @Query( 'mode' ) mode: string ): Promise<
        | {}
        | { id: string }
        | { id: string; name: string }
        | { id: string; name: string; amount: number; nested: { a: number; b: number } }
    >
    {
        if( mode === 'large' )
        {
            const res = { id : 'item-1', name : 'Large Item', amount : 999, nested : { a : 1, b : 2 } };

            return res;
        }

        if( mode === 'medium' )
        {
            const res = { id : 'item-2', name : 'Medium Item' };

            return res;
        }

        if( mode === 'small' )
        {
            const res = { id : 'item-3' };

            return res;
        }

        return {};
    }

    @Get( '/declared-base-returns-large' )
    async declaredBaseReturnsLarge( @Query( 'mode' ) mode: string ): Promise<
        | { id: string }
        | { id: string; name: string; role: string }
    >
    {
        if( mode === 'large' )
        {
            const user: { id : string } = { id : 'u-1', name : 'Alice', role : 'admin' } as any;

            return user;
        }

        const user: { id : string } = { id : 'u-2' };

        return user;
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

    it( 'should preserve all properties when returning from Promise<object | string | null>', async () =>
    {
        const resObj = await server.fetch( new Request( 'http://localhost/branches/payment-terms?mode=obj' ));
        expect( resObj.status ).toBe( 200 );
        expect( await resObj.json()).toEqual({ terms : 'net-30', amount : 1500, nested : { approved : true } });

        const resPartial = await server.fetch( new Request( 'http://localhost/branches/payment-terms?mode=partial' ));
        expect( resPartial.status ).toBe( 200 );
        expect( await resPartial.json()).toEqual({ terms : 'net-60', extraDynamic : 42 });

        const resEmpty = await server.fetch( new Request( 'http://localhost/branches/payment-terms?mode=empty' ));
        expect( resEmpty.status ).toBe( 200 );
        expect( await resEmpty.json()).toBe( '' );
    });

    it( 'should select largest matching shape and preserve all properties across competing union shapes', async () =>
    {
        const resLarge = await server.fetch( new Request( 'http://localhost/branches/competing-shapes?mode=large' ));
        expect( resLarge.status ).toBe( 200 );
        expect( await resLarge.json()).toEqual({
            id     : 'item-1',
            name   : 'Large Item',
            amount : 999,
            nested : { a : 1, b : 2 }
        });

        const resMed = await server.fetch( new Request( 'http://localhost/branches/competing-shapes?mode=medium' ));
        expect( resMed.status ).toBe( 200 );
        expect( await resMed.json()).toEqual({
            id   : 'item-2',
            name : 'Medium Item'
        });

        const resSmall = await server.fetch( new Request( 'http://localhost/branches/competing-shapes?mode=small' ));
        expect( resSmall.status ).toBe( 200 );
        expect( await resSmall.json()).toEqual({
            id : 'item-3'
        });

        const resEmpty = await server.fetch( new Request( 'http://localhost/branches/competing-shapes?mode=other' ));
        expect( resEmpty.status ).toBe( 200 );
        expect( await resEmpty.json()).toEqual({});
    });

    it( 'should preserve large shape properties when declared union includes large shape even if branch variable is typed as base shape', async () =>
    {
        const resLarge = await server.fetch( new Request( 'http://localhost/branches/declared-base-returns-large?mode=large' ));
        expect( resLarge.status ).toBe( 200 );
        expect( await resLarge.json()).toEqual({
            id   : 'u-1',
            name : 'Alice',
            role : 'admin'
        });

        const resSmall = await server.fetch( new Request( 'http://localhost/branches/declared-base-returns-large?mode=small' ));
        expect( resSmall.status ).toBe( 200 );
        expect( await resSmall.json()).toEqual({
            id : 'u-2'
        });
    });
});
