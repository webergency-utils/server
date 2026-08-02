/**
 * Zero-copy-ish multi-chunk buffer for streaming parsers.
 * Ported from the `@liqd-js/multibuffer` approach: keep chunks as a list,
 * search / splice across boundaries without concatenating until needed.
 */

type Range =
{
    buffers : Buffer[]
    start   : number
    end     : number
    index   : number
    length  : number
};

export class MultiBuffer
{
    private buffers : Buffer[] = [];
    private totalLength = 0;

    constructor( ...buffers: Buffer[] )
    {
        for( const buffer of buffers )
        {
            if( buffer.length )
            {
                this.buffers.push( buffer );
                this.totalLength += buffer.length;
            }
        }
    }

    get length(): number
    {
        return this.totalLength;
    }

    append( ...buffers: Buffer[] )
    {
        for( const buffer of buffers )
        {
            if( buffer.length )
            {
                this.buffers.push( buffer );
                this.totalLength += buffer.length;
            }
        }
    }

    get chunkCount(): number
    {
        return this.buffers.length;
    }

    /**
     * Collapse many small chunks into one buffer. Call when `chunkCount` is high —
     * `indexOf` across dozens of tiny slices is slower than one concat.
     */
    compact()
    {
        if( this.buffers.length <= 1 ){ return }

        const joined = Buffer.concat( this.buffers, this.totalLength );
        this.buffers = [ joined ];
    }

    clear()
    {
        this.buffers = [];
        this.totalLength = 0;
    }

    slice( start?: number, end?: number ): Buffer[]
    {
        if( start === undefined )
        {
            start = 0;
        }

        if( start < 0 )
        {
            start = this.totalLength + start;
        }

        if( end === undefined )
        {
            end = this.totalLength;
        }

        if( end < 0 )
        {
            end = this.totalLength + end;
        }

        end = Math.min( this.totalLength, end );

        return start < end ? this.getRange( start, end ).buffers : [];
    }

    splice( start = 0, deleteCount = 0, ...buffers: Buffer[] ): Buffer[]
    {
        if( start < 0 )
        {
            start = this.totalLength + start;
        }

        const end = deleteCount < 0 ? this.totalLength + deleteCount : start + deleteCount;
        const range = this.getRange( start, end );
        let spliceStart = 0;

        if( range.buffers.length && start !== end )
        {
            this.totalLength -= range.length;

            if( this.totalLength === 0 )
            {
                this.buffers = [];
            }
            else
            {
                let spliceCount = Math.max( 0, range.buffers.length - 2 );

                if( range.buffers.length === 1 )
                {
                    if( range.start === 0 )
                    {
                        if( range.end === this.buffers[range.index].length )
                        {
                            this.buffers.splice( range.index, 1 );
                        }
                        else
                        {
                            this.buffers[range.index] = this.buffers[range.index].subarray( range.end );
                        }
                    }
                    else if( range.end === this.buffers[range.index].length )
                    {
                        this.buffers[range.index] = this.buffers[range.index].subarray( 0, range.start );
                    }
                    else
                    {
                        const tail = this.buffers[range.index].subarray( range.end );
                        this.buffers[range.index] = this.buffers[range.index].subarray( 0, range.start );
                        this.buffers.splice( range.index + 1, 0, tail );
                    }
                }
                else
                {
                    if( range.start === 0 )
                    {
                        spliceStart = range.index;
                        ++spliceCount;
                    }
                    else
                    {
                        spliceStart = range.index + 1;
                        this.buffers[range.index] = this.buffers[range.index].subarray( 0, range.start );
                    }

                    if( range.end === this.buffers[range.index + range.buffers.length - 1].length )
                    {
                        ++spliceCount;
                    }
                    else
                    {
                        this.buffers[range.index + range.buffers.length - 1] =
                            this.buffers[range.index + range.buffers.length - 1].subarray( range.end );
                    }

                    if( spliceCount )
                    {
                        this.buffers.splice( spliceStart, spliceCount );
                    }
                }
            }
        }

        if( buffers.length )
        {
            this.totalLength += buffers.reduce(( s, b ) => s + b.length, 0 );

            if( range.buffers.length === 0 )
            {
                range.index = this.buffers.length;
            }
            else if( range.start !== 0 )
            {
                if( range.start < this.buffers[range.index].length )
                {
                    const tail = this.buffers[range.index].subarray( range.start );
                    this.buffers[range.index] = this.buffers[range.index].subarray( 0, range.start );
                    buffers.push( tail );
                }

                ++range.index;
            }

            this.buffers.splice( range.index, 0, ...buffers );
        }

        return start !== end ? range.buffers : [];
    }

    spliceConcat( start: number, deleteCount: number, ...buffers: Buffer[] ): Buffer
    {
        const removed = this.splice( start, deleteCount, ...buffers );

        if( !removed.length ){ return Buffer.alloc( 0 ) }

        return removed.length === 1 ? removed[0] : Buffer.concat( removed );
    }

    get( index: number ): number | undefined
    {
        if( index < 0 )
        {
            index = this.totalLength + index;
        }

        const range = this.getRange( index );

        return range.buffers.length ? range.buffers[0][0] : undefined;
    }

