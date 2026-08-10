import { test } from "node:test";
import assert from "node:assert/strict";
import { computeBufferSize } from "../client/viewport.js";
import { installWakeLock } from "../client/wakelock.js";

test("computeBufferSize scales by DPR and keeps 16:9", () => {
  const one = computeBufferSize(960, 540, 1);
  assert.deepEqual(one, { w: 960, h: 540 });
  const retina = computeBufferSize(600, 337.5, 2); // phone at 600 CSS px, DPR 2
  assert.equal(retina.w, 1200);
  assert.equal(retina.h, Math.round((1200 * 9) / 16));
});

test("computeBufferSize caps the buffer (no giant 4K frames) and has a floor", () => {
  const capped = computeBufferSize(1600, 900, 3); // 4800 -> capped
  assert.equal(capped.w, 1920);
  assert.equal(capped.h, 1080);
  const tiny = computeBufferSize(120, 67, 1);
  assert.equal(tiny.w, 320); // MIN_W floor
});

test("computeBufferSize caps EFFECTIVE DPR at 2 (mobile fill-cost win)", () => {
  // A 390-CSS-px phone at DPR 3: without the cap this is 1170px (quadratic
  // fill); clamped to DPR 2 it is 780px — ~2.25x fewer pixels to fill.
  const phone = computeBufferSize(390, 219, 3);
  assert.equal(phone.w, 780);
  assert.equal(phone.h, Math.round((780 * 9) / 16));
  // DPR 1 and 2 are untouched by the cap.
  assert.equal(computeBufferSize(390, 219, 2).w, 780);
  assert.equal(computeBufferSize(390, 219, 1).w, 390);
  // The cap is overridable (kept as a param) for callers that want full DPR.
  assert.equal(computeBufferSize(390, 219, 3, 1920, 3).w, 1170);
});

// --- wake lock (injected fakes) ---
function fakeDoc() {
  const handlers = {};
  return {
    visibilityState: "visible",
    addEventListener: (ev, fn) => { (handlers[ev] ||= []).push(fn); },
    fire: (ev) => (handlers[ev] || []).forEach((fn) => fn()),
  };
}

test("wake lock: requests a screen lock when supported", async () => {
  let requests = 0;
  const nav = { wakeLock: { request: async () => { requests++; return { addEventListener() {}, release() {} }; } } };
  const doc = fakeDoc();
  const wl = installWakeLock(nav, doc);
  await Promise.resolve(); await Promise.resolve();
  assert.equal(requests, 1);
  assert.equal(wl.held, true);
});

test("wake lock: re-requests on becoming visible, no-op when unsupported", async () => {
  const nav = { wakeLock: { request: async () => ({ addEventListener() {}, release() {} }) } };
  const doc = fakeDoc();
  const wl = installWakeLock(nav, doc);
  await Promise.resolve();
  wl.release();
  assert.equal(wl.held, false);
  doc.fire("visibilitychange");
  await Promise.resolve(); await Promise.resolve();
  assert.equal(wl.held, true);

  const none = installWakeLock({}, fakeDoc()); // no navigator.wakeLock
  assert.equal(none.held, false);
  none.release(); // must not throw
});
