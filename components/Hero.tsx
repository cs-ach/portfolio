"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useMotionValueEvent, useScroll, useSpring, useTransform, useReducedMotion } from "motion/react";
import { PERSON, STANCE } from "@/lib/content";
import Arrow from "./Arrow";
import Social from "./ui/Social";
import styles from "./Hero.module.css";

/* The first screen.

   The section is two screens tall and its contents are stuck to the top,
   so the hero stays put while you scroll through it. That pin is what
   makes the portrait's journey readable: without it the portrait would
   be moving right at the same time as the whole composition slid up
   under the header, and the two movements cancel out.

   At rest the portrait sits in the middle with the name under it. As
   the pinned section is scrolled through, the portrait moves into the
   right-hand column and the name travels to its place at the left,
   where the rest of the text fades in around it.

   There is exactly one h1 and it is never hidden. An earlier version
   kept the settled heading at opacity 0 until you scrolled and drew a
   second, decorative copy in the middle; that left the page with no
   visible title on first paint, which is a real defect and not a
   stylistic one. The heading itself travels instead.

   Offsets are measured rather than guessed: a percentage of an
   element's own width would drift at every breakpoint. Measured against
   the pinned box on mount and on resize, then driven to zero by scroll
   progress. Only transforms animate, so nothing reflows. */

/* How much larger the portrait is while it is centred. Shared with the
   measurement so the name always clears the scaled height. */
const SCALE = 1.14;

/* The fraction of the pinned scroll the move takes. The remainder is
   dwell on the settled composition before the pin releases. */
const END = 0.62;

/* The space between the scaled portrait and the name while centred,
   and the least clearance kept between that column and the fixed bar
   above it or the bottom of the window below it. */
