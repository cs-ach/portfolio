"use client";

import { useEffect, useRef, useState } from "react";
import { Cable, Mail, Package } from "lucide";
import { CELL, CELLS, SHEET, type PoseKey } from "@/components/oneko/poses";
import styles from "./Runner.module.css";

/* The runner.

   The cat from oneko.js (adryd, MIT; sheet and licence in /oneko/, the
   grid in poses.ts) running along a desk and hopping over what is
   lying about on it: parcels, cables, stray messages. The obstacles are
   icons from lucide (ISC licence, lucide.dev), not drawn by hand: each
   is rasterised once into an image in the page's ink colour and then
   stamped into its box every frame. One canvas,
   drawn in a fixed logical space of 640x200 and scaled to whatever
   width the stage has, so the physics never depends on the screen.

   Nothing moves until it is asked to. The idle state is one still
   frame and a line of text; the loop only exists between a start and
   a game over, stops when the tab is hidden, and is cancelled on
   unmount. */

/* ── the world ───────────────────────────────────────────────────── */

const W = 640;
const H = 200;
const GROUND = 168; /* the desk's top edge, in logical pixels */
const SCALE = 2; /* sprite cells drawn at 2x: 64 logical pixels */
const CAT = CELL * SCALE;
const CAT_X = 56;

/* Physics in logical pixels per second, stepped at a fixed 120Hz so a
   jump is the same height on every display. */
const STEP = 1 / 120;
const GRAVITY = 2600;
const JUMP_V = 760;
const START_SPEED = 260;
const MAX_SPEED = 560;
const RAMP = 7; /* px/s gained per second survived: a gentle climb */

/* The hitbox is smaller than the drawing: the sprite has empty margins
   and a near miss should feel like a miss. */
const INSET = 14;

type Kind = "parcel" | "cable" | "packet";
type Thing = { kind: Kind; x: number; w: number; h: number; lift: number };

/* Lucide icons are drawn on a 24-unit grid with a little air around
   the strokes, so each box is the icon's square at the size wanted. */
const SHAPES: Record<Kind, { w: number; h: number; lift: number }> = {
  parcel: { w: 30, h: 30, lift: 0 },
  cable: { w: 34, h: 34, lift: 0 },
  /* A message floats a little off the desk, low enough that it must
     still be jumped. */
  packet: { w: 26, h: 26, lift: 10 },
};

/* lucide's IconNode: a list of [tag, attributes] children. */
type IconNode = readonly (readonly [string, Record<string, string | number>])[];
const ICONS: Record<Kind, IconNode> = {
  parcel: Package as IconNode,
  cable: Cable as IconNode,
  packet: Mail as IconNode,
};

/* Wrap the children in lucide's usual svg shell, stroked in the given
   colour, and turn it into an image through a data URL. The pixel size
   is the box at the canvas's current scale, so it stays crisp. */
