import { test } from "node:test";
import assert from "node:assert/strict";
import { installTouch, readTouchInput, readTouchFork, eventFraction, cruiseInput, BUTTONS, STEER_WHEEL, THROTTLE, PAD_RANGE } from "../client/touch_controls.js";

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

// Centre of the steering wheel grab band, in client px.
function wheelCenter(rect) {
  return {
    x: rect.left + ((STEER_WHEEL.x0 + STEER_WHEEL.x1) / 2) * rect.width,
    y: rect.top + ((STEER_WHEEL.y0 + STEER_WHEEL.y1) / 2) * rect.height,
  };
}

// A point in the throttle lever at a given vertical fraction of the canvas.
function throttlePoint(rect, fyFrac) {
  return {
    x: rect.left + ((THROTTLE.x0 + THROTTLE.x1) / 2) * rect.width,
    y: rect.top + fyFrac * rect.height,
  };
}

function drain() { while (readTouchFork() !== 0) {} }

test("eventFraction maps via the bounding rect, independent of CSS scale/offset", () => {
  const canvas = { width: 960, height: 540, getBoundingClientRect: () => ({ left: 100, top: 50, width: 480, height: 270 }) };
  const f = eventFraction(canvas, { clientX: 100 + 0.25 * 480, clientY: 50 + 0.5 * 270 });
  assert.ok(Math.abs(f.fx - 0.25) < 1e-9);
  assert.ok(Math.abs(f.fy - 0.5) < 1e-9);
});

test("eventFraction falls back to offset/buffer when no rect is available", () => {
  const f = eventFraction({ width: 960, height: 540 }, { offsetX: 240, offsetY: 270 });
  assert.equal(f.fx, 0.25);
  assert.equal(f.fy, 0.5);
});

test("steering wheel: drag right = full lock, release springs back to centre", () => {
  const rect = { left: 0, top: 0, width: 960, height: 540 };
  const c = makeCanvas(rect);
  installTouch(c);
  const p = wheelCenter(rect);
  c.fire("pointerdown", p.x, p.y);
  assert.equal(readTouchInput().steer, 0); // anchor = no drag yet
  c.fire("pointermove", p.x + PAD_RANGE * rect.width, p.y); // full-lock drag right
  assert.equal(readTouchInput().steer, 256);
  c.fire("pointermove", p.x + 0.5 * PAD_RANGE * rect.width, p.y); // half drag = analog
  assert.equal(readTouchInput().steer, 128);
  c.fire("pointerup", p.x, p.y);
  assert.equal(readTouchInput().steer, 0);
});

test("throttle lever: knob position sets a 0..1 speed fraction and PERSISTS on release", () => {
  const rect = { left: 0, top: 0, width: 960, height: 540 };
  const c = makeCanvas(rect);
  installTouch(c);
  const top = throttlePoint(rect, THROTTLE.y0);
  c.fire("pointerdown", top.x, top.y, 5); // knob to the top = full speed
  assert.equal(readTouchInput().throttleFrac, 1);
  const mid = throttlePoint(rect, (THROTTLE.y0 + THROTTLE.y1) / 2);
  c.fire("pointermove", mid.x, mid.y, 5); // drag to the middle = ~half
  assert.ok(Math.abs(readTouchInput().throttleFrac - 0.5) < 1e-9);
  c.fire("pointerup", mid.x, mid.y, 5); // released, but the set speed stays
  assert.ok(Math.abs(readTouchInput().throttleFrac - 0.5) < 1e-9);
  const bottom = throttlePoint(rect, THROTTLE.y1 - 0.001);
  c.fire("pointerdown", bottom.x, bottom.y, 5); // knob to the bottom = stopped
  assert.ok(readTouchInput().throttleFrac < 0.01);
  c.fire("pointerup", bottom.x, bottom.y, 5);
});

test("multi-touch: steer wheel + throttle lever on a scaled canvas", () => {
  const rect = { left: 24, top: 80, width: 480, height: 270 };
  const c = makeCanvas(rect);
  installTouch(c);
  const w = wheelCenter(rect);
  const t = throttlePoint(rect, THROTTLE.y0);
  c.fire("pointerdown", w.x, w.y, 1);
  c.fire("pointermove", w.x - PAD_RANGE * rect.width, w.y, 1); // full-lock drag left
  c.fire("pointerdown", t.x, t.y, 2); // full throttle with a second finger
  const inp = readTouchInput();
  assert.equal(inp.steer, -256);
  assert.equal(inp.throttleFrac, 1);
  c.fire("pointerup", w.x, w.y, 1); // release steer only; throttle stays set
  assert.equal(readTouchInput().steer, 0);
  assert.equal(readTouchInput().throttleFrac, 1);
  c.fire("pointerup", t.x, t.y, 2);
});

test("fork buttons are edge-triggered and leave no held steer", () => {
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
  assert.equal(readTouchInput().steer, 0);
});

test("a touch outside every control does not start a steer", () => {
  const rect = { left: 0, top: 0, width: 960, height: 540 };
  const c = makeCanvas(rect);
  installTouch(c);
  c.fire("pointerdown", 480, 20, 9); // top-centre, no control there
  assert.equal(readTouchInput().steer, 0);
});

test("cruiseInput: set-speed lever -> accel below target, brake above, coast within deadband", () => {
  const MAX = 1000; // deadband = SPEED_SCALE/4 = 64
  // frac 0.5 -> target 500
  assert.deepEqual(cruiseInput(400, 0.5, MAX), { accel: 1, brake: 0 }); // well below
  assert.deepEqual(cruiseInput(600, 0.5, MAX), { accel: 0, brake: 1 }); // well above
  assert.deepEqual(cruiseInput(500, 0.5, MAX), { accel: 0, brake: 0 }); // at target -> coast
  assert.deepEqual(cruiseInput(450, 0.5, MAX), { accel: 0, brake: 0 }); // inside deadband
  // frac 0 -> target 0: any speed brakes down to a stop
  assert.deepEqual(cruiseInput(100, 0, MAX), { accel: 0, brake: 1 });
  // frac 1 -> target max: at top speed, coast (no perpetual accel chatter)
  assert.deepEqual(cruiseInput(MAX, 1, MAX), { accel: 0, brake: 0 });
  assert.deepEqual(cruiseInput(0, 1, MAX), { accel: 1, brake: 0 });
});

test("control layout: fork ids unique + in bounds; wheel/throttle regions disjoint from forks", () => {
  const ids = BUTTONS.map((b) => b.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const b of BUTTONS) {
    assert.ok(b.x0 >= 0 && b.x1 <= 1 && b.y0 >= 0 && b.y1 <= 1 && b.x0 < b.x1 && b.y0 < b.y1, `${b.id} in bounds`);
  }
  const regions = [STEER_WHEEL, THROTTLE];
  for (const r of regions) {
    for (const b of BUTTONS) {
      const overlap = r.x0 < b.x1 && b.x0 < r.x1 && r.y0 < b.y1 && b.y0 < r.y1;
      assert.ok(!overlap, "steer/throttle must not overlap a fork button");
    }
  }
  // wheel (bottom-centre) and throttle (right) must not overlap each other
  const o = STEER_WHEEL.x0 < THROTTLE.x1 && THROTTLE.x0 < STEER_WHEEL.x1 && STEER_WHEEL.y0 < THROTTLE.y1 && THROTTLE.y0 < STEER_WHEEL.y1;
  assert.ok(!o, "wheel and throttle must not overlap");
});
