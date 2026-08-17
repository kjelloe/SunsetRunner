import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialsEntry, initialsLayout } from "../client/initials_entry.js";

const VIEW = { w: 960, h: 540 };
const centre = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

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

test("touch enter advances slot-by-slot and confirms after the 5th", () => {
  const e = createInitialsEntry("AAAAA");
  for (let i = 0; i < 4; i++) assert.equal(e.handle("enter"), false); // advance 0->4
  assert.equal(e.handle("enter"), true); // on the last slot -> done
  assert.equal(e.isDone(), true);
});

test("tap: a slot selects it, the ▲/▼ buttons change that slot's letter", () => {
  const e = createInitialsEntry("AAAAA");
  const L = initialsLayout(VIEW);
  const c2 = centre(L.cells[2]);
  e.tap(VIEW, c2.x, c2.y); // select slot 2
  const up = centre(L.up);
  e.tap(VIEW, up.x, up.y); // slot 2: A -> B
  e.tap(VIEW, up.x, up.y); // slot 2: B -> C
  assert.equal(e.text(), "AACAA");
  const down = centre(L.down);
  e.tap(VIEW, down.x, down.y); // slot 2: C -> B
  assert.equal(e.text(), "AABAA");
});

test("tap: ENTER advances then confirms; taps after done are inert", () => {
  const e = createInitialsEntry("AAAAA");
  const L = initialsLayout(VIEW);
  const enter = centre(L.enter);
  for (let i = 0; i < 4; i++) assert.equal(e.tap(VIEW, enter.x, enter.y), false);
  assert.equal(e.tap(VIEW, enter.x, enter.y), true); // 5th ENTER confirms
  assert.equal(e.isDone(), true);
  assert.equal(e.tap(VIEW, centre(L.up).x, centre(L.up).y), true); // inert, stays done
  assert.equal(e.text(), "AAAAA");
});
