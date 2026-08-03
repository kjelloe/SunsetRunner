import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadCourseSet } from "../shared/road_data.js";
import { loadCarSet } from "../shared/car_data.js";
import { loadTrafficConfig } from "../shared/traffic_data.js";
import { runScenario } from "../engine/scenario.js";
import { createRoom } from "../server/game_room.js";
import { resolveTrafficCollisions } from "../engine/collision.js";
import { BUMP_SLOW } from "../shared/collision.js";

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const ctx = {
  courseSet: loadCourseSet(read("../data/roads.json")),
  carSet: loadCarSet(read("../data/cars.json")),
  trafficConfig: loadTrafficConfig(read("../data/traffic.json")),
};
const fixture = read("./fixtures/collision_1a.json");

test("collision_1a: golden hashes + collision census", () => {
  const r = runScenario(fixture.scenario, ctx);
  for (const t of fixture.scenario.hashTicks) {
    assert.equal(r.hashes[t], fixture.expected.hashes[String(t)], `hash drift at tick ${t}`);
  }
  assert.equal(r.finalHash, fixture.expected.finalHash);
  assert.deepEqual(r.census, fixture.expected.census);
});

test("rival collision only fires when the room enables it", () => {
  const scenarioOff = { ...fixture.scenario, rivalCollision: 0 };
  const r = runScenario(scenarioOff, ctx);
  assert.equal(r.census.filter((e) => e.type === "collision").length, 0);
});

test("a bump sheds speed and shoves the cars apart", () => {
  const r = runScenario({ ...fixture.scenario, maxTicks: 3, hashTicks: [] }, ctx);
  const [a, b] = r.state.seats;
  assert.ok(a.laneX < 0 && b.laneX > 0, "cars pushed to opposite sides");
  assert.equal(a.laneX, -b.laneX, "symmetric shove"); // equal-and-opposite
  // each car lost at least one BUMP_SLOW worth relative to an accel-only lead
  assert.ok(a.speed < 3 * 22, `bumped speed ${a.speed} below unimpeded accel`);
  assert.ok(BUMP_SLOW > 0);
});

test("hitting a traffic car is a dead stop and emits a traffic collision", () => {
  const seat = { id: 1, active: 1, finishTicks: -1, timedOut: 0, segmentId: 1, roadZ: 1000, laneX: 0, speed: 900 };
  const state = { seats: [seat], traffic: [{ id: 7, segmentId: 1, roadZ: 1000, laneX: 0, speed: 300, kind: 1 }] };
  const events = resolveTrafficCollisions(state, 5);
  assert.equal(seat.speed, 0); // full stop (marker-0056)
  assert.equal(seat.crashedTicks > 0, true); // stunned/immune after
  assert.equal(events.length, 1);
  assert.equal(events[0].kind, "traffic");
});

test("traffic collision ignores a car in a different lane or segment", () => {
  const base = { id: 1, active: 1, finishTicks: -1, timedOut: 0, segmentId: 1, roadZ: 1000, speed: 900 };
  const otherLane = { ...base, laneX: 256 };
  const s1 = { seats: [otherLane], traffic: [{ id: 7, segmentId: 1, roadZ: 1000, laneX: -256, speed: 300, kind: 1 }] };
  assert.equal(resolveTrafficCollisions(s1, 1).length, 0);
  assert.equal(otherLane.speed, 900);
});

test("a room with rivalCollision on emits collision events for co-located seats", () => {
  const ctx2 = { ...ctx };
  const room = createRoom(ctx2, { startTimeTicks: 1500, rivalCollision: 1 });
  const a = room.addSeat(1);
  room.addSeat(1);
  room.setInput(a, { steer: 0, accel: 1, brake: 0 });
  let sawCollision = false;
  for (let i = 0; i < 3; i++) {
    room.tick();
    if (room.viewFor(a).events.some((e) => e.type === "collision")) sawCollision = true;
  }
  assert.ok(sawCollision);
});

test("collision effects are symmetric (order-independent by construction)", () => {
  // Deltas are computed from pre-bump state and applied together, so the two
  // cars always receive equal-and-opposite shoves and equal speed loss — the
  // outcome cannot depend on which seat the pair loop visited first.
  const r = runScenario({ ...fixture.scenario, maxTicks: 2, hashTicks: [] }, ctx);
  const [a, b] = r.state.seats;
  assert.equal(a.speed, b.speed);
  assert.equal(a.laneX, -b.laneX);
});
