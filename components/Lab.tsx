import Link from "next/link";
import { EXPERIMENTS } from "@/components/lab/experiments";
import styles from "./Lab.module.css";

/* The lab, as a band on the home page.

   This is the front door to /lab/, where the interfaces from the projects
   run in the browser. It borrows the lab's own look (the graph-paper ground
   the live panels sit on there, the EXP-numbered tags) so that arriving on
   the page feels like walking into the room this band is a window onto.

   The four tiles come from the same list the lab page is built from, and
   each links straight to its bench rather than to the top of the page: a
   tile that says "the serial link" should land on the serial link. */

export default function Lab() {
  return (
    <section id="lab" className={styles.section} aria-labelledby="lab-title">
      <div className="wrap">
        <div className={styles.band}>
          <header className={styles.head}>
            <h2 id="lab-title" className={styles.heading} data-reveal>
              The lab
            </h2>
            <div className={styles.intro} data-reveal>
              <p className={styles.lead}>
                The interfaces from these projects, rebuilt so they run in your
                browser. Nothing is a recording and nothing talks to a server.
              </p>
              <Link href="/lab/" className="pill pill-solid">
                Open the lab
              </Link>
            </div>
          </header>

          <ul className={styles.grid}>
            {EXPERIMENTS.map((x, i) => (
              <li
                key={x.id}
                data-reveal
                style={{ "--reveal-delay": `${i * 70}ms` } as React.CSSProperties}
              >
                <Link href={`/lab/#${x.id}`} className={styles.tile}>
                  <span className={styles.tag}>EXP-{x.n}</span>
                  <span className={styles.name}>{x.name}</span>
                  <span className={styles.line}>{x.line}</span>
                  <span className={styles.project}>
                    {x.project} <span aria-hidden="true">→</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
