import {
  Direction,
  DeviceState,
  EVENTS,
  Frame,
  HostState,
  HostToPi,
  ModuleId,
  MODULES,
  TEMPS,
  TRACKS,
} from "./types";
import { encode, summarize, typeName } from "./protocol";

/* The whole link is one pure reducer. Time is a number in state (`now`), and
   the view only ever adds real elapsed milliseconds to it while the figure is
   on screen and the tab is visible. That single decision buys three things:
   pausing off-screen is just "stop dispatching", React strict mode can
   double-invoke the reducer without double-sending a frame, and the sequence
   of events is deterministic, so the figure cannot drift into showing
   something the protocol would not do.

   The device is never written to by a click. A click changes the HOST, queues
   a frame, and the device changes only when that frame lands. */

export const VERSION = 3;
export const BAUD = 115200;
export const RETRY_MS = 3000;
export const RETRY_BUDGET = 3;

/* A frame is ~10 bytes at 115200 baud: about a millisecond on a real wire.
   Nobody can watch a millisecond, so the figure stretches transit to 700ms
   and says so in its footer. Reduced motion shortens it to a blink. */
const TRANSIT = 700;
const TRANSIT_REDUCED = 140;
const LANE_GAP = 60;
const LOG_MAX = 14;
const PI_BOOT_S = 41_200;

export type Phase = "handshake" | "up" | "down";
export type RowState = "flying" | "ok" | "crc" | "lost";

export interface LogRow {
  id: number;
  t: number;
  kind: "frame" | "sys";
  dir: Direction;
  name: string;
  seq: number;
  bytes: number[];
  summary: string;
  state: RowState;
  /* index of the byte the injected bit flip landed on */
  flip?: number;
  retx?: boolean;
}

export interface Flight {
  id: number;
  dir: Direction;
  name: string;
  bytes: number[];
  remaining: number;
  total: number;
  frame: Frame;
  seq: number;
  flip?: number;
  retx?: boolean;
  /* a NAK remembers what it is asking to be resent */
  retry?: { frame: HostToPi; seq: number };
}

interface Queued {
  frame: Frame;
  seq?: number;
  retx?: boolean;
  retry?: { frame: HostToPi; seq: number };
}

export interface Sim {
  now: number;
  transit: number;
  phase: Phase;
  /* how many of the four handshake frames have landed */
  hsStep: number;
  startAt: number | null;
  cable: "plugged" | "pulled";
  retryAt: number | null;
  retries: number;
  upAt: number;
  seq: Record<Direction, number>;
  nextId: number;
  actionId: number;
  tickN: number;
  nextTelemetry: number;
  nextTick: number;
  nextOut: Record<Direction, number>;
  out: Record<Direction, Queued[]>;
  corruptNext: boolean;
  flights: Flight[];
  log: LogRow[];
  last: LogRow | null;
  stats: { frames: number; bytes: number; errors: number; recent: number[] };
  host: HostState;
  device: DeviceState;
  peer: { uptime_s: number; cpu_c: number; mem_pct: number } | null;
  hostHit: ModuleId | null;
  hostHitAt: number;
  /* the aria-live string: changes only on link-state events, never per frame */
  say: string;
}

export type Action =
  | { type: "advance"; dt: number }
  | { type: "motion"; reduce: boolean }
  | { type: "toggle"; id: ModuleId }
  | { type: "units" }
  | { type: "auth" }
  | { type: "device_action"; id: ModuleId; action: string }
  | { type: "pull" }
  | { type: "connect" }
  | { type: "arm" };

export function initSim(): Sim {
  return {
    now: 0,
    transit: TRANSIT,
    phase: "handshake",
    hsStep: 0,
    startAt: 600,
    cable: "plugged",
    retryAt: null,
    retries: 0,
    upAt: 0,
    seq: { to_pi: 0, to_host: 0 },
    nextId: 2,
    actionId: 1,
    tickN: 0,
    nextTelemetry: 0,
    nextTick: 0,
    nextOut: { to_pi: 0, to_host: 0 },
    out: { to_pi: [], to_host: [] },
    corruptNext: false,
    flights: [],
    log: [
      {
        id: 1, t: 0, kind: "sys", dir: "to_pi", name: "SYS", seq: 0, bytes: [],
        summary: "port open /dev/ttyUSB0 115200 8N1", state: "ok",
      },
    ],
    last: null,
    stats: { frames: 0, bytes: 0, errors: 0, recent: [] },
    host: {
      enabled: { weather: true, calendar: false, nowplaying: false },
      units: "C",
      needsAuth: false,
      tempC: TEMPS[0],
      event: 0,
      track: 0,
    },
    /* A freshly powered device knows nothing. Everything on its screen
       arrives in the resync that follows the handshake. */
    device: {
      enabled: { weather: false, calendar: false, nowplaying: false },
      units: "C",
      authPrompt: null,
      tempC: TEMPS[0],
      event: 0,
      track: 0,
      flash: null,
      flashAt: -9999,
    },
    peer: null,
    hostHit: null,
    hostHitAt: -9999,
    say: "",
  };
}

