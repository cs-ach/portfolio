import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = process.env.OUT ?? "/tmp/measure.json";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1512, height: 982 } });

page.on("console", (m) => {
  const t = m.text();
  if (t.includes("[dev]")) console.log("  console:", t);
});

await page.goto(BASE + "/projects/", { waitUntil: "networkidle" });
await page.waitForTimeout(4000);

// ── Decisive test of the resize pipeline ─────────────────────────────
// Continuously resize the seat's box (as the travel does) and watch
// whether the WebGL canvas follows. If the canvas is driven by a
// trailing-debounced measurement, it will NOT follow a continuous
// resize, and will snap to the final value once the resize stops.
const probe = await page.evaluate(async () => {
  const seat = document.querySelector("[data-device-layer] [data-slug]");
  const canvas = document.querySelector("[data-device-layer] canvas");
  const layer = document.querySelector(".react-3d-mockups-screen-layer");

  const log = [];
  const t0 = performance.now();
  let stop = false;
  const rec = () => {
    log.push({
      t: Math.round(performance.now() - t0),
      seatW: seat.style.width,
      canvasW: canvas.getAttribute("width"),
      layerW: layer.style.width,
    });
  };
  const loop = () => {
    rec();
    if (!stop) requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  // Resize the seat continuously for 500ms, exactly as a travel does.
  const w0 = parseFloat(seat.style.width);
  const start = performance.now();
  await new Promise((resolve) => {
    const step = () => {
      const k = Math.min(1, (performance.now() - start) / 500);
      seat.style.width = w0 + k * 44 + "px";
      if (k < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
  const resizeEnded = Math.round(performance.now() - t0);

  // Now stop resizing and wait.
  await new Promise((r) => setTimeout(r, 400));
  stop = true;
  await new Promise((r) => requestAnimationFrame(r));

  return { log, resizeEnded };
});

console.log("resize ended at t =", probe.resizeEnded, "ms");
console.log("  t     seat.style.width   canvas.width   layer.style.width");
for (const s of probe.log) {
  console.log(
    String(s.t).padStart(5),
    String(s.seatW).padStart(16),
    String(s.canvasW).padStart(14),
    String(s.layerW).padStart(18),
    s.t > probe.resizeEnded - 60 && s.t < probe.resizeEnded + 160 ? " <== resize ended" : "",
  );
}
await browser.close();

const samples = await page.evaluate(async () => {
  const out = [];
  const seat = () => document.querySelector("[data-device-layer] [data-slug]");
  const layer = () => document.querySelector(".react-3d-mockups-screen-layer");
  const canvas = () => document.querySelector("[data-device-layer] canvas");
  const fig = () => document.querySelector("[data-hero] [class*='fig']");

  const r = (el) => {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return [Math.round(b.width), Math.round(b.height), Math.round(b.left), Math.round(b.top)];
  };

  const rec = (t) => {
    const s = seat();
    const l = layer();
    const c = canvas();
    const f = fig();
    out.push({
      t: Math.round(t),
      seatRect: r(s),
      seatCss: s ? [s.style.width, s.style.height, s.style.transform] : null,
      canvasRect: r(c),
      canvasAttr: c ? [c.width, c.height] : null,
      canvasCss: c ? [c.style.width, c.style.height] : null,
      layerRect: r(l),
      layerCss: l ? [l.style.width, l.style.height] : null,
      figRect: r(f),
      path: location.pathname,
      heroNav: document.documentElement.dataset.heroNav ?? null,
      vt: document.documentElement.dataset.vt ?? null,
    });
  };

  let stop = false;
  const loop = (t) => {
    rec(t);
    if (!stop) requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  const link = document.querySelector('a[href^="/work/"]');
  link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));

  await new Promise((r) => setTimeout(r, 2500));
  stop = true;
  await new Promise((r) => requestAnimationFrame(r));
  return out;
});

await browser.close();

fs.writeFileSync(OUT, JSON.stringify(samples, null, 1));

for (const s of samples) {
  console.log(
    String(s.t).padStart(5),
    "seatCSS", JSON.stringify(s.seatCss),
    "canvasAttr", JSON.stringify(s.canvasAttr),
    "canvasCss", JSON.stringify(s.canvasCss),
    "layerCss", JSON.stringify(s.layerCss),
    "fig", JSON.stringify(s.figRect),
    s.path,
    s.vt ?? "",
    s.heroNav ?? "",
  );
}
