import { PROJECTS } from "@/lib/content";

/* The lab's experiments, described once.

   The /lab/ page, its sticky index and the teaser band on the home page all
   need the same four facts about each experiment (its number, its name, the
   project it comes from and what it does), so they are written here and
   read from here. Copy that lives in three components drifts apart: the
   teaser says one thing, the bench says another.

   The `real` and `simulated` lists are the part that matters. A demo that
   only says what it does invites a visitor to assume the rest, so each bench
   states plainly what is genuinely implemented and what is a stand-in. */

export interface Experiment {
  /* anchor id, also what the teaser links to */
  id: string;
  /* "01" */
  n: string;
  name: string;
  /* the project it comes from; the project's own name and page are read
     from PROJECTS so a rename there follows through */
  slug: string;
  project: string;
  /* one line, for the index and the teaser */
  line: string;
  /* what the bench is "about" in the spec row */
  format: string;
  shows: string;
  tryIt: string;
  real: string[];
  simulated: string[];
}

function projectName(slug: string): string {
  return PROJECTS.find((p) => p.slug === slug)?.name ?? slug;
}

export const EXPERIMENTS: Experiment[] = [
  {
    id: "exp-01",
    n: "01",
    name: "The desk screen",
    slug: "desk-companion",
    project: projectName("desk-companion"),
    line: "The Raspberry Pi's 800 by 480 interface, with a ticking clock.",
    format: "800 × 480, scaled to fit",
    shows:
      "The interface the Rust application draws on the Pi's panel: a dock of plugins down the left, a status bar along the top, and a grid of widgets that becomes a full page when you open one.",
    tryIt:
      "Press the dock slots to switch plugins, open the switcher and settings, then press play on the Spotify page.",
    real: [
      "Geometry, radii, type sizes and colours taken from the Slint sources",
      "Icon outlines redrawn from the same path commands the device uses",
      "Page routing between home, each plugin, the switcher and settings",
      "A clock and date read from your own device",
      "A host readout that prints your actual pointer and window size",
    ],
    simulated: [
      "There is no Pi, no Slint renderer and no framebuffer: this is an HTML rebuild",
      "Track, progress and the Beacon counter are fixtures, not plugin output",
      "No plugin code runs, and nothing is fetched from any service",
    ],
  },
  {
    id: "exp-02",
    n: "02",
    name: "The serial link",
    slug: "desk-companion",
    project: projectName("desk-companion"),
    line: "Watch the host and the Pi negotiate, talk, and recover from a pulled cable.",
    format: "Two ends of one wire",
    shows:
      "How the host and the device stay in step. They open with a version and baud handshake, then every change travels as a length-prefixed, checksummed frame, and the device repaints only once a frame has arrived intact.",
    tryIt:
      "Toggle a module on the host, flip a bit to corrupt the next frame, or pull the cable and watch the link come back.",
    real: [
      "Message names and fields lifted from the protocol crate",
      "Frames encoded byte for byte: length, type, sequence, payload, CRC-8",
      "Version and baud negotiation before any traffic, refused on a mismatch",
      "A corrupted frame fails its CRC, is NAKed and resent",
      "The device state is a pure reduction of the frames it has received",
    ],
    simulated: [
      "The wire is an in-memory queue; there is no serial port in a browser",
      "Travel is slowed to 700ms so a frame can be watched crossing",
      "The host is a handful of controls, not the Rust host process",
    ],
  },
  {
    id: "exp-03",
    n: "03",
    name: "Deriving the key",
    slug: "zta",
    project: projectName("zta"),
    line: "Type a passphrase and watch what the server never receives.",
    format: "Four panels, one passphrase",
    shows:
      "How the file store decides what a request may do. Keys are derived from a passphrase in the browser, and a trust score is compared with a threshold that each action sets for itself.",
    tryIt:
      "Type a passphrase, run a low-risk action, then a high-risk one, then pass the challenge and run it again.",
    real: [
      "The structure of the system: key material built client-side, a server that holds ciphertext and public keys only",
      "Per-action thresholds, step-up that is refused rather than queued, and an action no score unlocks",
      "Everything stays in this tab: no storage, no requests",
    ],
    simulated: [
      "No cryptography runs: there is no PBKDF2, no RSA and no WebCrypto call",
      "Nothing on screen is a secret, and the masked keys are decoration",
      "The server and its log are modelled in the page, not a running service",
    ],
  },
  {
    id: "exp-04",
    n: "04",
    name: "Requesting money",
    slug: "neobank",
    project: projectName("neobank"),
    line: "Settle or decline a payment request from the recipient's side.",
    format: "Phone, recipient's view",
    shows:
      "The request flow from the banking app. A request is a claim made by one person and decided by another, so the irreversible step belongs to whoever holds the money.",
    tryIt: "Decline the request, reset it, then settle it.",
    real: [
      "The state model: pending, settled and declined are the only outcomes",
      "Settling and declining are the recipient's actions, never the sender's",
    ],
    simulated: [
      "No money, account or ledger exists behind it",
      "The names and amount are placeholders, and nothing is signed",
    ],
  },
];
