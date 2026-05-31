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

export interface ServerAdapter {
    listen( port: number, handler: ( request: Request ) => Promise<Response>, tls?: TlsOptions ): Promise<void>
    close(): Promise<void>
    upgrade?( request: Request, metadata: any, params: any ): Response | Promise<Response>
}
