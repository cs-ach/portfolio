"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { cubicBezier, motion } from "motion/react";
import { useFrame, type RootState } from "@react-three/fiber";
import { Matrix4, Quaternion, Vector3, type Mesh, type Object3D, type PerspectiveCamera } from "three";
import { IPad, IPhone, Laptop, MockupCanvas } from "react-3d-mockups";
import { LAPTOP_VARIANTS } from "react-3d-mockups/core";
import { LID, MAC, PHONE, type Beats, type Glass, type PagePlacer, type Rect } from "./preloader-timeline";
import styles from "./Preloader.module.css";

/* The three.js half of the first-load sequence.

   Preloader.tsx owns everything about the page: whether to play, the
   scroll lock, the attributes, where the real site is mapped. This file
   owns the machine, and is only fetched once the sequence is going to
   play, so none of three.js is in the first bundle.

   The hand-over is the point of it, so here is how it is made true.

   A device in react-3d-mockups is a model whose screen is a hole. The
   canvas is transparent there, the screen's DOM sits under the canvas,
   and the model's bodywork is drawn over it. This canvas is stacked
   above the real page (which the Preloader lifts to just under it), so
   if the screen's own content is taken away, what shows in the hole is
   the real site, and the bezel covers its edges the way glass would.

   What remains is putting the page exactly where the hole is. The hole
   is a mesh. Its corners are read out of the scene, in world space, and
   projected through the camera the canvas is actually using, so the
   rectangle handed to the page is the same arithmetic the renderer does,
   not an estimate of it. That is only a rectangle when the screen faces
   the camera squarely, which is why the camera is brought round to look
   straight down the screen's normal before anything is measured.

   The zoom is then a move of that same camera, not a CSS scale laid over
   a picture. It keeps its orientation and slides along the screen's own
   axes, which keeps the screen plane a pure scale-and-shift of itself,
   and it is solved so the screen's top left corner arrives on the
   window's top left and its width on the window's width. The page, being
   remapped into the projected rectangle on every frame, arrives at
   exactly the transform it has with no loader at all. */

export type SceneProps = {
  name: string;
  phone: boolean;
  /* The model has drawn a frame and the sequence has begun. */
  onReady: () => void;
  /* Anything went wrong: the page should simply be shown. */
  onFail: () => void;
  /* The backdrop may leave now. */
  onReveal: () => void;
  place: PagePlacer;
  /* The sequence has finished and the page is in its place. */
  onDone: () => void;
};

type Api = {
  setAngle: (deg: number) => void;
  setGo: () => void;
  setFramed: () => void;
} & Pick<SceneProps, "onReady" | "onFail" | "onReveal" | "place" | "onDone">;

const DEG = Math.PI / 180;
const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (n: number) => {
  const x = clamp01(n);
  return x * x * (3 - 2 * x);
};

/* The curves. The zoom's is the one the page transition uses, so the two
   feel like the same hand. */
const easeLid = cubicBezier(0.5, 0, 0.15, 1);
const easeSwing = cubicBezier(0.45, 0, 0.15, 1);
const easeZoom = cubicBezier(0.5, 0, 0.2, 1);
const easeOut = cubicBezier(0.16, 1, 0.3, 1);

/* ── framing ──────────────────────────────────────────────────
   How much of the window the screen takes when it faces the viewer,
   as a fraction of width and of height; whichever bites first wins. */
const FIT_MAC = { w: 0.7, h: 0.62 };
const FIT_PHONE = { w: 0.8, h: 0.62 };
/* The closed machine at the start, in world units (its footprint seen
   three-quarter) and how much of the window it may take. */
const CLOSED = { w: 5.2, h: 3.1, fw: 0.58, fh: 0.5 };
/* The laptop's screen sits a touch above the middle of the window,
   because the deck is under it. A fraction of window height. */
const LIFT = 0.04;

/* The camera for the closed laptop: a little above and round to its
   right, looking at the middle of the lid. */
