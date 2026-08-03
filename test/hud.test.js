import { test } from "node:test";
import assert from "node:assert/strict";
import { drawHud, displayTime, displaySpeed } from "../client/hud.js";
import { TICK_HZ } from "../shared/constants.js";

test("displayTime rounds up to whole seconds", () => {
  assert.equal(displayTime(TICK_HZ * 3), 3);
  assert.equal(displayTime(TICK_HZ * 3 - 1), 3); // ceil
  assert.equal(displayTime(0), 0);
});

function recorder() {
  const texts = [];
  const g = new Proxy({}, {
    get: (_, k) => {
      if (["fillStyle", "font", "textAlign", "textBaseline"].includes(k)) return "";
      if (k === "fillText") return (t) => texts.push(String(t));
      return () => {};
    },
    set: () => true,
  });
  return { g, texts };
}

test("drawHud renders the big time number and a SPEED readout", () => {
  const { g, texts } = recorder();
  const seat = { speed: 500, timerTicks: TICK_HZ * 42, finishTicks: -1, timedOut: false };
  drawHud(g, { w: 960, h: 540 }, { seats: [seat] });
  assert.ok(texts.includes("42"), "big time number drawn");
  assert.ok(texts.some((t) => t.startsWith("SPEED")), "speed drawn");
  assert.ok(texts.includes("TIME"), "TIME label drawn");
});

test("drawHud shows FINISH / TIME UP states", () => {
  const fin = recorder();
  drawHud(fin.g, { w: 960, h: 540 }, { seats: [{ speed: 0, timerTicks: 100, finishTicks: 5, timedOut: false }] });
  assert.ok(fin.texts.includes("FINISH"));

  const out = recorder();
  drawHud(out.g, { w: 960, h: 540 }, { seats: [{ speed: 0, timerTicks: 0, finishTicks: -1, timedOut: true }] });
  assert.ok(out.texts.includes("TIME UP"));
});
