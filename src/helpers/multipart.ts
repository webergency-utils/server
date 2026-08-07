import { createWriteStream, type WriteStream } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { once } from 'node:events';
import { MultiBuffer } from './multibuffer.js';
import
{
    extractMultipartBoundary,
    parseHeaders,
    parseContentDisposition
}
from './http-header-parse.js';
import { createFormBag } from './parsers.js';

const Step =
{
    PREAMBLE    : 0,
    PART_HEADER : 1,
    PART_BODY   : 2,
    DONE        : 3
} as const;

const CRLF = Buffer.from( '\r\n', 'utf8' );
const CRLF_CRLF = Buffer.from( '\r\n\r\n', 'utf8' );
const BOUNDARY_END = Buffer.from( '\r\n', 'utf8' );
const DASH_DASH = Buffer.from( '--', 'utf8' );

/** Compact MultiBuffer when chunk count exceeds this (many tiny TCP/stream slices). */
const COMPACT_CHUNK_THRESHOLD = 32;

/** Max nested `multipart/*` containers below the root (root = 0). */
export const MAX_MULTIPART_NEST_DEPTH = 3;

/**
 * PHP/Rails-style nest: `bundle` + `child` → `bundle[child]`;
 * `bundle` + `docs[]` → `bundle[docs][]`.
 */
export function nestFieldName( prefix: string, name: string ): string
{
    if( !prefix ){ return name }

    if( !name ){ return prefix }

    // Linear scan — avoid `/^([^\[\]]+)(.*)$/` polynomial-ReDoS on adversarial names.
    let i = 0;
    const n = name.length;

    while( i < n )
    {
        const c = name.charCodeAt( i );

        if( c === 0x5b /* [ */ || c === 0x5d /* ] */ ){ break }

        i++;
    }

    if( i === 0 )
    {
        return `${prefix}[${name}]`;
    }

    return `${prefix}[${name.slice( 0, i )}]${name.slice( i )}`;
}

function isMultipartMime( contentType: string | undefined ): boolean
{
    if( !contentType ){ return false }

    const mime = contentType.split( ';' )[0]?.trim().toLowerCase() || '';

    return mime.startsWith( 'multipart/' );
}

export type UploadedFileMode = 'buffer' | 'disk' | 'skip';

/**
 * One multipart file part. During parse, call `save(path)` (disk) or leave buffered
 * (memory / manual). `skip()` discards remaining bytes without storing them.
 */
export class UploadedFile
{
    field             : string;
    readonly filename : string;
    readonly mime     : string;
    readonly headers  : Record<string, string>;

    path? : string;
    size = 0;

    private fileMode: UploadedFileMode = 'buffer';
    private chunks: Buffer[] = [];
    private writeStream?: WriteStream;
    private ended = false;
    private endWaiters?: Array<() => void>;
    private error?: Error;
    private maxSize?: number;

    constructor( field: string, filename: string, mime: string, headers: Record<string, string> )
    {
        this.field = field;
        this.filename = filename;
        this.mime = mime;
        this.headers = headers;
    }

    /** Optional per-file byte cap checked in `write` (avoids wrapping `write`). */
    setMaxSize( bytes: number )
    {
        this.maxSize = bytes;
    }

    get mode(): UploadedFileMode
    {
        return this.fileMode;
    }

    /** Buffered bytes when mode is `buffer` (after parse completes). */
    get buffer(): Buffer
    {
        if( this.chunks.length === 0 ){ return Buffer.alloc( 0 ) }

        if( this.chunks.length === 1 ){ return this.chunks[0] }

        const joined = Buffer.concat( this.chunks );
        this.chunks = [ joined ];

        return joined;
    }

    /** Web stream over buffered content (available after the part ends). */
    stream(): ReadableStream<Uint8Array>
    {
        const data = this.buffer;

        return new ReadableStream({
            start( controller )
            {
                if( data.length )
                {
                    controller.enqueue( data );
                }

                controller.close();
            }
        });
    }

