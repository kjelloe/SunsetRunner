// client/near_miss.js — client-only "near miss" feedback: a whoosh SFX + a brief
// side speed-streak when the local car passes a traffic car CLOSE but without
// crashing. The engine has no near-miss event (a crash is authoritative; a near
// miss is cosmetic), so this is detected here from the traffic the client already
// renders. Presentation only — no engine state is written. Mirrors the engine's
// collision geometry so the "near" band sits just outside a real crash.

import { CAR_LENGTH, CAR_WIDTH } from "../shared/collision.js";

// A crash is |Δlane| < CAR_WIDTH (200). A near miss is the same longitudinal
// closeness (|Δz| < CAR_LENGTH) with a lateral gap in [CAR_WIDTH, NEAR_WIDTH):
// close enough to feel it, not close enough to hit. NEAR_WIDTH is ~1.8 lanes.
const NEAR_WIDTH = 460;
const COOLDOWN_MS = 250; // at most one whoosh per window, so dense traffic ≠ spam
const STREAK_MS = 220;

export function createNearMiss() {
  const fired = new Set();          // traffic ids already counted (dedup per pass)
  let lastFire = -1e9;
  let flash = { side: 0, start: -1e9 };

  return {
    reset() { fired.clear(); lastFire = -1e9; flash = { side: 0, start: -1e9 }; },

    // Returns 1 when a NEW near miss fires this frame (caller plays the SFX once),
    // else 0. Every qualifying car is deduped, but audio/visual is rate-limited.
    update(now, self, traffic) {
      const list = traffic || [];
      const live = new Set();
      let hitSide = 0;
      const crashed = !self || self.crashedTicks > 0 || self.segmentId === -1;
      for (const t of list) {
        live.add(t.id);
        if (crashed) continue;
        if (t.segmentId !== self.segmentId) continue;
        const dz = Math.abs(t.roadZ - self.roadZ);
        const dx = Math.abs(t.laneX - self.laneX);
        if (dz < CAR_LENGTH && dx >= CAR_WIDTH && dx < NEAR_WIDTH && !fired.has(t.id)) {
          fired.add(t.id);
          if (hitSide === 0) hitSide = t.laneX < self.laneX ? -1 : 1;
        }
      }
      // Bound the set: forget ids that have despawned out of the traffic list.
      for (const id of [...fired]) if (!live.has(id)) fired.delete(id);

      if (hitSide !== 0 && now - lastFire >= COOLDOWN_MS) {
        lastFire = now;
        flash = { side: hitSide, start: now };
        return 1;
      }
      return 0;
    },

    // A short white speed-streak fading in from the edge the car passed on.
    draw(g, view, now) {
      const t = now - flash.start;
      if (t < 0 || t >= STREAK_MS || flash.side === 0) return;
      const a = (1 - t / STREAK_MS) * 0.5;
      const w = view.w * 0.16;
      const left = flash.side < 0;
      const x0 = left ? 0 : view.w - w;
      const grad = g.createLinearGradient(left ? 0 : view.w, 0, left ? w : view.w - w, 0);
      grad.addColorStop(0, `rgba(255,255,255,${a})`);
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.save();
      g.fillStyle = grad;
      g.fillRect(x0, 0, w, view.h);
      g.restore();
    },
  };
}
