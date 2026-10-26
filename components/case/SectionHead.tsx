import styles from "./case.module.css";

/* The head every case-study section opens with.

   A full-width hairline, the section's number at label size on the
   left, and the heading itself. The number is what makes the page read
   as a sequence of chapters rather than a stack of blocks, the way the
   reference numbers its sections; the hairline is what separates them
   without needing a background change between every one.

   The number is aria-hidden. "Zero two, How it works" is noise to a
   screen reader, and the heading outline already gives the order. The
   id is the section's aria-labelledby target, so it is required. */
export default function SectionHead({
  id,
  n,
  title,
  className,
}: {
  id: string;
  n: number;
  title: string;
  className?: string;
}) {
  return (
    <div className={`${styles.head} ${className ?? ""}`} data-reveal>
      <span className={`label ${styles.headNum}`} aria-hidden="true">
        {String(n).padStart(2, "0")}
      </span>
      <h2 id={id} className={styles.headTitle}>
        {title}
      </h2>
    </div>
  );
}
