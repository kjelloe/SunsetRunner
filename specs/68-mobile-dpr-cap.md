# 68 — Cap effective DPR at 2 (mobile fill-cost win)

Established in `marker-0092`. Client-only (presentation), no engine change, no
golden repin. The single cheapest low-end perf win identified by the mobile
profile (`marker-0088`, `PERFORMANCE.md`).

## Why

Canvas-2D fill cost is quadratic in the backing-store pixel count. A modern phone
reports `devicePixelRatio` 3, so a 390-CSS-px viewport asks for a 1170-px-wide
backing store — and the profile showed this Canvas fill (not the ~0.04 ms engine)
is the dominant per-frame cost on mid/low-end devices. At arm's length the extra
sharpness of DPR 3 over DPR 2 is not resolvable, so the pixels are paid for and
not seen.

## Change

`client/viewport.js` `computeBufferSize(cssW, cssH, dpr, maxW, maxDpr = 2)` now
clamps the **effective** DPR to `maxDpr` (default 2) before scaling:
`eff = min(dpr, maxDpr)`. DPR 1 and 2 are unaffected; DPR 3 renders at 2. The
existing `maxW` (1920) width cap is unchanged and still bounds tablets/desktops.
`maxDpr` is exposed as a parameter so a caller can opt back into full DPR.

No call-site change: `main.js` already passes `window.devicePixelRatio`; the clamp
lives inside the pure function, so it is covered by `test/viewport.test.js`.

## Measured (npm run perf:mobile, 390×844 emulated @ device DPR 3)

| CPU | before (marker-0088) | after (this slice) |
|-----|----------------------|--------------------|
| 4×  | 16.0 ms p50 / 62 fps / 39% >16.7 ms | 10.0 ms p50 / 100 fps / 3% >16.7 ms |
| 6×  | 26.2 ms p50 / 38 fps / 100% >16.7 ms | 15.6 ms p50 / 64 fps / 30% >16.7 ms |

The mid tier goes from occasional jank to near-solid 100 fps; the low-end frame
time roughly halves and now holds 60 fps most of the time.

## Verified

`test/viewport.test.js` gains a case asserting the DPR-3→2 clamp (780 not 1170),
that DPR 1/2 are untouched, and that the cap is overridable. `npm test` → 292/292.
`npm run perf:mobile` reproduces the table above. No engine change, so the 4 Luau
parity gates are untouched.

## Not verified / deferred

Real-device feel (is DPR 2 visibly softer on a specific phone?) still needs the
`PLAYTEST.md` device pass. Remaining renderer wins (shorter draw distance on heavy
terrains, skipping the far fork ribbon) are logged in `PERFORMANCE.md`, not built.
