import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer as createNodeServer } from 'node:http';
import { Server } from '../server.js';
import { ApplicationRegistry, runWithRegistry } from '../core/registry.js';
import { validators } from '@webergency-utils/typechecker';
import { UploadedFile } from '../helpers/multipart.js';
import type { EndpointMetadata } from '../core/types.js';

/** Wire multipart body (`part` = headers + `\r\n\r\n` + value). */
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

function multipartRequest( url: string, boundary: string, parts: string[]): Request
{
    const body = multipartBody( boundary, parts );

    return new Request( url, {
        method  : 'POST',
        headers : { 'content-type' : `multipart/form-data; boundary=${boundary}` },
        body
    });
}

function setupServer(
    setup   : ( registry: ApplicationRegistry ) => void,
    options : Record<string, any> = {}
): Server
{
    const server = new Server({ port : 0, ...options });
    runWithRegistry( server.registry, () => setup( server.registry ));

    return server;
}

function endpoint(
    methodName: string,
    path: string,
    params: EndpointMetadata['params'],
    files?: EndpointMetadata['files']
): EndpointMetadata
{
    return {
        controller   : 'C',
        methodName,
        httpMethod   : 'POST',
        path,
        params,
        guards       : [],
        interceptors : [],
        middlewares  : [],
        meta         : {},
        files
    };
}

