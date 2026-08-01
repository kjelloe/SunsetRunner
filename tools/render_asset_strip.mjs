// tools/render_asset_strip.mjs — render the sprite strip to a PPM image for
// eyeballing the manifest layout. Dependency-free (P6 PPM writer). Each sprite
// is drawn as a filled palette[0] box at its manifest rect — enough to verify
// packing/width. Writes debugging/logs/asset_strip.ppm:
//   node tools/render_asset_strip.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(resolve(root, "data/assets.json")));
const W = manifest.stripWidth;
const H = manifest.stripHeight;

function hexRGB(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

const buf = new Uint8Array(W * H * 3); // black background
for (const s of Object.values(manifest.sprites)) {
  const [r, g, b] = hexRGB(s.palette[0]);
  for (let yy = s.y; yy < s.y + s.h; yy++) {
    for (let xx = s.x; xx < s.x + s.w; xx++) {
      const i = (yy * W + xx) * 3;
      buf[i] = r; buf[i + 1] = g; buf[i + 2] = b;
    }
  }
}

const header = Buffer.from(`P6\n${W} ${H}\n255\n`, "ascii");
mkdirSync(resolve(root, "debugging/logs"), { recursive: true });
const out = resolve(root, "debugging/logs/asset_strip.ppm");
writeFileSync(out, Buffer.concat([header, Buffer.from(buf)]));
console.log(`wrote ${out}: ${W}x${H}`);
