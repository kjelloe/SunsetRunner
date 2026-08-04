// server/leaderboard.js — persistent all-time high scores (best run per name).
// Thin file wrapper over the pure ranking in shared/leaderboard.js.

import { readFileSync, writeFileSync } from "node:fs";
import { mergeResult, rankResults } from "../shared/leaderboard.js";

export function createLeaderboard(path = null, max = 20) {
  let entries = [];
  if (path) {
    try { entries = JSON.parse(readFileSync(path, "utf8")).entries || []; } catch { /* fresh */ }
  }
  return {
    add(result) {
      if (!result || !result.name) return;
      entries = mergeResult(entries, result, max);
      if (path) { try { writeFileSync(path, JSON.stringify({ entries }, null, 2) + "\n"); } catch { /* best effort */ } }
    },
    top(n = 10) { return rankResults(entries).slice(0, n); },
    get entries() { return entries; },
  };
}
