/* The first-load sequence's clock, kept apart from both halves of the
   loader on purpose.

   Preloader.tsx is in the first bundle and must not pull three.js in
   with it; PreloaderScene.tsx is the three.js half and is only fetched
   once the sequence is going to play. They still have to agree on how
   long the sequence is (the first one keeps a watchdog on the second),
   so the numbers live here, in a module with no imports. */

/* Seconds from the moment the model has drawn its first frame. */
export type Beats = {
  /* The camera starts easing round to face the screen, and arrives. */
  swing0: number;
  swingEnd: number;
  /* The panel lights, the mark plays, the name appears. */
  on: number;
  mark: number;
  name: number;
  /* The screen is face on: the real page is mapped into it. */
  framed: number;
  /* The finished site sits on the screen until `zoom`, then the camera
     flies in for `zoomDur` seconds. */
  zoom: number;
  zoomDur: number;
  /* The loader is over and the page is handed back. */
  end: number;
};

/* Desktop, about 3.7 seconds (the last 0.3 is the loader fading off a page that has already arrived). `framed` to `zoom` is the dwell: the stretch
   where the finished site simply sits on the screen before the camera
   moves. */
export const MAC: Beats = {
  swing0: 0.55,
  swingEnd: 1.55,
  on: 0.95,
  mark: 1.05,
  name: 1.42,
  framed: 1.9,
  zoom: 2.6,
  zoomDur: 0.8,
  end: 3.7,
};

/* The lid: shut, then up to a real desk angle. 105 degrees rather than
   the library's 110 so the lid does not lean quite so far back that the
   camera has to look up at it. */
export const LID = { start: 0.2, end: 1.2, open: 105 };

/* Phone, 2.7 seconds, and not the model's clock: the phone's boot screen
   is DOM and CSS (Preloader.tsx, Preloader.module.css), so these are
   plain seconds from the moment it mounts. The mark's own entrance runs
   from 0. The name comes in, the bar starts to fill and runs for
   `barDur`, and the finished screen is held for a beat before the black
   lifts off the page for `liftDur`; `end` is the page handed back, and
   the only timer that matters, because nothing else is waited for. */
export const PHONE_BOOT = {
  name: 0.7,
  bar: 0.95,
  barDur: 1.0,
  lift: 2.1,
  liftDur: 0.6,
  end: 2.7,
};

/* The old model-driven phone sequence's clock. Nothing plays it any more
   (see PHONE_BOOT); it is kept only for the scene's own phone paths,
   which are unreachable. */
export const PHONE: Beats = {
  swing0: 0,
  swingEnd: 1.2,
  on: 0.2,
  mark: 0,
  name: 0.55,
  framed: 1.5,
  zoom: 2.2,
  zoomDur: 0.8,
  end: 3.3,
};

/* Two limits on how long the loader waits before giving up and showing
   the page, because two different things can be slow.

   `ready` is the model's own: once the code for it has arrived, building
   the geometry, making a WebGL context, compiling the shaders and
   drawing a first frame should take about this long. It starts when the
   chunk lands, not before, so a slow network does not eat the time the
   GPU needs.

   `ceiling` is everyone's patience: from mount, however it is spent,
   the page is shown by then. A cold first visit is exactly the visit
   the introduction is for, so the ceiling is generous; it is not
   generous enough to hold anyone hostage.

   Both come in two sizes, for the laptop's sequence. The numbers for a laptop were tuned on a
   laptop, and a phone is not one: measured with the main thread slowed
   to a sixth, the first frame took 1.3 seconds from the chunk landing
   (about 0.4 unthrottled), which is a mid-range phone with a cold
   shader cache, and the laptop's 1.2 dropped the introduction on
   exactly the devices it was most wanted on, silently, with the page
   simply shown. So anything driven by touch (a phone no longer plays the model at
   all, but a tablet standing upright is given the laptop's sequence and
   not the laptop's processor) gets about two and a half times the room. The wall it
   waits behind is already up, so the cost of the longer leash is a
   plain backdrop for a moment on a device that was never going to have
   drawn the model sooner; the bound on it is still the ceiling.

   Development builds compile on demand and take several times longer
   for reasons that will not exist in production, so they get a looser
   leash. */
const PROD = process.env.NODE_ENV === "production";

export type Budgets = { ready: number; ceiling: number };

export const budgetsFor = (slow: boolean): Budgets =>
  !PROD
    ? { ready: 8000, ceiling: 15000 }
    : slow
      ? { ready: 3000, ceiling: 6500 }
      : { ready: 1200, ceiling: 3000 };

/* A rectangle in window pixels. */
export type Rect = { left: number; top: number; width: number; height: number };

/* The hardware around a screen that the page, when it is stacked above
   the canvas, has to be shaped to, in window pixels at the current zoom:
   how far the black glass runs below the display (the chin), the
   camera notch cut into the display's top edge, and the display's top
   corner radius. */
export type Glass = {
  chin: number;
  notchW: number;
  notchH: number;
  notchR: number;
  corner: number;
};

/* Maps the real page into a rectangle of the window. `reveal`, 0 to 1,
   is how far the clip is allowed to open past the rectangle's bottom edge
   towards the window's (see Preloader.place). With `glass`, the page is
   stacked above the canvas and shaped to the glass; without it, it sits
   under the canvas and the hardware shapes it. */
export type PagePlacer = (rect: Rect, reveal: number, glass?: Glass) => void;
