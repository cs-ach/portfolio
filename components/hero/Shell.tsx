"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./Shell.module.css";

/* The desk-companion shell, rebuilt in HTML at its real 800x480.

   Geometry, radii, type sizes and colours are the ones in
   pi/src/screens/*.slint: the 14px rhythm, the 68px dock of 48px squircles,
   the 30px status bar with its one pill, the 4x2 grid of glass surfaces at
   r_panel 28, and the plugin pages the shell grafts into the same rectangle.
   The icon outlines are the Path commands from icon.slint and from
   plugins/spotify, redrawn as SVG rather than approximated.

   It is a real fragment of the product, so the root carries data-ui and the
   product's own borders, radii and shadows apply inside it.

   One slot is wired to this page instead of to a plugin: the host readout
   prints the pointer and the viewport the mockup is actually sitting in. */

/* ── icons ──────────────────────────────────────────────────
   icon.slint draws every glyph from one path at a 24 viewbox. */

const STROKE: Record<string, string> = {
  home: "M 3.5 10.2 L 12 3.4 L 20.5 10.2 L 20.5 19 A 1.6 1.6 0 0 1 18.9 20.6 L 5.1 20.6 A 1.6 1.6 0 0 1 3.5 19 Z",
  plugin: "M 12 3.2 L 19.8 7.6 L 19.8 16.4 L 12 20.8 L 4.2 16.4 L 4.2 7.6 Z",
  apps: "M 10 3.5 L 19 3.5 A 2 2 0 0 1 21 5.5 L 21 14.5 A 2 2 0 0 1 19 16.5 L 10 16.5 A 2 2 0 0 1 8 14.5 L 8 5.5 A 2 2 0 0 1 10 3.5 Z M 4.5 7.6 L 4.5 18.5 A 2 2 0 0 0 6.5 20.5 L 16.4 20.5",
  gear: "M 12 8.9 A 3.1 3.1 0 0 1 12 15.1 A 3.1 3.1 0 0 1 12 8.9 Z M 10.5 2.6 L 13.5 2.6 L 13.9 5.1 L 15.9 5.9 L 17.9 4.4 L 20 6.5 L 18.5 8.5 L 19.3 10.5 L 21.8 10.9 L 21.8 13.9 L 19.3 14.3 L 18.5 16.3 L 20 18.3 L 17.9 20.4 L 15.9 18.9 L 13.9 19.7 L 13.5 22.2 L 10.5 22.2 L 10.1 19.7 L 8.1 18.9 L 6.1 20.4 L 4 18.3 L 5.5 16.3 L 4.7 14.3 L 2.2 13.9 L 2.2 10.9 L 4.7 10.5 L 5.5 8.5 L 4 6.5 L 6.1 4.4 L 8.1 5.9 L 10.1 5.1 Z",
  back: "M 14.5 5 L 7.5 12 L 14.5 19",
  alert: "M 12 3 A 9 9 0 0 1 12 21 A 9 9 0 0 1 12 3 Z M 12 7.5 L 12 13 M 12 16.6 L 12 16.9",
  wave: "M 2.5 12 L 5.5 12 L 8 5 L 11.5 19 L 14.5 10 L 16.5 15 L 21.5 15",
  chat: "M 20.5 15 A 2.5 2.5 0 0 1 18 17.5 L 8.5 17.5 L 4 21 L 4 5.5 A 2.5 2.5 0 0 1 6.5 3 L 17.5 3 A 2.5 2.5 0 0 1 20 5.5 Z",
  /* plugins/spotify — the tile and page art */
  note: "M 9 18 L 9 6 L 19 4 L 19 16 M 6.5 15.5 A 2.5 2.5 0 0 1 6.5 20.5 A 2.5 2.5 0 0 1 6.5 15.5 Z M 16.5 13.5 A 2.5 2.5 0 0 1 16.5 18.5 A 2.5 2.5 0 0 1 16.5 13.5 Z",
};

