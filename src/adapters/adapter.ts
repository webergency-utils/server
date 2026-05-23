export interface ServerAdapter {
  listen(port: number, handler: (request: Request) => Promise<Response>): Promise<void>;
  close(): Promise<void>;
  upgrade?(request: Request, metadata: any, params: any): Response | Promise<Response>;
}
