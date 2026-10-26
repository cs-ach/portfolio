import type { Metadata } from "next";
import { openGraph } from "@/lib/site";
import { PERSON, PROJECTS } from "@/lib/content";
import ProjectHero from "@/components/project/ProjectHero";
import styles from "./projects.module.css";

export const metadata: Metadata = {
  title: "Projects",
  description: `Projects by ${PERSON.name}, software engineer: a Rust device companion, a zero-trust web platform and a neobank, each with a full case study.`,
  alternates: { canonical: "/projects/" },
  openGraph: openGraph({
    title: "Projects",
    description: `Projects by ${PERSON.name}, software engineer: a Rust device companion, a zero-trust web platform and a neobank, each with a full case study.`,
    url: "/projects/",
    type: "website",
  }),
};

/* The project index.

   Every project has a full write-up at /work/<slug>. This page collects
   them, and it is where anything new gets added, so the nav link has
   somewhere permanent to point.

   Under its own heading it runs the same stack of project heroes as the
   home page, so a project opens the same way from either place. */
export default function Projects() {
  const total = PROJECTS.length;

  return (
    <article className={styles.page}>
      <header className={`wrap ${styles.head}`}>
        <h1 className={`display ${styles.title}`} data-reveal>
          Things I have built
        </h1>
      </header>

      <ol className={styles.stack}>
        {PROJECTS.map((p, i) => (
          <li key={p.slug}>
            <ProjectHero project={p} mode="list" index={i} total={total} />
          </li>
        ))}
      </ol>

      <div className="wrap">
        <p className={styles.note} data-reveal>
          More write-ups are on the way.
        </p>
      </div>
    </article>
  );
}
