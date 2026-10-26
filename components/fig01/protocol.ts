import type { Frame, ModuleId } from "./types";

/* The wire format, as the figure draws it:

     [ LEN u16 LE ][ TYPE u8 ][ SEQ u8 ][ PAYLOAD LEN bytes ][ CRC8 ]

   LEN counts the payload only. CRC8 (poly 0x07, init 0) covers every byte
   before it, LEN included, so a corrupted length is caught by the same check
   as a corrupted payload. The length prefix is what lets a reader on a noisy
   serial line tell a partial read from a complete frame. */

export const TYPE_CODE: Record<Frame["type"], number> = {
  hello: 0x01,
  baud: 0x02,
  state: 0x10,
  config: 0x11,
  auth: 0x12,
  heartbeat: 0x13,
  hello_ack: 0x81,
  baud_ok: 0x82,
  action: 0x90,
  telemetry: 0x91,
  nak: 0x9f,
};

const MODULE_CODE: Record<ModuleId, number> = { weather: 1, calendar: 2, nowplaying: 3 };
const ACTION_CODE: Record<string, number> = { refresh: 1, next: 2, advance: 3 };

export function typeName(f: Frame): string {
  return f.type.toUpperCase();
}

export function crc8(bytes: readonly number[]): number {
  let crc = 0;
  for (const b of bytes) {
    crc ^= b;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x80 ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
    }
  }
  return crc;
}

export function hex(n: number): string {
  return (n & 0xff).toString(16).toUpperCase().padStart(2, "0");
}

const u16 = (n: number) => [n & 0xff, (n >> 8) & 0xff];
const u32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];

function payloadOf(f: Frame): number[] {
  switch (f.type) {
    case "hello": return [f.version, 0x00];
    case "hello_ack": return [f.version];
    case "baud":
    case "baud_ok": return u32(f.rate);
    case "state": {
      const p = f.payload;
      const extra = p.temp_c ?? p.event ?? p.track ?? 0;
      return [MODULE_CODE[f.module_id], p.enabled ? 1 : 0, extra & 0xff];
    }
    case "config": return [MODULE_CODE[f.module_id], f.values.units === "F" ? 1 : 0];
    case "auth": return [MODULE_CODE[f.module_id], f.needs_auth ? 1 : 0];
    case "heartbeat": return u16(f.uptime_s);
    case "action": return [...u16(f.id), MODULE_CODE[f.module_id], ACTION_CODE[f.action] ?? 0];
    case "telemetry": return [...u16(f.uptime_s), f.cpu_c, f.mem_pct];
    case "nak": return [f.seq];
  }
}

export function encode(f: Frame, seq: number): number[] {
  const payload = payloadOf(f);
  const body = [...u16(payload.length), TYPE_CODE[f.type], seq & 0xff, ...payload];
  return [...body, crc8(body)];
}

/* The one-line decode shown beside each log row. */
export function summarize(f: Frame): string {
  switch (f.type) {
    case "hello": return `protocol v${f.version}`;
    case "hello_ack": return `accept v${f.version}`;
    case "baud": return `propose ${f.rate} baud`;
    case "baud_ok": return `locked ${f.rate} baud`;
    case "state": {
      const p = f.payload;
      const extra =
        p.temp_c !== undefined ? ` ${p.temp_c}C`
        : p.event !== undefined ? ` event ${p.event}`
        : p.track !== undefined ? ` track ${p.track}`
        : "";
      return `${f.module_id} ${p.enabled ? "on" : "off"}${extra}`;
    }
    case "config": return `${f.module_id} units=${f.values.units ?? "?"}`;
    case "auth": return `${f.module_id} needs_auth=${f.needs_auth}`;
    case "heartbeat": return `host up ${f.uptime_s}s`;
    case "action": return `${f.module_id}.${f.action} id=${f.id}`;
    case "telemetry": return `up ${f.uptime_s}s cpu ${f.cpu_c}C mem ${f.mem_pct}%`;
    case "nak": return `bad crc on seq ${f.seq}, resend`;
  }
}
