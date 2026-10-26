import { memo } from "react";
import { crc8, hex } from "./protocol";
import { BAUD, LogRow, Phase, VERSION } from "./sim";
import styles from "./TheLink.module.css";

/* mm:ss.t on the link clock. The clock only runs while the figure is
   visible, so these stamps are link time, not wall time. */
export function stamp(ms: number): string {
  const t = Math.floor(ms / 100);
  const m = Math.floor(t / 600);
  const s = Math.floor((t % 600) / 10);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${t % 10}`;
}

/* Hex pairs, exactly as they would sit in the receive buffer. `flip` marks
   the byte the injected noise landed on. */
export function FrameBytes({ bytes, flip, max }: { bytes: number[]; flip?: number; max?: number }) {
  const shown = max && bytes.length > max ? bytes.slice(0, max) : bytes;
  return (
    <>
      {shown.map((b, i) => (
        <span key={i} className={i === flip ? styles.flip : undefined}>
          {hex(b)}
        </span>
      ))}
      {shown.length < bytes.length && <span className={styles.more}>+{bytes.length - shown.length}</span>}
    </>
  );
}

const Row = memo(function Row({ row }: { row: LogRow }) {
  if (row.kind === "sys") {
    return (
      <li className={`${styles.row} ${row.state === "lost" ? styles.rowBad : styles.rowSys}`}>
        <span className={styles.rTime}>{stamp(row.t)}</span>
        <span className={styles.rSys}>{row.summary}</span>
      </li>
    );
  }

  const status =
    row.state === "flying" ? "TX"
    : row.state === "ok" ? "OK"
    : row.state === "crc" ? "CRC FAIL"
    : "LOST";

  return (
    <li
      className={`${styles.row} ${row.state === "flying" ? styles.rowLive : ""} ${
        row.state === "crc" || row.state === "lost" ? styles.rowBad : ""
      }`}
    >
      <span className={styles.rTime}>{stamp(row.t)}</span>
      <span
        className={styles.rDir}
        role="img"
        aria-label={row.dir === "to_pi" ? "host to device" : "device to host"}
      >
        {row.dir === "to_pi" ? "→" : "←"}
      </span>
      <span className={styles.rName}>
        {row.name}
        {row.retx && <em className={styles.retx}>RETX</em>}
      </span>
      <span className={styles.rSum}>{row.summary}</span>
      <span className={styles.rStat}>
        {row.bytes.length}B {status}
      </span>
      <span className={styles.rHex}>
        <FrameBytes bytes={row.bytes} flip={row.flip} max={14} />
      </span>
    </li>
  );
});

/* Newest on top, fixed height, overflow clipped: rows arriving never move
   anything below the figure. It is deliberately not role="log" — that would
   announce every frame to a screen reader. State changes go through the
   figure's single polite status line instead. */
export function FrameLog({ rows }: { rows: LogRow[] }) {
  return (
    <section className={styles.logWrap} aria-label="Frame log">
      <header className={styles.panelHead}>
        <h3 className={styles.panelTitle}>Frame log</h3>
        <span className={styles.panelNote}>→ host to pi · ← pi to host</span>
      </header>
      <ol className={styles.log}>
        {rows.map((r) => (
          <Row key={r.id} row={r} />
        ))}
      </ol>
    </section>
  );
}

const STEPS = [
  { side: "HOST", arrow: "→", text: `HELLO v${VERSION}` },
  { side: "PI", arrow: "←", text: `ACK v${VERSION}` },
  { side: "HOST", arrow: "→", text: `BAUD ${BAUD}` },
  { side: "PI", arrow: "←", text: `OK ${BAUD}` },
];

/* The handshake, step by step. Each step flips when its frame has actually
   landed, so this list is a readout of the simulation, not a timeline. */
export function Negotiation({ phase, step }: { phase: Phase; step: number }) {
  return (
    <section className={styles.neg} aria-label="Handshake">
      <header className={styles.panelHead}>
        <h3 className={styles.panelTitle}>Handshake</h3>
        <span className={styles.panelNote}>
          {phase === "up" ? "complete" : phase === "down" ? "no carrier" : "in progress"}
        </span>
      </header>
      <ol className={styles.steps}>
        {STEPS.map((s, i) => {
          const done = phase !== "down" && i < step;
          const active = phase === "handshake" && i === step;
          return (
            <li
              key={i}
              className={`${styles.step} ${done ? styles.stepDone : ""} ${active ? styles.stepActive : ""}`}
            >
              <span className={styles.stepN}>{String(i + 1).padStart(2, "0")}</span>
              <span className={styles.stepSide}>{s.side}</span>
              <span className={styles.stepArrow} aria-hidden="true">{s.arrow}</span>
              <span className={styles.stepText}>{s.text}</span>
              <span className={styles.stepState}>{done ? "OK" : active ? "WAIT" : "--"}</span>
            </li>
          );
        })}
        <li className={`${styles.step} ${styles.stepFinal} ${phase === "up" ? styles.stepDone : ""}`}>
          <span className={styles.stepN}>05</span>
          <span className={styles.stepSide}>LINK</span>
          <span className={styles.stepArrow} aria-hidden="true">=</span>
          <span className={styles.stepText}>v{VERSION} {BAUD} 8N1</span>
          <span className={styles.stepState}>{phase === "up" ? "UP" : "--"}</span>
        </li>
      </ol>
    </section>
  );
}

/* The newest frame, taken apart. The CRC is recomputed here from the bytes
   on display, so a corrupted frame shows a real mismatch and not a flag. */
export function Anatomy({ row }: { row: LogRow | null }) {
  if (!row) {
    return (
      <section className={styles.anat} aria-label="Frame anatomy">
        <header className={styles.panelHead}>
          <h3 className={styles.panelTitle}>Frame anatomy</h3>
          <span className={styles.panelNote}>idle</span>
        </header>
        <p className={styles.anatEmpty}>No frame on the wire yet.</p>
      </section>
    );
  }

  const b = row.bytes;
  const body = b.slice(0, -1);
  const got = b[b.length - 1];
  const want = crc8(body);
  const good = want === got;
  const payload = b.slice(4, -1);
  const len = b[0] | (b[1] << 8);

  return (
    <section className={styles.anat} aria-label="Frame anatomy">
      <header className={styles.panelHead}>
        <h3 className={styles.panelTitle}>Frame anatomy</h3>
        <span className={styles.panelNote}>{row.name} · seq {row.seq}</span>
      </header>

      <div className={styles.segs}>
        <div className={styles.seg}>
          <span className={styles.segK}>LEN u16</span>
          <span className={styles.segV}><FrameBytes bytes={b.slice(0, 2)} /></span>
          <span className={styles.segD}>{len}</span>
        </div>
        <div className={styles.seg}>
          <span className={styles.segK}>TYPE u8</span>
          <span className={styles.segV}><FrameBytes bytes={[b[2]]} /></span>
          <span className={styles.segD}>{row.name}</span>
        </div>
        <div className={styles.seg}>
          <span className={styles.segK}>SEQ u8</span>
          <span className={styles.segV}><FrameBytes bytes={[b[3]]} /></span>
          <span className={styles.segD}>{b[3]}</span>
        </div>
        <div className={`${styles.seg} ${styles.segWide}`}>
          <span className={styles.segK}>PAYLOAD</span>
          <span className={styles.segV}>
            <FrameBytes bytes={payload} flip={row.flip !== undefined ? row.flip - 4 : undefined} />
          </span>
          <span className={styles.segD}>{payload.length}B</span>
        </div>
        <div className={styles.seg}>
          <span className={styles.segK}>CRC8</span>
          <span className={styles.segV}><FrameBytes bytes={[got]} /></span>
          <span className={styles.segD}>{good ? "match" : "MISMATCH"}</span>
        </div>
      </div>

      <p className={`${styles.crcLine} ${good ? "" : styles.crcBad}`}>
        {good
          ? `crc8 over ${body.length} bytes = ${hex(want)}, frame accepted`
          : `crc8 over ${body.length} bytes = ${hex(want)}, wire says ${hex(got)}, frame dropped`}
      </p>
    </section>
  );
}