function rasterise(node: IconNode, ink: string, px: number) {
  const body = node
    .map(([tag, attrs]) => {
      const a = Object.entries(attrs)
        .map(([k, v]) => `${k}="${v}"`)
        .join(" ");
      return `<${tag} ${a}/>`;
    })
    .join("");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 24 24" ` +
    `fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return img;
}

type Phase = "idle" | "running" | "over";

const BEST_KEY = "notfound:best";

function readBest() {
  try {
    return Number(window.localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeBest(n: number) {
  try {
    window.localStorage.setItem(BEST_KEY, String(n));
  } catch {
    /* Private window or blocked storage: the best lives for this visit. */
  }
}

/* The line shown before the first run. The 404 and /play each say what
   the cat is doing in their own copy, so each passes its own. */
type RunnerProps = { prompt?: string };

export default function Runner({ prompt = "Help the cat look for it" }: RunnerProps) {
  const stage = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [announce, setAnnounce] = useState("");

  /* The game's mutable state lives in a ref: it changes 120 times a
     second and React only needs to hear about the score display. */
  const game = useRef({
    phase: "idle" as Phase,
    y: 0, /* cat height above the desk */
    vy: 0,
    speed: START_SPEED,
    dist: 0,
    things: [] as Thing[],
    gap: 0, /* distance until the next obstacle */
    scroll: 0,
    shown: 0,
  });
  const sheet = useRef<HTMLImageElement | null>(null);
  /* The obstacle images, remade whenever the ink colour or the canvas
     scale changes (a theme switch, a resize). */
  const icons = useRef<{ key: string; imgs: Partial<Record<Kind, HTMLImageElement>> }>({
    key: "",
    imgs: {},
  });
  const lastPose = useRef<PoseKey>("idle");
  const raf = useRef(0);

  /* ── drawing ───────────────────────────────────────────────────── */

  const draw = (pose: PoseKey) => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const g = game.current;
    const css = getComputedStyle(c);
    const ink = css.getPropertyValue("--ink").trim() || "#1D1D1F";
    const line = css.getPropertyValue("--line").trim() || "#E3E3E6";
    const lineStrong = css.getPropertyValue("--line-strong").trim() || "#D2D2D7";

    const k = c.width / W;
    lastPose.current = pose;

    const key = `${ink}|${k.toFixed(3)}`;
    if (icons.current.key !== key) {
      const imgs: Partial<Record<Kind, HTMLImageElement>> = {};
      for (const kind of Object.keys(ICONS) as Kind[]) {
        const img = rasterise(ICONS[kind], ink, Math.max(1, Math.round(SHAPES[kind].w * k)));
        /* Redraw the still frame once an image arrives; a running loop
           repaints on its own. */
        img.onload = () => {
          if (game.current.phase !== "running") draw(lastPose.current);
        };
        imgs[kind] = img;
      }
      icons.current = { key, imgs };
    }
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W, H);

    /* Graph paper that scrolls with the desk, so speed reads in the
       background as well as in the obstacles. */
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const off = -(g.scroll % 20);
    for (let x = off; x < W; x += 20) {
      ctx.moveTo(Math.round(x) + 0.5, 0);
      ctx.lineTo(Math.round(x) + 0.5, GROUND);
    }
    for (let y = GROUND - 20; y > 0; y -= 20) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(W, y + 0.5);
    }
    ctx.stroke();

    /* The desk: a solid edge and a band under it. */
    ctx.fillStyle = lineStrong;
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = ink;
    ctx.fillRect(0, GROUND, W, 2);

    for (const t of g.things) {
      const x = Math.round(t.x);
      const top = GROUND - t.lift - t.h;
      const icon = icons.current.imgs[t.kind];
      if (icon && icon.complete && icon.naturalWidth > 0) {
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(icon, x, top, t.w, t.h);
        ctx.imageSmoothingEnabled = false;
      }
    }

    const img = sheet.current;
    if (img && img.complete) {
      const [col, row] = CELLS[pose];
      ctx.drawImage(
        img, col * CELL, row * CELL, CELL, CELL,
        CAT_X, GROUND - CAT - Math.round(g.y) + 6, CAT, CAT,
      );
    }
  };

  /* ── sizing ────────────────────────────────────────────────────── */

  /* The backing store follows the stage's real width times the pixel
     ratio, so the paper lines stay one device pixel crisp. */
  useEffect(() => {
    const s = stage.current;
    const c = canvas.current;
    if (!s || !c) return;

    const img = new Image();
    img.src = SHEET;
    sheet.current = img;

    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const width = Math.max(1, Math.round(s.clientWidth * dpr));
      c.width = width;
      c.height = Math.round((width * H) / W);
      const g = game.current;
      draw(g.phase === "over" ? "sleep-1" : g.phase === "running" ? "run-e-1" : "idle");
    };
    img.onload = fit;

    setBest(readBest());
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(s);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── the loop ──────────────────────────────────────────────────── */

  const spawnGap = (speed: number) =>
    /* At least enough runway to land and jump again at this speed,
       plus a random stretch so the rhythm cannot be learned. */
    speed * 0.75 + 120 + Math.random() * 260;

  const end = () => {
    const g = game.current;
    g.phase = "over";
    cancelAnimationFrame(raf.current);
    const final = Math.floor(g.dist / 10);
    setScore(final);
    setPhase("over");
    const prev = readBest();
    const top = Math.max(prev, final);
    if (final > prev) writeBest(final);
    setBest((b) => Math.max(b, top));
    setAnnounce(
      final > prev
        ? `Caught. Score ${final}, a new best.`
        : `Caught. Score ${final}. Best ${top}.`,
    );
    draw("alert");
  };

  const tick = () => {
    const g = game.current;
    g.speed = Math.min(MAX_SPEED, g.speed + RAMP * STEP);
    const dx = g.speed * STEP;
    g.dist += dx;
    g.scroll += dx;

    g.vy -= GRAVITY * STEP;
    g.y += g.vy * STEP;
    if (g.y <= 0) {
      g.y = 0;
      g.vy = 0;
    }

    for (const t of g.things) t.x -= dx;
    g.things = g.things.filter((t) => t.x + t.w > -10);

    g.gap -= dx;
    if (g.gap <= 0) {
      const kinds: Kind[] = ["parcel", "cable", "packet"];
      const kind = kinds[Math.floor(Math.random() * kinds.length)];
      g.things.push({ kind, x: W + 10, ...SHAPES[kind] });
      g.gap = spawnGap(g.speed);
    }

    /* AABB with the forgiving inset on the cat's side. */
    const cl = CAT_X + INSET;
    const cr = CAT_X + CAT - INSET;
    const cb = GROUND - g.y - 4;
    const ct = GROUND - g.y - CAT + INSET + 10;
    for (const t of g.things) {
      const tt = GROUND - t.lift - t.h;
      const tb = GROUND - t.lift;
      if (cr > t.x + 3 && cl < t.x + t.w - 3 && cb > tt + 2 && ct < tb) {
        end();
        return false;
      }
    }
    return true;
  };

  const run = () => {
    let last = performance.now();
    let acc = 0;
    const frame = (now: number) => {
      const g = game.current;
      if (g.phase !== "running") return;
      /* Clamped, so a stall costs a stutter, not a teleport. */
      acc += Math.min((now - last) / 1000, 0.1);
      last = now;
      while (acc >= STEP) {
        acc -= STEP;
        if (!tick()) return;
      }
      const shown = Math.floor(g.dist / 10);
      if (shown !== g.shown) {
        g.shown = shown;
        setScore(shown);
      }
      /* In the air the pose holds still: one frame north-east while
         rising, one south-east while coming down, so the jump reads as
         a single clean arc. Only the ground run alternates its legs,
         on the distance covered. */
      const stride = Math.floor(g.dist / 28) % 2;
      const pose: PoseKey =
        g.y > 0
          ? g.vy > 0
            ? "run-ne-1"
            : "run-se-1"
          : stride ? "run-e-2" : "run-e-1";
      draw(pose);
      raf.current = requestAnimationFrame(frame);
    };
    raf.current = requestAnimationFrame(frame);
  };

  const start = () => {
    const g = game.current;
    Object.assign(g, {
      phase: "running" as Phase,
      y: 0, vy: 0, speed: START_SPEED, dist: 0,
      things: [], gap: 420, scroll: 0, shown: 0,
    });
    setScore(0);
    setAnnounce("");
    setPhase("running");
    stage.current?.focus();
    run();
  };

  const jump = () => {
    const g = game.current;
    if (g.phase !== "running") return start();
    if (g.y === 0) g.vy = JUMP_V;
  };

  /* A hidden tab stops the loop; coming back resumes it from where it
     was, and the clamp above eats the gap. */
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) cancelAnimationFrame(raf.current);
      else if (game.current.phase === "running") run();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Keys only while the stage has focus, so Space still scrolls the
     page for everyone not playing. */
  const onKey = (e: React.KeyboardEvent) => {
    if (e.repeat && game.current.phase !== "running") return;
    if ([" ", "ArrowUp", "w", "W", "Enter"].includes(e.key)) {
      e.preventDefault();
      if (e.key === "Enter" && game.current.phase === "running") return;
      jump();
    }
  };

  return (
    <div
      ref={stage}
      className={styles.stage}
      tabIndex={0}
      role="application"
      aria-label="Runner game: the cat jumps over parcels, cables and messages on a desk. Press Space or Enter to start, Space, Up or W to jump."
      onKeyDown={onKey}
      onPointerDown={(e) => {
        e.preventDefault();
        stage.current?.focus();
        jump();
      }}
    >
      <canvas ref={canvas} className={styles.canvas} aria-hidden="true" />

      {phase !== "idle" && (
        <p className={styles.score} aria-hidden="true">
          {String(score).padStart(5, "0")}
          {best > 0 && ` · best ${String(best).padStart(5, "0")}`}
        </p>
      )}

      {phase !== "running" && (
        <div className={styles.overlay}>
          <p className={styles.overlayTitle}>
            {phase === "idle" ? prompt : `Caught at ${score}`}
          </p>
          <p className={styles.overlayHint}>
            {/* Both wordings ship in the markup; CSS shows one. Touch
                screens get "tap" alone, so no JS device check is needed. */}
            <span className={styles.hintTouch}>
              {phase === "idle" ? "Tap to play" : "Tap to go again"}
            </span>
            <span className={styles.hintKeys}>
              {phase === "idle"
                ? "Press space or tap to play"
                : "Press space or tap to go again"}
            </span>
          </p>
        </div>
      )}

      <p className={styles.sr} aria-live="polite">{announce}</p>
    </div>
  );
}
