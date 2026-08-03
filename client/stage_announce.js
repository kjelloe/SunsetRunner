// client/stage_announce.js — "STAGE n — NAME" banner when you enter a new stage
// (CLIENT ONLY, presentation). Time-driven fade in/out; pure label logic tested.

const SHOW_MS = 2600;

export function stageLabel(stage, nameKey) {
  const name = String(nameKey || "").replace(/^seg\./, "").replace(/_/g, " ").toUpperCase();
  return name ? `STAGE ${stage} — ${name}` : `STAGE ${stage}`;
}

export function createAnnouncer() {
  let text = null;
  let startedAt = 0;
  return {
    get active() { return text !== null; },
    announce(t, now) { text = t; startedAt = now; },
    // Opacity at time `now` (0 before/after the window), for testing + draw.
    alphaAt(now) {
      if (text === null) return 0;
      const el = now - startedAt;
      if (el < 0 || el > SHOW_MS) return 0;
      if (el < 300) return el / 300;
      if (el > SHOW_MS - 500) return (SHOW_MS - el) / 500;
      return 1;
    },
    draw(g, view, now) {
      if (text === null) return;
      const el = now - startedAt;
      if (el > SHOW_MS) { text = null; return; }
      g.globalAlpha = Math.max(0, Math.min(1, this.alphaAt(now)));
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = "#ffd54a";
      g.font = `bold ${Math.round(view.h * 0.075)}px sans-serif`;
      g.fillText(text, view.w / 2, view.h * 0.4);
      g.globalAlpha = 1;
      g.textAlign = "left";
      g.textBaseline = "alphabetic";
    },
  };
}

export { SHOW_MS as ANNOUNCE_MS };
