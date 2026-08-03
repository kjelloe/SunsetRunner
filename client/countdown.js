// client/countdown.js — pre-race 3-2-1-GO! (CLIENT ONLY, presentation).
// A fresh local race freezes (no sim advance) during the countdown so the clock
// and car don't move until GO. Time-driven off the frame clock; pure label logic
// is node-testable. Remote races are server-authoritative, so the countdown is
// local-only for now (a server-driven start is future work).

const STEPS = [
  { label: "3", ms: 800 },
  { label: "2", ms: 800 },
  { label: "1", ms: 800 },
  { label: "GO!", ms: 700 },
];
const TOTAL = STEPS.reduce((n, s) => n + s.ms, 0);

export function createCountdown() {
  let startedAt = null;

  // The label showing at time `now`, or null once finished / not started.
  function labelAt(now) {
    if (startedAt === null) return null;
    let t = now - startedAt;
    if (t < 0) t = 0;
    if (t >= TOTAL) return null;
    for (const s of STEPS) {
      if (t < s.ms) return s.label;
      t -= s.ms;
    }
    return null;
  }

  return {
    start(now) { startedAt = now; },
    get started() { return startedAt !== null; },
    isDone(now) { return startedAt !== null && now - startedAt >= TOTAL; },
    labelAt,
    draw(g, view, now) { drawCountdownLabel(g, view, labelAt(now)); },
  };
}

// Draw a big centred countdown label (a number, or "GO!"). Shared by the local
// countdown and the server-driven shared countdown (specs/53). No-op for falsy.
export function drawCountdownLabel(g, view, label) {
  if (!label) return;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = label === "GO!" ? "#4ce05a" : "#ffd54a";
  g.font = `bold ${Math.round(view.h * 0.28)}px sans-serif`;
  g.fillText(label, view.w / 2, view.h * 0.42);
  g.textBaseline = "alphabetic";
  g.textAlign = "left";
}

export { TOTAL as COUNTDOWN_MS };
