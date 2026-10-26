/* Message names and fields are lifted from the desk-companion `protocol`
   crate (state / config / auth / heartbeat / action). The handshake and
   telemetry messages are the part of the link that the crate keeps below the
   plugin API: they exist so that a version or baud mismatch closes the line
   instead of being guessed at. Nothing here is a canned animation; the
   simulation in sim.ts only ever moves these values across a modelled wire. */

export type ModuleId = "weather" | "calendar" | "nowplaying";

/* What a STATE frame carries about a module. `enabled` is always present;
   the extra field is whatever that module's tick produced. */
export interface StatePayload {
  enabled: boolean;
  temp_c?: number;
  event?: number;
  track?: number;
}

export type HostToPi =
  | { type: "hello"; version: number }
  | { type: "baud"; rate: number }
  | { type: "state"; module_id: ModuleId; name: string; payload: StatePayload }
  | { type: "config"; module_id: ModuleId; values: { units?: "C" | "F" } & Record<string, unknown> }
  | { type: "auth"; module_id: ModuleId; needs_auth: boolean }
  | { type: "heartbeat"; uptime_s: number };

export type PiToHost =
  | { type: "hello_ack"; version: number }
  | { type: "baud_ok"; rate: number }
  | { type: "action"; id: number; module_id: ModuleId; action: string }
  | { type: "telemetry"; uptime_s: number; cpu_c: number; mem_pct: number }
  | { type: "nak"; seq: number };

export type Frame = HostToPi | PiToHost;
export type Direction = "to_pi" | "to_host";

export interface HostState {
  enabled: Record<ModuleId, boolean>;
  units: "C" | "F";
  needsAuth: boolean;
  tempC: number;
  event: number;
  track: number;
}

/* The device's copy. It differs from HostState on purpose: it only changes
   when a frame arrives, which is the whole point of showing both. */
export interface DeviceState {
  enabled: Record<ModuleId, boolean>;
  units: "C" | "F";
  authPrompt: ModuleId | null;
  tempC: number;
  event: number;
  track: number;
  flash: ModuleId | null;
  flashAt: number;
}

export const MODULES: { id: ModuleId; label: string; size: string; code: number }[] = [
  { id: "weather", label: "weather", size: "2x2", code: 1 },
  { id: "calendar", label: "calendar", size: "2x1", code: 2 },
  { id: "nowplaying", label: "nowplaying", size: "4x1", code: 3 },
];

export const TRACKS = ["Blue Monday", "Idioteque", "Teardrop"];
export const EVENTS = ["16:00 Standup", "17:30 Review", "19:00 Dinner"];
/* Adjacent values always differ, so a refresh visibly changes the readout. */
export const TEMPS = [23, 24, 25, 24, 22, 21, 22, 23];