const CLOSED_TARGET = new Vector3(0, -1.0, 0.1);
const CLOSED_DIR = new Vector3(
  Math.sin(36 * DEG) * Math.cos(28 * DEG),
  Math.sin(28 * DEG),
  Math.cos(36 * DEG) * Math.cos(28 * DEG),
);

/* Constant props: a fresh object on each render would be a prop change
   as far as the canvas is concerned. */
const CAMERA = { position: [0, 0, 8] as [number, number, number], fov: 32 };
const DPR: [number, number] = [1, 1.75];

/* The black glass on a MacBook runs well below the display: the chin.
   It is part of the lid's face, drawn in the canvas, and is opaque, so a
   page seen through the hole stops short of it and leaves a strip of
   black under the site. The library's glass panel is the lid inset by a
   fixed 0.07 on every side (it is not exposed; this repeats that
   number), so the chin is the gap between that edge and the display's.
   Everything is kept as a fraction of the display so it scales with
   whatever size the screen is projected at. */
const AIR = LAPTOP_VARIANTS.air13;
const GLASS_MARGIN = 0.07;
const CHIN =
  (AIR.footprint.depth / 2 + AIR.display.offsetY - AIR.display.height / 2 - GLASS_MARGIN) / AIR.display.height;
const NOTCH = AIR.notch
  ? {
      w: AIR.notch.width / AIR.display.width,
      h: AIR.notch.height / AIR.display.width,
      r: AIR.notch.radius / AIR.display.width,
    }
  : { w: 0, h: 0, r: 0 };
const CORNER = AIR.display.radius[0] / AIR.display.width;

/* ── measuring the screen ─────────────────────────────────── */

type Aperture = {
  centre: Vector3;
  right: Vector3;
  up: Vector3;
  normal: Vector3;
  /* Half width and half height, in world units. */
  hw: number;
  hh: number;
  /* Top left, top right, bottom right, bottom left. */
  corners: Vector3[];
};

/* The screen is a flat mesh that punches the hole in the canvas: a
   shader that writes nothing, alpha included. It is the one object in
   the scene that does, and it is what the library itself composites the
   screen's DOM against, so it is the truest record of where the glass
   is. Found by what it does rather than by a name it was never given. */
function findAperture(root: Object3D): Mesh | null {
  let found: Mesh | null = null;
  root.traverse((o) => {
    if (found) return;
    const mesh = o as Mesh;
    const mat = mesh.material as { isShaderMaterial?: boolean; fragmentShader?: string } | undefined;
    if (mesh.isMesh && mat?.isShaderMaterial && /vec4\(\s*0\.0,\s*0\.0,\s*0\.0,\s*0\.0\s*\)/.test(mat.fragmentShader ?? "")) {
      found = mesh;
    }
  });
  return found;
}

function measure(mesh: Mesh): Aperture {
  mesh.updateWorldMatrix(true, false);
  const geo = mesh.geometry;
  if (!geo.boundingBox) geo.computeBoundingBox();
  const b = geo.boundingBox!;
  const z = (b.min.z + b.max.z) / 2;
  const at = (x: number, y: number) => new Vector3(x, y, z).applyMatrix4(mesh.matrixWorld);
  const tl = at(b.min.x, b.max.y);
  const tr = at(b.max.x, b.max.y);
  const br = at(b.max.x, b.min.y);
  const bl = at(b.min.x, b.min.y);
  const right = tr.clone().sub(tl);
  const up = tl.clone().sub(bl);
  const hw = right.length() / 2;
  const hh = up.length() / 2;
  right.normalize();
  up.normalize();
  return {
    centre: tl.clone().add(br).multiplyScalar(0.5),
    right,
    up,
    normal: right.clone().cross(up).normalize(),
    hw,
    hh,
    corners: [tl, tr, br, bl],
  };
}

const scratch = new Vector3();
const basis = new Matrix4();

/* Where the screen lands on the window, through the camera as it stands
   this instant. The same projection three.js runs for every vertex, with
   the viewport transform the canvas applies. */
