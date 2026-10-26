import type { ReactNode } from "react";
import { motionValue, type MotionValue } from "motion/react";
import type { DeviceKind } from "../project/Device";

export type Binding = {
  kind: DeviceKind;
  label: string;
  screen: ReactNode;
  progress: MotionValue<number>;
  sx: MotionValue<number>;
  sy: MotionValue<number>;
  settled: MotionValue<number>;
  turns: boolean;
  float: boolean;
};

type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type Slot = {
  el: HTMLElement;
  clip: HTMLElement | null;
  binding: Binding;
};

type Travel = {
  from: Rect;
  fromPose: number;
  to: Rect | null;
  toPose: number;
  k0: number;
  end: number;
  start: number | null;
  ms: number;
  /*
   * A travel started outside a view transition is measured in frames
   * actually drawn, not wall-clock time: the arriving page's first
   * render blocks the thread for longer than the travel itself, and a
   * wall clock would spend the whole animation inside that block and
   * arrive already finished. `elapsed` only advances when a frame
   * runs, and each step is capped, so a stall delays the travel
   * instead of eating it.
   */
  frames: boolean;
  elapsed: number;
  last: number | null;
};

export type Entry = {
  slug: string;
  want: boolean;
  ready: boolean;
  failed: boolean;
  slot: Slot | null;
  binding: Binding | null;
  node: HTMLElement | null;
  rect: Rect | null;
  /* Where the seat was last placed, in DOCUMENT coordinates: the number
     that was actually written to its transform. The write is compared
     against this rather than against `rect`, which is in viewport
     coordinates and changes on every scroll even when the seat has not
     moved on the page at all. */
  at: { x: number; y: number } | null;
  swing: MotionValue<number>;
  pose: MotionValue<number>;
  travel: Travel | null;
};

const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();

let version = 0;

const emit = () => {
  version += 1;

  listeners.forEach((listener) => listener());
};

export const subscribe = (listener: () => void) => {
  listeners.add(listener);

  return () => listeners.delete(listener);
};

export const getVersion = () => version;

export const allEntries = () => [...entries.values()];

export const entryOf = (slug: string) => entries.get(slug);

const ensure = (slug: string) => {
  let entry = entries.get(slug);

  if (!entry) {
    entry = {
      slug,
      want: false,
      ready: false,
      failed: false,
      slot: null,
      binding: null,
      node: null,
      rect: null,
      at: null,
      swing: motionValue(0),
      pose: motionValue(-1),
      travel: null,
    };

    entries.set(slug, entry);
  }

  return entry;
};

export function attach(
  slug: string,
  el: HTMLElement,
  binding: Binding,
) {
  const entry = ensure(slug);

  const clip = el.closest<HTMLElement>("[data-hero] > *");

  const changed =
    entry.slot?.el !== el ||
    entry.binding !== binding;

  entry.slot = {
    el,
    clip,
    binding,
  };

  entry.binding = binding;

  if (changed) emit();

  sync();
}

export function detach(slug: string, el: HTMLElement) {
  const entry = entries.get(slug);

  if (!entry || entry.slot?.el !== el) return;

  entry.slot = null;

  emit();
}

export function want(slug: string) {
  const entry = ensure(slug);

  if (entry.want) return;

  entry.want = true;

  emit();
}

export function markReady(slug: string) {
  const entry = ensure(slug);

  if (entry.ready) return;

  entry.ready = true;

  emit();
}

export function markFailed(slug: string) {
  const entry = ensure(slug);

  if (entry.failed) return;

  entry.failed = true;

  emit();
}

export function setNode(
  slug: string,
  node: HTMLElement | null,
) {
  const entry = ensure(slug);

  entry.node = node;
  entry.rect = null;
  entry.at = null;

  if (node) sync();
}

export const TRAVEL_MS = 900;

export function beginTravel(slug: string) {
  const entry = entries.get(slug);

  if (
    !entry ||
    !entry.rect ||
    !entry.ready ||
    entry.failed
  ) {
    return false;
  }

  const currentPose = entry.pose.get();

  const fromPose =
    currentPose >= 0
      ? currentPose
      : entry.binding?.progress.get() ?? 1;

  entry.travel = {
    from: { ...entry.rect },
    fromPose,
    to: null,
    toPose: fromPose,
    k0: 0,
    end: 1,
    start: null,
    ms: TRAVEL_MS,
    frames: false,
    elapsed: 0,
    last: null,
  };

  entry.pose.set(fromPose);

  return true;
}

export function startTravel(
  start?: number,
  ms?: number,
  frames = false,
) {
  const now = performance.now();

  entries.forEach((entry) => {
    const travel = entry.travel;

    if (!travel || travel.start !== null) return;

    travel.frames = frames;
    travel.elapsed = 0;
    travel.last = null;

    travel.start =
      typeof start === "number" && Number.isFinite(start)
        ? start
        : now;

    if (
      typeof ms === "number" &&
      Number.isFinite(ms) &&
      ms > 0
    ) {
      travel.ms = ms;
    }
  });

  sync();
}

