import crypto from 'node:crypto';

export function maskPayload( mask: Uint8Array | Buffer, payload: Uint8Array | Buffer ): void 
{
    for( let i = 0; i < payload.length; ++i ) 
    {
        payload[i] ^= mask[i % 4];
    }
}

export class SimpleMultibuffer 
{
    private buffers : Buffer[] = [];
    public length = 0;

    append( buffer: Buffer ): void 
    {
        this.buffers.push( buffer );
        this.length += buffer.length;
    }

    get( index: number ): number 
    {
        let offset = 0;

        for( const buf of this.buffers ) 
        {
            if( index < offset + buf.length ) 
            {
                return buf[index - offset];
            }
            offset += buf.length;
        }
        throw new Error( 'Index out of bounds' );
    }

    spliceConcat( start: number, count: number ): Buffer 
    {
        if( start !== 0 ) 
        {
            throw new Error( 'Only spliceConcat starting at 0 is supported' );
        }

        if( count > this.length ) 
        {
            throw new Error( 'Not enough bytes in buffer' );
        }

        const result = Buffer.alloc( count );
        let bytesWritten = 0;

        while( bytesWritten < count ) 
        {
            const first = this.buffers[0];
            const bytesToCopy = Math.min( count - bytesWritten, first.length );
            first.copy( result, bytesWritten, 0, bytesToCopy );
            bytesWritten += bytesToCopy;

            if( bytesToCopy === first.length ) 
            {
                this.buffers.shift();
            }
            else 
            {
                this.buffers[0] = first.subarray( bytesToCopy );
            }
        }

        this.length -= count;

        return result;
    }

    clear(): void 
    {
        this.buffers = [];
        this.length = 0;
    }
}

export class WebsocketFrame 
{
    static write( tx_buffer: SimpleMultibuffer, payload: string | Buffer, options: { opcode? : number, mask? : boolean } = {}): void 
    {
        const flag = 0x80 | ( options.opcode !== undefined ? options.opcode : ( typeof payload === 'string' ? 0x01 : 0x02 ));
        const bufPayload = typeof payload === 'string' ? Buffer.from( payload, 'utf8' ) : payload;
        const length = bufPayload.length;
        const mask = options.mask ? crypto.randomBytes( 4 ) : null;

        if( length < 126 ) 
        {
            tx_buffer.append( Buffer.from([flag, ( mask ? 0x80 : 0 ) | length]));
        }
        else if( length < 65536 ) 
        {
            tx_buffer.append( Buffer.from([flag, ( mask ? 0x80 : 0 ) | 126, ( length >> 8 ) & 255, length & 255]));
        }
        else 
        {
            tx_buffer.append( Buffer.from([
                flag, ( mask ? 0x80 : 0 ) | 127,
                0, 0, 0, 0,
                ( length >> 24 ) & 255, ( length >> 16 ) & 255, ( length >> 8 ) & 255, length & 255
            ]));
        }

        if( mask ) 
        {
            tx_buffer.append( mask );
            maskPayload( mask, bufPayload );
        }

        tx_buffer.append( bufPayload );
    }

    static read( rx_buffer: SimpleMultibuffer, emit: ( event: string, ...args: any[]) => void, options?: { maxPayload? : number }): void 
    {
        while( rx_buffer.length > 2 ) 
        {
            const opcode = rx_buffer.get( 0 ) & 0x0f;
            const head = rx_buffer.get( 1 );
            let header_length = 0;
            let payload_length = 0;

            if(( head & 0x7f ) < 126 ) 
            {
                payload_length = head & 0x7f;
                header_length = 2 + ( head & 0x80 ? 4 : 0 );
            }
            else if(( head & 0x7f ) === 126 && rx_buffer.length > 4 ) 
            {
                payload_length = ( rx_buffer.get( 2 ) << 8 ) + rx_buffer.get( 3 );
                header_length = 4 + ( head & 0x80 ? 4 : 0 );
            }
            else if(( head & 0x7f ) === 127 && rx_buffer.length > 10 ) 
            {
                // Read 64-bit length (assuming safe integer range)
                payload_length = ( rx_buffer.get( 6 ) << 24 ) + ( rx_buffer.get( 7 ) << 16 ) + ( rx_buffer.get( 8 ) << 8 ) + rx_buffer.get( 9 );
                header_length = 10 + ( head & 0x80 ? 4 : 0 );
            }

            if( header_length ) 
            {
                if( options?.maxPayload !== undefined && payload_length > options.maxPayload ) 
                {
                    emit( 'limit_exceeded' );

                    return;
                }
            }

            if( header_length && header_length + payload_length <= rx_buffer.length ) 
            {
                const header = rx_buffer.spliceConcat( 0, header_length );
                const payload = rx_buffer.spliceConcat( 0, payload_length );

                if( header[1] & 0x80 ) 
                {
                    maskPayload( header.slice( header_length - 4 ), payload );
                }

                switch ( opcode ) 
                {
                    case 0x01:
                        emit( 'message', payload.toString( 'utf8' ));
                        break;
                    case 0x02:
                        emit( 'message', payload );
                        break;
                    case 0x08:
                        emit(
                            'closing',
                            payload.length >= 2 ? payload.readUInt16BE( 0 ) : undefined,
                            payload.length > 2 ? payload.subarray( 2 ).toString( 'utf8' ) : undefined
                        );
                        break;
                    case 0x09:
                        emit( 'ping', payload );
                        break;
                    case 0x0a:
                        emit( 'pong', payload );
                        break;
                }
            }
            else 
            {
                break;
            }
        }
    }
}
