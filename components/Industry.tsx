import { INDUSTRY } from "@/lib/content";
import styles from "./Industry.module.css";

/* Production work.

   Client and product names belong to the employer, so this section
   says what was built and in what, and leaves the rest out. That
   constraint is stated once at the top rather than hinted at. */
export default function Industry() {
  return (
    <section id="industry" className={`section ${styles.section}`}>
      <div className="wrap">
        <header className={styles.head} data-reveal>
          <div>
            <h2 className={styles.heading}>In industry</h2>
            <p className={styles.role}>
              {INDUSTRY.role}, {INDUSTRY.org}
            </p>
          </div>
          <p className={`label ${styles.period}`}>{INDUSTRY.period}</p>
        </header>

        <p className={styles.lead} data-reveal>{INDUSTRY.lead}</p>

        <ul className={styles.areas}>
          {INDUSTRY.areas.map((a, i) => (
            <li
              key={a.title}
              className={styles.area}
              data-reveal
              style={{ "--reveal-delay": `${i * 70}ms` } as React.CSSProperties}
            >
              <p className={`label ${styles.kind}`}>{a.kind}</p>
              <h3 className={styles.title}>{a.title}</h3>
              <ul className={styles.points}>
                {a.responsibilities.map((r) => <li key={r}>{r}</li>)}
              </ul>
              <p className={`label ${styles.stack}`}>{a.stack.join(" · ")}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
