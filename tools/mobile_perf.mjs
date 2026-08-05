// tools/mobile_perf.mjs — headless mobile render-perf profile.
// Boots the real client in a phone-sized, retina (DPR 3) viewport against the
// actual server, drives it into the heaviest course (grand_tour, ?course=4),
// and measures PER-FRAME main-thread cost under a range of CPU throttles that
// stand in for low/mid-end phones (Chromium CDP Emulation.setCPUThrottlingRate).
//
// The metric is the interval between successive requestAnimationFrame callbacks.
// The browser is launched with the frame-rate limiter OFF, so rAF fires as fast
// as the main thread allows — the delta is then a real measure of the work in
// one frame (client predict + canvas render), not a vsync-capped 16.7 ms.
//
// Standalone (not a node --test file); run via `npm run perf:mobile`. Skips
// cleanly if Playwright / its browser is not installed. Writes nothing — it
// prints a table; the committed numbers live in PERFORMANCE.md.

import { startServer } from "../server/index.js";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.log("playwright not installed — skipping mobile perf profile");
  process.exit(0);
}

// Phone-class viewport + retina scale (fill cost scales with the backing store).
const VIEWPORT = { width: 390, height: 844 }; // iPhone 12/13/14 logical size
const DPR = 3;
const THROTTLES = [1, 4, 6]; // 1 = desktop; 4 ≈ mid phone; 6 ≈ low-end phone
const WARMUP_MS = 5000;      // pass splash + countdown so we sample the RACE
const SAMPLE_MS = 5000;

function pct(sorted, p) {
  if (!sorted.length) return NaN;
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[i];
}

async function sampleFrames(page) {
  await page.evaluate((ms) => new Promise((resolve) => {
    const deltas = [];
    let last = performance.now();
    const t0 = last;
    function tick(now) {
      deltas.push(now - last);
      last = now;
      if (now - t0 >= ms) { window.__deltas = deltas; resolve(); return; }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }), SAMPLE_MS);
  return page.evaluate(() => window.__deltas);
}

async function profileAt(browser, url, rate) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: DPR });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate });
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(WARMUP_MS);
  const deltas = (await sampleFrames(page)).filter((d) => d > 0).sort((a, b) => a - b);
  await context.close();

  const median = pct(deltas, 50);
  return {
    rate,
    frames: deltas.length,
    p50: median,
    p95: pct(deltas, 95),
    p99: pct(deltas, 99),
    fps: median ? 1000 / median : 0,
    // A frame that misses a 60 Hz (16.7 ms) budget would drop under vsync.
    over60: deltas.filter((d) => d > 16.7).length / (deltas.length || 1),
    over33: deltas.filter((d) => d > 33.3).length / (deltas.length || 1),
  };
}

const h = await startServer(0);
const url = `http://localhost:${h.port}/client/index.html?course=4&car=1&diff=medium&mute=1`;
const browser = await chromium.launch({
  headless: true,
  args: ["--disable-frame-rate-limit", "--disable-gpu-vsync", "--disable-gpu"],
});

console.log(`Mobile render perf — ${VIEWPORT.width}x${VIEWPORT.height} @ DPR ${DPR}, grand_tour (course 4)`);
console.log("cpu    frames   p50ms   p95ms   p99ms   ~fps   >16.7ms  >33.3ms");
try {
  for (const rate of THROTTLES) {
    const r = await profileAt(browser, url, rate);
    const f = (n, d = 1) => n.toFixed(d).padStart(6);
    const label = rate === 1 ? "1x   " : `${rate}x   `;
    console.log(
      `${label}  ${String(r.frames).padStart(6)}  ${f(r.p50)}  ${f(r.p95)}  ${f(r.p99)}  ${f(r.fps)}  ` +
      `${(r.over60 * 100).toFixed(0).padStart(6)}%  ${(r.over33 * 100).toFixed(0).padStart(6)}%`,
    );
  }
} finally {
  await browser.close();
  await h.close();
}
console.log("MOBILE PERF DONE");
