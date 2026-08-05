import { test } from "node:test";
import assert from "node:assert/strict";
import { drawLobby, lobbyTouchZone, inviteUrl } from "../client/lobby.js";

test("lobbyTouchZone: start/wait/invite columns, closeqr when QR is open", () => {
  const view = { w: 900, h: 540 };
  assert.equal(lobbyTouchZone(view, 100, false), "start");
  assert.equal(lobbyTouchZone(view, 450, false), "wait");
  assert.equal(lobbyTouchZone(view, 800, false), "invite");
  assert.equal(lobbyTouchZone(view, 450, true), "closeqr");
});

test("inviteUrl points at ?mode=remote", () => {
  assert.match(inviteUrl(), /\?mode=remote$/);
});

function rec() {
  const texts = [];
  const g = new Proxy({}, {
    get: (_, k) => {
      if (["fillStyle", "strokeStyle", "lineWidth", "font", "textAlign", "textBaseline"].includes(k)) return "";
      if (k === "fillText") return (t) => texts.push(String(t));
      return () => {};
    },
    set: () => true,
  });
  return { g, texts };
}

test("drawLobby renders the countdown, players and buttons; QR panel on demand", () => {
  const a = rec();
  drawLobby(a.g, { w: 960, h: 540 }, { active: true, seconds: 20, paused: false, players: ["Ada", "Bo"] });
  assert.ok(a.texts.includes("LOBBY"));
  assert.ok(a.texts.some((t) => t.includes("STARTS IN 20s")));
  assert.ok(a.texts.includes("START NOW") && a.texts.includes("INVITE"));
  const b = rec();
  drawLobby(b.g, { w: 960, h: 540 }, { active: true, seconds: 5, paused: true, players: ["Ada"] }, { showQR: true, url: "http://x/?mode=remote" });
  assert.ok(b.texts.includes("SCAN TO JOIN"));
  assert.ok(b.texts.some((t) => t.includes("mode=remote")));
});
