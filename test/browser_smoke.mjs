// test/browser_smoke.mjs — real-browser smoke (Pitfall #7 / PLAYTEST §0).
// Boots the client in headless Chromium against the actual server and asserts:
//   1. no console errors / page exceptions on boot,
//   2. the game canvas actually renders (more than a flat colour),
//   3. the same holds for ?mode=remote (the ws connect path — no strand on join).
// Standalone (NOT a node --test file) so the fast suite stays browser-free; run
// via `npm run test:browser` or the optional gate in test.sh. Skips cleanly if
// Playwright / its browser isn't installed.

import { startServer } from "../server/index.js";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.log("playwright not installed — skipping browser smoke");
  process.exit(0);
}

// Console noise that isn't a real failure.
const BENIGN = /favicon|AudioContext|autoplay|was not allowed to start/i;

function canvasHasContent() {
  const c = document.getElementById("game");
  if (!c || !c.width) return { ok: false, reason: "no canvas" };
  const ctx = c.getContext("2d");
  const w = Math.min(c.width, 240);
  const h = Math.min(c.height, 240);
  const d = ctx.getImageData(0, 0, w, h).data;
  const seen = new Set();
  for (let i = 0; i < d.length; i += 4 * 41) seen.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
  return { ok: seen.size > 3, colors: seen.size };
}

async function waitForCanvas(page, ms = 9000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const r = await page.evaluate(canvasHasContent);
    if (r.ok) return r;
    await page.waitForTimeout(200);
  }
  return page.evaluate(canvasHasContent);
}

async function checkPage(browser, url, label) {
  const errors = [];
  const page = await browser.newPage();
  page.on("console", (m) => { if (m.type() === "error" && !BENIGN.test(m.text())) errors.push(m.text()); });
  page.on("pageerror", (e) => { if (!BENIGN.test(e.message)) errors.push(e.message); });

  await page.goto(url, { waitUntil: "load" });
  const canvas = await waitForCanvas(page);
  await page.close();

  const fails = [];
  if (!canvas.ok) fails.push(`${label}: canvas did not render (${canvas.reason || canvas.colors + " colours"})`);
  if (errors.length) fails.push(`${label}: console errors -> ${errors.slice(0, 3).join(" | ")}`);
  if (fails.length) { for (const f of fails) console.log("  FAIL", f); return false; }
  console.log(`  ok  ${label}: canvas rendered (${canvas.colors} colours), no console errors`);
  return true;
}

const h = await startServer(0);
const base = `http://localhost:${h.port}/client/index.html`;
const browser = await chromium.launch({ headless: true });
let ok = true;
try {
  ok = await checkPage(browser, `${base}?car=1&diff=medium&mute=1`, "local boot") && ok;
  ok = await checkPage(browser, `${base}?mode=remote&name=Smoke&car=1&diff=medium&mute=1`, "remote connect") && ok;
} finally {
  await browser.close();
  await h.close();
}

if (ok) console.log("BROWSER SMOKE OK");
else console.log("BROWSER SMOKE FAIL");
process.exit(ok ? 0 : 1);
