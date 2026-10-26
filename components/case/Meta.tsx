import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import type { Project } from "@/lib/content";
import Arrow from "@/components/Arrow";
import styles from "./case.module.css";

/* The intro's metadata grid.

   Small label/value columns, each with a thin rule above it, the way a
   studio credits a job: what kind of work, when, where it stands, what
   it is built with and where to see it. A <dl> because that is exactly
   what it is, a list of names and their values, and a screen reader
   announces it as one.

   Status is optional in the content, so its column is left out rather
   than shown as an empty dash. Stack lists every item, not a summary:
   a reader checking whether the project used a particular tool should
   find it here without reading the body.

   Source is the one column whose value can be a link, two links, or a
   plain sentence for a private repository. The back link to the full
   list closes the grid, since this is the last place on the page where
   a reader is still deciding whether to keep going. Its arrow travels
   left, the way the action goes; the reveal sits on a wrapper because
   the reveal's own transform would otherwise win over the press. */
export default function Meta({ project: p }: { project: Project }) {
  const items: { label: string; value: ReactNode; wide?: boolean }[] = [
    { label: "Discipline", value: p.discipline },
    { label: "Year", value: p.year },
  ];
  if (p.status) items.push({ label: "Status", value: p.status });
  items.push({
    label: "Stack",
    wide: true,
    value: (
      <ul className={styles.metaList}>
        {p.stack.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
    ),
  });

  const source =
    p.live || p.href ? (
      <ul className={styles.metaList}>
        {p.live ? (
          <li>
            <a href={p.live} className={`act act-nudge ${styles.metaLink}`} data-dir="up-right">
              Live demo
              <Arrow dir="up-right" />
            </a>
          </li>
        ) : null}
        {p.href ? (
          <li>
            <a href={p.href} className={`act act-nudge ${styles.metaLink}`} data-dir="up-right">
              Source code
              <Arrow dir="up-right" />
            </a>
          </li>
        ) : null}
      </ul>
    ) : (
      p.privateNote
    );
  if (source) items.push({ label: "Source", value: source, wide: true });

  return (
    <div className={styles.metaWrap}>
      <dl className={styles.meta}>
        {items.map((it, i) => (
          <div
            key={it.label}
            className={`${styles.metaItem} ${it.wide ? styles.metaWide : ""}`}
            data-reveal
            style={{ "--reveal-delay": `${i * 60}ms` } as CSSProperties}
          >
            <dt className="label">{it.label}</dt>
            <dd className={styles.metaValue}>{it.value}</dd>
          </div>
        ))}
      </dl>

      <div className={styles.backRow} data-reveal>
        <Link href="/projects/" className={`act act-nudge ${styles.back}`} data-dir="left">
          <Arrow dir="left" />
          All projects
        </Link>
      </div>
    </div>
  );
}
