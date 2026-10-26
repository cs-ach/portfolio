/* The cat's drawings.

   The cat is the sprite sheet from oneko.js — https://github.com/adryd325/oneko.js
   by adryd, MIT licensed, Copyright (c) 2022 adryd. The sheet is served
   from /oneko/oneko.gif and the full licence text sits beside it in
   /oneko/LICENSE, because MIT asks that the notice travel with every
   copy. This module is only the grid: which 32x32 cell of the sheet each
   pose is. The renderer (Oneko.tsx) offsets a background-image by that
   cell and inverts it over dark ground.

   The sheet is 256x128, so 8 columns by 4 rows. Every coordinate below
   is lifted from upstream's own `spriteSets` object, not remembered.
   Upstream stores them as the negative background-position multiples of
   32px ([-3, -1] means col 3, row 1); here they are stored positive as
   [col, row] and Oneko.tsx does the negation, so each value is the
   upstream pair with its signs dropped.

   Upstream's sets and ours do not line up one-to-one:
     idle        -> idle        [3,3]
     alert       -> alert       [7,3]
     sleeping    -> sleep-1/2   [2,0] [2,1]  (both frames, as upstream)
     scratchSelf -> scratch-1/2 [5,0] [6,0]  (upstream has a third frame,
                    [7,0]; two frames is all the renderer's loop takes,
                    so the first two are used and the third is dropped)
     E, NE, N, SE, S -> run-*-1/2, both upstream frames, in upstream's
                    order, so the alternation is the artist's own stride.
   Upstream's `tired` [3,2], the four scratchWall sets and the explicit
   W, SW and NW frames have no key here. The renderer mirrors the east-
   facing frames for westward travel instead of using upstream's west
   frames, which keeps the union at 16 keys. */

export const SHEET = "/oneko/oneko.gif";
export const CELL = 32;

export type PoseKey =
  | "idle"
  | "alert"
  | "sleep-1"
  | "sleep-2"
  | "scratch-1"
  | "scratch-2"
  | "run-e-1" | "run-e-2"
  | "run-ne-1" | "run-ne-2"
  | "run-n-1" | "run-n-2"
  | "run-se-1" | "run-se-2"
  | "run-s-1" | "run-s-2";

/* [col, row] of each pose in the sheet, from upstream's spriteSets. */
export const CELLS: Record<PoseKey, readonly [number, number]> = {
  "idle": [3, 3],
  "alert": [7, 3],
  "sleep-1": [2, 0],
  "sleep-2": [2, 1],
  "scratch-1": [5, 0],
  "scratch-2": [6, 0],
  "run-e-1": [3, 0],
  "run-e-2": [3, 1],
  "run-ne-1": [0, 2],
  "run-ne-2": [0, 3],
  "run-n-1": [1, 2],
  "run-n-2": [1, 3],
  "run-se-1": [5, 1],
  "run-se-2": [5, 2],
  "run-s-1": [6, 3],
  "run-s-2": [7, 2],
};
