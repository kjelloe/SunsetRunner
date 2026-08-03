import { test } from "node:test";
import assert from "node:assert/strict";
import { createCountdown, COUNTDOWN_MS } from "../client/countdown.js";

test("no label before it starts", () => {
  const c = createCountdown();
  assert.equal(c.labelAt(1000), null);
  assert.equal(c.started, false);
});

test("labels step 3 -> 2 -> 1 -> GO! -> done", () => {
  const c = createCountdown();
  c.start(0);
  assert.equal(c.started, true);
  assert.equal(c.labelAt(0), "3");
  assert.equal(c.labelAt(900), "2");
  assert.equal(c.labelAt(1700), "1");
  assert.equal(c.labelAt(2500), "GO!");
  assert.equal(c.labelAt(COUNTDOWN_MS), null); // finished
});

test("isDone flips only after the full countdown", () => {
  const c = createCountdown();
  c.start(100);
  assert.equal(c.isDone(100 + COUNTDOWN_MS - 1), false);
  assert.equal(c.isDone(100 + COUNTDOWN_MS), true);
});

test("draw paints while counting, no-ops once done", () => {
  const c = createCountdown();
  c.start(0);
  const calls = [];
  const g = new Proxy({}, {
    get: (_, k) => (["fillStyle", "font", "textAlign", "textBaseline"].includes(k) ? "" : (...a) => calls.push(k)),
    set: () => true,
  });
  c.draw(g, { w: 960, h: 540 }, 500);
  assert.ok(calls.includes("fillText"));
  calls.length = 0;
  c.draw(g, { w: 960, h: 540 }, COUNTDOWN_MS + 10); // done -> nothing
  assert.equal(calls.length, 0);
});
