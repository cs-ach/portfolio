"use client";

import { Component, useEffect, useSyncExternalStore, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { loadHeroScene } from "./heroScene";
import {
  allEntries,
  getVersion,
  markFailed,
  markReady,
  setNode,
  startLoop,
  subscribe,
  type Entry,
} from "./deviceStore";
import styles from "./DeviceLayer.module.css";

/* The persistent device layer: every project's 3D device, for the whole
   visit (see deviceStore.ts for why it lives here and not in the hero).

   Mounted once by the root layout, outside #stage and outside the page,
   so a route change never unmounts it. A fixed, full-window,
   pointer-events-none box; each project that has asked for its model gets
   one seat in it, and the seat is laid over that project's slot by the
   store's frame loop. At most one seat per project, three projects, so at
   most three WebGL contexts from here.

   Page transitions must not photograph it: a canvas inside the old
   page's snapshot is a still picture, and the device would freeze for
   the length of the move. For the hero hand-over it is given its own
   view-transition-name (globals.css), its old image is hidden and its
   new one is the live element, so the canvas keeps drawing while it
   travels. Other transitions photograph it with the page, which is what
   they should do: there the devices leave with the page they were on. */

const DeviceScene = dynamic(() => loadHeroScene(), { ssr: false, loading: () => null });

export default function DeviceLayer() {
  useSyncExternalStore(subscribe, getVersion, () => 0);
  useEffect(() => startLoop(), []);
  const seats = allEntries().filter((e) => e.want && e.binding && !e.failed);
  return (
    <div className={styles.layer} data-device-layer aria-hidden={seats.some((e) => e.slot) ? undefined : true}>
      {seats.map((e) => (
        <Seat key={e.slug} entry={e} />
      ))}
    </div>
  );
}

function Seat({ entry }: { entry: Entry }) {
  const b = entry.binding!;
  const attached = !!entry.slot;
  return (
    <div
      ref={(n) => setNode(entry.slug, n)}
      className={styles.seat}
      data-kind={b.kind}
      data-slug={entry.slug}
      data-ready={entry.ready ? "" : undefined}
      aria-hidden={attached ? undefined : true}
    >
      <SceneBoundary onError={() => markFailed(entry.slug)}>
        <DeviceScene
          kind={b.kind}
          screen={b.screen}
          label={b.label}
          progress={b.progress}
          sx={b.sx}
          sy={b.sy}
          settled={b.settled}
          swing={entry.swing}
          pose={entry.pose}
          turns={b.turns}
          /* No float for a device nobody can see: it would ask for a frame
             forever. */
          float={b.float && attached}
          onReady={() => markReady(entry.slug)}
        />
      </SceneBoundary>
    </div>
  );
}

/* Anything the scene throws (a failed chunk, a renderer that will not
   start) marks the project failed, which drops its seat and leaves the
   slot's static stand-in in place instead of taking the page down. */
class SceneBoundary extends Component<{ onError: () => void; children: ReactNode }, { broken: boolean }> {
  state = { broken: false };
  static getDerivedStateFromError() {
    return { broken: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.broken ? null : this.props.children;
  }
}
