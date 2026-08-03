import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMessage, C2S } from "../shared/protocol.js";

test("JOIN carries carId and an optional difficulty", () => {
  const a = parseMessage(JSON.stringify({ type: C2S.JOIN, carId: 2, diff: "hard" }));
  assert.equal(a.ok, true);
  assert.deepEqual(a.msg, { type: C2S.JOIN, carId: 2, diff: "hard" });

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
