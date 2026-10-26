"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import PiScreen from "./PiScreen";
import TravellingFrame from "./TravellingFrame";
import { Anatomy, FrameLog, Negotiation } from "./FrameLog";
import { BAUD, RETRY_BUDGET, VERSION, initSim, reducer, Flight } from "./sim";
import { MODULES } from "./types";
import styles from "./TheLink.module.css";

/* Link time advances in 100ms slices while the figure is on screen and the
   tab is visible, and not at all otherwise. Capping each slice stops a
   throttled background tab from delivering a burst of seconds at once. */
const SLICE_MS = 100;
const MAX_STEP_MS = 250;

function mmss(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/* The wire, drawn as three rails: TX, RX and ground. Frames ride the rail
   for their direction. On a narrow screen the same markup turns vertical
   (the stylesheet flips a custom property, and this component reads it back
   to know which axis to travel). */
function Wire({
  flights,
  cut,
  reduce,
}: {
  flights: Flight[];
  cut: boolean;
  reduce: boolean;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const [geo, setGeo] = useState({ travel: 0, vertical: true });

  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    const measure = () => {
      const cs = getComputedStyle(el);
      const vertical = cs.getPropertyValue("--vert").trim() === "1";
      const chipW = parseFloat(cs.getPropertyValue("--chip-w")) || 0;
      const chipH = parseFloat(cs.getPropertyValue("--chip-h")) || 0;
      const r = el.getBoundingClientRect();
      setGeo({
        vertical,
        travel: Math.max(0, vertical ? r.height - chipH : r.width - chipW),
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const lane = (dir: Flight["dir"]) =>
    reduce
      ? null
      : flights
          .filter((f) => f.dir === dir)
          .map((f) => (
            <TravellingFrame key={f.id} flight={f} travel={geo.travel} vertical={geo.vertical} />
          ));

  return (
    <div className={styles.wire} aria-hidden="true">
      <div className={styles.lane}>
        <span className={styles.laneLabel}>
          TX <i className={styles.aH}>&rarr;</i><i className={styles.aV}>&darr;</i> RX
        </span>
        <div className={styles.rail} ref={railRef} data-cut={cut}>
          <span className={styles.railLine} />
          {lane("to_pi")}
        </div>
      </div>
      <div className={styles.lane}>
        <span className={styles.laneLabel}>
          RX <i className={styles.aH}>&larr;</i><i className={styles.aV}>&uarr;</i> TX
        </span>
        <div className={styles.rail} data-cut={cut}>
          <span className={styles.railLine} />
          {lane("to_host")}
        </div>
      </div>
      <div className={`${styles.lane} ${styles.laneGnd}`}>
        <span className={styles.laneLabel}>GND</span>
        <div className={styles.rail}>
          <span className={`${styles.railLine} ${styles.railGnd}`} />
        </div>
      </div>
    </div>
  );
}

export default function TheLink() {
  const reduce = useReducedMotion() ?? false;
  const [s, dispatch] = useReducer(reducer, undefined, initSim);

  const rootRef = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);

  useEffect(() => {
    dispatch({ type: "motion", reduce });
  }, [reduce]);

  /* A link nobody can see should not run. The same gate covers off-screen
     and a hidden tab, and because time lives in the reducer, "paused" simply
     means "no slices arrive". */
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const onVis = () => setTabVisible(document.visibilityState === "visible");
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const active = inView && tabVisible;
  useEffect(() => {
    if (!active) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min(now - last, MAX_STEP_MS);
      last = now;
      dispatch({ type: "advance", dt });
    }, SLICE_MS);
    return () => window.clearInterval(id);
  }, [active]);

  const up = s.phase === "up";
  const down = s.phase === "down";
  const fps = s.stats.recent.filter((t) => t > s.now - 2000).length / 2;
  const hostHit = s.now - s.hostHitAt < 500 ? s.hostHit : null;
  const wordClass = up ? styles.stUp : down ? styles.stDown : styles.stNeg;
  const word = up ? "LINK UP" : down ? "LINK DOWN" : "NEGOTIATING";

  const retryIn = s.retryAt !== null ? Math.max(1, Math.ceil((s.retryAt - s.now) / 1000)) : 0;

  return (
    <figure className={styles.plate} ref={rootRef} data-ui>
      <span className={`${styles.reg} ${styles.regA}`} aria-hidden="true" />
      <span className={`${styles.reg} ${styles.regB}`} aria-hidden="true" />
      <span className={`${styles.reg} ${styles.regC}`} aria-hidden="true" />
      <span className={`${styles.reg} ${styles.regD}`} aria-hidden="true" />

      <figcaption className={styles.bar}>
        <span className={styles.barTitle}>FIG.01 / SERIAL LINK</span>
        <span className={styles.barMeta}>PROTO v{VERSION} / {BAUD} 8N1</span>
        <span className={`${styles.status} ${wordClass}`}>
          <i className={styles.statusLed} aria-hidden="true" />
          {word}
        </span>
      </figcaption>
      {down && <div className={styles.hazard} aria-hidden="true" />}

      <div className={styles.rig}>
        {/* ── HOST ─────────────────────────────────────────── */}
        <section className={styles.endpoint} aria-label="Host">
          <header className={styles.epHead}>
            <span className={styles.epTag} aria-hidden="true">A</span>
            <div className={styles.epId}>
              <h3 className={styles.epName}>HOST</h3>
              <p className={styles.epPart}>/dev/ttyUSB0</p>
            </div>
          </header>
          <p className={styles.epSub}>Rust host process / plugins tick every 3.0s</p>

          <ul className={styles.mods}>
            {MODULES.map((m, i) => {
              const on = s.host.enabled[m.id];
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: "toggle", id: m.id })}
                    className={`${styles.mod} ${hostHit === m.id ? styles.modHit : ""}`}
                    aria-pressed={on}
                  >
                    <span className={styles.modIdx}>{String(i + 1).padStart(2, "0")}</span>
                    <span className={styles.modName}>{m.label}</span>
                    <span className={styles.modSize}>{m.size}</span>
                    <span className={`${styles.modState} ${on ? styles.modOn : ""}`}>{on ? "ON" : "OFF"}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className={styles.ctlRow}>
            <button
              type="button"
              className={styles.btn}
              onClick={() => dispatch({ type: "units" })}
            >
              Units: {s.host.units}
            </button>
            <button
              type="button"
              className={styles.btn}
              aria-pressed={s.host.needsAuth}
              onClick={() => dispatch({ type: "auth" })}
            >
              Auth: {s.host.needsAuth ? "required" : "none"}
            </button>
          </div>

          <dl className={styles.peer}>
            <dt>Peer telemetry</dt>
            <dd>
              {s.peer && up
                ? `cpu ${s.peer.cpu_c}C / mem ${s.peer.mem_pct}% / up ${s.peer.uptime_s}s`
                : "no data"}
            </dd>
          </dl>
        </section>

        {/* ── WIRE ─────────────────────────────────────────── */}
        <Wire flights={s.flights} cut={down} reduce={reduce} />

        {/* ── DEVICE ───────────────────────────────────────── */}
        <section className={styles.endpoint} aria-label="Device">
          <header className={styles.epHead}>
            <span className={styles.epTag} aria-hidden="true">B</span>
            <div className={styles.epId}>
              <h3 className={styles.epName}>DEVICE</h3>
              <p className={styles.epPart}>PI-4B /dev/serial0</p>
            </div>
          </header>
          <p className={styles.epSub}>Slint on linuxkms / device ticks every 1.0s</p>
          <PiScreen
            device={s.device}
            now={s.now}
            phase={s.phase}
            onAction={(id, action) => dispatch({ type: "device_action", id, action })}
          />
          <p className={styles.epFoot}>Panel 800x480. Tap a widget to send ACTION.</p>
        </section>
      </div>

      {/* ── STATS + CONTROLS ───────────────────────────────── */}
      <div className={styles.stats}>
        <dl className={styles.stat}>
          <dt>Frames/s</dt>
          <dd>{fps.toFixed(1)}</dd>
        </dl>
        <dl className={styles.stat}>
          <dt>Frames</dt>
          <dd>{s.stats.frames}</dd>
        </dl>
        <dl className={styles.stat}>
          <dt>Bytes</dt>
          <dd>{s.stats.bytes}</dd>
        </dl>
        <dl className={`${styles.stat} ${s.stats.errors ? styles.statErr : ""}`}>
          <dt>Errors</dt>
          <dd>{s.stats.errors}</dd>
        </dl>
        <dl className={styles.stat}>
          <dt>Uptime</dt>
          <dd>{up ? mmss(s.now - s.upAt) : "--:--"}</dd>
        </dl>
      </div>

      <div className={styles.controls}>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnMain}`}
          onClick={() => dispatch({ type: down ? "connect" : "pull" })}
        >
          {down ? "Reconnect" : "Pull the cable"}
        </button>
        <button
          type="button"
          className={styles.btn}
          aria-pressed={s.corruptNext}
          disabled={!up}
          onClick={() => dispatch({ type: "arm" })}
        >
          {s.corruptNext ? "Bit flip armed" : "Flip a bit"}
        </button>
        <p className={`${styles.retry} ${down ? styles.retryOn : ""}`}>
          {down
            ? s.retryAt !== null
              ? `NO CARRIER. RETRY ${s.retries + 1}/${RETRY_BUDGET} IN ${retryIn}s`
              : "NO CARRIER. RETRY BUDGET SPENT"
            : s.corruptNext
              ? "NEXT HOST FRAME WILL ARRIVE WITH ONE BIT WRONG"
              : "FLIP A BIT TO WATCH THE CRC CATCH IT"}
        </p>
      </div>

      {/* ── LOG + HANDSHAKE + ANATOMY ──────────────────────── */}
      <div className={styles.lower}>
        <FrameLog rows={s.log} />
        <div className={styles.side}>
          <Negotiation phase={s.phase} step={s.hsStep} />
          <Anatomy row={s.last} />
        </div>
      </div>

      <p className={styles.note}>
        Frame layout: LEN u16le / TYPE u8 / SEQ u8 / PAYLOAD / CRC8. At 115200 baud a
        frame crosses in about 1ms; transit is stretched to {reduce ? "140" : "700"}ms so it
        can be seen.
      </p>

      <p className={styles.srOnly} role="status" aria-live="polite">{s.say}</p>
    </figure>
  );
}
