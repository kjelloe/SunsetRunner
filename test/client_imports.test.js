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
  const carSelect = await import("../client/car_select.js");
  const audio = await import("../client/audio.js");
  const scenery = await import("../client/scenery.js");
  const carColors = await import("../client/car_colors.js");
  const tuning = await import("../client/tuning.js");
  const countdown = await import("../client/countdown.js");
  const forkPreview = await import("../client/fork_preview.js");
  const cpBanner = await import("../client/checkpoint_banner.js");
  const splash = await import("../client/splash.js");
  const announce = await import("../client/stage_announce.js");
  const nameEntry = await import("../client/name_entry.js");
  const spectate = await import("../client/spectate.js");
  const playerIdMod = await import("../client/player_id.js");
  const localScores = await import("../client/local_scores.js");
  const lobby = await import("../client/lobby.js");
  const difficulty = await import("../client/difficulty_select.js");
  const raceSummary = await import("../client/race_summary.js");
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
  assert.equal(typeof carSelect.createCarSelect, "function");
  assert.equal(typeof carSelect.drawCarSelect, "function");
  assert.equal(typeof audio.createAudio, "function");
  assert.equal(typeof scenery.themeFor, "function");
  assert.equal(typeof scenery.loadScenery, "function");
  assert.equal(typeof carColors.carColor, "function");
  assert.equal(typeof tuning.readTuning, "function");
  assert.equal(typeof tuning.applyTuning, "function");
  assert.equal(typeof countdown.createCountdown, "function");
  assert.equal(typeof forkPreview.forkAhead, "function");
  assert.equal(typeof cpBanner.checkpointAhead, "function");
  assert.equal(typeof splash.drawSplash, "function");
  assert.equal(typeof announce.createAnnouncer, "function");
  assert.equal(typeof nameEntry.createNameEntry, "function");
  assert.equal(typeof spectate.drawSpectateOverlay, "function");
  assert.equal(typeof playerIdMod.playerId, "function");
  assert.equal(typeof localScores.recordScore, "function");
  assert.equal(typeof lobby.drawLobby, "function");
  assert.equal(typeof difficulty.createDifficultySelect, "function");
  assert.equal(typeof raceSummary.buildSummary, "function");
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
