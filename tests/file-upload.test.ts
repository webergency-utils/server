import { describe, it, expect } from 'vitest';
import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import
{
    mergeFileConfigs,
    resolveFieldOptions,
    openFileStorage,
    processMultipartUpload,
    DEFAULT_MAX_FILE_BYTES
}
    from '../src/helpers/file-upload.js';
import { UploadedFile } from '../src/helpers/multipart.js';
import { ServerRequest } from '../src/core/server-request.js';

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
            controller.enqueue( buffer );
            controller.close();
        }
    });
}

function makeFile( filename = 'photo.png' ): UploadedFile
{
    return new UploadedFile( 'avatar', filename, 'image/png', {});
}

describe( 'mergeFileConfigs', () =>
{
    it( 'should skip undefined entries and return undefined for an empty list', () =>
    {
        // Assert
        expect( mergeFileConfigs([])).toBeUndefined();
        expect( mergeFileConfigs([ undefined, undefined ])).toBeUndefined();

        // Arrange
        const merged = mergeFileConfigs([
            undefined,
            { dest : '/a', fields : { x : { maxFileSize : '1mb' } } },
            undefined,
            { maxFiles : 2 }
        ]);

        // Assert
        expect( merged?.dest ).toBe( '/a' );
        expect( merged?.maxFiles ).toBe( 2 );
        expect( merged?.fields?.x ).toEqual({ maxFileSize : '1mb' });
    });

    it( 'should reset accumulated file options to empty object when false or true is passed', () =>
    {
        // Arrange / Act
        const resetFalse = mergeFileConfigs([
            { dest : '/a', maxFiles : 3, fields : { avatar : { maxFileSize : '2mb' } } },
            false
        ]);
        const resetTrue = mergeFileConfigs([
            { dest : '/a', maxFiles : 3 },
            true
        ]);

        // Assert
        expect( resetFalse ).toEqual({});
        expect( resetTrue ).toEqual({});
    });
});

describe( 'resolveFieldOptions', () =>
{
    it( 'should return empty object without options and merge field overrides', () =>
    {
        // Assert
        expect( resolveFieldOptions( undefined, 'avatar' )).toEqual({});

        // Arrange
        const options =
        {
            dest     : '/base',
            maxFiles : 4,
            fields :
            {
                avatar : { maxFileSize : '2mb', dest : '/avatars' }
            }
        };

        // Act
        const resolved = resolveFieldOptions( options, 'avatar' );
        const missing = resolveFieldOptions( options, 'other' );

        // Assert
        expect( resolved ).toEqual({
            dest        : '/avatars',
            maxFiles    : 4,
            maxFileSize : '2mb'
        });
        expect( missing.dest ).toBe( '/base' );
        expect( missing.maxFileSize ).toBeUndefined();
    });
});

