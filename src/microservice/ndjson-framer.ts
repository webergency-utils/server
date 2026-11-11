import { StringDecoder } from 'node:string_decoder';

/** Max incomplete newline-delimited JSON line held in memory per socket. */
export const TCP_MAX_LINE_BYTES = 1024 * 1024;

export interface NdjsonLineFramerResult {
    lines     : string[]
    oversized : boolean
}

/**
 * Streaming newline-delimited JSON line framer backed by `StringDecoder('utf8')`.
 *
 * Preserves multi-byte UTF-8 sequences split across TCP chunks and enforces a
 * maximum line byte cap before allocating unbounded strings.
 */
export class NdjsonLineFramer
{
    private decoder = new StringDecoder( 'utf8' );
    private buffer = '';
    private readonly maxLineBytes : number;

    constructor( maxLineBytes: number = TCP_MAX_LINE_BYTES )
    {
        this.maxLineBytes = maxLineBytes;
    }

    push( chunk: Buffer | string ): NdjsonLineFramerResult
    {
        // Reject single chunks whose first line (or entire un-newlined body) exceeds maxLineBytes
        // BEFORE decoding or concatenating into V8 string heap.
        if( typeof chunk === 'string' )
        {
            const firstNl = chunk.indexOf( '\n' );

            if( firstNl === -1 )
            {
                if(( this.buffer.length + chunk.length ) > this.maxLineBytes
                    && ( Buffer.byteLength( this.buffer, 'utf8' ) + Buffer.byteLength( chunk, 'utf8' )) > this.maxLineBytes )
                {
                    this.reset();

                    return { lines : [], oversized : true };
                }
            }
            else if( firstNl > this.maxLineBytes
                && Buffer.byteLength( chunk.substring( 0, firstNl ), 'utf8' ) > this.maxLineBytes )
            {
                this.reset();

                return { lines : [], oversized : true };
            }

            this.buffer += chunk;
        }
        else
        {
            const firstNl = chunk.indexOf( 0x0a );

            if( firstNl === -1 )
            {
                if(( this.buffer.length + chunk.length ) > this.maxLineBytes
                    && ( Buffer.byteLength( this.buffer, 'utf8' ) + chunk.length ) > this.maxLineBytes )
                {
                    this.reset();

                    return { lines : [], oversized : true };
                }
            }
            else if( firstNl > this.maxLineBytes )
            {
                this.reset();

                return { lines : [], oversized : true };
            }

            this.buffer += this.decoder.write( chunk );
        }

        const lines: string[] = [];
        let index: number;

        while(( index = this.buffer.indexOf( '\n' )) !== -1 )
        {
            const rawLine = this.buffer.substring( 0, index );

            if( rawLine.length * 3 > this.maxLineBytes && Buffer.byteLength( rawLine, 'utf8' ) > this.maxLineBytes )
            {
                this.reset();

                return { lines : [], oversized : true };
            }

            this.buffer = this.buffer.substring( index + 1 );
            const line = rawLine.trim();

            if( line )
            {
                lines.push( line );
            }
        }

        if( this.buffer.length * 3 > this.maxLineBytes && Buffer.byteLength( this.buffer, 'utf8' ) > this.maxLineBytes )
        {
            this.reset();

            return { lines : [], oversized : true };
        }

        return { lines, oversized : false };
    }

    reset(): void
    {
        this.decoder = new StringDecoder( 'utf8' );
        this.buffer = '';
    }
}
