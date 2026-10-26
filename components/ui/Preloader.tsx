"use client";

import {
  Component,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { MAC, PHONE_BOOT, budgetsFor, type Glass, type Rect } from "./preloader-timeline";
import type { SceneProps } from "./PreloaderScene";
import { loadHeroScene } from "../three/heroScene";
import styles from "./Preloader.module.css";

/* The first-load sequence.

   Wide screen: a MacBook Air, closed, on a backdrop the site never
   uses, so the machine reads as an object rather than as part of the
   page. The lid swings open, the camera comes round to face the screen,
   the panel lights and the four-corner mark plays on it with his name.
   Then the real site appears on the glass, sits there a moment, and the
   camera flies in until the screen is the window.

   Phone: no model at all. A phone is the weakest machine in the room and
   the one on the slowest connection, and a 3D iPhone there meant a
   megabyte of three.js, a WebGL context and a shader compile all
   standing between the visitor and a plain wall (measured on a cold
   load in the iOS Simulator: nothing but the wall for the best part of
   seven seconds, then the page). Instead the whole window is a phone
   powering on: black, the site's mark where the maker's would be, his
   name under it, a thin bar filling, and then the black lifts off the
   page. It is DOM and CSS only, so it costs nothing to fetch and its
   animation is the browser's, not a script's.

   The laptop is a real model (react-3d-mockups, three.js). That is a
   lot of code to send to someone who has not seen anything yet, so it
   is split in two. This file is small and is in the first bundle: it
   decides whether to play, holds the page still, and puts the backdrop
   up in the same breath so there is never a frame of the site ahead of
   the loader. PreloaderScene.tsx is the three.js half, fetched only once
   the sequence is going to play, and it is where the hand-over is made:
   the screen is a hole in the canvas, the real page sits just under the
   canvas, and the scene measures the hole and hands this file a
   rectangle to put the page in (see place below).

   The loader never holds the page hostage. If the model has not drawn
   a frame within a short budget, or anything throws, or WebGL is not
   there, the sequence is dropped and the page is simply shown. The
   phone's boot screen has no model to wait for and one timer that ends
   it, which is also the only way out of it. */

type Mode = "mac" | "phone";

/* The pre-paint curtain's failsafe (app/layout.tsx): the handle of a
   timer that would drop the curtain if React never arrived. It has
   arrived, so this file owns the flag from here. */
declare global {
  interface Window {
    __loaderCurtain?: number;
  }
}

/* The sequence belongs to the front door, and to a load of it: the
   landing page, every time the document is opened there, and nowhere
   else. Not the case studies — someone arriving on one followed a link
   to a particular thing and should be given it — and never on a route
   change, which does not reach this file at all: the loader is mounted
   by the root layout, so going home from another page leaves it exactly
   as it was, already spent. Opening the landing page again, or
   reloading it, is a new document and plays it again. */
const isLanding = (path: string) =>
  path === "" ||
  path === "/" ||
  path === "/index.html";

/* Narrow *and* upright. Keying on width alone handed a short landscape
   window a tall phone, which squeezed the page into a sliver down the
   middle at a quarter scale. A laptop is the right shape for anything
   wider than it is tall. The same test is made by the document's own
   script (app/layout.tsx) before the first paint, so keep them in step. */
const isPhone = () => window.innerWidth < 760 && window.innerHeight > window.innerWidth;

/* The decision, made once per page load and kept here rather than
   re-read. Development mode mounts every effect twice, and anything
   that mounts this again later in the same load (a remount of the
   layout) must get the skip rather than a second run — `finish` spends
   it. A reload is a fresh module, so it decides again as it should. */
let playThisLoad: boolean | null = null;

/* The three.js half, fetched once however many times it is asked for. */
let sceneModule: Promise<typeof import("./PreloaderScene")> | null = null;
const loadScene = () => (sceneModule ??= import("./PreloaderScene"));

/* Started as this module is evaluated, which is before React has
   hydrated and so before the effect below can ask for it: the chunk is
   the slowest thing the sequence waits on, and the model has to be on
   screen within a short budget. Only when the laptop sequence is going
   to play (the same checks the effect makes, read-only), so someone
   opening a case study, anyone who has asked for less motion, and every
   phone (whose boot screen is plain DOM) never downloads it.
   Failure here is ignored; the effect awaits the same promise and treats
   a rejection as a failed sequence. */
if (typeof window !== "undefined") {
  try {
    if (
      isLanding(window.location.pathname) &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
      !isPhone()
    ) {
      /* The heroes' scene chunk follows the loader's, not alongside it:
         both are three.js and the loader's has a budget to meet, so it
         gets the whole connection first. By the time the page appears the
         hero chunk has long since landed. */
      loadScene()
        .catch(() => {})
        .then(() => loadHeroScene())
        .catch(() => {});
    } else {
      /* No laptop loader (a case study, reduced motion, or a phone, whose
         boot screen is DOM): the heroes are the next thing the page
         wants. */
      loadHeroScene().catch(() => {});
    }
  } catch {
    /* Anything unreadable this early: the effect will fetch the chunk
       when it needs it. */
  }
}

/* Anything the scene throws while it renders (WebGL context creation
   failing is the usual one; react-three-fiber rethrows it into the React
   tree) lands here and ends the sequence rather than the page. */
class Guard extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function Preloader({ name }: { name: string }) {
  const reduced = useReducedMotion();
  const [done, setDone] = useState(false);
  const [mode, setMode] = useState<Mode | null>(null);
  const [Scene, setScene] = useState<ComponentType<SceneProps> | null>(null);
  const [revealed, setRevealed] = useState(false);
  /* Phone only: the black has started to lift off the page. */
  const [lifted, setLifted] = useState(false);
  const bail = useRef(0);
  const ceiling = useRef(0);
  const hard = useRef(0);
  const lift = useRef(0);
  const page = useRef<{ el: HTMLElement; w: number; h: number } | null>(null);

  /* Spent once it has finished or failed, so anything that mounts this
     again later in the same load gets the skip rather than a second
     run. */
  const finish = useCallback(() => {
    playThisLoad = false;
    window.clearTimeout(bail.current);
    window.clearTimeout(ceiling.current);
    window.clearTimeout(hard.current);
    window.clearTimeout(lift.current);
    setDone(true);
  }, []);

  /* A layout effect, so the decision and the backdrop land before the
     first paint of the hydrated page. */
  useLayoutEffect(() => {
    /* React is up, so the curtain's own failsafe is not needed: every
       path below either plays the sequence and clears the flag at the
       end of it, or clears it now. */
    window.clearTimeout(window.__loaderCurtain);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDone(true);
      return;
    }

    /* Once per document, on the landing page (see isLanding above). It
       is the introduction to the site, so it plays whenever someone
       opens the front door — every load of it, a reload included — and
       it does not play in front of a case study someone followed a link
       to. A skipped run takes exactly the reduced-motion exit: nothing
       is rendered, and neither the loading flag nor the boot state is
       ever written, so the page is simply there.

       Nothing is remembered between loads any more. It used to be once a
       session, on the reasoning that a reload should not cost three
       seconds again; the introduction is wanted on every opening of the
       landing page instead. Going home from another page still costs
       nothing, because a route change does not remount this. */
    if (playThisLoad === null) {
      playThisLoad = isLanding(window.location.pathname);
    }
    if (!playThisLoad) {
      setDone(true);
      return;
    }

    const phone = isPhone();
    const m: Mode = phone ? "phone" : "mac";
    setMode(m);

    const root = document.documentElement;
    document.body.style.overflow = "hidden";

    if (phone) {
      /* The boot screen. Everything it needs is already here, so there is
         nothing to wait for and no budget to meet: it is a fixed length
         and two timers. The first takes the document's black away from
         under the boot screen's own black (the page is then there, and
         live, behind it) and starts the fade; the second ends it. The
         first is a plain DOM write rather than state, so the page is let
         go even if React is slow to render the change, and the second is
         the one way out of the sequence, so there is no path on which the
         page is left behind a curtain. The value of the flag is the
         document's cue to paint black rather than the laptop's wall (see
         "the first frame" in globals.css). */
      root.dataset.loading = "phone";
      lift.current = window.setTimeout(() => {
        delete root.dataset.loading;
        setLifted(true);
      }, PHONE_BOOT.lift * 1000);
      hard.current = window.setTimeout(finish, PHONE_BOOT.end * 1000);
      return () => {
        window.clearTimeout(lift.current);
        window.clearTimeout(hard.current);
      };
    }

    /* How long to wait for the model depends on what is drawing it (see
       budgetsFor). A touch screen of any shape is a slower machine than a
       laptop, whichever sequence its shape earned it (a tablet standing
       upright is given the laptop's sequence but not the laptop's
       processor). */
    const budgets = budgetsFor(window.matchMedia("(pointer: coarse)").matches);

    root.dataset.loading = "1";

    /* The three.js half is fetched now, not when it is first rendered,
       and a failed fetch (offline, a stale deploy) is a failed
       sequence like any other. */
    let live = true;
    loadScene()
      .then((mod) => {
        if (!live) return;
        setScene(() => mod.default);
        /* The model's own budget starts now that its code is here. */
        window.clearTimeout(bail.current);
        bail.current = window.setTimeout(finish, budgets.ready);
      })
      .catch(() => {
        if (live) finish();
      });

    /* And the overall ceiling, whatever the time was spent on. */
    ceiling.current = window.setTimeout(finish, budgets.ceiling);

    return () => {
      live = false;
      window.clearTimeout(bail.current);
      window.clearTimeout(ceiling.current);
      window.clearTimeout(hard.current);
    };
  }, [finish]);

  useEffect(() => {
    if (!done) return;
    const root = document.documentElement;
    delete root.dataset.loading;
    delete root.dataset.boot;
    document.body.style.overflow = "";
    const stage = document.getElementById("stage");
    if (stage) {
      stage.style.transform = "";
      stage.style.clipPath = "";
      stage.style.zIndex = "";
      stage.style.opacity = "";
      stage.style.transition = "";
    }
    page.current = null;

    /* The page is handed back. Anything that was waiting for the
       introduction to be over — at the moment the cat (components/oneko)
       — hears about it here rather than watching this attribute, because
       the removal above is the only truthful signal and it happens on
       every path out of the loader: the finished sequence, every skip
       (budget, WebGL, ceiling), the reduced-motion exit, and any
       page but the landing one, where the attribute was never set at
       all. Listeners that mount after this has already fired check for
       the absence of `data-loading` instead; see Oneko.tsx. */
    window.dispatchEvent(new Event("preloader:done"));
  }, [done]);

  /* The model has drawn, and the sequence is under way. From here the
     only thing that can go wrong is the scene stalling mid-way (a tab
     sent to the background throttles frames), so a watchdog finishes
     the job a little after the sequence should have ended on its own. */
  const onReady = useCallback(() => {
    window.clearTimeout(bail.current);
    window.clearTimeout(ceiling.current);
    window.clearTimeout(hard.current);
    hard.current = window.setTimeout(finish, (MAC.end + 1.2) * 1000);
  }, [finish]);

  const onReveal = useCallback(() => setRevealed(true), []);

  /* Maps the real page into a rectangle of the window: the screen of the
     machine, as the scene has just measured it.

     The page is scaled so its width exactly fills the rectangle and
     pinned to the rectangle's top left, so the screen shows the top of
     the site the way a real one would. Everything below the rectangle is
     clipped away. The clip is measured against the element's own box,
     not the window: inset() resolves against the border box, and this
     element is the whole page, thousands of pixels of it.

     `reveal` opens the clip downwards, towards the window's bottom edge,
     as the zoom completes. A screen is wider than it is tall by a fixed
     ratio and a window need not be, so a window taller than that ratio
     has a strip under the finished screen which the page must be allowed
     to fill, or it would be bare for the instant before the loader is
     removed.

     Called every frame of the zoom, so it only writes styles. The
     stylesheet's `zoom` boot state is never entered: it eases the
     transform in CSS, and this one is driven frame by frame to stay
     locked to the camera. */
  const place = useCallback((r: Rect, reveal: number, glass?: Glass) => {
    const first = !page.current;
    if (!page.current) {
      const el = document.getElementById("stage");
      if (!el) return;
      page.current = { el, w: el.offsetWidth, h: el.offsetHeight };
    }
    const { el, w, h } = page.current;
    const root = document.documentElement;
    if (root.dataset.boot !== "framed") root.dataset.boot = "framed";

    /* Everything below is in the page's own pixels, before the scale. */
    const s = r.width / w;
    const k = 1 / s;
    const inRect = r.height * k;
    const toWindow = (window.innerHeight - r.top) * k;
    const own = inRect + (glass ? glass.chin * k : 0);
    const visible = own + (Math.max(own, toWindow) - own) * reveal;
    el.style.transform = `translate(${r.left}px, ${r.top}px) scale(${s})`;

    if (!glass) {
      el.style.clipPath = `inset(0px 0px ${Math.max(0, h - visible)}px 0px)`;
      return;
    }

    /* The laptop. A MacBook's glass is a black panel with the display set
       into it, a notch cut out of the display's top edge, and a chin
       below. All of that is opaque hardware in the canvas, so the page
       under the canvas shows only in the display rectangle and the chin
       stays a black strip beneath it. Here the page is instead stacked
       over the canvas and cut to the glass's shape: rounded top corners,
       the notch (through which the machine's own notch shows), and down
       to the glass's bottom edge. It fades up, because it is no longer
       arriving behind the panel's own fade; the mark and name fade out
       beneath it over the same 400ms, so the two cross rather than cut. The corners and the notch
       are let go as the zoom completes (they are the display's, and by
       then the display is the window). */
    if (first) {
      el.style.zIndex = "10001";
      /* The Web Animations API rather than an inline opacity and a CSS
         transition. The transition depended on the 0 and the 1 landing in
         separate style recalculations, and measured in a real browser
         it never interpolated: the page was at full opacity from the
         first framed frame. An animation owns its own timeline, so it
         cannot be batched away. `backwards` holds the 0 until it starts
         and the element returns to its natural 1 when it ends. */
      el.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 400,
        easing: "cubic-bezier(0.16, 1, 0.3, 1)",
        fill: "backwards",
      });
    }
    const keep = 1 - reveal;
    const R = glass.corner * k * keep;
    const nW = glass.notchW * k * keep;
    const nH = glass.notchH * k * keep;
    const nR = Math.min(glass.notchR * k * keep, nW / 2, nH);
    const V = Math.min(h, visible);
    const c = w / 2;
    const f = (n: number) => n.toFixed(2);
    el.style.clipPath =
      `path('M0 ${f(R)} A${f(R)} ${f(R)} 0 0 1 ${f(R)} 0 ` +
      `L${f(c - nW / 2)} 0 L${f(c - nW / 2)} ${f(nH - nR)} A${f(nR)} ${f(nR)} 0 0 0 ${f(c - nW / 2 + nR)} ${f(nH)} ` +
      `L${f(c + nW / 2 - nR)} ${f(nH)} A${f(nR)} ${f(nR)} 0 0 0 ${f(c + nW / 2)} ${f(nH - nR)} L${f(c + nW / 2)} 0 ` +
      `L${f(w - R)} 0 A${f(R)} ${f(R)} 0 0 1 ${f(w)} ${f(R)} L${f(w)} ${f(V)} L0 ${f(V)} Z')`;
  }, []);

  const onDone = useCallback(() => finish(), [finish]);

  if (reduced || mode === null) return null;

  /* The phone's boot screen: black over the whole window, the mark in
     the middle where a maker's logo would be, the name under it, a bar
     filling. The core of the mark is on screen from the first frame at
     the exact spot the document paints the same disc (globals.css), so
     the hand-over from the document's black to this is not a change.
     Written to the stylesheet's timings by custom property, so the
     numbers live in one place (preloader-timeline.ts). */
  if (mode === "phone") {
    if (done) return null;
    return (
      <div
        className={styles.phoneBoot}
        data-lift={lifted ? "" : undefined}
        style={
          {
            "--pb-name": `${PHONE_BOOT.name}s`,
            "--pb-bar": `${PHONE_BOOT.bar}s`,
            "--pb-bar-dur": `${PHONE_BOOT.barDur}s`,
            "--pb-lift-dur": `${PHONE_BOOT.liftDur}s`,
          } as React.CSSProperties
        }
        aria-hidden="true"
      >
        <span className={styles.pbMark}>
          <span className={styles.pbBlob} style={{ "--x": "-150%", "--y": "-170%", background: "var(--on-dark)" } as React.CSSProperties} />
          <span className={styles.pbBlob} style={{ "--x": "150%", "--y": "-170%", background: "var(--accent)" } as React.CSSProperties} />
          <span className={styles.pbBlob} style={{ "--x": "-150%", "--y": "170%", background: "var(--accent-soft)" } as React.CSSProperties} />
          <span className={styles.pbBlob} style={{ "--x": "150%", "--y": "170%", background: "var(--faint)" } as React.CSSProperties} />
          <span className={styles.pbCore} />
        </span>
        <span className={styles.pbCaption}>
          <span className={styles.pbName}>{name}</span>
          <span className={styles.pbBar}>
            <span className={styles.pbFill} />
          </span>
        </span>
      </div>
    );
  }

  return (
    <>
      <AnimatePresence>
        {!done ? (
          /* Up from the first render, and on its own layer under the
             canvas: a wrapper with a z-index of its own would form a
             stacking context, and the canvas (which has to sit above
             the page) and the backdrop (which has to sit below it)
             could not both live inside it. */
          <motion.div
            key="backdrop"
            className={styles.backdrop}
            initial={false}
            animate={{ opacity: revealed ? 0 : 1 }}
            /* The skip paths (budget, WebGL failure, ceiling) end here
               with the backdrop still up and the page behind it, so this
               exit is the fade from wall to page. 300ms, not the old
               160, which read as a cut. The finished sequence's backdrop
               is already at 0 and is unaffected. */
            exit={{ opacity: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            aria-hidden="true"
          />
        ) : null}
      </AnimatePresence>
      {!done && Scene ? (
        <Guard onError={finish}>
          <Scene
            name={name}
            phone={false}
            onReady={onReady}
            onFail={finish}
            onReveal={onReveal}
            place={place}
            onDone={onDone}
          />
        </Guard>
      ) : null}
    </>
  );
}