describe( 'multipart HTTP (Server.fetch)', () =>
{
    it( 'uploads a file via @File with FormData', async () =>
    {
        const dir = await mkdtemp( join( tmpdir(), 'wu-http-file-' ));

        try
        {
            const server = setupServer( registry =>
            {
                registry.registerController( 'C', {
                    save : ( file: UploadedFile ) => ({
                        field    : file.field,
                        filename : file.filename,
                        size     : file.size,
                        path     : file.path
                    })
                });
                registry.registerEndpoint( endpoint( 'save', '/upload', [{ source : 'File', name : 'avatar' }], {
                    dest     : dir,
                    filename : 'avatar.bin'
                }));
            }, { files : { dest : dir } });

            const form = new FormData();
            form.append( 'avatar', new Blob([ 'PNGDATA' ], { type : 'image/png' }), 'a.png' );

            const res = await server.fetch( new Request( 'http://localhost/upload', {
                method : 'POST',
                body   : form
            }));

            expect( res.status ).toBe( 200 );
            const json = await res.json();
            expect( json.filename ).toBe( 'a.png' );
            expect( json.size ).toBe( 7 );
            expect( json.path ).toBeTruthy();
            expect( await readFile( json.path, 'utf8' )).toBe( 'PNGDATA' );
        }
        finally
        {
            await rm( dir, { recursive : true, force : true });
        }
    });

    it( 'injects @Body bag from FormData (duplicate bare names → arrays)', async () =>
    {
        const server = setupServer( registry =>
        {
            registry.registerController( 'C', {
                save : ( data: any ) => ({
                    title : data.title,
                    tags  : data.tag,
                    docs  : Array.isArray( data.docs )
                        ? data.docs.map(( f: UploadedFile ) => f.filename )
                        : [ data.docs?.filename ]
                })
            });
            registry.registerEndpoint( endpoint( 'save', '/bag', [{ source : 'Body' }], {
                storage : 'memory'
            }));
        });

        const form = new FormData();
        form.append( 'title', 'hello' );
        form.append( 'tag', 'red' );
        form.append( 'tag', 'blue' );
        form.append( 'docs', new Blob([ 'A' ], { type : 'text/plain' }), 'a.txt' );
        form.append( 'docs', new Blob([ 'B' ], { type : 'text/plain' }), 'b.txt' );

        const res = await server.fetch( new Request( 'http://localhost/bag', {
            method : 'POST',
            body   : form
        }));

        expect( res.status ).toBe( 200 );
        expect( await res.json()).toEqual({
            title : 'hello',
            tags  : [ 'red', 'blue' ],
            docs  : [ 'a.txt', 'b.txt' ]
        });
    });

    it( 'unflattens bracket field names on @Body via raw multipart', async () =>
    {
        const server = setupServer( registry =>
        {
            registry.registerController( 'C', {
                save : ( data: any ) => ({
                    name : data.profile?.name,
                    age  : data.profile?.age,
                    docs : data.docs?.map(( f: UploadedFile ) => f.filename )
                })
            });
            registry.registerEndpoint( endpoint( 'save', '/profile', [{ source : 'Body' }], {
                storage : 'memory'
            }));
        });

        const res = await server.fetch( multipartRequest( 'http://localhost/profile', 'br', [
            'Content-Disposition: form-data; name="profile[name]"\r\n\r\nAda',
            'Content-Disposition: form-data; name="profile[age]"\r\n\r\n30',
            'Content-Disposition: form-data; name="docs[]"; filename="a.txt"\r\nContent-Type: text/plain\r\n\r\nA',
            'Content-Disposition: form-data; name="docs[]"; filename="b.txt"\r\nContent-Type: text/plain\r\n\r\nB'
        ]));

        expect( res.status ).toBe( 200 );
        expect( await res.json()).toEqual({
            name : 'Ada',
            age  : '30',
            docs : [ 'a.txt', 'b.txt' ]
        });
    });

    it( 'assert-validates multipart @Body with from:query over HTTP', async () =>
    {
        const validator = ( v: unknown, path: string, ctx: any ) =>
        {
            if( !validators.object( v, path, ctx, [ 'title', 'age', 'documents' ]))
            {
                return v;
            }

            validators.props( v, v, path, ctx, [
                [ 'title', false, validators.string ],
                [ 'age', false, validators.number ],
                [ 'documents', false, ( item: unknown, itemPath: string, itemCtx: any ) =>
                    validators.array( item, itemPath, itemCtx, ( el: unknown, elPath: string, elCtx: any ) =>
                        validators.instanceOf( el, elPath, elCtx, UploadedFile )
                    )
                ]
            ]);

            return v;
        };

        const server = setupServer( registry =>
        {
            registry.registerController( 'C', {
                save : ( data: any ) => ({
                    title : data.title,
                    age   : data.age,
                    files : data.documents.length,
                    name  : data.documents[0].filename
                })
            });
            registry.registerEndpoint( endpoint( 'save', '/typed', [
                { source : 'Body', validator, mode : 'strip' }
            ], { storage : 'memory' }));
        });

        const res = await server.fetch( multipartRequest( 'http://localhost/typed', 'tv', [
            'Content-Disposition: form-data; name="title"\r\n\r\nhello',
            'Content-Disposition: form-data; name="age"\r\n\r\n30',
            'Content-Disposition: form-data; name="documents"; filename="1.txt"\r\nContent-Type: text/plain\r\n\r\none'
        ]));

        expect( res.status ).toBe( 200 );
        expect( await res.json()).toEqual({
            title : 'hello',
            age   : 30,
            files : 1,
            name  : '1.txt'
        });
    });

    it( 'recurses nested multipart/mixed under a prefix over HTTP', async () =>
    {
        const inner = 'inner';
        const nestedMime = [
            `--${inner}`,
            'Content-Disposition: form-data; name="child"\r\n',
            'nested-value',
            `--${inner}`,
            'Content-Disposition: form-data; name="file"; filename="n.txt"\r\nContent-Type: text/plain\r\n',
            'NEST',
            `--${inner}--`
        ].join( '\r\n' );

        const server = setupServer( registry =>
        {
            registry.registerController( 'C', {
                save : ( data: any ) => ({
                    title  : data.title,
                    child  : data.bundle?.child,
                    nested : data.bundle?.file?.filename,
                    bytes  : data.bundle?.file?.buffer?.toString()
                })
            });
            registry.registerEndpoint( endpoint( 'save', '/nested', [{ source : 'Body' }], {
                storage : 'memory'
            }));
        });

        const res = await server.fetch( multipartRequest( 'http://localhost/nested', 'outer', [
            'Content-Disposition: form-data; name="title"\r\n\r\nhello',
            `Content-Disposition: form-data; name="bundle"\r\nContent-Type: multipart/mixed; boundary=${inner}\r\n\r\n${nestedMime}`
        ]));

        expect( res.status ).toBe( 200 );
        expect( await res.json()).toEqual({
            title  : 'hello',
            child  : 'nested-value',
            nested : 'n.txt',
            bytes  : 'NEST'
        });
    });

    it( 'keeps over-depth nested multipart opaque over HTTP', async () =>
    {
        const b1 = 'd1';
        const b2 = 'd2';
        const b3 = 'd3';
        const b4 = 'd4';
        const level1 = `--${b1}\r\nContent-Disposition: form-data; name="v"\r\n\r\ndeep\r\n--${b1}--`;
        const level2 = `--${b2}\r\nContent-Disposition: form-data; name="l2"\r\nContent-Type: multipart/mixed; boundary=${b1}\r\n\r\n${level1}\r\n--${b2}--`;
        const level3 = `--${b3}\r\nContent-Disposition: form-data; name="l3"\r\nContent-Type: multipart/mixed; boundary=${b2}\r\n\r\n${level2}\r\n--${b3}--`;
        const level4 = `--${b4}\r\nContent-Disposition: form-data; name="l4"\r\nContent-Type: multipart/mixed; boundary=${b3}\r\n\r\n${level3}\r\n--${b4}--`;

        const server = setupServer( registry =>
        {
            registry.registerController( 'C', {
                save : ( data: any ) => ({
                    kind : typeof data.top?.l4?.l3?.l2,
                    hasV : data.top?.l4?.l3?.l2?.v !== undefined,
                    raw  : typeof data.top?.l4?.l3?.l2 === 'string'
                        ? data.top.l4.l3.l2.includes( 'deep' )
                        : false
                })
            });
            registry.registerEndpoint( endpoint( 'save', '/deep', [{ source : 'Body' }], {
                storage : 'memory'
            }));
        });

        const res = await server.fetch( multipartRequest( 'http://localhost/deep', 'root', [
            `Content-Disposition: form-data; name="top"\r\nContent-Type: multipart/mixed; boundary=${b4}\r\n\r\n${level4}`
        ]));

        expect( res.status ).toBe( 200 );
        expect( await res.json()).toEqual({ kind : 'string', hasV : false, raw : true });
    });
});

