"use client";

import { useState } from "react";
import styles from "./figures.module.css";

type State = "pending" | "settled" | "declined";

/* neobank's request flow, rebuilt in HTML. The point of the figure is that the
   sender never moves money: the claim sits pending until the recipient acts,
   and the irreversible step belongs to them. */
export default function LedgerFig() {
  const [state, setState] = useState<State>("pending");

  return (
    <div className={styles.fig} data-ui>
      <div className={styles.figBar}>
        <span className={styles.figName}>Request</span>
        <span className={styles.figMeta}>recipient's view</span>
      </div>

      <div className={styles.phone}>
        <div className={styles.card}>
          <p className={styles.cardWho}>Nadia asks you for</p>
          <p className={styles.cardAmount}>
            RM <span className={styles.nums}>48.00</span>
          </p>
          <p className={styles.cardNote}>Dinner, Thursday</p>

          <p className={`${styles.badge} ${styles[state]}`}>
            {state === "pending" ? "Pending your decision" : null}
            {state === "settled" ? "Settled · signed with your key" : null}
            {state === "declined" ? "Declined · nothing moved" : null}
          </p>

          {state === "pending" ? (
            <div className={styles.cardActions}>
              <button type="button" className={styles.figBtn} onClick={() => setState("settled")}>
                Settle
              </button>
              <button type="button" className={styles.figBtnGhost} onClick={() => setState("declined")}>
                Decline
              </button>
            </div>
          ) : (
            <button type="button" className={styles.figBtnGhost} onClick={() => setState("pending")}>
              Reset
            </button>
          )}
        </div>
      </div>

      <p className={styles.verdict}>
        The request is a claim. Until you settle it, no money has moved and
        nothing needs reversing; declining costs the sender a decline, not a
        refund.
      </p>
    </div>
  );
}
