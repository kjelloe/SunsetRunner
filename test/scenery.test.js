import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadScenery, themeFor, DEFAULT_THEME } from "../client/scenery.js";

const sceneryJson = JSON.parse(readFileSync(new URL("../data/scenery.json", import.meta.url)));

test("loadScenery parses themes and fills missing fields", () => {
  const cfg = loadScenery(sceneryJson);
  assert.ok(cfg.themes["2"]);
  assert.equal(cfg.themes["2"].name, "beach");
  assert.equal(cfg.themes["2"].sky.length, 2);
  assert.ok(cfg.themes["2"].every > 0);
});

test("loadScenery repairs a malformed theme with fallbacks", () => {
  const cfg = loadScenery({ default: 1, themes: { 1: { name: "x" } } });
  const t = cfg.themes["1"];
  assert.deepEqual(t.sky, DEFAULT_THEME.sky);
  assert.deepEqual(t.sprites, DEFAULT_THEME.sprites);
  assert.equal(t.every, DEFAULT_THEME.every);
});

test("themeFor maps scenerySet ids to distinct themes", () => {
  const cfg = loadScenery(sceneryJson);
  assert.equal(themeFor(cfg, 2).name, "beach");
  assert.equal(themeFor(cfg, 3).name, "canyon");
  assert.equal(themeFor(cfg, 4).name, "forest");
  // Distinct legs -> distinct palettes.
  assert.notEqual(themeFor(cfg, 2).sky[0], themeFor(cfg, 3).sky[0]);
});

test("themeFor falls back to the config default, then the hard default", () => {
  const cfg = loadScenery(sceneryJson);
  assert.equal(themeFor(cfg, 999).name, cfg.themes[cfg.default].name); // unknown -> default
  assert.equal(themeFor(null, 2).name, "default"); // no config -> hard fallback
});

test("every course leg's scenerySet resolves to a real theme", () => {
  const cfg = loadScenery(sceneryJson);
  const roads = JSON.parse(readFileSync(new URL("../data/roads.json", import.meta.url)));
  for (const s of roads.segments) {
    const t = themeFor(cfg, s.scenerySet);
    assert.ok(t && Array.isArray(t.sky), `segment ${s.id} scenerySet ${s.scenerySet} has no theme`);
  }
});
