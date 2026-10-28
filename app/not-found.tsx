import type { Metadata } from "next";
import Link from "next/link";
import Runner from "@/components/notfound/Runner";
import styles from "@/components/notfound/NotFound.module.css";

/* Not found.

   The message is the page: what happened, and two ways out, readable
   and usable with no script at all. The game underneath is the site's
   cat with somewhere to run, for anyone in no hurry to leave. The
   wrapper carries `data-no-cat`, which sends the roaming cat (Oneko)
   off for as long as this page is mounted, since this one has its own. */
export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <section className={`wrap ${styles.page}`} data-no-cat>
      <div className={styles.head}>
        <p className={styles.eyebrow}>404</p>
        <h1 className={`display ${styles.title}`}>This page wandered off.</h1>
        <p className={styles.lead}>
          Whatever was here has moved, or never existed. The cat went
          looking for it and hasn&apos;t come back either.
        </p>
        <div className={styles.actions}>
          <Link href="/" className="pill pill-solid">Back home</Link>
          <Link href="/projects" className="pill pill-ghost">See the projects</Link>
        </div>
      </div>

      <div className={styles.game}>
        <Runner />
        <p className={`${styles.note} ${styles.keyNote}`}>
          Space, up arrow or W to jump.
        </p>
      </div>
    </section>
  );
}
