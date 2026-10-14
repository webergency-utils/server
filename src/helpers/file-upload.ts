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

const DEFAULT_MAX_FILE_BYTES = parseSize( DEFAULT_MAX_FILE_SIZE );
const DEFAULT_MAX_FIELD_BYTES = parseSize( DEFAULT_MAX_FIELD_SIZE );

function resolveSize( value: string | number | undefined ): number | undefined
{
    if( value === undefined ){ return undefined }

    return parseSize( value );
}

const singleFileCloneCache = new WeakMap<FileOptions, FileOptions>();
const mergeFilePairCache = new WeakMap<FileOptions, WeakMap<FileOptions, FileOptions>>();

function cloneSingleFileConfig( config: FileOptions ): FileOptions
{
    let cloned = singleFileCloneCache.get( config );

    if( !cloned )
    {
        cloned = { ...config, fields : config.fields ? { ...config.fields } : undefined };
        singleFileCloneCache.set( config, cloned );
    }

    return cloned;
}

function mergeTwoFileConfigs( base: FileOptions, override: FileOptions ): FileOptions
{
    let byOverride = mergeFilePairCache.get( base );

    if( !byOverride )
    {
        byOverride = new WeakMap();
        mergeFilePairCache.set( base, byOverride );
    }

    let merged = byOverride.get( override );

    if( merged )
    {
        return merged;
    }

    let fields: Record<string, FileFieldOptions> | undefined;

    if( base.fields || override.fields )
    {
        fields = {
            ...( base.fields || {}),
            ...( override.fields || {})
        };

        if( override.fields )
        {
            for( const key of Object.keys( override.fields ))
            {
                fields[key] = { ...( base.fields?.[key] || {}), ...( override.fields[key]) };
            }
        }

        if( Object.keys( fields ).length === 0 )
        {
            fields = undefined;
        }
    }

    merged = {
        ...base,
        ...override,
        fields
    };

    byOverride.set( override, merged );

    return merged;
}

export function mergeFileConfigs( configs: ( FileOptions | undefined )[]): FileOptions | undefined
{
    let merged: FileOptions | undefined;

    for( let i = 0; i < configs.length; i++ )
    {
        const config = configs[i];

        if( config === undefined ){ continue }

        if( !merged )
        {
            merged = cloneSingleFileConfig( config );
        }
        else
        {
            merged = mergeTwoFileConfigs( merged, config );
        }
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

const EMPTY_FIELD_OPTIONS: FileFieldOptions = {};
const resolvedFieldOptionsCache = new WeakMap<FileOptions, Map<string, FileFieldOptions>>();

export function resolveFieldOptions( options: FileOptions | undefined, field: string ): FileFieldOptions
{
    if( !options ){ return EMPTY_FIELD_OPTIONS }

    let byField = resolvedFieldOptionsCache.get( options );

    if( !byField )
    {
        byField = new Map();
        resolvedFieldOptionsCache.set( options, byField );
    }

    let resolved = byField.get( field );

    if( !resolved )
    {
        const { fields, ...base } = options;
        resolved = { ...base, ...( fields?.[field] || {}) };
        byField.set( field, resolved );
    }

    return resolved;
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

interface CompiledFileUploadPlan
{
    baseMax        : number
    loosestFileMax : number
    maxFiles       : number
    maxFields      : number
    maxFieldSize   : number
    maxTotalSize   : number | undefined
}

const DEFAULT_UPLOAD_PLAN: CompiledFileUploadPlan = {
    baseMax        : DEFAULT_MAX_FILE_BYTES,
    loosestFileMax : DEFAULT_MAX_FILE_BYTES,
    maxFiles       : DEFAULT_MAX_FILES,
    maxFields      : DEFAULT_MAX_FIELDS,
    maxFieldSize   : DEFAULT_MAX_FIELD_BYTES,
    maxTotalSize   : undefined
};

const compiledUploadPlanCache = new WeakMap<FileOptions, CompiledFileUploadPlan>();

function getCompiledUploadPlan( options?: FileOptions ): CompiledFileUploadPlan
{
    if( !options ){ return DEFAULT_UPLOAD_PLAN }

    let plan = compiledUploadPlanCache.get( options );

    if( !plan )
    {
        const baseMax = resolveSize( options.maxFileSize ) ?? DEFAULT_MAX_FILE_BYTES;
        let loosestFileMax = baseMax;

        if( options.fields )
        {
            for( const field of Object.values( options.fields ))
            {
                const fieldMax = resolveSize( field.maxFileSize );

                if( fieldMax !== undefined && fieldMax > loosestFileMax )
                {
                    loosestFileMax = fieldMax;
                }
            }
        }

        plan = {
            baseMax,
            loosestFileMax,
            maxFiles     : options.maxFiles ?? DEFAULT_MAX_FILES,
            maxFields    : options.maxFields ?? DEFAULT_MAX_FIELDS,
            maxFieldSize : resolveSize( options.maxFieldSize ) ?? DEFAULT_MAX_FIELD_BYTES,
            maxTotalSize : resolveSize( options.maxTotalSize )
        };

        compiledUploadPlanCache.set( options, plan );
    }

    return plan;
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
    const plan = getCompiledUploadPlan( options );

    const multipartOptions: MultipartParseOptions =
    {
        maxFileSize  : plan.loosestFileMax,
        maxFiles     : plan.maxFiles,
        maxFields    : plan.maxFields,
        maxFieldSize : plan.maxFieldSize,
        maxTotalSize : plan.maxTotalSize ?? maxTotalFallback,
        signal,
        onFile       : async ( file ) =>
        {
            const fieldOptions = resolveFieldOptions( options, file.field );
            const fieldMax = resolveSize( fieldOptions.maxFileSize ) ?? plan.baseMax;
            file.setMaxSize( fieldMax );
            await openFileStorage( file, fieldOptions );
        }
    };

    return parseMultipartStream( body, contentType, multipartOptions );
}

export { UploadedFile, MultipartPayload };
export type { MultipartParseResult, MultipartValue, MultipartFieldValue };
