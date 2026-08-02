// client/audio.js — procedural WebAudio (CLIENT ONLY). No asset files: engine
// hum, SFX, and a looping chiptune are synthesised. Import-safe — nothing is
// created until resume() runs under a user gesture (browsers block autoplay).
// The AudioContext is injectable so the graph is testable without a real device.

const NOTE = { // Hz for a small pentatonic loop (procedural music, no assets).
  a3: 220, c4: 261.63, d4: 293.66, e4: 329.63, g4: 392, a4: 440,
};
const MUSIC_LOOP = ["a3", "c4", "e4", "g4", "e4", "c4", "d4", "a4"];
const STEP_SECONDS = 0.18;

// SFX: [type, startHz, endHz, seconds, peakGain].
const SFX = {
  checkpoint: ["square", 660, 990, 0.18, 0.25],
  crash: ["sawtooth", 200, 40, 0.35, 0.4],
  nearmiss: ["triangle", 880, 1320, 0.12, 0.2],
  finish: ["square", 523, 1046, 0.5, 0.3],
};

export function createAudio(opts = {}) {
  const Ctx = opts.AudioContext
    || (typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext))
    || null;

  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let enabled = opts.enabled !== false;
  let musicOn = false;
  let musicStep = 0;
  let musicTimer = null;

  function ensure() {
    if (ctx || !Ctx || !enabled) return ctx;
    ctx = new Ctx();
    master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);
    return ctx;
  }

  function now() { return ctx ? ctx.currentTime : 0; }

  function blip(type, f0, f1, dur, peak) {
    if (!ctx || !enabled) return;
    const t = now();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.linearRampToValueAtTime?.(f1, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime?.(peak, t + dur * 0.15);
    gain.gain.exponentialRampToValueAtTime?.(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start?.(t);
    osc.stop?.(t + dur);
  }

  function startEngine() {
    if (!ctx || engineOsc || !enabled) return;
    engineOsc = ctx.createOscillator();
    engineGain = ctx.createGain();
    engineOsc.type = "sawtooth";
    engineOsc.frequency.value = 60;
    engineGain.gain.value = 0.08;
    engineOsc.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start?.(now());
  }

  function scheduleMusic() {
    if (!ctx || !musicOn || !enabled) return;
    blip("triangle", NOTE[MUSIC_LOOP[musicStep % MUSIC_LOOP.length]], NOTE[MUSIC_LOOP[musicStep % MUSIC_LOOP.length]], STEP_SECONDS, 0.12);
    musicStep++;
    if (opts.setInterval || typeof setInterval !== "undefined") {
      const si = opts.setInterval || setInterval;
      if (musicTimer === null) musicTimer = si(scheduleMusic, STEP_SECONDS * 1000);
    }
  }

  return {
    get started() { return ctx !== null; },
    get enabled() { return enabled; },
    setEnabled(v) {
      enabled = !!v;
      if (!enabled && engineGain) engineGain.gain.value = 0;
      else if (enabled && engineGain) engineGain.gain.value = 0.08;
    },
    // Call on the first user gesture: spins up the context + engine hum + music.
    resume() {
      if (!ensure()) return;
      ctx.resume?.();
      startEngine();
      musicOn = true;
      scheduleMusic();
    },
    // Engine pitch tracks speed fraction — the audible "sense of speed".
    setSpeed(speed, maxSpeed) {
      if (!engineOsc || !enabled) return;
      const frac = maxSpeed > 0 ? Math.max(0, Math.min(1, speed / maxSpeed)) : 0;
      engineOsc.frequency.value = 60 + frac * 220;
    },
    // One-shot SFX by kind ("checkpoint"/"crash"/"nearmiss"/"finish").
    event(kind) {
      const s = SFX[kind];
      if (s) blip(...s);
    },
    stopMusic() {
      musicOn = false;
      if (musicTimer !== null) { (opts.clearInterval || clearInterval)(musicTimer); musicTimer = null; }
    },
  };
}
