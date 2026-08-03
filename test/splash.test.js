import { test } from "node:test";
import assert from "node:assert/strict";
import { drawSplash } from "../client/splash.js";

function recorder() {
  const texts = [];
  const rects = [];
  let fill = "";
  const grad = { addColorStop() {} };
  const g = {
    set fillStyle(v) { fill = v; }, get fillStyle() { return fill; },
    strokeStyle: "", lineWidth: 0, font: "", textAlign: "", textBaseline: "",
    createLinearGradient() { return grad; },
    fillRect(x, y, w) { rects.push({ w, fill }); },
    strokeRect() {}, fillText(t) { texts.push(String(t)); },
    beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {}, arc() {},
  };
  return { g, texts, rects };
}

test("splash draws the title and a LOADING readout", () => {
  const { g, texts } = recorder();
  drawSplash(g, { w: 960, h: 540 }, 0.5);
  assert.ok(texts.includes("SUNSET RUNNER"));
  assert.ok(texts.some((t) => t.startsWith("LOADING")));
});

test("loading percent reflects progress and clamps", () => {
  const a = recorder();
  drawSplash(a.g, { w: 960, h: 540 }, 0.42);
  assert.ok(a.texts.includes("LOADING 42%"));

  const b = recorder();
  drawSplash(b.g, { w: 960, h: 540 }, 5); // clamped
  assert.ok(b.texts.includes("LOADING 100%"));

  const c = recorder();
  drawSplash(c.g, { w: 960, h: 540 }, -1); // clamped
  assert.ok(c.texts.includes("LOADING 0%"));
});

test("the loading-bar fill widens with progress", () => {
  const empty = recorder();
  drawSplash(empty.g, { w: 1000, h: 540 }, 0);
  const full = recorder();
  drawSplash(full.g, { w: 1000, h: 540 }, 1);
  // The orange bar fill (#ff7a3c) is wider at full than at empty.
  const barW = (r) => (r.rects.find((x) => x.fill === "#ff7a3c") || { w: 0 }).w;
  assert.ok(barW(full) > barW(empty));
});
