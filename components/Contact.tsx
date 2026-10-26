import { PERSON } from "@/lib/content";
import CopyEmail from "./ui/CopyEmail";
import Social from "./ui/Social";
import styles from "./Contact.module.css";

/* Contact.

   No form. The address is right there, with a copy button for the
   people who would rather paste it into their own client than launch
   whatever mailto opens. */
export default function Contact() {
  return (
    <section id="contact" className={`section ${styles.section}`}>
      <div className="wrap">
        <div className={styles.inner} data-reveal>
          <h2 className={styles.heading}>
            Tell me what you&apos;re building.
          </h2>
          <p className={styles.lead}>
            I&apos;m looking for full-stack work and happy to talk about
            anything device-shaped. {PERSON.where}.
          </p>

          {/* The wipe is the shared .act-underline now rather than a
              local copy of it, so the biggest link on the site and the
              smallest one are drawing the same rule. */}
          <a href={`mailto:${PERSON.email}`} className={`act-underline ${styles.address}`}>
            {PERSON.email}
          </a>

          <div className={styles.actions}>
            <CopyEmail email={PERSON.email} className={`pill pill-ghost ${styles.copy}`} />
            <Social />
          </div>
        </div>
      </div>
    </section>
  );
}
