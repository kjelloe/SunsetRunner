// client/main.js — boot + fixed-step loop (CLIENT ONLY).
// 20 Hz authoritative sim (accumulator), render every animation frame.
// Import-safe: boot() only runs under a real DOM.

import { loadCourseSet } from "../shared/road_data.js";
import { loadCarSet } from "../shared/car_data.js";
import { loadCheckpointConfig } from "../shared/checkpoint_data.js";
import { loadTrafficConfig } from "../shared/traffic_data.js";
import { TICK_HZ } from "../shared/constants.js";
import { createLocalSession } from "./session_local.js";
import { createRemoteSession } from "./session_remote.js";
import { installKeyboard, readInput, readForkChoice, readMenuNav } from "./input.js";
import { installTouch, readTouchInput, readTouchFork, drawTouchControls, touchDetected } from "./touch_controls.js";
import { render } from "./renderer_canvas.js";
import { createCelebration } from "./celebration.js";
import { computeBufferSize } from "./viewport.js";
import { installWakeLock } from "./wakelock.js";
import { drawConnectionBanner } from "./connection_banner.js";
import { carChoiceFromParams, createCarSelect, drawCarSelect, carSelectTouchZone } from "./car_select.js";
import { createAudio } from "./audio.js";
import { loadScenery } from "./scenery.js";

const SIM_DT = 1000 / TICK_HZ;

export async function boot(doc = document) {
  const canvas = doc.getElementById("game");
  const g = canvas.getContext("2d");
  const view = { w: canvas.width, h: canvas.height };

  // Crisp on retina/mobile: match the drawing buffer to the displayed size × DPR.
  function fit() {
    const rect = canvas.getBoundingClientRect?.() || { width: canvas.width, height: canvas.height };
    const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
    const { w, h } = computeBufferSize(rect.width, rect.height, dpr);
    canvas.width = w;
    canvas.height = h;
    view.w = w;
    view.h = h;
  }
  fit();
  if (typeof window !== "undefined") {
    window.addEventListener("resize", fit);
    window.addEventListener("orientationchange", fit);
  }
  installWakeLock(); // keep the phone awake while driving

  const [roads, cars, checkpoints, traffic, assets, sceneryJson] = await Promise.all([
    fetch("../data/roads.json").then((r) => r.json()),
    fetch("../data/cars.json").then((r) => r.json()),
    fetch("../data/checkpoints.json").then((r) => r.json()),
    fetch("../data/traffic.json").then((r) => r.json()),
    fetch("../data/assets.json").then((r) => r.json()),
    fetch("../data/scenery.json").then((r) => r.json()).catch(() => null),
  ]);
  const courseSet = loadCourseSet(roads);
  const carSet = loadCarSet(cars);
  const { startTimeTicks } = loadCheckpointConfig(checkpoints);
  const trafficConfig = loadTrafficConfig(traffic);
  const scenery = loadScenery(sceneryJson);

  // ?mode=remote joins the ws server room; default is an offline local race.
  // ?course=N selects the course for a local race (default 1).
  // ?car=N picks a car and skips the select overlay (else the overlay shows).
  const params = new URLSearchParams(location.search);
  const remote = params.get("mode") === "remote";
  const courseId = Number(params.get("course")) || 1;

  installKeyboard(doc);
  installTouch(canvas);
  const showTouch = touchDetected() || params.get("touch") === "1";
  const celebration = createCelebration();

  // Procedural audio: engine hum + SFX + chiptune. Browsers block autoplay, so
  // it only spins up on the first user gesture. ?mute=1 disables it.
  const audio = createAudio({ enabled: params.get("mute") !== "1" });
  let audioArmed = false;
  const armAudio = () => { if (!audioArmed) { audioArmed = true; audio.resume(); } };
  doc.addEventListener?.("keydown", armAudio);
  canvas.addEventListener?.("pointerdown", armAudio);

  // Two phases: "select" shows the car picker; "race" runs the session. The
  // session is not created until a car is chosen, so JOIN carries the choice.
  const choice = carChoiceFromParams(params, carSet);
  const sel = createCarSelect(carSet, choice.carId);
  let phase = choice.fromUrl ? "race" : "select";
  let session = null;

  function start(carId) {
    session = remote
      ? createRemoteSession(`ws://${location.host}`, { courseSet, carSet, startTimeTicks, carId })
      : createLocalSession(courseSet, carSet, { seed: 12345, courseId, startTimeTicks, trafficConfig, carId });
    if (remote) session.connect();
    phase = "race";
  }
  if (phase === "race") start(choice.carId);

  // Tap-to-choose on touch: left/right third cycles, centre confirms.
  canvas.addEventListener?.("pointerup", (e) => {
    if (phase !== "select") return;
    const rect = canvas.getBoundingClientRect?.() || { left: 0, top: 0, width: view.w, height: view.h };
    const x = ((e.clientX - rect.left) / (rect.width || 1)) * view.w;
    const y = ((e.clientY - rect.top) / (rect.height || 1)) * view.h;
    if (sel.handle(carSelectTouchZone(view, x, y)) === "confirm") start(sel.carId);
  });

  let acc = 0;
  let last = performance.now();
  let frameCount = 0;
  let prevCrashed = 0, prevFinish = -1, prevTimer = NaN; // SFX edge trackers
  function frame(now) {
    // Drain menu-nav events every frame so the queue never leaks; only the
    // select phase acts on them (arrow keys also steer during the race).
    let ev;
    while ((ev = readMenuNav()) !== null) {
      if (phase === "select" && sel.handle(ev) === "confirm") { start(sel.carId); break; }
    }
    if (phase === "select") {
      drawCarSelect(g, view, sel);
      frameCount++;
      requestAnimationFrame(frame);
      return;
    }
    const kb = readInput();
    const tc = readTouchInput();
    session.setInput({
      steer: kb.steer || tc.steer,
      accel: kb.accel || tc.accel,
      brake: kb.brake || tc.brake,
    });
    const fc = readForkChoice() || readTouchFork();
    if (fc !== 0) session.setForkChoice(fc);
    if (!remote) {
      acc += now - last;
      last = now;
      while (acc >= SIM_DT) {
        session.tick(); // local session owns advancement
        acc -= SIM_DT;
      }
    }
    const state = session.getState();
    if (state.seats.length) render(g, view, state, courseSet, assets, scenery);
    // Audio: engine pitch tracks speed; SFX fire on state edges (crash entered,
    // finish crossed, timer bumped up by a checkpoint).
    const self = state.seats[0];
    if (self) {
      audio.setSpeed(self.speed, sel.car.maxSpeed);
      if (self.crashedTicks > 0 && prevCrashed === 0) audio.event("crash");
      if (self.finishTicks >= 0 && prevFinish < 0) audio.event("finish");
      if (Number.isFinite(prevTimer) && self.timerTicks > prevTimer) audio.event("checkpoint");
      prevCrashed = self.crashedTicks || 0;
      prevFinish = self.finishTicks ?? -1;
      prevTimer = self.timerTicks;
    }
    // Finish splash: confetti + fireworks once the local car crosses the line.
    if (state.seats.length && state.seats[0].finishTicks >= 0) celebration.trigger(view);
    celebration.update(view);
    celebration.draw(g, view);
    if (showTouch) drawTouchControls(g, view);
    if (remote) drawConnectionBanner(g, view, session.status, frameCount);
    frameCount++;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => boot());
}
