/* The copy deck.

   Sourced, not invented. Project detail comes from the repositories themselves
   (cs-ach/desk-companion, zta-website, neobank, file trees and commit
   history); education, awards and certificates from the CV. Internship work
   lives on a company account and is described by responsibility, never by
   invented metrics. No testimonials, clients, logos or business statistics.

   Rev 4 — rewritten so each project leads with what it is and what it does.
   The design decisions, including the ones about keys and trust, sit in the
   detail lists where they belong. No repository paths in captions. */

export const PERSON = {
  name: "Adwin Chee",
  short: "Adwin Chee",
  /* systems + web + mobile, in the order he actually works in them */
  role: "Full-stack engineer",
  email: "adwin.hansen@gmail.com",
  github: "https://github.com/cs-ach",
  githubLabel: "github.com/cs-ach",
  linkedin: "https://www.linkedin.com/in/adwin-chee-42427b354/",
  linkedinLabel: "linkedin.com/in/adwin-chee",
  where: "Malaysia",
};

/* One plain sentence per project about a decision I made in it. These are
   descriptions, not slogans. */
export const REFUSALS = [
  "Plugins run in a sandbox and never hold key material.",
  "Keys are derived in the browser, so the server never receives one.",
  "A payment request is a claim the recipient settles, not a transfer the sender pushes.",
];

export const STANCE = {
  eyebrow: "Full-stack Software Engineer",
  /* The sentence under his name. Warm, first person, and accurate:
     the Pi work is a Rust and Slint application on Linux, not
     firmware, so it is not described as firmware. */
  line:
    "I'm a full-stack engineer. I write Rust for a small Linux device on my desk, TypeScript and C# for the web, and Kotlin and Swift for mobile, and I'm happy anywhere between the database and the screen.",
  sub:
    "Final year software engineering in Malaysia, currently shipping .NET and mobile work at SeeSharp Solutions.",
};

/* ── work ─────────────────────────────────────────────────────────────── */

export interface Project {
  slug: string;
  index: string;
  name: string;
  discipline: string;
  year: string;
  status: string | null;
  /* one design decision, stated plainly */
  refusal: string;
  /* what the project is, in one or two sentences */
  pitch: string;
  blurb: string;
  /* the project page */
  lede: string;
  why: string;
  detail: string[];
  decisions: { q: string; a: string }[];
  stack: string[];
  href: string | null;
  live: string | null;
  privateNote: string | null;
  /* which interface fragment stands for it */
  figure: "shell" | "vault" | "ledger";
  /* The real device the fragment is shown on in the project hero, drawn
     as a 3D model (components/project/DeviceScene.tsx): an iPad for the
     desk panel (the closest real tablet to its 800 by 480 screen), a
     MacBook Air for the web app, an iPhone 17 Pro for the mobile one. */
  device: "ipad" | "macbook" | "iphone";
  /* The hero's two-tone stage. Quiet, warm-to-cool neutrals, one per
     project, so the three read as a set and the dark interface is the
     only strong thing on them. */
  tone: { stage: string; stageAlt: string };
  /* The short list under the name in the hero, the way a studio lists
     what it did on a job. */
  roles: string[];
  figureCaption: string;
  /* the states the interface really has, which is what a reader wants to see */
  states: { label: string; tone: "ok" | "warn" | "stop"; status: string; line: string }[];
}

