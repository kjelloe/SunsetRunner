import { test } from "node:test";
import assert from "node:assert/strict";
import { createAudio } from "../client/audio.js";

// Minimal fake WebAudio graph that records the nodes the module builds.
function fakeAudio() {
  const oscillators = [];
  const gains = [];
  const mkOsc = () => {
    const o = { type: "", frequency: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} };
    oscillators.push(o);
    return o;
  };
  const mkGain = () => {
    const g = { gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} };
    gains.push(g);
    return g;
  };
  class Ctx {
    constructor() { this.currentTime = 0; this.destination = {}; this.state = "running"; }
    createOscillator() { return mkOsc(); }
    createGain() { return mkGain(); }
    resume() { return Promise.resolve(); }
  }
  return { Ctx, oscillators, gains };
}

const opts = (f) => ({ AudioContext: f.Ctx, setInterval: () => 1, clearInterval: () => {} });

test("import-safe: nothing is created until resume()", () => {
  const f = fakeAudio();
  const a = createAudio(opts(f));
  assert.equal(a.started, false);
  assert.equal(f.oscillators.length, 0);
});

test("resume() spins up the context and an engine oscillator", () => {
  const f = fakeAudio();
  const a = createAudio(opts(f));
  a.resume();
  assert.equal(a.started, true);
  assert.ok(f.oscillators.length >= 1);
});

test("setSpeed maps speed fraction to engine pitch", () => {
  const f = fakeAudio();
  const a = createAudio(opts(f));
  a.resume();
  const engine = f.oscillators[0]; // startEngine runs before music
  a.setSpeed(0, 2400);
  assert.equal(engine.frequency.value, 60);
  a.setSpeed(2400, 2400);
  assert.equal(engine.frequency.value, 280); // 60 + 220
  a.setSpeed(1200, 2400);
  assert.equal(engine.frequency.value, 170); // 60 + 110
});

test("event() fires a one-shot SFX oscillator", () => {
  const f = fakeAudio();
  const a = createAudio(opts(f));
  a.resume();
  const before = f.oscillators.length;
  a.event("crash");
  assert.equal(f.oscillators.length, before + 1);
  a.event("nope"); // unknown kind → no node
  assert.equal(f.oscillators.length, before + 1);
});

test("disabled audio builds no nodes", () => {
  const f = fakeAudio();
  const a = createAudio({ ...opts(f), enabled: false });
  a.resume();
  assert.equal(a.started, false);
  assert.equal(f.oscillators.length, 0);
  a.event("crash");
  assert.equal(f.oscillators.length, 0);
});

test("setEnabled(false) mutes the engine and blocks new SFX", () => {
  const f = fakeAudio();
  const a = createAudio(opts(f));
  a.resume();
  const n = f.oscillators.length;
  a.setEnabled(false);
  a.event("crash");
  assert.equal(f.oscillators.length, n); // no new node while muted
});
