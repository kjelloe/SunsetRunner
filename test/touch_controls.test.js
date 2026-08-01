import { test } from "node:test";
import assert from "node:assert/strict";
import { installTouch, readTouchInput, readTouchFork, BUTTONS } from "../client/touch_controls.js";

const view = { w: 960, h: 540 };
const handlers = {};
const target = { addEventListener: (ev, fn) => { (handlers[ev] ||= []).push(fn); } };
installTouch(target, view);

// Fire a synthetic pointer event at the CENTRE of a named button.
function fire(type, buttonId, pointerId = 1) {
  const b = BUTTONS.find((x) => x.id === buttonId);
  const offsetX = ((b.x0 + b.x1) / 2) * view.w;
  const offsetY = ((b.y0 + b.y1) / 2) * view.h;
  for (const fn of handlers[type] || []) fn({ type, pointerId, offsetX, offsetY, preventDefault() {} });
}

function drain() { while (readTouchFork() !== 0) {} }

test("holding a steer button produces steer input until release", () => {
  fire("pointerdown", "steerR");
  assert.deepEqual(readTouchInput(), { steer: 1, accel: 0, brake: 0 });
  fire("pointerup", "steerR");
  assert.deepEqual(readTouchInput(), { steer: 0, accel: 0, brake: 0 });
});

test("multi-touch: steer left + gas at once", () => {
  fire("pointerdown", "steerL", 1);
  fire("pointerdown", "accel", 2);
  assert.deepEqual(readTouchInput(), { steer: -1, accel: 1, brake: 0 });
  fire("pointerup", "steerL", 1);
  fire("pointerup", "accel", 2);
  assert.deepEqual(readTouchInput(), { steer: 0, accel: 0, brake: 0 });
});

test("fork buttons are edge-triggered (one tap = one choice)", () => {
  drain();
  fire("pointerdown", "forkR");
  fire("pointerdown", "forkL");
  assert.equal(readTouchFork(), 1);   // forkR first
  assert.equal(readTouchFork(), -1);  // then forkL
  assert.equal(readTouchFork(), 0);   // queue drained
  // a fork tap does not leave a held input
  assert.deepEqual(readTouchInput(), { steer: 0, accel: 0, brake: 0 });
});

test("a touch outside any button is ignored", () => {
  for (const fn of handlers.pointerdown) fn({ type: "pointerdown", pointerId: 9, offsetX: view.w / 2, offsetY: 10, preventDefault() {} });
  assert.deepEqual(readTouchInput(), { steer: 0, accel: 0, brake: 0 });
});
