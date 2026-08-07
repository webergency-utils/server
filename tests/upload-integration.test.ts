import { describe, it, expect, vi } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { validators } from '@webergency-utils/typechecker';
import { RequestProcessor } from '../src/core/request-processor.js';
import { ApplicationRegistry, runWithRegistry } from '../src/core/registry.js';
import type { AugmentedRequest, EndpointMetadata } from '../src/core/types.js';
import { UploadedFile } from '../src/helpers/multipart.js';

function multipartBody( boundary: string, parts: string[]): Buffer
{
    let body = '';

    for( const part of parts )
    {
        body += `--${boundary}\r\n${part}\r\n`;
    }

    body += `--${boundary}--\r\n`;

    return Buffer.from( body, 'utf8' );
}

function createUploadRequest( body: Buffer, boundary: string, files?: any ): AugmentedRequest
{
    const stream = new ReadableStream<Uint8Array>({
        start( controller )
        {
            controller.enqueue( body );
            controller.close();
        }
    });

    return {
        method  : 'POST',
        headers : {
            get     : ( name: string ) => name.toLowerCase() === 'content-type'
                ? `multipart/form-data; boundary=${boundary}`
                : null,
            entries : () => [][Symbol.iterator]()
        },
        body    : stream,
        params  : {},
        query   : {},
        files
    } as unknown as AugmentedRequest;
}

describe( 'RequestProcessor @File upload', () =>
{
    it( 'injects UploadedFile from multipart into the handler', async () =>
    {
        const dir = await mkdtemp( join( tmpdir(), 'wu-rp-' ));
        const boundary = 'rp';
        const body = multipartBody( boundary, [
            'Content-Disposition: form-data; name="avatar"; filename="a.png"\r\nContent-Type: image/png\r\n\r\nPNGDATA'
        ]);

        try
        {
            const registry = new ApplicationRegistry();
            let seen: UploadedFile | undefined;

            registry.registerController( 'UploadCtrl', {
                save : ( file: UploadedFile ) =>
                {
                    seen = file;

                    return { path : file.path, size : file.size };
                }
            });

            const meta: EndpointMetadata =
            {
                controller   : 'UploadCtrl',
                methodName   : 'save',
                httpMethod   : 'POST',
                path         : '/upload',
                params       : [{ source : 'File', name : 'avatar' }],
                guards       : [],
                interceptors : [],
                middlewares  : [],
                meta         : {},
                files        : { dest : dir, filename : 'avatar.png' }
            };

            const req = createUploadRequest( body, boundary );
            req.files = meta.files;

            const res = await runWithRegistry( registry, () =>
                RequestProcessor.execute( meta, req, { maxBodySize : '1mb' }));

            expect( res.status ).toBe( 200 );
            expect( seen?.filename ).toBe( 'a.png' );
            const { realpath } = await import( 'node:fs/promises' );
            const expectedPath = join( await realpath( dir ), 'avatar.png' );
            expect( seen?.path ).toBe( expectedPath );
            expect( await readFile( expectedPath, 'utf8' )).toBe( 'PNGDATA' );
            expect( await res.json()).toEqual({ path : expectedPath, size : 7 });
        }
        finally
        {
            await rm( dir, { recursive : true, force : true });
        }
    });

    it( 'rejects @File without a field name', async () =>
    {
        const registry = new ApplicationRegistry();
        registry.registerController( 'BadCtrl', {
            save : () => ({})
        });

        const meta: EndpointMetadata =
        {
            controller   : 'BadCtrl',
            methodName   : 'save',
            httpMethod   : 'POST',
            path         : '/upload',
            params       : [{ source : 'File' }],
            guards       : [],
            interceptors : [],
            middlewares  : [],
            meta         : {}
        };

        const boundary = 'b';
        const body = multipartBody( boundary, [
            'Content-Disposition: form-data; name="f"; filename="a.txt"\r\n\r\nx'
        ]);
        const req = createUploadRequest( body, boundary, { storage : 'memory' });

        const res = await runWithRegistry( registry, () =>
            RequestProcessor.execute( meta, req ));

        expect( res.status ).toBe( 500 );
        expect( await res.json()).toMatchObject({ error : expect.stringContaining( '@File parameter requires a field name' ) });
    });
});

