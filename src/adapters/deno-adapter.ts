import { ServerAdapter } from './adapter.js';

export class DenoAdapter implements ServerAdapter {
  async listen(port: number, handler: (request: Request) => Promise<Response>): Promise<void> {
    (globalThis as any).Deno.serve({ port }, handler);
  }

  async close(): Promise<void> {}
}
