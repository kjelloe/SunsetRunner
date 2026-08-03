// client/difficulty_select.js — pre-race difficulty picker (CLIENT ONLY).
// Three big buttons EASY / MEDIUM / HARD, chosen after the car. Difficulty scales
// checkpoint time bonuses (shared/constants DIFFICULTY -> ctx.timeScale). Pure
// cursor logic + fake-ctx-safe draw. (marker-0053)

import { DIFFICULTY } from "../shared/constants.js";

const LEVELS = [
  { key: "easy", label: "EASY", desc: "+30% checkpoint time", color: "#3fb254" },
  { key: "medium", label: "MEDIUM", desc: "standard", color: "#e0b23a" },
  { key: "hard", label: "HARD", desc: "-25% checkpoint time", color: "#e0453a" },
];

// ?diff=easy|medium|hard skips the picker.
export function difficultyFromParams(params) {
  const raw = params && params.get ? String(params.get("diff") || "").toLowerCase() : "";
  const found = LEVELS.find((l) => l.key === raw);
  if (found) return { level: found.key, timeScale: DIFFICULTY[found.key], fromUrl: true };
  return { level: "medium", timeScale: DIFFICULTY.medium, fromUrl: false };
}

export function createDifficultySelect(initialLevel = "medium") {
  let index = LEVELS.findIndex((l) => l.key === initialLevel);
  if (index < 0) index = 1; // medium
  return {
    get index() { return index; },
    get level() { return LEVELS[index].key; },
    get timeScale() { return DIFFICULTY[LEVELS[index].key]; },
    count: LEVELS.length,
    left() { index = (index - 1 + LEVELS.length) % LEVELS.length; },
    right() { index = (index + 1) % LEVELS.length; },
    setIndex(i) { if (i >= 0 && i < LEVELS.length) index = i; },
    handle(ev) {
      if (ev === "left") { this.left(); return null; }
      if (ev === "right") { this.right(); return null; }
      if (ev === "confirm") return "confirm";
      return null;
    },
  };
}

// Which of the three buttons a tap hit (0/1/2) — three equal columns.
export function difficultyTouchZone(view, x) {
  const third = view.w / 3;
  if (x < third) return 0;
  if (x < third * 2) return 1;
  return 2;
}

export function drawDifficultySelect(g, view, sel) {
  g.fillStyle = "#1a1030";
  g.fillRect(0, 0, view.w, view.h);

  g.fillStyle = "#ffd54a";
  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  g.font = `${Math.round(view.h * 0.07)}px sans-serif`;
  g.fillText("SELECT DIFFICULTY", view.w / 2, view.h * 0.2);

  const n = sel.count;
  const gap = view.w * 0.03;
  const bw = (view.w * 0.8 - gap * (n - 1)) / n;
  const x0 = view.w * 0.1;
  const by = view.h * 0.38;
  const bh = view.h * 0.34;
  for (let i = 0; i < n; i++) {
    const bx = x0 + i * (bw + gap);
    const selected = i === sel.index;
    g.fillStyle = selected ? LEVELS[i].color : "#2a2145";
    g.fillRect(bx, by, bw, bh);
    if (selected) {
      g.strokeStyle = "#ffffff";
      g.lineWidth = 4;
      g.strokeRect(bx, by, bw, bh);
    }
    g.fillStyle = selected ? "#101010" : "#ffffff";
    g.font = `bold ${Math.round(view.h * 0.055)}px sans-serif`;
    g.fillText(LEVELS[i].label, bx + bw / 2, by + bh * 0.42);
    g.font = `${Math.round(view.h * 0.028)}px sans-serif`;
    g.fillText(LEVELS[i].desc, bx + bw / 2, by + bh * 0.62);
  }

  g.fillStyle = "#ffd54a";
  g.font = `${Math.round(view.h * 0.04)}px sans-serif`;
  g.fillText("◄ ►  choose    ENTER / tap  start", view.w / 2, view.h * 0.9);
  g.textAlign = "left";
}

export { LEVELS as DIFFICULTY_LEVELS };
