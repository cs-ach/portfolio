import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
const SCENARIO = process.argv[2] ?? "hero";
const WIDTH = Number(process.env.W ?? 1440);
const HEIGHT = Number(process.env.H ?? 900);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));

const start = async (url) => {
  await page.goto(BASE + url, { waitUntil: "networkidle" });
  await page.waitForTimeout(4500);
};

const click = (sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) throw new Error("missing " + s);
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
  }, sel);

/* Sample the seat geometry and the canvas every frame. */
const sampler = async (label, action, ms) => {
  await page.evaluate(() => {
    window.__s = [];
    window.__stop = false;
    const loop = () => {
      const seats = [...document.querySelectorAll("[data-device-layer] [data-slug]")];
      window.__s.push({
        t: Math.round(performance.now()),
        path: location.pathname,
        vt: document.documentElement.dataset.vt ?? null,
        heroNav: document.documentElement.dataset.heroNav ?? null,
        seats: seats.map((s) => {
          const r = s.getBoundingClientRect();
          const c = s.querySelector("canvas");
          return {
            slug: s.dataset.slug,
            on: s.hasAttribute("data-on"),
            ready: s.hasAttribute("data-ready"),
            x: Math.round(r.left * 10) / 10,
            y: Math.round(r.top * 10) / 10,
            w: Math.round(r.width * 10) / 10,
            h: Math.round(r.height * 10) / 10,
            cw: c ? c.width : null,
            ch: c ? c.height : null,
          };
        }),
      });
      if (!window.__stop) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });

  if (action) await action();
  await page.waitForTimeout(ms);
  const out = await page.evaluate(() => {
    window.__stop = true;
    return window.__s;
  });
  console.log(`\n===== ${label} =====`);
  let prev = null;
  for (const s of out) {
    const key = JSON.stringify(s.seats);
    if (key === prev) continue;
    prev = key;
    console.log(
      String(s.t).padStart(6),
      (s.vt ?? "-").padEnd(6),
      (s.heroNav !== null ? "HERO" : "    "),
      s.path.padEnd(22),
      s.seats
        .map(
          (x) =>
            `${x.slug}[on=${x.on ? 1 : 0} rdy=${x.ready ? 1 : 0} ${x.x},${x.y} ${x.w}x${x.h} cv=${x.cw}x${x.ch}]`,
        )
        .join(" "),
    );
  }
  return out;
};

if (SCENARIO === "hero") {
  await start("/projects/");
  await sampler("projects -> work/neobank (hero nav)", () => click('a[href^="/work/neobank"]'), 3200);
} else if (SCENARIO === "heroBack") {
  await start("/projects/");
  await click('a[href^="/work/neobank"]');
  await page.waitForTimeout(3200);
  await sampler("work/neobank -> projects (back link)", () => click('a[href="/projects/"]'), 3200);
} else if (SCENARIO === "plain") {
  await start("/projects/");
  await sampler("projects -> /lab (plain nav)", () => click('a[href="/lab/"]'), 2600);
} else if (SCENARIO === "rapid") {
  await start("/projects/");
  await sampler("rapid nav", async () => {
    await click('a[href^="/work/neobank"]');
    await page.waitForTimeout(120);
    await page.evaluate(() => history.back());
    await page.waitForTimeout(120);
    await page.evaluate(() => history.forward());
  }, 3500);
} else if (SCENARIO === "popstate") {
  await start("/projects/");
  await click('a[href^="/work/neobank"]');
  await page.waitForTimeout(3200);
  await sampler("browser back (popstate)", () => page.evaluate(() => history.back()), 2600);
} else if (SCENARIO === "direct") {
  await start("/work/neobank/");
  await sampler("direct load of /work/neobank", null, 1200);
}

await browser.close();
