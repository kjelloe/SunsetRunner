import { test } from "node:test";
import assert from "node:assert/strict";
import { createCheckpointStandings } from "../client/checkpoint_standings.js";

// Minimal courseSet: segment 5 is a checkpoint, 4 is not.
const courseSet = {
  segmentsById: new Map([
    [4, { checkpointTicks: 0 }],
    [5, { checkpointTicks: 60 }],
  ]),
};

const self = (seg) => ({ id: 1, name: "You", carId: 1, segmentId: seg, isSelf: true });
const rival = (seg) => ({ id: 2, name: "Zoe", carId: 2, segmentId: seg, isSelf: false });

test("board fires when self crosses; gaps are arrival-time behind the leader", () => {
  const cs = createCheckpointStandings(courseSet);
  cs.update(500, [self(4), rival(5)]);   // rival reaches the checkpoint first, self not yet
  assert.equal(cs.active(500), null);    // self hasn't crossed -> no board
  cs.update(1000, [self(5), rival(5)]);  // self crosses 500ms later
  const b = cs.active(1000);
  assert.ok(b, "board active after self crosses");
  assert.deepEqual(b.entries.map((e) => [e.rank, e.name]), [[1, "Zoe"], [2, "You"]]);
  assert.equal(b.entries[0].gap, 0);        // leader
  assert.ok(Math.abs(b.entries[1].gap - 0.5) < 1e-9); // 500ms behind
});

test("board fades out and expires by ~5s", () => {
  const cs = createCheckpointStandings(courseSet);
  cs.update(0, [self(4)]);                          // start outside the checkpoint
  cs.update(0, [self(5)]);                          // then cross in -> board fires
  assert.equal(cs.active(1000).alpha, 1);          // solid before the fade window
  const mid = cs.active(4500).alpha;               // fading in the last second
  assert.ok(mid > 0 && mid < 1, `fading alpha ${mid}`);
  assert.equal(cs.active(5000), null);             // expired
});

test("no board for the checkpoint you START inside (a stage-1 board makes no sense)", () => {
  const cs = createCheckpointStandings(courseSet);
  cs.update(0, [self(5)]);                          // spawned already in the checkpoint
  assert.equal(cs.active(0), null);                // suppressed
  assert.equal(cs.active(100), null);              // still nothing a moment later
});

test("a non-checkpoint segment never records or fires", () => {
  const cs = createCheckpointStandings(courseSet);
  cs.update(100, [self(4), rival(4)]);
  assert.equal(cs.active(100), null);
});
