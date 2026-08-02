import { describe, it, expect } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { MultiBuffer } from '../helpers/multibuffer.js';
import { MultipartParser, parseMultipartStream, MultipartPayload, UploadedFile } from '../helpers/multipart.js';
import { mergeFileConfigs, processMultipartUpload } from '../helpers/file-upload.js';
import { ServerRequest } from '../core/server-request.js';
import type { AugmentedRequest } from '../core/types.js';

/** Build a wire multipart body (`part` = headers + `\r\n\r\n` + value, no trailing CRLF). */
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

function streamFrom( buffer: Buffer ): ReadableStream<Uint8Array>
{
    return new ReadableStream({
        start( controller )
        {
            // Feed in small chunks to exercise MultiBuffer boundary straddling
            const size = 7;

            for( let i = 0; i < buffer.length; i += size )
            {
                controller.enqueue( buffer.subarray( i, Math.min( i + size, buffer.length )));
            }

            controller.close();
        }
    });
}

describe( 'MultiBuffer', () =>
{
    it( 'indexes and splices across chunk boundaries', () =>
    {
        const mb = new MultiBuffer( Buffer.from( 'hel' ), Buffer.from( 'lo world' ));

        expect( mb.length ).toBe( 11 );
        expect( mb.indexOf( Buffer.from( 'lo w' ))).toBe( 3 );
        expect( mb.equals( Buffer.from( 'world' ), 6 )).toBe( true );

        const removed = mb.spliceConcat( 0, 6 );
        expect( removed.toString()).toBe( 'hello ' );
        expect( mb.spliceConcat( 0, mb.length ).toString()).toBe( 'world' );
    });

    it( 'partialIndexOf finds a trailing prefix', () =>
    {
        const mb = new MultiBuffer( Buffer.from( 'xxab' ));

        expect( mb.partialIndexOf( Buffer.from( 'abcd' ))).toBe( 2 );
    });

    it( 'compacts many small chunks', () =>
    {
        const mb = new MultiBuffer();

        for( let i = 0; i < 40; i++ )
        {
            mb.append( Buffer.from( 'x' ));
        }

        expect( mb.chunkCount ).toBe( 40 );
        mb.compact();
        expect( mb.chunkCount ).toBe( 1 );
        expect( mb.length ).toBe( 40 );
        expect( mb.spliceConcat( 0, mb.length ).toString()).toBe( 'x'.repeat( 40 ));
    });
});

describe( 'MultipartParser', () =>
{
    it( 'parses fields and files from a chunked body', async () =>
    {
        const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
        const body = multipartBody( boundary, [
            'Content-Disposition: form-data; name="title"\r\n\r\nhello',
            'Content-Disposition: form-data; name="file"; filename="a.txt"\r\nContent-Type: text/plain\r\n\r\nfile-bytes'
        ]);

        const result = await parseMultipartStream(
            streamFrom( body ),
            `multipart/form-data; boundary=${boundary}`
        );

        expect( result.fields.title ).toBe( 'hello' );
        expect( result.files ).toHaveLength( 1 );
        expect( result.files[0].filename ).toBe( 'a.txt' );
        expect( result.files[0].mime ).toBe( 'text/plain' );
        expect( result.files[0].buffer.toString()).toBe( 'file-bytes' );
        expect( result.files[0].size ).toBe( 10 );
    });

    it( 'saves files to disk when onFile calls save()', async () =>
    {
        const dir = await mkdtemp( join( tmpdir(), 'wu-upload-' ));
        const boundary = 'bound';
        const body = multipartBody( boundary, [
            'Content-Disposition: form-data; name="bin"; filename="x.bin"\r\nContent-Type: application/octet-stream\r\n\r\nABC'
        ]);

        try
        {
            const result = await parseMultipartStream(
                streamFrom( body ),
                `multipart/form-data; boundary=${boundary}`,
                {
                    onFile : ( file ) =>
                    {
                        file.save( join( dir, 'out.bin' ));
                    }
                }
            );

            expect( result.files[0].path ).toBe( join( dir, 'out.bin' ));
            expect( await readFile( result.files[0].path!, 'utf8' )).toBe( 'ABC' );
        }
        finally
        {
            await rm( dir, { recursive : true, force : true });
        }
    });

    it( 'enforces maxFileSize', async () =>
    {
        const boundary = 'b';
        const body = multipartBody( boundary, [
            'Content-Disposition: form-data; name="f"; filename="f.txt"\r\n\r\n12345'
        ]);

        await expect( parseMultipartStream(
            streamFrom( body ),
            `multipart/form-data; boundary=${boundary}`,
            { maxFileSize : 3 }
        )).rejects.toMatchObject({ status : 413 });
    });

    it( 'processMultipartUpload writes via dest', async () =>
    {
        const dir = await mkdtemp( join( tmpdir(), 'wu-dest-' ));
        const boundary = 'bb';
        const body = multipartBody( boundary, [
            'Content-Disposition: form-data; name="avatar"; filename="me.png"\r\nContent-Type: image/png\r\n\r\nPNG'
        ]);

        try
        {
            const result = await processMultipartUpload(
                streamFrom( body ),
                `multipart/form-data; boundary=${boundary}`,
                { dest : dir, filename : 'avatar.png' }
            );

            expect( result.files[0].path ).toBe( join( await ( await import( 'node:fs/promises' )).realpath( dir ), 'avatar.png' ));
            expect( await readFile( join( dir, 'avatar.png' ), 'utf8' )).toBe( 'PNG' );
        }
        finally
        {
            await rm( dir, { recursive : true, force : true });
        }
    });
});

