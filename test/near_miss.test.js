import { test } from "node:test";
import assert from "node:assert/strict";
import { createNearMiss } from "../client/near_miss.js";
import { CAR_WIDTH, CAR_LENGTH } from "../shared/collision.js";

const view = { w: 1280, h: 720 };
const self = { segmentId: 3, roadZ: 1000, laneX: 0, crashedTicks: 0 };

// A traffic car in the near band on the given side (default right).
function nearCar(id, side = 1) {
  return { id, segmentId: 3, roadZ: 1000 + 100, laneX: side * (CAR_WIDTH + 60) };
}

test("near miss: fires once for a close pass, deduped on the next frame", () => {
  const nm = createNearMiss();
  assert.equal(nm.update(0, self, [nearCar(1)]), 1);   // enters the band
  assert.equal(nm.update(16, self, [nearCar(1)]), 0);  // same car, already counted
});

test("near miss: no fire when overlapping (that is a crash) or too far", () => {
  const nm = createNearMiss();
  const crash = { id: 2, segmentId: 3, roadZ: 1000, laneX: CAR_WIDTH - 40 }; // < CAR_WIDTH
  assert.equal(nm.update(0, self, [crash]), 0);
  const far = { id: 3, segmentId: 3, roadZ: 1000, laneX: 600 }; // >= NEAR_WIDTH(460)
  assert.equal(nm.update(0, self, [far]), 0);
  const behind = { id: 4, segmentId: 3, roadZ: 1000 + CAR_LENGTH + 10, laneX: CAR_WIDTH + 60 };
  assert.equal(nm.update(0, self, [behind]), 0); // outside the longitudinal window
});

test("near miss: suppressed while crashed / off-track, and different segment", () => {
  const nm = createNearMiss();
  assert.equal(nm.update(0, { ...self, crashedTicks: 5 }, [nearCar(1)]), 0);
  assert.equal(nm.update(0, { ...self, segmentId: -1 }, [nearCar(1)]), 0);
  const otherSeg = { id: 5, segmentId: 9, roadZ: 1000 + 100, laneX: CAR_WIDTH + 60 };
  assert.equal(nm.update(0, self, [otherSeg]), 0);
});

test("near miss: audio cooldown collapses two cars within the window to one whoosh", () => {
  const nm = createNearMiss();
  assert.equal(nm.update(0, self, [nearCar(1)]), 1);
  assert.equal(nm.update(100, self, [nearCar(2)]), 0); // new car, but within 250ms cooldown
  assert.equal(nm.update(300, self, [nearCar(3)]), 1); // cooldown elapsed
});

test("near miss: reset clears dedup so the same id can fire again", () => {
  const nm = createNearMiss();
  assert.equal(nm.update(0, self, [nearCar(1)]), 1);
  assert.equal(nm.update(16, self, [nearCar(1)]), 0);
  nm.reset();
  assert.equal(nm.update(1000, self, [nearCar(1)]), 1);
});

test("near miss: streak draws on the side the car passed, only within its window", () => {
  const nm = createNearMiss();
  const rects = [];
  const g = {
    save() {}, restore() {}, set fillStyle(_v) {},
    createLinearGradient() { return { addColorStop() {} }; },
    fillRect(x, y, w, h) { rects.push({ x, w }); },
  };
  nm.update(0, self, [nearCar(1, 1)]); // passed on the RIGHT (car laneX > self)
  nm.draw(g, view, 50);
  assert.equal(rects.length, 1);
  assert.ok(rects[0].x > view.w / 2, "streak is on the right half");
  rects.length = 0;
  nm.draw(g, view, 220); // window ended
  assert.equal(rects.length, 0);
});