export const PROJECTS: Project[] = [
  {
    slug: "desk-companion",
    index: "01",
    name: "desk-companion",
    discipline: "Systems and device",
    year: "2026",
    status: "Active",
    refusal: "Plugins run in a sandbox and never hold key material.",
    pitch:
      "A small information screen for my desk, running on a Raspberry Pi. A Rust application draws the interface on an 800 by 480 panel, and plugins fill it with whatever I want to see.",
    blurb:
      "Five Rust crates and a small JavaScript runtime. A plugin is two JS files and a manifest: one half runs on the host machine, one on the device. The host reads the manifest first, holds any secrets itself, and hands the plugin a token it can spend but not read. The device talks to the host over a framed serial protocol.",
    lede:
      "I wanted a screen on my desk that I could add new things to without rebuilding and reflashing the whole application every time. That means plugins, which means running code I did not write on a device I cannot easily get a console on. Most of the work went into the plugin host, the serial protocol and the update path rather than the graphics.",
    why:
      "A plugin is two JavaScript files and a manifest: one half runs on the host, one on the device. The manifest names every host it will call and every secret it will use, and the host reads it before a line of plugin code runs.",
    detail: [
      "Five crates: protocol, plugin, jsrt, host and pi",
      "Plugins get fetch, log, config and scoped secrets, and nothing else",
      "PKCE authorisation and secret storage on the host; the plugin spends a token it cannot read",
      "A framed serial protocol that negotiates its baud rate and version, or refuses to talk",
      "A plugin that fails repeatedly is killed, its retry budget reset after five minutes",
      "A Slint interface cross-compiled to the Pi, drawing straight to linuxkms, CJK fonts bundled",
    ],
    decisions: [
      {
        q: "Why a JavaScript runtime rather than WASM or native plugins?",
        a: "A plugin should be two small files anyone can read and change in a text editor. A JS runtime costs performance and type safety, and buys a plugin surface small enough to audit: fetch, log, config and scoped secrets, and nothing else.",
      },
      {
        q: "Why declare capabilities in a manifest instead of asking at runtime?",
        a: "A manifest can be read before a single line executes. Marking refreshToken as secret means the host holds it, runs the exchange, and hands back only the response, so the plugin can spend the token forever and never see it.",
      },
      {
        q: "Why framed and typed rather than JSON over newlines?",
        a: "A serial line gives you partial reads. Length-prefixed frames keep a partial read a partial read instead of a silently truncated message, and a protocol-version mismatch closes the link rather than guessing.",
      },
    ],
    stack: ["Rust", "Slint", "JavaScript", "Raspberry Pi"],
    href: "https://github.com/cs-ach/desk-companion",
    live: null,
    privateNote: "Private repository",
    figure: "shell",
    device: "ipad",
    tone: { stage: "#E8E3DB", stageAlt: "#DCD5CA" },
    roles: ["Systems design", "Rust runtime", "Embedded Linux"],
    figureCaption:
      "A web recreation of the device's interface at 800 by 480: the dock along the bottom, the status bar and the widget grid.",
    states: [
      {
        label: "Plugin running",
        tone: "ok",
        status: "linked",
        line: "The host ticks the plugin every three seconds and the device every second. The status pill's dot is green while the serial link is up.",
      },
      {
        label: "Plugin failing",
        tone: "warn",
        status: "retrying",
        line: "Errors are counted consecutively, not within a window, so one bad response does not spend the budget. The dock slot carries a fault badge.",
      },
      {
        label: "Plugin killed",
        tone: "stop",
        status: "stopped, 5 min",
        line: "After consecutive failures the plugin is stopped rather than left thrashing. The retry budget resets after five minutes.",
      },
    ],
  },
  {
    slug: "zta",
    index: "02",
    name: "Zero Trust Architecture",
    discipline: "Web",
    year: "2025",
    status: null,
    refusal: "Keys are derived in the browser, so the server never receives one.",
    pitch:
      "A web app for storing and sharing files. Upload, browse, share and revoke, with a React and Vue front end on an Express server.",
    blurb:
      "Files are encrypted in the browser before they are uploaded. WebCrypto does the work: PBKDF2 at 200,000 iterations to derive the key from a password, then separate keypairs for encryption and signing. A trust score decides how much a request has to prove before it runs. It has a live demo you can click through.",
    lede:
      "An encrypted file store where the encryption happens in the browser rather than on the server. The usual approach encrypts at rest with a key the server also holds, which protects against a stolen disk and little else. I wanted the server to be unable to read the files even if it were fully compromised.",
    why:
      "That pushes all key management into the browser, and it means a forgotten password is unrecoverable. It is a real trade-off, chosen deliberately rather than engineered around, and the login screen says so in plain words instead of offering a reset link that cannot work.",
    detail: [
      "Upload, browse, share and revoke, with a React and Vue front end on Express",
      "Threshold-based trust scoring decides what each request must prove",
      "All key material derived and held in the browser",
      "WebCrypto throughout: PBKDF2 at 200,000 iterations, RSA-OAEP, RSA-PSS",
      "Separate encryption and signing keypairs, so the failure modes stay independent",
      "Sensitive requests are refused while a step-up challenge is pending, never queued",
    ],
    decisions: [
      {
        q: "Why generate keys client-side and accept unrecoverable accounts?",
        a: "The alternative is the server holding something that can decrypt your files, which is the thing I was trying to remove. An unrecoverable account is an honest cost of that, and saying so is better than a recovery path that quietly reintroduces the server as a key holder.",
      },
      {
        q: "Why refuse rather than queue during a pending step-up?",
        a: "A queued request executes later, under an authentication state the user never explicitly confirmed. Refusing keeps the decision and the action in the same moment.",
      },
      {
        q: "What I would change now",
        a: "RSA-OAEP with 2048-bit keys is reasonable but not what I would choose today. ECDH on X25519 with AES-GCM is faster, smaller, and has fewer sharp edges.",
      },
    ],
    stack: ["TypeScript", "React", "Vue", "Express", "WebCrypto"],
    href: "https://github.com/cs-ach/zta-website",
    live: "https://cs-ach.github.io/zta-website/",
    privateNote: null,
    figure: "vault",
    device: "macbook",
    tone: { stage: "#E1E5E9", stageAlt: "#D3D9DF" },
    roles: ["Security design", "Web app", "Applied crypto"],
    figureCaption:
      "A diagram of how the keys are arranged, and the states a request moves through when the app asks for a second check.",
    states: [
      {
        label: "Below the threshold",
        tone: "ok",
        status: "proceed",
        line: "The trust score covers what this request asks for, so it runs. Most reading and listing sits here.",
      },
      {
        label: "Above the threshold",
        tone: "warn",
        status: "refused",
        line: "A sensitive request while a step-up is pending is refused outright. It is not queued to run later under a state the person never confirmed.",
      },
      {
        label: "Password forgotten",
        tone: "stop",
        status: "unrecoverable",
        line: "The key was derived in the browser and never left it, so there is nothing on the server to recover from. Said plainly rather than hidden behind a reset link that cannot work.",
      },
    ],
  },
  {
    slug: "neobank",
    index: "03",
    name: "neobank",
    discipline: "Web and mobile",
    year: "2025",
    status: null,
    refusal: "A payment request is a claim the recipient settles, not a transfer the sender pushes.",
    pitch:
      "A banking app for sending money, requesting it and settling what you owe. I built the whole thing: the screens, the authentication, the Express and Node backend behind them.",
    blurb:
      "Three flows, each with an empty state, a pending state, a failure state and a settled state. A request is raised by the sender and settled by the recipient, who signs it with their own key, so a mistyped request costs a decline rather than a reversal. The crypto layer is shared with the file-storage project.",
    lede:
      "Send, request and settle, built end to end in TypeScript. A payment request here is a claim the recipient can settle, decline or ignore, rather than a transfer the sender pushes out. That keeps the step that cannot be undone on one side of the exchange.",
    why:
      "Most of the time went into the front end: three flows a person actually touches, each with four states to design, and a key model that has to stay out of sight in all of them.",
    detail: [
      "Send, request and settle flows with client-held keys",
      "Authentication, backend logic and UI built end to end",
      "Shares its crypto layer with the file-storage project",
      "Zero-trust principles carried through the application flow",
    ],
    decisions: [
      {
        q: "Why model a request as a claim?",
        a: "A transfer initiated by the sender is irreversible the moment it is made. A claim moves the irreversible step to the person who holds the money, so a mistaken request costs a decline rather than a reversal.",
      },
      {
        q: "Where the work actually went",
        a: "The interface. Three flows that each have an empty state, a pending state, a failure state and a settled state, and a key model that must never appear in any of them.",
      },
    ],
    stack: ["TypeScript", "React", "Express", "Node"],
    href: "https://github.com/cs-ach/neobank",
    live: null,
    privateNote: null,
    figure: "ledger",
    device: "iphone",
    tone: { stage: "#E3E6DD", stageAlt: "#D5DACD" },
    roles: ["Product design", "Web and mobile", "Payments flow"],
    figureCaption:
      "A web recreation of the request flow: a claim moving from pending to settled, with the recipient signing at the end.",
    states: [
      {
        label: "Pending",
        tone: "warn",
        status: "awaiting the recipient",
        line: "The claim exists and nothing has moved. The sender can cancel it at no cost, because there is nothing to reverse.",
      },
      {
        label: "Settled",
        tone: "ok",
        status: "signed",
        line: "The recipient signs with their own key. That signature is the irreversible step, and it belongs to the person holding the money.",
      },
      {
        label: "Declined",
        tone: "stop",
        status: "nothing moved",
        line: "A decline costs the sender a decline. There is no refund path because there was never a transfer.",
      },
    ],
  },
];

