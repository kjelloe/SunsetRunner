// shared/traffic_data.js — traffic config loading + validation.
// Pure, parse-at-edge, integer-only. Density = cars spawned per segment; kinds
// carry speed; lanes are the laneX offsets traffic may occupy. See specs/06.

function assertInt(v, label) {
  if (!Number.isInteger(v)) throw new TypeError(`${label} must be an integer: ${v}`);
  return v;
}

export function loadTrafficConfig(json) {
  if (!json || !Array.isArray(json.kinds) || !Array.isArray(json.lanes)) {
    throw new TypeError("traffic config needs arrays: kinds, lanes");
  }
  if (assertInt(json.density, "density") < 0) throw new RangeError("density must be >= 0");
  if (json.kinds.length === 0) throw new RangeError("traffic config needs at least one kind");
  if (json.lanes.length === 0) throw new RangeError("traffic config needs at least one lane");
  for (const lane of json.lanes) assertInt(lane, "lane");
  const kindsById = new Map();
  for (const k of json.kinds) {
    assertInt(k.id, "kind.id");
    if (kindsById.has(k.id)) throw new RangeError(`duplicate kind.id: ${k.id}`);
    if (assertInt(k.speed, "kind.speed") <= 0) throw new RangeError(`kind ${k.id} speed must be positive`);
    if (typeof k.nameKey !== "string") throw new TypeError(`kind ${k.id} nameKey must be a string`);
    kindsById.set(k.id, k);
  }
  return { density: json.density, lanes: json.lanes, kinds: json.kinds, kindsById };
}