function projectRect(ap: Aperture, cam: PerspectiveCamera, size: RootState["size"]): Rect {
  cam.updateMatrixWorld(true);
  cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
  let l = Infinity;
  let t = Infinity;
  let r = -Infinity;
  let b = -Infinity;
  for (const c of ap.corners) {
    const v = scratch.copy(c).project(cam);
    const x = ((v.x + 1) / 2) * size.width + size.left;
    const y = ((1 - v.y) / 2) * size.height + size.top;
    l = Math.min(l, x);
    r = Math.max(r, x);
    t = Math.min(t, y);
    b = Math.max(b, y);
  }
  return { left: l, top: t, width: r - l, height: b - t };
}

/* A cross-check on the above against a second, independent witness: the
   box of the DOM layer the library lays on the glass. If the two agree,
   the projection is right. If the layer exists and disagrees, something
   about the pose is not what was assumed (the camera lagging a frame, a
   library update moving the screen) and the exact hand-over is not worth
   the risk; the caller crossfades instead. If the layer cannot be found
   there is nothing to compare, and the projection stands. */
function agreesWithLayer(r: Rect): boolean {
  const layer = document.querySelector(".react-3d-mockups-screen-layer");
  if (!layer) return true;
  const inner = layer.firstElementChild?.firstElementChild;
  if (!inner) return true;
  const d = inner.getBoundingClientRect();
  if (d.width < 1 || d.height < 1) return false;
  const dx = Math.abs(d.left + d.width / 2 - (r.left + r.width / 2));
  const dy = Math.abs(d.top + d.height / 2 - (r.top + r.height / 2));
  const dw = Math.abs(d.width - r.width);
  return dx <= 0.03 * r.width && dy <= 0.03 * r.height && dw <= 0.04 * r.width;
}

/* ── the camera ───────────────────────────────────────────── */

/* Looking at `target` from `dir * dist` with a given up. */
function aim(cam: PerspectiveCamera, target: Vector3, dir: Vector3, dist: number, up: Vector3) {
  cam.up.copy(up);
  cam.position.copy(target).addScaledVector(dir, dist);
  cam.lookAt(target);
}

/* Square to the screen, with its orientation fixed, and displaced from
   the screen's centre by `a` along its right, `b` along its up and `d`
   along its normal. Orientation fixed is what makes the screen plane a
   pure scale-and-shift of itself as the camera moves. */
function faceOn(cam: PerspectiveCamera, ap: Aperture, a: number, b: number, d: number) {
  cam.position.copy(ap.centre).addScaledVector(ap.right, a).addScaledVector(ap.up, b).addScaledVector(ap.normal, d);
  basis.makeBasis(ap.right, ap.up, ap.normal);
  cam.quaternion.setFromRotationMatrix(basis);
  cam.up.copy(ap.up);
}

type Geo = {
  /* Distance and sideways offset at which the screen faces the viewer. */
  d0: number;
  b0: number;
  /* Where the camera starts, and the swing that carries it round. */
  distA: number;
  dirA: Vector3;
  targetA: Vector3;
  targetB: Vector3;
  upA: Vector3;
  swing: Quaternion;
};

type Run = {
  phase: "seek" | "settle" | "run" | "over";
  frames: number;
  mesh: Mesh | null;
  ap: Aperture | null;
  geo: Geo | null;
  t0: number;
  angle: number;
  framed: boolean;
  /* "map": the real page is mapped into the glass. "fade": the
     fallback, a zoom into the screen and a crossfade. */
  mode: "map" | "fade";
  last: string;
  zoom: { left: number; top: number; width: number } | null;
  revealed: boolean;
};

const fresh = (): Run => ({
  phase: "seek",
  frames: 0,
  mesh: null,
  ap: null,
  geo: null,
  t0: 0,
  angle: -1,
  framed: false,
  mode: "map",
  last: "",
  zoom: null,
  revealed: false,
});

