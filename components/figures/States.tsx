import type { Project } from "@/lib/content";
import styles from "./figures.module.css";

/* The interface's real states, each a small fragment of the product. A reader
   who has built something asks what happens when it goes wrong before they ask
   what it looks like when it works. */
export default function States({ states }: { states: Project["states"] }) {
  return (
    <ul className={styles.strip}>
      {states.map((s) => (
        <li key={s.label} className={styles.stateCard} data-ui>
          <div className={styles.figBar}>
            <span className={styles.figName}>{s.label}</span>
            <span className={`${styles.chip} ${styles[s.tone]}`}>{s.status}</span>
          </div>
          <p className={styles.stateLine}>{s.line}</p>
        </li>
      ))}
    </ul>
  );
}
