import type { Metadata } from "next";
import Link from "next/link";
import Runner from "@/components/notfound/Runner";
import styles from "@/components/notfound/NotFound.module.css";

/* Play.

   The 404's runner, with a door of its own: the little cat in the bar
   leads here, so the game is findable without anyone having to get
   lost first. Same stage, same `data-no-cat` to send the roaming cat
   off while this one is busy. */
export const metadata: Metadata = {
  title: "Play",
  description: "A small runner game: the site's cat hops over parcels, cables and stray packets on a desk.",
  alternates: { canonical: "/play/" },
};

export default function Play() {
  return (
    <section className={`wrap ${styles.page}`} data-no-cat>
      <div className={styles.head}>
        <p className={styles.eyebrow}>Break time</p>
        <h1 className={`display ${styles.title}`}>The cat needs a run.</h1>
        <p className={styles.lead}>
          Someone left parcels and cables all over the desk. Help it
          clear them, and see how far it gets.
        </p>
        <div className={styles.actions}>
          <Link href="/" className="pill pill-ghost">Back home</Link>
        </div>
      </div>

      <div className={styles.game}>
        <Runner prompt="Clear the desk" />
        <p className={`${styles.note} ${styles.keyNote}`}>
          Space, up arrow or W to jump.
        </p>
      </div>
    </section>
  );
}
