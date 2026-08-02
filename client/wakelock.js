// client/wakelock.js — keep the screen awake while driving (a racer's inputs are
// too intermittent to hold the phone awake). Wake locks release when the tab is
// hidden, so re-request on visibility and on the first user gesture. Best-effort:
// unsupported browsers / rejected requests are silent no-ops. nav/doc injectable
// for headless tests. See specs/36.

export function installWakeLock(
  nav = typeof navigator !== "undefined" ? navigator : null,
  doc = typeof document !== "undefined" ? document : null,
) {
  if (!nav || !nav.wakeLock) return { get held() { return false; }, release() {} };
  let sentinel = null;

  async function request() {
    if (sentinel) return;
    try {
      sentinel = await nav.wakeLock.request("screen");
      if (sentinel && typeof sentinel.addEventListener === "function") {
        sentinel.addEventListener("release", () => { sentinel = null; });
      }
    } catch { /* not visible / no gesture yet — retry on next event */ }
  }

  request();
  if (doc) {
    doc.addEventListener("visibilitychange", () => {
      if (doc.visibilityState === "visible") request();
    });
    doc.addEventListener("pointerdown", request, { once: true });
    doc.addEventListener("keydown", request, { once: true });
  }

  return {
    get held() { return sentinel != null; },
    release() { try { sentinel?.release(); } catch { /* noop */ } sentinel = null; },
  };
}
