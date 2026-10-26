"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { loadHeroScene } from "../three/heroScene";
import { attach, detach, entryOf, subscribe, want, type Binding } from "../three/deviceStore";
import Device, { type DeviceKind } from "./Device";
import styles from "./ProjectHero.module.css";

/* Heroes are built ahead of need, one per idle slot, once the page has
   finished loading and the first-load sequence (if any) is over. A hero
   that is already near the window does not wait for its slot (see
   `near` below). Each build is a WebGL context, shader compiles and a
   frame, so they are queued in a chain across every stage on the page
   rather than started together. */
let idleChain: Promise<void> = Promise.resolve();
function whenIdle(run: () => void, cancelled: () => boolean) {
  idleChain = idleChain.then(
    () =>
      new Promise<void>((done) => {
        const go = () => {
          if (!cancelled()) run();
          done();
        };
        if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(go, { timeout: 1500 });
        else window.setTimeout(go, 120);
      }),
  );
}

/* Resolves once the document has loaded and the loader's flag is off the
   root element. The flag is set in a layout effect before any stage's
   effect runs, so a stage that asks during the first commit sees it. */
function pageSettled(): Promise<void> {
  const root = document.documentElement;
  const loaded = new Promise<void>((res) => {
    if (document.readyState === "complete") res();
    else window.addEventListener("load", () => res(), { once: true });
  });
  const clear = new Promise<void>((res) => {
    if (!root.dataset.loading) return res();
    const mo = new MutationObserver(() => {
      if (!root.dataset.loading) {
        mo.disconnect();
        res();
      }
    });
    mo.observe(root, { attributes: true, attributeFilter: ["data-loading"] });
  });
  return Promise.all([loaded, clear]).then(() => undefined);
}

/* The device on its plinth, and everything that moves it.

   The device is a real 3D model (DeviceScene, react-3d-mockups on
   three.js). Its canvas is not in this component: it lives in the
   persistent device layer (components/three/DeviceLayer), which survives
   route changes and lays the canvas over .fig every frame. .fig is only
   the slot, the box the model is drawn over. This component still owns
   every number that moves the model and hands them to the layer, so on
   a new page the same canvas is simply re-bound to the new slot's
   values. Every pose is a rotation of the model's group in the scene,
   not a CSS transform.

   In a list (and as the next project) the model arrives showing its back,
   the real one with its Apple glyph and camera, and turns to face the
   reader as its hero rises into place; on wide screens the hero is pinned
   while that happens, so the turn is played rather than scrolled past.
   The laptop opens its lid as it comes round. The progress runs through a
   spring stiff enough to follow the wheel and damped past critical, so
   the object settles instead of swinging through the front. On its own
   page it is already facing front, which is where the morph from the
   list lands: the progress there is not a spring target at all but a
   constant 1 that is set by jumping, because a spring that starts at 0
   and is told 1 plays the whole turn, and the reader would watch the
   device flip over right after the hand-over lands. Once it faces front
   it follows a fine pointer a little and floats.

   That constant is also why a hand-over cannot simply read it. The
   arriving slot attaches — and with it this page's progress of 1 —
   inside the view transition's update callback, while the device is
   still back at the list's box and still showing the list's part-turned
   pose. The device layer therefore CARRIES the turn across the move
   (`pose` in components/three/deviceStore.ts): the value this component
   publishes is the destination, and the store eases the model from the
   list's turn to it on the travel's own clock, so the model is already
   at rest on the frame the box lands.

   With reduced motion it simply faces the front and holds still.

   What the server sends is the static stand-in (Device.tsx), front-facing,
   so nothing is lost without JavaScript, before hydration, without WebGL
   or while three.js is still loading. The model is asked for only when
   the hero comes within a window's height of view (or in an idle slot),
   then kept for the visit, and fades in over the stand-in once it has
   drawn a few frames. */

type Mode = "list" | "page" | "next";

/* Pointer parallax, in degrees either way. The rest pose (square to the
   reader, tipped back a little) is DeviceScene's. */
const TILT = 6;

