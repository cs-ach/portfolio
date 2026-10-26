/* Does the phone's start-up sequence play on a phone-shaped browser?
   Loads / against a built site (BASE, default :4311) in an emulated
   iPhone and logs a timeline: when the loading flag, the backdrop and
   the canvas appear and go, which budget timer fired, and whether the
   sequence reached its framed/zoom beats or was dropped.

     ENGINE=chromium|webkit  CPU=4  NET=slow|fast  DEVICE='iPhone 14'
     BASE=http://localhost:4311 node tools/phone-load.mjs */
import { chromium, webkit, devices } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:4311";
const ENGINE = process.env.ENGINE ?? "chromium";
const CPU = Number(process.env.CPU ?? 1);
const NET = process.env.NET ?? "fast";
const DEVICE = process.env.DEVICE ?? "iPhone 14";
const desktop = process.env.DESKTOP === "1";

const init = () => {
  const t0 = performance.now();
  window.__tl = [];
  const mark = (s) => window.__tl.push(`${Math.round(performance.now() - t0)}ms ${s}`);
  const st = window.setTimeout.bind(window);
  window.setTimeout = (fn, ms, ...a) => {
    if (ms >= 1000 && ms <= 15000) {
      mark(`timer ${ms} set`);
      return st(() => { mark(`timer ${ms} fired`); return fn(...a); }, ms);
    }
    return st(fn, ms, ...a);
  };
  let last = "";
  let frames = 0;
  setInterval(() => { mark(`raf frames in last 500ms: ${frames}`); frames = 0; }, 500);
  const poll = () => {
    frames += 1;
    const r = document.documentElement;
    const s = `loading=${r.dataset.loading ?? "-"} boot=${r.dataset.boot ?? "-"} canvas=${document.querySelectorAll("canvas").length} scene=${!!document.querySelector('[class*="scene"]')} backdrop=${!!document.querySelector('[class*="backdrop"]')}`;
    if (s !== last) { last = s; mark(s); }
    requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);
};

const type = ENGINE === "webkit" ? webkit : chromium;
const browser = await type.launch(ENGINE === "webkit" ? {} : { channel: process.env.CHANNEL ?? "chromium" });
const ctx = await browser.newContext(
  desktop ? { viewport: { width: 1440, height: 900 } } : { ...devices[DEVICE] },
);
await ctx.addInitScript(init);
const page = await ctx.newPage();
/* CHUNKS=1: list every script the load fetches, with its size, so a phone
   can be checked for never having asked for the three.js loader chunk. */
const scripts = [];
if (process.env.CHUNKS === "1")
  page.on("response", async (r) => {
    if (r.request().resourceType() !== "script") return;
    const b = await r.body().catch(() => null);
    scripts.push(`${b ? Math.round(b.length / 1024) : "?"}kB ${r.url().split("/").slice(-1)[0]}`);
  });
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
page.on("console", (m) => { if (m.text().startsWith("[dbg]")) console.log(m.text()); else if (["error"].includes(m.type())) console.log("CONSOLE", m.type(), m.text().slice(0, 200)); });

if (ENGINE === "chromium") {
  const cdp = await ctx.newCDPSession(page);
  if (CPU > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });
  if (NET === "slow")
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
}

await page.goto(BASE + "/", { waitUntil: "commit" });
const shots = (process.env.SHOTS ?? "").split(",").filter(Boolean).map(Number);
let waited = 0;
for (const at of shots) {
  await page.waitForTimeout(at - waited);
  waited = at;
  await page.screenshot({ path: `${process.env.SHOTDIR ?? "."}/${ENGINE}-${desktop ? "desktop" : "phone"}-${at}.png` });
}
await page.waitForTimeout(Math.max(0, Number(process.env.WAIT ?? 9000) - waited));
const tl = await page.evaluate(() => window.__tl);
console.log(`${ENGINE} ${desktop ? "desktop" : DEVICE} cpu=${CPU} net=${NET}`);
console.log(tl.join("\n"));
if (scripts.length) console.log("scripts:\n" + scripts.join("\n"));
await browser.close();
