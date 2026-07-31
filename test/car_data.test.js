import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadCarSet, getCar } from "../shared/car_data.js";

const carsJson = JSON.parse(readFileSync(new URL("../data/cars.json", import.meta.url)));

test("data/cars.json loads red_sprint", () => {
  const cs = loadCarSet(carsJson);
  const car = getCar(cs, 1);
  assert.equal(car.nameKey, "car.red_sprint");
  assert.equal(car.maxSpeed, 2400);
});

test("rejects a non-positive maxSpeed", () => {
  assert.throws(() => loadCarSet({ cars: [{
    id: 1, nameKey: "c", maxSpeed: 0, accel: 1, brake: 1,
    offroadDrag: 1, steerLow: 1, steerHigh: 1, driftRecovery: 1,
  }] }), /maxSpeed must be positive/);
});

test("rejects a float stat", () => {
  assert.throws(() => loadCarSet({ cars: [{
    id: 1, nameKey: "c", maxSpeed: 100, accel: 1.5, brake: 1,
    offroadDrag: 1, steerLow: 1, steerHigh: 1, driftRecovery: 1,
  }] }), /accel must be an integer/);
});

test("rejects duplicate car ids", () => {
  const one = {
    nameKey: "c", maxSpeed: 100, accel: 1, brake: 1,
    offroadDrag: 1, steerLow: 1, steerHigh: 1, driftRecovery: 1,
  };
  assert.throws(() => loadCarSet({ cars: [{ id: 1, ...one }, { id: 1, ...one }] }), /duplicate car.id/);
});
