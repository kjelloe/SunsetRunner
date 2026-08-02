import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadCarSet } from "../shared/car_data.js";
import {
  carDisplayName, carChoiceFromParams, createCarSelect, carSelectTouchZone, drawCarSelect,
} from "../client/car_select.js";
import { installKeyboard, readMenuNav } from "../client/input.js";

const carSet = loadCarSet(JSON.parse(readFileSync(new URL("../data/cars.json", import.meta.url))));

test("carDisplayName humanises a nameKey", () => {
  assert.equal(carDisplayName("car.red_sprint"), "Red Sprint");
  assert.equal(carDisplayName("car.green_machine"), "Green Machine");
});

test("carChoiceFromParams: valid ?car skips overlay, invalid/absent shows it", () => {
  assert.deepEqual(carChoiceFromParams(new URLSearchParams("car=3"), carSet), { carId: 3, fromUrl: true });
  assert.deepEqual(carChoiceFromParams(new URLSearchParams("car=99"), carSet), { carId: carSet.cars[0].id, fromUrl: false });
  assert.deepEqual(carChoiceFromParams(new URLSearchParams(""), carSet), { carId: carSet.cars[0].id, fromUrl: false });
});

test("createCarSelect: cursor wraps and confirm returns the carId", () => {
  const sel = createCarSelect(carSet, 1);
  assert.equal(sel.carId, 1);
  sel.left(); // wrap to last
  assert.equal(sel.carId, carSet.cars[carSet.cars.length - 1].id);
  sel.right(); // back to first
  assert.equal(sel.carId, 1);
  assert.equal(sel.handle("right"), null);
  assert.equal(sel.carId, 2);
  assert.equal(sel.handle("confirm"), "confirm");
});

test("createCarSelect starts on the given carId", () => {
  const sel = createCarSelect(carSet, 3);
  assert.equal(sel.carId, 3);
});

test("carSelectTouchZone splits the canvas into prev/confirm/next", () => {
  const view = { w: 900, h: 540 };
  assert.equal(carSelectTouchZone(view, 100, 270), "left");
  assert.equal(carSelectTouchZone(view, 450, 270), "confirm");
  assert.equal(carSelectTouchZone(view, 800, 270), "right");
});

test("drawCarSelect renders without throwing under a fake ctx", () => {
  const calls = [];
  const g = new Proxy({}, {
    get: (_, k) => (["fillStyle", "font", "textAlign", "textBaseline"].includes(k) ? "" : (...a) => calls.push(k)),
    set: () => true,
  });
  drawCarSelect(g, { w: 960, h: 540 }, createCarSelect(carSet, 2));
  assert.ok(calls.includes("fillText"));
  assert.ok(calls.includes("fillRect"));
});

test("readMenuNav yields edge-triggered nav events from the keyboard", () => {
  const handlers = {};
  const target = { addEventListener: (t, fn) => { handlers[t] = fn; } };
  installKeyboard(target);
  const down = (code) => handlers.keydown({ code, preventDefault() {} });
  const up = (code) => handlers.keyup({ code });
  while (readMenuNav() !== null) {} // drain anything prior
  down("ArrowRight"); up("ArrowRight");
  down("ArrowLeft"); up("ArrowLeft");
  down("Enter");
  assert.equal(readMenuNav(), "right");
  assert.equal(readMenuNav(), "left");
  assert.equal(readMenuNav(), "confirm");
  assert.equal(readMenuNav(), null);
});
