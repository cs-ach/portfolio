"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { PERSON } from "@/lib/content";
import styles from "./Nav.module.css";

/* The bar.

   It is translucent and sits over the page, gaining a hairline and a
   stronger blur once you have scrolled past the top. The wordmark is a
   link home; on an inner page it also serves as the way back. */

const LINKS = [
  { href: "/projects/", label: "Projects" },
  { href: "/lab/", label: "Lab" },
  { href: "/resume/", label: "Resume" },
];

export default function Nav() {
  const [lifted, setLifted] = useState(false);
  const pathname = usePathname();
  /* A case study counts as being inside Projects. */
  const current = (href: string) =>
    pathname.startsWith(href.replace(/\/$/, "")) ||
    (href === "/projects/" && pathname.startsWith("/work"));

  useEffect(() => {
    const onScroll = () => setLifted(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={styles.bar} data-lifted={lifted || undefined} data-site-nav>
      <div className={`wrap ${styles.inner}`}>
        <Link href="/" className={`act ${styles.wordmark}`}>{PERSON.name}</Link>

        <nav aria-label="Primary" className={styles.nav}>
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`act ${styles.link}`}
              aria-current={current(l.href) ? "page" : undefined}
            >
              {l.label}
            </Link>
          ))}
          {/* The bar's one action, and the place the arrow idea is
              stated for the rest of the site: the glyph travels the way
              the action goes, a little on hover and twice as far once
              you commit. The label stays real text, so the accessible
              name is "Contact" and the arrow is decoration that merely
              agrees with it. */}
          <Link href="/#contact" className={`pill pill-solid act-nudge ${styles.cta}`} data-dir="right">
            Contact
            <svg
              className={styles.arrow}
              data-arrow
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" />
            </svg>
          </Link>
        </nav>
      </div>
    </header>
  );
}
