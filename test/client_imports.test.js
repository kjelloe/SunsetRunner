import { test } from "node:test";
import assert from "node:assert/strict";

// Headless import gate: every client module must load in node without touching
// the DOM at import time (boot is guarded). Catches syntax/import breakage that
// the (deferred) Playwright smoke would otherwise be the first to see.
test("client modules import cleanly and export their entry points", async () => {
  const projection = await import("../client/projection.js");
  const roadRenderer = await import("../client/road_renderer.js");
  const rendererCanvas = await import("../client/renderer_canvas.js");
  const hud = await import("../client/hud.js");
  const input = await import("../client/input.js");
  const session = await import("../client/session_local.js");
  const remote = await import("../client/session_remote.js");
  const touch = await import("../client/touch_controls.js");
  const prediction = await import("../client/prediction.js");
  const celebration = await import("../client/celebration.js");
  const viewport = await import("../client/viewport.js");
  const wakelock = await import("../client/wakelock.js");
  const banner = await import("../client/connection_banner.js");
  const main = await import("../client/main.js");

  assert.equal(typeof projection.projectPoint, "function");
  assert.equal(typeof roadRenderer.forwardStrips, "function");
  assert.equal(typeof roadRenderer.drawRoad, "function");
  assert.equal(typeof rendererCanvas.render, "function");
  assert.equal(typeof hud.drawHud, "function");
  assert.equal(typeof hud.displaySpeed, "function");
  assert.equal(typeof input.readInput, "function");
  assert.equal(typeof session.createLocalSession, "function");
  assert.equal(typeof remote.createRemoteSession, "function");
  assert.equal(typeof touch.readTouchInput, "function");
  assert.equal(typeof touch.installTouch, "function");
  assert.equal(typeof prediction.createPredictor, "function");
  assert.equal(typeof celebration.createCelebration, "function");
  assert.equal(typeof viewport.computeBufferSize, "function");
  assert.equal(typeof wakelock.installWakeLock, "function");
  assert.equal(typeof banner.drawConnectionBanner, "function");
  assert.equal(typeof main.boot, "function");
});

test("readInput reduces to integer controls without a DOM", async () => {
  const { readInput } = await import("../client/input.js");
  const i = readInput(); // no keys held
  assert.deepEqual(i, { steer: 0, accel: 0, brake: 0 });
});

test("a local session advances the sim deterministically", async () => {
  const { readFileSync } = await import("node:fs");
  const { loadCourseSet } = await import("../shared/road_data.js");
  const { loadCarSet } = await import("../shared/car_data.js");
  const { createLocalSession } = await import("../client/session_local.js");
  const courseSet = loadCourseSet(JSON.parse(readFileSync(new URL("../data/roads.json", import.meta.url))));
  const carSet = loadCarSet(JSON.parse(readFileSync(new URL("../data/cars.json", import.meta.url))));
  const s = createLocalSession(courseSet, carSet, { seed: 12345 });
  s.setInput({ steer: 0, accel: 1, brake: 0 });
  s.tick();
  assert.equal(s.getState().tick, 1);
  assert.ok(s.getState().seats[0].speed > 0);
});
