import { describe, it, expect } from 'vitest';
import
{
    ServerRequest,
    parseCookieHeader,
    resolveRequestFileOptions
}
from '../src/core/server-request.js';
import { ServerResponse, ResponseBag } from '../src/core/types.js';
import type { AugmentedRequest, PeerCert } from '../src/core/types.js';
import { Context } from '../src/core/context.js';

function createAugmented( init: RequestInit & { url?: string } = {}): AugmentedRequest
{
    const url = init.url || 'https://api.example.com/v1/items?q=1';
    const initOpts: RequestInit & { duplex?: 'half' } =
    {
        method  : init.method || 'GET',
        headers : init.headers,
        body    : init.body
    };

    if( init.body && typeof init.body === 'object' && typeof ( init.body as ReadableStream ).getReader === 'function' )
    {
        initOpts.duplex = 'half';
    }

    const req = new Request( url, initOpts ) as AugmentedRequest;
    req.params = {};
    req.query = { q : '1' };
    req.meta = {};
    req.remoteAddress = '127.0.0.1';

    return req;
}

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
            const size = 7;

            for( let i = 0; i < buffer.length; i += size )
            {
                controller.enqueue( buffer.subarray( i, Math.min( i + size, buffer.length )));
            }

            controller.close();
        }
    });
}