    /** Pipe part body to disk. Must be called when the file is opened (before/during body). */
    save( path: string )
    {
        if( this.ended )
        {
            throw new Error( 'Cannot save UploadedFile after part has ended' );
        }

        this.path = path;
        this.fileMode = 'disk';
        this.writeStream = createWriteStream( path );

        for( let i = 0; i < this.chunks.length; i++ )
        {
            this.writeStream.write( this.chunks[i]);
        }

        this.chunks = [];
    }

    /** Discard the rest of this part (and any buffered bytes). */
    skip()
    {
        this.fileMode = 'skip';
        this.chunks = [];

        if( this.writeStream )
        {
            this.writeStream.destroy();
            this.writeStream = undefined;
            this.path = undefined;
        }
    }

    /**
     * Write a body chunk. Returns a Promise only when the disk stream applies backpressure;
     * otherwise completes synchronously (callers should still `await` for uniformity).
     */
    write( chunk: Buffer ): void | Promise<void>
    {
        if( this.error ){ throw this.error }

        if( !chunk.length || this.fileMode === 'skip' ){ return }

        if( this.maxSize !== undefined && this.size + chunk.length > this.maxSize )
        {
            const err = Object.assign( new Error( 'File too large' ), { status : 413 });
            this.fail( err );

            throw err;
        }

        this.size += chunk.length;

        if( this.fileMode === 'disk' && this.writeStream )
        {
            if( this.writeStream.write( chunk )){ return }

            return once( this.writeStream, 'drain' ).then(() => undefined );
        }

        this.chunks.push( chunk );
    }

    end(): void | Promise<void>
    {
        if( this.ended ){ return }

        this.ended = true;

        const finishWaiters = () =>
        {
            const waiters = this.endWaiters;

            if( !waiters ){ return }

            this.endWaiters = undefined;

            for( let i = 0; i < waiters.length; i++ )
            {
                waiters[i]();
            }
        };

        if( this.writeStream )
        {
            const stream = this.writeStream;

            return new Promise<void>(( resolve, reject ) =>
            {
                stream.end(() =>
                {
                    finishWaiters();
                    resolve();
                });
                stream.on( 'error', reject );
            });
        }

        finishWaiters();
    }

    whenEnded(): Promise<void>
    {
        if( this.ended ){ return Promise.resolve() }

        if( !this.endWaiters )
        {
            this.endWaiters = [];
        }

        return new Promise( resolve => this.endWaiters!.push( resolve ));
    }

    fail( err: Error )
    {
        this.error = err;

        if( this.writeStream )
        {
            this.writeStream.destroy( err );
            this.writeStream = undefined;
        }

        void this.cleanup();
    }

    /** Remove a disk file written for this part (best-effort). */
    async cleanup()
    {
        const stream = this.writeStream;
        this.writeStream = undefined;

        if( stream )
        {
            await new Promise<void>( resolve =>
            {
                stream.once( 'close', () => resolve());
                stream.destroy();
            });
        }

        const path = this.path;

        if( !path ){ return }

        this.path = undefined;

        try
        {
            await unlink( path );
        }
        catch
        {
            // ignore missing / already removed
        }
    }
}

export type MultipartFieldValue = string | string[];

/** One completed part in wire order (for QueryParser-style unflatten). */
export interface MultipartPartEntry
{
    name  : string
    value : string | UploadedFile
}

export interface MultipartParseResult
{
    fields : Record<string, MultipartFieldValue>
    files  : UploadedFile[]
    /** Parts in parse order — used by `toObject()` unflatten. */
    parts  : MultipartPartEntry[]
}

/** Unified multipart entry: text field and/or uploaded file(s). */
export type MultipartValue = string | string[] | UploadedFile | UploadedFile[];

/**
 * Processed multipart form: text fields plus `UploadedFile` instances.
 * Built after streaming parse completes. `@Body` uses `toObject()` then
 * assert-validates with `from: 'query'`.
 */
export class MultipartPayload
{
    private readonly fieldMap : Record<string, MultipartFieldValue>;
    private readonly fileMap  : Map<string, UploadedFile[]>;
    private readonly fileList : UploadedFile[];
    private readonly partList : MultipartPartEntry[];

