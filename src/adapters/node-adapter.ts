import { ServerAdapter } from './adapter.js';

export class NodeAdapter implements ServerAdapter {
  private nodeServer?: any;

  async listen(port: number, handler: (request: Request) => Promise<Response>): Promise<void> {
    const { createServer } = await import('http');
    this.nodeServer = createServer(async (req, res) => {
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
    });
    
    return new Promise<void>((resolve) => {
      this.nodeServer.listen(port, () => {
        resolve();
      });
    });
  }

  async close(): Promise<void> {
    if (this.nodeServer) {
      this.nodeServer.close(() => {});
    }
  }
}
