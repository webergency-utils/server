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

function readUint32BE( buf: SimpleMultibuffer, offset: number ): number
{
    // Multiply to avoid JS signed 32-bit overflow from `<< 24`.
    return (
        ( buf.get( offset ) & 0xff ) * 0x1000000
        + ( buf.get( offset + 1 ) & 0xff ) * 0x10000
        + ( buf.get( offset + 2 ) & 0xff ) * 0x100
        + ( buf.get( offset + 3 ) & 0xff )
    );
}

const OPCODE_CONTINUATION = 0x0;
const OPCODE_TEXT = 0x1;
const OPCODE_BINARY = 0x2;
const OPCODE_CLOSE = 0x8;
const OPCODE_PING = 0x9;
const OPCODE_PONG = 0xa;

const KNOWN_OPCODES = new Set([ OPCODE_CONTINUATION, OPCODE_TEXT, OPCODE_BINARY, OPCODE_CLOSE, OPCODE_PING, OPCODE_PONG ]);

/** RFC 6455 §5.5: control frame payloads may not exceed 125 bytes. */
const MAX_CONTROL_PAYLOAD = 125;

const UTF8_DECODER = new TextDecoder( 'utf-8', { fatal : true });

/**
 * Fragmentation state for one connection. A fragmented message spans frames that can arrive
 * across separate reads, so the caller owns this and passes the same object each time.
 */
export interface FrameReadState {
    fragments?    : Buffer[]
    fragmentOp?   : number
    fragmentSize? : number
}

type Emit = ( event: string, ...args: any[]) => void;

/** RFC 6455 §7.4.1 plus the IANA-registered range; the rest are reserved or local-only. */
function isValidCloseCode( code: number ): boolean
{
    if( code >= 3000 && code <= 4999 ){ return true }

    if( code >= 1000 && code <= 1003 ){ return true }

    return code >= 1007 && code <= 1014;
}

function decodeUtf8( payload: Buffer ): string | null
{
    try
    {
        return UTF8_DECODER.decode( payload );
    }
    catch
    {
        return null;
    }
}

function protocolError( emit: Emit, reason: string ): void
{
    emit( 'protocol_error', 1002, reason );
}

/** Emit a complete data message. Returns false when the frame was rejected. */
function emitMessage( opcode: number, payload: Buffer, emit: Emit ): boolean
{
    if( opcode === OPCODE_BINARY )
    {
        emit( 'message', payload );

        return true;
    }

    const text = decodeUtf8( payload );

    if( text === null )
    {
        emit( 'protocol_error', 1007, 'Invalid UTF-8 in text frame' );

        return false;
    }

    emit( 'message', text );

    return true;
}

