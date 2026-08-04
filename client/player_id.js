// client/player_id.js — a persistent player id (CLIENT ONLY). Stored in
// localStorage and sent on JOIN so the server carries your score across a
// RE-JOIN (specs/59). Not a security token — just a stable scoreboard key.

const KEY = "sunset_pid";

// A short random id (client-side only; not part of the deterministic engine).
function mint() {
  const r = Math.random().toString(36).slice(2, 10);
  const t = Date.now().toString(36);
  return `p-${r}${t}`;
}

// Return the stored player id, creating + persisting one on first use.
export function playerId(store) {
  try {
    let id = store ? store.getItem(KEY) : null;
    if (!id) { id = mint(); store?.setItem(KEY, id); }
    return id;
  } catch {
    return mint();
  }
}
