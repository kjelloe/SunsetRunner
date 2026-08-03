import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadCourseSet } from "../shared/road_data.js";
import { loadCarSet } from "../shared/car_data.js";
import { stageNumber, buildSummary, playersFromState, drawRaceSummary, NEW_RACE_SECONDS } from "../client/race_summary.js";

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const courseSet = loadCourseSet(read("../data/roads.json"));
const carSet = loadCarSet(read("../data/cars.json"));

test("stageNumber is the hop distance from the course start", () => {
  assert.equal(stageNumber(courseSet, 1, 1), 1);
  assert.equal(stageNumber(courseSet, 1, 2), 2);
  assert.equal(stageNumber(courseSet, 1, 3), 3);
  assert.equal(stageNumber(courseSet, 1, 4), 4); // a fork branch
  assert.equal(stageNumber(courseSet, 1, -1), -1); // finished/none
});

test("buildSummary ranks finishers first, then by stage/progress", () => {
  const players = [
    { carId: 3, segmentId: 2, roadZ: 10, finishTicks: -1, isYou: false }, // stage 2
    { carId: 1, segmentId: -1, roadZ: 0, finishTicks: 250, isYou: true }, // finished
    { carId: 2, segmentId: 4, roadZ: 50, finishTicks: -1, isYou: false }, // stage 4
  ];
  const rows = buildSummary(courseSet, 1, carSet, players);
  assert.equal(rows[0].rank, 1);
  assert.equal(rows[0].finished, true);
  assert.equal(rows[0].isYou, true);
  assert.equal(rows[1].stage, 4); // further along ranks above stage 2
  assert.equal(rows[2].stage, 2);
  assert.equal(rows[1].rank, 2);
});

test("two finishers are ordered by finish time", () => {
  const rows = buildSummary(courseSet, 1, carSet, [
    { carId: 1, segmentId: -1, roadZ: 0, finishTicks: 300, isYou: false },
    { carId: 2, segmentId: -1, roadZ: 0, finishTicks: 280, isYou: false },
  ]);
  assert.equal(rows[0].finishTicks, 280); // earlier finish wins
});

test("playersFromState gathers self + ghosts, self flagged", () => {
  const state = {
    seats: [{ carId: 1, segmentId: 3, roadZ: 5, finishTicks: -1 }],
    ghosts: [{ carId: 2, segmentId: 2, roadZ: 9, finishTicks: -1 }],
  };
  const p = playersFromState(state);
  assert.equal(p.length, 2);
  assert.equal(p[0].isYou, true);
  assert.equal(p[1].isYou, false);
  assert.equal(p[1].carId, 2);
});

test("drawRaceSummary renders rows and the restart countdown", () => {
  const texts = [];
  const g = new Proxy({}, {
    get: (_, k) => {
      if (["fillStyle", "font", "textAlign", "textBaseline"].includes(k)) return "";
      if (k === "fillText") return (t) => texts.push(String(t));
      return () => {};
    },
    set: () => true,
  });
  const rows = buildSummary(courseSet, 1, carSet, [{ carId: 1, segmentId: 2, roadZ: 0, finishTicks: -1, isYou: true }]);
  drawRaceSummary(g, { w: 960, h: 540 }, rows, 12);
  assert.ok(texts.includes("RACE OVER"));
  assert.ok(texts.some((t) => t.includes("NEW RACE IN 12s")));
  assert.ok(texts.some((t) => t.includes("STAGE 2")));
  assert.equal(NEW_RACE_SECONDS, 10);
});
