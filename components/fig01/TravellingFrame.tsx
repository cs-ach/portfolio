"use client";

import { motion } from "motion/react";
import { FrameBytes } from "./FrameLog";
import type { Flight } from "./sim";
import styles from "./TheLink.module.css";

/* One frame on one lane. The sim decides when it lands; this only draws the
   trip, linearly, because a wire has no easing. It is its own component so
   each in-flight frame owns its own animation and unmounts the moment the
   sim lands it. `travel` is a pixel distance measured from the rail, since
   the block animates transform only. */
export default function TravellingFrame({
  flight,
  travel,
  vertical,
}: {
  flight: Flight;
  travel: number;
  vertical: boolean;
}) {
  const toPi = flight.dir === "to_pi";
  const from = toPi ? 0 : travel;
  const to = toPi ? travel : 0;
  const axis = vertical ? "y" : "x";

  return (
    <motion.div
      className={styles.chip}
      initial={{ [axis]: from }}
      animate={{ [axis]: to }}
      transition={{ duration: flight.total / 1000, ease: "linear" }}
      style={{ willChange: "transform" }}
      aria-hidden="true"
    >
      <b className={styles.chipName}>{flight.name}</b>
      <span className={styles.chipBytes}>
        <FrameBytes bytes={flight.bytes} flip={flight.flip} max={4} />
      </span>
    </motion.div>
  );
}
