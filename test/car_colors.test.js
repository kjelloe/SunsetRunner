import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { carColor, CAR_COLOR_FALLBACK } from "../client/car_colors.js";
import { render } from "../client/renderer_canvas.js";
import { loadCourseSet } from "../shared/road_data.js";

test("carColor gives a distinct colour per roster car, fallback for unknown", () => {
  const cols = [1, 2, 3, 4].map(carColor);
  assert.equal(new Set(cols).size, 4); // all distinct
  assert.equal(carColor(99), CAR_COLOR_FALLBACK);
});

// A fake 2D context that records the fillStyle in effect at each fillRect.
function recorder() {
  const fills = [];
  let cur = "";
  const grad = { addColorStop() {} };
  const g = {
    set fillStyle(v) { cur = v; }, get fillStyle() { return cur; },
    strokeStyle: "", lineWidth: 0, globalAlpha: 1, font: "", textAlign: "", textBaseline: "",
    fillRect() { fills.push(cur); },
    fillText() {}, strokeRect() {}, createLinearGradient() { return grad; },
    drawImage() {}, save() {}, restore() {}, beginPath() {}, arc() {}, fill() {},
    moveTo() {}, lineTo() {}, closePath() {},
  };
  return { g, fills };
}

test("ghosts are tinted by their carId when rendered", () => {
  const roads = JSON.parse(readFileSync(new URL("../data/roads.json", import.meta.url)));
  const courseSet = loadCourseSet(roads);
  const seat = { id: 1, carId: 1, segmentId: 1, roadZ: 0, laneX: 0, speed: 500, timerTicks: 200, finishTicks: -1, crashedTicks: 0 };
  const state = {
    tick: 10, seats: [seat],
    ghosts: [
      { seatId: 2, carId: 2, segmentId: 1, roadZ: 1200, laneX: -200, speed: 500, collisionActive: 0 },
      { seatId: 3, carId: 3, segmentId: 1, roadZ: 1600, laneX: 200, speed: 500, collisionActive: 0 },
    ],
    traffic: [], events: [],
  };
  const { g, fills } = recorder();
  render(g, { w: 960, h: 540 }, state, courseSet, null, null);
  assert.ok(fills.includes(carColor(2)), "ghost car 2 not tinted");
  assert.ok(fills.includes(carColor(3)), "ghost car 3 not tinted");
});