const NAME_GAP = 34;
const AIR = 24;

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  /* These two are the grid cells, never transformed, so measuring them
     reports where their contents belong at rest. Measuring the moving
     elements would read their translated positions, because
     getBoundingClientRect includes transforms. */
  const slotRef = useRef<HTMLDivElement>(null);
  const nameSlotRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const [o, setO] = useState({ px: 0, py: 0, nx: 0, ny: 0 });
  const [measured, setMeasured] = useState(false);

  const measure = useCallback(() => {
    const pin = pinRef.current;
    const slot = slotRef.current;
    const nameSlot = nameSlotRef.current;
    if (!pin || !slot || !nameSlot) return;

    /* Below this width the layout is one stacked column, the pin is off
       in CSS and the portrait is already where it belongs. There is
       nowhere to travel, so the effect is switched off rather than run
       against a zero-length journey. */
    if (window.innerWidth < 900) {
      setMeasured(false);
      return;
    }

    const box = pin.getBoundingClientRect();
    const p = slot.getBoundingClientRect();
    const n = nameSlot.getBoundingClientRect();
    if (box.width === 0 || p.width === 0) return;

    /* Measured against the pinned box, which is exactly the area that
       stays on screen, so the result does not depend on scroll
       position. The portrait sits above the middle; the name sits
       directly under its scaled height.

       Above the middle is only a preference. On a short window 40% of
       the height put the top of the scaled portrait under the fixed
       bar, so the centre is clamped: never higher than leaves the bar
       plus some air above the scaled edge, never lower than keeps the
       name on screen. The bar's height is read back from the pin's own
       top padding rather than repeated here. If even the clamp cannot
       satisfy both (the CSS shrinks the portrait by height so it should
       not come to that), the column is centred in the space under the
       bar instead of favouring either edge. Nothing in between can
       cross the bar either: the centre and the scale both travel in a
       straight line to a settled slot that is already below it, so the
       top edge does too. */
    const navH = parseFloat(getComputedStyle(pin).paddingTop) || 0;
    const half = (p.height * SCALE) / 2;
    const column = half * 2 + NAME_GAP + n.height;
    const highest = navH + AIR + half;
    const lowest = box.height - AIR - n.height - NAME_GAP - half;
    const portraitY =
      lowest >= highest
        ? Math.min(Math.max(box.height * 0.4, highest), lowest)
        : navH + (box.height - navH - column) / 2 + half;
    const centreX = box.width / 2;
    const nameY = portraitY + half + NAME_GAP + n.height / 2;

    setO({
      px: centreX - (p.left - box.left + p.width / 2),
      py: portraitY - (p.top - box.top + p.height / 2),
      nx: centreX - (n.left - box.left + n.width / 2),
      ny: nameY - (n.top - box.top + n.height / 2),
    });
    setMeasured(true);
  }, []);

  useEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (pinRef.current) ro.observe(pinRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  /* Progress spans exactly the pinned stretch: 0 when the section's top
     meets the viewport top, 1 when its bottom does. */
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  /* A spring on the progress value, not on each property, so everything
     separates as one gesture instead of drifting apart. Damped just
     about critically (2 * sqrt(stiffness * mass)), which settles as
     fast as possible without overshoot. */
  const soft = useSpring(scrollYProgress, { stiffness: 300, damping: 27, mass: 0.6 });

  /* The cat waits for this (components/oneko): it comes out from behind
     the portrait, so it must not come before the portrait has arrived
     where it is going. Announced once the spring has carried the move
     past END — the same END the transforms below map to, so it is the
     settled composition and not the first flick of the wheel.

     Both a flag and an event, for the same reason the loader uses both:
     the cat can mount either side of this moment. Hero's effects run
     before Oneko's, and a window restored part-way down the page is
     settled on its first reading, so an event alone would be dispatched
     into an empty room. The flag is the state, the event is the edge.

     It is dropped on unmount: the next landing-page visit in this
     document measures its own scroll from the top. */
  const announced = useRef(false);

  /* The journey's progress, read straight off the layout with the same
     offsets useScroll uses. The spring alone is not enough to decide
     this: while the loader has the page scaled into its machine, every
     rectangle inside #stage is the scaled one, so the progress measured
     from it is meaningless and can sit past END on a page nobody has
     scrolled — which brought the cat out during the introduction. After
     the loader the spring can still be holding that reading, because
     useScroll re-measures on a scroll event and a page at the top never
     sends one. So the spring says the motion has caught up and this
     says the page really is where the spring thinks it is; both have to
     agree.

     Below the pin's breakpoint there is no pinned stretch to measure
     against (the section is its own height), and no journey either; how
     far the hero has scrolled past the top is the honest answer there. */
  const travelled = useCallback(() => {
    const section = sectionRef.current;
    if (!section) return 0;

    const box = section.getBoundingClientRect();
    const span = box.height - window.innerHeight;
    const over = span > 0 ? span : box.height;

    return over > 0 ? Math.min(Math.max(-box.top / over, 0), 1) : 0;
  }, []);

  const announce = useCallback(
    (v: number) => {
      if (announced.current || v < END) return;
      if (document.documentElement.dataset.loading !== undefined) return;
      if (travelled() < END) return;

      announced.current = true;
      document.documentElement.dataset.heroSettled = "1";
      window.dispatchEvent(new Event("hero:settled"));
    },
    [travelled],
  );

  useMotionValueEvent(soft, "change", announce);

  /* Asked again when the loader hands the page back, for a window that
     was restored part-way down the page: the spring has nothing left to
     report there, and the scroll event that would have carried it never
     comes. */
  useEffect(() => {
    const ask = () => announce(soft.get());

    ask();
    window.addEventListener("preloader:done", ask);

    return () => {
      window.removeEventListener("preloader:done", ask);
      announced.current = false;
      delete document.documentElement.dataset.heroSettled;
    };
  }, [announce, soft]);

  const portraitX = useTransform(soft, [0, END], [o.px, 0]);
  const portraitY = useTransform(soft, [0, END], [o.py, 0]);
  const portraitScale = useTransform(soft, [0, END], [SCALE, 1]);
  const nameX = useTransform(soft, [0, END], [o.nx, 0]);
  const nameY = useTransform(soft, [0, END], [o.ny, 0]);
  /* The supporting copy is the only thing that fades, and it starts
     fading almost immediately so the hero never looks half-built. */
  const restOpacity = useTransform(soft, [0.08, 0.5], [0, 1]);
  const restX = useTransform(soft, [0.08, 0.5], [-24, 0]);

  const animate = !reduced && measured;

  return (
    <section ref={sectionRef} className={styles.hero}>
      <div ref={pinRef} className={styles.pin}>
        <div className={`wrap ${styles.grid}`}>
          <div className={styles.text}>
            <div ref={nameSlotRef} className={styles.nameSlot}>
              <motion.h1
                className={`display ${styles.name}`}
                style={animate ? { x: nameX, y: nameY } : undefined}
              >
                {PERSON.name}
              </motion.h1>
            </div>

            <motion.div
              className={styles.rest}
              style={animate ? { x: restX, opacity: restOpacity } : undefined}
            >
              <p className={`lead ${styles.line}`}>{STANCE.line}</p>
              <p className={styles.sub}>{STANCE.sub}</p>

              <div className={styles.actions}>
                <a href="#work" className="pill pill-solid act act-nudge" data-dir="down">
                  View my work
                  <Arrow dir="down" />
                </a>
                <a href="/resume/" className="pill pill-ghost act act-nudge" data-dir="right">
                  Resume
                  <Arrow dir="right" />
                </a>
              </div>

              <Social className={styles.social} />
            </motion.div>
          </div>

          <div ref={slotRef} className={styles.portraitSlot}>
            <motion.figure
              className={styles.portraitWrap}
              /* Where the cat comes from, once this has settled. */
              data-portrait
              style={
                animate
                  ? { x: portraitX, y: portraitY, scale: portraitScale }
                  : undefined
              }
            >
              <Image
                src="/assets/adwin-face.jpg"
                alt={PERSON.name}
                width={620}
                height={620}
                priority
                className={styles.portrait}
                sizes="(max-width: 900px) 64vw, 30vw"
              />
            </motion.figure>
          </div>
        </div>
      </div>
    </section>
  );
}
