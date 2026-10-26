"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Timer, type Group } from "three";
import type { MotionValue } from "motion/react";
import { IPad, IPhone, Laptop, MockupCanvas } from "react-3d-mockups";
import { floatPose, randomFloatPhase } from "react-3d-mockups/core";
import type { DeviceKind } from "./Device";
import styles from "./Device.module.css";

/* The device as a real 3D model: three.js, through react-3d-mockups.

   This module is the only one that imports three, and DeviceLayer loads
   it with next/dynamic and ssr off, so neither the server bundle nor the
   first paint carries it. Until it has drawn, the static picture in
   Device.tsx stands in the same box.

   The canvas draws on demand: nothing is drawn while the object is still.
   DeviceStage owns every number that moves it (the scroll turn, the
   pointer parallax, the fade-in of the parallax once it faces front) as
   motion values. They are read here once per drawn frame by a rig group
   wrapped around the model, and any change to them asks r3f for a frame.
   React never re-renders for the turn itself; the one exception is the
   laptop lid, which is a prop of the model, and is re-rendered only when
   it moves by a whole degree. */

type Props = {
  kind: DeviceKind;
  screen: ReactNode;
  label: string;
  /* The turn, 0 (facing away) to 1 (facing front). */
  progress: MotionValue<number>;
  /* Pointer parallax in degrees, and how much of it applies (0 to 1). */
  sx: MotionValue<number>;
  sy: MotionValue<number>;
  settled: MotionValue<number>;
  /* The swing played while the device is carried from one page's slot to
     the next (deviceStore.ts), 0 at rest, 1 at its peak. */
  swing: MotionValue<number>;
  /* The turn carried across a hand-over (deviceStore.ts), or -1 when
     nothing is being carried. While it is non-negative it REPLACES
     `progress`: the slot's binding has already been swapped for the
     arriving page's, whose turn is a constant, and reading that straight
     away is what used to snap the model round in one frame. */
  pose: MotionValue<number>;
  /* Whether the object turns at all here: false on its own page and with
     reduced motion, when the lid is simply open. */
  turns: boolean;
  /* Idle float allowed (motion is welcome). */
  float: boolean;
  onReady: () => void;
};

const DEG = Math.PI / 180;
/* The rest pose, tipped back a little as if seen from slightly above, and
   the extra tip it starts the turn with. */
const REST_X = 3;
const AWAY_X = 10;
/* The laptop's lid, nearly shut while it faces away, open once it faces
   the reader. 110 is the library's (and a real desk's) default. */
const LID_SHUT = 10;
/* The swing's peak, in degrees, while the device travels between pages. */
const SWING_Y = 22;
const SWING_X = 8;
const LID_OPEN = 110;
/* Where the parallax and the float fade in over the turn. It is the same
   window DeviceStage maps `settled` over; while a turn is being carried
   there is no `settled` to read (the arriving slot's is already 1), so
   the Rig derives it from the carried turn with this. Change one and
   change the other. */
const SETTLE_FROM = 0.9;
/* The longest single step, in seconds, the float's clock may take. A frame
   after a pause reports the whole pause as its delta; anything above this
   is a gap, not motion, and is cut down to it. */
const MAX_STEP = 0.1;

/* Per device: the camera that makes it fill DeviceStage's box (whose
   aspect is set per kind in ProjectHero.module.css), its light, and the
   screen's virtual resolution. Distances are worked out from the models'
   sizes in world units and the box aspect at fov 40:
   the visible height at distance d is 2 d tan 20deg, about 0.73 d.

     iPad 11 landscape  3.88 wide in a 4:3 box, about 85% of its width
     MacBook Air 13     4.2 wide in a 16:11 box, lid up to about 1.6
     iPhone 17 Pro      4.04 tall in a 5:8 box, about 85% of its height

   The slot is then given HEADROOM: each box was made taller by HEADROOM
   at the same width (the aspects in ProjectHero.module.css), because the
   model turns and floats and its bounding box at the extremes of the
   turn is taller than at rest, and the canvas was slicing it.

   The model must not grow to fill that extra height, so the camera is
   compensated here. The compensation is a wider *vertical* frustum, not
   a camera moved back: the camera stays exactly where it was, so the
   perspective is untouched, and tan(fov/2) is simply multiplied by
   HEADROOM. Two things then hold at once, both exactly:

     vertical    visible height x HEADROOM, canvas height x HEADROOM,
                 so a world unit still covers the same number of pixels
     horizontal  the horizontal frustum is tan(fov/2) x aspect, and the
                 aspect was divided by the same HEADROOM, so it does not
                 move at all — same visible width, same canvas width

   The model therefore draws at exactly the same number of pixels in the
   same place, and the whole of the extra height is empty air around it.
   Change HEADROOM and the aspects together, or the two stop agreeing. */
