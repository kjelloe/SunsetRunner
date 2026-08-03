import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadCourseSet, getSegment } from "../shared/road_data.js";
import { ROAD_UNIT } from "../shared/constants.js";
import { checkpointAhead } from "../client/checkpoint_banner.js";
import { render } from "../client/renderer_canvas.js";

const courseSet = loadCourseSet(JSON.parse(readFileSync(new URL("../data/roads.json", import.meta.url))));
const segLen = (id) => getSegment(courseSet, id).stripCount * ROAD_UNIT;

test("checkpointAhead finds the upcoming checkpoint boundary", () => {
  // seg 1 -> seg 2 (checkpointTicks 600) on course 1.
  const ca = checkpointAhead(courseSet, { segmentId: 1, roadZ: segLen(1) - 5000 });
  assert.equal(ca.segId, 2);
  assert.equal(ca.distance, 5000);
});

test("checkpointAhead is null when the next segment grants no time", () => {
  // seg 4 -> seg 6: seg 6 has no checkpoint on course 1.
  const next = getSegment(courseSet, 4).next;
  const has = getSegment(courseSet, next).checkpointTicks > 0;
  const ca = checkpointAhead(courseSet, { segmentId: 4, roadZ: 0 });
  assert.equal(has ? ca !== null : ca === null, true);
});

function recorder() {
  const texts = [];
  const g = new Proxy({}, {
    get: (_, k) => {
      if (["fillStyle", "strokeStyle", "lineWidth", "font", "textAlign", "textBaseline", "globalAlpha"].includes(k)) return "";
      if (k === "createLinearGradient") return () => ({ addColorStop() {} });
      if (k === "fillText") return (t) => texts.push(String(t));
      return () => {};
    },
    set: () => true,
  });
  return { g, texts };
}

test("render draws the CHECKPOINT banner when one is close ahead", () => {
  const { g, texts } = recorder();
  const seat = { carId: 1, segmentId: 1, roadZ: segLen(1) - 5000, laneX: 0, speed: 500, timerTicks: 200, finishTicks: -1, crashedTicks: 0 };
  render(g, { w: 960, h: 540 }, { tick: 5, seats: [seat], ghosts: [], traffic: [], events: [] }, courseSet, null, null);
  assert.ok(texts.includes("CHECKPOINT"), "banner text drawn");
});
