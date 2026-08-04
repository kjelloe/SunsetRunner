// shared/leaderboard.js — all-time high-score ranking (pure, Luau-portable-ish).
// A result is { name, finishTicks, stage }: finishTicks >= 0 means the player
// finished (rank by TIME, faster first); otherwise rank by STAGE reached (further
// first). Finishers always rank above non-finishers. Keeps each name's BEST run.

export function rankResults(entries) {
  const sorted = [...entries].sort((a, b) => {
    const af = a.finishTicks >= 0;
    const bf = b.finishTicks >= 0;
    if (af !== bf) return af ? -1 : 1;          // finishers above non-finishers
    if (af) return a.finishTicks - b.finishTicks; // faster finish wins
    if (a.stage !== b.stage) return b.stage - a.stage; // further stage wins
    return String(a.name).localeCompare(String(b.name));
  });
  return sorted.map((e, i) => ({ ...e, rank: i + 1 }));
}

// Is result `a` a better run than `b`?
export function isBetter(a, b) {
  const af = a.finishTicks >= 0;
  const bf = b.finishTicks >= 0;
  if (af !== bf) return af;
  if (af) return a.finishTicks < b.finishTicks;
  return a.stage > b.stage;
}

// Merge a new result into the board, keeping each name's best run then the top N.
export function mergeResult(entries, result, max = 20) {
  const byName = new Map();
  for (const e of entries) byName.set(e.name, e);
  const cur = byName.get(result.name);
  if (!cur || isBetter(result, cur)) byName.set(result.name, result);
  return rankResults([...byName.values()]).slice(0, max).map(({ rank, ...e }) => e);
}
