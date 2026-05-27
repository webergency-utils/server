import { ServerAdapter, TlsOptions } from './adapter.js';
import { SimpleMultibuffer, WebsocketFrame } from '../helpers/ws-frame.js';
import { RequestProcessor } from '../core/request-processor.js';
import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';

export class NodeAdapter implements ServerAdapter {
  private nodeServer?: any;

  async listen(port: number, handler: (request: Request) => Promise<Response>, tls?: TlsOptions): Promise<void> {
    const connectionHandler = async (req: any, res: any) => {
      const protocol = (req.socket as any).encrypted ? 'https' : 'http';
      const url = `${protocol}://${req.headers.host}${req.url}`;
      const fetchReq = new Request(url, {
        method: req.method,
        headers: req.headers as any,
        body: ['GET', 'HEAD'].includes(req.method || '') ? undefined : (req as any),
        // @ts-ignore
        duplex: 'half'
      });
      const response = await handler(fetchReq);
      res.statusCode = response.status;
      response.headers.forEach((value, key) => res.setHeader(key, value));
      if (response.body) {
        const { Readable } = await import('stream');
        // @ts-ignore
        Readable.fromWeb(response.body).pipe(res);
      } else res.end();
    };

    if (tls) {
      const { createServer } = await import('https');
      this.nodeServer = createServer(tls as any, connectionHandler);
    } else {
      const { createServer } = await import('http');
      this.nodeServer = createServer(connectionHandler);
    }

    const { MetadataStore } = await import('../core/metadata.js');
    const hasWs = MetadataStore.getEndpoints().some((ep: any) => ep.httpMethod === 'WS');

    if (hasWs && this.nodeServer && typeof this.nodeServer.on === 'function') {
      this.nodeServer.on('upgrade', async (req: any, socket: any, head: any) => {
        const protocol = (req.socket as any).encrypted ? 'https' : 'http';
        const url = `${protocol}://${req.headers.host}${req.url}`;
        const fetchReq = new Request(url, {
          method: 'GET',
          headers: req.headers as any
        });
        (fetchReq as any).nodeSocket = socket;
        (fetchReq as any).nodeHead = head;

        await handler(fetchReq);
      });
    }
    
    return new Promise<void>((resolve) => {
      this.nodeServer.listen(port, () => {
        resolve();
      });
    });
  }

  async upgrade(request: Request, metadata: any, params: any): Promise<Response> {
    const socket = (request as any).nodeSocket;
    const head = (request as any).nodeHead;
    if (!socket) {
      return new Response('No Node socket available', { status: 400 });
    }

    const wsKey = request.headers.get('sec-websocket-key');
    if (!wsKey) {
      return new Response('Missing sec-websocket-key', { status: 400 });
    }

    const magicString = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
    const acceptKey = crypto
      .createHash('sha1')
      .update(wsKey + magicString)
      .digest('base64');

    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${acceptKey}\r\n\r\n`
    );

    const url = new URL(request.url);
    const query = Object.fromEntries(url.searchParams.entries());

    const connection = new NodeServerWebSocket(socket, head, request.headers, params, query, metadata.meta?.wsOptions);
    RequestProcessor.executeWs(metadata, connection, request as any);

    return new Response(null, { status: 200 });
  }

  async close(): Promise<void> {
    if (this.nodeServer) {
      this.nodeServer.close(() => {});
    }
  }
}

class NodeServerWebSocket {
  private emitter = new EventEmitter();
  private rx_buffer = new SimpleMultibuffer();
  private tx_buffer = new SimpleMultibuffer();
  private pingIntervalTimer?: any;
  private pingTimeoutTimer?: any;
  private lastPongReceived = true;

  constructor(
    private socket: any,
    head: Buffer,
    public headers: Headers,
    public params: Record<string, string>,
    public query: Record<string, string>,
    private wsOptions?: { pingInterval?: number; pingTimeout?: number; maxPayload?: number }
  ) {
    this.socket.setTimeout(0);
    this.socket.setNoDelay();

    if (head && head.length > 0) {
      this.rx_buffer.append(head);
    }

    const emit = (event: string, ...args: any[]) => {
      this.emitter.emit(event, ...args);
    };

    this.socket.on('data', (data: Buffer) => {
      this.rx_buffer.append(data);
      WebsocketFrame.read(this.rx_buffer, emit, { maxPayload: this.wsOptions?.maxPayload });
    });

    this.socket.on('end', () => this.close(1000));
    this.socket.on('close', () => this.close(1000));
    this.socket.on('error', (err: any) => {
      this.emitter.emit('error', err);
    });

    this.on('ping', (payload: Buffer) => {
      this.send(payload, { opcode: 0x0a });
    });
    this.on('pong', () => {
      this.lastPongReceived = true;
      if (this.pingTimeoutTimer) {
        clearTimeout(this.pingTimeoutTimer);
        this.pingTimeoutTimer = undefined;
      }
    });
    this.on('limit_exceeded', () => {
      this.close(1009, 'Message Too Big');
    });
    this.on('closing', (code: number, reason: string) => {
      this.close(code, reason);
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
          this.send(Buffer.alloc(0), { opcode: 0x09 });
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

  send(data: any, options: { opcode?: number } = {}) {
    WebsocketFrame.write(this.tx_buffer, data, options);
    while (this.tx_buffer.length > 0) {
      this.socket.write(this.tx_buffer.spliceConcat(0, this.tx_buffer.length));
    }
  }

  close(code?: number, reason?: string) {
    if (this.pingIntervalTimer) {
      clearInterval(this.pingIntervalTimer);
      this.pingIntervalTimer = undefined;
    }
    if (this.pingTimeoutTimer) {
      clearTimeout(this.pingTimeoutTimer);
      this.pingTimeoutTimer = undefined;
    }

    let payload = Buffer.alloc(code !== undefined ? 2 : 0);
    if (code !== undefined) {
      payload.writeUInt16BE(code, 0);
      if (reason) {
        payload = Buffer.concat([payload, Buffer.from(reason, 'utf8')]);
      }
    }
    
    try {
      WebsocketFrame.write(this.tx_buffer, payload, { opcode: 0x08 });
      while (this.tx_buffer.length > 0) {
        this.socket.write(this.tx_buffer.spliceConcat(0, this.tx_buffer.length));
      }
    } catch (e) {}

    this.socket.end();
    this.socket.destroy();
    this.socket.removeAllListeners();
    this.emitter.emit('close');
  }

  on(event: string, cb: Function) {
    this.emitter.on(event, cb as any);
  }

  off(event: string, cb: Function) {
    this.emitter.off(event, cb as any);
  }
}
