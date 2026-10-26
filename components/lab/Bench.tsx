import Link from "next/link";
import Arrow from "@/components/Arrow";
import type { Experiment } from "./experiments";
import styles from "./Bench.module.css";

/* One experiment on the bench.

   Four parts, in the order a visitor needs them: a spec row that says what
   this is and where it comes from, a brief that says what it demonstrates
   and what to press, the stage the live component runs on, and a note that
   separates what is genuinely implemented from what is a stand-in.

   The order is deliberate. The instruction comes before the stage because an
   interface with no instructions is a puzzle, and the honesty note comes
   after it because the visitor can only weigh "what is real" once they have
   had a go.

   `tone` only changes the ground: light benches sit on the page, a dark one
   is a full-bleed band so a panel that wants to breathe can. The content
   column is identical either way, so the sticky index never overlaps it. */

export default function Bench({
  x,
  tone = "light",
  children,
}: {
  x: Experiment;
  tone?: "light" | "dark";
  children: React.ReactNode;
}) {
  return (
    <section id={x.id} className={styles.bench} data-tone={tone} aria-labelledby={`${x.id}-title`}>
      <div className={`wrap ${styles.inner}`}>
        <header className={styles.head}>
          <dl className={styles.spec} data-reveal>
            <div className={styles.tag}>
              <dt className="sr-only">Experiment</dt>
              <dd>EXP-{x.n}</dd>
            </div>
            <div className={styles.cell}>
              <dt>From</dt>
              <dd>
                <Link
                  href={`/work/${x.slug}/`}
                  className={`act act-nudge ${styles.projectLink}`}
                  data-dir="right"
                >
                  {x.project}
                  <Arrow dir="right" />
                </Link>
              </dd>
            </div>
            <div className={styles.cell}>
              <dt>Format</dt>
              <dd>{x.format}</dd>
            </div>
          </dl>

          <h2 id={`${x.id}-title`} className={styles.title} data-reveal>
            {x.name}
          </h2>

          <div className={styles.brief} data-reveal>
            <p className={styles.shows}>{x.shows}</p>
            <p className={styles.try}>
              <span className={styles.tryLabel}>Try</span> {x.tryIt}
            </p>
          </div>
        </header>

        <div className={styles.stage} data-reveal>
          <p className={styles.stageBar}>
            <span className={styles.live}>Live</span>
            <span>Runs in this tab · no network · nothing stored</span>
          </p>
          {children}
        </div>

        <div className={styles.notes} data-reveal>
          <h3 id={`${x.id}-real`} className={styles.notesTitle}>
            What&rsquo;s real here
          </h3>
          <div className={styles.cols}>
            <div>
              <h4 className={styles.colHead}>Implemented</h4>
              <ul className={`${styles.list} ${styles.real}`}>
                {x.real.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className={styles.colHead}>Simulated</h4>
              <ul className={`${styles.list} ${styles.sim}`}>
                {x.simulated.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