describe( 'mergeFileConfigs', () =>
{
    it( 'merges hierarchy and per-field overrides', () =>
    {
        const merged = mergeFileConfigs([
            { dest : '/a', maxFileSize : '10mb' },
            { maxFiles : 3, fields : { avatar : { maxFileSize : '1mb' } } },
            { fields : { avatar : { dest : '/avatars' } } }
        ]);

        expect( merged?.dest ).toBe( '/a' );
        expect( merged?.maxFiles ).toBe( 3 );
        expect( merged?.fields?.avatar ).toEqual({ maxFileSize : '1mb', dest : '/avatars' });
    });
});

describe( 'MultipartParser eager flush', () =>
{
    it( 'eagerly flushes large file bodies (bounded MultiBuffer)', async () =>
    {
        const boundary = 'bnd';
        const close = Buffer.from( `\r\n--${boundary}--\r\n`, 'utf8' );
        const payload = Buffer.alloc( 64 * 1024, 0x61 ); // 64KiB of 'a'
        const header = Buffer.from(
            `--${boundary}\r\nContent-Disposition: form-data; name="f"; filename="big.bin"\r\nContent-Type: application/octet-stream\r\n\r\n`,
            'utf8'
        );

        const parser = new MultipartParser( boundary );

        parser.append( header );
        await parser.parse();

        const chunk = 1024;
        let lastSize = 0;

        for( let i = 0; i < payload.length; i += chunk )
        {
            parser.append( payload.subarray( i, i + chunk ));
            await parser.parse();
            const size = parser.result.files[0].size;
            expect( size ).toBeGreaterThanOrEqual( lastSize );
            lastSize = size;
        }

        // Mid-stream most bytes should already be in the file, not waiting for the closing boundary
        expect( lastSize ).toBeGreaterThan( payload.length - 64 );

        parser.append( close );
        const result = await parser.finish();

        expect( result.files[0].size ).toBe( payload.length );
        expect( result.files[0].buffer.equals( payload )).toBe( true );
    });
});

describe( 'MultipartParser incremental', () =>
{
    it( 'accepts append + parse in steps', async () =>
    {
        const boundary = 'x';
        const body = multipartBody( boundary, [
            'Content-Disposition: form-data; name="n"\r\n\r\nv'
        ]);
        const parser = new MultipartParser( boundary );

        for( let i = 0; i < body.length; i += 5 )
        {
            parser.append( body.subarray( i, i + 5 ));
            await parser.parse();
        }

        const result = await parser.finish();
        expect( result.fields.n ).toBe( 'v' );
    });
});

describe( 'ServerRequest.upload', () =>
{
    it( 'streams multipart via upload()', async () =>
    {
        const boundary = 'sr';
        const body = multipartBody( boundary, [
            'Content-Disposition: form-data; name="doc"; filename="d.txt"\r\nContent-Type: text/plain\r\n\r\nok'
        ]);
        const raw = new Request( 'http://localhost/u', {
            method  : 'POST',
            headers : { 'content-type' : `multipart/form-data; boundary=${boundary}` },
            body
        });
        const req = new ServerRequest( raw as AugmentedRequest, { maxBodySize : '1mb' }, { storage : 'memory' });
        const file = await req.upload( 'doc' );

        expect( file?.filename ).toBe( 'd.txt' );
        expect( file?.buffer.toString()).toBe( 'ok' );
        expect( await req.multipartFields()).toEqual({});
    });
});

