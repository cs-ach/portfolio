/* One handle on the project heroes' three.js chunk (DeviceScene).

   Three places want it: next/dynamic in DeviceStage, which needs it when
   a canvas is mounted; Preloader, which starts the download while the
   loader plays so the JS is cached before the first hero is anywhere
   near; and DeviceStage again, on pages where the loader is skipped.
   They share this promise so the chunk is requested once and a second
   caller simply gets the first one's result. A rejection is dropped from
   the cache so a later caller can retry a flaky network. */
let heroScene: Promise<typeof import("../project/DeviceScene")> | null = null;

export const loadHeroScene = () =>
  (heroScene ??= import("../project/DeviceScene").catch((e) => {
    heroScene = null;
    throw e;
  }));
