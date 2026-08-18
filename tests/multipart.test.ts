import { describe, it, expect } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { MultiBuffer } from '../src/helpers/multibuffer.js';
import
{
    MultipartParser,
    parseMultipartStream,
    MultipartPayload,
    UploadedFile,
    nestFieldName,
    cleanupUploadedFiles
}
from '../src/helpers/multipart.js';
import { mergeFileConfigs, processMultipartUpload } from '../src/helpers/file-upload.js';
import { ServerRequest } from '../src/core/server-request.js';
import type { AugmentedRequest } from '../src/core/types.js';

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

    it( 'clears buffered chunks', () =>
    {
        // Arrange
        const mb = new MultiBuffer( Buffer.from( 'abc' ));

        // Act
        mb.clear();

        // Assert
        expect( mb.length ).toBe( 0 );
        expect( mb.chunkCount ).toBe( 0 );
    });

    it( 'slices with negative indices and returns empty when inverted', () =>
    {
        // Arrange
        const mb = new MultiBuffer( Buffer.from( 'abcdef' ));

        // Act
        const mid = Buffer.concat( mb.slice( -4, -1 ));
        const empty = mb.slice( 4, 2 );
        const fromEnd = Buffer.concat( mb.slice( -2 ));

        // Assert
        expect( mid.toString()).toBe( 'cde' );
        expect( empty ).toEqual([]);
        expect( fromEnd.toString()).toBe( 'ef' );
    });

    it( 'splices from a negative start index', () =>
    {
        // Arrange
        const mb = new MultiBuffer( Buffer.from( 'abcdef' ));

        // Act
        const removed = mb.splice( -3, 2 );

        // Assert
        expect( Buffer.concat( removed ).toString()).toBe( 'de' );
        expect( mb.spliceConcat( 0, mb.length ).toString()).toBe( 'abcf' );
    });

    it( 'returns misses for indexOf, equals, and partialIndexOf', () =>
    {
        // Arrange
        const mb = new MultiBuffer( Buffer.from( 'hello' ));

        // Assert
        expect( mb.indexOf( Buffer.from( 'xyz' ))).toBe( -1 );
        expect( mb.equals( Buffer.from( 'hello!' ))).toBe( false );
        expect( mb.equals( Buffer.from( 'hello' ), 1 )).toBe( false );
        expect( mb.partialIndexOf( Buffer.from( 'xyz' ))).toBe( -1 );
    });

    it( 'ignores empty buffers on append and no-ops compact when length <= 1', () =>
    {
        // Arrange
        const mb = new MultiBuffer();

        // Act
        mb.append( Buffer.alloc( 0 ), Buffer.from( '' ), Buffer.from( 'a' ));
        mb.compact();
        const singleCount = mb.chunkCount;
        mb.compact();

        // Assert
        expect( mb.length ).toBe( 1 );
        expect( singleCount ).toBe( 1 );
        expect( mb.chunkCount ).toBe( 1 );

        const empty = new MultiBuffer();
        empty.compact();
        expect( empty.chunkCount ).toBe( 0 );
    });

    it( 'should splice mid-chunk splits, multi-chunk ranges, and insert buffers', () =>
    {
        // Arrange — split one chunk into head / insert / tail
        const mid = new MultiBuffer( Buffer.from( 'abcdef' ));
        const midRemoved = mid.splice( 2, 2, Buffer.from( 'XY' ));

        // Assert
        expect( Buffer.concat( midRemoved ).toString()).toBe( 'cd' );
        expect( Buffer.concat( mid.slice()).toString()).toBe( 'abXYef' );

        // Arrange — remove from chunk start and chunk end
        const edges = new MultiBuffer( Buffer.from( '012345' ));
        expect( Buffer.concat( edges.splice( 0, 2 )).toString()).toBe( '01' );
        expect( Buffer.concat( edges.splice( edges.length - 2, 2 )).toString()).toBe( '45' );
        expect( Buffer.concat( edges.slice()).toString()).toBe( '23' );

        // Arrange — multi-chunk remove spanning boundaries with insert
        const multi = new MultiBuffer( Buffer.from( 'aa' ), Buffer.from( 'bb' ), Buffer.from( 'cc' ));
        const removed = multi.splice( 1, 4, Buffer.from( 'Z' ));

        expect( Buffer.concat( removed ).toString()).toBe( 'abbc' );
        expect( Buffer.concat( multi.slice()).toString()).toBe( 'aZc' );

        // Arrange — insert with no deletion mid-chunk and at end
        const insertMid = new MultiBuffer( Buffer.from( 'abcdef' ));
        expect( insertMid.splice( 2, 0, Buffer.from( 'XY' ))).toEqual([]);
        expect( Buffer.concat( insertMid.slice()).toString()).toBe( 'abXYcdef' );

        const append = new MultiBuffer( Buffer.from( 'hi' ));
        expect( append.splice( 2, 0, Buffer.from( '!' ))).toEqual([]);
        expect( Buffer.concat( append.slice()).toString()).toBe( 'hi!' );
        expect( append.spliceConcat( 0, 0 ).length ).toBe( 0 );

        // Arrange — string search, empty needle, negative get/indexOf, partial prefix
        const search = new MultiBuffer( Buffer.from( 'hello' ), Buffer.from( ' world' ));
        expect( search.indexOf( 'world' )).toBe( 6 );
        expect( search.indexOf( '', 2 )).toBe( 2 );
        expect( search.indexOf( '', 100 )).toBe( -1 );
        // negative offset is rewritten via `totalLength - offset` (past end → miss)
        expect( search.indexOf( 'world', -5 )).toBe( -1 );
        // negative get() rewrites the index (range end defaults to 0 → empty slice)
        expect( search.get( -1 )).toBeUndefined();
        expect( search.get( 0 )).toBeUndefined();
        expect( search.partialIndexOf( 'ldZZ' )).toBe( 9 );
        expect( search.slice()).toHaveLength( 2 );
        expect( Buffer.concat( search.slice( 0, -1 )).toString()).toBe( 'hello worl' );
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
        // Duplicate part names without `[]` still become arrays (same as parseQueryString).
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
    it( 'nestFieldName prefixes keys and preserves bracket tails', () =>
    {
        expect( nestFieldName( '', 'docs[]' )).toBe( 'docs[]' );
        expect( nestFieldName( 'bundle', 'child' )).toBe( 'bundle[child]' );
        expect( nestFieldName( 'bundle', 'docs[]' )).toBe( 'bundle[docs][]' );
        expect( nestFieldName( 'bundle', '[x]' )).toBe( 'bundle[[x]]' );

        const attack = `${'['.repeat( 50_000 )}`;
        const started = Date.now();
        const nested = nestFieldName( 'p', attack );

        expect( Date.now() - started ).toBeLessThan( 500 );
        expect( nested.startsWith( 'p[' )).toBe( true );
    });

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

    it( 'unflattens bracket-style field names like parseQueryString', async () =>
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

describe( 'UploadedFile lifecycle', () =>
{
    it( 'streams buffered bytes and rejects save after end', async () =>
    {
        // Arrange
        const file = new UploadedFile( 'f', 'a.txt', 'text/plain', {});
        await file.write( Buffer.from( 'hi' ));
        await file.end();

        // Act
        const reader = file.stream().getReader();
        const { value } = await reader.read();

        // Assert
        expect( Buffer.from( value! ).toString()).toBe( 'hi' );
        expect(() => file.save( '/tmp/nope' )).toThrow( /after part has ended/ );
        await file.end();
        await expect( file.whenEnded()).resolves.toBeUndefined();

        const empty = new UploadedFile( 'e', 'e.txt', 'text/plain', {});
        await empty.end();
        const emptyReader = empty.stream().getReader();
        const emptyRead = await emptyReader.read();
        expect( emptyRead.done ).toBe( true );
    });

    it( 'skips after save, enforces max size, and cleans up disk files', async () =>
    {
        // Arrange
        const dir = await mkdtemp( join( tmpdir(), 'wu-uf-' ));
        const path = join( dir, 'part.bin' );
        const file = new UploadedFile( 'f', 'part.bin', 'application/octet-stream', {});

        try
        {
            file.save( path );
            await file.write( Buffer.from( 'abc' ));
            file.skip();

            // Assert
            expect( file.mode ).toBe( 'skip' );
            expect( file.path ).toBeUndefined();

            const capped = new UploadedFile( 'c', 'c.bin', 'application/octet-stream', {});
            capped.setMaxSize( 2 );
            expect(() => capped.write( Buffer.from( '123' ))).toThrow( /File too large/ );

            const disk = new UploadedFile( 'd', 'd.bin', 'application/octet-stream', {});
            disk.save( join( dir, 'd.bin' ));
            await disk.write( Buffer.from( 'zz' ));
            const ended = disk.whenEnded();
            await disk.end();
            await ended;
            await disk.cleanup();

            const { readdir } = await import( 'node:fs/promises' );
            expect( await readdir( dir )).not.toContain( 'd.bin' );
        }
        finally
        {
            await rm( dir, { recursive : true, force : true });
        }
    });

    it( 'fails an open write stream and ignores empty / skip writes', async () =>
    {
        // Arrange
        const dir = await mkdtemp( join( tmpdir(), 'wu-fail-' ));
        const file = new UploadedFile( 'f', 'f.bin', 'application/octet-stream', {});

        try
        {
            file.save( join( dir, 'f.bin' ));
            // destroy(err) emits 'error' on the WriteStream — swallow to keep the test isolated
            ( file as unknown as { writeStream?: { on: ( e: string, cb: ( err: Error ) => void ) => void } })
                .writeStream?.on( 'error', () => undefined );
            file.fail( new Error( 'boom' ));

            expect(() => file.write( Buffer.from( 'x' ))).toThrow( /boom/ );

            const skipped = new UploadedFile( 's', 's.bin', 'application/octet-stream', {});
            skipped.skip();
            await skipped.write( Buffer.from( 'ignored' ));
            await skipped.write( Buffer.alloc( 0 ));
            expect( skipped.size ).toBe( 0 );
        }
        finally
        {
            await rm( dir, { recursive : true, force : true });
        }
    });
});

describe( 'MultipartPayload helpers', () =>
{
    it( 'rebuilds parts from maps and exposes has / keys / textFields', () =>
    {
        // Arrange
        const file = new UploadedFile( 'doc', 'a.txt', 'text/plain', {});
        const payload = MultipartPayload.from({
            fields : { title : 'hi', tags : [ 'a', 'b' ] },
            files  : [ file ]
        });

        // Assert
        expect( payload.has( 'title' )).toBe( true );
        expect( payload.has( 'doc' )).toBe( true );
        expect( payload.has( 'missing' )).toBe( false );
        expect( payload.keys().sort()).toEqual([ 'doc', 'tags', 'title' ]);
        expect( payload.textFields( 'tags' )).toEqual([ 'a', 'b' ]);
        expect( payload.textFields( 'title' )).toEqual([ 'hi' ]);
        expect( payload.textFields( 'missing' )).toEqual([]);
        expect( payload.field( 'missing' )).toBeUndefined();
        expect( payload.uploads ).toHaveLength( 1 );
        expect( payload.fields.title ).toBe( 'hi' );
        expect( payload.files()).toHaveLength( 1 );
        expect( payload.files( 'doc' )).toHaveLength( 1 );
    });
});

describe( 'parseMultipartStream errors and closing delimiter', () =>
{
    it( 'rejects missing boundary or body', async () =>
    {
        // Assert
        await expect( parseMultipartStream( streamFrom( Buffer.from( 'x' )), 'text/plain' ))
            .rejects.toMatchObject({ status : 400, message : expect.stringMatching( /boundary/ ) });
        await expect( parseMultipartStream( null, 'multipart/form-data; boundary=b' ))
            .rejects.toMatchObject({ status : 400, message : expect.stringMatching( /no body/i ) });
    });

    it( 'accepts closing boundary terminated with LF only', async () =>
    {
        // Arrange
        const boundary = 'lfonly';
        const body = Buffer.from(
            `--${boundary}\r\nContent-Disposition: form-data; name="n"\r\n\r\nv\r\n--${boundary}--\n`,
            'utf8'
        );

        // Act
        const result = await parseMultipartStream(
            streamFrom( body ),
            `multipart/form-data; boundary=${boundary}`
        );

        // Assert
        expect( result.fields.n ).toBe( 'v' );
    });

    it( 'enforces maxFields / maxFiles when ingesting nested multipart parts', async () =>
    {
        // Arrange — outer already at the limit; nested merge must trip ingestNestedMultipart checks
        const outer = 'nestmax';
        const inner = 'innerm';
        const nestedField = `--${inner}\r\nContent-Disposition: form-data; name="a"\r\n\r\n1\r\n--${inner}--`;
        const nestedFile = `--${inner}\r\nContent-Disposition: form-data; name="f"; filename="1.txt"\r\n\r\nA\r\n--${inner}--`;

        // Act / Assert
        await expect( parseMultipartStream(
            streamFrom( multipartBody( outer, [
                'Content-Disposition: form-data; name="keep"\r\n\r\nx',
                `Content-Disposition: form-data; name="wrap"\r\nContent-Type: multipart/mixed; boundary=${inner}\r\n\r\n${nestedField}`
            ])),
            `multipart/form-data; boundary=${outer}`,
            { maxFields : 1 }
        )).rejects.toMatchObject({ status : 413, message : expect.stringMatching( /fields/i ) });

        await expect( parseMultipartStream(
            streamFrom( multipartBody( outer, [
                'Content-Disposition: form-data; name="outer"; filename="o.txt"\r\n\r\nO',
                `Content-Disposition: form-data; name="wrap"\r\nContent-Type: multipart/mixed; boundary=${inner}\r\n\r\n${nestedFile}`
            ])),
            `multipart/form-data; boundary=${outer}`,
            { maxFiles : 1 }
        )).rejects.toMatchObject({ status : 413, message : expect.stringMatching( /files/i ) });
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

describe( 'UploadedFile unit edges', () =>
{
    it( 'should buffer, stream, enforce maxSize, and reject save after end', async () =>
    {
        // Arrange
        const file = new UploadedFile( 'f', 'a.txt', 'text/plain', {});

        // Act
        expect( file.buffer.length ).toBe( 0 );
        file.write( Buffer.from( 'ab' ));
        file.write( Buffer.from( 'cd' ));
        expect( file.buffer.toString()).toBe( 'abcd' );
        expect( file.buffer.toString()).toBe( 'abcd' );

        const chunks: Uint8Array[] = [];
        const reader = file.stream().getReader();

        while( true )
        {
            const { done, value } = await reader.read();

            if( done ){ break }

            chunks.push( value! );
        }

        // Assert
        expect( Buffer.concat( chunks.map( c => Buffer.from( c ))).toString()).toBe( 'abcd' );

        const empty = new UploadedFile( 'e', 'e.txt', 'text/plain', {});
        const emptyReader = empty.stream().getReader();
        expect(( await emptyReader.read()).done ).toBe( true );

        file.setMaxSize( 5 );
        expect(() => file.write( Buffer.from( 'ZZ' ))).toThrow( /File too large/ );
        expect(() => file.write( Buffer.from( 'x' ))).toThrow( /File too large/ );

        await file.end();
        await file.end();
        expect(() => file.save( '/tmp/nope' )).toThrow( /after part has ended/ );
    });

    it( 'should skip destroying an open disk stream and honor whenEnded', async () =>
    {
        // Arrange
        const dir = await mkdtemp( join( tmpdir(), 'wu-skip-' ));
        const path = join( dir, 'partial.bin' );
        const file = new UploadedFile( 'f', 'p.bin', 'application/octet-stream', {});

        try
        {
            // Act
            file.save( path );
            file.write( Buffer.from( 'hi' ));
            const ended = file.whenEnded();
            file.skip();

            // Assert
            expect( file.mode ).toBe( 'skip' );
            await file.cleanup();
            expect( file.path ).toBeUndefined();
            file.write( Buffer.from( 'ignored' ));
            await file.end();
            await ended;
            await cleanupUploadedFiles([ file ]);
        }
        finally
        {
            await rm( dir, { recursive : true, force : true });
        }
    });

    it( 'should fail an open disk stream and clear the path', async () =>
    {
        // Arrange
        const dir = await mkdtemp( join( tmpdir(), 'wu-fail-' ));
        const path = join( dir, 'bad.bin' );
        const file = new UploadedFile( 'f', 'b.bin', 'application/octet-stream', {});

        try
        {
            file.save( path );
            file.write( Buffer.from( 'data' ));

            // Act
            file.fail( Object.assign( new Error( 'boom' ), { status : 500 }));
            await file.cleanup();

            // Assert — fail clears writeStream / path via cleanup (unlink is best-effort)
            expect( file.path ).toBeUndefined();
            expect(() => file.write( Buffer.from( 'x' ))).toThrow( /boom/ );
        }
        finally
        {
            await rm( dir, { recursive : true, force : true });
        }
    });
});

describe( 'MultipartPayload API edges', () =>
{
    it( 'should rebuild partsFromMaps and expose bag helpers', () =>
    {
        // Arrange
        const f1 = new UploadedFile( 'docs', '1.txt', 'text/plain', {});
        const f2 = new UploadedFile( 'docs', '2.txt', 'text/plain', {});
        f1.write( Buffer.from( 'a' ));
        f2.write( Buffer.from( 'b' ));
        const payload = MultipartPayload.from({
            fields : { title : 'hi', tags : [ 'a', 'b' ] },
            files  : [ f1, f2 ]
        } as any );

        // Act / Assert
        expect( payload.fields.title ).toBe( 'hi' );
        expect( payload.uploads ).toHaveLength( 2 );
        expect( payload.has( 'title' )).toBe( true );
        expect( payload.has( 'docs' )).toBe( true );
        expect( payload.has( 'missing' )).toBe( false );
        expect( payload.keys().sort()).toEqual([ 'docs', 'tags', 'title' ]);
        expect( payload.field( 'tags' )).toBe( 'a' );
        expect( payload.field( 'missing' )).toBeUndefined();
        expect( payload.textFields( 'tags' )).toEqual([ 'a', 'b' ]);
        expect( payload.textFields( 'title' )).toEqual([ 'hi' ]);
        expect( payload.textFields( 'nope' )).toEqual([]);
        expect( payload.files()).toHaveLength( 2 );
        expect( payload.files( 'docs' )).toHaveLength( 2 );
        expect( payload.files( 'none' )).toEqual([]);
        expect( payload.get( 'docs' )).toHaveLength( 2 );
        expect( payload.get( 'title' )).toBe( 'hi' );
    });
});

describe( 'MultipartParser option edges', () =>
{
    it( 'should honor filter, onField, empty append, and done', async () =>
    {
        // Arrange
        const boundary = 'opt';
        const body = multipartBody( boundary, [
            'Content-Disposition: form-data; name="note"\r\n\r\nhi',
            'Content-Disposition: form-data; name="f"; filename="x.txt"\r\nContent-Type: text/plain\r\n\r\nok'
        ]);
        const fields: string[] = [];
        const parser = new MultipartParser( boundary, {
            filter : () => false,
            onField : ( name, value ) =>
            {
                fields.push( `${name}=${value}` );
            }
        });

        // Act
        parser.append( Buffer.alloc( 0 ));
        parser.append( body );
        const result = await parser.finish();

        // Assert
        expect( parser.done ).toBe( true );
        expect( fields ).toEqual([ 'note=hi' ]);
        expect( result.files[0].mode ).toBe( 'skip' );
    });

    it( 'should enforce maxFiles, maxFields, and maxFieldSize', async () =>
    {
        // Arrange / Act / Assert
        await expect( parseMultipartStream(
            streamFrom( multipartBody( 'mf', [
                'Content-Disposition: form-data; name="f"; filename="a.txt"\r\n\r\nx',
                'Content-Disposition: form-data; name="f"; filename="b.txt"\r\n\r\ny'
            ])),
            'multipart/form-data; boundary=mf',
            { maxFiles : 1 }
        )).rejects.toMatchObject({ status : 413 });

        await expect( parseMultipartStream(
            streamFrom( multipartBody( 'md', [
                'Content-Disposition: form-data; name="a"\r\n\r\n1',
                'Content-Disposition: form-data; name="b"\r\n\r\n2'
            ])),
            'multipart/form-data; boundary=md',
            { maxFields : 1 }
        )).rejects.toMatchObject({ status : 413 });

        await expect( parseMultipartStream(
            streamFrom( multipartBody( 'ms', [
                'Content-Disposition: form-data; name="big"\r\n\r\nabcdef'
            ])),
            'multipart/form-data; boundary=ms',
            { maxFieldSize : 3 }
        )).rejects.toMatchObject({ status : 413 });
    });

    it( 'should reject missing boundary / null body and accept LF-terminated close', async () =>
    {
        // Assert
        await expect( parseMultipartStream(
            streamFrom( Buffer.from( 'x' )),
            'application/json',
            {}
        )).rejects.toMatchObject({ status : 400, message : expect.stringMatching( /boundary/ ) });

        await expect( parseMultipartStream(
            null,
            'multipart/form-data; boundary=x',
            {}
        )).rejects.toMatchObject({ status : 400, message : expect.stringMatching( /no body/ ) });

        // Arrange — closing delimiter with bare LF after `--`
        const boundary = 'lf';
        const body = Buffer.from(
            `--${boundary}\r\nContent-Disposition: form-data; name="n"\r\n\r\nv\r\n--${boundary}--\n`,
            'utf8'
        );

        // Act
        const result = await parseMultipartStream(
            streamFrom( body ),
            `multipart/form-data; boundary=${boundary}`
        );

        // Assert
        expect( result.fields.n ).toBe( 'v' );
    });

    it( 'should reject nested multipart that exceeds maxFields / maxFiles', async () =>
    {
        // Arrange
        const outer = 'out';
        const inner = 'in';
        const nested = [
            `--${inner}`,
            'Content-Disposition: form-data; name="a"\r\n',
            '1',
            `--${inner}`,
            'Content-Disposition: form-data; name="b"\r\n',
            '2',
            `--${inner}--`
        ].join( '\r\n' );
        const body = multipartBody( outer, [
            `Content-Disposition: form-data; name="bundle"\r\nContent-Type: multipart/mixed; boundary=${inner}\r\n\r\n${nested}`
        ]);

        // Act / Assert
        await expect( parseMultipartStream(
            streamFrom( body ),
            `multipart/form-data; boundary=${outer}`,
            { maxFields : 1 }
        )).rejects.toMatchObject({ status : 413 });

        const nestedFiles = [
            `--${inner}`,
            'Content-Disposition: form-data; name="f"; filename="a.txt"\r\nContent-Type: text/plain\r\n',
            'A',
            `--${inner}`,
            'Content-Disposition: form-data; name="f"; filename="b.txt"\r\nContent-Type: text/plain\r\n',
            'B',
            `--${inner}--`
        ].join( '\r\n' );
        const fileBody = multipartBody( outer, [
            `Content-Disposition: form-data; name="bundle"\r\nContent-Type: multipart/mixed; boundary=${inner}\r\n\r\n${nestedFiles}`
        ]);

        await expect( parseMultipartStream(
            streamFrom( fileBody ),
            `multipart/form-data; boundary=${outer}`,
            { maxFiles : 1 }
        )).rejects.toMatchObject({ status : 413 });
    });
});

describe( 'nestFieldName empty name', () =>
{
    it( 'should return the prefix when the inner name is empty', () =>
    {
        // Assert
        expect( nestFieldName( 'bundle', '' )).toBe( 'bundle' );
    });
});

describe( 'MultipartPayload cleanup + triple fields', () =>
{
    it( 'should push onto existing field arrays and cleanup uploads', async () =>
    {
        // Arrange
        const boundary = 'tri';
        const body = multipartBody( boundary, [
            'Content-Disposition: form-data; name="tag"\r\n\r\nred',
            'Content-Disposition: form-data; name="tag"\r\n\r\nblue',
            'Content-Disposition: form-data; name="tag"\r\n\r\ngreen'
        ]);
        const result = await parseMultipartStream(
            streamFrom( body ),
            `multipart/form-data; boundary=${boundary}`
        );
        const payload = MultipartPayload.from( result );

        // Act / Assert
        expect( payload.textFields( 'tag' )).toEqual([ 'red', 'blue', 'green' ]);
        await payload.cleanup();
    });
});
