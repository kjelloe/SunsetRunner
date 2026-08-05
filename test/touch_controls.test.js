import { test } from "node:test";
import assert from "node:assert/strict";
import { installTouch, readTouchInput, readTouchFork, eventFraction, BUTTONS, STEER_PAD, PAD_RANGE } from "../client/touch_controls.js";

// A fake canvas: captures listeners and reports a bounding rect, so we can
// simulate a canvas that the browser has CSS-scaled to fit a phone.
function makeCanvas(rect) {
  const handlers = {};
  return {
    width: 960, height: 540,
    getBoundingClientRect: () => rect,
    addEventListener: (ev, fn) => { (handlers[ev] ||= []).push(fn); },
    fire(type, clientX, clientY, pointerId = 1) {
      for (const fn of handlers[type] || []) fn({ type, pointerId, clientX, clientY, preventDefault() {} });
    },
  };
}

function centerOf(rect, buttonId) {
  const b = BUTTONS.find((x) => x.id === buttonId);
  return { x: rect.left + ((b.x0 + b.x1) / 2) * rect.width, y: rect.top + ((b.y0 + b.y1) / 2) * rect.height };
}

// Centre of the analog steer pad, in client px.
function steerPadCenter(rect) {
  return {
    x: rect.left + ((STEER_PAD.x0 + STEER_PAD.x1) / 2) * rect.width,
    y: rect.top + ((STEER_PAD.y0 + STEER_PAD.y1) / 2) * rect.height,
  };
}

function drain() { while (readTouchFork() !== 0) {} }

test("eventFraction maps via the bounding rect, independent of CSS scale/offset", () => {
  const canvas = { width: 960, height: 540, getBoundingClientRect: () => ({ left: 100, top: 50, width: 480, height: 270 }) };
  // a point at 25% / 50% of the DISPLAYED rect
  const f = eventFraction(canvas, { clientX: 100 + 0.25 * 480, clientY: 50 + 0.5 * 270 });
  assert.ok(Math.abs(f.fx - 0.25) < 1e-9);
  assert.ok(Math.abs(f.fy - 0.5) < 1e-9);
});

test("eventFraction falls back to offset/buffer when no rect is available", () => {
  const f = eventFraction({ width: 960, height: 540 }, { offsetX: 240, offsetY: 270 });
  assert.equal(f.fx, 0.25);
  assert.equal(f.fy, 0.5);
});

test("analog steer pad: drag right = full lock, release stops (full-size canvas)", () => {
  const rect = { left: 0, top: 0, width: 960, height: 540 };
  const c = makeCanvas(rect);
  installTouch(c);
  const p = steerPadCenter(rect);
  c.fire("pointerdown", p.x, p.y);
  assert.deepEqual(readTouchInput(), { steer: 0, accel: 0, brake: 0 }); // anchor = no drag yet
  c.fire("pointermove", p.x + PAD_RANGE * rect.width, p.y); // full-lock drag right
  assert.deepEqual(readTouchInput(), { steer: 256, accel: 0, brake: 0 });
  c.fire("pointermove", p.x + 0.5 * PAD_RANGE * rect.width, p.y); // half drag = analog
  assert.deepEqual(readTouchInput(), { steer: 128, accel: 0, brake: 0 });
  c.fire("pointerup", p.x, p.y);
  assert.deepEqual(readTouchInput(), { steer: 0, accel: 0, brake: 0 });
});

test("touch hit-testing is correct on a CSS-SCALED canvas (mobile)", () => {
  // Canvas displayed at 360x202.5 (shrunk) and offset — the old offsetX/buffer
  // math would land in the wrong button; rect-based mapping stays correct.
  const rect = { left: 24, top: 80, width: 360, height: 202.5 };
  const c = makeCanvas(rect);
  installTouch(c);
  const gas = centerOf(rect, "accel");
  c.fire("pointerdown", gas.x, gas.y, 2);
  assert.deepEqual(readTouchInput(), { steer: 0, accel: 1, brake: 0 });
  c.fire("pointerup", gas.x, gas.y, 2);
  assert.deepEqual(readTouchInput(), { steer: 0, accel: 0, brake: 0 });
});

test("multi-touch: analog steer + gas on a scaled canvas", () => {
  const rect = { left: 0, top: 0, width: 480, height: 270 };
  const c = makeCanvas(rect);
  installTouch(c);
  const l = steerPadCenter(rect);
  const g = centerOf(rect, "accel");
  c.fire("pointerdown", l.x, l.y, 1);
  c.fire("pointermove", l.x - PAD_RANGE * rect.width, l.y, 1); // full-lock drag left
  c.fire("pointerdown", g.x, g.y, 2);
  assert.deepEqual(readTouchInput(), { steer: -256, accel: 1, brake: 0 });
  c.fire("pointerup", l.x, l.y, 1); // release steer only; gas still held
  assert.deepEqual(readTouchInput(), { steer: 0, accel: 1, brake: 0 });
  c.fire("pointerup", g.x, g.y, 2);
});

test("fork buttons are edge-triggered and leave no held input", () => {
  drain();
  const rect = { left: 0, top: 0, width: 960, height: 540 };
  const c = makeCanvas(rect);
  installTouch(c);
  const fr = centerOf(rect, "forkR");
  const fl = centerOf(rect, "forkL");
  c.fire("pointerdown", fr.x, fr.y, 3);
  c.fire("pointerdown", fl.x, fl.y, 4);
  assert.equal(readTouchFork(), 1);
  assert.equal(readTouchFork(), -1);
  assert.equal(readTouchFork(), 0);
  assert.deepEqual(readTouchInput(), { steer: 0, accel: 0, brake: 0 });
});

test("a touch outside every button is ignored", () => {
  const rect = { left: 0, top: 0, width: 960, height: 540 };
  const c = makeCanvas(rect);
  installTouch(c);
  c.fire("pointerdown", 480, 20, 9); // top-centre, no button
  assert.deepEqual(readTouchInput(), { steer: 0, accel: 0, brake: 0 });
});

test("button layout: unique ids, in-bounds, no overlap", () => {
  const ids = BUTTONS.map((b) => b.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const b of BUTTONS) {
    assert.ok(b.x0 >= 0 && b.x1 <= 1 && b.y0 >= 0 && b.y1 <= 1 && b.x0 < b.x1 && b.y0 < b.y1, `${b.id} in bounds`);
  }
  for (let i = 0; i < BUTTONS.length; i++) {
    for (let j = i + 1; j < BUTTONS.length; j++) {
      const a = BUTTONS[i], b = BUTTONS[j];
      const overlap = a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
      assert.ok(!overlap, `${a.id} and ${b.id} must not overlap`);
    }
  }
});
