import { test } from "node:test";
import assert from "node:assert/strict";
import { playerId } from "../client/player_id.js";

test("playerId returns the stored id, minting + persisting one if absent", () => {
  let v = null;
  const store = { getItem: () => v, setItem: (_, x) => { v = x; } };
  const a = playerId(store);
  assert.ok(a.startsWith("p-"));
  assert.equal(v, a); // persisted
  assert.equal(playerId(store), a); // stable on next call
});