describe( 'MultipartPayload', () =>
{
    it( 'unifies text fields and UploadedFile instances', async () =>
    {
        const boundary = 'mp';
        const body = multipartBody( boundary, [
            'Content-Disposition: form-data; name="title"\r\n\r\nhello',
            'Content-Disposition: form-data; name="avatar"; filename="a.png"\r\nContent-Type: image/png\r\n\r\nPNG',
            'Content-Disposition: form-data; name="docs"; filename="1.txt"\r\nContent-Type: text/plain\r\n\r\none',
            'Content-Disposition: form-data; name="docs"; filename="2.txt"\r\nContent-Type: text/plain\r\n\r\ntwo'
        ]);
        const result = await parseMultipartStream(
            new ReadableStream({
                start( c )
                {
                    c.enqueue( body );
                    c.close();
                }
            }),
            `multipart/form-data; boundary=${boundary}`
        );
        const payload = MultipartPayload.from( result );

        expect( payload.field( 'title' )).toBe( 'hello' );
        expect( payload.file( 'avatar' )?.filename ).toBe( 'a.png' );
        expect( payload.files( 'docs' )).toHaveLength( 2 );
        expect( payload.get( 'title' )).toBe( 'hello' );
        expect( payload.get( 'avatar' )).toBe( payload.file( 'avatar' ));
        expect( Array.isArray( payload.get( 'docs' ))).toBe( true );

        const obj = payload.toObject();
        expect( obj.title ).toBe( 'hello' );
        expect( obj.avatar ).toBeInstanceOf( UploadedFile );
        // Duplicate part names without `[]` still become arrays (same as QueryParser).
        expect( Array.isArray( obj.docs )).toBe( true );
        expect( obj.docs ).toHaveLength( 2 );
        expect( obj.docs.map(( f: UploadedFile ) => f.filename )).toEqual([ '1.txt', '2.txt' ]);
        expect( obj.docs[0]).toBeInstanceOf( UploadedFile );
    });

    it( 'is returned from ServerRequest.payload()', async () =>
    {
        const boundary = 'srp';
        const body = multipartBody( boundary, [
            'Content-Disposition: form-data; name="note"\r\n\r\nhi',
            'Content-Disposition: form-data; name="f"; filename="x.bin"\r\nContent-Type: application/octet-stream\r\n\r\nab'
        ]);
        const raw = new Request( 'http://localhost/u', {
            method  : 'POST',
            headers : { 'content-type' : `multipart/form-data; boundary=${boundary}` },
            body
        });
        const req = new ServerRequest( raw as AugmentedRequest, { maxBodySize : '1mb' }, { storage : 'memory' });
        const payload = await req.payload();

        expect( payload ).toBeInstanceOf( MultipartPayload );
        expect( payload.field( 'note' )).toBe( 'hi' );
        expect( payload.file( 'f' )?.buffer.toString()).toBe( 'ab' );
        expect( await req.payload()).toBe( payload );
    });
});

/**
 * Nested MIME (`multipart/*` part bodies) is re-parsed with a bracket prefix
 * (`bundle` + `child` → `bundle[child]`), up to {@link MAX_MULTIPART_NEST_DEPTH}.
 */
