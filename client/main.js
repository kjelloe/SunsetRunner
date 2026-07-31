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

  // ?mode=remote joins the ws server room; default is an offline local race.
  const remote = new URLSearchParams(location.search).get("mode") === "remote";
  const session = remote
    ? createRemoteSession(`ws://${location.host}`)
    : createLocalSession(courseSet, carSet, { seed: 12345, startTimeTicks, trafficConfig });
  if (remote) session.connect();

  installKeyboard(doc);

  let acc = 0;
  let last = performance.now();
  function frame(now) {
    session.setInput(readInput());
    if (!remote) {
      acc += now - last;
      last = now;
      while (acc >= SIM_DT) {
        session.tick(); // local session owns advancement
        acc -= SIM_DT;
      }
    }
    const state = session.getState();
    if (state.seats.length) render(g, view, state, courseSet);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => boot());
}