describe( 'RequestProcessor @Body multipart', () =>
{
    it( 'injects a query-shaped bag (toObject) for multipart/form-data', async () =>
    {
        const boundary = 'mpay';
        const body = multipartBody( boundary, [
            'Content-Disposition: form-data; name="title"\r\n\r\nhello',
            'Content-Disposition: form-data; name="avatar"; filename="a.png"\r\nContent-Type: image/png\r\n\r\nPNGDATA'
        ]);

        const registry = new ApplicationRegistry();
        let seen: Record<string, unknown> | undefined;

        registry.registerController( 'MpCtrl', {
            save : ( data: Record<string, unknown> ) =>
            {
                seen = data;
                const avatar = data.avatar as UploadedFile;

                return {
                    title  : data.title,
                    avatar : avatar?.filename,
                    size   : avatar?.size
                };
            }
        });

        const meta: EndpointMetadata =
        {
            controller   : 'MpCtrl',
            methodName   : 'save',
            httpMethod   : 'POST',
            path         : '/upload',
            params       : [{ source : 'Body' }],
            guards       : [],
            interceptors : [],
            middlewares  : [],
            meta         : {},
            files        : { storage : 'memory' }
        };

        const req = createUploadRequest( body, boundary );
        req.files = meta.files;

        const res = await runWithRegistry( registry, () =>
            RequestProcessor.execute( meta, req, { maxBodySize : '1mb' }));

        expect( res.status ).toBe( 200 );
        expect( seen?.title ).toBe( 'hello' );
        expect( seen?.avatar ).toBeInstanceOf( UploadedFile );
        expect( await res.json()).toEqual({ title : 'hello', avatar : 'a.png', size : 7 });
    });

    it( 'assert-validates multipart with from:query (coerce + UploadedFile)', async () =>
    {
        const boundary = 'mpv';
        const body = multipartBody( boundary, [
            'Content-Disposition: form-data; name="title"\r\n\r\nhello',
            'Content-Disposition: form-data; name="age"\r\n\r\n30',
            'Content-Disposition: form-data; name="documents"; filename="1.txt"\r\nContent-Type: text/plain\r\n\r\none'
        ]);

        const seenFrom: { from?: unknown } = {};
        const validator = vi.fn(( v: unknown, path: string, ctx: { from?: unknown, success: boolean, errors: unknown[], mode: string }) =>
        {
            seenFrom.from = ctx.from;

            if( !validators.object( v, path, ctx as never, [ 'title', 'age', 'documents' ]))
            {
                return v;
            }

            validators.props( v, v, path, ctx as never, [
                [ 'title', false, validators.string ],
                [ 'age', false, validators.number ],
                [ 'documents', false, ( item: unknown, itemPath: string, itemCtx: any ) =>
                    validators.array( item, itemPath, itemCtx, ( el: unknown, elPath: string, elCtx: any ) =>
                        validators.instanceOf( el, elPath, elCtx, UploadedFile )
                    )
                ]
            ]);

            return v;
        });

        const registry = new ApplicationRegistry();
        let seen: any;

        registry.registerController( 'MpValCtrl', {
            save : ( data: any ) =>
            {
                seen = data;

                return {
                    title : data.title,
                    age   : data.age,
                    files : data.documents?.length,
                    name  : data.documents?.[0]?.filename
                };
            }
        });

        const meta: EndpointMetadata =
        {
            controller   : 'MpValCtrl',
            methodName   : 'save',
            httpMethod   : 'POST',
            path         : '/upload',
            params       : [{ source : 'Body', validator, mode : 'strip' }],
            guards       : [],
            interceptors : [],
            middlewares  : [],
            meta         : {},
            files        : { storage : 'memory' }
        };

        const req = createUploadRequest( body, boundary );
        req.files = meta.files;

        const res = await runWithRegistry( registry, () =>
            RequestProcessor.execute( meta, req, { maxBodySize : '1mb' }));

        expect( res.status ).toBe( 200 );
        expect( seenFrom.from ).toBe( 'query' );
        expect( seen.age ).toBe( 30 );
        expect( seen.documents[0]).toBeInstanceOf( UploadedFile );
        expect( await res.json()).toEqual({ title : 'hello', age : 30, files : 1, name : '1.txt' });
    });
});