describe( 'multipart nesting', () =>
{
    it( 'arrays duplicate bare names without brackets (text + files)', async () =>
    {
        const boundary = 'dup';
        const body = multipartBody( boundary, [
            'Content-Disposition: form-data; name="tag"\r\n\r\nred',
            'Content-Disposition: form-data; name="tag"\r\n\r\nblue',
            'Content-Disposition: form-data; name="docs"; filename="a.txt"\r\nContent-Type: text/plain\r\n\r\nA',
            'Content-Disposition: form-data; name="docs"; filename="b.txt"\r\nContent-Type: text/plain\r\n\r\nB'
        ]);
        const obj = MultipartPayload.from(
            await parseMultipartStream( streamFrom( body ), `multipart/form-data; boundary=${boundary}` )
        ).toObject();

        expect( obj.tag ).toEqual([ 'red', 'blue' ]);
        expect( obj.docs.map(( f: UploadedFile ) => f.filename )).toEqual([ 'a.txt', 'b.txt' ]);
    });

    it( 'unflattens bracket-style field names like QueryParser', async () =>
    {
        const boundary = 'br';
        const body = multipartBody( boundary, [
            'Content-Disposition: form-data; name="profile[name]"\r\n\r\nAda',
            'Content-Disposition: form-data; name="profile[age]"\r\n\r\n30',
            'Content-Disposition: form-data; name="docs[]"; filename="a.txt"\r\nContent-Type: text/plain\r\n\r\nA',
            'Content-Disposition: form-data; name="docs[]"; filename="b.txt"\r\nContent-Type: text/plain\r\n\r\nB'
        ]);
        const result = await parseMultipartStream(
            streamFrom( body ),
            `multipart/form-data; boundary=${boundary}`
        );
        const payload = MultipartPayload.from( result );
        const obj = payload.toObject();

        expect( obj.profile ).toEqual({ name : 'Ada', age : '30' });
        expect( Array.isArray( obj.docs )).toBe( true );
        expect( obj.docs.map(( f: UploadedFile ) => f.filename )).toEqual([ 'a.txt', 'b.txt' ]);
        expect( obj.docs[0]).toBeInstanceOf( UploadedFile );
        expect( payload.field( 'profile[name]' )).toBe( 'Ada' );
        expect( payload.files( 'docs[]' )).toHaveLength( 2 );
    });

    it( 'unflattens nested arrays of objects (a[][name])', async () =>
    {
        const boundary = 'na';
        const body = multipartBody( boundary, [
            'Content-Disposition: form-data; name="a[][name]"\r\n\r\nAlice',
            'Content-Disposition: form-data; name="a[][age]"\r\n\r\n30',
            'Content-Disposition: form-data; name="a[][name]"\r\n\r\nBob',
            'Content-Disposition: form-data; name="a[][file]"; filename="b.bin"\r\nContent-Type: application/octet-stream\r\n\r\nxx'
        ]);
        const result = await parseMultipartStream(
            streamFrom( body ),
            `multipart/form-data; boundary=${boundary}`
        );
        const obj = MultipartPayload.from( result ).toObject();

        expect( obj.a[0]).toEqual({ name : 'Alice', age : '30' });
        expect( obj.a[1].name ).toBe( 'Bob' );
        expect( obj.a[1].file ).toBeInstanceOf( UploadedFile );
        expect( obj.a[1].file.filename ).toBe( 'b.bin' );
    });

    it( 'recurses nested multipart/mixed under a bracket prefix', async () =>
    {
        const outer = 'outer';
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
        const body = multipartBody( outer, [
            'Content-Disposition: form-data; name="title"\r\n\r\nhello',
            `Content-Disposition: form-data; name="bundle"\r\nContent-Type: multipart/mixed; boundary=${inner}\r\n\r\n${nestedMime}`
        ]);
        const result = await parseMultipartStream(
            streamFrom( body ),
            `multipart/form-data; boundary=${outer}`
        );
        const payload = MultipartPayload.from( result );
        const obj = payload.toObject();

        expect( obj.title ).toBe( 'hello' );
        expect( obj.bundle ).toEqual({
            child : 'nested-value',
            file  : expect.any( UploadedFile )
        });
        expect( obj.bundle.file.filename ).toBe( 'n.txt' );
        expect( payload.field( 'bundle[child]' )).toBe( 'nested-value' );
        expect( payload.file( 'bundle[file]' )?.buffer.toString()).toBe( 'NEST' );
    });

    it( 'recurses nested multipart even when the container has a filename', async () =>
    {
        const outer = 'out';
        const inner = 'in';
        const nestedMime = `--${inner}\r\nContent-Disposition: form-data; name="x"\r\n\r\ny\r\n--${inner}--`;
        const body = multipartBody( outer, [
            `Content-Disposition: form-data; name="archive"; filename="bundle.mime"\r\nContent-Type: multipart/mixed; boundary=${inner}\r\n\r\n${nestedMime}`
        ]);
        const result = await parseMultipartStream(
            streamFrom( body ),
            `multipart/form-data; boundary=${outer}`
        );
        const obj = MultipartPayload.from( result ).toObject();

        expect( obj.archive ).toEqual({ x : 'y' });
        expect( result.files ).toHaveLength( 0 );
    });

    it( 'caps nested multipart recursion at MAX_MULTIPART_NEST_DEPTH', async () =>
    {
        // root(0) → top(1) → l4(2) → l3(3) → l2 multipart would be depth 4 → opaque
        const b1 = 'd1';
        const b2 = 'd2';
        const b3 = 'd3';
        const b4 = 'd4';
        const level1 = `--${b1}\r\nContent-Disposition: form-data; name="v"\r\n\r\ndeep\r\n--${b1}--`;
        const level2 = `--${b2}\r\nContent-Disposition: form-data; name="l2"\r\nContent-Type: multipart/mixed; boundary=${b1}\r\n\r\n${level1}\r\n--${b2}--`;
        const level3 = `--${b3}\r\nContent-Disposition: form-data; name="l3"\r\nContent-Type: multipart/mixed; boundary=${b2}\r\n\r\n${level2}\r\n--${b3}--`;
        const level4 = `--${b4}\r\nContent-Disposition: form-data; name="l4"\r\nContent-Type: multipart/mixed; boundary=${b3}\r\n\r\n${level3}\r\n--${b4}--`;
        const root = 'root';
        const wire = multipartBody( root, [
            `Content-Disposition: form-data; name="top"\r\nContent-Type: multipart/mixed; boundary=${b4}\r\n\r\n${level4}`
        ]);
        const obj = MultipartPayload.from(
            await parseMultipartStream( streamFrom( wire ), `multipart/form-data; boundary=${root}` )
        ).toObject();

        expect( typeof obj.top.l4.l3.l2 ).toBe( 'string' );
        expect( obj.top.l4.l3.l2 ).toContain( 'deep' );
        expect( obj.top.l4.l3.l2 ).toContain( `--${b1}` );
        expect( obj.top.l4.l3.l2.v ).toBeUndefined();
    });
});

