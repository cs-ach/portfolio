import type { Metadata } from "next";
import Script from "next/script";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
import { PERSON, STACK, EDUCATION, RESUME } from "@/lib/content";
import { SITE, absolute } from "@/lib/site";
import JsonLd from "@/components/seo/JsonLd";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Boot from "@/components/ui/Boot";
import Preloader from "@/components/ui/Preloader";
import TransitionProvider from "@/components/transition/TransitionProvider";
import DeviceLayer from "@/components/three/DeviceLayer";
import Oneko from "@/components/oneko/Oneko";
import "./globals.css";

/* Two families. Instrument Sans is a clean grotesque that holds up at
   display sizes without the mechanical feel of a UI font, and it is
   not Inter. JetBrains Mono carries the small technical labels:
   stacks, years, section eyebrows. */

const sans = Instrument_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-mono",
});

/* What a search engine and a link preview read before anything on the
   page. The name leads every string because it is the query this site
   is written to answer. metadataBase turns the relative paths the pages
   hand in ("/resume/") into absolute URLs on the production origin. */

const DESCRIPTION =
  "Adwin Chee is a full-stack software engineer in Malaysia. Rust on a Raspberry Pi, TypeScript and C# on the web, Kotlin and Swift on the phone.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: "Adwin Chee — Full-stack Software Engineer",
    template: "%s — Adwin Chee",
  },
  description: DESCRIPTION,
  keywords: SITE.keywords,
  applicationName: "Adwin Chee",
  authors: [{ name: PERSON.name, url: SITE.url }],
  creator: PERSON.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "profile",
    siteName: "Adwin Chee",
    locale: SITE.locale,
    url: "/",
    title: "Adwin Chee — Full-stack Software Engineer",
    description: DESCRIPTION,
    firstName: "Adwin",
    lastName: "Chee",
  },
  twitter: {
    card: "summary_large_image",
    title: "Adwin Chee — Full-stack Software Engineer",
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  formatDetection: { email: false, address: false, telephone: false },
};

/* The same facts as the page, in the form a crawler can use to tie the
   name to a person. Every field comes from lib/content.ts: the school
   from EDUCATION, the employer from RESUME, the topics from STACK. */

const PERSON_ID = `${SITE.url}/#person`;

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Person",
      "@id": PERSON_ID,
      name: PERSON.name,
      alternateName: "Adwin",
      jobTitle: "Software Engineer",
      url: SITE.url,
      image: absolute("/assets/adwin.jpg"),
      email: `mailto:${PERSON.email}`,
      sameAs: [PERSON.github, PERSON.linkedin],
      address: { "@type": "PostalAddress", addressCountry: "MY" },
      knowsAbout: STACK.flatMap((t) => t.items.map((i) => i.name)),
      alumniOf: { "@type": "CollegeOrUniversity", name: EDUCATION[0].place },
      worksFor: { "@type": "Organization", name: RESUME.experience.org },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE.url}/#website`,
      name: "Adwin Chee",
      url: SITE.url,
      inLanguage: "en",
      author: { "@id": PERSON_ID },
    },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable}`}
      /* Without this, Next 16 leaves `scroll-behavior: smooth` in charge
         during navigation, and a new page opened at the old offset. */
      data-scroll-behavior="smooth"
      /* The pre-paint script stamps data-js before React hydrates, so
         the attribute is absent from the server HTML by design. */
      suppressHydrationWarning
    >
      <body>
        <JsonLd data={structuredData} />
        <Script id="js-flag" strategy="beforeInteractive">
          {"document.documentElement.dataset.js='1'"}
        </Script>
        {/* The loading sequence's curtain, up before the first paint.
            The loader itself is React's and cannot be: the browser has
            painted the page by the time hydration runs, which is a
            flash of the site in front of its own introduction. This
            raises the flag the stylesheet paints the wall from
            (globals.css, "the first frame") on the loads the Preloader
            will play — the landing page, where motion is welcome — so
            the first frame is already the loader's ground.

            The value says which curtain: 'phone' (narrow and upright,
            the same test as Preloader.tsx's isPhone) is the phone's
            black boot screen, anything else the laptop's wall.

            A plain inline script, and not next/script: a
            `beforeInteractive` script is handed to the client inside
            the flight payload and runs when React processes it, which
            is the hydration this is meant to get in front of. Written
            here, it is an ordinary blocking script in the document,
            executed where it stands — before the browser has parsed,
            let alone painted, any of the page below it.

            The failsafe is for a load where React never arrives: a
            broken bundle should not leave the page behind a curtain
            forever. The Preloader clears it as it mounts, and owns
            every budget from then on. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              `try{var p=location.pathname;if((p==='/'||p==='/index.html')` +
              `&&!matchMedia('(prefers-reduced-motion: reduce)').matches){` +
              `document.documentElement.dataset.loading=` +
              `(innerWidth<760&&innerHeight>innerWidth)?'phone':'1';` +
              `window.__loaderCurtain=setTimeout(function(){` +
              `delete document.documentElement.dataset.loading},10000)}}catch(e){}`,
          }}
        />
        <a href="#main" className="skip">Skip to content</a>
        <Boot />
        <Preloader name={PERSON.name} />
        <TransitionProvider />
        {/* Everything the visitor reads lives in one element, so the
            loading sequence can scale the whole page down into the
            device's display and then back out to fill the window. */}
        <div id="stage">
          <Nav />
          <main id="main">{children}</main>
          <Footer />
        </div>
        {/* The projects' 3D devices, one live model each for the whole
            visit. Outside the page and outside #stage, so a route change
            carries a device to its new place instead of rebuilding it. */}
        <DeviceLayer />
        {/* The cat. Outside #stage for the same reason as the devices,
            and more so: the loader scales #stage down into the machine's
            screen, and a cat in there would be shrunk with the page and
            walk around inside the laptop. It does not spawn until the
            sequence has handed the page back, so it is only ever at the
            window's own scale. */}
        <Oneko />
      </body>
    </html>
  );
}
