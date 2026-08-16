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

// Strand test (Pitfall #7): boot remote, DROP the server, bring it back on the
// same port, and prove the real browser reconnects (a new ws opens and receives
// server frames again) — i.e. the player is never stranded by a disconnect.
async function checkStrand(browser) {
  const srv = await startServer(0);
  const port = srv.port;
  const url = `http://localhost:${port}/client/index.html?mode=remote&name=Strand&car=1&diff=medium&mute=1`;
  // A refused/failed ws is EXPECTED here (the server is deliberately down for a
  // moment); only NON-connection errors count as failures.
  const STRAND_BENIGN = /websocket connection to|ERR_CONNECTION_REFUSED|ws error|failed to connect/i;
  const benign = (t) => BENIGN.test(t) || STRAND_BENIGN.test(t);
  const errors = [];
  const page = await browser.newPage();
  page.on("console", (m) => { if (m.type() === "error" && !benign(m.text())) errors.push(m.text()); });
  page.on("pageerror", (e) => { if (!benign(e.message)) errors.push(e.message); });
  let wsCount = 0, lateFrames = 0;
  page.on("websocket", (ws) => { const n = ++wsCount; ws.on("framereceived", () => { if (n >= 2) lateFrames++; }); });

  await page.goto(url, { waitUntil: "load" });
  await waitForCanvas(page);           // connected + rendering
  await srv.close();                    // the server vanishes
  await page.waitForTimeout(1500);      // client notices -> RECONNECTING + backoff

  let srv2 = null;                      // bring it back on the SAME port
  for (let i = 0; i < 20 && !srv2; i++) {
    try { srv2 = await startServer(port); } catch (e) { if (e.code !== "EADDRINUSE") throw e; await page.waitForTimeout(200); }
  }
  const deadline = Date.now() + 15000;  // wait for a reconnected socket to get frames
  while (Date.now() < deadline && lateFrames < 3) await page.waitForTimeout(250);
  await page.close();
  if (srv2) await srv2.close();

  const fails = [];
  if (wsCount < 2) fails.push("strand: no reconnect socket opened after the drop");
  if (lateFrames < 3) fails.push("strand: reconnected socket received no frames (player stranded)");
  if (errors.length) fails.push(`strand: console errors -> ${errors.slice(0, 3).join(" | ")}`);
  if (fails.length) { for (const f of fails) console.log("  FAIL", f); return false; }
  console.log(`  ok  strand: dropped + reconnected (${wsCount} sockets, frames resumed)`);
  return true;
}

const h = await startServer(0);
const root = `http://localhost:${h.port}`;
const base = `${root}/client/index.html`;
const browser = await chromium.launch({ headless: true });
let ok = true;
try {
  // The REAL entry point players hit is "/" (server maps it to client/index.html).
  // A relative script src there 404s (/main.js) — this catches that regression.
  ok = await checkPage(browser, `${root}/?car=1&diff=medium&mute=1`, "root '/' boot") && ok;
  ok = await checkPage(browser, `${base}?car=1&diff=medium&mute=1`, "local boot") && ok;
  ok = await checkPage(browser, `${base}?mode=remote&name=Smoke&car=1&diff=medium&mute=1`, "remote connect") && ok;
  ok = await checkStrand(browser) && ok;
} finally {
  await browser.close();
  await h.close();
}

if (ok) console.log("BROWSER SMOKE OK");
else console.log("BROWSER SMOKE FAIL");
process.exit(ok ? 0 : 1);