function derive(ap: Aperture, cam: PerspectiveCamera, size: RootState["size"], phone: boolean): Geo {
  const tanH = Math.tan((cam.fov * DEG) / 2);
  const aspect = size.width / size.height;
  /* The distance at which a w by h patch fills fw by fh of the window. */
  const fit = (w: number, h: number, fw: number, fh: number) =>
    Math.max(w / (fw * 2 * tanH * aspect), h / (fh * 2 * tanH));

  const f = phone ? FIT_PHONE : FIT_MAC;
  const d0 = fit(2 * ap.hw, 2 * ap.hh, f.w, f.h);
  /* Sliding the camera down by LIFT of the window height raises the
     screen by as much. Window height at distance d is 2 d tanH. */
  const b0 = phone ? 0 : -LIFT * 2 * tanH * d0;
  const targetB = ap.centre.clone().addScaledVector(ap.up, b0);

  let dirA: Vector3;
  let distA: number;
  let targetA: Vector3;
  let upA: Vector3;
  if (phone) {
    /* Front on, but arriving: a little round to one side and above,
       and a little further back, settling square as it powers on. */
    const q = new Quaternion()
      .setFromAxisAngle(ap.up, -18 * DEG)
      .multiply(new Quaternion().setFromAxisAngle(ap.right, -10 * DEG));
    dirA = ap.normal.clone().applyQuaternion(q);
    distA = d0 * 1.3;
    targetA = ap.centre.clone();
    upA = ap.up.clone();
  } else {
    dirA = CLOSED_DIR.clone();
    distA = fit(CLOSED.w, CLOSED.h, CLOSED.fw, CLOSED.fh);
    targetA = CLOSED_TARGET.clone();
    upA = new Vector3(0, 1, 0);
  }
  return {
    d0,
    b0,
    distA,
    dirA,
    targetA,
    targetB,
    upA,
    swing: new Quaternion().setFromUnitVectors(dirA, ap.normal),
  };
}

/* The slerp of a direction towards the screen's normal. */
const spin = new Quaternion();
const ident = new Quaternion();
const dirNow = new Vector3();
const targetNow = new Vector3();
const upNow = new Vector3();

function cameraAtSwing(cam: PerspectiveCamera, ap: Aperture, g: Geo, e: number) {
  spin.copy(ident).slerp(g.swing, e);
  dirNow.copy(g.dirA).applyQuaternion(spin);
  targetNow.copy(g.targetA).lerp(g.targetB, e);
  upNow.copy(g.upA).lerp(ap.up, e).normalize();
  aim(cam, targetNow, dirNow, lerp(g.distA, g.d0, e), upNow);
}

