import { PROJECTS } from "@/lib/content";
import ProjectHero from "@/components/project/ProjectHero";
import styles from "./NextProject.module.css";

/* The way out of a case study.

   The last thing on /work/<slug>/ is the next project's hero, the same
   full-screen hero it has on the list and at the top of its own page.
   Finishing one project hands you the next at full size rather than
   dropping you at a footer, and because the hero it opens into is
   identical, following it reads as scrolling on rather than leaving.

   The order is the order of PROJECTS, wrapping from the last back to
   the first, so there is always somewhere to go.

   This renders no label of its own: the hero in "next" mode already
   carries the "Next project" kicker and the count, and everything the
   page transition needs (the link, its accessible name, the data-vt-src
   attributes) belongs to it. Nothing here carries morph attributes or
   data-reveal, since a morph that starts from an element still fading
   in starts from nothing. */
export default function NextProject({ slug }: { slug: string }) {
  const i = PROJECTS.findIndex((p) => p.slug === slug);
  const nextIndex = (i + 1) % PROJECTS.length;
  const next = PROJECTS[nextIndex];
  if (!next) return null;

  return (
    <nav className={styles.section} aria-label="Next project">
      <ProjectHero project={next} mode="next" index={nextIndex} total={PROJECTS.length} />
    </nav>
  );
}