const HEADROOM = 1.12;
const FOV = (2 * Math.atan(Math.tan((40 / 2) * (Math.PI / 180)) * HEADROOM) * 180) / Math.PI;

const IPAD_PROPS = { variant: "ipad11", orientation: "landscape" } as const;
const IPHONE_PROPS = { variant: "pro" } as const;
const LAPTOP_PROPS = { variant: "air13" } as const;

const STAGE: Record<DeviceKind, { camera: [number, number, number]; intensity: number }> = {
  ipad: { camera: [0, 0, 4.9], intensity: 0.8 },
  macbook: {
    camera: [0, 0.3, 5.3],
    intensity: 0.7,
  },
  iphone: { camera: [0, 0, 6.6], intensity: 1 },
};

export default function DeviceScene({ kind, screen, label, progress, sx, sy, settled, pose, swing, turns, float, onReady }: Props) {
  const stage = STAGE[kind];
  /* Until its first frames are drawn the canvas ignores the off-screen
     pause: a hero built ahead of need would otherwise sit with a frame
     loop of "never" and compile nothing. Once drawn, the pause applies
     as usual and the canvas stops costing anything out of sight. */
  const [drawn, setDrawn] = useState(false);
  return (
    <MockupCanvas
      className={styles.canvas}
      controls={false}
      zoom={false}
      shadows={false}
      background="transparent"
      camera={{ position: stage.camera, fov: FOV }}
      frameloop="demand"
      pauseWhenOffscreen={drawn}
      dpr={[1, 2]}
      label={label}
      screenAccessibility="hidden"
    >
      <Rig
        progress={progress}
        sx={sx}
        sy={sy}
        settled={settled}
        pose={pose}
        swing={swing}
        float={float}
        intensity={stage.intensity}
        onReady={() => {
          setDrawn(true);
          onReady();
        }}
      >
        <Model kind={kind} progress={progress} pose={pose} turns={turns}>
          {screen}
        </Model>
      </Rig>
    </MockupCanvas>
  );
}

/* The model itself, with its screen. The screen surfaces are the dark of
   each interface, so a layout shorter than the glass (the desk panel's
   800 by 480 on the iPad's taller 1180 by 820) sits on its own colour
   rather than on a black band. */
function Model({
  kind,
  progress,
  pose,
  turns,
  children,
}: {
  kind: DeviceKind;
  progress: MotionValue<number>;
  pose: MotionValue<number>;
  turns: boolean;
  children: ReactNode;
}) {
  if (kind === "ipad") {
    /* Laid out at 800 wide, the desk UI's own width, so it is shown at its
       real geometry: the glass is then 800 by 556 and the 480 high layout
       is centred on it. Nothing is squashed or cropped. */
    return (
      <IPad {...IPAD_PROPS} resolution={800} surfaceBackground="#080A14">
        <div className={`ui-dark ${styles.surface} ${styles.surfaceCentre}`}>{children}</div>
      </IPad>
    );
  }
  if (kind === "iphone") {
    return (
      <IPhone {...IPHONE_PROPS} statusBar surfaceBackground="#080A14">
        <div className={`ui-dark ${styles.surface} ${styles.surfacePhone}`}>{children}</div>
      </IPhone>
    );
  }
  return <Lid progress={progress} pose={pose} turns={turns}>{children}</Lid>;
}

/* The laptop's lid follows the turn: nearly shut while the machine faces
   away, opening as it comes round. Whole degrees only, so React renders
   the model at most a hundred times over the whole turn.

   It follows the CARRIED turn first, for the same reason the body does:
   a lid that jumped from eighty-five degrees to open on the frame the
   arriving slot attached was a quarter of the snap all by itself. */
function Lid({
  progress,
  pose,
  turns,
  children,
}: {
  progress: MotionValue<number>;
  pose: MotionValue<number>;
  turns: boolean;
  children: ReactNode;
}) {
  const angleOf = (p: number) => Math.round(LID_SHUT + (LID_OPEN - LID_SHUT) * p);
  const turnNow = () => {
    const carried = pose.get();
    if (carried >= 0) return carried;
    return turns ? progress.get() : 1;
  };
  const [angle, setAngle] = useState(() => angleOf(turnNow()));
  useEffect(() => {
    const read = () => setAngle(angleOf(turnNow()));
    read();
    const offs = [progress.on("change", read), pose.on("change", read)];
    return () => offs.forEach((f) => f());
  }, [turns, progress, pose]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Laptop {...LAPTOP_PROPS} openAngle={angle} surfaceBackground="#080A14">
      <div className={`ui-dark ${styles.surface}`}>{children}</div>
    </Laptop>
  );
}