describe( 'ServerRequest', () =>
{
    it( 'should expose string bags and identity fields without Fetch leak', () =>
    {
        // Arrange
        const raw = createAugmented({
            headers : { cookie : 'a=1; b=2', 'x-test' : 'yes' }
        });
        const req = new ServerRequest( raw );

        // Assert
        expect( req ).toBeInstanceOf( ServerRequest );
        expect( req instanceof Request ).toBe( false );
        expect( req.method ).toBe( 'GET' );
        expect( req.path ).toBe( '/v1/items' );
        expect( req.hostname ).toBe( 'api.example.com' );
        expect( req.query ).toEqual({ q : '1' });
        expect( req.cookies ).toEqual({ a : '1', b : '2' });
        expect( req.headers['x-test']).toBe( 'yes' );
        expect( req.ip ).toBe( '127.0.0.1' );
    });

    it( 'should expose requestID, params, peer, signal, context, and fileOptions', () =>
    {
        // Arrange
        const raw = createAugmented();
        raw.requestId = 'req-42';
        raw.params = { id : '7' };
        const peer =
        {
            subject : 'CN=client',
            issuer  : 'CN=ca'
        } as PeerCert;
        ( raw as AugmentedRequest & { clientCert?: PeerCert }).clientCert = peer;
        const ac = new AbortController();
        raw.abortSignal = ac.signal;
        const files = { dest : '/tmp/uploads' };
        const req = new ServerRequest( raw, undefined, files );

        // Act / Assert
        expect( req.requestID ).toBe( 'req-42' );
        expect( req.params ).toEqual({ id : '7' });
        expect( req.peer ).toBe( peer );
        expect( req.signal ).toBe( ac.signal );
        expect( req.fileOptions ).toBe( files );
        expect( req.context ).toBeUndefined();

        Context.run(
            {
                request  : raw,
                metadata :
                {
                    controller   : 'C',
                    methodName   : 'h',
                    httpMethod   : 'GET',
                    path         : '/',
                    params       : [],
                    guards       : [],
                    interceptors : [],
                    middlewares  : [],
                    meta         : {}
                }
            },
            () =>
            {
                expect( req.context?.request ).toBe( raw );
            }
        );
    });

    it( 'should keep cookie/header bags as strings when copies are mutated', () =>
    {
        // Arrange
        const raw = createAugmented({ headers : { cookie : 'age=28' } });
        const req = new ServerRequest( raw );
        const cookies = { ...req.cookies };
        ( cookies as Record<string, unknown> ).age = 99;

        // Assert
        expect( req.cookies.age ).toBe( '28' );
    });

    it( 'should read rawBody and text under the shared body cache', async () =>
    {
        // Arrange
        const raw = createAugmented({
            method  : 'POST',
            headers : { 'content-type' : 'text/plain' },
            body    : 'hello'
        });
        const req = new ServerRequest( raw, { maxBodySize : '1mb' });

        // Act
        const buf = await req.rawBody();

        // Assert
        expect( new TextDecoder().decode( buf )).toBe( 'hello' );
        expect( await req.text()).toBe( 'hello' );
    });

    it( 'should parse urlencoded formData and resolve file / files', async () =>
    {
        // Arrange
        const raw = createAugmented({
            method  : 'POST',
            headers : { 'content-type' : 'application/x-www-form-urlencoded' },
            body    : 'name=Ada&age=30'
        });
        const req = new ServerRequest( raw, { maxBodySize : '1mb' });

        // Act
        const form = await req.formData();
        const again = await req.formData();

        // Assert
        expect( form.get( 'name' )).toBe( 'Ada' );
        expect( again ).toBe( form );
        expect( await req.file( 'name' )).toBeNull();
        expect( await req.files( 'name' )).toEqual([]);
    });

    it( 'should parse multipart formData with File parts', async () =>
    {
        // Arrange
        const boundary = 'formBound';
        const body = multipartBody( boundary, [
            'Content-Disposition: form-data; name="title"\r\n\r\nhello',
            'Content-Disposition: form-data; name="doc"; filename="a.txt"\r\nContent-Type: text/plain\r\n\r\nfile-bytes',
            'Content-Disposition: form-data; name="doc"; filename="b.txt"\r\nContent-Type: text/plain\r\n\r\nmore'
        ]);
        const raw = createAugmented({
            method  : 'POST',
            headers : { 'content-type' : `multipart/form-data; boundary=${boundary}` },
            body
        });
        const req = new ServerRequest( raw, { maxBodySize : '1mb' });

        // Act
        const file = await req.file( 'doc' );
        const files = await req.files( 'doc' );

        // Assert
        expect( file ).toBeInstanceOf( File );
        expect( file?.name ).toBe( 'a.txt' );
        expect( files ).toHaveLength( 2 );
        expect( await files[0].text()).toBe( 'file-bytes' );
    });

    it( 'should stream multipart via multipart / upload / uploads / multipartFields / payload', async () =>
    {
        // Arrange
        const boundary = 'streamBound';
        const body = multipartBody( boundary, [
            'Content-Disposition: form-data; name="note"\r\n\r\nhi',
            'Content-Disposition: form-data; name="doc"; filename="d.txt"\r\nContent-Type: text/plain\r\n\r\nok',
            'Content-Disposition: form-data; name="doc"; filename="e.txt"\r\nContent-Type: text/plain\r\n\r\nye'
        ]);
        const raw = createAugmented({
            method  : 'POST',
            headers : { 'content-type' : `multipart/form-data; boundary=${boundary}` },
            body    : streamFrom( body )
        });
        const req = new ServerRequest( raw, { maxBodySize : '1mb' }, { storage : 'memory' });

        // Act
        const parsed = await req.multipart();
        const cached = await req.multipart();
        const one = await req.upload( 'doc' );
        const all = await req.uploads();
        const filtered = await req.uploads( 'doc' );
        const fields = await req.multipartFields();
        const payload = await req.payload();
        const payloadAgain = await req.payload();

        // Assert
        expect( cached ).toBe( parsed );
        expect( one?.filename ).toBe( 'd.txt' );
        expect( all ).toHaveLength( 2 );
        expect( filtered ).toHaveLength( 2 );
        expect( fields ).toEqual({ note : 'hi' });
        expect( payload.field( 'note' )).toBe( 'hi' );
        expect( payloadAgain ).toBe( payload );
    });

    it( 'should honor files.maxTotalSize and security.maxBodySize for multipart total limit', async () =>
    {
        // Arrange
        const boundary = 'lim';
        const body = multipartBody( boundary, [
            'Content-Disposition: form-data; name="f"; filename="f.txt"\r\n\r\nabc'
        ]);

        const withFilesLimit = createAugmented({
            method  : 'POST',
            headers : { 'content-type' : `multipart/form-data; boundary=${boundary}` },
            body    : streamFrom( body )
        });
        const reqFiles = new ServerRequest( withFilesLimit, { maxBodySize : '1mb' }, {
            storage      : 'memory',
            maxTotalSize : 2
        });

        // Act / Assert — files.maxTotalSize wins and rejects oversized body
        await expect( reqFiles.multipart()).rejects.toMatchObject({ status : 413 });

        for( const maxBodySize of [ 0, Infinity, undefined ] as const )
        {
            const raw = createAugmented({
                method  : 'POST',
                headers : { 'content-type' : `multipart/form-data; boundary=${boundary}` },
                body    : streamFrom( body )
            });
            const security = maxBodySize === undefined ? {} : { maxBodySize };
            const req = new ServerRequest( raw, security, { storage : 'memory' });
            const result = await req.multipart();

            expect( result.files[0].buffer.toString()).toBe( 'abc' );
        }
    });

    it( 'should return stream body and reject missing or already-consumed bodies', async () =>
    {
        // Arrange
        const payload = new TextEncoder().encode( 'stream-me' );
        const streamBody = new ReadableStream<Uint8Array>({
            start( controller )
            {
                controller.enqueue( payload );
                controller.close();
            }
        });
        const withBody = createAugmented({
            method  : 'POST',
            headers : { 'content-type' : 'application/octet-stream' },
            body    : streamBody
        });
        const req = new ServerRequest( withBody );

        // Act
        const out = req.stream();
        const chunks: Uint8Array[] = [];

        for await ( const chunk of out as unknown as AsyncIterable<Uint8Array> )
        {
            chunks.push( chunk );
        }

        // Assert
        expect( Buffer.concat( chunks.map( c => Buffer.from( c ))).toString()).toBe( 'stream-me' );
        expect(() => req.stream()).toThrow( /already consumed/ );

        const noBody = createAugmented({ method : 'POST' });
        Object.defineProperty( noBody, 'body', { value : null, configurable : true });
        const empty = new ServerRequest( noBody );

        expect(() => empty.stream()).toThrow( /no body stream/ );
    });

    it( 'should reject stream after buffered body read', async () =>
    {
        // Arrange
        const raw = createAugmented({
            method  : 'POST',
            headers : { 'content-type' : 'application/octet-stream' },
            body    : 'x'
        });
        const req = new ServerRequest( raw );
        await req.rawBody();

        // Assert
        expect(() => req.stream()).toThrow( /already consumed/ );
    });

    it( 'should throw when form follows raw, but allow cached form twice', async () =>
    {
        // Arrange
        const conflict = createAugmented({
            method  : 'POST',
            headers : { 'content-type' : 'application/x-www-form-urlencoded' },
            body    : 'a=1'
        });
        const conflictReq = new ServerRequest( conflict, { maxBodySize : '1mb' });
        await conflictReq.rawBody();

        // Assert
        await expect( conflictReq.formData()).rejects.toMatchObject({
            message : expect.stringMatching( /already consumed/ )
        });

        const ok = createAugmented({
            method  : 'POST',
            headers : { 'content-type' : 'application/x-www-form-urlencoded' },
            body    : 'a=1'
        });
        const okReq = new ServerRequest( ok, { maxBodySize : '1mb' });
        const first = await okReq.formData();
        const second = await okReq.formData();

        expect( second ).toBe( first );
        expect( first.get( 'a' )).toBe( '1' );
    });

    it( 'should reject buffered reads after stream and reuse cached multipart payload', async () =>
    {
        // Arrange — stream first, then raw must conflict via #consumeBody stream branch
        const streamBody = new ReadableStream<Uint8Array>({
            start( controller )
            {
                controller.enqueue( new TextEncoder().encode( 'x' ));
                controller.close();
            }
        });
        const streamed = createAugmented({
            method  : 'POST',
            headers : { 'content-type' : 'application/octet-stream' },
            body    : streamBody
        });
        const streamReq = new ServerRequest( streamed );
        streamReq.stream();

        // Assert
        await expect( streamReq.rawBody()).rejects.toMatchObject({
            message : expect.stringMatching( /already consumed/ )
        });

        // Arrange — payload cache on request bag reused across ServerRequest instances
        const boundary = 'pay';
        const body = multipartBody( boundary, [
            'Content-Disposition: form-data; name="n"\r\n\r\nv',
            'Content-Disposition: form-data; name="f"; filename="f.txt"\r\nContent-Type: text/plain\r\n\r\nok'
        ]);
        const raw = createAugmented({
            method  : 'POST',
            headers : { 'content-type' : `multipart/form-data; boundary=${boundary}` },
            body    : streamFrom( body )
        });
        const first = new ServerRequest( raw, { maxBodySize : '1mb' }, { storage : 'memory' });
        const payload = await first.payload();
        const second = new ServerRequest( raw, { maxBodySize : '1mb' }, { storage : 'memory' });

        // Act
        const reused = await second.payload();

        // Assert
        expect( reused ).toBe( payload );
        expect( reused.field( 'n' )).toBe( 'v' );
    });

    it( 'should reject multipart after form mode conflict', async () =>
    {
        // Arrange
        const raw = createAugmented({
            method  : 'POST',
            headers : { 'content-type' : 'application/x-www-form-urlencoded' },
            body    : 'a=1'
        });
        const req = new ServerRequest( raw, { maxBodySize : '1mb' });
        await req.formData();

        // Assert
        await expect( req.multipart()).rejects.toMatchObject({
            message : expect.stringMatching( /already consumed/ )
        });
    });
});

