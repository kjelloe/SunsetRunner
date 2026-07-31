import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  loadCourseSet, getCourse, getSegment, nextSegment,
} from "../shared/road_data.js";
import { FORK_LEFT, FORK_RIGHT } from "../shared/constants.js";
import { createByteWriter, computeFnv1a64, hashToHex64 } from "../shared/canonical.js";

const roadsJson = JSON.parse(
  readFileSync(new URL("../data/roads.json", import.meta.url))
);

function baseSegment(over = {}) {
  return {
    id: 1, stripCount: 100, checkpointTicks: 0, next: -1,
    forkLeft: -1, forkRight: -1, curveProfile: [0], hillProfile: [0],
    trafficSeed: 0, scenerySet: 0, ...over,
  };
}

test("data/roads.json loads and indexes the sunset_coast course", () => {
  const cs = loadCourseSet(roadsJson);
  const course = getCourse(cs, 1);
  assert.equal(course.nameKey, "course.sunset_coast");
  assert.equal(course.startSegment, 1);
  assert.equal(cs.segmentsById.size, 3);
});

test("linear segments chain start -> 2 -> 3 -> finish", () => {
  const cs = loadCourseSet(roadsJson);
  assert.equal(nextSegment(cs, 1), 2);
  assert.equal(nextSegment(cs, 2), 3);
  assert.equal(nextSegment(cs, 3), -1); // finish
});

test("checkpoint lives on segment 2", () => {
  const cs = loadCourseSet(roadsJson);
  assert.equal(getSegment(cs, 2).checkpointTicks, 600);
  assert.equal(getSegment(cs, 1).checkpointTicks, 0);
});

test("fork routing honours choice and defaults left", () => {
  const cs = loadCourseSet({
    courses: [{ id: 1, nameKey: "course.t", startSegment: 1 }],
    segments: [
      baseSegment({ id: 1, next: -1, forkLeft: 2, forkRight: 3 }),
      baseSegment({ id: 2 }),
      baseSegment({ id: 3 }),
    ],
  });
  assert.equal(nextSegment(cs, 1, FORK_LEFT), 2);
  assert.equal(nextSegment(cs, 1, FORK_RIGHT), 3);
  assert.equal(nextSegment(cs, 1), 2); // no choice -> deterministic left
});

test("rejects a dangling next reference", () => {
  assert.throws(() => loadCourseSet({
    courses: [{ id: 1, nameKey: "c", startSegment: 1 }],
    segments: [baseSegment({ id: 1, next: 99 })],
  }), /next -> unknown 99/);
});

test("rejects a fork missing a branch", () => {
  assert.throws(() => loadCourseSet({
    courses: [{ id: 1, nameKey: "c", startSegment: 1 }],
    segments: [baseSegment({ id: 1, next: -1, forkLeft: -1, forkRight: 2 }), baseSegment({ id: 2 })],
  }), /missing a branch/);
});

test("rejects a fork segment that also sets next", () => {
  assert.throws(() => loadCourseSet({
    courses: [{ id: 1, nameKey: "c", startSegment: 1 }],
    segments: [baseSegment({ id: 1, next: 2, forkLeft: 2, forkRight: 3 }), baseSegment({ id: 2 }), baseSegment({ id: 3 })],
  }), /must have next = -1/);
});

test("rejects a float in a profile", () => {
  assert.throws(() => loadCourseSet({
    courses: [{ id: 1, nameKey: "c", startSegment: 1 }],
    segments: [baseSegment({ id: 1, curveProfile: [0, 1.5] })],
  }), /must be an integer/);
});

test("rejects an unknown startSegment", () => {
  assert.throws(() => loadCourseSet({
    courses: [{ id: 1, nameKey: "c", startSegment: 7 }],
    segments: [baseSegment({ id: 1 })],
  }), /startSegment -> unknown 7/);
});

// Content-drift pin (§18 doctrine): a fingerprint of data/roads.json so an
// accidental edit to the shipped course can't silently pass. Repin is a
// conscious act — recorded in dev-log.md — never a quiet side effect.
test("sunset_coast course content hash is pinned", () => {
  const cs = loadCourseSet(roadsJson);
  const w = createByteWriter();
  for (const s of cs.segments) {
    for (const f of ["id", "stripCount", "checkpointTicks", "next", "forkLeft", "forkRight", "trafficSeed", "scenerySet"]) {
      w.writeI32LE(s[f]);
    }
    w.writeU16LE(s.curveProfile.length);
    for (const v of s.curveProfile) w.writeI32LE(v);
    w.writeU16LE(s.hillProfile.length);
    for (const v of s.hillProfile) w.writeI32LE(v);
  }
  for (const c of cs.courses) {
    w.writeI32LE(c.id);
    w.writeI32LE(c.startSegment);
    w.writeUtf8U16(c.nameKey);
  }
  const h = computeFnv1a64(w.toBytes());
  assert.equal(hashToHex64(h.hashHi, h.hashLo), "9ce3b09a51d60a88");
});
