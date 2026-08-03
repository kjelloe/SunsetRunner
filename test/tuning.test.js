import { test } from "node:test";
import assert from "node:assert/strict";
import { TUNING, TUNING_FIELDS, readTuning, applyTuning, drawTuningHud } from "../client/tuning.js";

test("readTuning returns nothing when no params are set", () => {
  assert.deepEqual(readTuning(new URLSearchParams("")), {});
});

test("readTuning parses known params to their TUNING keys", () => {
  const o = readTuning(new URLSearchParams("hill=300&follow=0.6&height=2000"));
  assert.deepEqual(o, { hillScale: 300, camFollow: 0.6, camHeight: 2000 });
});

test("readTuning clamps to each field's usable range", () => {
  const o = readTuning(new URLSearchParams("follow=5&hill=-50&depth=99&roadw=200"));
  assert.equal(o.camFollow, 0.75); // clamped to max
  assert.equal(o.hillScale, 40); // clamped to min
  assert.equal(o.camDepth, 1.4); // clamped to max
  assert.equal(o.roadWidth, 1400); // too-narrow road clamped up to min
});

test("readTuning ignores non-numeric values", () => {
  assert.deepEqual(readTuning(new URLSearchParams("hill=abc&follow=")), {});
});

test("applyTuning writes known keys into the live TUNING object", () => {
  const saved = { ...TUNING };
  try {
    applyTuning({ hillScale: 321, bogus: 9 });
    assert.equal(TUNING.hillScale, 321);
    assert.equal("bogus" in TUNING, false);
  } finally {
    Object.assign(TUNING, saved); // don't leak to other tests in this file
  }
});

test("every field has a param and clamp range", () => {
  for (const f of TUNING_FIELDS) {
    assert.ok(f.param && f.key in TUNING, `field ${f.key} malformed`);
    assert.ok(f.max > f.min);
  }
});

test("drawTuningHud renders the readout without throwing", () => {
  const calls = [];
  const g = new Proxy({}, {
    get: (_, k) => (["fillStyle", "font", "textAlign", "globalAlpha"].includes(k) ? "" : (...a) => calls.push(k)),
    set: () => true,
  });
  drawTuningHud(g, { w: 960, h: 540 });
  assert.ok(calls.includes("fillText"));
  assert.ok(calls.includes("fillRect"));
});
