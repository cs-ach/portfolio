import { PERSON } from "@/lib/content";
import styles from "./Social.module.css";

/* GitHub and LinkedIn, as round icon buttons.

   The icons are inline SVG so they take the surrounding colour and need
   no icon font. Each link carries a real accessible name, because a
   circle with a glyph in it says nothing on its own. */

const LINKS = [
  {
    href: PERSON.github,
    label: "GitHub",
    path: "M9 19c-5 1.5-5-2.5-7-3m14 6v-3.9a3.4 3.4 0 0 0-.9-2.6c3-.3 6.2-1.5 6.2-6.7A5.2 5.2 0 0 0 19.9 5a4.9 4.9 0 0 0-.1-3.6s-1.1-.3-3.8 1.4a13 13 0 0 0-7 0C6.3 1.1 5.2 1.4 5.2 1.4A4.9 4.9 0 0 0 5.1 5a5.2 5.2 0 0 0-1.4 3.6c0 5.2 3.2 6.4 6.2 6.7a3.4 3.4 0 0 0-.9 2.6V22",
  },
];

export default function Social({ className }: { className?: string }) {
  return (
    <ul className={[styles.list, className].filter(Boolean).join(" ")}>
      <li>
        <a href={PERSON.github} className={`act ${styles.link}`} aria-label="GitHub" rel="me noreferrer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d={LINKS[0].path} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </li>
      <li>
        <a href={PERSON.linkedin} className={`act ${styles.link}`} aria-label="LinkedIn" rel="me noreferrer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <path d="M8 11v6M8 7.6v.1M12.5 17v-3.2a2 2 0 0 1 4 0V17" strokeLinecap="round" />
          </svg>
        </a>
      </li>
    </ul>
  );
}
