import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";

/* Install lifecycle probes before any page script runs. */
const init = () => {
  window.__diag = {
    gl: 0,
    canvases: new WeakSet(),
    ids: new WeakMap(),
    nextId: 1,
    marks: [],
    log: (what, extra = "") => window.__diag.marks.push(`${what} ${extra}`.trim()),
  };

  const idOf = (el) => {
    if (!el) return null;
    let id = window.__diag.ids.get(el);
    if (!id) {
      id = window.__diag.nextId++;
      window.__diag.ids.set(el, id);
    }
    return id;
  };
  window.__diag.idOf = idOf;

  /* Count real WebGL context creations. */
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    const ctx = orig.call(this, type, ...rest);
    if (ctx && (type === "webgl" || type === "webgl2" || type === "experimental-webgl")) {
      window.__diag.gl += 1;
      window.__diag.log(`GL_CONTEXT_CREATED #${window.__diag.gl} canvas=${idOf(this)} type=${type}`);
    }
    return ctx;
  };

  /* Watch the canvas / screen-layer / seat elements for identity changes. */
  const describe = (el) => {
    if (!el) return null;
    const tag = el.tagName.toLowerCase();
    const cls = (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className) || "";
    return `${tag}.${String(cls).split(" ").filter(Boolean).slice(0, 2).join(".")}`;
  };

  const seen = new Map();
  const scan = () => {
    const layer = document.querySelector("[data-device-layer]");
    window.__diag.layerId = idOf(layer);
    const seats = [...document.querySelectorAll("[data-device-layer] [data-slug]")];
    const canvases = [...document.querySelectorAll("[data-device-layer] canvas")];
    const screens = [...document.querySelectorAll(".react-3d-mockups-screen-layer")];
    window.__diag.seats = seats.map((s) => `${s.dataset.slug}:${idOf(s)}`);
    window.__diag.canvases = canvases.map((c) => `${idOf(c)}@${c.width}x${c.height}`);
    window.__diag.screens = screens.map((s) => idOf(s));
  };

  const obs = new MutationObserver(() => {
    scan();
    for (const [key, el] of seen) {
      if (!el.isConnected) {
        window.__diag.log(`DETACHED ${key} #${idOf(el)}`);
        seen.delete(key);
      }
    }
    document.querySelectorAll("[data-device-layer] canvas").forEach((c) => {
      const k = `canvas${idOf(c)}`;
      if (!seen.has(k)) seen.set(k, c);
    });
  });
  window.__diag.scan = scan;
  document.addEventListener("DOMContentLoaded", () => {
    scan();
    obs.observe(document.documentElement, { childList: true, subtree: true });
  });
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(init);

page.on("console", (m) => {
  const t = m.text();
  if (t.startsWith("[diag]")) console.log("  ", t);
});
page.on("pageerror", (e) => console.log("  PAGEERROR", e.message));

const report = async (label) => {
  const d = await page.evaluate(() => ({
    path: location.pathname,
    gl: window.__diag.gl,
    layerId: window.__diag.layerId,
    seats: window.__diag.seats,
    canvases: window.__diag.canvases,
    screens: window.__diag.screens,
    domCanvases: document.querySelectorAll("canvas").length,
    marks: window.__diag.marks,
  }));
  console.log(`\n=== ${label} :: ${d.path}`);
  console.log(`    glContexts=${d.gl} layerId=${d.layerId} seats=[${d.seats}] canvases=[${d.canvases}] screens=[${d.screens}] domCanvasCount=${d.domCanvases}`);
  return d;
};

const clickAndWait = async (selector, ms = 2600) => {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) throw new Error("no element " + sel);
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
  }, selector);
  await page.waitForTimeout(ms);
};

await page.goto(BASE + "/projects/", { waitUntil: "networkidle" });
await page.waitForTimeout(5000);
const a = await report("projects (initial)");

await clickAndWait('a[href^="/work/neobank"]');
const b = await report("after -> /work/neobank");

await clickAndWait('a[href="/projects/"]', 2600);
const c = await report("after -> /projects (back via link)");

console.log("\n--- marks ---");
for (const m of a.marks.concat(b.marks.slice(a.marks.length), c.marks.slice(b.marks.length))) console.log("   ", m);

await browser.close();