    private constructor(
        fields: Record<string, MultipartFieldValue>,
        files: UploadedFile[],
        parts: MultipartPartEntry[]
    )
    {
        this.fieldMap = { ...fields };
        this.fileList = files;
        this.partList = parts.slice();
        this.fileMap = new Map();

        for( let i = 0; i < files.length; i++ )
        {
            const file = files[i];
            const list = this.fileMap.get( file.field );

            if( list )
            {
                list.push( file );
            }
            else
            {
                this.fileMap.set( file.field, [ file ]);
            }
        }
    }

    static from( result: MultipartParseResult ): MultipartPayload
    {
        const parts = result.parts
            || MultipartPayload.partsFromMaps( result.fields, result.files );

        return new MultipartPayload( result.fields, result.files, parts );
    }

    /** Fallback when older results omit ordered `parts`. */
    private static partsFromMaps(
        fields: Record<string, MultipartFieldValue>,
        files: UploadedFile[]
    ): MultipartPartEntry[]
    {
        const parts: MultipartPartEntry[] = [];
        const names = Object.keys( fields );

        for( let i = 0; i < names.length; i++ )
        {
            const name = names[i];
            const value = fields[name];
            const values = Array.isArray( value ) ? value : [ value ];

            for( let j = 0; j < values.length; j++ )
            {
                parts.push({ name, value : values[j] });
            }
        }

        for( let i = 0; i < files.length; i++ )
        {
            parts.push({ name : files[i].field, value : files[i] });
        }

        return parts;
    }

    /** All text fields (wire strings / string arrays). */
    get fields(): Record<string, MultipartFieldValue>
    {
        return { ...this.fieldMap };
    }

    /** Every uploaded file, in parse order. */
    get uploads(): UploadedFile[]
    {
        return this.fileList.slice();
    }

    has( name: string ): boolean
    {
        return this.fieldMap[name] !== undefined || this.fileMap.has( name );
    }

    /** Keys present as a text field and/or file part. */
    keys(): string[]
    {
        const set = new Set<string>([
            ...Object.keys( this.fieldMap ),
            ...this.fileMap.keys()
        ]);

        return [ ...set ];
    }

    /** First text value for `name`, or `undefined`. */
    field( name: string ): string | undefined
    {
        const value = this.fieldMap[name];

        if( value === undefined ){ return undefined }

        return Array.isArray( value ) ? value[0] : value;
    }

    /** All text values for `name` (empty array if absent). */
    textFields( name: string ): string[]
    {
        const value = this.fieldMap[name];

        if( value === undefined ){ return [] }

        return Array.isArray( value ) ? value.slice() : [ value ];
    }

    /** First `UploadedFile` for `name`. */
    file( name: string ): UploadedFile | undefined
    {
        return this.fileMap.get( name )?.[0];
    }

    /** All files for `name`, or every file when `name` is omitted. */
    files( name?: string ): UploadedFile[]
    {
        if( name === undefined ){ return this.uploads }

        return ( this.fileMap.get( name ) || []).slice();
    }

    /**
     * Unified accessor. Prefer file(s) when the field has uploads;
     * otherwise the text value. Single file → `UploadedFile`; many → array.
     */
    get( name: string ): MultipartValue | undefined
    {
        const files = this.fileMap.get( name );

        if( files && files.length === 1 ){ return files[0] }

        if( files && files.length > 1 ){ return files.slice() }

        return this.fieldMap[name];
    }

    /**
     * Plain object for handlers / `@Body`: text + files, unflattened with the same
     * bracket rules as urlencoded `QueryParser` (`profile[name]`, `docs[]`, …).
     * Assigns in wire part order. Wire-level `field()` / `file()` stay literal.
     */
    toObject(): Record<string, any>
    {
        const bag = createFormBag();

        for( let i = 0; i < this.partList.length; i++ )
        {
            const part = this.partList[i];
            bag.assign( part.name, part.value );
        }

        return bag;
    }