/** Returns false when the frame was rejected. */
function emitControl( opcode: number, payload: Buffer, emit: Emit ): boolean
{
    if( opcode === OPCODE_PING )
    {
        emit( 'ping', payload );

        return true;
    }

    if( opcode === OPCODE_PONG )
    {
        emit( 'pong', payload );

        return true;
    }

    if( payload.length === 0 )
    {
        emit( 'closing', undefined, undefined );

        return true;
    }

    // A close body carries a 2-byte code, so a single byte cannot be valid.
    if( payload.length === 1 )
    {
        protocolError( emit, 'Close frame payload must be empty or at least 2 bytes' );

        return false;
    }

    const code = payload.readUInt16BE( 0 );

    if( !isValidCloseCode( code ))
    {
        protocolError( emit, `Invalid close code ${code}` );

        return false;
    }

    const reason = payload.length > 2 ? decodeUtf8( payload.subarray( 2 )) : undefined;

    if( reason === null )
    {
        emit( 'protocol_error', 1007, 'Invalid UTF-8 in close reason' );

        return false;
    }

    emit( 'closing', code, reason );

    return true;
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

    /**
     * Parse inbound client frames. Every rejection stops parsing and reports
     * `protocol_error` with the close code to send, since the connection is unusable
     * once the stream is misframed.
     */
    static read(
        rx_buffer: SimpleMultibuffer,
        emit: Emit,
        options?: { maxPayload? : number },
        state: FrameReadState = {}
    ): void 
    {
        while( rx_buffer.length >= 2 ) 
        {
            const b0 = rx_buffer.get( 0 );
            const b1 = rx_buffer.get( 1 );
            const fin = ( b0 & 0x80 ) !== 0;
            const opcode = b0 & 0x0f;
            const lengthByte = b1 & 0x7f;
            const isControl = ( opcode & 0x08 ) !== 0;

            if(( b0 & 0x70 ) !== 0 )
            {
                return protocolError( emit, 'RSV bits must be zero' );
            }

            // RFC 6455 §5.1: every client-to-server frame must be masked.
            if(( b1 & 0x80 ) === 0 )
            {
                return protocolError( emit, 'Client frames must be masked' );
            }

            if( !KNOWN_OPCODES.has( opcode ))
            {
                return protocolError( emit, `Unknown opcode 0x${opcode.toString( 16 )}` );
            }

            if( isControl )
            {
                if( !fin )
                {
                    return protocolError( emit, 'Control frames must not be fragmented' );
                }

                if( lengthByte > MAX_CONTROL_PAYLOAD )
                {
                    return protocolError( emit, 'Control frame payload exceeds 125 bytes' );
                }
            }

            let header_length = 0;
            let payload_length = 0;

            if( lengthByte < 126 ) 
            {
                payload_length = lengthByte;
                header_length = 6;
            }
            else if( lengthByte === 126 && rx_buffer.length >= 4 ) 
            {
                payload_length = ( rx_buffer.get( 2 ) << 8 ) + rx_buffer.get( 3 );
                header_length = 8;
            }
            else if( lengthByte === 127 && rx_buffer.length >= 10 ) 
            {
                // High 32 bits must be zero — lengths above 4 GiB are unsupported.
                if( rx_buffer.get( 2 ) !== 0 || rx_buffer.get( 3 ) !== 0 || rx_buffer.get( 4 ) !== 0 || rx_buffer.get( 5 ) !== 0 )
                {
                    emit( 'limit_exceeded' );

                    return;
                }

                payload_length = readUint32BE( rx_buffer, 6 );
                header_length = 14;
            }

            // Extended length bytes have not arrived yet.
            if( !header_length ){ break }

            // Fragments accumulate, so the limit applies to the assembled message.
            const buffered = ( state.fragmentSize ?? 0 ) + payload_length;

            if( options?.maxPayload !== undefined && buffered > options.maxPayload ) 
            {
                emit( 'limit_exceeded' );

                return;
            }

            if( header_length + payload_length > rx_buffer.length ){ break }

            const header = rx_buffer.spliceConcat( 0, header_length );
            const payload = rx_buffer.spliceConcat( 0, payload_length );
            maskPayload( header.subarray( header_length - 4 ), payload );

            // Control frames may be interleaved into a fragmented message, so they never
            // touch the fragmentation state.
            if( isControl )
            {
                if( !emitControl( opcode, payload, emit )){ return }

                continue;
            }

            if( opcode === OPCODE_CONTINUATION )
            {
                if( state.fragmentOp === undefined )
                {
                    return protocolError( emit, 'Continuation frame without an open message' );
                }

                state.fragments!.push( payload );
                state.fragmentSize = buffered;
            }
            else if( state.fragmentOp !== undefined )
            {
                return protocolError( emit, 'New data frame while a fragmented message is open' );
            }
            else if( !fin )
            {
                state.fragmentOp = opcode;
                state.fragments = [payload];
                state.fragmentSize = payload.length;

                continue;
            }
            else
            {
                if( !emitMessage( opcode, payload, emit )){ return }

                continue;
            }

            if( !fin ){ continue }

            const assembled = Buffer.concat( state.fragments! );
            const assembledOp = state.fragmentOp!;
            state.fragments = undefined;
            state.fragmentOp = undefined;
            state.fragmentSize = 0;

            if( !emitMessage( assembledOp, assembled, emit )){ return }
        }
    }
}
