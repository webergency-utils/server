import { TlsOptions, NodeHttpOptions } from './adapter.js';

/**
 * Bun.serve and Deno.serve accept cert/key but do not expose peer certificates, client
 * certificate requests, or SNI callbacks. When a config needs those, the whole listener is
 * delegated to Node's https adapter, which both runtimes can run.
 */
export class NodeTlsCompat
{
    private adapter? : any;

    public get active(): boolean
    {
        return this.adapter !== undefined;
    }

    /** The underlying `node:https` server, for callers that inspect it. */
    public get server(): any
    {
        return this.adapter?.nodeServer;
    }

    public async listen(
        port: number,
        handler: ( request: Request ) => Promise<Response>,
        tls?: TlsOptions,
        http?: NodeHttpOptions
    ): Promise<void>
    {
        const { NodeAdapter } = await import( './node-adapter.js' );
        this.adapter = new NodeAdapter();
        await this.adapter.listen( port, handler, tls, http );
    }

    public upgrade( request: Request, metadata: any, params: any ): Promise<Response> | Response
    {
        return this.adapter.upgrade( request, metadata, params );
    }

    public async close(): Promise<void>
    {
        await this.adapter?.close();
        this.adapter = undefined;
    }

    public closeAllConnections(): void
    {
        this.adapter?.closeAllConnections?.();
    }
}
