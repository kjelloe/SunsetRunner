import { test } from "node:test";
import assert from "node:assert/strict";
import { createAnnouncer, stageLabel, ANNOUNCE_MS } from "../client/stage_announce.js";

test("stageLabel humanises the segment name", () => {
  assert.equal(stageLabel(8, "seg.mountain_3"), "STAGE 8 — MOUNTAIN 3");
  assert.equal(stageLabel(1, null), "STAGE 1");
});

test("announcer fades in, holds, then clears", () => {
  const a = createAnnouncer();
  assert.equal(a.active, false);
  a.announce("STAGE 1", 0);
  assert.equal(a.active, true);
  assert.ok(a.alphaAt(0) < 1); // fading in
  assert.equal(a.alphaAt(1000), 1); // held
  assert.equal(a.alphaAt(ANNOUNCE_MS + 100), 0); // past the window
});

test("draw clears the text once the window elapses", () => {
  const a = createAnnouncer();
  a.announce("STAGE 1", 0);
  const g = new Proxy({}, { get: (_, k) => (["fillStyle", "font", "textAlign", "textBaseline", "globalAlpha"].includes(k) ? "" : () => {}), set: () => true });
  a.draw(g, { w: 960, h: 540 }, ANNOUNCE_MS + 10);
  assert.equal(a.active, false);
});
