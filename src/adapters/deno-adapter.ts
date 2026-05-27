import { ServerAdapter, TlsOptions } from './adapter.js';
import { EventEmitter } from 'node:events';

export class DenoAdapter implements ServerAdapter {
  async listen(port: number, handler: (request: Request) => Promise<Response>, tls?: TlsOptions): Promise<void> {
    const options: any = { port };
    if (tls) {
      options.cert = typeof tls.cert === 'string' ? tls.cert : new TextDecoder().decode(tls.cert);
      options.key = typeof tls.key === 'string' ? tls.key : new TextDecoder().decode(tls.key);
    }
    (globalThis as any).Deno.serve(options, handler);
  }

  async upgrade(request: Request, metadata: any, params: any): Promise<Response> {
    const url = new URL(request.url);
    const query = Object.fromEntries(url.searchParams.entries());
    const { socket, response } = (globalThis as any).Deno.upgradeWebSocket(request);
    
    const { RequestProcessor } = await import('../core/request-processor.js');
    const connection = new DenoServerWebSocket(socket, request.headers, params, query, metadata.meta?.wsOptions);
    RequestProcessor.executeWs(metadata, connection, request as any);
    
    return response;
  }

  async close(): Promise<void> {}
}

class DenoServerWebSocket {
  private emitter: any;
  private pingIntervalTimer?: any;
  private pingTimeoutTimer?: any;
  private lastPongReceived = true;

  constructor(
    private socket: any,
    public headers: Headers,
    public params: Record<string, string>,
    public query: Record<string, string>,
    private wsOptions?: { pingInterval?: number; pingTimeout?: number; maxPayload?: number }
  ) {
    this.emitter = new EventEmitter();

    this.socket.addEventListener('message', (e: any) => {
      const maxPayload = this.wsOptions?.maxPayload;
      if (maxPayload !== undefined) {
        const len = typeof e.data === 'string' ? new TextEncoder().encode(e.data).length : (e.data.byteLength !== undefined ? e.data.byteLength : e.data.length || 0);
        if (len > maxPayload) {
          this.close(1009, 'Message Too Big');
          return;
        }
      }
      this.emitter.emit('message', e.data);
    });
    this.socket.addEventListener('close', (e: any) => {
      this.clearTimers();
      this.emitter.emit('close', e.code, e.reason);
    });
    this.socket.addEventListener('error', (e: any) => {
      this.clearTimers();
      this.emitter.emit('error', e.error);
    });

    this.socket.addEventListener('pong', () => {
      this.lastPongReceived = true;
      if (this.pingTimeoutTimer) {
        clearTimeout(this.pingTimeoutTimer);
        this.pingTimeoutTimer = undefined;
      }
    });

    // Heartbeat logic
    if (this.wsOptions?.pingInterval) {
      this.pingIntervalTimer = setInterval(() => {
        if (!this.lastPongReceived) {
          if (!this.wsOptions?.pingTimeout) {
            this.close(1002, 'Ping Timeout');
            return;
          }
        }

        this.lastPongReceived = false;
        try {
          if (typeof this.socket.ping === 'function') {
            this.socket.ping();
          } else {
            this.lastPongReceived = true;
          }
        } catch (e) {
          this.close(1002, 'Ping failed');
          return;
        }

        if (this.wsOptions?.pingTimeout) {
          this.pingTimeoutTimer = setTimeout(() => {
            if (!this.lastPongReceived) {
              this.close(1002, 'Ping Timeout');
            }
          }, this.wsOptions.pingTimeout);
        }
      }, this.wsOptions.pingInterval);
    }
  }

  private clearTimers() {
    if (this.pingIntervalTimer) {
      clearInterval(this.pingIntervalTimer);
      this.pingIntervalTimer = undefined;
    }
    if (this.pingTimeoutTimer) {
      clearTimeout(this.pingTimeoutTimer);
      this.pingTimeoutTimer = undefined;
    }
  }

  send(data: any) {
    this.socket.send(data);
  }

  close(code?: number, reason?: string) {
    this.clearTimers();
    this.socket.close(code, reason);
  }

  on(event: string, cb: Function) {
    this.emitter.on(event, cb as any);
  }

  off(event: string, cb: Function) {
    this.emitter.off(event, cb as any);
  }
}
