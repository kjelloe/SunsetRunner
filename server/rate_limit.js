// server/rate_limit.js — per-connection token bucket (ws hardening, marker-0043).
// Pure and clock-injectable so it is unit-testable without real time. A client
// sends ~20 inputs/sec at 20 Hz; the defaults leave generous headroom while
// still cutting off a flood.

export function createRateLimiter({ capacity = 60, refillPerSec = 40, now = () => Date.now() } = {}) {
  let tokens = capacity;
  let last = now();
  return {
    // Consume one token; returns false when the bucket is empty (drop the msg).
    allow() {
      const t = now();
      tokens = Math.min(capacity, tokens + ((t - last) / 1000) * refillPerSec);
      last = t;
      if (tokens >= 1) { tokens -= 1; return true; }
      return false;
    },
    get tokens() { return tokens; },
  };
}
