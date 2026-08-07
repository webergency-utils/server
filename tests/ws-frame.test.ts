import { describe, it, expect } from 'vitest';
import { SimpleMultibuffer, WebsocketFrame, maskPayload } from '../src/helpers/ws-frame.js';

describe( 'WebsocketFrame Framing and Multibuffer Utility', () => 
{
    it( 'should manage SimpleMultibuffer operations correctly', () => 
    {
        const buffer = new SimpleMultibuffer();
        expect( buffer.length ).toBe( 0 );
        expect(() => buffer.get( 0 )).toThrowError( 'Index out of bounds' );

        buffer.append( Buffer.from([1, 2, 3]));
        expect( buffer.length ).toBe( 3 );
        expect( buffer.get( 0 )).toBe( 1 );
        expect( buffer.get( 1 )).toBe( 2 );
        expect( buffer.get( 2 )).toBe( 3 );
        expect(() => buffer.get( 3 )).toThrowError( 'Index out of bounds' );

        buffer.append( Buffer.from([4, 5]));
        expect( buffer.length ).toBe( 5 );
        expect( buffer.get( 3 )).toBe( 4 );
        expect( buffer.get( 4 )).toBe( 5 );

        expect(() => buffer.spliceConcat( 1, 2 )).toThrowError( 'Only spliceConcat starting at 0 is supported' );
        expect(() => buffer.spliceConcat( 0, 10 )).toThrowError( 'Not enough bytes in buffer' );

        const spliced = buffer.spliceConcat( 0, 3 );
        expect( spliced ).toEqual( Buffer.from([1, 2, 3]));
        expect( buffer.length ).toBe( 2 );
        expect( buffer.get( 0 )).toBe( 4 );
        expect( buffer.get( 1 )).toBe( 5 );

        buffer.clear();
        expect( buffer.length ).toBe( 0 );
    });

    it( 'should write and read a masked text frame arriving in chunks', () => 
    {
        const tx = new SimpleMultibuffer();
        const message = 'Hello, WebSocket!';
        WebsocketFrame.write( tx, message, { mask : true });

        const rx = new SimpleMultibuffer();

        while( tx.length > 0 ) 
        {
            rx.append( tx.spliceConcat( 0, Math.min( tx.length, 5 ))); // emulate chunked arrival
        }

        const events: any[] = [];
        WebsocketFrame.read( rx, ( event, data ) => 
        {
            events.push({ event, data });
        });

        expect( events ).toHaveLength( 1 );
        expect( events[0]).toEqual({ event : 'message', data : message });
    });

    it( 'should write and read masked text frame correctly', () => 
    {
        const tx = new SimpleMultibuffer();
        const message = 'Hello, Masked!';
        WebsocketFrame.write( tx, message, { mask : true });

        // Ensure the payload is indeed masked in transit
        const payloadBytes = tx.spliceConcat( 0, tx.length );
        // Find header size (starts with 0x81, then length with mask bit set: 0x80 | length)
        // payload length of "Hello, Masked!" is 14. 14 < 126, so header is 2 bytes + 4 bytes mask key
        expect( payloadBytes[0]).toBe( 0x81 );
        expect( payloadBytes[1] & 0x80 ).toBe( 0x80 ); // mask bit is set
    
        // Put it back to rx
        const rx = new SimpleMultibuffer();
        rx.append( payloadBytes );

        const events: any[] = [];
        WebsocketFrame.read( rx, ( event, data ) => 
        {
            events.push({ event, data });
        });

        expect( events ).toHaveLength( 1 );
        expect( events[0]).toEqual({ event : 'message', data : message });
    });

    it( 'should write and read control frames (ping/pong/close)', () => 
    {
        const tx = new SimpleMultibuffer();
        // Ping frame (opcode 9)
        WebsocketFrame.write( tx, 'ping-payload', { opcode : 9, mask : true });
        // Pong frame (opcode 10)
        WebsocketFrame.write( tx, 'pong-payload', { opcode : 10, mask : true });
        // Close frame (opcode 8)
        const codeBuf = Buffer.alloc( 2 );
        codeBuf.writeUInt16BE( 1001, 0 );
        const closePayload = Buffer.concat([codeBuf, Buffer.from( 'Going away', 'utf8' )]);
        WebsocketFrame.write( tx, closePayload, { opcode : 8, mask : true });

        const rx = new SimpleMultibuffer();
        rx.append( tx.spliceConcat( 0, tx.length ));

        const events: any[] = [];
        WebsocketFrame.read( rx, ( event, ...args ) => 
        {
            events.push({ event, args });
        });

        expect( events ).toHaveLength( 3 );
        expect( events[0].event ).toBe( 'ping' );
        expect( events[0].args[0].toString( 'utf8' )).toBe( 'ping-payload' );
    
        expect( events[1].event ).toBe( 'pong' );
        expect( events[1].args[0].toString( 'utf8' )).toBe( 'pong-payload' );

        expect( events[2].event ).toBe( 'closing' );
        expect( events[2].args[0]).toBe( 1001 );
        expect( events[2].args[1]).toBe( 'Going away' );
    });

    it( 'should handle medium payloads (length >= 126)', () => 
    {
        const tx = new SimpleMultibuffer();
        const largeMessage = 'A'.repeat( 500 ); // 500 bytes (extended 16-bit length)
        WebsocketFrame.write( tx, largeMessage, { mask : true });

        const rx = new SimpleMultibuffer();
        rx.append( tx.spliceConcat( 0, tx.length ));

        const events: any[] = [];
        WebsocketFrame.read( rx, ( event, data ) => 
        {
            events.push({ event, data });
        });

        expect( events ).toHaveLength( 1 );
        expect( events[0]).toEqual({ event : 'message', data : largeMessage });
    });

    it( 'should handle large payloads (length >= 65536) and binary frames', () => 
    {
        // Arrange
        const tx = new SimpleMultibuffer();
        const payload = Buffer.alloc( 65536 );
        WebsocketFrame.write( tx, payload, { mask : true });

        const rx = new SimpleMultibuffer();
        rx.append( tx.spliceConcat( 0, tx.length ));

        // Act
        const events: any[] = [];
        WebsocketFrame.read( rx, ( event, data ) => 
        {
            events.push({ event, data });
        });

        // Assert
        expect( events ).toHaveLength( 1 );
        expect( events[0].event ).toBe( 'message' );
        expect( events[0].data ).toBeInstanceOf( Buffer );
        expect(( events[0].data as Buffer ).length ).toBe( 65536 );
    });

    it( 'should wait for full payload if header is parsed but payload is incomplete', () => 
    {
        // Arrange
        const tx = new SimpleMultibuffer();
        WebsocketFrame.write( tx, 'hello', { mask : true });

        // Slice the 6-byte header and part of the payload (2 bytes out of 5)
        const partial = tx.spliceConcat( 0, 8 );

        const rx = new SimpleMultibuffer();
        rx.append( partial );

        // Act & Assert 1: Incomplete payload
        const events: any[] = [];
        WebsocketFrame.read( rx, ( event, data ) => 
        {
            events.push({ event, data });
        });

        expect( events ).toHaveLength( 0 );
        expect( rx.length ).toBe( 8 );

        // Act & Assert 2: Remaining payload appended
        const rest = tx.spliceConcat( 0, tx.length );
        rx.append( rest );

        WebsocketFrame.read( rx, ( event, data ) => 
        {
            events.push({ event, data });
        });

        expect( events ).toHaveLength( 1 );
        expect( events[0]).toEqual({ event : 'message', data : 'hello' });
    });

    it( 'should parse empty masked text frames (header only)', () =>
    {
        // Arrange — FIN + text, masked, length 0
        const rx = new SimpleMultibuffer();
        rx.append( Buffer.from([ 0x81, 0x80, 0x01, 0x02, 0x03, 0x04 ]));

        // Act
        const events: any[] = [];
        WebsocketFrame.read( rx, ( event, data ) =>
        {
            events.push({ event, data });
        });

        // Assert
        expect( events ).toEqual([{ event : 'message', data : '' }]);
        expect( rx.length ).toBe( 0 );
    });

    it( 'should reject 64-bit lengths with non-zero high bytes without throwing', () =>
    {
        // Arrange — length encoding 127 with high 32 bits set (would overflow signed << 24 before)
        const rx = new SimpleMultibuffer();
        rx.append( Buffer.from([
            0x82, 0xff,
            0x00, 0x00, 0x00, 0x01,
            0x00, 0x00, 0x00, 0x00
        ]));

        // Act
        const events: any[] = [];
        WebsocketFrame.read( rx, ( event ) =>
        {
            events.push( event );
        });

        // Assert
        expect( events ).toEqual([ 'limit_exceeded' ]);
    });

    it( 'should read 64-bit lengths near 2GiB without signed-shift overflow', () =>
    {
        // Arrange — declare ~2.1GiB payload via 64-bit length; reject via maxPayload before alloc
        const rx = new SimpleMultibuffer();
        rx.append( Buffer.from([
            0x82, 0xff,
            0x00, 0x00, 0x00, 0x00,
            0x80, 0x00, 0x00, 0x00
        ]));

        // Act
        const events: any[] = [];
        WebsocketFrame.read( rx, ( event ) =>
        {
            events.push( event );
        }, { maxPayload : 1024 });

        // Assert — length parsed as unsigned 0x80000000 (> 1024), not a negative number
        expect( events ).toEqual([ 'limit_exceeded' ]);
    });

    describe( 'RFC 6455 compliance', () =>
    {
        /** Read `bytes` as if they arrived from a client and collect the emitted events. */
        function readFrames( bytes: Buffer, options?: { maxPayload? : number }, state?: any )
        {
            const rx = new SimpleMultibuffer();
            rx.append( bytes );

            const events: { event : string, args : any[] }[] = [];
            WebsocketFrame.read( rx, ( event, ...args ) =>
            {
                events.push({ event, args });
            }, options, state );

            return { events, rx };
        }

        /** Build a client frame by hand so invalid combinations can be expressed. */
        function frame( b0: number, payload: Buffer | string = Buffer.alloc( 0 ), lengthOverride?: number )
        {
            const body = typeof payload === 'string' ? Buffer.from( payload, 'utf8' ) : payload;
            const mask = Buffer.from([ 0x11, 0x22, 0x33, 0x44 ]);
            const masked = Buffer.from( body );
            maskPayload( mask, masked );

            return Buffer.concat([
                Buffer.from([ b0, 0x80 | ( lengthOverride ?? body.length ) ]),
                mask,
                masked
            ]);
        }

        it( 'should reject an unmasked client frame with 1002', () =>
        {
            // Arrange — FIN + text, mask bit clear
            const { events } = readFrames( Buffer.from([ 0x81, 0x02, 0x68, 0x69 ]));

            // Assert
            expect( events ).toHaveLength( 1 );
            expect( events[0].event ).toBe( 'protocol_error' );
            expect( events[0].args[0]).toBe( 1002 );
            expect( events[0].args[1]).toMatch( /masked/ );
        });

        it( 'should reject non-zero RSV bits with 1002', () =>
        {
            // Arrange — RSV1 set
            const { events } = readFrames( frame( 0xc1, 'hi' ));

            // Assert
            expect( events[0].event ).toBe( 'protocol_error' );
            expect( events[0].args[0]).toBe( 1002 );
            expect( events[0].args[1]).toMatch( /RSV/ );
        });

        it( 'should reject unknown opcodes with 1002', () =>
        {
            // Arrange — opcode 0x3 is reserved for future non-control frames
            const { events } = readFrames( frame( 0x83, 'hi' ));

            // Assert
            expect( events[0].event ).toBe( 'protocol_error' );
            expect( events[0].args[0]).toBe( 1002 );
        });

        it( 'should reject a control frame larger than 125 bytes', () =>
        {
            // Arrange — ping with a 126-byte extended length
            const { events } = readFrames( frame( 0x89, Buffer.alloc( 126 ), 126 ));

            // Assert
            expect( events[0].event ).toBe( 'protocol_error' );
            expect( events[0].args[1]).toMatch( /125/ );
        });

        it( 'should reject a fragmented control frame', () =>
        {
            // Arrange — ping without FIN
            const { events } = readFrames( frame( 0x09, 'x' ));

            // Assert
            expect( events[0].event ).toBe( 'protocol_error' );
            expect( events[0].args[1]).toMatch( /fragmented/ );
        });

        it( 'should reassemble a fragmented text message', () =>
        {
            // Arrange — text without FIN, then a continuation with FIN
            const bytes = Buffer.concat([ frame( 0x01, 'Hel' ), frame( 0x80, 'lo' ) ]);

            // Act
            const { events } = readFrames( bytes, undefined, {});

            // Assert
            expect( events ).toEqual([{ event : 'message', args : [ 'Hello' ] }]);
        });

        it( 'should reassemble fragments arriving across separate reads', () =>
        {
            // Arrange
            const state = {};
            const rx = new SimpleMultibuffer();
            const events: { event : string, args : any[] }[] = [];
            const emit = ( event: string, ...args: any[]) => { events.push({ event, args }) };

            // Act — the opening fragment arrives alone
            rx.append( frame( 0x02, Buffer.from( 'ab' )));
            WebsocketFrame.read( rx, emit, undefined, state );

            expect( events ).toHaveLength( 0 );

            rx.append( frame( 0x80, Buffer.from( 'cd' )));
            WebsocketFrame.read( rx, emit, undefined, state );

            // Assert
            expect( events ).toHaveLength( 1 );
            expect( events[0].event ).toBe( 'message' );
            expect(( events[0].args[0] as Buffer ).toString()).toBe( 'abcd' );
        });

        it( 'should deliver interleaved control frames without breaking reassembly', () =>
        {
            // Arrange — text fragment, ping, then the closing continuation
            const bytes = Buffer.concat([
                frame( 0x01, 'a' ),
                frame( 0x89, 'p' ),
                frame( 0x80, 'b' )
            ]);

            // Act
            const { events } = readFrames( bytes, undefined, {});

            // Assert
            expect( events.map( e => e.event )).toEqual([ 'ping', 'message' ]);
            expect( events[1].args[0]).toBe( 'ab' );
        });

        it( 'should reject a continuation frame with no message open', () =>
        {
            // Arrange
            const { events } = readFrames( frame( 0x80, 'orphan' ), undefined, {});

            // Assert
            expect( events[0].event ).toBe( 'protocol_error' );
            expect( events[0].args[1]).toMatch( /Continuation/ );
        });

        it( 'should reject a new data frame while a fragmented message is open', () =>
        {
            // Arrange
            const bytes = Buffer.concat([ frame( 0x01, 'a' ), frame( 0x81, 'b' ) ]);

            // Act
            const { events } = readFrames( bytes, undefined, {});

            // Assert
            expect( events[0].event ).toBe( 'protocol_error' );
            expect( events[0].args[1]).toMatch( /fragmented message is open/ );
        });

        it( 'should apply maxPayload to the assembled message, not each fragment', () =>
        {
            // Arrange — two 4-byte fragments against a 6-byte cap
            const bytes = Buffer.concat([ frame( 0x02, Buffer.alloc( 4 )), frame( 0x80, Buffer.alloc( 4 )) ]);

            // Act
            const { events } = readFrames( bytes, { maxPayload : 6 }, {});

            // Assert
            expect( events.map( e => e.event )).toEqual([ 'limit_exceeded' ]);
        });

        it( 'should reject invalid UTF-8 in a text frame with 1007', () =>
        {
            // Arrange — 0xC3 starts a 2-byte sequence that never completes
            const { events } = readFrames( frame( 0x81, Buffer.from([ 0x48, 0xc3 ])));

            // Assert
            expect( events[0].event ).toBe( 'protocol_error' );
            expect( events[0].args[0]).toBe( 1007 );
        });

        it( 'should accept multi-byte UTF-8 in a text frame', () =>
        {
            // Arrange
            const { events } = readFrames( frame( 0x81, 'héllo → ✓' ));

            // Assert
            expect( events ).toEqual([{ event : 'message', args : [ 'héllo → ✓' ] }]);
        });

        it( 'should reject invalid UTF-8 spanning a fragment boundary with 1007', () =>
        {
            // Arrange — the 2-byte sequence is split and the second half is invalid
            const bytes = Buffer.concat([
                frame( 0x01, Buffer.from([ 0xc3 ])),
                frame( 0x80, Buffer.from([ 0x28 ]))
            ]);

            // Act
            const { events } = readFrames( bytes, undefined, {});

            // Assert
            expect( events[0].event ).toBe( 'protocol_error' );
            expect( events[0].args[0]).toBe( 1007 );
        });

        it( 'should not validate UTF-8 on binary frames', () =>
        {
            // Arrange
            const { events } = readFrames( frame( 0x82, Buffer.from([ 0xff, 0xfe ])));

            // Assert
            expect( events[0].event ).toBe( 'message' );
            expect( events[0].args[0]).toBeInstanceOf( Buffer );
        });

        it.each([ 1004, 1005, 1006, 999, 1015, 2000, 5000 ])( 'should reject reserved close code %i', ( code ) =>
        {
            // Arrange
            const payload = Buffer.alloc( 2 );
            payload.writeUInt16BE( code, 0 );

            // Act
            const { events } = readFrames( frame( 0x88, payload ));

            // Assert
            expect( events[0].event ).toBe( 'protocol_error' );
            expect( events[0].args[0]).toBe( 1002 );
        });

        it.each([ 1000, 1001, 1003, 1011, 3000, 4999 ])( 'should accept close code %i', ( code ) =>
        {
            // Arrange
            const payload = Buffer.alloc( 2 );
            payload.writeUInt16BE( code, 0 );

            // Act
            const { events } = readFrames( frame( 0x88, payload ));

            // Assert
            expect( events[0].event ).toBe( 'closing' );
            expect( events[0].args[0]).toBe( code );
        });

        it( 'should accept a close frame with no payload', () =>
        {
            // Arrange
            const { events } = readFrames( frame( 0x88 ));

            // Assert
            expect( events ).toEqual([{ event : 'closing', args : [ undefined, undefined ] }]);
        });

        it( 'should reject a close frame with a 1-byte payload', () =>
        {
            // Arrange
            const { events } = readFrames( frame( 0x88, Buffer.from([ 0x03 ])));

            // Assert
            expect( events[0].event ).toBe( 'protocol_error' );
            expect( events[0].args[1]).toMatch( /at least 2 bytes/ );
        });

        it( 'should reject invalid UTF-8 in a close reason with 1007', () =>
        {
            // Arrange
            const payload = Buffer.concat([ Buffer.from([ 0x03, 0xe8 ]), Buffer.from([ 0xc3 ]) ]);

            // Act
            const { events } = readFrames( frame( 0x88, payload ));

            // Assert
            expect( events[0].event ).toBe( 'protocol_error' );
            expect( events[0].args[0]).toBe( 1007 );
        });

        it( 'should stop parsing after a protocol error', () =>
        {
            // Arrange — a bad frame followed by a perfectly good one
            const bytes = Buffer.concat([ frame( 0xc1, 'bad' ), frame( 0x81, 'good' ) ]);

            // Act
            const { events } = readFrames( bytes );

            // Assert
            expect( events ).toHaveLength( 1 );
            expect( events[0].event ).toBe( 'protocol_error' );
        });
    });
});
