// client/main.js — boot + fixed-step loop (CLIENT ONLY).
// 20 Hz authoritative sim (accumulator), render every animation frame.
// Import-safe: boot() only runs under a real DOM.

import { loadCourseSet } from "../shared/road_data.js";
import { loadCarSet } from "../shared/car_data.js";
import { loadCheckpointConfig } from "../shared/checkpoint_data.js";
import { loadTrafficConfig } from "../shared/traffic_data.js";
import { TICK_HZ } from "../shared/constants.js";
import { createLocalSession } from "./session_local.js";
import { installKeyboard, readInput } from "./input.js";
import { render } from "./renderer_canvas.js";

const SIM_DT = 1000 / TICK_HZ;

export async function boot(doc = document) {
  const canvas = doc.getElementById("game");
  const g = canvas.getContext("2d");
  const view = { w: canvas.width, h: canvas.height };

  const [roads, cars, checkpoints, traffic] = await Promise.all([
    fetch("../data/roads.json").then((r) => r.json()),
    fetch("../data/cars.json").then((r) => r.json()),
    fetch("../data/checkpoints.json").then((r) => r.json()),
    fetch("../data/traffic.json").then((r) => r.json()),
  ]);
  const courseSet = loadCourseSet(roads);
  const carSet = loadCarSet(cars);
  const { startTimeTicks } = loadCheckpointConfig(checkpoints);
  const trafficConfig = loadTrafficConfig(traffic);
  const session = createLocalSession(courseSet, carSet, { seed: 12345, startTimeTicks, trafficConfig });

  installKeyboard(doc);

  let acc = 0;
  let last = performance.now();
  function frame(now) {
    acc += now - last;
    last = now;
    while (acc >= SIM_DT) {
      session.setInput(readInput());
      session.tick();
      acc -= SIM_DT;
    }
    render(g, view, session.getState(), courseSet);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => boot());
}