const FILL: Record<string, string> = {
  spotify:
    "M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z",
  play: "M 8 4.8 L 19 12 L 8 19.2 Z",
  pause: "M 6 4.5 L 10 4.5 L 10 19.5 L 6 19.5 Z M 14 4.5 L 18 4.5 L 18 19.5 L 14 19.5 Z",
  prev: "M 17 5 L 17 19 L 8 12 Z M 5 5 L 7.4 5 L 7.4 19 L 5 19 Z",
  next: "M 7 5 L 16 12 L 7 19 Z M 16.6 5 L 19 5 L 19 19 L 16.6 19 Z",
};

function Glyph({ kind, stroke = 1.8 }: { kind: string; stroke?: number }) {
  const filled = FILL[kind];
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d={filled ?? STROKE[kind] ?? ""}
        fill={filled ? "currentColor" : "none"}
        stroke={filled ? "none" : "currentColor"}
        strokeWidth={stroke}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ── pages ──────────────────────────────────────────────────
   main.slint routes @home, a plugin id, @switcher and @settings into the one
   content rectangle. */

type Page = "@home" | "spotify" | "beacon" | "echo" | "@switcher" | "@settings";

/* dock_from() in pi/src/main.rs: @home, then up to DOCK_PLUGINS = 3 plugins.
   A plugin that ships icon.png gets an art tile; the rest get the hexagon. */
const DOCK: { id: Page; glyph: string; art?: boolean }[] = [
  { id: "@home", glyph: "home" },
  { id: "spotify", glyph: "plugin", art: true },
  { id: "beacon", glyph: "plugin" },
  { id: "echo", glyph: "plugin" },
];

const TITLES: Record<Page, string> = {
  "@home": "",
  spotify: "Spotify",
  beacon: "Beacon",
  echo: "Echo",
  "@switcher": "Apps",
  "@settings": "Settings",
};

/* The real AppEntry fills in pi/examples/shell.rs: green, blue, indigo. */
type App = { id: Page; name: string; glyph: string; fill: string; fault?: boolean };

const APPS: App[] = [
  { id: "spotify", name: "Spotify", glyph: "plugin", fill: "#30d158" },
  { id: "beacon", name: "Beacon", glyph: "plugin", fill: "#0a84ff" },
  { id: "echo", name: "Echo", glyph: "plugin", fill: "#5e5ce6", fault: true },
];

/* SettingsPlugin in settings.slint: a name, a status line that turns caution
   when the plugin is not running, and a Connect button when it can authorize. */
type SettingsPlugin = { name: string; status: string; connect?: boolean; warn?: boolean };

const SETTINGS_PLUGINS: SettingsPlugin[] = [
  { name: "Spotify", status: "Running · 1 widget", connect: true },
  { name: "Beacon", status: "Running · host tick 2s" },
  { name: "Echo", status: "No data for 4 min", warn: true },
];

/* Tokens.bg_tide / bg_violet / bg_ember / bg_mono, the four grounds. */
const GROUNDS = [
  "linear-gradient(160deg, #0c1328 0%, #080a14 50%, #0a2033 100%)",
  "linear-gradient(160deg, #19102c 0%, #0a0912 50%, #241331 100%)",
  "linear-gradient(160deg, #141022 0%, #0b0a14 52%, #1a0e1c 100%)",
  "linear-gradient(160deg, #15171c 0%, #0b0d11 100%)",
];

const TOTAL_MS = 292_000;

function clockOf(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function Shell() {
  const ref = useRef<HTMLDivElement>(null);
  const [clock, setClock] = useState("--:--");
  const [date, setDate] = useState("Desk Companion");
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const [page, setPage] = useState<Page>("@home");
  const [elapsed, setElapsed] = useState(134_000);
  const [playing, setPlaying] = useState(true);
  const [beats, setBeats] = useState(1284);
  const [dockRight, setDockRight] = useState(false);
  const [ground, setGround] = useState(0);

  useEffect(() => {
    /* The device's own clock timer, and the date the host puts in the status
       lead (today() in pi/src/main.rs). Both are filled in on mount so the
       server and the first client render agree. */
    const tick = () => {
      const now = new Date();
      setClock(
        new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(now)
      );
      setDate(
        new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(now)
      );
    };
    tick();
    const t = window.setInterval(tick, 15_000);

    /* nowplaying.slint drifts its progress forward once a second; beacon's
       manifest ticks every two. */
    const drift = window.setInterval(() => {
      setElapsed((ms) => (ms + 1000) % TOTAL_MS);
    }, 1000);
    const beat = window.setInterval(() => setBeats((n) => n + 1), 2000);

    const onSize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    onSize();
    window.addEventListener("resize", onSize);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const onPointer = (e: PointerEvent) => {
      setPointer({ x: Math.round(e.clientX), y: Math.round(e.clientY) });
      if (reduce || !ref.current) return;
      /* a slight tip toward the pointer: the screen is an object in a room,
         not a flat picture of one */
      const rx = (e.clientY / window.innerHeight - 0.5) * -6;
      const ry = (e.clientX / window.innerWidth - 0.5) * 10;
      ref.current.style.setProperty("--rx", `${rx.toFixed(2)}deg`);
      ref.current.style.setProperty("--ry", `${ry.toFixed(2)}deg`);
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    return () => {
      window.clearInterval(t);
      window.clearInterval(drift);
      window.clearInterval(beat);
      window.removeEventListener("resize", onSize);
      window.removeEventListener("pointermove", onPointer);
    };
  }, []);

  const back = page !== "@home";
  const progress = `${((elapsed / TOTAL_MS) * 100).toFixed(2)}%`;

  return (
    <div className={styles.stage}>
      <div className={styles.tilt} ref={ref}>
        <div
          className={styles.screen}
          data-ui
          data-dock={dockRight ? "right" : "left"}
          role="group"
          aria-label="The desk-companion shell at 800 by 480: a dock of plugins, a status bar carrying the host link and the clock, and a grid of plugin widgets."
        >
          <div className={styles.ground} style={{ background: GROUNDS[ground] }} />

          {/* dock — 68px rail of 48px squircles on the 14px margin */}
          <div className={`${styles.menu} ${styles.dock}`}>
            {DOCK.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`${styles.slotBtn} ${page === item.id ? styles.slotOn : ""}`}
                onClick={() => setPage(item.id)}
                aria-label={item.id === "@home" ? "Home" : `${TITLES[item.id]} plugin`}
              >
                {item.art ? (
                  <span className={styles.slotArt}>
                    <Glyph kind="spotify" />
                  </span>
                ) : (
                  <Glyph kind={item.glyph} />
                )}
              </button>
            ))}

            <span className={styles.dockRule} aria-hidden="true" />

            <button
              type="button"
              className={`${styles.slotBtn} ${styles.dockApps} ${page === "@switcher" ? styles.slotOn : ""}`}
              onClick={() => setPage(page === "@switcher" ? "@home" : "@switcher")}
              aria-label="App switcher"
            >
              <Glyph kind="apps" />
            </button>
            <button
              type="button"
              className={`${styles.slotBtn} ${styles.dockGear} ${page === "@settings" ? styles.slotOn : ""}`}
              onClick={() => setPage(page === "@settings" ? "@home" : "@settings")}
              aria-label="Settings"
            >
              <Glyph kind="gear" stroke={1.6} />
            </button>
          </div>

          {/* status bar — one pill, same place on every page */}
          <div className={styles.status}>
            {back ? (
              <button type="button" className={styles.back} onClick={() => setPage("@home")} aria-label="Back">
                <Glyph kind="back" stroke={2.2} />
              </button>
            ) : null}
            <span className={`${styles.lead} ${back ? styles.leadBack : ""}`}>
              {back ? TITLES[page] : date}
            </span>
            <span className={styles.pill}>
              <span className={styles.dot} aria-hidden="true" />
              <span className={styles.clock}>{clock}</span>
            </span>
          </div>

          <div className={styles.content}>
            {page === "@home" ? (
              <div className={styles.grid}>
                {/* An empty slot, which is a real state this shell has and
                    the honest thing to draw here.

                    There are three plugins in the tree: spotify, beacon and
                    echo. Only spotify draws a substantial widget; the other
                    two are host-side fixtures. An earlier version of this
                    mockup filled this slot with a weather forecast, and there
                    is no weather plugin. A recreation that invents a feature
                    is worse than one with a gap in it, because anyone who
                    opens the repository can see the gap was invented. */}
                <div
                  className={`${styles.surface} ${styles.cell} ${styles.empty}`}
                  style={{ gridColumn: "1 / span 2", gridRow: "1" }}
                >
                  <div className={styles.head}>
                    <span className={styles.title}>Slot 1</span>
                    <span className={styles.meta}>free</span>
                  </div>
                  <div className={styles.body}>
                    <p className={styles.headline}>No plugin loaded</p>
                    <p className={styles.detail}>
                      Drop a manifest and two files into plugins/ to fill it
                    </p>
                  </div>
                </div>

                {/* Spotify — the plugin's own 2x1 widget, not a generic slot */}
                <button
                  type="button"
                  className={`${styles.surface} ${styles.np}`}
                  style={{ gridColumn: "3 / span 2", gridRow: "1" }}
                  onClick={() => setPage("spotify")}
                  aria-label="Open Spotify"
                >
                  <span className={styles.npArt}>
                    <Glyph kind="note" stroke={1.7} />
                  </span>
                  <span className={styles.npText}>
                    <span className={styles.kicker}>Now playing</span>
                    <span className={styles.npTitle}>Blurred</span>
                    <span className={styles.npSub}>Kiasmos &middot; Blurred</span>
                    <span className={styles.track}>
                      <span className={styles.fill} style={{ width: progress }} />
                    </span>
                  </span>
                </button>

                {/* Beacon — 1x1, so under 200px: the compact form drops the
                    value and runs headline 17 / detail 13 */}
                <div className={`${styles.surface} ${styles.cell} ${styles.compact}`} style={{ gridColumn: "1", gridRow: "2" }}>
                  <div className={styles.head}>
                    <span className={styles.title}>Beacon</span>
                  </div>
                  <div className={styles.body}>
                    <p className={styles.headline}>Beat {beats}</p>
                    <p className={styles.detail}>every 2s</p>
                  </div>
                </div>

                {/* Echo — 1x1 Stale: the caution chip, and the reading dimmed */}
                <div className={`${styles.surface} ${styles.cell} ${styles.compact} ${styles.dim}`} style={{ gridColumn: "2", gridRow: "2" }}>
                  <div className={styles.head}>
                    <span className={styles.title}>Echo</span>
                    <span className={styles.stale}>Stale</span>
                  </div>
                  <div className={styles.body}>
                    <p className={styles.headline}>beat 1283</p>
                    <p className={styles.detail}>4 min ago</p>
                  </div>
                </div>

                {/* Host readout — the one slot wired to this page */}
                <div className={`${styles.surface} ${styles.cell}`} style={{ gridColumn: "3 / span 2", gridRow: "2" }}>
                  <div className={styles.head}>
                    <span className={styles.title}>Host readout</span>
                    <span className={styles.meta}>live</span>
                  </div>
                  <div className={styles.body}>
                    <p className={styles.headline}>
                      {pointer.x} <span className={styles.sep}>&middot;</span> {pointer.y}
                    </p>
                    <p className={styles.detail}>
                      pointer, in a {viewport.w}&times;{viewport.h} viewport
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Spotify's page: the widget's full form — 190px art, a 36px
                headline, the countdown, and the three controls. */}
            {page === "spotify" ? (
              <div className={styles.page}>
                <div className={styles.pgArt}>
                  <Glyph kind="spotify" />
                </div>
                <div className={styles.pgCol}>
                  <p className={styles.pgKicker}>Now playing</p>
                  <p className={styles.pgTitle}>Blurred</p>
                  <p className={styles.pgSub}>Kiasmos</p>
                  <div className={styles.pgTrack}>
                    <div className={styles.fill} style={{ width: progress }} />
                  </div>
                  <div className={styles.pgTimes}>
                    <span>{clockOf(elapsed)}</span>
                    <span>&minus;{clockOf(TOTAL_MS - elapsed)}</span>
                  </div>
                  <div className={styles.pgControls}>
                    <button type="button" className={styles.ctl} aria-label="Previous">
                      <Glyph kind="prev" />
                    </button>
                    <button
                      type="button"
                      className={`${styles.ctl} ${styles.ctlPrimary}`}
                      onClick={() => setPlaying((p) => !p)}
                      aria-label={playing ? "Pause" : "Play"}
                    >
                      <Glyph kind={playing ? "pause" : "play"} />
                    </button>
                    <button type="button" className={styles.ctl} aria-label="Next">
                      <Glyph kind="next" />
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Beacon and Echo are host-side fixtures: their app.slint draws
                the name and nothing else, and the shell still gives them a
                page. Shown as it is rather than dressed up. */}
            {page === "beacon" || page === "echo" ? (
              <div className={styles.stub}>{TITLES[page]}</div>
            ) : null}

            {page === "@switcher" ? (
              <div className={styles.switcher}>
                {APPS.map((a) => (
                  <button key={a.id} type="button" className={styles.tile} onClick={() => setPage(a.id)}>
                    <span className={styles.tileWrap}>
                      <span className={styles.tileArt} style={{ background: a.fill }}>
                        <Glyph kind={a.glyph} stroke={1.7} />
                      </span>
                      {a.fault ? <span className={styles.tileBadge}>!</span> : null}
                    </span>
                    <span className={styles.tileLabel}>{a.name}</span>
                  </button>
                ))}
              </div>
            ) : null}

            {page === "@settings" ? (
              <div className={styles.settings}>
                <div className={`${styles.surface} ${styles.group} ${styles.groupWide}`}>
                  <p className={styles.groupHead}>Appearance</p>
                  <div className={styles.pad14} />
                  <div className={styles.row}>
                    <div className={styles.rowText}>
                      <p className={styles.rowLabel}>Dock position</p>
                    </div>
                    <div className={styles.seg}>
                      <button
                        type="button"
                        className={`${styles.segBtn} ${dockRight ? "" : styles.segOn}`}
                        onClick={() => setDockRight(false)}
                      >
                        Left
                      </button>
                      <button
                        type="button"
                        className={`${styles.segBtn} ${dockRight ? styles.segOn : ""}`}
                        onClick={() => setDockRight(true)}
                      >
                        Right
                      </button>
                    </div>
                  </div>
                  <div className={styles.hr} />
                  <div className={`${styles.row} ${styles.rowTall}`}>
                    <div className={styles.rowText}>
                      <p className={styles.rowLabel}>Background</p>
                    </div>
                    <div className={styles.swatches}>
                      {GROUNDS.map((g, i) => (
                        <button
                          key={g}
                          type="button"
                          className={`${styles.swatch} ${ground === i ? styles.swatchOn : ""}`}
                          style={{ background: g }}
                          onClick={() => setGround(i)}
                          aria-label={["Tide", "Violet", "Ember", "Mono"][i]}
                        />
                      ))}
                    </div>
                  </div>
                  <div className={styles.grow} />
                  {/* device_line, the string main.rs hands the settings page */}
                  <p className={styles.deviceLine}>
                    Device 0.4.1 &middot; protocol v3 &middot; dc-0f3a91
                  </p>
                </div>

                <div className={`${styles.surface} ${styles.group} ${styles.groupSide}`}>
                  <p className={styles.groupHead}>Plugins</p>
                  <div className={styles.pad10} />
                  {SETTINGS_PLUGINS.map((p) => (
                    <div key={p.name} className={styles.plugRow}>
                      <span className={styles.plugArt}>
                        <Glyph kind="plugin" />
                      </span>
                      <span className={styles.plugText}>
                        <span className={styles.plugName}>{p.name}</span>
                        <span className={`${styles.plugStatus} ${p.warn ? styles.plugWarn : ""}`}>
                          {p.status}
                        </span>
                      </span>
                      {p.connect ? (
                        <button type="button" className={styles.connect}>Connect</button>
                      ) : null}
                    </div>
                  ))}
                  <div className={styles.grow} />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
