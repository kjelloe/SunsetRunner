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
import { installKeyboard, readInput, readForkChoice } from "./input.js";
import { installTouch, readTouchInput, readTouchFork, drawTouchControls, touchDetected } from "./touch_controls.js";
import { render } from "./renderer_canvas.js";
import { createCelebration } from "./celebration.js";
import { computeBufferSize } from "./viewport.js";
import { installWakeLock } from "./wakelock.js";

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

  const [roads, cars, checkpoints, traffic, assets] = await Promise.all([
    fetch("../data/roads.json").then((r) => r.json()),
    fetch("../data/cars.json").then((r) => r.json()),
    fetch("../data/checkpoints.json").then((r) => r.json()),
    fetch("../data/traffic.json").then((r) => r.json()),
    fetch("../data/assets.json").then((r) => r.json()),
  ]);
  const courseSet = loadCourseSet(roads);
  const carSet = loadCarSet(cars);
  const { startTimeTicks } = loadCheckpointConfig(checkpoints);
  const trafficConfig = loadTrafficConfig(traffic);

  // ?mode=remote joins the ws server room; default is an offline local race.
  // ?course=N selects the course for a local race (default 1).
  const params = new URLSearchParams(location.search);
  const remote = params.get("mode") === "remote";
  const courseId = Number(params.get("course")) || 1;
  const session = remote
    ? createRemoteSession(`ws://${location.host}`, { courseSet, carSet, startTimeTicks })
    : createLocalSession(courseSet, carSet, { seed: 12345, courseId, startTimeTicks, trafficConfig });
  if (remote) session.connect();

  installKeyboard(doc);
  installTouch(canvas);
  const showTouch = touchDetected() || params.get("touch") === "1";
  const celebration = createCelebration();

  let acc = 0;
  let last = performance.now();
  function frame(now) {
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
    if (state.seats.length) render(g, view, state, courseSet, assets);
    // Finish splash: confetti + fireworks once the local car crosses the line.
    if (state.seats.length && state.seats[0].finishTicks >= 0) celebration.trigger(view);
    celebration.update(view);
    celebration.draw(g, view);
    if (showTouch) drawTouchControls(g, view);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => boot());
}
