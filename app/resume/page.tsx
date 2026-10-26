import type { Metadata } from "next";
import { openGraph } from "@/lib/site";
import { PERSON, RESUME } from "@/lib/content";
import styles from "./resume.module.css";

export const metadata: Metadata = {
  title: "Resume — Software Engineer",
  description: `Resume of ${PERSON.name}, software engineer in Malaysia: .NET and mobile internship work, Rust, TypeScript and C# skills, education and awards.`,
  alternates: { canonical: "/resume/" },
  openGraph: openGraph({
    title: "Resume — Software Engineer",
    description: `Resume of ${PERSON.name}, software engineer in Malaysia: .NET and mobile internship work, Rust, TypeScript and C# skills, education and awards.`,
    url: "/resume/",
    type: "profile",
  }),
};

/* **bold** markers in the content file become <strong>. */
function rich(text: string) {
  return text.split("**").map((part, i) =>
    i % 2 ? <strong key={i}>{part}</strong> : part,
  );
}

/* The two files behind the buttons. Both are written by
   tools/resume-export.mjs from RESUME, so rerun it after editing the
   content: the .tex is Jake's template filled in, the PDF is this sheet
   printed to Letter. */
const FILE = "Adwin_Chee_Resume";

/* The resume, laid out as Jake Gutierrez's LaTeX template: Computer
   Modern, small-caps section heads over a hairline rule, a bold/italic
   two-line heading per entry with dates flush right. Content lives in
   lib/content.ts (RESUME). Every line rises in reading order through the
   site's data-reveal; the section rules draw in as their heading lands. */
export default function Resume() {
  const { education: edu, experience: exp, projects, skills } = RESUME;

  let n = 0;
  const reveal = () => ({
    "data-reveal": true,
    style: { "--reveal-delay": `${Math.min(n++, 24) * 40}ms` } as React.CSSProperties,
  });

  return (
    <article className={styles.page}>
      <div className={styles.bar} {...reveal()}>
        <h1 className={`label ${styles.barTitle}`}>Resume</h1>
        <div className={styles.actions}>
          <a href="/resume.tex" download={`${FILE}.tex`} className={`pill pill-ghost ${styles.dl}`}>
            <DownloadGlyph />
            Download .tex
          </a>
          <a href="/resume.pdf" download={`${FILE}.pdf`} className={`pill pill-solid ${styles.dl}`}>
            <DownloadGlyph />
            Download PDF
          </a>
        </div>
      </div>

      <div className={styles.sheet}>

        <header className={styles.head}>
          <p className={styles.name} {...reveal()}>{PERSON.name}</p>
          <p className={styles.contact} {...reveal()}>
            <a href={`mailto:${PERSON.email}`}>{PERSON.email}</a>
            <span className={styles.sep}>|</span>
            <a href={PERSON.linkedin} rel="noreferrer">{PERSON.linkedinLabel}</a>
            <span className={styles.sep}>|</span>
            <a href={PERSON.github} rel="noreferrer">{PERSON.githubLabel}</a>
          </p>
        </header>

        <section>
          <h2 className={styles.section} {...reveal()}>Education</h2>
          <div className={styles.list}>
            <div className={styles.entry}>
              <div className={`${styles.row} ${styles.top}`} {...reveal()}>
                <span>{edu.school}</span><span>{edu.where}</span>
              </div>
              <div className={`${styles.row} ${styles.sub}`} {...reveal()}>
                <span>{edu.degree}</span><span>{edu.period}</span>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className={styles.section} {...reveal()}>Experience</h2>
          <div className={styles.list}>
            <div className={styles.entry}>
              <div className={`${styles.row} ${styles.top}`} {...reveal()}>
                <span>{exp.title}</span><span>{exp.period}</span>
              </div>
              <div className={`${styles.row} ${styles.sub}`} {...reveal()}>
                <span>{exp.org}</span><span>{exp.where}</span>
              </div>
              <ul className={styles.bullets}>
                {exp.bullets.map((b) => <li key={b} {...reveal()}>{rich(b)}</li>)}
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h2 className={styles.section} {...reveal()}>Projects</h2>
          <div className={styles.list}>
            {projects.map((p) => (
              <div key={p.name} className={styles.entry}>
                <div className={`${styles.row} ${styles.proj}`} {...reveal()}>
                  <span>
                    <a href={p.href} className={styles.projLink}><strong>{p.name}</strong></a>
                    {" | "}<em>{p.stack}</em>
                  </span>
                  <span>{p.period}</span>
                </div>
                <ul className={styles.bullets}>
                  {p.bullets.map((b) => <li key={b} {...reveal()}>{rich(b)}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className={styles.section} {...reveal()}>Technical Skills</h2>
          <div className={styles.skills}>
            {skills.map((t) => (
              <p key={t.label} {...reveal()}><strong>{t.label}</strong>: {t.items}</p>
            ))}
          </div>
        </section>

      </div>
    </article>
  );
}

function DownloadGlyph() {
  return (
    <svg className={styles.glyph} viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M3 13.5h10" />
    </svg>
  );
}
