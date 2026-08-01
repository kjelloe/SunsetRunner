// client/celebration.js — finish splash: confetti + fireworks (CLIENT ONLY).
// Cosmetic overlay, driven each frame; uses Math.random (fine — presentation, not
// the deterministic engine). Pure of DOM: draw(g, view) takes the 2D context.

const COLORS = ["#ff5252", "#ffd54a", "#4ade80", "#4aa3ff", "#c46bff", "#ff8f3f"];
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export function createCelebration() {
  const confetti = [];
  const sparks = [];
  let active = false;
  let frame = 0;

  function spawnConfetti(view) {
    for (let i = 0; i < 180; i++) {
      confetti.push({
        x: rnd(0, view.w), y: rnd(-view.h, 0),
        vx: rnd(-0.5, 0.5), vy: rnd(1.5, 4.5),
        w: rnd(5, 11), h: rnd(8, 16), rot: rnd(0, 6.28), vr: rnd(-0.2, 0.2),
        color: pick(COLORS),
      });
    }
  }

  function burst(view) {
    const cx = rnd(view.w * 0.2, view.w * 0.8);
    const cy = rnd(view.h * 0.12, view.h * 0.45);
    const color = pick(COLORS);
    const n = 40;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const sp = rnd(2, 5.5);
      sparks.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, color });
    }
  }

  return {
    get active() { return active; },
    get confettiCount() { return confetti.length; },
    get sparkCount() { return sparks.length; },

    trigger(view) {
      if (active) return;
      active = true;
      frame = 0;
      spawnConfetti(view);
      burst(view);
    },

    update(view) {
      if (!active) return;
      frame++;
      for (const c of confetti) {
        c.x += c.vx; c.y += c.vy; c.rot += c.vr;
        if (c.y > view.h + 20) { c.y = rnd(-40, -10); c.x = rnd(0, view.w); }
      }
      if (frame % 22 === 0) burst(view); // a new firework roughly every second
      for (const s of sparks) { s.x += s.vx; s.y += s.vy; s.vy += 0.06; s.life -= 0.02; }
      for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].life <= 0) sparks.splice(i, 1);
    },

    draw(g, view) {
      if (!active) return;
      for (const s of sparks) {
        g.globalAlpha = Math.max(0, s.life);
        g.fillStyle = s.color;
        g.fillRect(s.x - 2, s.y - 2, 4, 4);
      }
      g.globalAlpha = 1;
      for (const c of confetti) {
        g.save();
        g.translate(c.x, c.y);
        g.rotate(c.rot);
        g.fillStyle = c.color;
        g.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
        g.restore();
      }
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = `bold ${Math.floor(view.h * 0.16)}px sans-serif`;
      const bx = view.w / 2;
      const by = view.h * 0.4;
      g.fillStyle = "rgba(0,0,0,0.35)";
      g.fillText("FINISH!", bx + 4, by + 4);
      const grd = g.createLinearGradient(0, by - 60, 0, by + 60);
      grd.addColorStop(0, "#fff2a8");
      grd.addColorStop(1, "#ffb347");
      g.fillStyle = grd;
      g.fillText("FINISH!", bx, by);
      g.textAlign = "left";
      g.textBaseline = "top";
    },

    reset() { active = false; confetti.length = 0; sparks.length = 0; frame = 0; },
  };
}