    async cleanup()
    {
        await cleanupUploadedFiles( this.fileList );
    }
}

export interface MultipartParseOptions
{
    maxFileSize?  : number
    maxFiles?     : number
    maxFields?    : number
    maxFieldSize? : number
    maxTotalSize? : number
    /** Abort in-flight parse (timeout / disconnect). */
    signal?       : AbortSignal
    /** Called when a file part header is known — set `save()` / `skip()` here. */
    onFile?       : ( file: UploadedFile ) => void | Promise<void>
    /** Called for non-file field values as they complete. */
    onField?      : ( name: string, value: string ) => void | Promise<void>
    filter?       : ( file: UploadedFile ) => boolean | Promise<boolean>
    /**
     * Nesting depth of this parser (0 = root). Internal — set when recursing into
     * `multipart/*` parts. Recursion stops at {@link MAX_MULTIPART_NEST_DEPTH}.
     */
    nestDepth?    : number
    /**
     * Bracket prefix for part names (e.g. `bundle` so inner `child` → `bundle[child]`).
     * Internal — set when recursing.
     */
    namePrefix?   : string
}

export function throwIfAborted( signal?: AbortSignal )
{
    if( !signal?.aborted ){ return }

    throw Object.assign( new Error( 'Request aborted' ), { status : 408, name : 'AbortError' });
}

/** Best-effort unlink of any disk-backed parts (e.g. after a failed parse). */
export async function cleanupUploadedFiles( files: UploadedFile[] )
{
    await Promise.all( files.map( f => f.cleanup()));
}

type BoundaryHit =
{
    start    : number
    length?  : number
    last?    : boolean
    partial? : boolean
};

function isPromise( value: void | Promise<void> ): value is Promise<void>
{
    return value !== undefined && typeof ( value as Promise<void> ).then === 'function';
}

/**
 * Streaming multipart/form-data parser using MultiBuffer boundary search
 * (same strategy as liqd-js/http-body-parser).
 */
export class MultipartParser
{
    private boundary : Buffer;
    private buffer   : MultiBuffer;
    private step     : number = Step.PREAMBLE;
    private headers  : Record<string, string> = {};
    private partName = '';
    private file?    : UploadedFile;
    private fieldSize = 0;
    private fieldChunks: Buffer[] = [];
    private files: UploadedFile[] = [];
    private fields: Record<string, MultipartFieldValue> = {};
    private parts: MultipartPartEntry[] = [];
    private fileCount = 0;
    private fieldCount = 0;
    private totalSize = 0;
    private options: MultipartParseOptions;
    private pending: Promise<void> = Promise.resolve();
    private finished = false;
    private hit: BoundaryHit = { start : -1 };
    /** When set, current part body is a nested multipart to re-parse. */
    private nestedBoundary?: string;

    constructor( boundary: string, options: MultipartParseOptions = {})
    {
        this.boundary = Buffer.from( '--' + boundary, 'utf8' );
        this.buffer = new MultiBuffer();
        this.options = options;
    }

    get result(): MultipartParseResult
    {
        return { fields : this.fields, files : this.files, parts : this.parts };
    }

    get done(): boolean
    {
        return this.finished;
    }

    append( chunk: Uint8Array | Buffer )
    {
        throwIfAborted( this.options.signal );

        if( !chunk.length ){ return }

        // Prefer retaining Buffer views; copy Uint8Array so reused stream buffers stay safe.
        const buf = Buffer.isBuffer( chunk ) ? chunk : Buffer.from( chunk );

        this.totalSize += buf.length;

        if( this.options.maxTotalSize !== undefined && this.totalSize > this.options.maxTotalSize )
        {
            throw Object.assign( new Error( 'Request body too large' ), { status : 413 });
        }

        this.buffer.append( buf );

        if( this.buffer.chunkCount > COMPACT_CHUNK_THRESHOLD )
        {
            this.buffer.compact();
        }
    }

    async parse(): Promise<void>
    {
        await this.pending;
        this.pending = this.parseLoop();
        await this.pending;
    }

