import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadCourseSet, getCourse, getSegment, nextSegment } from "../shared/road_data.js";
import { ROAD_UNIT, TICK_HZ, FORK_LEFT, FORK_RIGHT } from "../shared/constants.js";

const roads = JSON.parse(readFileSync(new URL("../data/roads.json", import.meta.url)));
const cs = loadCourseSet(roads);
const gen = roads.segments.filter((s) => s.id >= 100); // grand_tour segments

test("grand_tour (course 4) is present and large", () => {
  const c = getCourse(cs, 4);
  assert.equal(c.nameKey, "course.grand_tour");
  assert.equal(c.startSegment, 100);
  assert.ok(gen.length >= 30, `expected >=30 segments, got ${gen.length}`);
});

test("every generated segment carries authoring metadata and a real biome", () => {
  for (const s of gen) {
    assert.equal(typeof s.nameKey, "string");
    assert.ok(s.seconds >= 60 && s.seconds <= 250, `seg ${s.id} seconds ${s.seconds} out of range`);
    // stripCount should reflect ~seconds at the reference cruise (2000).
    const secs = (s.stripCount * ROAD_UNIT) / (2000 * TICK_HZ);
    assert.ok(secs >= 55 && secs <= 255, `seg ${s.id} derived ${secs.toFixed(0)}s off`);
    assert.ok(s.scenerySet >= 1 && s.scenerySet <= 11);
  }
});

test("generated forks set both branches, no next, and rejoin", () => {
  const forks = gen.filter((s) => s.forkLeft >= 0);
  assert.ok(forks.length >= 3, `expected forks, got ${forks.length}`);
  for (const f of forks) {
    assert.equal(f.next, -1);
    const l = nextSegment(cs, f.id, FORK_LEFT);
    const r = nextSegment(cs, f.id, FORK_RIGHT);
    assert.ok(l > 0 && r > 0);
    // both branches lead to the same rejoin segment (or both to finish)
    assert.equal(getSegment(cs, l).next, getSegment(cs, r).next);
  }
});

test("the whole main route is walkable to a finish", () => {
  let id = getCourse(cs, 4).startSegment;
  let hops = 0;
  while (id !== -1 && hops < 200) {
    const seg = getSegment(cs, id);
    id = seg.forkLeft >= 0 ? nextSegment(cs, id, FORK_LEFT) : seg.next;
    hops++;
  }
  assert.equal(id, -1, "route reaches a finish");
  assert.ok(hops >= 25, `route length ${hops}`);
});

test("no generated leg is a straight line (playtest rule)", () => {
  for (const s of gen) {
    const allZero = s.curveProfile.every((v) => v === 0);
    assert.equal(allZero, false, `segment ${s.id} is a straight line`);
  }
});

test("stage 1 showcases a corner and a hill", () => {
  const first = gen.find((s) => s.id === 100);
  assert.ok(first.curveProfile.some((v) => v !== 0), "stage 1 has a curve");
  assert.ok(first.hillProfile.some((v) => v !== 0), "stage 1 has a hill");
});

test("the tour visits many distinct terrains", () => {
  const biomes = new Set(gen.map((s) => s.scenerySet));
  assert.ok(biomes.size >= 8, `expected many terrains, got ${biomes.size}`);
});