/* ── industry ─────────────────────────────────────────────────────────── */

export const INDUSTRY = {
  role: "Software Engineering Intern",
  org: "SeeSharp Solutions",
  period: "April 2026 – present",
  lead:
    "Three streams of production work in three different stacks: a desktop and .NET test-automation platform, a multi-tenant web product, and native Android and iOS clients. Client and product names are under NDA. The responsibilities are not.",
  /* Responsibilities, not metrics. The work lives on a company account. */
  areas: [
    {
      title: "Test-automation platform",
      kind: "Systems",
      note: "An Electron desktop client over a .NET service, with test runs executed in containers.",
      responsibilities: [
        "Desktop client over a .NET service, with browser and load-test runner lanes",
        "Containerised CI execution for test runs",
        "Credential storage in the OS keychain, and per-environment base-URL resolution",
        "API-key authentication and rate limiting on the service",
        "A large integration suite kept green",
      ],
      stack: ["C#", ".NET", "Electron", "Playwright", "Docker"],
    },
    {
      title: "Multi-tenant messaging platform",
      kind: "Web",
      note: "C# and Postgres on the server, Next.js in front, with billing and onboarding included.",
      responsibilities: [
        "Campaign delivery with per-recipient template variables and quota enforcement",
        "Signed webhooks and automation triggers",
        "Billing, plan management and tenant onboarding",
        "The public marketing site",
      ],
      stack: ["C#", "ABP / DDD", "Next.js", "TypeScript", "Postgres"],
    },
    {
      title: "Native client delivery",
      kind: "Mobile",
      note: "Kotlin on Android and Swift on iOS, against the same set of services.",
      responsibilities: [
        "Feature work across native Android and iOS clients",
        "The TypeScript and Java services behind them",
      ],
      stack: ["Kotlin", "Swift", "TypeScript", "Java"],
    },
  ],
};

