// client/viewport.js — size the canvas drawing buffer to the displayed size ×
// devicePixelRatio so it's crisp on retina/mobile (the 960 buffer was CSS-upscaled
// and soft). Pure + node-testable; keeps 16:9 and caps the buffer so a 4K/3× phone
// doesn't render a needlessly huge (slow) frame. See specs/36.

const MIN_W = 320;

export function computeBufferSize(cssW, cssH, dpr = 1, maxW = 1920) {
  const scaled = Math.round((cssW || 960) * (dpr || 1));
  const w = Math.max(MIN_W, Math.min(scaled, maxW));
  const h = Math.round((w * 9) / 16); // 16:9, derived from width
  return { w, h };
}
