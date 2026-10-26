import type { Metadata } from "next";
import { openGraph } from "@/lib/site";
import Link from "next/link";
import Arrow from "@/components/Arrow";
import { PERSON } from "@/lib/content";
import Shell from "@/components/hero/Shell";
import Vault from "@/components/figures/Vault";
import Ledger from "@/components/figures/Ledger";
import LiveLink from "@/components/LiveLink";
import Bench from "@/components/lab/Bench";
import LabRail from "@/components/lab/LabRail";
import ScrollFrame from "@/components/lab/ScrollFrame";
import { EXPERIMENTS } from "@/components/lab/experiments";
import styles from "./lab.module.css";

export const metadata: Metadata = {
  title: "Lab — Interactive Project Demos",
  description: `A lab by ${PERSON.name}, software engineer: interfaces from real projects running in the browser. Send a frame to a device, derive a key, settle a payment.`,
  alternates: { canonical: "/lab/" },
  openGraph: openGraph({
    title: "Lab — Interactive Project Demos",
    description: `A lab by ${PERSON.name}, software engineer: interfaces from real projects running in the browser. Send a frame to a device, derive a key, settle a payment.`,
    url: "/lab/",
    type: "website",
  }),
};

/* The lab.

   A test bench. Each experiment is one real interface from a project,
   rebuilt so it runs here and set up so a visitor can drive it, with a spec
   row that says where it comes from and a note on what is genuinely
   implemented versus simulated. Nothing is a recording, nothing talks to a
   server and nothing is stored.

   The experiments' copy lives in components/lab/experiments.ts so the
   index, the benches and the teaser on the home page cannot disagree.

   Each live component is wrapped in `ui-dark`: they were authored against
   their own dark palette (a screen is dark whatever the page is), and that
   wrapper gives them back the tokens they expect without restyling them. */

const [DESK, LINK, VAULT, LEDGER] = EXPERIMENTS;

export default function Lab() {
  return (
    <article className={styles.page}>
      <header className={`wrap ${styles.head}`}>
        <h1 className={`display ${styles.title}`} data-reveal>
          The lab
        </h1>
        <p className={`lead ${styles.lead}`} data-reveal>
          The interfaces from my projects, running for real in your browser.
          Press things.
        </p>

        {/* The plain list. It is the whole index on a phone, and a summary
            of the benches below on a wide screen, where the sticky rail
            takes over once you scroll. */}
        <nav aria-label="All experiments" data-reveal>
          <ol className={styles.index}>
            {EXPERIMENTS.map((x) => (
              <li key={x.id}>
                <a href={`#${x.id}`} className={`act ${styles.indexLink}`}>
                  <span className={styles.indexN}>{x.n}</span>
                  <span className={styles.indexName}>{x.name}</span>
                  <span className={styles.indexProject}>{x.project}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </header>

      {/* position: relative is what the sticky rail measures itself against:
          it spans exactly the benches and nothing above them. */}
      <div className={styles.benches}>
        <LabRail items={EXPERIMENTS} />

        <Bench x={DESK}>
          <ScrollFrame width={800} label="The desk screen, 800 by 480 pixels">
            <div className="ui-dark">
              <Shell />
            </div>
          </ScrollFrame>
        </Bench>

        <Bench x={LINK} tone="dark">
          <div className="ui-dark">
            <LiveLink />
          </div>
        </Bench>

        <Bench x={VAULT}>
          <div className={`ui-dark ${styles.vault}`}>
            <Vault />
          </div>
        </Bench>

        <Bench x={LEDGER}>
          <div className={`ui-dark ${styles.ledger}`}>
            <Ledger />
          </div>
        </Bench>
      </div>

      <p className={`wrap ${styles.foot}`} data-reveal>
        Each of these has a longer write-up on its{" "}
        <Link href="/projects/" className={`act act-nudge ${styles.link}`} data-dir="right">
          project page
          <Arrow dir="right" />
        </Link>
        .
      </p>
    </article>
  );
}