/* ── education and record ─────────────────────────────────────────────── */

export const EDUCATION = [
  {
    place: "Taylor's University",
    detail: "BSc Software Engineering, School of Computer Science",
    period: "2024 – Dec 2026",
  },
  { place: "Taylor's College", detail: "Diploma", period: "2022 – 2023" },
  {
    place: "Tenby International",
    detail: "International secondary school",
    period: "2019 – 2021",
  },
];

export const RECORD = [
  { name: "Dean's List", value: "April 2024" },
  { name: "Dean's List", value: "April 2025" },
  { name: "Dean's List", value: "September 2025" },
  { name: "AWS Cloud Practitioner Essentials", value: "Certificate" },
  { name: "Cisco Networking Academy: Packet Tracer", value: "Certificate" },
];

/* ── the stack list ───────────────────────────────────────────────────── */

export const STACK = [
  {
    tier: "Systems",
    items: [
      { name: "Rust", where: "desk-companion, five crates" },
      { name: "C#", where: "test-automation and messaging platforms" },
      { name: ".NET", where: "both production services" },
      { name: "C++", where: "systems coursework" },
      { name: "Docker", where: "containerised CI execution" },
    ],
  },
  {
    tier: "Web",
    items: [
      { name: "TypeScript", where: "file storage, neobank, messaging front end" },
      { name: "React", where: "file storage, neobank" },
      { name: "Vue", where: "file storage" },
      { name: "Next.js", where: "marketing site, this page" },
      { name: "Express", where: "file storage and neobank servers" },
      { name: "FastAPI", where: "Python services" },
      { name: "Postgres", where: "production schemas" },
    ],
  },
  {
    tier: "Mobile and device",
    items: [
      { name: "Kotlin", where: "native Android client" },
      { name: "Swift", where: "native iOS client" },
      { name: "Java", where: "backend services, coursework" },
      { name: "Slint", where: "the Pi screen, cross-compiled" },
      { name: "WebCrypto", where: "file storage key derivation" },
      { name: "Playwright", where: "browser runner lanes" },
    ],
  },
];

/* Counted from STACK, so the headline number can never drift from the list. */
export const STACK_COUNT = STACK.reduce((n, t) => n + t.items.length, 0);

/* ── resume (mirrors the standalone resume document) ─────────────────────
   **double asterisks** mark bold emphasis; the resume page renders them
   as <strong>. */

