import styles from "./Arrow.module.css";

/* The moving glyph for the `.act-nudge` utility (design/08-INTERACTION.md).

   It carries [data-arrow], which is the hook the utility moves, and it
   is aria-hidden: the link's words say where it goes, the arrow only
   shows which way. `dir` draws the shaft and head pointing the same way
   as the element's `data-dir`, so the glyph and the travel agree. The
   span is the thing that moves; the svg inside never transforms. */
type Dir = "right" | "left" | "down" | "up-right";

const PATHS: Record<Dir, string> = {
  right: "M3 8h10M9 4l4 4-4 4",
  left: "M13 8H3M7 4L3 8l4 4",
  down: "M8 3v10M4 9l4 4 4-4",
  "up-right": "M4 12L12 4M6 4h6v6",
};

export default function Arrow({ dir = "right" }: { dir?: Dir }) {
  return (
    <span className={styles.arrow} data-arrow aria-hidden="true">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25">
        <path d={PATHS[dir]} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
