export interface ServerAdapter {
  listen(port: number, handler: (request: Request) => Promise<Response>): Promise<void>;
  close(): Promise<void>;
}
