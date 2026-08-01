import { test } from "node:test";
import assert from "node:assert/strict";
import { createCelebration } from "../client/celebration.js";

const view = { w: 960, h: 540 };

function fakeCtx() {
  const calls = [];
  return new Proxy({}, {
    get: (_, k) => {
      if (k === "createLinearGradient") return () => ({ addColorStop() {} });
      if (["fillStyle", "font", "textAlign", "textBaseline", "globalAlpha"].includes(k)) return "";
      if (k === "__calls") return calls;
      return (...a) => calls.push([k, ...a]);
    },
    set: () => true,
  });
}

test("trigger spawns confetti + a firework burst and goes active", () => {
  const c = createCelebration();
  assert.equal(c.active, false);
  c.trigger(view);
  assert.equal(c.active, true);
  assert.ok(c.confettiCount > 0);
  assert.ok(c.sparkCount > 0);
});

test("update falls confetti and periodically launches more fireworks", () => {
  const c = createCelebration();
  c.trigger(view);
  const spark0 = c.sparkCount;
  for (let i = 0; i < 22; i++) c.update(view); // frame 22 -> another burst
  assert.ok(c.sparkCount > 0);
  // sparks die over time but a burst at frame 22 keeps some alive
  assert.ok(c.confettiCount > 0);
  assert.ok(spark0 >= 0);
});

test("update/draw are no-ops before trigger and don't throw after", () => {
  const c = createCelebration();
  c.update(view);        // inactive: no-op
  c.draw(fakeCtx(), view);
  assert.equal(c.active, false);
  c.trigger(view);
  for (let i = 0; i < 30; i++) c.update(view);
  c.draw(fakeCtx(), view); // must not throw with the gradient/save/restore calls
  assert.ok(true);
});

test("reset clears everything", () => {
  const c = createCelebration();
  c.trigger(view);
  c.reset();
  assert.equal(c.active, false);
  assert.equal(c.confettiCount, 0);
  assert.equal(c.sparkCount, 0);
});