export const travelling = () =>
  [...entries.values()].some(
    (entry) => entry.travel !== null,
  );

/* View-transition easing: cubic-bezier(0.65, 0, 0.25, 1). */
const bezier = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) => {
  const curve = (
    a: number,
    b: number,
    t: number,
  ) =>
    3 * a * t * (1 - t) ** 2 +
    3 * b * t * t * (1 - t) +
    t ** 3;

  return (x: number) => {
    let lo = 0;
    let hi = 1;

    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;

      if (curve(x1, x2, mid) < x) {
        lo = mid;
      } else {
        hi = mid;
      }
    }

    return curve(y1, y2, (lo + hi) / 2);
  };
};

const vtEase = bezier(0.65, 0, 0.25, 1);

const swingAt = (t: number) => {
  if (t <= 0 || t >= 1) return 0;

  if (t < 0.45) {
    const u = t / 0.45;

    return 1 - (1 - u) ** 3;
  }

  const u = (t - 0.45) / 0.55;

  return 1 - (
    u < 0.5
      ? 4 * u ** 3
      : 1 - (-2 * u + 2) ** 3 / 2
  );
};

const lerp = (
  a: number,
  b: number,
  t: number,
) => a + (b - a) * t;

const clamp01 = (value: number) =>
  Math.max(0, Math.min(1, value));

const lerpRect = (
  a: Rect,
  b: Rect,
  t: number,
): Rect => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  w: lerp(a.w, b.w, t),
  h: lerp(a.h, b.h, t),
});

const rectOf = (el: HTMLElement): Rect => {
  const box = el.getBoundingClientRect();

  return {
    x: box.left,
    y: box.top,
    w: box.width,
    h: box.height,
  };
};

/* Ignore insignificant layout noise when comparing destinations. */
const MOVED = 1;

/* Avoid insignificant canvas drawing-buffer resizes. */
const SIZE_EPSILON = 0.25;

/* The longest step a frame-driven travel may take from one frame to
   the next. Anything above this is a stall, not motion. */
const MAX_TRAVEL_STEP = 50;

/* Give late destinations a short additional landing leg. */
const MIN_LANDING_SECONDS = 0.18;

const moved = (a: Rect, b: Rect) =>
  Math.abs(a.x - b.x) >= MOVED ||
  Math.abs(a.y - b.y) >= MOVED ||
  Math.abs(a.w - b.w) >= MOVED ||
  Math.abs(a.h - b.h) >= MOVED;