/* The group every pose is applied to. It runs at frame priority -2, the
   slot the library's own float uses, so the DOM screens are placed from
   this frame's pose and never trail the body. */
function Rig({
  progress,
  sx,
  sy,
  settled,
  pose,
  swing,
  float,
  intensity,
  onReady,
  children,
}: {
  progress: MotionValue<number>;
  sx: MotionValue<number>;
  sy: MotionValue<number>;
  settled: MotionValue<number>;
  pose: MotionValue<number>;
  swing: MotionValue<number>;
  float: boolean;
  intensity: number;
  onReady: () => void;
  children: ReactNode;
}) {
  const ref = useRef<Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  const [phase] = useState(randomFloatPhase);
  const frames = useRef(0);
  /* The float's own clock, and not r3f's. THREE.Clock reads the wall, so
     it keeps counting through a page transition's freeze (up to
     SETTLE_TIMEOUT, two and a half seconds, while the route loads) and
     floatPose(elapsedTime) would then jump that far in one frame, right
     as the float fades in at the end of the flight. Do not simplify this
     back to clock.elapsedTime.

     Two things keep it continuous. Connected to the Page Visibility API,
     a Timer reports a zero delta while the document is hidden and resets
     on return, which covers a backgrounded tab. That does not cover a
     page that is merely frozen, or a demand loop that drew nothing for a
     while: the first update after either reports the whole gap as one
     delta. So the elapsed time is not the Timer's own sum but ours, each
     step capped at MAX_STEP. Whatever the gap, the float resumes from
     the pose it stopped at, as if no time had passed. Nothing is lost by
     that: the float only matters while it is playing, and while it plays
     it invalidates every frame, so real steps are about sixteen
     milliseconds and are never capped. */
  const [timer] = useState(() => new Timer());
  const floatTime = useRef(0);
  useEffect(() => {
    timer.connect(document);
    /* Start counting from now, not from when the Timer was made. */
    timer.reset();
    return () => timer.dispose();
  }, [timer]);
  const ready = useRef(onReady);
  ready.current = onReady;

  /* Any change to a motion value is a reason to draw. */
  useEffect(() => {
    const off = [progress, sx, sy, settled, pose, swing].map((v) => v.on("change", () => invalidate()));
    invalidate();
    return () => off.forEach((f) => f());
  }, [progress, sx, sy, settled, pose, swing, invalidate]);

  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    /* Once per drawn frame, before anything reads the time. */
    timer.update();
    floatTime.current += Math.min(timer.getDelta(), MAX_STEP);
    /* While a turn is being carried between pages it is the whole truth
       about the pose: the slot's own progress belongs to the page being
       arrived at and is already at its destination. The parallax fade is
       derived from the carried turn rather than read, for the same
       reason — the arriving slot's `settled` is already 1. */
    const carried = pose.get();
    const p = carried >= 0 ? carried : progress.get();
    const s =
      carried >= 0
        ? Math.min(1, Math.max(0, (carried - SETTLE_FROM) / (1 - SETTLE_FROM)))
        : settled.get();
    /* The float only plays once the object faces front, and fades in with
       the parallax, so it never wobbles the turn. */
    const f = float && s > 0 ? floatPose(floatTime.current, intensity, phase) : null;
    /* While carried between pages the object is picked up and turned in
       the air: it leans away from its direction of travel (towards the
       reader's left, its top back) and levels out as it is set down. */
    const w = swing.get();
    g.rotation.y = Math.PI * (1 - p) + sx.get() * DEG * s + (f ? f.rotationY * s : 0) - SWING_Y * DEG * w;
    g.rotation.x =
      (AWAY_X - (AWAY_X - REST_X) * p) * DEG + sy.get() * DEG * s + (f ? f.rotationX * s : 0) + SWING_X * DEG * w;
    g.rotation.z = f ? f.rotationZ * s : 0;
    g.position.y = f ? f.positionY * s : 0;
    g.scale.setScalar(0.9 + 0.1 * p);
    if (f) invalidate();

    /* Tell the stage once a few frames are on the glass: by then the
       renderer has started and the screens have been placed, so the
       static stand-in can go and a page transition photographs the model
       rather than an empty box. */
    if (frames.current < 3) {
      frames.current += 1;
      if (frames.current === 3) requestAnimationFrame(() => ready.current());
      else invalidate();
    }
  }, -2);

  return <group ref={ref}>{children}</group>;
}
