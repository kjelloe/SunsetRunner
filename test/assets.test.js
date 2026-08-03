import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildManifest, TRAFFIC_SPRITE } from "../tools/build_assets.mjs";
import { computeFnv1a64, hashToHex64 } from "../shared/canonical.js";
import { drawSprite } from "../client/sprite_renderer.js";

const shipped = JSON.parse(readFileSync(new URL("../data/assets.json", import.meta.url)));

test("buildManifest is deterministic and matches the shipped data/assets.json", () => {
  assert.deepEqual(buildManifest(), buildManifest());
  assert.deepEqual(buildManifest(), shipped); // regen was committed (no drift)
});

test("strip width and manifest hash are pinned (§18 / gotcha #16)", () => {
  assert.equal(shipped.stripWidth, 540);
  assert.equal(shipped.stripHeight, 96);
  const bytes = new TextEncoder().encode(readFileSync(new URL("../data/assets.json", import.meta.url), "utf8"));
  const h = computeFnv1a64(bytes);
  assert.equal(hashToHex64(h.hashHi, h.hashLo), "f8972c86dc06b329");
});

test("sprites pack left-to-right without overlap", () => {
  const entries = Object.values(shipped.sprites).sort((a, b) => a.x - b.x);
  for (let i = 1; i < entries.length; i++) {
    assert.ok(entries[i].x >= entries[i - 1].x + entries[i - 1].w, "no overlap");
  }
  const last = entries[entries.length - 1];
  assert.equal(last.x + last.w, shipped.stripWidth);
});

test("every sprite the renderer references exists in the manifest", () => {
  for (const id of ["player_car", "palm", "sign", "fir", "wheat", "snowmobile", "skier", "traffic_bus", "traffic_motorcycle"]) assert.ok(shipped.sprites[id], `${id} present`);
  for (const kind of [1, 2]) assert.ok(shipped.sprites[TRAFFIC_SPRITE[kind]], `traffic kind ${kind}`);
});

test("drawSprite dispatches by kind without throwing (fake ctx)", () => {
  const calls = [];
  const g = new Proxy({}, {
    get: (_, k) => {
      if (k === "createLinearGradient") return () => ({ addColorStop() {} });
      if (["fillStyle", "strokeStyle", "font", "textAlign", "textBaseline", "globalAlpha", "lineWidth"].includes(k)) return "";
      return (...a) => calls.push([k, ...a]);
    },
    set: () => true,
  });
  for (const id of Object.keys(shipped.sprites)) drawSprite(g, shipped.sprites[id], 100, 200, 1);
  assert.ok(calls.length > 0);
});
