import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { PROJECTS, type Project } from "@/lib/content";
import Figure from "@/components/figures/Figure";
import DeviceStage from "./DeviceStage";
import styles from "./ProjectHero.module.css";

/* A project's hero, presented as an exhibit: one object under a light,
   standing on its plinth, with its card beside it. The same component in
   all three places a project is shown: the home page and /projects/
   (mode "list"), the foot of another case study ("next"), and the top of
   its own case study ("page").

   Opening a project does not slide to a new page. The page transition
   pairs the parts marked here and moves each one to its place on the
   case study, which starts with this same hero (design/07-REDESIGN.md):

     data-vt-src / data-vt-dst = "hero"        the lit stage
                               = "hero-title"  the title

   The device is not photographed at all. It is one live model per
   project in the persistent device layer, which carries the same canvas
   from this hero's slot to the case study's (components/three).

   The list and the page are two compositions of the same parts, not two
   copies of one picture: in a list the card stands to the left of the
   device; on the page the device comes to the middle of the window and
   grows to fill the height under the bar, the title crosses to its left
   and the lead line to its right, so the two read as a pair of captions
   either side of the object, and the breadcrumb, label, spec table and
   scroll cue line the card's top and foot (ProjectHero.module.css, "the
   page's own composition"). The transition moves and scales each marked part
   between them, and the layer carries the device with a swing of the
   model itself, which is what makes the hand-over visibly travel. The parts keep their shape (same
   markup, same aspect), so the move reads as the same object. The slots
   that differ between modes (the breadcrumb, the "Next project" kicker,
   the call to action) are the fixed-height line above the label and the
   block below the spec table. None of the three morph parts carries
   data-reveal, because a part still waiting for its scroll reveal would
   be photographed invisible.

   A server component; the device's motion is DeviceStage's. */

type Mode = "list" | "page" | "next";

/* How each device is named in the canvas's accessible label. */
const DEVICE_NAME: Record<Project["device"], string> = {
  ipad: "an iPad",
  macbook: "a MacBook Air",
  iphone: "an iPhone",
};

const pad = (n: number) => String(n).padStart(2, "0");

export default function ProjectHero({
  project,
  mode,
  index,
  total,
}: {
  project: Project;
  mode: Mode;
  index?: number;
  total?: number;
}) {
  const page = mode === "page";
  /* The attribute names are fixed by the transition: the hero being left
     is the source, the hero arriving is the destination. */
  const vt = (key: string) => (page ? { "data-vt-dst": key } : { "data-vt-src": key });

  const vars = {
    "--stage": project.tone.stage,
    "--stage-alt": project.tone.stageAlt,
  } as CSSProperties;

  /* The page is not told its position, so it counts from the project's
     own number; the label then reads the same on both sides of a morph. */
  const n = index !== undefined ? pad(index + 1) : project.index;
  const of = pad(total ?? PROJECTS.length);

  const spec: [string, string][] = [
    ["Discipline", project.discipline],
    ["Built with", project.stack.slice(0, 3).join(", ")],
    ["Year", project.year],
  ];
  if (project.status) spec.push(["Status", project.status]);

  const Title = page ? "h1" : "h2";

  const body = (above: ReactNode, below: ReactNode) => (
    <div className={styles.pin}>
      <div className={styles.stage} {...vt("hero")} aria-hidden="true" />

      <div className={styles.grid}>
        <div className={styles.text}>
          <div className={styles.above}>{above}</div>
          <p className={`label ${styles.label}`}>
            Exhibit {n} / {of}
          </p>
          {/* The name and the line under it travel together, so they are
              one box: on a project page this is the single grid item that
              sits where the list's text column sits, which is what lets
              the device keep the same column in both and stop sliding
              across the window on the hand-over. */}
          <div className={styles.lede}>
            <Title className={styles.title} {...vt("hero-title")}>
              {project.name}
            </Title>
            <p className={styles.refusal}>{project.refusal}</p>
          </div>
          <dl className={styles.spec}>
            {spec.map(([k, v]) => (
              <div key={k} className={styles.row}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          {below}
        </div>

        <div className={styles.plinth}>
          <DeviceStage slug={project.slug} mode={mode} kind={project.device} label={`${project.name}'s interface on ${DEVICE_NAME[project.device]}`}>
            <Figure kind={project.figure} />
          </DeviceStage>
        </div>
      </div>
    </div>
  );

  if (page) {
    return (
      <header className={styles.hero} data-mode="page" data-hero style={vars}>
        {body(
          <nav className={styles.crumb} aria-label="Breadcrumb">
            <Link href="/projects/">Projects</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{project.name}</span>
          </nav>,
          <p className={styles.cue}>
            Scroll
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M8 3v10M4 9l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </p>,
        )}
      </header>
    );
  }

  /* list and next: the whole hero is one link, so there is a single target
     per project, named by aria-label. The pill is only a picture of the
     affordance; the click lands on the hero. Which is why the pill cannot
     wear globals' .act / .act-nudge: those answer to their own :hover, and
     nobody hovers a pill the size of a stamp inside a hero the size of the
     window. The hero answers for it instead, in the stylesheet, to the same
     contract (design/08-INTERACTION.md) — hence [data-arrow], the hook the
     contract puts on the glyph that travels. */
  return (
    <Link
      href={`/work/${project.slug}/`}
      className={styles.hero}
      data-mode={mode}
      data-hero
      style={vars}
      aria-label={`${project.name}, case study`}
    >
      {body(
        mode === "next" ? <p className={styles.kicker}>Next project</p> : null,
        <span className={styles.cta} aria-hidden="true">
          Read the case study
          <svg data-arrow viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>,
      )}
    </Link>
  );
}
