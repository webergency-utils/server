import { Context, type RequestContext } from './context.js';
import { AugmentedRequest, PeerCert } from './types.js';
import { SecurityOptions } from '../decorators.js';
import { RequestReader, DEFAULT_MAX_BODY_SIZE } from '../helpers/request-reader.js';
import { resolveClientIp } from '../helpers/client-ip.js';
import { parseSize } from '../helpers/security.js';
import
{
    mergeFileConfigs,
    processMultipartUpload,
    type FileOptions,
    type MultipartParseResult,
    UploadedFile,
    MultipartPayload
}
from '../helpers/file-upload.js';

/**
 * Sealed request facade for controllers/middleware. Not a Fetch `Request`.
 * Wire bags (`headers`, `cookies`, `query`, `params`) are always strings.
 */
export class ServerRequest
{
    #req      : AugmentedRequest;
    #security : SecurityOptions | undefined;
    #files    : FileOptions | undefined;
    #headers? : Record<string, string>;
    #cookies? : Record<string, string>;
    #form?    : FormData;
    #payload? : MultipartPayload;
    #bodyMode?: 'raw' | 'text' | 'form' | 'stream' | 'multipart';

    constructor( req: AugmentedRequest, security?: SecurityOptions, files?: FileOptions )
    {
        this.#req = req;
        this.#security = security;
        this.#files = files;
    }

    get method(): string
    {
        return this.#req.method;
    }

    get url(): string
    {
        return this.#req.url;
    }