    equals( buffer: Buffer, offset = 0, length = Infinity ): boolean
    {
        length = Math.min( length, buffer.length );

        if( offset + length <= this.totalLength )
        {
            const range = this.getRange( offset );

            return this.bytesEqual( buffer, range.index, range.start, length );
        }

        return false;
    }

    indexOf( buffer: Buffer | string, offset = 0, encoding: BufferEncoding = 'utf8' ): number
    {
        if( typeof buffer === 'string' )
        {
            buffer = Buffer.from( buffer, encoding );
        }

        if( offset < 0 )
        {
            offset = this.totalLength - offset;
        }

        if( buffer.length === 0 )
        {
            return offset < this.totalLength ? offset : -1;
        }

        let b = 0;
        let buff = this.buffers[0];
        let i = 0;
        let index = 0;
        const until = this.totalLength - buffer.length;

        while( index <= until && index < offset )
        {
            if( offset - index <= buff.length )
            {
                i = offset - index;
                index = offset;
            }
            else
            {
                index += buff.length;
                buff = this.buffers[++b];
            }
        }

        while( index <= until )
        {
            if( i + buffer.length <= buff.length )
            {
                const m = buff.indexOf( buffer, i );

                if( m !== -1 )
                {
                    return index + m - i;
                }
                else
                {
                    const step = buff.length - buffer.length;
                    index += step - i;
                    i = step;
                }
            }

            while( index <= until && i < buff.length )
            {
                if( this.bytesEqual( buffer, b, i, buffer.length ))
                {
                    return index;
                }

                ++i;
                ++index;
            }

            buff = this.buffers[++b];
            i = 0;
        }

        return -1;
    }

    /**
     * Like `indexOf`, but also returns a match when only a prefix of `buffer`
     * sits at the end of this MultiBuffer (needed for boundary search across chunks).
     */
    partialIndexOf( buffer: Buffer | string, offset = 0, encoding: BufferEncoding = 'utf8' ): number
    {
        if( typeof buffer === 'string' )
        {
            buffer = Buffer.from( buffer, encoding );
        }

        const indexOf = this.indexOf( buffer, offset, encoding );

        if( indexOf === -1 )
        {
            for( let length = Math.min( buffer.length - 1, this.totalLength ); length > 0; --length )
            {
                if( this.equals( buffer, this.totalLength - length, length ))
                {
                    return this.totalLength - length;
                }
            }
        }

        return indexOf;
    }

    private getRange( start: number, end = 0 ): Range
    {
        let head = start;
        const buffers = this.buffers;
        let i = 0;
        let length = end - start;
        const range: Range =
        {
            buffers : [],
            start   : 0,
            end     : 0,
            index   : 0,
            length  : 0
        };

        if( !buffers.length ){ return range }

        if( start < buffers[0].length )
        {
            range.start = start;
            range.index = 0;
            range.buffers.push( buffers[0]);
        }
        else
        {
            start -= buffers[0].length;

            while( ++i < buffers.length )
            {
                if( start < buffers[i].length )
                {
                    range.start = start;
                    range.index = i;
                    range.buffers.push( buffers[i]);

                    break;
                }
                else
                {
                    start -= buffers[i].length;
                }
            }
        }

        if( range.buffers.length && end !== 0 )
        {
            if( end >= this.totalLength )
            {
                range.buffers = this.buffers.slice( range.index );
                range.length = this.totalLength - head;
                range.end = range.buffers[range.buffers.length - 1].length;

                if( start > 0 )
                {
                    range.buffers[0] = range.buffers[0].subarray( start );
                }

                return range;
            }
            else if( range.start + length <= buffers[range.index].length )
            {
                range.end = range.start + length;
                range.length = length;
            }
            else
            {
                length -= buffers[range.index].length - range.start;
                range.length += buffers[range.index].length - range.start;

                while( ++i < buffers.length )
                {
                    range.buffers.push( buffers[i]);

                    if( length <= buffers[i].length )
                    {
                        range.end = length;
                        range.length += length;

                        break;
                    }
                    else
                    {
                        length -= buffers[i].length;
                        range.length += buffers[i].length;
                    }
                }
            }
        }

        if( range.buffers.length === 1 && ( range.start !== 0 || range.end !== range.buffers[0].length ))
        {
            range.buffers[0] = range.buffers[0].subarray( range.start, range.end );
        }
        else if( range.buffers.length > 1 )
        {
            if( range.start !== 0 )
            {
                range.buffers[0] = range.buffers[0].subarray( range.start );
            }

            if( range.end !== range.buffers[range.buffers.length - 1].length )
            {
                range.buffers[range.buffers.length - 1] =
                    range.buffers[range.buffers.length - 1].subarray( 0, range.end );
            }
        }

        return range;
    }

    private bytesEqual( buffer: Buffer, block: number, index: number, length: number ): boolean
    {
        let buff = this.buffers[block];
        let matched = 0;

        if( buff[index] === buffer[matched])
        {
            do
            {
                if( ++matched === length )
                {
                    return true;
                }
                else if( ++index >= buff.length )
                {
                    buff = this.buffers[++block];
                    index = 0;
                }
            }
            while( buff[index] === buffer[matched]);
        }

        return false;
    }
}
