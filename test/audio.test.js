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

test("music tracks: default is track 0 (SUNSET/triangle); select + cycle + wrap", () => {
  const f = fakeAudio();
  const a = createAudio(opts(f));
  a.resume();
  // oscillators[0] is the engine; [1] is the first scheduled music note.
  assert.equal(f.oscillators[1].type, "triangle");
  assert.deepEqual(a.track, { index: 0, name: "SUNSET", count: 4 });
  assert.equal(a.setTrack(2).name, "COAST");
  assert.equal(a.setTrack(9).index, 1);   // 9 % 4 wraps
  assert.equal(a.cycleTrack().index, 2);
  a.setTrack(3);
  assert.equal(a.cycleTrack().index, 0);  // cycles past the end back to 0
});

test("music track select changes the next scheduled note's timbre", () => {
  let scheduled = null;
  const f = fakeAudio();
  const a = createAudio({ AudioContext: f.Ctx, setInterval: (cb) => { scheduled = cb; return 1; }, clearInterval: () => {} });
  a.resume();
  assert.equal(f.oscillators[1].type, "triangle"); // track 0
  a.setTrack(3);                                    // CHROME / sawtooth
  scheduled();                                      // schedule the next note
  assert.equal(f.oscillators.at(-1).type, "sawtooth");
});

test("music track can be constructed from opts.track (persisted / ?track=N)", () => {
  const f = fakeAudio();
  const a = createAudio({ ...opts(f), track: 1 });
  a.resume();
  assert.equal(f.oscillators[1].type, "square"); // NEON
  assert.equal(a.track.name, "NEON");
});