/* One frame of the sequence. */
function step(run: Run, state: RootState, phone: boolean, wrap: RefObject<HTMLDivElement | null>, api: RefObject<Api>) {
  const cam = state.camera as PerspectiveCamera;
  const size = state.size;
  const B: Beats = phone ? PHONE : MAC;
  run.frames += 1;

  /* Waiting for the model. The hole is only added to the scene once the
     screen has been placed, which takes a few frames. It is measured
     here with the lid at its final angle (the laptop is mounted open,
     for exactly this), because the pose the camera must end in depends
     on where the lid ends up, and that is knowable only by looking. */
  if (run.phase === "seek") {
    const mesh = run.mesh ?? findAperture(state.scene);
    if (!mesh) {
      if (run.frames > 120) throw new Error("no screen in the scene");
      return;
    }
    run.mesh = mesh;
    run.ap = measure(mesh);
    run.geo = derive(run.ap, cam, size, phone);
    run.phase = "settle";
    run.frames = 0;
    /* Now close it. */
    if (!phone) api.current.setAngle(0);
    return;
  }

  const ap = run.ap!;
  const g = run.geo!;

  /* The lid is closing, and the first frames of the closed machine are
     being drawn, still invisible. The sequence starts on the first frame
     that has really been drawn that way. */
  if (run.phase === "settle") {
    cameraAtSwing(cam, ap, g, 0);
    const closed = phone || measure(run.mesh!).normal.dot(ap.normal) < 0.3;
    if (closed && run.frames >= 2) {
      run.phase = "run";
      run.t0 = performance.now();
      api.current.setGo();
      api.current.onReady();
    } else if (run.frames > 180) {
      throw new Error("the lid never closed");
    }
    return;
  }

  const t = (performance.now() - run.t0) / 1000;
  const vw = size.width;
  const vh = size.height;
  const F = vh / 2 / Math.tan((cam.fov * DEG) / 2);

  /* The lid. Half degrees, because every change is a render of the
     model; the eye cannot tell, and there are at most 210 of them. */
  if (!phone) {
    const q = clamp01((t - LID.start) / (LID.end - LID.start));
    const a = Math.round(LID.open * easeLid(q) * 2) / 2;
    if (a !== run.angle) {
      run.angle = a;
      api.current.setAngle(a);
    }
  }

  /* The moment the screen is square to the camera and at rest, before
     the zoom has moved it. The pose is set explicitly so the answer does
     not depend on which frame this happens to land on. Measured, not
     assumed: the rectangle the page is given is the projection of the
     camera as it stands. */
  if (t >= B.framed && !run.framed) {
    run.framed = true;
    faceOn(cam, ap, 0, g.b0, g.d0);
    run.mode = agreesWithLayer(projectRect(ap, cam, size)) ? "map" : "fade";
    if (run.mode === "map") api.current.setFramed();
  }

  /* The camera. */
  let reveal = 0;
  let out = 1;
  if (t < B.swingEnd) {
    cameraAtSwing(cam, ap, g, easeSwing(clamp01((t - B.swing0) / (B.swingEnd - B.swing0))));
  } else if (t < B.zoom) {
    faceOn(cam, ap, 0, g.b0, g.d0);
  } else {
    if (!run.zoom) {
      faceOn(cam, ap, 0, g.b0, g.d0);
      const r0 = projectRect(ap, cam, size);
      run.zoom = { left: r0.left, top: r0.top, width: r0.width };
      /* The backdrop goes as the flight begins, so the wall behind the
         machine lightens into the page as the page takes over. */
      if (run.mode === "map") {
        run.revealed = true;
        api.current.onReveal();
      }
    }
    const z = run.zoom;
    const p = clamp01((t - B.zoom) / B.zoomDur);
    const e = easeZoom(p);
    /* Geometric, so the zoom reads as one steady push rather than a
       crawl that suddenly lunges. */
    const k = Math.pow(vw / z.width, e);
    const d = g.d0 / k;
    /* Where the screen's top left corner is wanted on the window:
       sliding from where it was to the window's own corner. Then the
       camera offset that puts it there: the projection of a point at
       (X, Y) in the screen plane is
         x = vw/2 + F/d (X - a),   y = vh/2 - F/d (Y - b)
       and solving that for the corner (-hw, +hh) gives a and b. */
    const x = lerp(z.left, 0, e);
    const y = lerp(z.top, 0, e);
    const a = -ap.hw - ((x - vw / 2) * d) / F;
    const b = ap.hh - ((vh / 2 - y) * d) / F;
    faceOn(cam, ap, a, b, d);
    reveal = smooth((e - 0.55) / 0.45);
  }

  /* The loader leaves after the flight, not during it. Fading the canvas
     over the last stretch of the zoom meant the hardware was dissolving
     while the page was still moving, and the last frames of the zoom
     ended on a hard removal. Instead the camera arrives, and the canvas
     fades over the 0.4s that follow (starting 0.1s early, where the
     eased zoom has all but stopped), on an ease-out so it lets go
     quickly and settles softly. The page is already at its final
     transform for all of it, so nothing under the fade moves. */
  if (run.mode === "map" && run.zoom) {
    const over = t - (B.zoom + B.zoomDur - 0.1);
    out = 1 - easeOut(clamp01(over / 0.4));
  }

  /* The page follows the glass: mapped into the projection of the
     camera as it now is, every frame it changes. */
  if (run.framed && run.mode === "map") {
    const r = projectRect(ap, cam, size);
    const key = `${r.left.toFixed(2)},${r.top.toFixed(2)},${r.width.toFixed(2)},${r.height.toFixed(2)},${reveal.toFixed(3)}`;
    if (key !== run.last) {
      run.last = key;
      /* The laptop's page is stacked over the canvas and shaped to the
         glass, chin and notch included (see Preloader.place); the
         phone's glass is all display, so its page stays under the
         canvas and the hardware does the shaping. */
      const glass: Glass | undefined = phone
        ? undefined
        : {
            chin: CHIN * r.height,
            notchW: NOTCH.w * r.width,
            notchH: NOTCH.h * r.width,
            notchR: NOTCH.r * r.width,
            corner: CORNER * r.width,
          };
      api.current.place(r, reveal, glass);
    }
  }

  /* The crossfade fallback: the camera has flown into the screen, and
     both the canvas and the backdrop dissolve over the last of it. */
  if (run.mode === "fade" && run.framed) {
    out = 1 - smooth((t - (B.end - 0.4)) / 0.4);
    if (!run.revealed && t >= B.end - 0.45) {
      run.revealed = true;
      api.current.onReveal();
    }
  }

  const el = wrap.current;
  if (el) el.style.opacity = String(Math.min(1, t / 0.45) * out);

  if (t >= B.end) {
    run.phase = "over";
    api.current.onDone();
  }
}

