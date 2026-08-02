import { test } from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter } from "../server/rate_limit.js";

test("token bucket allows up to capacity then blocks", () => {
  let t = 0;
  const rl = createRateLimiter({ capacity: 3, refillPerSec: 1, now: () => t });
  assert.equal(rl.allow(), true);
  assert.equal(rl.allow(), true);
  assert.equal(rl.allow(), true);
  assert.equal(rl.allow(), false); // bucket empty
});

test("token bucket refills over time", () => {
  let t = 0;
  const rl = createRateLimiter({ capacity: 3, refillPerSec: 1, now: () => t });
  rl.allow(); rl.allow(); rl.allow();
  assert.equal(rl.allow(), false);
  t += 2000; // 2 s -> +2 tokens
  assert.equal(rl.allow(), true);
  assert.equal(rl.allow(), true);
  assert.equal(rl.allow(), false);
});

test("refill never exceeds capacity", () => {
  let t = 0;
  const rl = createRateLimiter({ capacity: 2, refillPerSec: 100, now: () => t });
  t += 10000; // huge idle
  assert.equal(rl.allow(), true);
  assert.equal(rl.allow(), true);
  assert.equal(rl.allow(), false); // capped at 2, not 2 + 1000
});