describe( 'openFileStorage', () =>
{
    it( 'should skip when filter rejects', async () =>
    {
        // Arrange
        const file = makeFile();

        // Act
        await openFileStorage( file, {
            filter : () => false
        });

        // Assert
        expect( file.mode ).toBe( 'skip' );
    });

    it( 'should invoke onFile and return early', async () =>
    {
        // Arrange
        const file = makeFile();
        const onFile = async ( f: UploadedFile ) =>
        {
            f.skip();
        };

        // Act
        await openFileStorage( file, { onFile, dest : '/ignored' });

        // Assert
        expect( file.mode ).toBe( 'skip' );
    });

    it( 'should save to disk with dest string and keepExtensions false', async () =>
    {
        // Arrange
        const dir = await mkdtemp( join( tmpdir(), 'wu-open-' ));
        const file = makeFile( 'report.tar.gz' );

        try
        {
            // Act
            await openFileStorage( file, {
                dest           : dir,
                keepExtensions : false
            });

            // Assert
            const destReal = await realpath( dir );

            expect( file.mode ).toBe( 'disk' );
            expect( file.path ).toBeDefined();
            expect( file.path!.endsWith( '.gz' )).toBe( false );
            expect( file.path!.startsWith( destReal )).toBe( true );
            await file.cleanup();
        }
        finally
        {
            await rm( dir, { recursive : true, force : true });
        }
    });

    it( 'should save to disk using a filename function', async () =>
    {
        // Arrange
        const dir = await mkdtemp( join( tmpdir(), 'wu-fn-' ));
        const file = makeFile( 'in.bin' );

        try
        {
            // Act
            await openFileStorage( file, {
                dest     : dir,
                filename : () => 'custom-name.bin'
            });

            // Assert
            expect( file.path ).toBe( join( await ( await import( 'node:fs/promises' )).realpath( dir ), 'custom-name.bin' ));
            await file.cleanup();
        }
        finally
        {
            await rm( dir, { recursive : true, force : true });
        }
    });

    it( 'should throw when storage is manual without onFile', async () =>
    {
        // Arrange
        const file = makeFile();

        // Act / Assert
        await expect( openFileStorage( file, { storage : 'manual' })).rejects.toMatchObject({
            message : expect.stringMatching( /manual.*onFile/ ),
            status  : 500
        });
    });

    it( 'should throw when resolved path escapes destination directory', async () =>
    {
        // Arrange
        const dir = await mkdtemp( join( tmpdir(), 'wu-esc-' ));
        const file = makeFile();

        try
        {
            // Act / Assert — basename('..') stays '..' and joins above dest
            await expect( openFileStorage( file, {
                dest     : dir,
                filename : '..'
            })).rejects.toMatchObject({
                message : expect.stringMatching( /escapes destination/ ),
                status  : 400
            });
        }
        finally
        {
            await rm( dir, { recursive : true, force : true });
        }
    });

    it( 'should resolve dest/filename functions and string filename with keepExtensions', async () =>
    {
        // Arrange
        const dir = await mkdtemp( join( tmpdir(), 'wu-destfn-' ));
        const file = makeFile( 'shot.jpg' );

        try
        {
            // Act
            await openFileStorage( file, {
                dest     : async () => dir,
                filename : 'fixed.jpg'
            });

            // Assert
            expect( file.path ).toBe( join( await realpath( dir ), 'fixed.jpg' ));

            const random = makeFile( 'x.png' );
            await openFileStorage( random, {
                dest           : async () => '',
                keepExtensions : true,
                storage        : 'disk'
            });

            expect( random.mode ).toBe( 'disk' );
            expect( random.path ).toMatch( /\.png$/ );
            await random.cleanup();
            await file.cleanup();
            await rm( join( process.cwd(), '.uploads' ), { recursive : true, force : true });
        }
        finally
        {
            await rm( dir, { recursive : true, force : true });
        }
    });
});

