import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadCourseSet } from "../shared/road_data.js";
import { render } from "../client/renderer_canvas.js";

const courseSet = loadCourseSet(JSON.parse(readFileSync(new URL("../data/roads.json", import.meta.url))));

function recorder() {
  const texts = [];
  const g = new Proxy({}, {
    get: (_, k) => {
      if (["fillStyle", "strokeStyle", "lineWidth", "font", "textAlign", "textBaseline", "globalAlpha"].includes(k)) return "";
      if (k === "createLinearGradient") return () => ({ addColorStop() {} });
      if (k === "measureText") return (t) => ({ width: t.length * 8 });
      if (k === "fillText") return (t) => texts.push(String(t));
      return () => {};
    },
    set: () => true,
  });
  return { g, texts };
}

test("in-view rival gets a name tag; a rival further ahead gets a horizon dot label", () => {
  const seat = { carId: 1, segmentId: 1, roadZ: 0, laneX: 0, speed: 500, timerTicks: 200, finishTicks: -1, crashedTicks: 0 };
  const state = {
    tick: 10, seats: [seat],
    ghosts: [
      { seatId: 2, carId: 2, segmentId: 1, roadZ: 1500, laneX: -100, finishTicks: -1, collisionActive: 0 }, // same segment ahead
      { seatId: 3, carId: 3, segmentId: 3, roadZ: 500, laneX: 0, finishTicks: -1, collisionActive: 0 }, // further along the course
    ],
    traffic: [], hazards: [], events: [],
  };
  const { g, texts } = recorder();
  render(g, { w: 960, h: 540 }, state, courseSet, null, null, { stage: 1, total: 6 });
  assert.ok(texts.includes("P2"), "in-view rival name tag");
  assert.ok(texts.includes("P3"), "horizon-dot label for rival ahead");
});
