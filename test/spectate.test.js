import { test } from "node:test";
import assert from "node:assert/strict";
import { drawTimeUpButtons, timeUpTouchZone, drawSpectateOverlay, spectateTouchZone } from "../client/spectate.js";

test("timeUpTouchZone splits into RE-JOIN (left) / SPECTATE (right)", () => {
  const view = { w: 900, h: 540 };
  assert.equal(timeUpTouchZone(view, 100), 0);
  assert.equal(timeUpTouchZone(view, 800), 1);
});

test("spectateTouchZone: prev / rejoin / next by column", () => {
  const view = { w: 900, h: 540 };
  assert.equal(spectateTouchZone(view, 100), "prev");
  assert.equal(spectateTouchZone(view, 450), "rejoin");
  assert.equal(spectateTouchZone(view, 800), "next");
});

function rec() {
  const texts = [];
  const g = new Proxy({}, {
    get: (_, k) => {
      if (["fillStyle", "strokeStyle", "lineWidth", "font", "textAlign", "textBaseline"].includes(k)) return "";
      if (k === "fillText") return (t) => texts.push(String(t));
      return () => {};
    },
    set: () => true,
  });
  return { g, texts };
}

test("draws the two buttons and the spectate overlay", () => {
  const a = rec();
  drawTimeUpButtons(a.g, { w: 960, h: 540 }, 1);
  assert.ok(a.texts.includes("RE-JOIN") && a.texts.includes("SPECTATE"));
  const b = rec();
  drawSpectateOverlay(b.g, { w: 960, h: 540 }, "Ada", 0, 3);
  assert.ok(b.texts.some((t) => t.includes("Ada")));
  assert.ok(b.texts.some((t) => t.includes("1/3")));
});