describe( 'processMultipartUpload', () =>
{
    it( 'should honor per-field maxFileSize overrides against the base limit', async () =>
    {
        // Arrange — 5 bytes exceeds base 3 but fits field override 10
        const boundary = 'pfmax';
        const body = multipartBody( boundary, [
            'Content-Disposition: form-data; name="big"; filename="b.txt"\r\nContent-Type: text/plain\r\n\r\nabcde'
        ]);

        // Act
        const result = await processMultipartUpload(
            streamFrom( body ),
            `multipart/form-data; boundary=${boundary}`,
            {
                storage     : 'memory',
                maxFileSize : 3,
                fields :
                {
                    big : { maxFileSize : 10 }
                }
            }
        );

        // Assert
        expect( result.files[0].buffer.toString()).toBe( 'abcde' );

        await expect( processMultipartUpload(
            streamFrom( body ),
            `multipart/form-data; boundary=${boundary}`,
            {
                storage     : 'memory',
                maxFileSize : 3,
                fields :
                {
                    big : { maxFileSize : 4 }
                }
            }
        )).rejects.toMatchObject({ status : 413 });
    });

    it( 'should apply filter and write accepted files under dest tmpdir', async () =>
    {
        // Arrange
        const dir = await mkdtemp( join( tmpdir(), 'wu-proc-' ));
        const boundary = 'pffilt';
        const body = multipartBody( boundary, [
            'Content-Disposition: form-data; name="skipme"; filename="s.txt"\r\nContent-Type: text/plain\r\n\r\nxx',
            'Content-Disposition: form-data; name="keep"; filename="k.txt"\r\nContent-Type: text/plain\r\n\r\nok'
        ]);

        try
        {
            // Act
            const result = await processMultipartUpload(
                streamFrom( body ),
                `multipart/form-data; boundary=${boundary}`,
                {
                    dest : dir,
                    fields :
                    {
                        skipme : { filter : () => false },
                        keep   : { filename : 'keep.txt' }
                    }
                }
            );

            // Assert
            expect( result.files.find( f => f.field === 'skipme' )?.mode ).toBe( 'skip' );
            expect( await readFile( join( dir, 'keep.txt' ), 'utf8' )).toBe( 'ok' );
        }
        finally
        {
            await rm( dir, { recursive : true, force : true });
        }
    });

    it( 'should default multipart total limit to 10mb (DEFAULT_MAX_FILE_BYTES) instead of 1mb and honor false/maxBodySize overrides', async () =>
    {
        // Arrange — 2 MB multipart payload (> 1 MB default maxBodySize, < 10 MB default maxFileSize)
        const boundary = 'limit10mb';
        const twoMbPayload = 'a'.repeat( 2 * 1024 * 1024 );
        const body = multipartBody( boundary, [
            `Content-Disposition: form-data; name="doc"; filename="doc.txt"\r\nContent-Type: text/plain\r\n\r\n${twoMbPayload}`
        ]);

        // Act — ServerRequest with no explicit maxTotalSize or maxBodySize
        const sreq = new ServerRequest(
            new Request( 'http://localhost/upload', {
                method  : 'POST',
                body    : new Uint8Array( body ),
                headers : { 'Content-Type' : `multipart/form-data; boundary=${boundary}` }
            })
        );
        const uploaded = await sreq.upload( 'doc' );

        // Assert — 2 MB succeeds by default because multipart total defaults to 10 MB
        expect( DEFAULT_MAX_FILE_BYTES ).toBe( 10 * 1024 * 1024 );
        expect( uploaded?.size ).toBe( 2 * 1024 * 1024 );

        // Arrange — maxFileSize: false, maxTotalSize: false, maxFiles: false, maxFields: false
        const smallBody = multipartBody( boundary, [
            'Content-Disposition: form-data; name="f"; filename="f.txt"\r\nContent-Type: text/plain\r\n\r\nhello',
            'Content-Disposition: form-data; name="text"\r\n\r\nval'
        ]);
        const unlimitedResult = await processMultipartUpload(
            streamFrom( smallBody ),
            `multipart/form-data; boundary=${boundary}`,
            {
                maxFileSize  : false,
                maxTotalSize : false,
                maxFiles     : false,
                maxFields    : false
            }
        );

        // Assert
        expect( unlimitedResult.files[0].size ).toBe( 5 );
        expect( unlimitedResult.fields.text ).toBe( 'val' );

        // Arrange — Route with field-level maxFileSize: 100b + text field, even under global maxBodySize: 10b
        const exactFileBody = multipartBody( boundary, [
            `Content-Disposition: form-data; name="video"; filename="v.bin"\r\nContent-Type: application/octet-stream\r\n\r\n${'x'.repeat( 100 )}`,
            'Content-Disposition: form-data; name="title"\r\n\r\nmy-video'
        ]);
        const sreqWithFieldMax = new ServerRequest(
            new Request( 'http://localhost/upload', {
                method  : 'POST',
                body    : new Uint8Array( exactFileBody ),
                headers : { 'Content-Type' : `multipart/form-data; boundary=${boundary}` }
            }),
            { maxBodySize : 10 },
            {
                storage : 'memory',
                fields  : { video : { maxFileSize : 100 } }
            }
        );

        // Act
        const videoFile = await sreqWithFieldMax.upload( 'video' );

        // Assert — exact 100-byte file + form field + multipart framing succeeds
        expect( videoFile?.size ).toBe( 100 );

        // Arrange — Unsetting nested object paths via undefined in mergeFileConfigs
        const mergedFiles = mergeFileConfigs([
            {
                dest        : '/global-uploads',
                maxFileSize : '10mb',
                fields      : {
                    avatar : { dest : '/avatars', maxFileSize : '2mb', filename : 'av.png' },
                    banner : { dest : '/banners' }
                }
            },
            {
                dest   : undefined,
                fields : {
                    avatar : { dest : undefined },
                    banner : undefined
                }
            }
        ]);

        // Assert — Explicit undefined rewrites previous values at every object path
        expect( mergedFiles?.dest ).toBeUndefined();
        expect( mergedFiles?.maxFileSize ).toBe( '10mb' );
        expect( mergedFiles?.fields?.avatar?.dest ).toBeUndefined();
        expect( mergedFiles?.fields?.avatar?.maxFileSize ).toBe( '2mb' );
        expect( mergedFiles?.fields?.avatar?.filename ).toBe( 'av.png' );
        expect( mergedFiles?.fields?.banner ).toBeUndefined();
    });
});
