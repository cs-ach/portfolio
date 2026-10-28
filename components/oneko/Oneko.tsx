"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CELLS, type PoseKey } from "./poses";
import styles from "./Oneko.module.css";

/* The cat.

   A pixel cat that comes out from behind the portrait once the landing
   page's opening has settled, then chases the pointer around the
   window, gets bored when it catches it, washes itself, and eventually
   falls asleep.
   The behaviour is oneko's (the X11 toy, by way of adryd325/oneko.js):
   a fixed logic tick rather than a per-frame integration, a short
   stopping distance so the cat sits beside the pointer instead of on
   it, and idle animations that only start after it has been still a
   while. The drawings are ours (poses.ts) and so is everything below.

   Three things make this one different from the toy.

   It is the real sprite sheet. poses.ts maps every pose name to a
   [column, row] cell of oneko.gif, and a pose change is one
   background-position — no DOM churn at all, ten times a second.

   It needs no contrast treatment. The sprite carries its own outline,
   so it reads on the light page and on the dark bands (project hero
   stages, the case-study showcase, the shell) alike, and is drawn
   as-is everywhere.

   It waits to be let in. The introduction is the first thing anyone
   sees and a cat scurrying across it would be noise, so nothing exists
   until the loader has zoomed in and handed the page over — and on the
   landing page, not even then: the portrait is still crossing the
   screen, and the cat is behind it. It comes out when that move has
   settled, which is to say once the page has been scrolled down (Hero
   announces it; see "when to appear"). Anywhere else there is no
   portrait to come out from and it walks in from the right edge, as
   before.

   One rAF loop drives all of it, with a 10Hz behaviour accumulator
   inside it rather than a timer per behaviour, which is cheaper. */

/* ── the clocks ──────────────────────────────────────────────────── */

/* Behaviour runs at 10 frames a second, the sprite's own frame rate.
   Not a smoothed per-frame integration: the chunky step is half of why
   the thing reads as a sprite from 1989 rather than as a div with a
   spring on it. */
const TICK_MS = 100;

/* Pixels per tick, so 100px/s. Fast enough to keep up with an ordinary
   pointer sweep, slow enough that it visibly falls behind a fast one,
   which is the whole joke. */
const SPEED = 10;

/* How close is close enough. Below this the cat stops and starts
   getting bored; it has to be bigger than SPEED or the cat jitters
   either side of the pointer forever. */
const CATCH_DISTANCE = 42;

/* Ticks of stillness before each idle behaviour. Alert is the beat just
   after it stops — ears up, still watching. Then it settles, then it
   washes, then it gives up and sleeps. */
const ALERT_TICKS = 4;
const SCRATCH_AFTER = 70; /* 7s */
const SLEEP_AFTER = 170; /* 17s */

/* ── the sheet ───────────────────────────────────────────────────── */

/* oneko.gif, a grid of 32x32 cells. The URL and the cell size are a
   rendering concern and live here rather than in poses.ts, which owns
   only the mapping from a pose name to its cell; the same two numbers
   are in the stylesheet, which sizes the box and loads the image. */
const CELL = 32;

/* ── poses ───────────────────────────────────────────────────────── */

/* The eight compass directions, as (pose family, mirrored) pairs,
   indexed by a 45-degree bucket of the heading. poses.ts draws east
   only and expects west to be that mirrored, so half of these are the
   same family with the flag set. Index 0 is east and the buckets run
   clockwise on screen (y grows downwards). */
const HEADINGS: ReadonlyArray<readonly [string, boolean]> = [
  ["e", false], /* east */
  ["se", false],
  ["s", false],
  ["se", true], /* south-west */
  ["e", true], /* west */
  ["ne", true], /* north-west */
  ["n", false],
  ["ne", false],
];

/* ── the component ───────────────────────────────────────────────── */

