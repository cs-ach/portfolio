import Link from "next/link";
import { PROJECTS } from "@/lib/content";
import Arrow from "./Arrow";
import ProjectHero from "./project/ProjectHero";
import styles from "./Work.module.css";

/* Selected work.

   A short header row, then every project as an exhibit, stacked edge to
   edge with no gaps between them. Each hero is taller than the window and
   holds its stage while the device turns to face the reader. Each hero is the same component as the top of that project's
   case study, so opening one does not slide to a new page: the hero
   becomes the page (design/07-REDESIGN.md).

   The section keeps id="work", because the hero's "View my work" link
   points here. */
export default function Work() {
  const total = PROJECTS.length;

  return (
    <section id="work" className={styles.section} aria-labelledby="work-heading">
      <div className="wrap">
        <header className={styles.head} data-reveal>
          <h2 id="work-heading" className={styles.heading}>Selected work</h2>
          <span className={styles.count}>
            {String(total).padStart(2, "0")}
            <span className="sr-only"> projects</span>
          </span>
          <Link href="/projects/" className={`act act-nudge ${styles.all}`} data-dir="right">
            All projects
            <Arrow dir="right" />
          </Link>
        </header>
      </div>

      <ol className={styles.stack}>
        {PROJECTS.map((p, i) => (
          <li key={p.slug}>
            <ProjectHero project={p} mode="list" index={i} total={total} />
          </li>
        ))}
      </ol>
    </section>
  );
}