export const RESUME = {
  education: {
    school: "Taylor\u2019s University",
    where: "Subang Jaya, Malaysia",
    degree: "Bachelor of Software Engineering (Hons), Extension in Cybersecurity",
    period: "Expected Dec. 2026",
  },
  experience: {
    title: "Software Engineer Intern",
    period: "Apr. 2026 \u2013 Dec. 2026 (Expected)",
    org: "SeeSharp Solutions Sdn Bhd",
    where: "Malaysia",
    bullets: [
      "Delivered features across **seven repositories** (.NET/ABP, Next.js dashboards, native iOS Swift/Android Kotlin, Gatling suite), authoring **500+ commits**.",
      "Built multi-tenant infrastructure for a **WhatsApp Business SaaS**: per-tenant connection strings, Meta Cloud API template quality tracking, consent opt-in/opt-out, and **Stripe add-on billing** with prorated rates.",
      "Implemented sign-in, sign-out, and redirect flows for an **authentication consolidation** of three apps onto one commercial site, with JWT, auto-logout on token expiry, and cross-app redirects.",
      "Added **server-side authorization guards** to campaign and automation services after finding inactive templates were rejected only client-side, bypassable via direct API calls.",
      "Cut a recipient-resolution hot path from an **N+1 query per recipient to a single batched fetch**, and paginated an unbounded conversation endpoint that loaded entire tenant histories.",
      "Co-built an internal **desktop test-automation platform** (Electron, .NET, PostgreSQL) unifying Playwright and Gatling, with script recording, nested preconditions, and a CI layer with API-key auth and remote headless execution.",
      "Ran **load, stress, and breakpoint testing** of a high-traffic client web platform across test, staging, and production, fixing **user-ID collisions** across concurrent virtual users that silently corrupted results.",
      "Shipped an **invoice dashboard** (Next.js, TypeScript) with queue-based WhatsApp reminders, plus booking, membership, and shop features for a consumer app\u2019s native **iOS and Android** clients.",
    ],
  },
  projects: [
    {
      name: "Zero Trust Architecture Platform",
      href: "/work/zta/",
      stack: "Node.js, React, TypeScript, JWT, WebCrypto",
      period: "Oct. 2025 \u2013 Dec. 2025",
      bullets: [
        "Designed a **continuous-verification session engine** that scores every request rather than trusting a valid credential, accumulating risk from IP changes, idle time, and request-rate anomalies to maintain a live per-session trust score.",
        "Bound **token lifetime to trust level** \u2014 2 hours at full trust, degrading to 5 minutes below a 70 threshold \u2014 with automatic session revocation under 60 and **step-up authentication** triggered in the 60\u201380 band.",
        "Implemented **hybrid encryption** for file storage: AES-256-GCM authenticated encryption with per-payload IVs, wrapped by RSA-2048 OAEP key encapsulation, plus PBKDF2-SHA256 password hashing at 200,000 iterations.",
        "Defended against token tampering by pairing JWT signature validation with an independent **HMAC-SHA256 nonce** and device-ID binding, recomputed and verified on every request.",
      ],
    },
    {
      name: "Neobank Prototype",
      href: "/work/neobank/",
      stack: "Node.js, Express, WebCrypto",
      period: "Dec. 2025",
      bullets: [
        "Applied the zero-trust session and cryptography layers to a **digital banking prototype**, placing account and transaction endpoints behind the same continuous-verification model.",
        "Layered the backend (route, service, infrastructure) with centralised logging and encrypted-at-rest account records.",
      ],
    },
  ],
  skills: [
    { label: "Languages", items: "C#, TypeScript, JavaScript, Java, Swift, Kotlin, Python, SQL, HTML/CSS" },
    { label: "Frameworks", items: ".NET, ABP Framework, React, Next.js, Node.js, Electron, Express, Hangfire" },
    { label: "Security", items: "Zero Trust architecture, AES-256-GCM, RSA-OAEP, PBKDF2, HMAC, JWT, OAuth/OpenIddict, threat modelling" },
    { label: "Testing", items: "Playwright, Gatling, load, stress & breakpoint testing" },
    { label: "Tools & Databases", items: "Git, Docker, GitHub Actions, Postman, Maven, PostgreSQL, SQLite, Stripe" },
  ],
};
