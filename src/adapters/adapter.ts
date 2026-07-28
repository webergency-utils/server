export interface TlsOptions {
    key?                : string | Buffer | Uint8Array
    cert?               : string | Buffer | Uint8Array
    ca?                 : string | Buffer | Uint8Array | Array<string | Buffer | Uint8Array>
    ciphers?            : string
    minVersion?         : 'TLSv1' | 'TLSv1.1' | 'TLSv1.2' | 'TLSv1.3'
    maxVersion?         : 'TLSv1' | 'TLSv1.1' | 'TLSv1.2' | 'TLSv1.3'
    requestCert?        : boolean
    rejectUnauthorized? : boolean
    sniCallback?: ( servername: string ) => Promise<{
        key  : string | Buffer | Uint8Array
        cert : string | Buffer | Uint8Array
        ca?  : string | Buffer | Uint8Array | Array<string | Buffer | Uint8Array>
    } | null> | {
        key  : string | Buffer | Uint8Array
        cert : string | Buffer | Uint8Array
        ca?  : string | Buffer | Uint8Array | Array<string | Buffer | Uint8Array>
    } | null
}

/**
 * Node `http.Server` / `https.Server` timeouts. Bun and Deno ignore these — their native
 * listeners do not expose the same knobs. Defaults match Node's documented values and are
 * applied explicitly so a directly-reachable deployment is not left with unset timers.
 */
export interface NodeHttpOptions {
    /** Time to receive the complete HTTP headers. Default: 60_000. */
    headersTimeout?   : number
    /** Time for the entire request to complete. Default: 300_000. */
    requestTimeout?   : number
    /** Idle keep-alive socket timeout. Default: 5_000. */
    keepAliveTimeout? : number
}

export interface ServerAdapter {
    listen(
        port: number,
        handler: ( request: Request ) => Promise<Response>,
        tls?: TlsOptions,
        http?: NodeHttpOptions
    ): Promise<void>
    close(): Promise<void>
    /** Drop every remaining socket after the graceful drain window. Node only. */
    closeAllConnections?(): void
    upgrade?( request: Request, metadata: any, params: any ): Response | Promise<Response>
}
