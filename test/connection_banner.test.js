import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import WebSocket from "ws";
import { bannerText, drawConnectionBanner, showRejoinButton, rejoinButtonRect, rejoinButtonHit } from "../client/connection_banner.js";
import { createRemoteSession } from "../client/session_remote.js";
import { startServer } from "../server/index.js";
import { loadCourseSet } from "../shared/road_data.js";
import { loadCarSet } from "../shared/car_data.js";

test("bannerText maps statuses; live/idle show nothing", () => {
  assert.equal(bannerText("connecting"), "CONNECTING…");
  assert.equal(bannerText("reconnecting"), "RECONNECTING…");
  assert.match(bannerText("run_ended"), /RUN ENDED/);
  assert.equal(bannerText("live"), null);
  assert.equal(bannerText("idle"), null);
});

test("drawConnectionBanner draws when there's a status, no-ops when live", () => {
  const calls = [];
  const g = new Proxy({}, {
    get: (_, k) => (["fillStyle", "font", "textAlign", "textBaseline", "globalAlpha"].includes(k) ? "" : (...a) => calls.push(k)),
    set: () => true,
  });
  drawConnectionBanner(g, { w: 960, h: 540 }, "live");
  assert.equal(calls.length, 0);
  drawConnectionBanner(g, { w: 960, h: 540 }, "reconnecting", 3);
  assert.ok(calls.includes("fillText"));
});

test("rejoin button shows only while reconnecting / run-ended, and hit-tests its rect", () => {
  assert.equal(showRejoinButton("reconnecting"), true);
  assert.equal(showRejoinButton("run_ended"), true);
  assert.equal(showRejoinButton("live"), false);
  assert.equal(showRejoinButton("connecting"), false); // first connect isn't a rejoin
  const view = { w: 1280, h: 720 };
  const r = rejoinButtonRect(view);
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  assert.equal(rejoinButtonHit(view, "reconnecting", cx, cy), true);
  assert.equal(rejoinButtonHit(view, "reconnecting", 0, 0), false); // outside the rect
  assert.equal(rejoinButtonHit(view, "live", cx, cy), false); // not shown -> no hit
});

test("reconnectNow re-lives after a server drop (never stranded)", async () => {
  const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
  const h = await startServer(0);
  const port = h.port;
  const session = createRemoteSession(`ws://localhost:${port}`, {
    WebSocket,
    courseSet: loadCourseSet(read("../data/roads.json")),
    carSet: loadCarSet(read("../data/cars.json")),
    startTimeTicks: 1500,
  });
  try {
    session.connect();
    await waitFor(() => session.status === "live", 3000);
    await h.close(); // drop the server
    await waitFor(() => session.status === "reconnecting", 3000);
    // Bring it back on the SAME port; a manual rejoin skips the backoff wait.
    let h2 = null;
    for (let i = 0; i < 20 && !h2; i++) {
      try { h2 = await startServer(port); } catch (e) { if (e.code !== "EADDRINUSE") throw e; await sleep(150); }
    }
    session.reconnectNow();
    await waitFor(() => session.status === "live", 4000);
    assert.equal(session.status, "live"); // reconnected + re-joined, not stranded
    await h2.close();
  } finally {
    session.close();
  }
});

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

test("remote session status goes connecting -> live on join", async () => {
  const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
  const h = await startServer(0);
  const seen = [];
  const session = createRemoteSession(`ws://localhost:${h.port}`, {
    WebSocket,
    courseSet: loadCourseSet(read("../data/roads.json")),
    carSet: loadCarSet(read("../data/cars.json")),
    startTimeTicks: 1500,
    onStatus: (s) => seen.push(s),
  });
  try {
    assert.equal(session.status, "idle");
    session.connect();
    await waitFor(() => session.status === "live", 3000);
    assert.deepEqual(seen, ["connecting", "live"]);
  } finally {
    session.close();
    await h.close();
  }
});

function waitFor(cond, timeoutMs) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const iv = setInterval(() => {
      if (cond()) { clearInterval(iv); resolve(); }
      else if (Date.now() > deadline) { clearInterval(iv); reject(new Error("timed out")); }
    }, 20);
    iv.unref?.();
  });
}