/* Runs at priority -2, the slot the library's own float uses, so the
   screens' DOM is placed from this frame's camera and never trails it. */
function Rig({ phone, wrap, api }: { phone: boolean; wrap: RefObject<HTMLDivElement | null>; api: RefObject<Api> }) {
  const run = useRef<Run>(fresh());
  useFrame((state) => {
    if (run.current.phase === "over") return;
    try {
      step(run.current, state, phone, wrap, api);
    } catch {
      run.current.phase = "over";
      api.current.onFail();
    }
  }, -2);
  return null;
}

/* ── the screen's content ─────────────────────────────────────
   Light panel, the mark, the name: the same things the old flat
   version played, now on a real display. Once `framed` it is
   transparent, and what shows through is the real page under the
   canvas. */

const CORNERS = [
  { id: "tl", x: "-150%", y: "-170%", color: "var(--ink)" },
  { id: "tr", x: "150%", y: "-170%", color: "var(--accent)" },
  { id: "bl", x: "-150%", y: "170%", color: "var(--accent-soft)" },
  { id: "br", x: "150%", y: "170%", color: "var(--line-strong)" },
];

const ease = [0.16, 1, 0.3, 1] as const;

function Face({ name, phone, framed }: { name: string; phone: boolean; framed: boolean }) {
  const B = phone ? PHONE : MAC;
  return (
    <motion.div
      className={styles.face}
      initial={{ backgroundColor: "#08080A" }}
      animate={
        framed
          ? { backgroundColor: "rgba(245, 245, 247, 0)" }
          : { backgroundColor: ["#08080A", "#1A1A1D", "#F5F5F7"] }
      }
      transition={
        framed
          ? { duration: 0.4, ease }
          : { duration: 1.1, delay: B.on, times: [0, 0.2, 1], ease }
      }
    >
      <motion.div
        className={styles.faceInner}
        animate={{ opacity: framed ? 0 : 1 }}
        transition={{ duration: 0.4, ease }}
      >
        {!phone ? (
          <div className={styles.mark}>
            {CORNERS.map((c, i) => (
              <motion.span
                key={c.id}
                className={styles.blob}
                style={{ background: c.color }}
                initial={{ x: c.x, y: c.y, scale: 0.4, opacity: 0 }}
                animate={{ x: 0, y: 0, scale: [0.4, 1.16, 1], opacity: [0, 1, 1] }}
                transition={{ duration: 0.68, delay: B.mark + i * 0.04, times: [0, 0.72, 1], ease }}
              />
            ))}
            <motion.span
              className={styles.core}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.25, 1], opacity: [0, 1, 1] }}
              transition={{ duration: 0.46, delay: B.mark + 0.38, times: [0, 0.6, 1], ease }}
            />
          </div>
        ) : null}

        <motion.p
          className={phone ? styles.bootName : styles.screenName}
          initial={{ opacity: 0, y: phone ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.46, delay: B.name, ease }}
        >
          {name}
        </motion.p>

        {phone ? (
          <span className={styles.bootBar}>
            <motion.span
              className={styles.bootFill}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.92, delay: B.name + 0.26, ease: "easeInOut" }}
            />
          </span>
        ) : null}
      </motion.div>
    </motion.div>
  );
}