    get path(): string
    {
        return new URL( this.#req.url ).pathname;
    }

    get hostname(): string
    {
        return new URL( this.#req.url ).hostname;
    }

    get ip(): string
    {
        return resolveClientIp( this.#req );
    }

    get requestID(): string | undefined
    {
        return this.#req.requestId;
    }

    /** Wire headers as a string map (cached). Not mutated by typed `@Headers` parsers. */
    get headers(): Record<string, string>
    {
        if( !this.#headers )
        {
            this.#headers = Object.fromEntries( this.#req.headers.entries());
        }

        return this.#headers;
    }

    /** Wire cookies as a string map (cached). Not mutated by typed `@Cookies` parsers. */
    get cookies(): Record<string, string>
    {
        if( !this.#cookies )
        {
            this.#cookies = parseCookieHeader( this.#req.headers.get( 'cookie' ));
        }

        return this.#cookies;
    }

    get params(): Record<string, string>
    {
        return this.#req.params;
    }

    get query(): Record<string, string>
    {
        return this.#req.query;
    }

    get peer(): PeerCert | undefined
    {
        return ( this.#req as AugmentedRequest & { clientCert?: PeerCert }).clientCert;
    }

    /** AbortSignal when `security.timeout` is set (and later disconnect). */
    get signal(): AbortSignal | undefined
    {
        return this.#req.abortSignal;
    }

    get context(): RequestContext | undefined
    {
        return Context.get();
    }

    /** Effective upload options for this request (after hierarchical merge). */
    get fileOptions(): FileOptions | undefined
    {
        return this.#files;
    }

    async rawBody(): Promise<ArrayBuffer>
    {
        this.#consumeBody( 'raw' );

        return RequestReader.getRawBody( this.#req, this.#security );
    }

    async text(): Promise<string>
    {
        this.#consumeBody( 'text' );
        const raw = await RequestReader.getRawBody( this.#req, this.#security );

        return new TextDecoder().decode( raw );
    }

    /**
     * Parse multipart (or urlencoded) form data under `maxBodySize`.
     * Uses a size-capped raw read, then `Response.formData()`.
     * Prefer `uploads()` / `@File` for streaming multipart with disk storage.
     */
    async formData(): Promise<FormData>
    {
        if( this.#form ){ return this.#form }

        this.#consumeBody( 'form' );
        const raw = await RequestReader.getRawBody( this.#req, this.#security );
        const contentType = this.#req.headers.get( 'content-type' ) || 'multipart/form-data';
        this.#form = await new Response( raw, { headers : { 'Content-Type' : contentType } }).formData();

        return this.#form;
    }

    async file( name: string ): Promise<File | null>
    {
        const form = await this.formData();
        const value = form.get( name );

        return value instanceof File ? value : null;
    }

    async files( name: string ): Promise<File[]>
    {
        const form = await this.formData();

        return form.getAll( name ).filter(( value ): value is File => value instanceof File );
    }

    /**
     * Streaming multipart parse (MultiBuffer parser). Honors `#files` options
     * (dest / onFile / limits). Cached on the underlying request.
     */
    async multipart(): Promise<MultipartParseResult>
    {
        if( this.#req._multipart ){ return this.#req._multipart }

        this.#consumeBody( 'multipart' );

        const maxTotal = resolveMultipartTotalLimit( this.#security, this.#files );
        const result = await processMultipartUpload(
            this.#req.body,
            this.#req.headers.get( 'content-type' ),
            this.#files,
            maxTotal,
            this.#req.abortSignal
        );

        this.#req._multipart = result;

        return result;
    }

    /** First `UploadedFile` for a field (streaming multipart). */
    async upload( name: string ): Promise<UploadedFile | undefined>
    {
        const { files } = await this.multipart();

        return files.find( f => f.field === name );
    }

    /** All `UploadedFile`s, optionally filtered by field name. */
    async uploads( name?: string ): Promise<UploadedFile[]>
    {
        const { files } = await this.multipart();

        return name === undefined ? files : files.filter( f => f.field === name );
    }

    /** Multipart text fields from the streaming parser. */
    async multipartFields(): Promise<Record<string, string | string[]>>
    {
        const { fields } = await this.multipart();

        return fields;
    }

    /**
     * Processed multipart bag: text fields + `UploadedFile` instances.
     * Prefer `@Body()` (multipart → bag + validator) over calling this manually.
     */
    async payload(): Promise<MultipartPayload>
    {
        if( this.#payload ){ return this.#payload }

        if( this.#req._multipartPayload ){ return this.#req._multipartPayload }

        const result = await this.multipart();
        const payload = MultipartPayload.from( result );
        this.#payload = payload;
        this.#req._multipartPayload = payload;

        return payload;
    }

    /** Raw body stream — not size-capped; caller must enforce limits. */
    stream(): ReadableStream<Uint8Array>
    {
        if( this.#req._raw !== undefined || this.#bodyMode )
        {
            throw Object.assign( new Error( 'Request body already consumed' ), { status : 400 });
        }

        if( this.#req.body == null )
        {
            throw Object.assign( new Error( 'Request has no body stream' ), { status : 400 });
        }

        this.#bodyMode = 'stream';

        return this.#req.body as ReadableStream<Uint8Array>;
    }

    #consumeBody( mode: 'raw' | 'text' | 'form' | 'stream' | 'multipart' )
    {
        if( this.#bodyMode === 'stream' )
        {
            throw Object.assign( new Error( 'Request body already consumed' ), { status : 400 });
        }

        if( this.#bodyMode && this.#bodyMode !== mode && !( this.#bodyMode === 'raw' && mode === 'text' ) && !( this.#bodyMode === 'text' && mode === 'raw' ))
        {
            if( !( this.#form && mode === 'form' ) && !( this.#req._multipart && mode === 'multipart' ))
            {
                throw Object.assign( new Error( 'Request body already consumed' ), { status : 400 });
            }
        }

        this.#bodyMode = mode;
    }
}

function resolveMultipartTotalLimit( security?: SecurityOptions, files?: FileOptions ): number | undefined
{
    if( files?.maxTotalSize !== undefined )
    {
        return parseSize( files.maxTotalSize );
    }

    const configured = security?.maxBodySize;

    if( configured === undefined )
    {
        return parseSize( DEFAULT_MAX_BODY_SIZE );
    }

    if( configured === 0 || configured === Infinity )
    {
        return undefined;
    }

    return parseSize( configured );
}

/** Resolve Server → Module → route file options. */
export function resolveRequestFileOptions( req: AugmentedRequest, moduleFiles?: FileOptions ): FileOptions | undefined
{
    return mergeFileConfigs([ req.globalFiles, moduleFiles, req.files ]);
}

export function parseCookieHeader( cookieHeader: string | null ): Record<string, string>
{
    const cookies: Record<string, string> = {};

    if( !cookieHeader ){ return cookies }

    const pairs = cookieHeader.split( ';' );

    for( const pair of pairs )
    {
        const idx = pair.indexOf( '=' );

        if( idx === -1 ){ continue }
        const key = pair.substring( 0, idx ).trim();
        const val = pair.substring( idx + 1 ).trim();

        if( cookies[key] === undefined )
        {
            cookies[key] = val;
        }
    }

    return cookies;
}
