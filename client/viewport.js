// client/viewport.js — size the canvas drawing buffer to the displayed size ×
// devicePixelRatio so it's crisp on retina/mobile (the 960 buffer was CSS-upscaled
// and soft). Pure + node-testable; keeps 16:9 and caps the buffer so a 4K/3× phone
// doesn't render a needlessly huge (slow) frame. See specs/36, specs/68.

const MIN_W = 320;
// Canvas-2D fill cost is quadratic in the backing-store pixel count, so a DPR-3
// phone pays ~2.25× the fill of DPR 2 for detail the eye can't resolve at arm's
// length. The mobile perf profile (marker-0088) showed this is the dominant
// low-end cost, so we cap the EFFECTIVE DPR here. DPR 1 and 2 are unaffected.
const MAX_DPR = 2;

export function computeBufferSize(cssW, cssH, dpr = 1, maxW = 1920, maxDpr = MAX_DPR) {
  const eff = Math.min(dpr || 1, maxDpr);
  const scaled = Math.round((cssW || 960) * eff);
  const w = Math.max(MIN_W, Math.min(scaled, maxW));
  const h = Math.round((w * 9) / 16); // 16:9, derived from width
  return { w, h };
}
