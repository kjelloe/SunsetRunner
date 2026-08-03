import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSegmentHazards, advanceHazards } from "../engine/traffic.js";
import { resolveHazardCollisions } from "../engine/collision.js";
import { HAZARD_COUNT, HAZARD_SKIER, HAZARD_SNOWMOBILE, HAZARD_DESPAWN, HAZARD_SPEED } from "../shared/collision.js";

test("snow terrain seeds crossing hazards (alpine=skier, mountain=snowmobile)", () => {
  const alpine = { seed: 1, hazards: [], nextHazardId: 1 };
  spawnSegmentHazards(alpine, { id: 200, scenerySet: 11, trafficSeed: 500 }, 100000);
  assert.equal(alpine.hazards.length, HAZARD_COUNT);
  assert.equal(alpine.hazards[0].kind, HAZARD_SKIER);

  const mountain = { seed: 1, hazards: [], nextHazardId: 1 };
  spawnSegmentHazards(mountain, { id: 201, scenerySet: 10, trafficSeed: 501 }, 100000);
  assert.equal(mountain.hazards[0].kind, HAZARD_SNOWMOBILE);
});

test("non-snow terrain seeds no hazards (goldens unaffected)", () => {
  const beach = { seed: 1, hazards: [], nextHazardId: 1 };
  spawnSegmentHazards(beach, { id: 5, scenerySet: 2, trafficSeed: 5 }, 100000);
  assert.equal(beach.hazards.length, 0);
});

test("hazard spawn is deterministic for a segment", () => {
  const a = { seed: 7, hazards: [], nextHazardId: 1 };
  const b = { seed: 7, hazards: [], nextHazardId: 1 };
  spawnSegmentHazards(a, { id: 9, scenerySet: 11, trafficSeed: 42 }, 50000);
  spawnSegmentHazards(b, { id: 9, scenerySet: 11, trafficSeed: 42 }, 50000);
  assert.deepEqual(a.hazards, b.hazards);
});

test("advanceHazards slides laterally and despawns past the far shoulder", () => {
  const state = { hazards: [{ id: 1, segmentId: 1, roadZ: 0, laneX: 0, vx: HAZARD_SPEED, kind: 4 }] };
  advanceHazards(state);
  assert.equal(state.hazards[0].laneX, HAZARD_SPEED);

  const gone = { hazards: [{ id: 1, segmentId: 1, roadZ: 0, laneX: HAZARD_DESPAWN, vx: HAZARD_SPEED, kind: 4 }] };
  advanceHazards(gone);
  assert.equal(gone.hazards.length, 0);
});

test("hitting a hazard is a dead stop + stun", () => {
  const seat = { id: 1, active: 1, finishTicks: -1, timedOut: 0, segmentId: 1, roadZ: 1000, laneX: 0, speed: 900, crashedTicks: 0 };
  const state = { seats: [seat], hazards: [{ id: 1, segmentId: 1, roadZ: 1000, laneX: 0, vx: 0, kind: 4 }] };
  const ev = resolveHazardCollisions(state, 5);
  assert.equal(seat.speed, 0);
  assert.ok(seat.crashedTicks > 0);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].kind, "hazard");
});
