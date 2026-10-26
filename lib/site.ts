/* Where the site lives, and the words it wants to be found by.

   One origin for every absolute URL the site prints about itself:
   canonicals, the sitemap, Open Graph and the structured data. The
   pages pass paths ("/resume/") and metadataBase in the root layout
   turns them into full URLs. */

export const SITE = {
  url: "https://adwin.dev",
  /* The search terms the site is written for. Name first: the name is
     the query a recruiter types after reading a CV. */
  keywords: [
    "Adwin",
    "Adwin Chee",
    "Adwin Chee software engineer",
    "Adwin Chee portfolio",
    "software engineer",
    "full-stack software engineer",
    "software engineer Malaysia",
    "Rust",
    "TypeScript",
    "C#",
    ".NET",
    "Kotlin",
    "Swift",
  ],
  locale: "en_MY",
};

export const absolute = (path: string) => new URL(path, SITE.url).toString();

/* Next replaces a parent's openGraph wholesale rather than merging it,
   so a page that sets its own loses the site name, locale and preview
   image the root layout gave it. Pages build theirs through this. */
export const openGraph = <T extends { title: string }>(og: T) => ({
  siteName: "Adwin Chee",
  locale: SITE.locale,
  images: [
    {
      url: "/opengraph-image.png",
      width: 1200,
      height: 630,
      alt: "Adwin Chee, Full-stack Software Engineer",
    },
  ],
  ...og,
  title: `${og.title} — Adwin Chee`,
});
