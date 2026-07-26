const EVICT_EVERY_OPS = 64;
const EVICT_SIZE_THRESHOLD = 1024;

export class RateLimiter 
{
    private rateLimitStore = new Map<string, { count : number, resetTime : number }>();
    private ops = 0;

    public checkLimit( ip: string, path: string, limitConfig: { max : number, window? : string | number }): boolean 
    {
        const max = limitConfig.max;
        const windowOption = limitConfig.window || '1m';
        let windowMs = 60000;

        if( typeof windowOption === 'number' ) 
        {
            windowMs = windowOption;
        }
        else if( typeof windowOption === 'string' ) 
        {
            const match = windowOption.trim().toLowerCase().match( /^(\d+)(s|m|h)$/ );

            if( match ) 
            {
                const val = parseInt( match[1], 10 );
                const unit = match[2];

                if( unit === 's' ) { windowMs = val * 1000 }
                else if( unit === 'm' ) { windowMs = val * 60000 }
                else if( unit === 'h' ) { windowMs = val * 3600000 }
            }
        }
    
        const now = Date.now();
        this.ops++;

        if( this.ops >= EVICT_EVERY_OPS || this.rateLimitStore.size >= EVICT_SIZE_THRESHOLD )
        {
            this.ops = 0;
            this.evictExpired( now );
        }

        const storeKey = `${path}:${ip}`;
        let clientRecord = this.rateLimitStore.get( storeKey );

        if( !clientRecord || now > clientRecord.resetTime ) 
        {
            clientRecord = { count : 0, resetTime : now + windowMs };
        }
        clientRecord.count++;
        this.rateLimitStore.set( storeKey, clientRecord );

        return clientRecord.count <= max;
    }

    /** Drop expired windows so rotating IPs cannot grow the store without bound. */
    private evictExpired( now: number ): void
    {
        for( const [ key, record ] of this.rateLimitStore )
        {
            if( now > record.resetTime )
            {
                this.rateLimitStore.delete( key );
            }
        }
    }
}