export default function Oneko() {
  /* Null on the server and on the first client render, unconditionally,
     so there is nothing to mismatch. Everything this thing depends on —
     a pointer, a motion preference, whether the loader has finished —
     is knowable only in the browser, so the honest server answer is
     "no cat" and the client adds one afterwards if it is wanted. */
  const [spawned, setSpawned] = useState(false);
  const el = useRef<HTMLDivElement | null>(null);
  /* The portrait it is to come out from, if it is coming out from one.
     Null means the plain walk-in from the right edge. */
  const den = useRef<HTMLElement | null>(null);

  /* ── when to appear ────────────────────────────────────────────── */
  useEffect(() => {
    /* Pure decoration that moves constantly in the corner of the eye is
       exactly what the reduced-motion preference is for, and there is
       no reduced version of a cat that chases you. It simply does not
       come. */
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    /* And nothing to chase without a pointer: on a touch screen the cat
       would walk in and then sit in the corner for the whole visit. */
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    let armed = true;

    const portrait = () =>
      document.querySelector<HTMLElement>("[data-portrait]");

    /* On screen enough to come out from: a portrait scrolled away is a
       door into nowhere, and the cat would walk in from a point the
       reader cannot see. */
    const visible = (node: HTMLElement) => {
      const box = node.getBoundingClientRect();

      return (
        box.width > 0 &&
        box.bottom > 0 &&
        box.top < window.innerHeight
      );
    };

    const spawn = () => {
      if (!armed) return;
      armed = false;

      const from = portrait();

      den.current = from && visible(from) ? from : null;

      setSpawned(true);
    };

    /* The landing page's opening has settled (Hero), as a flag for a cat
       that mounts after the moment and an event for one that mounts
       before it. Any other page has no portrait and nothing to wait
       for. */
    const letIn = () => {
      if (!portrait()) {
        spawn();
        return;
      }

      if (document.documentElement.dataset.heroSettled !== undefined) {
        spawn();
        return;
      }

      window.addEventListener("hero:settled", spawn, { once: true });
    };

    /* The loader raises `data-loading` on <html> for the length of the
       sequence and clears it in the same effect that dispatches
       `preloader:done`. Both orders have to work, because the cat can
       mount either side of that moment: if the flag is already gone the
       loader has either finished or never ran (reduced motion, or any
       page but the landing one — both of which skip it entirely, and in
       both the cat should still turn up), so carry on now; otherwise
       wait for the event. The listener is attached either way and
       `armed` guards against a double spawn. */
    window.addEventListener("preloader:done", letIn, { once: true });
    if (document.documentElement.dataset.loading === undefined) letIn();

    return () => {
      armed = false;
      window.removeEventListener("preloader:done", letIn);
      window.removeEventListener("hero:settled", spawn);
    };
  }, []);

  /* ── the loop ──────────────────────────────────────────────────── */

  /* A layout effect, so the first draw lands before the browser paints
     the new element. A passive effect can run after that paint, and the
     box is at the window's origin until something has placed it: one
     frame of a cat in the top left corner, which is exactly what the
     draw below is there to prevent. It matters more now that the cat is
     born behind the portrait, where the first thing it does is hide. */
  useLayoutEffect(() => {
    const node = el.current;
    if (!spawned || !node) return;

    const clamp = (value: number, low: number, high: number) =>
      Math.max(low, Math.min(high, value));

    /* The portrait it is coming out from, or null for the walk-in. */
    const from = den.current;

    /* Where the cat is, in window pixels, measured at its centre, and
       the mark it is heading for. Until the cat has reached that mark
       the pointer is ignored — the brief is that it arrives and then
       starts chasing, and a cat that cuts diagonally across the window
       towards wherever the pointer already was has skipped the first
       half of that. It is a second at most.

       Without a portrait it starts off the right edge, at a believable
       walking height: low in the window, where a floor would be, rather
       than halfway up it.

       With one, it comes out UNDER it: it starts low inside the
       portrait, out of sight (see `out` below) and already most of the
       way to the bottom edge, and the mark is on the floor below the
       portrait. Starting dead centre means a second and a half of
       nothing while it walks the radius, and the point of this is the
       cat appearing from under the rim, not the waiting.

       The drift to one side is small — enough that it walks out rather
       than straight down the portrait's own axis, and towards the open
       side of the window, which for a portrait in the right-hand column
       is almost always its left. */
    let catX: number;
    let catY: number;
    let markX: number;
    let markY: number;

    if (from) {
      const box = from.getBoundingClientRect();
      const radius = Math.max(box.width, box.height) / 2;

      const cx = box.left + box.width / 2;
      const cy = box.top + box.height / 2;
      const side = cx > window.innerWidth / 2 ? -1 : 1;

      catX = cx + side * radius * 0.22;
      catY = cy + radius * 0.62;

      markX = clamp(
        cx + side * 70,
        80,
        window.innerWidth - 80,
      );
      markY = clamp(
        cy + radius + 56,
        80,
        window.innerHeight - 48,
      );
    } else {
      catX = window.innerWidth + 24;
      catY = Math.round(window.innerHeight * 0.74);
      markX = Math.max(80, window.innerWidth - 170);
      markY = catY;
    }

    let chasing = false;

    /* Whether the cat is still behind the portrait, and so not drawn at
       all. "Behind" is the one thing the stacking order cannot give it:
       the hero is page content and the cat is fixed over the whole
       window, and lifting the portrait over a fixed layer would mean
       lifting the hero's text with it. So it is simply not shown until
       it has cleared the portrait's edge — which is the frame it would
       have come out from under in any case. Measured live, because the
       portrait is still on its way to its resting place and the page
       can be scrolled while the cat walks. */
    let behind = from !== null;

    const out = () => {
      if (!from) return true;

      const box = from.getBoundingClientRect();
      const radius = Math.max(box.width, box.height) / 2;

      return (
        Math.hypot(
          catX - (box.left + box.width / 2),
          catY - (box.top + box.height / 2),
        ) >= radius
      );
    };

    /* The pointer, tracked from the first move whether or not the cat
       is allowed to care yet, so the hand-over is seamless: the moment
       the walk-in ends the cat already knows where to go. Starts at the
       mark, so a visitor who never moves the pointer gets a cat that
       walks in, stops and waits. */
    let mouseX = markX;
    let mouseY = markY;

    let ticks = 0; /* total behaviour frames, for sprite alternation */
    let idleTicks = 0; /* frames since it last had somewhere to be */
    let pose: PoseKey | null = null;
    let flipped: boolean | null = null;

    /* ── drawing ─────────────────────────────────────────────────── */

    /* Two writes, both guarded, because this runs ten times a second
       and neither the cell nor the transform should be touched when it
       has not changed. The mirror lives in the same transform as the
       position so there is only ever one of them — and it mirrors the
       sprite, which is exactly what the sheet expects: oneko draws only
       the eastward runs and gets west by flipping them. */
    const draw = (next: PoseKey, flip: boolean) => {
      if (behind) {
        if (out()) {
          behind = false;
          /* Back to the stylesheet, which hides it for the loader. */
          node.style.visibility = "";
        } else {
          node.style.visibility = "hidden";
        }
      }

      if (next !== pose) {
        pose = next;
        const [col, row] = CELLS[next];
        node.style.backgroundPosition = `${-col * CELL}px ${-row * CELL}px`;
      }
      if (flip !== flipped) flipped = flip;
      node.style.transform =
        `translate3d(${Math.round(catX) - 16}px, ${Math.round(catY) - 16}px, 0)` +
        (flip ? " scaleX(-1)" : "");
    };

    /* Heading to pose. atan2 of the movement vector, bucketed to the
       eight directions the sheet has, with the westward buckets'
       mirroring handled by the table. atan2 is signed, so the +8 and
       the modulo fold the negative (upward) half back into 0..7. */
    const running = (dx: number, dy: number): [PoseKey, boolean] => {
      const bucket = (Math.round((Math.atan2(dy, dx) * 4) / Math.PI) + 8) % 8;
      const [family, flip] = HEADINGS[bucket];
      return [`run-${family}-${(ticks % 2) + 1}` as PoseKey, flip];
    };

    /* ── behaviour ───────────────────────────────────────────────── */

    /* A page that brings its own cat (the 404's runner game) marks
       itself with `data-no-cat`, and this one steps aside while it is
       mounted: two cats on one page is one too many. Checked per tick
       rather than once, because the layout — and this cat — outlive a
       client-side navigation in either direction. */
    const stepAside = () => {
      const away = document.querySelector("[data-no-cat]") !== null;
      node.style.display = away ? "none" : "";
      return away;
    };

    const step = () => {
      if (stepAside()) return;
      ticks++;

      const dx = (chasing ? mouseX : markX) - catX;
      const dy = (chasing ? mouseY : markY) - catY;
      const dist = Math.hypot(dx, dy);

      if (dist > CATCH_DISTANCE) {
        idleTicks = 0;
        /* Never overshoot on the last stride: a short hop into place
           reads better than a step past and a step back. */
        const stride = Math.min(SPEED, dist);
        catX += (dx / dist) * stride;
        catY += (dy / dist) * stride;
        const [next, flip] = running(dx, dy);
        draw(next, flip);
        return;
      }

      /* Arrived. Keep the last facing — a cat that has just stopped is
         still pointing where it was going.

         This is also where the walk-in ends: reaching the mark counts
         as catching it, so the hand-over costs one tick of `alert`
         before the chase begins, which reads as the cat arriving and
         then noticing the pointer. */
      idleTicks++;
      chasing = true;

      if (idleTicks <= ALERT_TICKS) draw("alert", flipped ?? false);
      else if (idleTicks >= SLEEP_AFTER) {
        /* Slow enough to read as breathing rather than as a two-frame
           animation: one change every eight ticks, so 0.8s a side. */
        draw(Math.floor(idleTicks / 8) % 2 ? "sleep-2" : "sleep-1", flipped ?? false);
      } else if (idleTicks >= SCRATCH_AFTER && idleTicks < SCRATCH_AFTER + 24) {
        draw(ticks % 2 ? "scratch-2" : "scratch-1", flipped ?? false);
      } else draw("idle", flipped ?? false);
    };

    /* ── the frame loop ──────────────────────────────────────────── */

    /* One rAF driving a behaviour accumulator. The elapsed time is
       clamped, because a tab that has been in the background for a
       minute comes back with a minute of elapsed time and would
       otherwise run a few hundred behaviour ticks in one frame; the cat
       should pick up where it was, not teleport. */
    let raf = 0;
    let last = performance.now();
    let behave = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(now - last, 250);
      last = now;

      behave += dt;
      while (behave >= TICK_MS) {
        behave -= TICK_MS;
        step();
      }
    };

    /* Paint it once before the first frame, at its start — off the right
       edge, or behind the portrait and hidden — so there is no chance of
       a single frame at the origin. */
    stepAside();
    if (behind) node.style.visibility = "hidden";
    draw("run-e-1", true);
    raf = requestAnimationFrame(frame);

    /* ── input ───────────────────────────────────────────────────── */

    /* pointermove rather than mousemove: it covers a pen as well, and
       the media query above has already ruled out a coarse pointer.
       Passive, because nothing here is cancelled. Moves that arrive
       during the walk-in are recorded but not acted on (see the mark
       above); the chase picks them up the instant it takes over. */
    const onMove = (e: PointerEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    /* A window that has shrunk can leave the cat outside it, where it
       is invisible. Pull it back to the edge. */
    const onResize = () => {
      catX = Math.min(catX, window.innerWidth - 16);
      catY = Math.min(catY, window.innerHeight - 16);
      mouseX = Math.min(mouseX, window.innerWidth - 1);
      mouseY = Math.min(mouseY, window.innerHeight - 1);
      /* The walk-in's mark is the right edge's, and is re-aimed with
         it. A cat coming out from behind the portrait is aimed at the
         portrait instead, which has moved with the resize itself. */
      if (!chasing && !from) {
        markX = Math.max(80, window.innerWidth - 170);
        markY = Math.min(markY, window.innerHeight - 16);
      }
    };
    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", onResize);
    };
  }, [spawned]);

  if (!spawned) return null;

  return (
    /* A plain box with the sheet behind it. Decoration with no meaning
       to convey and nothing to focus: out of the accessibility tree and
       out of the tab order entirely. */
    <div ref={el} className={styles.cat} aria-hidden="true" />
  );
}
