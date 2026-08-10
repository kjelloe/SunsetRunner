// client/crash_feel.js — client-only crash impact feedback: a short decaying
// screen shake plus a red impact vignette when the LOCAL car crashes. Purely
// presentation (the engine already owns the crash + stun); the caller triggers
// it on the crash edge it detects for audio. Floats/Math are fine here — this is
// the client's float Canvas layer, never engine/shared.

const SHAKE_MS = 420;
const FLASH_MS = 260;

export function createCrashFeel() {
  let start = -1e9;

  return {
    trigger(now) { start = now; },
    reset() { start = -1e9; },
    active(now) { return now - start < Math.max(SHAKE_MS, FLASH_MS); },

    // Decaying camera shake. Amplitude scales with view height so it reads the
    // same at any buffer size/DPR; two incommensurate frequencies keep it from
    // looking like a clean sine. Returns integer pixel offsets to translate the
    // scene by before rendering.
    shake(now, view) {
      const t = now - start;
      if (t < 0 || t >= SHAKE_MS) return { dx: 0, dy: 0 };
      const k = 1 - t / SHAKE_MS;          // 1 -> 0
      const amp = view.h * 0.02 * k * k;   // ease-out
      const dx = Math.sin(t * 0.09) * amp;
      const dy = Math.cos(t * 0.13) * amp * 0.7;
      return { dx: Math.round(dx), dy: Math.round(dy) };
    },

    // Red radial impact flash: strong at the edges, clear at the centre so the
    // road stays readable. Draw over the (shaken) scene.
    draw(g, view, now) {
      const t = now - start;
      if (t < 0 || t >= FLASH_MS) return;
      const a = (1 - t / FLASH_MS) * 0.5;  // 0.5 -> 0
      const cx = view.w / 2, cy = view.h / 2;
      const grad = g.createRadialGradient(cx, cy, view.h * 0.2, cx, cy, view.h * 0.78);
      grad.addColorStop(0, "rgba(255,40,20,0)");
      grad.addColorStop(1, `rgba(255,40,20,${a})`);
      g.save();
      g.fillStyle = grad;
      g.fillRect(0, 0, view.w, view.h);
      g.restore();
    },
  };
}
