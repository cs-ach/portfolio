import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { openGraph } from "@/lib/site";
import { notFound } from "next/navigation";
import { PERSON, PROJECTS } from "@/lib/content";
import ProjectHero from "@/components/project/ProjectHero";
import Figure from "@/components/figures/Figure";
import States from "@/components/figures/States";
import LiveLink from "@/components/LiveLink";
import NextProject from "@/components/NextProject";
import Meta from "@/components/case/Meta";
import SectionHead from "@/components/case/SectionHead";
import styles from "./project.module.css";

export function generateStaticParams() {
  return PROJECTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = PROJECTS.find((x) => x.slug === slug);
  if (!p) return {};
  /* The pitch's first sentence says what the project is; the tail says
     whose it is and what it is made of, for the searches that use those. */
  const lead = p.pitch.match(/^.*?\.(?=\s|$)/)?.[0] ?? p.pitch;
  const tail = ` A case study by ${PERSON.name}, software engineer. Built with ${p.stack.slice(0, 4).join(", ")}.`;
  const title = `${p.name} — ${p.discipline}`;
  const description = lead + tail;
  const url = `/work/${p.slug}/`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: openGraph({ title, description, url, type: "article" }),
  };
}

/* Stagger for a run of siblings that enter together. Small steps: the
   point is that a list reads top to bottom as it arrives, not that the
   reader waits for it. */
const delay = (i: number) => ({ "--reveal-delay": `${i * 70}ms` }) as CSSProperties;

/* A case study, after the shape of joonassandell.com's project pages.

   The hero is the same component the project was shown as on the list,
   in "page" mode, so the click that opened this page morphs the list
   hero into this one rather than cutting to something new. It renders
   the h1 and owns its own morph attributes, which is why nothing inside
   it carries data-reveal: a morph that lands on an element still at
   opacity 0 lands on nothing.

   After it the page is a sequence of numbered chapters on the light
   ground, each opened by a hairline: what the project refuses to do and
   the facts about it, the interface, how it works,
   what it does when it fails, the decisions behind it. Most of the
   width is whitespace on purpose; the only strong colour on the page is
   the dark interface itself. It ends on the next project's hero, so
   finishing one case study opens straight into the next. */
export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = PROJECTS.find((x) => x.slug === slug);
  if (!p) notFound();

  const id = (s: string) => `${p.slug}-${s}`;
  let n = 0;
  const chapter = () => ++n;

  return (
    <article>
      <ProjectHero project={p} mode="page" />

      {/* The governing constraint, stated as large as anything on the
          page, beside the facts a reader scans for first. The heading
          is visually hidden: the statement is the visible opener, and a
          numbered "Overview" head above it would only push it down. */}
      <section className={styles.intro} aria-labelledby={id("intro")}>
        <div className="wrap">
          <h2 id={id("intro")} className="sr-only">Overview</h2>
          <div className={styles.introGrid}>
            <p className={styles.statement} data-reveal>{p.refusal}</p>
            <Meta project={p} />
          </div>

          <div className={styles.introCopy}>
            <p className={`lead ${styles.pitch}`} data-reveal>{p.pitch}</p>
            <p className={styles.body} data-reveal style={delay(1)}>{p.lede}</p>
          </div>
        </div>
      </section>

      {/* The thing itself, before any more words about it. The band is
          full-bleed and lit like the hero's plinth, in the project's own
          tones, so the interface sits on the project's own ground.

          The figure is shown at up to the panel's real 800×480. The Shell
          scales itself to its container's width, so on a narrower screen
          it shrinks whole to fit rather than scrolling. Any other figure
          that is wider than its frame scrolls sideways inside it; the
          scroller is focusable so a keyboard can scroll it too, and is
          labelled by the caption. */}
      <section
        className={styles.showcase}
        aria-labelledby={id("fig")}
        style={{ "--stage": p.tone.stage, "--stage-alt": p.tone.stageAlt } as CSSProperties}
      >
        <h2 id={id("fig")} className="sr-only">The interface</h2>
        <div className={`wrap ${styles.showcaseInner}`}>
          <figure className={`ui-dark ${styles.figure}`} data-kind={p.figure} data-reveal>
            <div
              className={styles.scroller}
              tabIndex={0}
              role="region"
              aria-label={`${p.name} interface, scrollable`}
            >
              <div className={styles.figInner}>
                <Figure kind={p.figure} />
              </div>
            </div>
            <figcaption className={styles.caption}>{p.figureCaption}</figcaption>
          </figure>
        </div>
      </section>

      {/* Why on the left, held in place while the numbered detail
          scrolls past it on the right, so the argument stays in view
          beside the evidence for it. */}
      <section className={styles.section} aria-labelledby={id("how")}>
        <div className="wrap">
          <SectionHead id={id("how")} n={chapter()} title="How it works" />
          <div className={styles.split}>
            <div className={styles.sticky}>
              <p className={`lead ${styles.why}`} data-reveal>{p.why}</p>
            </div>
            <ol className={styles.rows}>
              {p.detail.map((d, i) => (
                <li key={d} className={styles.row} data-reveal style={delay(i)}>
                  <span className={`label ${styles.rowNum}`} aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className={styles.rowText}>{d}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby={id("states")}>
        <div className="wrap">
          <SectionHead id={id("states")} n={chapter()} title="When things go wrong" />
          {/* Scrolls rather than clips: each state card holds a 300px
              minimum so it stays legible as a fragment of the product,
              which is wider than this panel at 320. */}
          <div className={`ui-dark ${styles.statesPanel}`} data-reveal>
            <States states={p.states} />
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby={id("dec")}>
        <div className="wrap">
          <SectionHead id={id("dec")} n={chapter()} title="Decisions" />
          <ol className={styles.decisions}>
            {p.decisions.map((d, i) => (
              <li key={d.q} className={styles.decision} data-reveal>
                <span className={`label ${styles.rowNum}`} aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className={styles.decBody}>
                  <h3 className={styles.decQ}>{d.q}</h3>
                  <p className={styles.decA}>{d.a}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* desk-companion carries the live protocol figure; the others do not
          have one, so they do not get a decorative stand-in. */}
      {p.slug === "desk-companion" ? (
        <section className={styles.section} aria-labelledby={id("live")}>
          <div className="wrap">
            <SectionHead id={id("live")} n={chapter()} title="Send a frame yourself" />
            <p className={styles.body} data-reveal>
              Switch a module on the host and a real frame crosses the wire and
              repaints the device. The message names are lifted from the{" "}
              <code className={styles.code}>protocol</code> crate; nothing here
              is a canned animation.
            </p>
            <div className={`ui-dark ${styles.liveFig}`} data-reveal>
              <LiveLink />
            </div>
          </div>
        </section>
      ) : null}

      {/* One way onward rather than a "read these next" grid: the case
          study still ends on its own argument, and the next one is a
          single deliberate step, which is also where the page
          transition earns its keep. */}
      <NextProject slug={p.slug} />
    </article>
  );
}
