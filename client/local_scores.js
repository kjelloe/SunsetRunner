// client/local_scores.js — solo all-time scores in localStorage (CLIENT ONLY),
// same ranking as the server board (shared/leaderboard.js).

import { mergeResult, rankResults } from "../shared/leaderboard.js";

const KEY = "sunset_scores";

export function loadScores(store) {
  try { return JSON.parse(store ? store.getItem(KEY) || "[]" : "[]") || []; } catch { return []; }
}

// Merge a solo result and return the ranked board.
export function recordScore(store, result) {
  const next = mergeResult(loadScores(store), result, 20);
  try { store?.setItem(KEY, JSON.stringify(next)); } catch { /* non-fatal */ }
  return rankResults(next);
}

export function topScores(store, n = 10) {
  return rankResults(loadScores(store)).slice(0, n);
}