export function sync() {
  const now = performance.now();

  entries.forEach((entry) => {
    const node = entry.node;

    if (!node) return;

    /*
     * Both the canvas rectangle and the destination rectangle are
     * expressed in viewport coordinates.
     */
    const slotRect = entry.slot
      ? rectOf(entry.slot.el)
      : null;

    let rect: Rect | null = slotRect;
    let on = !!entry.slot;

    const travel = entry.travel;

    if (travel) {
      on = true;

      if (travel.frames && travel.start !== null) {
        /*
         * Advance only by time that a drawn frame accounted for. The
         * cap turns a stall into a pause rather than a jump; sync may
         * run more than once in a frame, which simply adds ~0.
         */
        const previous = travel.last ?? now;

        travel.elapsed += Math.min(
          Math.max(0, now - previous),
          MAX_TRAVEL_STEP,
        );

        travel.last = now;
      }

      const raw =
        travel.start === null
          ? 0
          : travel.frames
            ? Math.max(0, travel.elapsed / travel.ms)
            : Math.max(
                0,
                (now - travel.start) / travel.ms,
              );

      /*
       * Compute the position currently displayed using the old leg
       * before changing its destination or timing.
       */
      const oldK = vtEase(
        clamp01(raw / travel.end),
      );

      const oldU =
        travel.k0 >= 1
          ? 1
          : clamp01(
              (oldK - travel.k0) /
                (1 - travel.k0),
            );

      const currentRect = travel.to
        ? lerpRect(
            travel.from,
            travel.to,
            oldU,
          )
        : { ...travel.from };

      const currentPose = lerp(
        travel.fromPose,
        travel.toPose,
        oldU,
      );

      /*
       * Read the live destination and its target pose.
       */
      const targetRect = slotRect;

      const targetPose =
        targetRect && entry.binding
          ? entry.binding.progress.get()
          : travel.toPose;

      const targetChanged =
        targetRect !== null &&
        (
          travel.to === null ||
          moved(travel.to, targetRect) ||
          Math.abs(targetPose - travel.toPose) > 0.0005
        );

      if (targetChanged && targetRect) {
        const firstTarget = travel.to === null;
        const deadlinePassed = raw >= travel.end;

        /*
         * Extend the deadline before calculating the new easing
         * position. Otherwise a late destination can cause k0 = 1,
         * making the next animation leg finish immediately.
         */
        if (firstTarget || deadlinePassed) {
          travel.end = Math.max(
            travel.end,
            raw + MIN_LANDING_SECONDS,
          );
        }

        /*
         * Retarget from the current displayed rectangle rather than
         * the original source, so a destination update doesn't snap.
         */
        travel.from = currentRect;
        travel.fromPose = currentPose;

        travel.to = { ...targetRect };
        travel.toPose = targetPose;

        travel.k0 = vtEase(
          clamp01(raw / travel.end),
        );
      }

      /*
       * Compute this frame's progress after applying target updates.
       */
      const k = vtEase(
        clamp01(raw / travel.end),
      );

      const u =
        travel.k0 >= 1
          ? 1
          : clamp01(
              (k - travel.k0) /
                (1 - travel.k0),
            );

      const landed =
        travel.to !== null &&
        raw >= travel.end;

      if (landed && slotRect) {
        /*
         * Use the actual destination rectangle on the landing frame.
         */
        rect = slotRect;
      } else if (travel.to) {
        rect = lerpRect(
          travel.from,
          travel.to,
          u,
        );
      } else {
        rect = { ...travel.from };
      }

      const pose = landed
        ? travel.toPose
        : lerp(
            travel.fromPose,
            travel.toPose,
            u,
          );

      entry.swing.set(swingAt(clamp01(raw)));
      entry.pose.set(pose);

      if (
        landed ||
        (!travel.to && raw >= travel.end + 1)
      ) {
        /*
         * Preserve the final pose instead of resetting it to -1.
         */
        entry.travel = null;

        entry.swing.set(0);

        on = !!entry.slot;

        if (!entry.slot) {
          emit();
        }
      }
    }

    /*
     * Keep the persistent canvas visible while travelling.
     */
    if (on !== (node.dataset.on !== undefined)) {
      if (on) {
        node.dataset.on = "";
      } else {
        delete node.dataset.on;
      }
    }

    if (!rect) return;

    const previous = entry.rect;

    /*
     * Place the seat in document coordinates. Everything above is
     * measured and interpolated in viewport coordinates — the travel
     * crosses a navigation, and the only frame the two pages share is
     * the window's — and the scroll offset is added here, at the one
     * point where a number is written to the page.
     *
     * The layer is anchored to the document rather than to the window
     * (DeviceLayer.module.css), so this is what keeps a resting seat
     * still under a scroll the main thread does not drive: the viewport
     * rectangle and the scroll offset move by the same amount and in
     * opposite directions, their sum does not change, and nothing is
     * written at all. A frame late is then a frame late with the right
     * answer.
     *
     * Position stays fractional during travel for smooth movement.
     */
    const pageX = rect.x + window.scrollX;
    const pageY = rect.y + window.scrollY;
    const at = entry.at;

    if (
      !at ||
      Math.abs(at.x - pageX) > 0.01 ||
      Math.abs(at.y - pageY) > 0.01
    ) {
      node.style.transform =
        `translate3d(${pageX}px, ${pageY}px, 0)`;

      entry.at = { x: pageX, y: pageY };
    }

    /*
     * Animate actual dimensions instead of CSS scale. CSS scaling
     * would distort measurements and risk scaling the 3D canvas twice.
     */
    const width = entry.travel
      ? rect.w
      : Math.round(rect.w);

    const height = entry.travel
      ? rect.h
      : Math.round(rect.h);

    if (
      !previous ||
      Math.abs(previous.w - width) > SIZE_EPSILON ||
      Math.abs(previous.h - height) > SIZE_EPSILON
    ) {
      node.style.width = `${width}px`;
      node.style.height = `${height}px`;
    }

    entry.rect = {
      x: rect.x,
      y: rect.y,
      w: width,
      h: height,
    };

    /*
     * Clip the stationary canvas to its hero stage. During travel,
     * leave it unclipped so the device can move between pages.
     */
    const clip =
      !entry.travel && entry.slot?.clip
        ? rectOf(entry.slot.clip)
        : null;

    if (clip && slotRect) {
      const top = Math.max(
        0,
        clip.y - rect.y,
      );

      const left = Math.max(
        0,
        clip.x - rect.x,
      );

      const bottom = Math.max(
        0,
        rect.y +
          height -
          (clip.y + clip.h),
      );

      const right = Math.max(
        0,
        rect.x +
          width -
          (clip.x + clip.w),
      );

      node.style.clipPath =
        `inset(${top}px ${right}px ${bottom}px ${left}px)`;
    } else {
      node.style.clipPath = "";
    }
  });
}

let raf = 0;
let users = 0;

export function startLoop() {
  users += 1;

  if (users === 1) {
    const tick = () => {
      sync();

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
  }

  return () => {
    users -= 1;

    if (users === 0) {
      cancelAnimationFrame(raf);
    }
  };
}