    async finish(): Promise<MultipartParseResult>
    {
        await this.parse();

        if( !this.finished )
        {
            throw Object.assign( new Error( 'Incomplete multipart body' ), { status : 400 });
        }

        return this.result;
    }

    private async parseLoop()
    {
        while( true )
        {
            throwIfAborted( this.options.signal );

            if( this.step === Step.PREAMBLE )
            {
                const boundary = this.findBoundary( false );

                if( !boundary ){ break }

                this.buffer.splice( 0, boundary.start + boundary.length! );
                this.boundary = Buffer.concat([ CRLF, this.boundary ]);
                this.step = Step.PART_HEADER;

                continue;
            }

            if( this.step === Step.PART_HEADER )
            {
                const caret = this.buffer.indexOf( CRLF_CRLF );

                if( caret === -1 ){ break }

                const headerRaw = this.buffer.spliceConcat( 0, caret + CRLF_CRLF.length ).toString( 'utf8' );
                this.headers = parseHeaders( headerRaw );
                this.step = Step.PART_BODY;

                const disposition = parseContentDisposition( this.headers['content-disposition'] );
                const rawName = disposition.name || '';
                this.partName = nestFieldName( this.options.namePrefix || '', rawName );

                const nestDepth = this.options.nestDepth ?? 0;
                const nestedBoundary = nestDepth < MAX_MULTIPART_NEST_DEPTH
                    && isMultipartMime( this.headers['content-type'] )
                    ? extractMultipartBoundary( this.headers['content-type'] )
                    : undefined;

                if( nestedBoundary )
                {
                    // Recurse into multipart/* body; merge under this.partName prefix.
                    this.nestedBoundary = nestedBoundary;
                    this.file = undefined;
                    this.fieldChunks = [];
                    this.fieldSize = 0;
                    this.step = Step.PART_BODY;

                    continue;
                }

                this.nestedBoundary = undefined;

                if( disposition.filename !== undefined )
                {
                    const mime = this.headers['content-type'] || 'application/octet-stream';
                    const file = new UploadedFile( this.partName, disposition.filename, mime, this.headers );

                    if( this.options.filter )
                    {
                        const ok = await this.options.filter( file );

                        if( !ok )
                        {
                            file.skip();
                        }
                    }

                    if( file.mode !== 'skip' && this.options.onFile )
                    {
                        await this.options.onFile( file );
                    }

                    this.file = file;
                    this.files.push( file );
                    this.fileCount++;

                    if( this.options.maxFiles !== undefined && this.fileCount > this.options.maxFiles )
                    {
                        throw Object.assign( new Error( 'Too many files' ), { status : 413 });
                    }
                }
                else
                {
                    this.file = undefined;
                    this.fieldChunks = [];
                    this.fieldSize = 0;
                    this.fieldCount++;

                    if( this.options.maxFields !== undefined && this.fieldCount > this.options.maxFields )
                    {
                        throw Object.assign( new Error( 'Too many fields' ), { status : 413 });
                    }
                }

                continue;
            }

            if( this.step === Step.PART_BODY )
            {
                if( this.file )
                {
                    const boundary = this.findBoundary( true );

                    if( !boundary )
                    {
                        // No boundary prefix in the buffer — flush everything except a
                        // tail that could still form `--boundary` + `--` / `\r\n`.
                        await this.flushFileSafe();

                        break;
                    }

                    const partBuffers = this.buffer.splice( 0, boundary.start );
                    const file = this.file;

                    for( let i = 0; i < partBuffers.length; i++ )
                    {
                        const written = this.writeFileChunk( file, partBuffers[i]);

                        if( isPromise( written ))
                        {
                            await written;
                        }
                    }

                    if( boundary.partial ){ break }

                    this.buffer.splice( 0, boundary.length! );
                    const ended = file.end();

                    if( isPromise( ended ))
                    {
                        await ended;
                    }

                    this.parts.push({ name : file.field, value : file });
                    this.file = undefined;
                    this.step = boundary.last ? Step.DONE : Step.PART_HEADER;

                    continue;
                }

                // Nested multipart/* body (buffered, then re-parsed with namePrefix).
                if( this.nestedBoundary )
                {
                    const boundary = this.findBoundary( false );

                    if( !boundary ){ break }

                    const partBuffers = this.buffer.splice( 0, boundary.start );

                    for( let i = 0; i < partBuffers.length; i++ )
                    {
                        this.fieldChunks.push( partBuffers[i]);
                        this.fieldSize += partBuffers[i].length;
                    }

                    const valueBuf = this.fieldChunks.length === 1
                        ? this.fieldChunks[0]
                        : Buffer.concat( this.fieldChunks, this.fieldSize );
                    this.fieldChunks = [];
                    this.fieldSize = 0;

                    await this.ingestNestedMultipart( valueBuf, this.nestedBoundary, this.partName );
                    this.nestedBoundary = undefined;

                    this.buffer.splice( 0, boundary.length! );
                    this.step = boundary.last ? Step.DONE : Step.PART_HEADER;

                    continue;
                }

                const boundary = this.findBoundary( false );

                if( !boundary ){ break }

                const partBuffers = this.buffer.splice( 0, boundary.start );
                const maxField = this.options.maxFieldSize;

                for( let i = 0; i < partBuffers.length; i++ )
                {
                    const buf = partBuffers[i];
                    this.fieldSize += buf.length;

                    if( maxField !== undefined && this.fieldSize > maxField )
                    {
                        throw Object.assign( new Error( 'Field value too large' ), { status : 413 });
                    }

                    this.fieldChunks.push( buf );
                }

                const valueBuf = this.fieldChunks.length === 1
                    ? this.fieldChunks[0]
                    : Buffer.concat( this.fieldChunks, this.fieldSize );
                this.fieldChunks = [];
                this.fieldSize = 0;

                const value = valueBuf.toString( 'utf8' );
                this.assignField( this.partName, value );

                if( this.options.onField )
                {
                    await this.options.onField( this.partName, value );
                }

                this.buffer.splice( 0, boundary.length! );
                this.step = boundary.last ? Step.DONE : Step.PART_HEADER;

                continue;
            }

            if( this.step === Step.DONE )
            {
                this.finished = true;

                break;
            }

            break;
        }
    }

