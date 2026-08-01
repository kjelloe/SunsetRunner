import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadCourseSet } from "../shared/road_data.js";
import { loadCarSet } from "../shared/car_data.js";
import { loadTrafficConfig } from "../shared/traffic_data.js";
import { parseMessage, C2S } from "../shared/protocol.js";
import { installKeyboard, readForkChoice } from "../client/input.js";
import { createLocalSession } from "../client/session_local.js";
import { createRoom } from "../server/game_room.js";
import { hashSnapshot } from "../engine/snapshot.js";

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const ctx = {
  courseSet: loadCourseSet(read("../data/roads.json")),
  carSet: loadCarSet(read("../data/cars.json")),
  trafficConfig: loadTrafficConfig(read("../data/traffic.json")),
};

test("protocol accepts a fork message and rejects a bad direction", () => {
  assert.deepEqual(parseMessage(JSON.stringify({ type: C2S.FORK, choice: -1 })), { ok: true, msg: { type: C2S.FORK, choice: -1 } });
  assert.equal(parseMessage(JSON.stringify({ type: C2S.FORK, choice: 0 })).ok, false);
});

test("keyboard queues edge-triggered fork presses (Q/E)", () => {
  const handlers = {};
  installKeyboard({ addEventListener: (ev, fn) => { handlers[ev] = fn; } });
  while (readForkChoice() !== 0) {} // drain any residue from other tests
  handlers.keydown({ code: "KeyE" });
  handlers.keydown({ code: "KeyE" }); // held: no repeat until keyup
  handlers.keyup({ code: "KeyE" });
  handlers.keydown({ code: "KeyQ" });
  assert.equal(readForkChoice(), 1);  // first E press
  assert.equal(readForkChoice(), -1); // Q press
  assert.equal(readForkChoice(), 0);  // queue drained (E-repeat was suppressed)
});

test("local session fork choice routes the car (left != right)", () => {
  function run(choice) {
    const s = createLocalSession(ctx.courseSet, ctx.carSet, { seed: 12345, courseId: 2, startTimeTicks: 2000, trafficConfig: ctx.trafficConfig });
    s.setInput({ steer: 0, accel: 1, brake: 0 });
    s.setForkChoice(choice);
    for (let i = 0; i < 300; i++) s.tick();
    return hashSnapshot(s.getState());
  }
  assert.notEqual(run(-1), run(1));
});

test("server room applies a fork choice", () => {
  const room = createRoom(ctx, { courseId: 2, startTimeTicks: 2000 });
  const seatId = room.addSeat(1);
  room.setForkChoice(seatId, 1);
  assert.equal(room.getState().seats[0].forkChoice, 1);
  const replay = room.dumpReplay();
  assert.equal(replay.scenario.forkChoices.length, 1);
});
