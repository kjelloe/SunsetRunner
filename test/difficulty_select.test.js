import { test } from "node:test";
import assert from "node:assert/strict";
import {
  difficultyFromParams, createDifficultySelect, difficultyTouchZone, drawDifficultySelect,
} from "../client/difficulty_select.js";
import { DIFFICULTY } from "../shared/constants.js";

test("difficultyFromParams: valid ?diff skips picker, else medium default", () => {
  assert.deepEqual(difficultyFromParams(new URLSearchParams("diff=hard")), { level: "hard", timeScale: DIFFICULTY.hard, fromUrl: true });
  assert.deepEqual(difficultyFromParams(new URLSearchParams("")), { level: "medium", timeScale: DIFFICULTY.medium, fromUrl: false });
  assert.deepEqual(difficultyFromParams(new URLSearchParams("diff=bogus")), { level: "medium", timeScale: DIFFICULTY.medium, fromUrl: false });
});

test("cursor cycles and reports the right timeScale", () => {
  const sel = createDifficultySelect("medium");
  assert.equal(sel.level, "medium");
  assert.equal(sel.timeScale, 100);
  sel.left(); // -> easy
  assert.equal(sel.level, "easy");
  assert.equal(sel.timeScale, DIFFICULTY.easy);
  sel.right(); sel.right(); // medium -> hard
  assert.equal(sel.level, "hard");
  assert.equal(sel.timeScale, DIFFICULTY.hard);
});

test("setIndex + touch zone select a button by column", () => {
  const view = { w: 900, h: 540 };
  assert.equal(difficultyTouchZone(view, 100), 0);
  assert.equal(difficultyTouchZone(view, 450), 1);
  assert.equal(difficultyTouchZone(view, 800), 2);
  const sel = createDifficultySelect("medium");
  sel.setIndex(2);
  assert.equal(sel.level, "hard");
});

test("handle returns confirm; draw renders without throwing", () => {
  const sel = createDifficultySelect("easy");
  assert.equal(sel.handle("confirm"), "confirm");
  const calls = [];
  const g = new Proxy({}, {
    get: (_, k) => (["fillStyle", "strokeStyle", "lineWidth", "font", "textAlign", "textBaseline"].includes(k) ? "" : (...a) => calls.push(k)),
    set: () => true,
  });
  drawDifficultySelect(g, { w: 960, h: 540 }, sel);
  assert.ok(calls.includes("fillText"));
  assert.ok(calls.includes("fillRect"));
});