describe( 'parseCookieHeader', () =>
{
    it( 'should handle null, missing equals, and duplicate keys keeping first', () =>
    {
        // Assert
        expect( parseCookieHeader( null )).toEqual({});
        expect( parseCookieHeader( 'lonely; a=1' )).toEqual({ a : '1' });
        expect( parseCookieHeader( 'a=1; a=2; b=3' )).toEqual({ a : '1', b : '3' });
    });
});

describe( 'resolveRequestFileOptions', () =>
{
    it( 'should merge global, module, and route file options', () =>
    {
        // Arrange
        const raw = createAugmented();
        raw.globalFiles = { dest : '/global', maxFiles : 10 };
        raw.files = { fields : { avatar : { maxFileSize : '1mb' } } };

        // Act
        const merged = resolveRequestFileOptions( raw, { maxFiles : 3, dest : '/module' });

        // Assert
        expect( merged?.dest ).toBe( '/module' );
        expect( merged?.maxFiles ).toBe( 3 );
        expect( merged?.fields?.avatar ).toEqual({ maxFileSize : '1mb' });
        expect( resolveRequestFileOptions( createAugmented())).toBeUndefined();
    });
});

describe( 'ServerResponse', () =>
{
    it( 'should alias ResponseBag to ServerResponse', () =>
    {
        expect( new ResponseBag()).toBeInstanceOf( ServerResponse );
    });

    it( 'should set cookies and redirect', () =>
    {
        // Arrange
        const res = new ServerResponse();
        res.cookie( 'sid', 'abc', { httpOnly : true, path : '/', sameSite : 'Lax' });
        res.redirect( 303, '/next' );

        // Act
        const out = res.applyTo( new Response( '' ));

        // Assert
        expect( out.status ).toBe( 303 );
        expect( out.headers.get( 'Location' )).toBe( '/next' );
        expect( out.headers.get( 'Set-Cookie' )).toContain( 'sid=abc' );
        expect( out.headers.get( 'Set-Cookie' )).toContain( 'HttpOnly' );
        expect( out.headers.get( 'Set-Cookie' )).toContain( 'SameSite=Lax' );
    });

    it( 'should stash forward without Location', () =>
    {
        // Arrange
        const res = new ServerResponse();

        // Act
        res.forward({ method : 'GET', path : '/posts/1', query : { x : '1' } });

        // Assert
        expect( res.pendingForward ).toEqual({ method : 'GET', path : '/posts/1', query : { x : '1' } });
        expect( res.toResponse().headers.get( 'Location' )).toBeNull();
    });
});
