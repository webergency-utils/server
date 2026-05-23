import { describe, it, expect } from 'vitest';
import { SimpleMultibuffer, WebsocketFrame } from '../helpers/ws-frame.js';

describe('WebsocketFrame Framing and Multibuffer Utility', () => {
  it('should manage SimpleMultibuffer operations correctly', () => {
    const buffer = new SimpleMultibuffer();
    expect(buffer.length).toBe(0);

    buffer.append(Buffer.from([1, 2, 3]));
    expect(buffer.length).toBe(3);
    expect(buffer.get(0)).toBe(1);
    expect(buffer.get(1)).toBe(2);
    expect(buffer.get(2)).toBe(3);

    buffer.append(Buffer.from([4, 5]));
    expect(buffer.length).toBe(5);
    expect(buffer.get(3)).toBe(4);
    expect(buffer.get(4)).toBe(5);

    const spliced = buffer.spliceConcat(0, 3);
    expect(spliced).toEqual(Buffer.from([1, 2, 3]));
    expect(buffer.length).toBe(2);
    expect(buffer.get(0)).toBe(4);
    expect(buffer.get(1)).toBe(5);

    buffer.clear();
    expect(buffer.length).toBe(0);
  });

  it('should write and read unmasked text frame correctly', () => {
    const tx = new SimpleMultibuffer();
    const message = 'Hello, WebSocket!';
    WebsocketFrame.write(tx, message, { mask: false });

    const rx = new SimpleMultibuffer();
    while (tx.length > 0) {
      rx.append(tx.spliceConcat(0, Math.min(tx.length, 5))); // emulate chunked arrival
    }

    const events: any[] = [];
    WebsocketFrame.read(rx, (event, data) => {
      events.push({ event, data });
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ event: 'message', data: message });
  });

  it('should write and read masked text frame correctly', () => {
    const tx = new SimpleMultibuffer();
    const message = 'Hello, Masked!';
    WebsocketFrame.write(tx, message, { mask: true });

    // Ensure the payload is indeed masked in transit
    const payloadBytes = tx.spliceConcat(0, tx.length);
    // Find header size (starts with 0x81, then length with mask bit set: 0x80 | length)
    // payload length of "Hello, Masked!" is 14. 14 < 126, so header is 2 bytes + 4 bytes mask key
    expect(payloadBytes[0]).toBe(0x81);
    expect(payloadBytes[1] & 0x80).toBe(0x80); // mask bit is set
    
    // Put it back to rx
    const rx = new SimpleMultibuffer();
    rx.append(payloadBytes);

    const events: any[] = [];
    WebsocketFrame.read(rx, (event, data) => {
      events.push({ event, data });
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ event: 'message', data: message });
  });

  it('should write and read control frames (ping/pong/close)', () => {
    const tx = new SimpleMultibuffer();
    // Ping frame (opcode 9)
    WebsocketFrame.write(tx, 'ping-payload', { opcode: 9, mask: false });
    // Pong frame (opcode 10)
    WebsocketFrame.write(tx, 'pong-payload', { opcode: 10, mask: false });
    // Close frame (opcode 8)
    const codeBuf = Buffer.alloc(2);
    codeBuf.writeUInt16BE(1001, 0);
    const closePayload = Buffer.concat([codeBuf, Buffer.from('Going away', 'utf8')]);
    WebsocketFrame.write(tx, closePayload, { opcode: 8, mask: false });

    const rx = new SimpleMultibuffer();
    rx.append(tx.spliceConcat(0, tx.length));

    const events: any[] = [];
    WebsocketFrame.read(rx, (event, ...args) => {
      events.push({ event, args });
    });

    expect(events).toHaveLength(3);
    expect(events[0].event).toBe('ping');
    expect(events[0].args[0].toString('utf8')).toBe('ping-payload');
    
    expect(events[1].event).toBe('pong');
    expect(events[1].args[0].toString('utf8')).toBe('pong-payload');

    expect(events[2].event).toBe('closing');
    expect(events[2].args[0]).toBe(1001);
    expect(events[2].args[1]).toBe('Going away');
  });

  it('should handle medium payloads (length >= 126)', () => {
    const tx = new SimpleMultibuffer();
    const largeMessage = 'A'.repeat(500); // 500 bytes (extended 16-bit length)
    WebsocketFrame.write(tx, largeMessage, { mask: true });

    const rx = new SimpleMultibuffer();
    rx.append(tx.spliceConcat(0, tx.length));

    const events: any[] = [];
    WebsocketFrame.read(rx, (event, data) => {
      events.push({ event, data });
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ event: 'message', data: largeMessage });
  });
});
