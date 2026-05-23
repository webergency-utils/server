import { ServerAdapter } from './adapter.js';

export class BunAdapter implements ServerAdapter {
  private server?: any;

  async listen(port: number, handler: (request: Request) => Promise<Response>): Promise<void> {
    this.server = (globalThis as any).Bun.serve({ port, fetch: handler });
  }

  async close(): Promise<void> {
    if (this.server && typeof this.server.stop === 'function') {
      this.server.stop();
    }
  }
}
