import { test } from "node:test";
import assert from "node:assert/strict";
import { createCrashFeel } from "../client/crash_feel.js";

const view = { w: 1280, h: 720 };

function fakeGrad() { return { addColorStop() {} }; }
function fakeCtx() {
  const calls = { fillRect: 0, gradients: 0 };
  return {
    calls,
    save() {}, restore() {},
    createRadialGradient() { calls.gradients++; return fakeGrad(); },
    set fillStyle(_v) {},
    fillRect() { calls.fillRect++; },
  };
}

test("crash shake: zero before trigger, non-zero during, zero after it decays", () => {
  const cf = createCrashFeel();
  assert.deepEqual(cf.shake(0, view), { dx: 0, dy: 0 }); // never triggered
  cf.trigger(1000);
  const mid = cf.shake(1000 + 60, view); // early in the 420ms window
  assert.ok(Math.abs(mid.dx) + Math.abs(mid.dy) > 0, "shakes during the window");
  assert.deepEqual(cf.shake(1000 + 420, view), { dx: 0, dy: 0 }); // window ended
  assert.deepEqual(cf.shake(1000 + 999, view), { dx: 0, dy: 0 });
});

test("crash shake decays: amplitude later in the window is smaller than early", () => {
  const cf = createCrashFeel();
  cf.trigger(0);
  // Sample the same phase-ish point early vs late via peak magnitude proxy:
  const early = Math.abs(cf.shake(30, view).dx) + Math.abs(cf.shake(30, view).dy);
  const late = Math.abs(cf.shake(360, view).dx) + Math.abs(cf.shake(360, view).dy);
  assert.ok(late <= early, "later shake amplitude does not exceed earlier");
});

test("crash flash: draws during FLASH_MS, no-ops before trigger and after", () => {
  const cf = createCrashFeel();
  const g0 = fakeCtx();
  cf.draw(g0, view, 0); // never triggered
  assert.equal(g0.calls.fillRect, 0);

  cf.trigger(500);
  const g1 = fakeCtx();
  cf.draw(g1, view, 500 + 100); // inside 260ms
  assert.equal(g1.calls.fillRect, 1);
  assert.equal(g1.calls.gradients, 1);

  const g2 = fakeCtx();
  cf.draw(g2, view, 500 + 260); // window ended
  assert.equal(g2.calls.fillRect, 0);
});

test("crash feel: active() spans the longer of shake/flash, reset() clears it", () => {
  const cf = createCrashFeel();
  cf.trigger(2000);
  assert.equal(cf.active(2000 + 100), true);
  assert.equal(cf.active(2000 + 420), false); // past both windows
  cf.reset();
  assert.equal(cf.active(2000 + 100), false);
});
