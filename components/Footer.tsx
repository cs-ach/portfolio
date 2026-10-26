import Link from "next/link";
import { PERSON, PROJECTS } from "@/lib/content";
import Arrow from "./Arrow";
import Social from "./ui/Social";
import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className="wrap">
        <div className={styles.cols}>
          <div className={styles.brand}>
            <p className={styles.name}>{PERSON.name}</p>
            <p className={styles.role}>Full-stack Software Engineer, {PERSON.where}</p>
            <Social className={styles.social} />
          </div>

          <nav className={styles.col} aria-label="Work">
            <p className={`label ${styles.colHead}`}>Work</p>
            {PROJECTS.map((p) => (
              <Link key={p.slug} href={`/work/${p.slug}/`} className={`act act-underline ${styles.link}`}>
                {p.name}
              </Link>
            ))}
            <Link href="/projects/" className={`act act-underline act-nudge ${styles.link}`} data-dir="right">
              All projects
              <Arrow dir="right" />
            </Link>
          </nav>

          <nav className={styles.col} aria-label="More">
            <p className={`label ${styles.colHead}`}>More</p>
            <Link href="/lab/" className={`act act-underline ${styles.link}`}>Lab</Link>
            <Link href="/resume/" className={`act act-underline ${styles.link}`}>Resume</Link>
            <Link href="/#industry" className={`act act-underline ${styles.link}`}>Industry</Link>
          </nav>

          <div className={styles.col}>
            <p className={`label ${styles.colHead}`}>Reach</p>
            <a href={`mailto:${PERSON.email}`} className={`act act-underline ${styles.link}`}>{PERSON.email}</a>
            <a
              href={PERSON.github}
              className={`act act-underline act-nudge ${styles.link}`}
              data-dir="up-right"
              rel="noreferrer"
            >
              {PERSON.githubLabel}
              <Arrow dir="up-right" />
            </a>
          </div>
        </div>

        <p className={`label ${styles.legal}`}>
          <span>Built with Next.js. Malaysia, 2026.</span>
          <span>No cookies, no analytics, no tracking.</span>
        </p>
      </div>
    </footer>
  );
}
