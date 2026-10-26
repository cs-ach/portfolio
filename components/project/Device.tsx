import type { ReactNode } from "react";
import type { Project } from "@/lib/content";
import styles from "./Device.module.css";

/* The device's stand-in: the interface on a plain dark slab with the
   proportions of the real device's glass, front-facing and still.

   The device itself is a 3D model (DeviceScene), which needs JavaScript,
   WebGL and a lazily loaded three.js. This is what is shown before all
   of that has arrived and drawn, and what stays when any of it is
   missing, so the hero is complete without it: the server sends it, it
   reads without script, and it is laid out in the same box the model will
   take, so the swap does not move anything.

   The figure is laid out at the same virtual resolution the model's
   screen uses and scaled down as a picture would be, so an 800 pixel
   dock stays an 800 pixel dock in proportion instead of reflowing.

   A server component; the figure inside is a client component of its own. */

export type DeviceKind = Project["device"];

export default function Device({
  kind,
  inert,
  children,
}: {
  kind: DeviceKind;
  /* In a list the whole hero is one link, so the figure inside it must not
     take focus or clicks of its own. */
  inert?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`${styles.still} ${styles[kind]}`}>
      <div className={`ui-dark ${styles.glass}`}>
        <div className={styles.screen}>
          <div className={styles.content} inert={inert}>
            <div className={`${styles.surface} ${kind === "ipad" ? styles.surfaceCentre : ""}`}>{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
