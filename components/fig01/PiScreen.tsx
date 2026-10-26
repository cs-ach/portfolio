import { DeviceState, EVENTS, ModuleId, TRACKS } from "./types";
import type { Phase } from "./sim";
import styles from "./TheLink.module.css";

/* The device's 800x480 panel, drawn to scale at 5:3 and sized in container
   units so it stays legible down to a narrow phone. Everything on it comes
   from DeviceState, which only a landed frame can change. Tapping a widget
   sends an ACTION to the host; the repaint arrives as a STATE frame on the
   way back, never from the tap itself. */
export default function PiScreen({
  device,
  now,
  phase,
  onAction,
}: {
  device: DeviceState;
  now: number;
  phase: Phase;
  onAction: (m: ModuleId, action: string) => void;
}) {
  const up = phase === "up";
  const flash = now - device.flashAt < 500 ? device.flash : null;
  const temp = device.units === "C" ? device.tempC : Math.round((device.tempC * 9) / 5 + 32);
  const anyOn = device.enabled.weather || device.enabled.calendar || device.enabled.nowplaying;

  return (
    <div className={styles.screen} role="group" aria-label="Device screen, 800 by 480">
      <div className={styles.sBar}>
        <span>14:32</span>
        <span>TUE 21 OCT</span>
        <span className={up ? styles.sLinkOn : styles.sLinkOff}>{up ? "LINK" : "NO HOST"}</span>
      </div>

      <div className={styles.sBody}>
        {device.enabled.weather && (
          <button
            type="button"
            disabled={!up}
            onClick={() => onAction("weather", "refresh")}
            className={`${styles.widget} ${styles.wWeather} ${flash === "weather" ? styles.wFlash : ""}`}
            aria-label={`Weather, ${temp} degrees ${device.units}. Send a refresh action to the host.`}
          >
            <span className={styles.wTag}>WEATHER 2x2</span>
            <span className={styles.wBig}>
              {temp}&deg;{device.units}
            </span>
            <span className={styles.wSub}>OVERCAST</span>
          </button>
        )}

        {device.enabled.calendar && (
          <button
            type="button"
            disabled={!up}
            onClick={() => onAction("calendar", "next")}
            className={`${styles.widget} ${styles.wCal} ${flash === "calendar" ? styles.wFlash : ""}`}
            aria-label={`Calendar, ${EVENTS[device.event]}. Send a next action to the host.`}
          >
            <span className={styles.wTag}>NEXT 2x1</span>
            <span className={styles.wMid}>{EVENTS[device.event]}</span>
          </button>
        )}

        {device.enabled.nowplaying && (
          <button
            type="button"
            disabled={!up}
            onClick={() => onAction("nowplaying", "advance")}
            className={`${styles.widget} ${styles.wNow} ${flash === "nowplaying" ? styles.wFlash : ""}`}
            aria-label={`Now playing, ${TRACKS[device.track]}. Send an advance action to the host.`}
          >
            <span className={styles.wTag}>PLAYING 4x1</span>
            <span className={styles.wMid}>{TRACKS[device.track]}</span>
          </button>
        )}

        {!anyOn && (
          <p className={styles.sEmpty}>
            {up || phase === "handshake" ? "NO MODULES LOADED" : "NO MODULES"}
          </p>
        )}
      </div>

      {device.authPrompt && (
        <div className={styles.sAuth} role="status">
          <span className={styles.wTag}>AUTHORISE</span>
          <span className={styles.wMid}>{device.authPrompt}</span>
          <span className={styles.wSub}>AWAITING HOST / PKCE</span>
        </div>
      )}

      {!up && (
        <div className={styles.sBanner}>
          {phase === "handshake" ? "NEGOTIATING LINK" : "NO HOST / LINK DOWN"}
        </div>
      )}
    </div>
  );
}
