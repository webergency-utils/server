export interface TlsOptions {
  key: string | Buffer | Uint8Array;
  cert: string | Buffer | Uint8Array;
  ca?: string | Buffer | Uint8Array | Array<string | Buffer | Uint8Array>;
}

export interface ServerAdapter {
  listen(port: number, handler: (request: Request) => Promise<Response>, tls?: TlsOptions): Promise<void>;
  close(): Promise<void>;
  upgrade?(request: Request, metadata: any, params: any): Response | Promise<Response>;
}
