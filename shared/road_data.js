// shared/road_data.js — course/segment loading + validation.
// Pure and dependency-free: it takes ALREADY-PARSED JSON (the fs read happens
// at the edge — server/client/test), matching the parse-at-edge discipline the
// Luau twin needs. Integer-only; a course is a graph of pseudo-3D road segments.
// See specs/game-design.md §8.

import { FORK_LEFT, FORK_RIGHT } from "./constants.js";

function assertInt(v, label) {
  if (!Number.isInteger(v)) throw new TypeError(`${label} must be an integer: ${v}`);
  return v;
}

function assertIntArray(v, label) {
  if (!Array.isArray(v)) throw new TypeError(`${label} must be an array: ${v}`);
  for (let i = 0; i < v.length; i++) assertInt(v[i], `${label}[${i}]`);
  return v;
}

function isFork(seg) {
  return seg.forkLeft >= 0 || seg.forkRight >= 0;
}

// Validate a parsed roads.json and return an indexed, frozen course set.
// Throws on any structural or referential-integrity error.
export function loadCourseSet(json) {
  if (!json || !Array.isArray(json.courses) || !Array.isArray(json.segments)) {
    throw new TypeError("road data must have arrays: courses, segments");
  }

  const segmentsById = new Map();
  for (const seg of json.segments) {
    assertInt(seg.id, "segment.id");
    if (seg.id <= 0) throw new RangeError(`segment.id must be positive: ${seg.id}`);
    if (segmentsById.has(seg.id)) throw new RangeError(`duplicate segment.id: ${seg.id}`);
    if (assertInt(seg.stripCount, "segment.stripCount") <= 0) {
      throw new RangeError(`segment ${seg.id} stripCount must be positive`);
    }
    if (assertInt(seg.checkpointTicks, "segment.checkpointTicks") < 0) {
      throw new RangeError(`segment ${seg.id} checkpointTicks must be >= 0`);
    }
    assertInt(seg.next, "segment.next");
    assertInt(seg.forkLeft, "segment.forkLeft");
    assertInt(seg.forkRight, "segment.forkRight");
    assertIntArray(seg.curveProfile, "segment.curveProfile");
    assertIntArray(seg.hillProfile, "segment.hillProfile");
    if (assertInt(seg.trafficSeed, "segment.trafficSeed") < 0) {
      throw new RangeError(`segment ${seg.id} trafficSeed must be >= 0`);
    }
    if (assertInt(seg.scenerySet, "segment.scenerySet") < 0) {
      throw new RangeError(`segment ${seg.id} scenerySet must be >= 0`);
    }
    // Optional authoring metadata (specs/48) — display/build only, NOT hashed.
    if (seg.nameKey !== undefined && typeof seg.nameKey !== "string") {
      throw new TypeError(`segment ${seg.id} nameKey must be a string`);
    }
    if (seg.seconds !== undefined && (!Number.isFinite(seg.seconds) || seg.seconds <= 0)) {
      throw new RangeError(`segment ${seg.id} seconds must be positive`);
    }
    // Optional boost pads (marker-0097): fixed road markers read from data, not
    // hashed state. Each is { roadZ, laneX } in the same integer units as a seat.
    if (seg.boostPads !== undefined) {
      if (!Array.isArray(seg.boostPads)) throw new TypeError(`segment ${seg.id} boostPads must be an array`);
      for (let i = 0; i < seg.boostPads.length; i++) {
        const p = seg.boostPads[i];
        assertInt(p.roadZ, `segment ${seg.id} boostPads[${i}].roadZ`);
        assertInt(p.laneX, `segment ${seg.id} boostPads[${i}].laneX`);
      }
    }
    segmentsById.set(seg.id, seg);
  }

  const resolves = (id) => id === -1 || segmentsById.has(id);

  for (const seg of json.segments) {
    // A fork segment routes via forkLeft/forkRight (both required); a linear
    // segment routes via next. The two are mutually exclusive so routing is
    // unambiguous in the reducer.
    if (isFork(seg)) {
      if (seg.forkLeft < 0 || seg.forkRight < 0) {
        throw new RangeError(`segment ${seg.id} is a fork but is missing a branch`);
      }
      if (seg.next !== -1) {
        throw new RangeError(`fork segment ${seg.id} must have next = -1`);
      }
      if (!resolves(seg.forkLeft)) throw new RangeError(`segment ${seg.id} forkLeft -> unknown ${seg.forkLeft}`);
      if (!resolves(seg.forkRight)) throw new RangeError(`segment ${seg.id} forkRight -> unknown ${seg.forkRight}`);
    } else if (!resolves(seg.next)) {
      throw new RangeError(`segment ${seg.id} next -> unknown ${seg.next}`);
    }
  }

  const coursesById = new Map();
  for (const course of json.courses) {
    assertInt(course.id, "course.id");
    if (course.id <= 0) throw new RangeError(`course.id must be positive: ${course.id}`);
    if (coursesById.has(course.id)) throw new RangeError(`duplicate course.id: ${course.id}`);
    if (typeof course.nameKey !== "string") throw new TypeError(`course ${course.id} nameKey must be a string`);
    assertInt(course.startSegment, "course.startSegment");
    if (!segmentsById.has(course.startSegment)) {
      throw new RangeError(`course ${course.id} startSegment -> unknown ${course.startSegment}`);
    }
    coursesById.set(course.id, course);
  }

  return { courses: json.courses, segments: json.segments, coursesById, segmentsById };
}

export function getCourse(courseSet, courseId) {
  const course = courseSet.coursesById.get(courseId);
  if (!course) throw new RangeError(`unknown course: ${courseId}`);
  return course;
}

export function getSegment(courseSet, segmentId) {
  const seg = courseSet.segmentsById.get(segmentId);
  if (!seg) throw new RangeError(`unknown segment: ${segmentId}`);
  return seg;
}

// 1-based stage number = BFS hop distance from the course start to `segmentId`
// (handles forks). -1 for a finished / invalid segment. Shared by the HUD, the
// race summary, and the server leaderboard.
export function stageIndex(courseSet, startSegment, segmentId) {
  if (segmentId < 0) return -1;
  const dist = new Map([[startSegment, 1]]);
  const q = [startSegment];
  while (q.length) {
    const id = q.shift();
    if (id === segmentId) return dist.get(id);
    const seg = courseSet.segmentsById.get(id);
    if (!seg) continue;
    for (const e of [seg.next, seg.forkLeft, seg.forkRight]) {
      if (e > 0 && !dist.has(e)) { dist.set(e, dist.get(id) + 1); q.push(e); }
    }
  }
  return dist.get(segmentId) ?? -1;
}

// Resolve the segment a car advances into. For a fork, `choice` selects the
// branch (FORK_LEFT / FORK_RIGHT); with no choice a fork defaults LEFT
// deterministically. For a linear segment `choice` is ignored. Returns the next
// segmentId, or -1 for the finish.
export function nextSegment(courseSet, segmentId, choice = 0) {
  const seg = getSegment(courseSet, segmentId);
  if (!isFork(seg)) return seg.next;
  if (choice === FORK_RIGHT) return seg.forkRight;
  return seg.forkLeft; // FORK_LEFT and the no-choice default
}
