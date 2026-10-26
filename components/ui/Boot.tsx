"use client";

import { useEffect } from "react";

/* Two jobs, both of which have to happen before anything else moves.

   1. Mark the document as scripted. Every opacity-based reveal in
      globals.css hangs off `html[data-js]`, so a browser without
      JavaScript renders the whole page visible rather than blank. The
      flag is set from an inline script in the body, before paint; this
      effect is only the belt to that script's braces.

   2. Run the single IntersectionObserver that drives every reveal on
      the page. One observer for the document, not one per component:
      a portfolio with sixty revealed elements should not hold sixty
      observers alive.

   Elements opt in with `data-reveal`. They are shown once and then
   unobserved — a reveal that re-hides when you scroll back up reads as
   a bug, not as choreography. */
export default function Boot() {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.js = "1";

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    const showAll = () => {
      document
        .querySelectorAll<HTMLElement>("[data-reveal]")
        .forEach((el) => (el.dataset.shown = "true"));
    };

    if (reduced.matches) {
      showAll();
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.shown = "true";
          io.unobserve(entry.target);
        }
      },
      /* Fire a little before the element reaches the fold, so the
         motion has finished by the time it is properly in view. */
      { rootMargin: "0px 0px -12% 0px", threshold: 0.01 },
    );

    const observeAll = () => {
      document
        .querySelectorAll<HTMLElement>("[data-reveal]:not([data-shown])")
        .forEach((el) => io.observe(el));
    };

    observeAll();

    /* Client-rendered figures and route changes add nodes after mount.
       Only additions matter, and they are batched to one scan a frame:
       the ticking clocks and live figures mutate the DOM every second,
       and re-querying the whole document for each of those was waste. */
    let queued = 0;
    const mo = new MutationObserver((records) => {
      if (queued || !records.some((r) => r.addedNodes.length)) return;
      queued = requestAnimationFrame(() => {
        queued = 0;
        observeAll();
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });

    const onReducedChange = () => {
      if (reduced.matches) {
        io.disconnect();
        mo.disconnect();
        showAll();
      }
    };
    reduced.addEventListener("change", onReducedChange);

    return () => {
      cancelAnimationFrame(queued);
      io.disconnect();
      mo.disconnect();
      reduced.removeEventListener("change", onReducedChange);
    };
  }, []);

  return null;
}
