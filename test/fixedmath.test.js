import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CELL_SIZE, clampI32, floorDivI32, truncDivI32, absI32,
  cellToWorld, worldToCellFloor, mulFixed, divFixed,
} from "../shared/fixedmath.js";
import { LEFT_LANE, CENTER_LANE, RIGHT_LANE, LANE_WIDTH } from "../shared/constants.js";

test("clampI32 bounds and integerizes", () => {
  assert.equal(clampI32(5, 0, 10), 5);
  assert.equal(clampI32(-3, 0, 10), 0);
  assert.equal(clampI32(99, 0, 10), 10);
});

test("truncDivI32 rounds toward zero — symmetric for +/-", () => {
  assert.equal(truncDivI32(7, 2), 3);
  assert.equal(truncDivI32(-7, 2), -3);
  assert.equal(floorDivI32(-7, 2), -4); // contrast: floor rounds toward -inf
});

test("absI32", () => {
  assert.equal(absI32(-256), 256);
  assert.equal(absI32(256), 256);
});

test("cellToWorld / worldToCellFloor round-trip through the cell", () => {
  assert.equal(cellToWorld(0), CELL_SIZE >> 1);
  assert.equal(worldToCellFloor(cellToWorld(3)), 3);
});

test("mulFixed / divFixed are inverse at the 256 scale", () => {
  // 2.0 (512) * 3.0 (768) = 6.0 (1536)
  assert.equal(mulFixed(512, 768), 1536);
  assert.equal(divFixed(1536, 768), 512);
});

test("lane constants are symmetric about centre", () => {
  assert.equal(CENTER_LANE, 0);
  assert.equal(LEFT_LANE, -LANE_WIDTH);
  assert.equal(RIGHT_LANE, LANE_WIDTH);
  assert.equal(LEFT_LANE + RIGHT_LANE, 0);
});