describe( 'multipart HTTP (real Node listen + fetch)', () =>
{
    let baseUrl: string;
    let close: () => Promise<void>;

    beforeEach( async() =>
    {
        const server = setupServer( registry =>
        {
            registry.registerController( 'C', {
                echo : ( data: any ) => ({
                    title  : data.title,
                    name   : data.profile?.name,
                    child  : data.bundle?.child,
                    docs   : ( Array.isArray( data.docs ) ? data.docs : data.docs ? [ data.docs ] : [])
                        .map(( f: UploadedFile ) => ({ filename : f.filename, size : f.size }))
                })
            });
            registry.registerEndpoint( endpoint( 'echo', '/echo', [{ source : 'Body' }], {
                storage : 'memory'
            }));
        }, { files : { storage : 'memory' } });

        // Bridge Server.fetch through a real Node HTTP listener so clients use network fetch.
        const node = createNodeServer( async( req, res ) =>
        {
            const chunks: Buffer[] = [];

            for await ( const chunk of req )
            {
                chunks.push( Buffer.isBuffer( chunk ) ? chunk : Buffer.from( chunk ));
            }

            const url = `http://127.0.0.1${req.url || '/'}`;
            const headers = new Headers();

            for( const [ key, value ] of Object.entries( req.headers ))
            {
                if( value === undefined ){ continue }

                if( Array.isArray( value ))
                {
                    for( const v of value )
                    {
                        headers.append( key, v );
                    }
                }
                else
                {
                    headers.set( key, value );
                }
            }

            const method = req.method || 'GET';
            const body = method === 'GET' || method === 'HEAD'
                ? undefined
                : Buffer.concat( chunks );

            const response = await server.fetch( new Request( url, { method, headers, body }));
            res.statusCode = response.status;
            response.headers.forEach(( value, key ) =>
            {
                if( key.toLowerCase() === 'transfer-encoding' ){ return }

                res.setHeader( key, value );
            });
            const buf = Buffer.from( await response.arrayBuffer());
            res.end( buf );
        });

        await new Promise<void>( resolve => node.listen( 0, '127.0.0.1', () => resolve()));
        const addr = node.address();

        if( !addr || typeof addr === 'string' )
        {
            throw new Error( 'failed to bind test HTTP server' );
        }

        baseUrl = `http://127.0.0.1:${addr.port}`;
        close = () => new Promise( resolve => node.close(() => resolve()));
    });

    afterEach( async() =>
    {
        await close();
    });

    it( 'accepts FormData over the network', async () =>
    {
        const form = new FormData();
        form.append( 'title', 'net' );
        form.append( 'profile[name]', 'Ada' );
        form.append( 'docs', new Blob([ 'X' ], { type : 'text/plain' }), 'x.txt' );
        form.append( 'docs', new Blob([ 'Y' ], { type : 'text/plain' }), 'y.txt' );

        const res = await fetch( `${baseUrl}/echo`, { method : 'POST', body : form });

        expect( res.status ).toBe( 200 );
        expect( await res.json()).toEqual({
            title : 'net',
            name  : 'Ada',
            docs  : [
                { filename : 'x.txt', size : 1 },
                { filename : 'y.txt', size : 1 }
            ]
        });
    });

    it( 'accepts raw nested multipart over the network', async () =>
    {
        const inner = 'in';
        const nested = `--${inner}\r\nContent-Disposition: form-data; name="child"\r\n\r\nval\r\n--${inner}--`;
        const boundary = 'out';
        const body = multipartBody( boundary, [
            'Content-Disposition: form-data; name="title"\r\n\r\nraw',
            `Content-Disposition: form-data; name="profile[name]"\r\n\r\nBob`,
            `Content-Disposition: form-data; name="bundle"\r\nContent-Type: multipart/mixed; boundary=${inner}\r\n\r\n${nested}`
        ]);

        const res = await fetch( `${baseUrl}/echo`, {
            method  : 'POST',
            headers : { 'content-type' : `multipart/form-data; boundary=${boundary}` },
            body
        });

        expect( res.status ).toBe( 200 );
        expect( await res.json()).toEqual({
            title : 'raw',
            name  : 'Bob',
            child : 'val',
            docs  : []
        });
    });
});
