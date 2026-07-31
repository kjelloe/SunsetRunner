// shared/checkpoint_data.js — timer config loading + validation.
// Pure, parse-at-edge, integer-only. The per-checkpoint bonus lives on each
// segment (segment.checkpointTicks); this config holds the race start time.
// Values in ticks (20 Hz) — see specs/05. Store values in data, never code (§12).

export function loadCheckpointConfig(json) {
  if (!json || !Number.isInteger(json.startTimeTicks) || json.startTimeTicks <= 0) {
    throw new TypeError("checkpoint config needs a positive integer startTimeTicks");
  }
  return { startTimeTicks: json.startTimeTicks };
}