    private writeFileChunk( file: UploadedFile, buf: Buffer ): void | Promise<void>
    {
        if( this.options.maxFileSize !== undefined && file.size + buf.length > this.options.maxFileSize )
        {
            file.fail( Object.assign( new Error( 'File too large' ), { status : 413 }));

            throw Object.assign( new Error( 'File too large' ), { status : 413 });
        }

        return file.write( buf );
    }

    /**
     * Emit file body bytes that cannot be part of a boundary. Keeps
     * `boundary.length + 2` bytes (enough for `--` or `\r\n` after the delimiter).
     */
    private async flushFileSafe()
    {
        const file = this.file;

        if( !file ){ return }

        const keep = this.boundary.length + DASH_DASH.length;
        const flush = this.buffer.length - keep;

        if( flush <= 0 ){ return }

        const partBuffers = this.buffer.splice( 0, flush );

        for( let i = 0; i < partBuffers.length; i++ )
        {
            const written = this.writeFileChunk( file, partBuffers[i]);

            if( isPromise( written ))
            {
                await written;
            }
        }
    }

    private assignField( name: string, value: string )
    {
        const existing = this.fields[name];

        if( existing === undefined )
        {
            this.fields[name] = value;
        }
        else if( Array.isArray( existing ))
        {
            existing.push( value );
        }
        else
        {
            this.fields[name] = [ existing, value ];
        }

        this.parts.push({ name, value });
    }

