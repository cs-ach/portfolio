"use client";

import { useEffect, useState } from "react";
import type { Experiment } from "./experiments";
import styles from "./LabRail.module.css";

/* The sticky index down the left of the lab, desktop only.

   It answers "where am I?" on a page of four tall benches. It is a nav of
   plain in-page links, so it works with no script; the script only adds the
   highlight. Below 1100px it is not rendered visually at all: the list in
   the page header already does that job there, and a rail that eats a
   fifth of a phone is a cost with nothing in return.

   Which bench is "current" is decided by a thin band across the upper part
   of the viewport. The benches are contiguous, so exactly one of them is
   under the band at any moment. Using the whole viewport instead would have
   two benches "visible" most of the time and the highlight would flicker
   between them. The band is observed through IntersectionObserver rather
   than a scroll listener so scrolling itself does no work.

   The parent must be position: relative and as tall as the benches: the rail
   stretches to its full height and its card sticks inside that. */

export default function LabRail({ items }: { items: Pick<Experiment, "id" | "n" | "name">[] }) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const els = items
      .map((it) => document.getElementById(it.id))
      .filter((el): el is HTMLElement => el !== null);
    if (!els.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setActive(e.target.id);
          } else if (e.target === els[0] && e.boundingClientRect.top > 0) {
            /* Scrolled back above the first bench: nothing is current. */
            setActive(null);
          }
        }
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items]);

  return (
    <div className={styles.track}>
      <nav className={styles.card} aria-label="Experiments">
        <p className={styles.head}>Experiments</p>
        <ol className={styles.list}>
          {items.map((it) => (
            <li key={it.id}>
              <a
                href={`#${it.id}`}
                className={`act ${styles.link}`}
                aria-current={active === it.id ? "location" : undefined}
              >
                <span className={styles.n}>{it.n}</span>
                <span className={styles.name}>{it.name}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}
