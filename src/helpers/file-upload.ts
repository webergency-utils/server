import { randomBytes } from 'node:crypto';
import { mkdir, realpath } from 'node:fs/promises';
import { join, extname, basename, resolve, sep } from 'node:path';
import { parseSize } from './security.js';
import
{
    parseMultipartStream,
    UploadedFile,
    MultipartPayload,
    type MultipartParseResult,
    type MultipartParseOptions,
    type MultipartValue,
    type MultipartFieldValue
}
from './multipart.js';

/** Called when a file part opens — typically `file.save(path)` or custom piping. */
export type FileHandler = ( file: UploadedFile ) => void | Promise<void>;

export interface FileFieldOptions
{
    /** Directory (or resolver) for disk storage. Final paths are constrained under this root. */
    dest?           : string | (( file: UploadedFile ) => string | Promise<string> )
    /** Final filename on disk (defaults to a random name, optionally keeping the extension). */
    filename?       : string | (( file: UploadedFile ) => string | Promise<string> )
    keepExtensions? : boolean
    /** `disk` when `dest` is set; `memory` keeps bytes in `file.buffer`; `manual` requires `onFile`. */
    storage?        : 'disk' | 'memory' | 'manual'
    maxFileSize?    : string | number
    filter?         : ( file: UploadedFile ) => boolean | Promise<boolean>
    onFile?         : FileHandler
}

export interface FileOptions extends FileFieldOptions
{
    maxFiles?     : number
    maxFields?    : number
    maxFieldSize? : string | number
    /** Total multipart body cap (bytes). Falls back to security `maxBodySize` when unset. */
    maxTotalSize? : string | number
    /** Per-field overrides keyed by form field name. */
    fields?       : Record<string, FileFieldOptions>
}

/** Applied when the corresponding option is omitted (DoS guardrails). */
export const DEFAULT_MAX_FILES = 32;
export const DEFAULT_MAX_FIELDS = 128;
export const DEFAULT_MAX_FILE_SIZE = '10mb';
export const DEFAULT_MAX_FIELD_SIZE = '1mb';

function resolveSize( value: string | number | undefined ): number | undefined
{
    if( value === undefined ){ return undefined }

    return parseSize( value );
}

export function mergeFileConfigs( configs: ( FileOptions | undefined )[]): FileOptions | undefined
{
    let merged: FileOptions | undefined;

    for( const config of configs )
    {
        if( config === undefined ){ continue }

        if( !merged )
        {
            merged = { ...config, fields : config.fields ? { ...config.fields } : undefined };

            continue;
        }

        const fields =
        {
            ...( merged.fields || {}),
            ...( config.fields || {})
        };

        for( const key of Object.keys( config.fields || {}))
        {
            fields[key] = { ...( merged.fields?.[key] || {}), ...( config.fields![key]) };
        }

        merged =
        {
            ...merged,
            ...config,
            fields : Object.keys( fields ).length ? fields : undefined
        };
    }

    return merged;
}

function sanitizeFilename( name: string ): string
{
    return basename( name ).replace( /[^\w.\-()+ ]+/g, '_' ).slice( 0, 200 ) || 'file';
}

function assertPathInsideRoot( root: string, candidate: string )
{
    const rootPath = resolve( root );
    const full = resolve( candidate );

    if( full !== rootPath && !full.startsWith( rootPath + sep ))
    {
        throw Object.assign( new Error( 'Upload path escapes destination directory' ), { status : 400 });
    }

    return full;
}

async function resolveDiskPath( options: FileFieldOptions, file: UploadedFile ): Promise<string>
{
    let dest = typeof options.dest === 'function' ? await options.dest( file ) : options.dest;

    if( !dest )
    {
        dest = join( process.cwd(), '.uploads' );
    }

    dest = resolve( dest );
    await mkdir( dest, { recursive : true });
    const destReal = await realpath( dest );

    let name: string;

    if( typeof options.filename === 'function' )
    {
        name = await options.filename( file );
    }
    else if( typeof options.filename === 'string' )
    {
        name = options.filename;
    }
    else
    {
        const ext = options.keepExtensions !== false ? extname( file.filename ) : '';
        name = randomBytes( 16 ).toString( 'hex' ) + ext;
    }

    return assertPathInsideRoot( destReal, join( destReal, sanitizeFilename( name )));
}

export function resolveFieldOptions( options: FileOptions | undefined, field: string ): FileFieldOptions
{
    if( !options ){ return {} }

    const { fields, ...base } = options;

    return { ...base, ...( fields?.[field] || {}) };
}

export async function openFileStorage( file: UploadedFile, fieldOptions: FileFieldOptions )
{
    if( fieldOptions.filter )
    {
        const ok = await fieldOptions.filter( file );

        if( !ok )
        {
            file.skip();

            return;
        }
    }

    if( fieldOptions.onFile )
    {
        await fieldOptions.onFile( file );

        return;
    }

    const storage = fieldOptions.storage
        ?? ( fieldOptions.dest !== undefined || fieldOptions.filename !== undefined ? 'disk' : 'memory' );

    if( storage === 'disk' )
    {
        const path = await resolveDiskPath( fieldOptions, file );
        file.save( path );
    }
    else if( storage === 'manual' )
    {
        throw Object.assign(
            new Error( 'storage: "manual" requires an onFile handler' ),
            { status : 500 }
        );
    }
    // memory: default buffering on UploadedFile
}

/**
 * Parse multipart with hierarchical file options.
 * Applies safe defaults for file/field counts and sizes when omitted.
 */
export async function processMultipartUpload(
    body: ReadableStream<Uint8Array> | null,
    contentType: string | null,
    options: FileOptions | undefined,
    maxTotalFallback?: number,
    signal?: AbortSignal
): Promise<MultipartParseResult>
{
    const baseMax = resolveSize( options?.maxFileSize ) ?? parseSize( DEFAULT_MAX_FILE_SIZE );
    let loosestFileMax = baseMax;

    if( options?.fields )
    {
        for( const field of Object.values( options.fields ))
        {
            const fieldMax = resolveSize( field.maxFileSize );

            if( fieldMax !== undefined )
            {
                loosestFileMax = Math.max( loosestFileMax, fieldMax );
            }
        }
    }

    const multipartOptions: MultipartParseOptions =
    {
        maxFileSize  : loosestFileMax,
        maxFiles     : options?.maxFiles ?? DEFAULT_MAX_FILES,
        maxFields    : options?.maxFields ?? DEFAULT_MAX_FIELDS,
        maxFieldSize : resolveSize( options?.maxFieldSize ) ?? parseSize( DEFAULT_MAX_FIELD_SIZE ),
        maxTotalSize : resolveSize( options?.maxTotalSize ) ?? maxTotalFallback,
        signal,
        onFile       : async ( file ) =>
        {
            const fieldOptions = resolveFieldOptions( options, file.field );
            const fieldMax = resolveSize( fieldOptions.maxFileSize ) ?? baseMax;
            file.setMaxSize( fieldMax );
            await openFileStorage( file, fieldOptions );
        }
    };

    return parseMultipartStream( body, contentType, multipartOptions );
}

export { UploadedFile, MultipartPayload };
export type { MultipartParseResult, MultipartValue, MultipartFieldValue };
