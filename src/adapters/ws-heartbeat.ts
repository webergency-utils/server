export interface WsHeartbeatOptions {
    pingInterval? : number
    pingTimeout?  : number
}

export interface WsHeartbeatTransport {
    /**
     * Send a ping. Return false when the transport cannot ping at all, which counts as a
     * pong so a socket is never dropped for a capability it does not have.
     */
    ping  : () => boolean | void
    close : ( code: number, reason: string ) => void
}

/**
 * Ping/pong liveness shared by the Node, Bun, and Deno sockets.
 *
 * With `pingInterval` alone a socket is dropped when the previous ping went unanswered by
 * the time the next one is due. With `pingTimeout` the answer is instead awaited for that
 * long after each ping.
 */
export class WsHeartbeat
{
    private intervalTimer? : ReturnType<typeof setInterval>;
    private timeoutTimer?  : ReturnType<typeof setTimeout>;
    private pongReceived = true;

    public constructor(
        private readonly transport: WsHeartbeatTransport,
        private readonly options?: WsHeartbeatOptions
    ) {}

    public start(): void
    {
        const interval = this.options?.pingInterval;

        if( !interval || this.intervalTimer ) { return }

        this.intervalTimer = setInterval(() => this.tick(), interval );
    }

    public pong(): void
    {
        this.pongReceived = true;
        this.clearTimeout();
    }

    public stop(): void
    {
        if( this.intervalTimer )
        {
            clearInterval( this.intervalTimer );
            this.intervalTimer = undefined;
        }
        this.clearTimeout();
    }

    private tick(): void
    {
        const { pingTimeout } = this.options ?? {};

        if( !this.pongReceived && !pingTimeout )
        {
            this.transport.close( 1002, 'Ping Timeout' );

            return;
        }

        this.pongReceived = false;

        try
        {
            if( this.transport.ping() === false ) { this.pongReceived = true }
        }
        catch
        {
            this.transport.close( 1002, 'Ping failed' );

            return;
        }

        if( pingTimeout )
        {
            this.timeoutTimer = setTimeout(() =>
            {
                if( !this.pongReceived )
                {
                    this.transport.close( 1002, 'Ping Timeout' );
                }
            }, pingTimeout );
        }
    }

    private clearTimeout(): void
    {
        if( this.timeoutTimer )
        {
            clearTimeout( this.timeoutTimer );
            this.timeoutTimer = undefined;
        }
    }
}