describe( 'multipart abort / dest / cleanup', () =>
{
    it( 'aborts mid-stream when signal fires', async () =>
    {
        const boundary = 'ab';
        const payload = Buffer.alloc( 32 * 1024, 0x62 );
        const header = Buffer.from(
            `--${boundary}\r\nContent-Disposition: form-data; name="f"; filename="a.bin"\r\n\r\n`,
            'utf8'
        );
        const close = Buffer.from( `\r\n--${boundary}--\r\n`, 'utf8' );
        const body = Buffer.concat([ header, payload, close ]);
        const controller = new AbortController();

        const stream = new ReadableStream<Uint8Array>({
            async start( c )
            {
                c.enqueue( body.subarray( 0, 1024 ));
                controller.abort();
                c.enqueue( body.subarray( 1024 ));
                c.close();
            }
        });

        await expect( parseMultipartStream(
            stream,
            `multipart/form-data; boundary=${boundary}`,
            { signal : controller.signal, maxFileSize : payload.length }
        )).rejects.toMatchObject({ status : 408 });
    });

    it( 'keeps upload paths inside dest when filename contains ..', async () =>
    {
        const dir = await mkdtemp( join( tmpdir(), 'wu-escape-' ));
        const boundary = 'esc';
        const body = multipartBody( boundary, [
            'Content-Disposition: form-data; name="f"; filename="x.txt"\r\n\r\nok'
        ]);

        try
        {
            const result = await processMultipartUpload(
                streamFrom( body ),
                `multipart/form-data; boundary=${boundary}`,
                {
                    dest     : dir,
                    filename : () => join( '..', 'outside.txt' )
                }
            );

            const { realpath } = await import( 'node:fs/promises' );
            expect( result.files[0].path ).toBe( join( await realpath( dir ), 'outside.txt' ));
            expect( await readFile( result.files[0].path!, 'utf8' )).toBe( 'ok' );
        }
        finally
        {
            await rm( dir, { recursive : true, force : true });
        }
    });

    it( 'cleans up partial disk files when parse fails', async () =>
    {
        const dir = await mkdtemp( join( tmpdir(), 'wu-clean-' ));
        const boundary = 'cl';
        // incomplete body — no closing boundary
        const body = Buffer.from(
            `--${boundary}\r\nContent-Disposition: form-data; name="f"; filename="x.txt"\r\n\r\npartial`,
            'utf8'
        );

        try
        {
            await expect( processMultipartUpload(
                streamFrom( body ),
                `multipart/form-data; boundary=${boundary}`,
                { dest : dir, filename : 'gone.txt' }
            )).rejects.toMatchObject({ status : 400 });

            const { readdir } = await import( 'node:fs/promises' );
            expect( await readdir( dir )).toEqual([]);
        }
        finally
        {
            await rm( dir, { recursive : true, force : true });
        }
    });
});