/* ── working copy ───────────────────────────────────────────
   Copy every container the reducer mutates, so `prev` is never touched. */

function work(s: Sim): Sim {
  return {
    ...s,
    seq: { ...s.seq },
    nextOut: { ...s.nextOut },
    out: { to_pi: [...s.out.to_pi], to_host: [...s.out.to_host] },
    flights: [...s.flights],
    log: [...s.log],
    stats: { ...s.stats, recent: [...s.stats.recent] },
    host: { ...s.host, enabled: { ...s.host.enabled } },
    device: { ...s.device, enabled: { ...s.device.enabled } },
  };
}

const secs = (w: Sim) => Math.floor(w.now / 1000);

/* ── log ───────────────────────────────────────────────── */

function pushRow(w: Sim, row: LogRow) {
  w.log.unshift(row);
  if (w.log.length > LOG_MAX) w.log.length = LOG_MAX;
}

function sys(w: Sim, text: string, warn = false) {
  pushRow(w, {
    id: w.nextId++, t: w.now, kind: "sys", dir: "to_pi", name: "SYS", seq: 0,
    bytes: [], summary: text, state: warn ? "lost" : "ok",
  });
}

function setRowState(w: Sim, id: number, state: RowState) {
  const i = w.log.findIndex((r) => r.id === id);
  if (i >= 0) w.log[i] = { ...w.log[i], state };
  if (w.last && w.last.id === id) w.last = { ...w.last, state };
}

/* ── frames ────────────────────────────────────────────── */

function queue(w: Sim, dir: Direction, item: Queued, front = false) {
  if (front) w.out[dir].unshift(item);
  else w.out[dir].push(item);
}

/* Put one queued frame on the wire. A UART is a single lane per direction:
   the next frame does not start until the last one is out, so each lane
   holds one frame at a time. */
function send(w: Sim, dir: Direction, item: Queued) {
  const seq = item.seq ?? w.seq[dir];
  if (item.seq === undefined) w.seq[dir] = (w.seq[dir] + 1) & 0xff;

  let bytes = encode(item.frame, seq);
  let flip: number | undefined;
  /* Line noise: flip one bit inside the payload and leave the CRC alone, so
     the device's check fails for the real reason a CRC fails. */
  if (dir === "to_pi" && w.corruptNext && w.phase === "up" && !item.retx) {
    flip = bytes.length > 5 ? 4 : bytes.length - 1;
    bytes = bytes.slice();
    bytes[flip] ^= 0x04;
    w.corruptNext = false;
  }

  const id = w.nextId++;
  const name = typeName(item.frame);
  const row: LogRow = {
    id, t: w.now, kind: "frame", dir, name, seq, bytes,
    summary: summarize(item.frame), state: "flying", flip, retx: item.retx,
  };
  pushRow(w, row);
  w.last = row;
  w.flights.push({
    id, dir, name, bytes, remaining: w.transit, total: w.transit,
    frame: item.frame, seq, flip, retx: item.retx, retry: item.retry,
  });
  w.stats.frames++;
  w.stats.bytes += bytes.length;
  w.stats.recent.push(w.now);
}

function stateFrame(h: HostState, id: ModuleId): HostToPi {
  const payload =
    id === "weather" ? { enabled: h.enabled[id], temp_c: h.tempC }
    : id === "calendar" ? { enabled: h.enabled[id], event: h.event }
    : { enabled: h.enabled[id], track: h.track };
  return { type: "state", module_id: id, name: "current", payload };
}

/* ── receiving ─────────────────────────────────────────── */

function deviceRecv(w: Sim, f: Flight) {
  const frame = f.frame as HostToPi;
  switch (frame.type) {
    case "hello":
      w.hsStep = Math.max(w.hsStep, 1);
      queue(w, "to_host", { frame: { type: "hello_ack", version: frame.version } });
      break;
    case "baud":
      w.hsStep = Math.max(w.hsStep, 3);
      queue(w, "to_host", { frame: { type: "baud_ok", rate: frame.rate } });
      break;
    case "state": {
      const d = w.device;
      d.enabled[frame.module_id] = frame.payload.enabled;
      if (frame.payload.temp_c !== undefined) d.tempC = frame.payload.temp_c;
      if (frame.payload.event !== undefined) d.event = frame.payload.event;
      if (frame.payload.track !== undefined) d.track = frame.payload.track;
      d.flash = frame.module_id;
      d.flashAt = w.now;
      break;
    }
    case "config":
      if (frame.values.units) w.device.units = frame.values.units;
      w.device.flash = frame.module_id;
      w.device.flashAt = w.now;
      break;
    case "auth":
      w.device.authPrompt = frame.needs_auth ? frame.module_id : null;
      break;
    case "heartbeat":
      break;
  }
}

