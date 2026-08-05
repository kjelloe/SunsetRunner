import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMessage, C2S } from "../shared/protocol.js";

test("JOIN carries carId and an optional difficulty", () => {
  const a = parseMessage(JSON.stringify({ type: C2S.JOIN, carId: 2, diff: "hard" }));
  assert.equal(a.ok, true);
  assert.deepEqual(a.msg, { type: C2S.JOIN, carId: 2, diff: "hard", name: null, pid: null });

  const b = parseMessage(JSON.stringify({ type: C2S.JOIN, carId: 1 }));
  assert.equal(b.ok, true);
  assert.equal(b.msg.diff, null); // no difficulty -> null (server defaults medium)
});

test("JOIN rejects an unknown difficulty", () => {
  const r = parseMessage(JSON.stringify({ type: C2S.JOIN, carId: 1, diff: "insane" }));
  assert.equal(r.ok, false);
  assert.match(r.reason, /diff/);
});

test("malformed JSON and missing type are rejected", () => {
  assert.equal(parseMessage("}{").ok, false);
  assert.equal(parseMessage(JSON.stringify({ noType: 1 })).ok, false);
});

test("JOIN carries a sanitised player name", () => {
  const a = parseMessage(JSON.stringify({ type: C2S.JOIN, carId: 1, name: "  Ky<3!!  " }));
  assert.equal(a.ok, true);
  assert.equal(a.msg.name, "Ky3"); // stripped of punctuation + trimmed
  const b = parseMessage(JSON.stringify({ type: C2S.JOIN, carId: 1, name: "abcdefghijklmnop" }));
  assert.equal(b.msg.name.length, 12); // capped
  assert.equal(parseMessage(JSON.stringify({ type: C2S.JOIN, carId: 1 })).msg.name, null);
});

test("JOIN carries a sanitised persistent pid", () => {
  const a = parseMessage(JSON.stringify({ type: C2S.JOIN, carId: 1, pid: "p-abc_123!@#" }));
  assert.equal(a.msg.pid, "p-abc_123");
  assert.equal(parseMessage(JSON.stringify({ type: C2S.JOIN, carId: 1 })).msg.pid, null);
});

test("START and WAIT lobby messages are accepted", () => {
  assert.equal(parseMessage(JSON.stringify({ type: C2S.START })).ok, true);
  assert.equal(parseMessage(JSON.stringify({ type: C2S.WAIT })).ok, true);
});

test("INPUT accepts analog steer in [-256, 256] and rejects out-of-range", () => {
  for (const steer of [-256, -128, 0, 100, 256]) {
    const r = parseMessage(JSON.stringify({ type: C2S.INPUT, steer, accel: 1, brake: 0 }));
    assert.equal(r.ok, true, `steer ${steer} accepted`);
    assert.equal(r.msg.steer, steer);
  }
  for (const steer of [257, -257, 1000, 1.5]) {
    const r = parseMessage(JSON.stringify({ type: C2S.INPUT, steer, accel: 1, brake: 0 }));
    assert.equal(r.ok, false, `steer ${steer} rejected`);
    assert.match(r.reason, /steer/);
  }
});
