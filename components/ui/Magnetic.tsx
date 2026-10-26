"use client";

import { useRef, type ReactNode } from "react";
import { motion, useMotionValue, useSpring, useReducedMotion } from "motion/react";

/* A target that leans toward the pointer while the pointer is near it.

   This is a component rather than a hook helper on purpose: it calls
   useMotionValue and useSpring, so folding it into a function that
   other components call conditionally would break the rules of hooks.
   Wrap the thing you want magnetised instead.

   `strength` is the fraction of the pointer's offset the element
   travels. Past about 0.4 it stops reading as attraction and starts
   reading as a bug. */
/* Read --press off the document rather than hard-coding 0.97, so the
   token stays the single place the press depth is decided. Falls back
   if the variable is missing (SSR, or a detached test render). */
function pressScale() {
  if (typeof window === "undefined") return 0.97;
  const v = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--press"),
  );
  return Number.isFinite(v) && v > 0 ? v : 0.97;
}

export default function Magnetic({
  children,
  strength = 0.28,
  className,
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 260, damping: 26, mass: 0.5 });
  const sy = useSpring(y, { stiffness: 260, damping: 26, mass: 0.5 });

  /* The press, as its own motion value rather than a CSS :active rule.
     A CSS transform here would be overwritten the moment the spring
     writes the next frame of x/y; routing it through the same style
     object lets motion compose the translate and the scale into one
     transform instead of the two fighting over the property.

     It gets a stiffer, barely-damped spring than the lean does, for
     the same reason --d-press is quicker than --d-fast in the shared
     contract (design/08-INTERACTION.md): a press has to be felt as
     contact, not as a glide. --press is 0.97 there; this reads the
     token so the two can never drift apart. */
  const scale = useMotionValue(1);
  const sScale = useSpring(scale, { stiffness: 520, damping: 30, mass: 0.4 });
  const press = (down: boolean) => scale.set(down ? pressScale() : 1);

  if (reduced) return <span className={className}>{children}</span>;

  return (
    <motion.span
      ref={ref}
      className={className}
      style={{ x: sx, y: sy, scale: sScale, display: "inline-block", willChange: "transform" }}
      onPointerDown={() => press(true)}
      /* Up, cancel and leave all release it. Without the last two a
         pointer that slides off the element, or a gesture the browser
         takes over for scrolling, leaves it stuck pressed in. */
      onPointerUp={() => press(false)}
      onPointerCancel={() => press(false)}
      onPointerMove={(e) => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
        press(false);
      }}
    >
      {children}
    </motion.span>
  );
}
