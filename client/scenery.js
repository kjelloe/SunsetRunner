// client/scenery.js — per-leg scenery themes (CLIENT ONLY, renderer-only).
// Maps a segment's `scenerySet` id (data/roads.json, part of the content hash but
// NOT the engine state hash) to a palette + sprite mix, so each leg after a fork
// looks distinct (beach / canyon / forest), OutRun-style. Pure + node-testable.

const FALLBACK = {
  name: "default",
  sky: ["#2b1a54", "#ff7e5f"],
  grassA: "#2f9e42", grassB: "#279137",
  rumbleA: "#d63a3a",
  sprites: ["palm", "palm", "sign"],
  every: 10,
};

export function loadScenery(json) {
  const themes = {};
  const src = (json && json.themes) || {};
  for (const key of Object.keys(src)) {
    const t = src[key];
    themes[String(key)] = {
      name: t.name || `set${key}`,
      sky: Array.isArray(t.sky) && t.sky.length === 2 ? t.sky : FALLBACK.sky,
      grassA: t.grassA || FALLBACK.grassA,
      grassB: t.grassB || FALLBACK.grassB,
      rumbleA: t.rumbleA || FALLBACK.rumbleA,
      sprites: Array.isArray(t.sprites) && t.sprites.length ? t.sprites : FALLBACK.sprites,
      every: Number.isFinite(t.every) && t.every > 0 ? t.every : FALLBACK.every,
    };
  }
  const def = String((json && json.default) ?? 1);
  return { themes, default: def };
}

// Resolve the theme for a segment's scenerySet id, falling back to the config
// default and finally the hard fallback — the renderer must never get null.
export function themeFor(config, scenerySet) {
  if (!config || !config.themes) return FALLBACK;
  return config.themes[String(scenerySet)] || config.themes[config.default] || FALLBACK;
}

export { FALLBACK as DEFAULT_THEME };