function resync(w: Sim) {
  /* After any (re)connect the host does not trust that the device remembers
     anything. It pushes the full picture: every module, then config. */
  for (const m of MODULES) queue(w, "to_pi", { frame: stateFrame(w.host, m.id) });
  queue(w, "to_pi", {
    frame: { type: "config", module_id: "weather", values: { units: w.host.units } },
  });
  if (w.host.needsAuth !== (w.device.authPrompt !== null)) {
    queue(w, "to_pi", {
      frame: { type: "auth", module_id: "weather", needs_auth: w.host.needsAuth },
    });
  }
}

function hostRecv(w: Sim, f: Flight) {
  const frame = f.frame as Exclude<Frame, HostToPi>;
  switch (frame.type) {
    case "hello_ack":
      w.hsStep = Math.max(w.hsStep, 2);
      queue(w, "to_pi", { frame: { type: "baud", rate: BAUD } });
      break;
    case "baud_ok":
      w.hsStep = 4;
      w.phase = "up";
      w.upAt = w.now;
      w.nextTelemetry = w.now + 1000;
      w.nextTick = w.now + 2200;
      w.say = `Link up. Protocol version ${VERSION} at ${BAUD} baud. The host is resyncing the device.`;
      sys(w, `link up v${VERSION} ${BAUD} 8N1, resync`);
      resync(w);
      break;
    case "telemetry":
      w.peer = { uptime_s: frame.uptime_s, cpu_c: frame.cpu_c, mem_pct: frame.mem_pct };
      break;
    case "action": {
      const id = frame.module_id;
      w.hostHit = id;
      w.hostHitAt = w.now;
      /* The host owns the data. A tap on the device is a request; the answer
         is a STATE frame, and only that repaints the screen. */
      if (id === "weather") {
        w.tickN++;
        w.host.tempC = TEMPS[w.tickN % TEMPS.length];
      } else if (id === "calendar") {
        w.host.event = (w.host.event + 1) % EVENTS.length;
      } else {
        w.host.track = (w.host.track + 1) % TRACKS.length;
      }
      queue(w, "to_pi", { frame: stateFrame(w.host, id) });
      break;
    }
    case "nak":
      if (f.retry) queue(w, "to_pi", { frame: f.retry.frame, seq: f.retry.seq, retx: true }, true);
      break;
  }
}

function land(w: Sim, f: Flight) {
  w.nextOut[f.dir] = w.now + LANE_GAP;

  if (f.flip !== undefined) {
    /* The device recomputes the CRC, disagrees, drops the frame and asks for
       it again by sequence number. State on the device does not change. */
    setRowState(w, f.id, "crc");
    w.stats.errors++;
    w.say = "A frame failed its CRC check on the device. The device asked the host to resend it.";
    queue(w, "to_host", {
      frame: { type: "nak", seq: f.seq },
      retry: { frame: f.frame as HostToPi, seq: f.seq },
    });
    return;
  }

  setRowState(w, f.id, "ok");
  if (f.dir === "to_pi") deviceRecv(w, f);
  else hostRecv(w, f);
}

/* ── time ──────────────────────────────────────────────── */

