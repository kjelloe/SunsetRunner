// client/name_entry.js — pre-race name entry (CLIENT ONLY). The typed name is
// sent on JOIN and shown as the player's tag to rivals (specs). Pure key logic +
// a fake-ctx-safe draw. Remembered in localStorage so returning players skip it.

const KEY = "sunset_name";
const sanitize = (s) => String(s || "").replace(/[^\w \-]/g, "").slice(0, 12);

// Resolve a known name: ?name=… wins, else the remembered one. `fromUrl`/`stored`
// let the caller decide whether to prompt.
export function nameFromParams(params, store) {
  const q = params && params.get ? params.get("name") : "";
  if (q) return { name: sanitize(q), fromUrl: true };
  let saved = "";
  try { saved = store ? store.getItem(KEY) || "" : ""; } catch { saved = ""; }
  return { name: sanitize(saved), fromUrl: false };
}

export function rememberName(store, name) {
  try { store?.setItem(KEY, sanitize(name)); } catch { /* non-fatal */ }
}

export function createNameEntry(initial) {
  let text = sanitize(initial);
  return {
    get text() { return text; },
    // Apply a key; returns "confirm" on Enter (with a non-empty name), else null.
    key(k) {
      if (k === "Enter") return text.trim() ? "confirm" : null;
      if (k === "Backspace") { text = text.slice(0, -1); return null; }
      if (typeof k === "string" && k.length === 1 && /[\w \-]/.test(k) && text.length < 12) text += k;
      return null;
    },
    draw(g, view) {
      g.fillStyle = "#1a1030";
      g.fillRect(0, 0, view.w, view.h);
      g.textAlign = "center";
      g.textBaseline = "alphabetic";
      g.fillStyle = "#ffd54a";
      g.font = `${Math.round(view.h * 0.06)}px sans-serif`;
      g.fillText("ENTER YOUR NAME", view.w / 2, view.h * 0.3);
      g.strokeStyle = "#ffffff";
      g.lineWidth = 2;
      g.strokeRect(view.w * 0.3, view.h * 0.4, view.w * 0.4, view.h * 0.1);
      g.fillStyle = "#ffffff";
      g.font = `bold ${Math.round(view.h * 0.055)}px monospace`;
      g.fillText(`${text}_`, view.w / 2, view.h * 0.475);
      g.fillStyle = "#ffd54a";
      g.font = `${Math.round(view.h * 0.035)}px sans-serif`;
      g.fillText("type your name — ENTER to continue", view.w / 2, view.h * 0.62);
      g.textAlign = "left";
    },
  };
}
