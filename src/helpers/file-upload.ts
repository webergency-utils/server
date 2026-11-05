import { randomBytes } from 'node:crypto';
import { mkdir, realpath } from 'node:fs/promises';
import { join, extname, basename, resolve, sep } from 'node:path';
import { parseSize } from './security.js';
import
{
    parseMultipartStream,
    cleanupUploadedFiles,
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
    maxFileSize?    : string | number | false
    filter?         : ( file: UploadedFile ) => boolean | Promise<boolean>
    onFile?         : FileHandler
}

export interface FileOptions extends FileFieldOptions
{
    maxFiles?     : number | false
    maxFields?    : number | false
    maxFieldSize? : string | number | false
    /** Total multipart body cap (bytes). Falls back to security `maxBodySize` when unset. */
    maxTotalSize? : string | number | false
    /** Per-field overrides keyed by form field name. */
    fields?       : Record<string, FileFieldOptions | undefined>
}

/** Applied when the corresponding option is omitted (DoS guardrails). */
export const DEFAULT_MAX_FILES = 32;
export const DEFAULT_MAX_FIELDS = 128;
export const DEFAULT_MAX_FILE_SIZE = '10mb';
export const DEFAULT_MAX_FIELD_SIZE = '1mb';

export const DEFAULT_MAX_FILE_BYTES = /* @__PURE__ */ parseSize( DEFAULT_MAX_FILE_SIZE );
export const DEFAULT_MAX_FIELD_BYTES = /* @__PURE__ */ parseSize( DEFAULT_MAX_FIELD_SIZE );

function resolveSize( value: string | number | false | undefined ): number | undefined
{
    if( value === undefined ){ return undefined }

    if( value === false || value === 0 || value === Infinity ){ return Infinity }

    return parseSize( value );
}

/**
 * Returns the largest explicitly configured `maxFileSize` across top-level `files.maxFileSize`
 * and per-field `files.fields[name].maxFileSize` (`Infinity` if any is `false` / `0` / `Infinity`,
 * or `undefined` when none is configured).
 */
export function resolveConfiguredFileMax( options?: FileOptions ): number | undefined
{
    if( !options ){ return undefined }

    let max = resolveSize( options.maxFileSize );

    if( max === Infinity ){ return Infinity }

    if( options.fields )
    {
        for( const field of Object.values( options.fields ))
        {
            if( !field ){ continue }

            const fieldMax = resolveSize( field.maxFileSize );

            if( fieldMax === Infinity ){ return Infinity }

            if( fieldMax !== undefined && ( max === undefined || fieldMax > max ))
            {
                max = fieldMax;
            }
        }
    }

    return max;
}

export function resolveMultipartTotalLimit( security?: { maxBodySize? : number | string | false }, files?: FileOptions ): number | undefined
{
    if( files?.maxTotalSize !== undefined )
    {
        if( files.maxTotalSize === false || files.maxTotalSize === 0 || files.maxTotalSize === Infinity )
        {
            return undefined;
        }

        return parseSize( files.maxTotalSize );
    }

    const configuredFileMax = resolveConfiguredFileMax( files );
    const fieldHeadroom = files?.maxFieldSize !== undefined
        ? ( files.maxFieldSize === false || files.maxFieldSize === 0 || files.maxFieldSize === Infinity ? 0 : parseSize( files.maxFieldSize ))
        : DEFAULT_MAX_FIELD_BYTES;
    const configuredBodyMax = security?.maxBodySize;

    if( configuredBodyMax !== undefined )
    {
        if( configuredBodyMax === false || configuredBodyMax === 0 || configuredBodyMax === Infinity )
        {
            return undefined;
        }

        const bodyBytes = parseSize( configuredBodyMax );

        if( configuredFileMax !== undefined )
        {
            if( configuredFileMax === Infinity )
            {
                return undefined;
            }

            return Math.max( bodyBytes, configuredFileMax + fieldHeadroom );
        }

        return bodyBytes;
    }

    if( configuredFileMax === Infinity )
    {
        return undefined;
    }

    const effectiveFileMax = configuredFileMax !== undefined
        ? Math.max( DEFAULT_MAX_FILE_BYTES, configuredFileMax )
        : DEFAULT_MAX_FILE_BYTES;

    return effectiveFileMax + fieldHeadroom;
}

function resolveTotalSize( value: string | number | false | undefined ): number | null | undefined
{
    if( value === undefined ){ return undefined }

    if( value === false || value === 0 || value === Infinity ){ return null }

    return parseSize( value );
}

function resolveCount( value: number | false | undefined, defaultCount: number ): number
{
    if( value === undefined ){ return defaultCount }

    if( value === false || value === 0 || value === Infinity ){ return Infinity }

    return value;
}

const singleFileCloneCache = new WeakMap<FileOptions, FileOptions>();
const mergeFilePairCache = new WeakMap<FileOptions, WeakMap<FileOptions, FileOptions>>();

function cloneSingleFileConfig( config: FileOptions ): FileOptions
{
    let cloned = singleFileCloneCache.get( config );

    if( !cloned )
    {
        cloned = 'fields' in config
            ? { ...config, fields : config.fields ? { ...config.fields } : undefined }
            : { ...config };
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

    if( Object.keys( override ).length === 0 )
    {
        merged = {};
        byOverride.set( override, merged );

        return merged;
    }

    let fields: Record<string, FileFieldOptions | undefined> | undefined;
    const hasFieldsInOverride = 'fields' in override;

    if( hasFieldsInOverride && override.fields === undefined )
    {
        fields = undefined;
    }
    else if( base.fields || override.fields )
    {
        const mergedFields: Record<string, FileFieldOptions | undefined> = {
            ...( base.fields || {})
        };

        if( override.fields )
        {
            for( const key of Object.keys( override.fields ))
            {
                const ovField = override.fields[key];

                if( ovField === undefined )
                {
                    mergedFields[key] = undefined;
                }
                else
                {
                    mergedFields[key] = { ...( base.fields?.[key] || {}), ...ovField };
                }
            }
        }

        fields = Object.keys( mergedFields ).length > 0 ? mergedFields : undefined;
    }

    merged = ( fields !== undefined || hasFieldsInOverride )
        ? { ...base, ...override, fields }
        : { ...base, ...override };

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

        if( Object.keys( config ).length === 0 )
        {
            merged = {};
            continue;
        }

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
    maxTotalSize   : number | null | undefined
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
                if( !field ){ continue }

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
            maxFiles     : resolveCount( options.maxFiles, DEFAULT_MAX_FILES ),
            maxFields    : resolveCount( options.maxFields, DEFAULT_MAX_FIELDS ),
            maxFieldSize : resolveSize( options.maxFieldSize ) ?? DEFAULT_MAX_FIELD_BYTES,
            maxTotalSize : resolveTotalSize( options.maxTotalSize )
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
    const maxTotalSize = plan.maxTotalSize === null
        ? undefined
        : ( plan.maxTotalSize ?? maxTotalFallback );

    const multipartOptions: MultipartParseOptions =
    {
        maxFileSize  : plan.loosestFileMax,
        maxFiles     : plan.maxFiles,
        maxFields    : plan.maxFields,
        maxFieldSize : plan.maxFieldSize,
        maxTotalSize,
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

export { UploadedFile, MultipartPayload, cleanupUploadedFiles };
export type { MultipartParseResult, MultipartValue, MultipartFieldValue };
