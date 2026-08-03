// tools/build_assets.mjs — generate the sprite manifest (atlas layout).
// Procedural + dependency-free: a fixed catalog is packed left-to-right into a
// strip; the manifest pins each sprite's rect + kind + palette. Sprites are
// drawn procedurally at runtime from this manifest (client/sprite_renderer.js),
// so gameplay/renderer code references sprite IDs, never hand-coded coords
// (§18, gotcha #17). Re-run to regenerate data/assets.json:
//   node tools/build_assets.mjs
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const CATALOG = [
  { id: "player_car",    kind: "car",  w: 64, h: 32, palette: ["#d02b2b", "#8a1c1c", "#141414"] },
  { id: "traffic_sedan", kind: "car",  w: 48, h: 28, palette: ["#e0c040", "#a08820", "#141414"] },
  { id: "traffic_truck", kind: "car",  w: 56, h: 36, palette: ["#3a6ea5", "#254b73", "#141414"] },
  { id: "palm",          kind: "palm", w: 48, h: 96, palette: ["#6b4a2a", "#2e8b3d"] },
  { id: "sign",          kind: "sign", w: 40, h: 48, palette: ["#cccccc", "#c02020", "#555555"] },
  { id: "fir",           kind: "fir",  w: 44, h: 96, palette: ["#4a3218", "#1f6a34", "#eaf2f8"] },
  { id: "wheat",         kind: "crop", w: 44, h: 40, palette: ["#d8b840", "#b89020"] },
];
const PAD = 2;

export function buildManifest(catalog = CATALOG, pad = PAD) {
  const sprites = {};
  let x = 0;
  let stripHeight = 0;
  for (const s of catalog) {
    sprites[s.id] = { x, y: 0, w: s.w, h: s.h, kind: s.kind, palette: s.palette };
    x += s.w + pad;
    if (s.h > stripHeight) stripHeight = s.h;
  }
  return { stripWidth: x - pad, stripHeight, sprites };
}

// Which sprite id a traffic kind renders as (engine traffic.kind).
export const TRAFFIC_SPRITE = { 1: "traffic_sedan", 2: "traffic_truck" };

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const manifest = buildManifest();
  const out = resolve(root, "data/assets.json");
  writeFileSync(out, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`wrote ${out}: strip ${manifest.stripWidth}x${manifest.stripHeight}, ${Object.keys(manifest.sprites).length} sprites`);
}
