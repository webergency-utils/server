export class RateLimiter 
{
    private rateLimitStore = new Map<string, { count : number, resetTime : number }>();

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
}
