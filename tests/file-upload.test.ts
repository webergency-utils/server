import { describe, it, expect } from 'vitest';
import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import
{
    mergeFileConfigs,
    resolveFieldOptions,
    openFileStorage,
    processMultipartUpload
}
from '../src/helpers/file-upload.js';
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
            fields   :
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
                fields      :
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
                fields      :
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
                    dest   : dir,
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
});