function advance(prev: Sim, dt: number): Sim {
  const w = work(prev);
  w.now += dt;
  w.stats.recent = w.stats.recent.filter((t) => t > w.now - 3000);

  /* 1. frames arrive */
  if (w.flights.length) {
    const aged = w.flights.map((f) => ({ ...f, remaining: f.remaining - dt }));
    const landed = aged.filter((f) => f.remaining <= 0).sort((a, b) => a.remaining - b.remaining);
    w.flights = aged.filter((f) => f.remaining > 0);
    for (const f of landed) land(w, f);
  }

  /* 2. phase timers */
  if (w.phase === "handshake" && w.startAt !== null && w.now >= w.startAt) {
    w.startAt = null;
    w.say = `Negotiating. Host proposes protocol version ${VERSION}, then ${BAUD} baud.`;
    queue(w, "to_pi", { frame: { type: "hello", version: VERSION } });
  }

  if (w.phase === "up") {
    if (w.now >= w.nextTelemetry) {
      w.nextTelemetry = Math.max(w.nextTelemetry + 1000, w.now + 500);
      if (w.out.to_host.length < 2) {
        const s = secs(w);
        queue(w, "to_host", {
          frame: { type: "telemetry", uptime_s: PI_BOOT_S + s, cpu_c: 45 + (s % 5), mem_pct: 31 + (s % 3) },
        });
      }
    }
    if (w.now >= w.nextTick) {
      w.nextTick = Math.max(w.nextTick + 3000, w.now + 1500);
      /* The host ticks its plugins every 3s. One module per tick, round
         robin: the lane is a single UART, not a firehose. */
      w.tickN++;
      w.host.tempC = TEMPS[w.tickN % TEMPS.length];
      const on = MODULES.filter((m) => w.host.enabled[m.id]);
      if (w.out.to_pi.length < 6) {
        if (on.length === 0) {
          queue(w, "to_pi", { frame: { type: "heartbeat", uptime_s: secs(w) } });
        } else {
          const pick = on[w.tickN % on.length];
          queue(w, "to_pi", { frame: stateFrame(w.host, pick.id) });
        }
      }
    }
  }

  if (w.phase === "down" && w.retryAt !== null && w.now >= w.retryAt) {
    w.retries++;
    w.stats.errors++;
    sys(w, `retry ${w.retries}/${RETRY_BUDGET}: no carrier on /dev/ttyUSB0`, true);
    if (w.retries >= RETRY_BUDGET) {
      w.retryAt = null;
      w.say = "Retry budget spent. Use reconnect to try again.";
    } else {
      w.retryAt += RETRY_MS;
    }
  }

  /* 3. each lane sends its next queued frame once it is clear */
  if (w.cable === "plugged") {
    for (const dir of ["to_pi", "to_host"] as const) {
      const busy = w.flights.some((f) => f.dir === dir);
      if (!busy && w.out[dir].length && w.now >= w.nextOut[dir]) {
        send(w, dir, w.out[dir].shift()!);
      }
    }
  }

  return w;
}

/* ── user actions ──────────────────────────────────────── */

function held(w: Sim, what: string) {
  sys(w, `${what} held on host, resync after link up`, true);
}

export function reducer(s: Sim, a: Action): Sim {
  if (a.type === "advance") return advance(s, a.dt);
  if (a.type === "motion") {
    return { ...s, transit: a.reduce ? TRANSIT_REDUCED : TRANSIT };
  }

  const w = work(s);

  switch (a.type) {
    case "toggle": {
      w.host.enabled[a.id] = !w.host.enabled[a.id];
      if (w.phase === "up") queue(w, "to_pi", { frame: stateFrame(w.host, a.id) });
      else held(w, `${a.id} ${w.host.enabled[a.id] ? "on" : "off"}`);
      break;
    }
    case "units": {
      w.host.units = w.host.units === "C" ? "F" : "C";
      if (w.phase === "up") {
        queue(w, "to_pi", {
          frame: { type: "config", module_id: "weather", values: { units: w.host.units } },
        });
      } else held(w, `units ${w.host.units}`);
      break;
    }
    case "auth": {
      w.host.needsAuth = !w.host.needsAuth;
      if (w.phase === "up") {
        queue(w, "to_pi", {
          frame: { type: "auth", module_id: "weather", needs_auth: w.host.needsAuth },
        });
      } else held(w, "auth");
      break;
    }
    case "device_action": {
      if (w.phase !== "up") break;
      queue(w, "to_host", {
        frame: { type: "action", id: w.actionId++, module_id: a.id, action: a.action },
      });
      break;
    }
    case "arm": {
      if (w.phase === "up") w.corruptNext = !w.corruptNext;
      break;
    }
    case "pull": {
      if (w.cable === "pulled") break;
      const lost = w.flights.length;
      for (const f of w.flights) setRowState(w, f.id, "lost");
      w.flights = [];
      w.out = { to_pi: [], to_host: [] };
      w.cable = "pulled";
      w.phase = "down";
      w.hsStep = 0;
      w.startAt = null;
      w.corruptNext = false;
      w.retries = 0;
      w.retryAt = w.now + RETRY_MS;
      w.stats.errors += lost;
      w.say = `Link down. Cable unplugged. Host retries in ${RETRY_MS / 1000} seconds.`;
      sys(w, `cable pulled${lost ? `, ${lost} in flight lost` : ""}`, true);
      break;
    }
    case "connect": {
      if (w.phase !== "down") break;
      w.cable = "plugged";
      w.phase = "handshake";
      w.hsStep = 0;
      w.retryAt = null;
      w.retries = 0;
      w.startAt = w.now + 500;
      w.nextOut = { to_pi: w.now, to_host: w.now };
      w.say = "Cable reconnected. Renegotiating the link.";
      sys(w, "port open /dev/ttyUSB0 115200 8N1");
      break;
    }
  }
  return w;
}
