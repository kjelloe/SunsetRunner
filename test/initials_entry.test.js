import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialsEntry } from "../client/initials_entry.js";

test("seeds from a name, padded to 5 slots", () => {
  const e = createInitialsEntry("XY");
  assert.equal(e.text(), "XYAAA"); // X, Y, then A padding
});

test("up/down cycle the letter at the cursor; left/right move the cursor", () => {
  const e = createInitialsEntry("AAAAA");
  e.handle("up"); // A -> B at slot 0
  assert.equal(e.text(), "BAAAA");
  e.handle("right");
  e.handle("up");
  e.handle("up"); // slot 1: A -> C
  assert.equal(e.text(), "BCAAA");
  e.handle("down"); // slot 1: C -> B
  assert.equal(e.text(), "BBAAA");
});

test("down wraps A -> last pad char; cursor clamps at the ends", () => {
  const e = createInitialsEntry("BBBBB");
  e.handle("left"); // already at 0, clamps
  e.handle("down"); // B -> A
  assert.equal(e.text()[0], "A");
  e.handle("down"); // A wraps to the last pad char "-"
  assert.equal(e.text()[0], "-");
  for (let i = 0; i < 9; i++) e.handle("right"); // clamps at slot 4
  e.handle("up"); // only slot 4 changes: B -> C
  assert.equal(e.text()[4], "C");
});

test("confirm finishes and is reported by isDone()", () => {
  const e = createInitialsEntry("ZZZ");
  assert.equal(e.isDone(), false);
  assert.equal(e.handle("up"), false); // not done yet
  assert.equal(e.handle("confirm"), true);
  assert.equal(e.isDone(), true);
});

test("never returns an empty name (all-pad trims to a default)", () => {
  const e = createInitialsEntry(".....");
  assert.equal(e.text(), "AAA"); // all pad chars trimmed -> default
});
