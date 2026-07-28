const EVICT_EVERY_OPS = 64;
const DEFAULT_WINDOW_MS = 60000;

/**
 * Hard cap on tracked keys. Expiry-based eviction alone cannot bound the store when many
 * distinct keys are active at once, so the oldest are dropped once this is reached.
 */
const DEFAULT_MAX_KEYS = 10000;

export interface RateLimitConfig {
    max       : number
    window?   : string | number
    /**
     * `fixed` (default) counts per window boundary and so permits up to 2x `max` across an
     * edge. `sliding` weights the previous window to smooth that out.
     */
    strategy? : 'fixed' | 'sliding'
}

export interface RateLimitResult {
    allowed    : boolean
    /** Seconds until the caller may retry, for the `Retry-After` header. */
    retryAfter : number
}

interface Bucket {
    windowStart : number
    windowMs    : number
    count       : number
    /** Only used by the sliding strategy. */
    prevCount   : number
}

export function parseWindow( window: string | number | undefined ): number
{
    if( typeof window === 'number' ){ return window }

    if( typeof window !== 'string' ){ return DEFAULT_WINDOW_MS }

    const match = window.trim().toLowerCase().match( /^(\d+)(s|m|h)$/ );

    if( !match ){ return DEFAULT_WINDOW_MS }

    const value = parseInt( match[1], 10 );

    if( match[2] === 's' ){ return value * 1000 }

    if( match[2] === 'm' ){ return value * 60000 }

    return value * 3600000;
}

/**
 * Per-process, in-memory limiter. Not shared across workers or instances, so limits apply
 * per process — front it with a shared store if you need cluster-wide accounting.
 */
export class RateLimiter 
{
    private rateLimitStore = new Map<string, Bucket>();
    private ops = 0;

    constructor( private maxKeys: number = DEFAULT_MAX_KEYS ) {}

    /**
     * Consume one unit for `ip` on `path`. Mutates state, so call it once per request;
     * `checkLimit` is the boolean-only form of the same operation.
     */
    public consume( ip: string, path: string, limitConfig: RateLimitConfig ): RateLimitResult 
    {
        const windowMs = parseWindow( limitConfig.window );
        const now = Date.now();
        this.ops++;

        if( this.ops >= EVICT_EVERY_OPS )
        {
            this.ops = 0;
            this.evictExpired( now );
        }

        const storeKey = `${path}:${ip}`;
        const bucket = this.rateLimitStore.get( storeKey ) ?? { windowStart : now, windowMs, count : 0, prevCount : 0 };
        bucket.windowMs = windowMs;

        this.rollWindow( bucket, now, windowMs );

        const sliding = limitConfig.strategy === 'sliding';
        const used = sliding ? this.slidingUsage( bucket, now, windowMs ) : bucket.count;
        const allowed = used + 1 <= limitConfig.max;

        if( allowed ){ bucket.count++ }

        // Re-insert so Map iteration order stays least-recently-used first.
        this.rateLimitStore.delete( storeKey );
        this.rateLimitStore.set( storeKey, bucket );
        this.evictOverflow();

        return {
            allowed,
            retryAfter : allowed ? 0 : Math.max( 1, Math.ceil(( bucket.windowStart + windowMs - now ) / 1000 ))
        };
    }

    /** Boolean form of `consume`; both consume one unit, so use only one per request. */
    public checkLimit( ip: string, path: string, limitConfig: RateLimitConfig ): boolean 
    {
        return this.consume( ip, path, limitConfig ).allowed;
    }

    /** Advance the bucket to the current window, carrying the previous count when adjacent. */
    private rollWindow( bucket: Bucket, now: number, windowMs: number ): void
    {
        const elapsed = now - bucket.windowStart;

        if( elapsed < windowMs ){ return }

        const skipped = Math.floor( elapsed / windowMs );
        bucket.prevCount = skipped === 1 ? bucket.count : 0;
        bucket.count = 0;
        bucket.windowStart = skipped === 1 ? bucket.windowStart + windowMs : now;
    }

    /** Weight the previous window by how much of it still overlaps the current one. */
    private slidingUsage( bucket: Bucket, now: number, windowMs: number ): number
    {
        const overlap = ( windowMs - ( now - bucket.windowStart )) / windowMs;

        return bucket.count + bucket.prevCount * Math.max( 0, overlap );
    }

    /** Drop expired windows so rotating IPs cannot grow the store without bound. */
    private evictExpired( now: number ): void
    {
        for( const [ key, bucket ] of this.rateLimitStore )
        {
            // Dead once the window has elapsed and its carried-over count can no longer count.
            if( now - bucket.windowStart >= 2 * bucket.windowMs )
            {
                this.rateLimitStore.delete( key );
            }
        }
    }

    /** Bound the store even when every tracked key is still active. */
    private evictOverflow(): void
    {
        if( this.rateLimitStore.size <= this.maxKeys ){ return }

        for( const key of this.rateLimitStore.keys())
        {
            this.rateLimitStore.delete( key );

            if( this.rateLimitStore.size <= this.maxKeys ){ return }
        }
    }
}
