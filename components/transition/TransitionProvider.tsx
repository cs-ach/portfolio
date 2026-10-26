"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import Lenis from "lenis";
import {
  TRAVEL_MS,
  beginTravel,
  startTravel,
  sync as syncDevices,
  travelling,
} from "../three/deviceStore";

const SETTLE_TIMEOUT = 2500;

const norm = (p: string) =>
  p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p;

type Pending = {
  path: string;
  resolve: () => void;
};

const publishBar = () => {
  const bar = document.querySelector<HTMLElement>("[data-site-nav]");

  if (!bar) return;

  document.documentElement.style.setProperty(
    "--bar-h",
    `${bar.getBoundingClientRect().height}px`,
  );
};

export default function TransitionProvider() {
  const router = useRouter();
  const pathname = usePathname();

  const pending = useRef<Pending | null>(null);
  const lenis = useRef<Lenis | null>(null);
  const busy = useRef(false);

  useLayoutEffect(() => {
    const current = pending.current;

    if (current && norm(current.path) === norm(pathname)) {
      pending.current = null;
      current.resolve();
    }
  }, [pathname]);

  useLayoutEffect(() => {
    const bar = document.querySelector<HTMLElement>("[data-site-nav]");

    if (!bar) return;

    const root = document.documentElement;

    publishBar();

    const observer = new ResizeObserver(() => {
      publishBar();
    });

    observer.observe(bar);

    return () => {
      observer.disconnect();
      root.style.removeProperty("--bar-h");
    };
  }, []);

  useEffect(() => {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );

    if (reducedMotion.matches) return;

    const instance = new Lenis({
      autoRaf: true,
      anchors: { offset: -64 },
    });

    lenis.current = instance;

    const offScroll = instance.on("scroll", syncDevices);

    const root = document.documentElement;

    const updateScrollState = () => {
      if (root.hasAttribute("data-loading")) {
        instance.stop();
      } else {
        instance.start();
      }
    };

    updateScrollState();

    const observer = new MutationObserver(updateScrollState);

    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-loading"],
    });

    return () => {
      observer.disconnect();
      offScroll();
      instance.destroy();
      lenis.current = null;
    };
  }, []);

  useEffect(() => {
    const scrollTop = (hash: string) => {
      const target = hash
        ? document.getElementById(decodeURIComponent(hash.slice(1)))
        : null;

      const navHeight =
        document
          .querySelector("[data-site-nav]")
          ?.getBoundingClientRect().height ?? 64;

      const y = target
        ? target.getBoundingClientRect().top +
          window.scrollY -
          navHeight
        : 0;

      window.scrollTo({
        top: y,
        behavior: "instant",
      });

      lenis.current?.scrollTo(y, {
        immediate: true,
        force: true,
      });
    };

    const named: HTMLElement[] = [];

    const name = (
      element: Element | null | undefined,
      transitionName: string,
    ) => {
      if (!(element instanceof HTMLElement)) return;

      element.style.viewTransitionName = transitionName;
      named.push(element);
    };

    const clearNames = () => {
      named.splice(0).forEach((element) => {
        element.style.viewTransitionName = "";
      });
    };

    const showNow = (element: HTMLElement) => {
      if (!element.hasAttribute("data-reveal")) return;

      element.style.transition = "none";
      element.dataset.shown = "true";

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          element.style.transition = "";
        });
      });
    };

    /* The view-transition easing, so everything that moves across a
       hand-over — the stage, the title, the device — runs on one curve. */
    const VT_EASE = "cubic-bezier(0.65, 0, 0.25, 1)";

    type Shot = { rect: DOMRect; font: number };

    /* What a named part looks like on the page being left. */
    const shoot = (
      scope: ParentNode,
      key: string,
    ): Shot | null => {
      const el = scope.querySelector<HTMLElement>(`[data-vt-src="${key}"]`);

      if (!el) return null;

      const rect = el.getBoundingClientRect();

      if (!rect.width || !rect.height) return null;

      /* Only what the reader can actually see travels. A part scrolled
         out of the hero would otherwise be played in from off-screen,
         which is a longer journey than the one being made. The view
         transition paired its groups on the same test. */
      if (rect.bottom <= 0 || rect.top >= window.innerHeight) return null;

      return { rect, font: parseFloat(getComputedStyle(el).fontSize) };
    };

    /*
     * Play the arriving part from where the leaving one was. The device
     * is carried by its own layer; these are the parts that used to be
     * carried by the view transition's groups and are not any more, so
     * without this the hero cuts while the device alone moves, which
     * reads as the snap the live travel was meant to remove.
     *
     * `text` scales uniformly from the font size and works about the
     * centre: the title is ranged right on a page and left in a list,
     * so matching corners would slide it sideways through its own
     * setting, and scaling the axes apart would smear the letters. The
     * stage is a flat field of colour, so it takes the two axes
     * independently and simply extends into its new shape.
     */
    const morph = (
      key: string,
      from: Shot | null,
      text: boolean,
    ) => {
      if (!from) return;

      const el =
        document.querySelector<HTMLElement>(`[data-vt-dst="${key}"]`) ??
        document.querySelector<HTMLElement>(`[data-vt-src="${key}"]`);

      if (!el) return;

      showNow(el);

      const to = el.getBoundingClientRect();

      if (!to.width || !to.height) return;

      const first = text
        ? (() => {
            const scale = from.font / parseFloat(getComputedStyle(el).fontSize);
            const dx =
              from.rect.left + from.rect.width / 2 - (to.left + to.width / 2);
            const dy =
              from.rect.top + from.rect.height / 2 - (to.top + to.height / 2);

            return `translate(${dx}px, ${dy}px) scale(${scale})`;
          })()
        : `translate(${from.rect.left - to.left}px, ${from.rect.top - to.top}px)` +
          ` scale(${from.rect.width / to.width}, ${from.rect.height / to.height})`;

      el.animate(
        [{ transform: first }, { transform: "none" }],
        {
          duration: TRAVEL_MS,
          easing: VT_EASE,
          fill: "both",
          composite: "replace",
        },
      ).addEventListener("finish", () => {
        el.style.transform = "";
      });

      el.style.transformOrigin = text ? "center" : "top left";
    };

    /* Everything that is not morphing comes up rather than cutting in:
       the hero's own captions, then the rest of the page under it. The
       stage is left out of it — it is the background, and it extends
       into place instead of fading. */
    const raise = () => {
      const hero = document.querySelector("[data-hero]");

      const parts: Element[] = [];

      /* The captions, one by one rather than their wrapper: on a page
         the wrapper is `display: contents` and has no box of its own to
         fade. The title is left out (it travels) and so is the plinth,
         which is a sibling of theirs and holds the device. */
      const text = hero?.querySelector("[class*='text']");

      if (text) {
        text.querySelectorAll(":scope > *").forEach((el) => {
          if (el.hasAttribute("data-vt-dst") || el.hasAttribute("data-vt-src")) return;

          parts.push(el);
        });
      }

      document.querySelectorAll("main > *").forEach((el) => {
        if (hero && (el === hero || el.contains(hero))) return;

        parts.push(el);
      });

      parts.forEach((el) =>
        (el as HTMLElement).animate(
          [{ opacity: 0 }, { opacity: 1 }],
          {
            duration: Math.round(TRAVEL_MS * 0.7),
            easing: VT_EASE,
            fill: "both",
          },
        ),
      );
    };

    /*
     * Hero navigations move the persistent device layer instead of a
     * snapshot of it, so they do not use a view transition.
     *
     * A view transition lifts the layer out of the root snapshot
     * (globals.css, `view-transition-name: device-layer`) and then
     * holds it as a STATIC pseudo-element for the whole transition.
     * That snapshot is captured after the arriving slot has already
     * been measured, so the device is painted at its destination from
     * the first frame while the real layer lerps underneath, unseen.
     * The result is a hard cut rather than a move.
     *
     * Driving the travel directly keeps the live canvas on screen the
     * whole way, which is the case the travel in deviceStore was
     * written for: one clock, one continuously measured rectangle.
     */
    const heroNavigate = async (
      href: string,
      url: URL,
      shots: { hero: Shot | null; title: Shot | null },
    ) => {
      const root = document.documentElement;

      /*
       * No capture is taken, so the layer must not keep a transition
       * name: it would only add a stray containment context.
       */
      delete root.dataset.vt;

      root.dataset.heroNav = "";

      lenis.current?.stop();

      await new Promise<void>((resolve) => {
        let timedOut = false;

        const timer = window.setTimeout(() => {
          timedOut = true;
          resolve();
        }, SETTLE_TIMEOUT);

        pending.current = {
          path: url.pathname,

          resolve: () => {
            window.clearTimeout(timer);

            if (timedOut) {
              scrollTop(url.hash);
            } else {
              resolve();
            }
          },
        };

        router.push(href, { scroll: false });
      });

      publishBar();
      scrollTop(url.hash);

      /*
       * Resolve layout so the arriving slot measures at its final box
       * before the travel reads it as the destination.
       */
      document.documentElement.getBoundingClientRect();

      /* The stage extends and the title travels; everything else that
         changed comes up behind them. */
      morph("hero", shots.hero, false);
      morph("hero-title", shots.title, true);
      raise();

      syncDevices();

      /*
       * Frame-driven: the arriving page's first render blocks the
       * thread for longer than the travel lasts, and a wall clock
       * would run out inside that block and land the device already
       * arrived. Measured in frames, the stall delays the travel.
       */
      startTravel(performance.now(), TRAVEL_MS, true);

      /*
       * Tick it here for its whole length rather than relying on the
       * device layer's shared loop. Lenis is stopped across a
       * hand-over, so the syncs it drives stop with it, and the travel
       * is only a lerp: it moves exactly as often as it is synced.
       * The two ticks are idempotent — sync writes only what changed.
       */
      const deadline = performance.now() + TRAVEL_MS * 6;

      const step = () => {
        syncDevices();

        if (travelling() && performance.now() < deadline) {
          window.requestAnimationFrame(step);

          return;
        }

        delete root.dataset.heroNav;

        busy.current = false;

        lenis.current?.start();

        syncDevices();
      };

      window.requestAnimationFrame(step);
    };

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;

      if (
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const anchor = (event.target as Element | null)?.closest("a");

      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (!anchor.href) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      if (anchor.dataset.noTransition !== undefined) return;

      const url = new URL(anchor.href, location.href);

      if (url.origin !== location.origin) return;

      if (norm(url.pathname) === norm(location.pathname)) return;

      if (
        !document.startViewTransition ||
        document.visibilityState !== "visible" ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (busy.current) return;

      busy.current = true;

      const onScreen = (element: Element) => {
        const rect = element.getBoundingClientRect();

        return (
          rect.bottom > 0 &&
          rect.top < window.innerHeight &&
          rect.width > 0 &&
          rect.height > 0
        );
      };

      const sources = [
        ...anchor.querySelectorAll<HTMLElement>("[data-vt-src]"),
      ].filter(onScreen);

      const keys = sources.map((element) => element.dataset.vtSrc!);

      const root = document.documentElement;

      const hero = keys.includes("hero");

      root.dataset.vt = hero
        ? "hero"
        : keys.length
          ? "morph"
          : "slide";

      sources.forEach((element) => {
        name(element, `vt-${element.dataset.vtSrc}`);
      });

      const slug = hero
        ? /^\/work\/([^/]+)/.exec(url.pathname)?.[1]
        : undefined;

      const carried = slug ? beginTravel(slug) : false;

      const href = url.pathname + url.search + url.hash;

      /*
       * The device carries the continuity on a hero navigation, so it
       * travels live rather than through a frozen snapshot.
       */
      if (carried) {
        const shots = {
          hero: shoot(anchor, "hero"),
          title: shoot(anchor, "hero-title"),
        };

        clearNames();

        heroNavigate(href, url, shots);

        return;
      }

      const transition = document.startViewTransition(async () => {
        clearNames();

        lenis.current?.stop();

        await new Promise<void>((resolve) => {
          let timedOut = false;

          const timer = window.setTimeout(() => {
            timedOut = true;
            resolve();
          }, SETTLE_TIMEOUT);

          pending.current = {
            path: url.pathname,

            resolve: () => {
              window.clearTimeout(timer);

              if (timedOut) {
                scrollTop(url.hash);
              } else {
                resolve();
              }
            },
          };

          router.push(href, { scroll: false });
        });

        /*
         * Publish the real navigation-bar height before measuring the
         * destination, then reset scrolling before the new snapshot.
         */
        publishBar();
        scrollTop(url.hash);

        /*
         * Force layout to resolve synchronously.
         */
        document.documentElement.getBoundingClientRect();

        /*
         * Pair shared elements on the arriving page.
         */
        for (const key of keys) {
          const target = document.querySelector<HTMLElement>(
            `[data-vt-dst="${key}"]`,
          );

          if (target && onScreen(target)) {
            showNow(target);
            name(target, `vt-${key}`);
          }
        }

        /*
         * Update the persistent device layer after the destination
         * page has committed and its initial layout has been resolved.
         */
        syncDevices();
      });

      /*
       * Use the actual hero group's animation clock, not the first
       * arbitrary view-transition animation.
       */
      const clock = () => {
        const animation = document.getAnimations().find((candidate) => {
          const effect = candidate.effect as KeyframeEffect | null;

          return (
            effect?.pseudoElement ===
            "::view-transition-group(vt-hero)"
          );
        });

        const startTime =
          typeof animation?.startTime === "number"
            ? animation.startTime
            : undefined;

        const duration =
          animation?.effect?.getComputedTiming().activeDuration;

        startTravel(
          startTime,
          typeof duration === "number" &&
            Number.isFinite(duration) &&
            duration > 0
            ? duration
            : undefined,
        );
      };

      if (carried) {
        transition.ready.then(
          clock,
          () => startTravel(),
        );
      }

      const watchdog = window.setTimeout(() => {
        transition.skipTransition();

        if (norm(location.pathname) !== norm(url.pathname)) {
          router.push(href);
        }
      }, SETTLE_TIMEOUT + 2000);

      transition.finished
        .catch(() => {
          // A skipped or cancelled transition is not fatal.
        })
        .finally(() => {
          if (carried) {
            startTravel();
          }

          window.clearTimeout(watchdog);

          clearNames();

          delete root.dataset.vt;

          busy.current = false;

          lenis.current?.start();

          syncDevices();
        });
    };

    const warmed = new Set<string>();

    const warm = (event: Event) => {
      const anchor = (event.target as Element | null)?.closest("a");

      if (!(anchor instanceof HTMLAnchorElement)) return;

      const url = new URL(anchor.href, location.href);

      if (url.origin !== location.origin) return;
      if (warmed.has(url.pathname)) return;

      warmed.add(url.pathname);

      router.prefetch(url.pathname);
    };

    document.addEventListener("click", onClick, { capture: true });
    document.addEventListener("pointerover", warm, { passive: true });
    document.addEventListener("focusin", warm);

    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      document.removeEventListener("pointerover", warm);
      document.removeEventListener("focusin", warm);
    };
  }, [router]);

  return null;
}