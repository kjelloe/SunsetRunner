// client/tuning.js — live feel-tuning knobs (CLIENT ONLY, presentation).
// The pseudo-3D camera/road feel constants are first-pass magnitudes that can
// only be judged in a real browser (specs/17). Rather than an edit/test round
// trip per value, they live in one mutable TUNING object overridable by URL
// params, with an on-screen readout (?tune=1) so a playtester can dial them in
// and report back the values that feel right. All renderer-only — NOT part of
// the deterministic contract. Pure + node-testable.

export const TUNING = {
  camDepth: 0.84,     // 1/tan(fov/2) — higher = narrower FOV / flatter
  camHeight: 1500,    // camera height above the road (world units)
  roadWidth: 2000,    // road half-width (world units)
  hillScale: 180,     // elevation per hillProfile step (crest/dip readability)
  camFollow: 0.4,     // fraction of the player's lateral offset the camera tracks
  playerNearZ: 2000,  // depth the player car is drawn at (its on-screen size)
};

// One row per knob: URL param name, clamp range (usable bounds — outside these
// the road/car break, e.g. hill>~320 clips the car through crests, roadWidth<~1400
// is narrower than the car), label for the readout.
export const TUNING_FIELDS = [
  { key: "camDepth", param: "depth", min: 0.5, max: 1.4, label: "cam depth (FOV)" },
  { key: "camHeight", param: "height", min: 800, max: 2400, label: "cam height" },
  { key: "roadWidth", param: "roadw", min: 1400, max: 3000, label: "road width" },
  { key: "hillScale", param: "hill", min: 40, max: 320, label: "hill scale" },
  { key: "camFollow", param: "follow", min: 0.15, max: 0.75, label: "cam follow" },
  { key: "playerNearZ", param: "nearz", min: 1200, max: 3200, label: "player near-z" },
];

// Parse + clamp overrides from URL params. Returns only the keys actually set,
// so callers can tell "left default" from "set to the default value".
export function readTuning(params) {
  const out = {};
  for (const f of TUNING_FIELDS) {
    const raw = params && params.get ? params.get(f.param) : undefined;
    if (raw == null || raw === "") continue;
    const n = Number(raw);
    if (!Number.isFinite(n)) continue;
    out[f.key] = Math.max(f.min, Math.min(f.max, n));
  }
  return out;
}

// Write overrides into the live TUNING object (only known keys).
export function applyTuning(overrides) {
  for (const k of Object.keys(overrides || {})) {
    if (k in TUNING) TUNING[k] = overrides[k];
  }
  return TUNING;
}

// Top-left readout of the current values + their param names, so a screenshot
// records exactly what was tuned. Fake-ctx-safe.
export function drawTuningHud(g, view, tuning = TUNING) {
  const pad = Math.round(view.h * 0.02);
  const line = Math.round(view.h * 0.032);
  const w = Math.round(view.w * 0.30);
  const h = line * (TUNING_FIELDS.length + 1) + pad * 2;
  g.globalAlpha = 0.72;
  g.fillStyle = "#0d0820";
  g.fillRect(pad, pad, w, h);
  g.globalAlpha = 1;
  g.fillStyle = "#ffd54a";
  g.textAlign = "left";
  g.font = `${line}px monospace`;
  g.fillText("FEEL TUNING  (?tune=1)", pad * 2, pad + line);
  g.fillStyle = "#cfe";
  TUNING_FIELDS.forEach((f, i) => {
    const y = pad + line * (i + 2);
    g.fillText(`${f.label}: ${tuning[f.key]}  (?${f.param}=)`, pad * 2, y);
  });
}