/* ── warming the heroes' geometry ─────────────────────────────
   The project heroes use an iPad, a MacBook and an iPhone. Each device
   builds its body in a useMemo, and the expensive part (cutting the
   ports and holes by CSG) lands in react-3d-mockups' module-level cache,
   keyed by the input geometry. The cache lives in this JS realm, not in
   a WebGL context, so building a device here, once, makes every later
   instance of it on the page cheap. (Shader programs are per context and
   are not shared; the heroes compile their own, off screen, on idle.)

   The devices are mounted inside an invisible group: three skips it when
   drawing, so nothing is seen and no GPU work is spent, but React still
   runs the models' memos. They carry no children, so no screen layer is
   made, and they are mounted only after the sequence has begun, so the
   Rig's search for the screen's hole (which happens before that) can
   never find theirs. Each costs a slab of main thread, so they are
   mounted one at a time, in the stretches of the timeline where nothing
   is moving fast. Measured on an M2 Pro, the iPad takes about 40ms to
   build and the iPhone about 70, the latter in the static dwell. */
type Kind = "ipad" | "iphone" | "laptop";

function Warm({ kind }: { kind: Kind }) {
  if (kind === "ipad") return <IPad variant="ipad11" orientation="landscape" />;
  if (kind === "iphone") return <IPhone variant="pro" />;
  return <Laptop variant="air13" />;
}

export default function PreloaderScene({ name, phone, onReady, onFail, onReveal, place, onDone }: SceneProps) {
  const wrap = useRef<HTMLDivElement>(null);
  /* Mounted open so the Rig can read where the lid ends up; it closes
     it before anything is shown. */
  const [angle, setAngle] = useState(LID.open);
  /* The screen's content mounts when the sequence starts, so its
     entrances (which run from mount) share the sequence's clock. */
  const [go, setGo] = useState(false);
  const [framed, setFramed] = useState(false);

  /* The Rig reads callbacks from here, so it never holds a stale one. */
  const api = useRef<Api>(null!);
  api.current = {
    setAngle,
    setGo: () => setGo(true),
    setFramed: () => setFramed(true),
    onReady,
    onFail,
    onReveal,
    place,
    onDone,
  };

  /* Which devices to build behind the scenes, and when. The first goes
     in the moment the sequence has begun, while the machine is still
     shut and the lid has barely started to move; the second in the
     dwell, when the finished site simply sits on the glass and nothing
     animates in the canvas. */
  const [warm, setWarm] = useState(0);
  useEffect(() => {
    if (!go) return;
    const ids = [window.setTimeout(() => setWarm(1), 40), window.setTimeout(() => setWarm(2), (phone ? 1.7 : 2.0) * 1000)];
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, [go, phone]);
  /* The loader's own device is not built twice. */
  const warmKinds: Kind[] = phone ? ["ipad", "laptop"] : ["ipad", "iphone"];

  const face = go ? <Face name={name} phone={phone} framed={framed} /> : null;

  return (
    <div ref={wrap} className={styles.scene} aria-hidden="true">
      <MockupCanvas
        controls={false}
        zoom={false}
        shadows={false}
        background="transparent"
        camera={CAMERA}
        frameloop="always"
        pauseWhenOffscreen={false}
        dpr={DPR}
        label="Loading"
        screenAccessibility="hidden"
      >
        <Rig phone={phone} wrap={wrap} api={api} />
        <group visible={false}>
          {warm >= 1 ? <Warm kind={warmKinds[0]} /> : null}
          {warm >= 2 ? <Warm kind={warmKinds[1]} /> : null}
        </group>
        {phone ? (
          <IPhone variant="pro" surfaceBackground="transparent">
            {face}
          </IPhone>
        ) : (
          <Laptop variant="air13" openAngle={angle} surfaceBackground="transparent">
            {face}
          </Laptop>
        )}
      </MockupCanvas>
    </div>
  );
}