    /**
     * Re-parse a nested multipart body and merge parts into this parser.
     * Inner names are already prefixed via `namePrefix` on the child parser.
     */
    private async ingestNestedMultipart( body: Buffer, boundary: string, namePrefix: string )
    {
        const nestDepth = ( this.options.nestDepth ?? 0 ) + 1;
        const nested = new MultipartParser( boundary, {
            ...this.options,
            nestDepth,
            namePrefix,
            // Bytes already counted on the outer `append` path.
            maxTotalSize : undefined
        });

        nested.append( body );
        const result = await nested.finish();

        for( let i = 0; i < result.parts.length; i++ )
        {
            const part = result.parts[i];

            if( typeof part.value === 'string' )
            {
                this.fieldCount++;

                if( this.options.maxFields !== undefined && this.fieldCount > this.options.maxFields )
                {
                    throw Object.assign( new Error( 'Too many fields' ), { status : 413 });
                }

                this.assignField( part.name, part.value );
            }
            else
            {
                this.files.push( part.value );
                this.fileCount++;

                if( this.options.maxFiles !== undefined && this.fileCount > this.options.maxFiles )
                {
                    throw Object.assign( new Error( 'Too many files' ), { status : 413 });
                }

                this.parts.push( part );
            }
        }
    }

    private findBoundary( partial: boolean ): BoundaryHit | undefined
    {
        let boundaryStart = -1;
        const hit = this.hit;

        do
        {
            boundaryStart = this.buffer.indexOf( this.boundary, boundaryStart + 1 );

            if( boundaryStart === -1 ){ break }

            if( this.buffer.equals( BOUNDARY_END, boundaryStart + this.boundary.length ))
            {
                hit.start = boundaryStart;
                hit.length = this.boundary.length + BOUNDARY_END.length;
                hit.last = false;
                hit.partial = undefined;

                return hit;
            }

            // Closing delimiter: `--boundary--` optionally followed by CRLF / LF / epilogue.
            if( this.buffer.equals( DASH_DASH, boundaryStart + this.boundary.length, 2 ))
            {
                let length = this.boundary.length + 2;
                const after = boundaryStart + length;

                if( this.buffer.equals( BOUNDARY_END, after ))
                {
                    length += BOUNDARY_END.length;
                }
                else if( this.buffer.get( after ) === 0x0a )
                {
                    length += 1;
                }

                hit.start = boundaryStart;
                hit.length = length;
                hit.last = true;
                hit.partial = undefined;

                return hit;
            }
        }
        while( boundaryStart !== -1 );

        if( partial )
        {
            const start = this.buffer.partialIndexOf(
                this.boundary,
                Math.max(
                    0,
                    this.buffer.length - this.boundary.length - Math.max( BOUNDARY_END.length, DASH_DASH.length )
                )
            );

            if( start !== -1 )
            {
                hit.start = start;
                hit.length = undefined;
                hit.last = undefined;
                hit.partial = true;

                return hit;
            }
        }

        return undefined;
    }
}

/** Stream a Fetch body through the multipart parser. */
export async function parseMultipartStream(
    body: ReadableStream<Uint8Array> | null,
    contentType: string | null,
    options: MultipartParseOptions = {}
): Promise<MultipartParseResult>
{
    const boundary = extractMultipartBoundary( contentType );

    if( !boundary )
    {
        throw Object.assign( new Error( 'Missing multipart boundary' ), { status : 400 });
    }

    if( !body )
    {
        throw Object.assign( new Error( 'Request has no body' ), { status : 400 });
    }

    throwIfAborted( options.signal );

    const parser = new MultipartParser( boundary, options );
    const reader = body.getReader();
    const onAbort = () => { void reader.cancel().catch(() => undefined ) };

    options.signal?.addEventListener( 'abort', onAbort, { once : true });

    try
    {
        while( true )
        {
            throwIfAborted( options.signal );

            const { done, value } = await reader.read();

            if( done ){ break }

            if( value && value.byteLength )
            {
                parser.append( value );
                await parser.parse();
            }
        }

        return await parser.finish();
    }
    catch( err )
    {
        try { reader.cancel(); } catch { /* ignore */ }
        await cleanupUploadedFiles( parser.result.files );

        throw err;
    }
    finally
    {
        options.signal?.removeEventListener( 'abort', onAbort );
    }
}
