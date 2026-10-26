"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ScrollFrame.module.css";

/* A frame for a fixed-size interface.

   The desk screen is an 800 by 480 panel and its type, hit targets and
   icons are all sized for that. Squashing it into a 320px phone would make
   a thumbnail nobody can press, so it keeps its natural size and the frame
   scrolls sideways instead.

   A scroller nobody knows is a scroller is worse than none: the screen just
   looks cropped. So when, and only when, the content is wider than the
   frame, a hint appears above it and the frame becomes a focusable region a
   keyboard user can scroll. When it fits, none of that is there, and the
   first render (before anything is measured) is the plain fitted layout, so
   the server and client markup agree. */

export default function ScrollFrame({
  width,
  label,
  children,
}: {
  /* the natural width of the content, in px */
  width: number;
  /* what the region is called when it can be scrolled */
  label: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setOverflow(el.scrollWidth - el.clientWidth > 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className={styles.root} data-overflow={overflow ? "" : undefined}>
      {overflow ? (
        <p className={styles.hint}>
          <span aria-hidden="true">←</span> This is wider than your screen.
          Scroll sideways to see all of it <span aria-hidden="true">→</span>
        </p>
      ) : null}
      <div
        ref={ref}
        className={styles.scroller}
        {...(overflow ? { tabIndex: 0, role: "region", "aria-label": label } : {})}
      >
        <div className={styles.inner} style={{ width }}>
          {children}
        </div>
      </div>
    </div>
  );
}