export default function DeviceStage({
  slug,
  mode,
  kind,
  label,
  children,
}: {
  /* The project, which names its one model in the device layer. */
  slug: string;
  mode: Mode;
  kind: DeviceKind;
  /* The canvas's accessible name. */
  label: string;
  /* The interface on the screen. */
  children: ReactNode;
}) {
  const fig = useRef<HTMLDivElement>(null);
  const section = useRef<HTMLElement | null>(null);
  const reduced = useReducedMotion();
  const turns = mode !== "page" && !reduced;

  /* The section is the hero that contains this stage. It is found rather
     than passed, so the hero itself can stay a server component. This
     runs before useScroll starts measuring, which happens in an effect. */
  const [wide, setWide] = useState(false);
  useEffect(() => {
    section.current = fig.current?.closest<HTMLElement>("[data-hero]") ?? null;
    const mq = window.matchMedia("(min-width: 960px)");
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  /* Wide: the section's top from the bottom of the window to the top,
     which is the moment the pin takes hold. Narrow: nothing is pinned,
     so the object turns as it rises from the bottom of the window to the
     middle, where it is actually being looked at. */
  const { scrollYProgress: pinned } = useScroll({ target: section, offset: ["start end", "start start"] });
  const { scrollYProgress: free } = useScroll({ target: fig, offset: ["start end", "center center"] });
  /* The spring is driven by hand rather than attached to a derived value:
     a derived value records its sources on its first run, when `wide` is
     still false, and a jump can detach a spring from its source. Reading
     the current mode from refs on every scroll event has neither problem. */
  /* A page device is born at rest (1); only list and next heroes start
     behind (0). The spring's first value matters: it is what the very
     first frame is painted from. */
  const progress = useSpring(mode === "page" ? 1 : 0, { stiffness: 140, damping: 32, restDelta: 0.0005 });
  const mode$ = useRef({ turns, wide });
  mode$.current = { turns, wide };

  /* Where the turn should be right now, read straight off the layout with
     the same offsets useScroll uses. useScroll cannot be asked this before
     it has measured, and a freshly mounted spring knows nothing, so both
     the mount and the moments just after it use this. */
  const measure = () => {
    const vh = window.innerHeight;
    const sec = section.current;
    const box = fig.current;
    if (!box) return 1;
    let p: number;
    if (window.matchMedia("(min-width: 960px)").matches && sec) {
      p = (vh - sec.getBoundingClientRect().top) / vh;
    } else {
      const r = box.getBoundingClientRect();
      p = (vh - r.top) / (vh / 2 + r.height / 2);
    }
    return Math.max(0, Math.min(1, p));
  };

  /* Until a scroll value has reported once it is an unmeasured 0, which
     must not pull a device that mounted already turned back to the rear.
     The first report is applied by jumping: it is the page catching up
     with where it already is (a restored scroll position, a route that
     was scrolled to its top after mounting), not the reader scrolling,
     and animating it would replay the turn from the back. */
  const seen = useRef(false);
  const sync = (first = false) => {
    const m = mode$.current;
    if (!m.turns) {
      /* No turn: at rest, from the first frame, and never animated. */
      progress.jump(1);
      return;
    }
    const v = m.wide ? pinned.get() : free.get();
    if (first) progress.jump(v);
    else progress.set(v);
  };
  const onScroll = () => {
    const first = !seen.current;
    seen.current = true;
    sync(first);
  };
  useMotionValueEvent(pinned, "change", onScroll);
  useMotionValueEvent(free, "change", onScroll);
  useEffect(() => {
    if (seen.current || !turns) sync();
  }, [turns, wide]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Pointer parallax, in degrees, eased by its own springs. */
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 120, damping: 20 });
  const sy = useSpring(py, { stiffness: 120, damping: 20 });

  /* Parallax fades in over the last tenth of the turn, so it never fights
     the turn itself. DeviceScene's SETTLE_FROM is the same 0.9, used
     while a turn is being carried between pages; change both together. */
  const settled = useTransform(progress, [0.9, 1], [0, 1], { clamp: true });

  useLayoutEffect(() => {
    section.current = fig.current?.closest<HTMLElement>("[data-hero]") ?? null;
    /* Before the first paint, put the spring where the page already is.
       useScroll has not measured yet and a list hero's spring starts at 0,
       which would turn a device that is already in view back from behind
       after a reload mid-page. A hero that does not turn (the page's own,
       or reduced motion) is simply at rest. */
    progress.jump(turns ? measure() : 1);
  }, [turns, progress]); // eslint-disable-line react-hooks/exhaustive-deps

  /* The layout effect above can run while the page is still somewhere
     else: during a view transition it runs inside the update callback,
     before the transition provider has scrolled the new route to its top
     (or a hash), and after a back navigation before the browser has
     restored the scroll position. Whatever it measured then is the old
     scroll position's answer. Once the frames are running again, ask
     once more, and move by jumping if it was wrong. Done twice because
     the first frame after a transition starts can still precede the
     scroll reset's layout. */
  useEffect(() => {
    if (!turns) return;
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        const p = measure();
        if (Math.abs(p - progress.get()) > 0.02) progress.jump(p);
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [turns]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const host = section.current;
    if (!host || reduced) return;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    if (!fine.matches) return;

    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = host.getBoundingClientRect();
      const top = Math.max(r.top, 0);
      const bottom = Math.min(r.bottom, window.innerHeight);
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
      const ny = ((e.clientY - top) / Math.max(bottom - top, 1)) * 2 - 1;
      px.set(Math.max(-1, Math.min(1, nx)) * TILT);
      py.set(Math.max(-1, Math.min(1, ny)) * TILT);
    };
    const leave = () => {
      px.set(0);
      py.set(0);
    };
    host.addEventListener("pointermove", move, { passive: true });
    host.addEventListener("pointerleave", leave);
    return () => {
      host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerleave", leave);
    };
  }, [reduced, px, py]);

  /* The model itself lives in the persistent device layer
     (components/three), not here: this box is only its slot. The slot is
     registered with everything that drives the model, before the first
     paint, so a canvas that was carried here from another page is
     re-bound to this page's motion values in the same commit as the
     swap. Registering does not mount anything; asking for the model
     (below) does. */
  const binding = useMemo<Binding>(
    () => ({ kind, label, screen: children, progress, sx, sy, settled, turns, float: !reduced }),
    [kind, label, children, progress, sx, sy, settled, turns, reduced],
  );
  useLayoutEffect(() => {
    const el = fig.current;
    if (!el) return;
    attach(slug, el, binding);
    return () => detach(slug, el);
  }, [slug, binding]);

  /* The canvas is wanted once the hero is within a window's height of
     view, and kept: a WebGL context is not free, but tearing one down to
     rebuild it on the way back costs more than keeping it. The layer keeps
     it across pages too, so a project's model is built once per visit. */
  const [near, setNear] = useState(false);
  useEffect(() => {
    const box = fig.current;
    if (!box || near) return;
    if (!("IntersectionObserver" in window)) {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "100% 0px" },
    );
    io.observe(box);
    return () => io.disconnect();
  }, [near]);

  /* The same canvas, built early: once the page is settled and the loader
     is gone, in an idle slot, whether or not the hero is anywhere near.
     The scene renders its first frame while off screen (DeviceScene), so
     by the time the reader arrives the shaders are compiled and the fade
     is done. Three projects at most, which bounds the contexts. The
     observer above stays as the fallback. */
  const [early, setEarly] = useState(false);
  useEffect(() => {
    let dead = false;
    loadHeroScene().catch(() => {});
    pageSettled().then(() => {
      if (!dead) whenIdle(() => setEarly(true), () => dead);
    });
    return () => {
      dead = true;
    };
  }, []);

  /* WebGL is checked once, before three is even fetched; a context that is
     lost or refused later is caught by the layer's boundary. Either way
     the stand-in stays. */
  const [gl, setGl] = useState<boolean | null>(null);
  useEffect(() => setGl(hasWebGL()), []);
  useEffect(() => {
    if ((near || early) && gl) want(slug);
  }, [near, early, gl, slug]);

  /* Whether the project's model has drawn, read from the layer. A device
     carried in from another page is ready on the very first render here,
     so the stand-in is never shown under it. On a hydrating first load the
     store is empty, matching the server. */
  const status = useSyncExternalStore(
    subscribe,
    () => {
      const e = entryOf(slug);
      return e?.failed ? "failed" : e?.ready ? "ready" : "none";
    },
    () => "none",
  );
  const show = status === "ready";

  /* The stand-in's figure is a live component too; once the model has
     taken over and the fade is done, it is let go. A model that was
     already there lets it go at once. */
  const [still, setStill] = useState(() => !show);
  useEffect(() => {
    if (!show) {
      setStill(true);
      return;
    }
    const t = window.setTimeout(() => setStill(false), 500);
    return () => window.clearTimeout(t);
  }, [show]);

  return (
    <div ref={fig} className={styles.fig} data-kind={kind} data-ready={show ? "" : undefined}>
      {still || !show ? (
        <Device kind={kind} inert={mode !== "page"}>
          {children}
        </Device>
      ) : null}
    </div>
  );
}

/* Asked once per visit, not once per hero: each probe is a throwaway
   WebGL context, and the browser caps how many a page may hold. */
let webgl: boolean | null = null;
function hasWebGL() {
  if (webgl !== null) return webgl;
  try {
    const c = document.createElement("canvas");
    const ctx = c.getContext("webgl2") || c.getContext("webgl");
    webgl = !!ctx;
    ctx?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webgl = false;
  }
  return webgl;
}
