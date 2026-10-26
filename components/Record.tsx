import { EDUCATION, RECORD, STACK } from "@/lib/content";
import styles from "./Record.module.css";

/* What he works in, and where.

   Every row names the project or the job the tool was actually used
   on. A list of logos says nothing, and a skill bar with a percentage
   on it says less. */
export default function Record() {
  return (
    <section id="record" className={`section ${styles.section}`}>
      <div className="wrap">
        <header className={styles.head} data-reveal>
          <h2 className={styles.heading}>What I work in</h2>
        </header>

        <div className={styles.split}>
          <div className={styles.stacks}>
            {STACK.map((t, i) => (
              <div
                key={t.tier}
                className={styles.group}
                data-reveal
                style={{ "--reveal-delay": `${i * 60}ms` } as React.CSSProperties}
              >
                <h3 className={`label ${styles.groupHead}`}>{t.tier}</h3>
                <ul className={styles.rows}>
                  {t.items.map((it) => (
                    <li key={it.name} className={styles.row}>
                      <span className={styles.rowName}>{it.name}</span>
                      <span className={styles.rowValue}>{it.where}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <aside className={styles.aside}>
            <div className={styles.group} data-reveal>
              <h3 className={`label ${styles.groupHead}`}>Education</h3>
              <ul className={styles.rows}>
                {EDUCATION.map((e) => (
                  <li key={e.place} className={styles.row}>
                    <span className={styles.rowName}>
                      {e.place}
                      <span className={styles.rowSub}>{e.detail}</span>
                    </span>
                    <span className={styles.rowValue}>{e.period}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className={styles.group} data-reveal style={{ "--reveal-delay": "80ms" } as React.CSSProperties}>
              <h3 className={`label ${styles.groupHead}`}>On the record</h3>
              <ul className={styles.rows}>
                {RECORD.map((r) => (
                  <li key={`${r.name}-${r.value}`} className={styles.row}>
                    <span className={styles.rowName}>{r.name}</span>
                    <span className={styles.rowValue}>{r.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
