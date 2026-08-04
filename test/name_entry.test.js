import { test } from "node:test";
import assert from "node:assert/strict";
import { nameFromParams, createNameEntry, rememberName } from "../client/name_entry.js";

test("nameFromParams prefers ?name, else the stored name", () => {
  assert.deepEqual(nameFromParams(new URLSearchParams("name=Zoe"), null), { name: "Zoe", fromUrl: true });
  const store = { getItem: () => "Saved" };
  assert.deepEqual(nameFromParams(new URLSearchParams(""), store), { name: "Saved", fromUrl: false });
  assert.deepEqual(nameFromParams(new URLSearchParams(""), null), { name: "", fromUrl: false });
});

test("createNameEntry types, backspaces, caps, and confirms", () => {
  const e = createNameEntry("");
  for (const c of "Max!") e.key(c); // '!' rejected
  assert.equal(e.text, "Max");
  e.key("Backspace");
  assert.equal(e.text, "Ma");
  assert.equal(e.key("Enter"), "confirm");
  const empty = createNameEntry("");
  assert.equal(empty.key("Enter"), null); // empty name won't confirm
});

test("rememberName writes to the store", () => {
  let saved = null;
  rememberName({ setItem: (_, v) => { saved = v; } }, "Fox");
  assert.equal(saved, "Fox");
});
