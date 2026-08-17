// client/initials_entry.js — old-school arcade high-score initials entry (CLIENT
// ONLY). No text typing. Keyboard: ◄ ► move between 5 slots, ▲ ▼ cycle the
// capital letter, ENTER confirms. Touch: tap a slot to select it, on-screen ▲ ▼
// change its letter, ENTER advances to the next slot and confirms after the 5th.
// Fed by input.js readMenuNav and by tap() from main.js's pointer handler.

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ.-"; // trailing "." / "-" as pad chars
const SLOTS = 5;

function inRect(r, x, y) {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

// One source of truth for slot + button geometry, shared by draw() and tap().
export function initialsLayout(view) {
  const w = view.w;
  const h = view.h;
  const box = Math.min(w, h) * 0.13;
  const gap = box * 0.28;
  const totalW = SLOTS * box + (SLOTS - 1) * gap;
  const x0 = w / 2 - totalW / 2;
  const cy = h * 0.44;
  const cells = [];
  for (let i = 0; i < SLOTS; i++) {
    cells.push({ x: x0 + i * (box + gap), y: cy - box / 2, w: box, h: box });
  }
  // Control row below the slots: ▲  ▼  ENTER.
  const bh = box * 0.82;
  const upW = box * 0.9;
  const enterW = box * 1.6;
  const bgap = box * 0.35;
  const rowW = upW * 2 + enterW + bgap * 2;
  const bx0 = w / 2 - rowW / 2;
  const by = h * 0.66;
  const up = { x: bx0, y: by, w: upW, h: bh, label: "▲" };
  const down = { x: bx0 + upW + bgap, y: by, w: upW, h: bh, label: "▼" };
  const enter = { x: bx0 + upW * 2 + bgap * 2, y: by, w: enterW, h: bh, label: "ENTER" };
  return { box, cells, up, down, enter, cy };
}

export function createInitialsEntry(seed = "AAA") {
  // Pre-fill from a seed name (e.g. the remembered player name), padded with "A".
  const slots = [];
  for (let i = 0; i < SLOTS; i++) {
    const ch = (seed[i] || "A").toUpperCase();
    const idx = ALPHABET.indexOf(ch);
    slots.push(idx >= 0 ? idx : 0);
  }
  let cursor = 0;
  let done = false;

  // Returns true once the player has confirmed. Events: left/right/up/down,
  // "confirm" (keyboard Enter = done now), "enter" (touch = advance, then done
  // after the last slot).
  function handle(ev) {
    if (done) return true;
    if (ev === "left") cursor = Math.max(0, cursor - 1);
    else if (ev === "right") cursor = Math.min(SLOTS - 1, cursor + 1);
    else if (ev === "up") slots[cursor] = (slots[cursor] + 1) % ALPHABET.length;
    else if (ev === "down") slots[cursor] = (slots[cursor] - 1 + ALPHABET.length) % ALPHABET.length;
    else if (ev === "confirm") done = true;
    else if (ev === "enter") { if (cursor < SLOTS - 1) cursor++; else done = true; }
    return done;
  }

  // Touch: map a canvas-space tap to an action. Returns true once confirmed.
  function tap(view, x, y) {
    if (done) return true;
    const L = initialsLayout(view);
    for (let i = 0; i < SLOTS; i++) {
      if (inRect(L.cells[i], x, y)) { cursor = i; return false; }
    }
    if (inRect(L.up, x, y)) return handle("up");
    if (inRect(L.down, x, y)) return handle("down");
    if (inRect(L.enter, x, y)) return handle("enter");
    return false;
  }

  function text() {
    const s = slots.map((i) => ALPHABET[i]).join("").replace(/[.\-]+$/g, "").trim();
    return s.length ? s : "AAA";
  }

  function draw(g, view) {
    const w = view.w;
    const h = view.h;
    const L = initialsLayout(view);
    // Dim the scene behind the entry.
    g.fillStyle = "rgba(10,6,20,0.72)";
    g.fillRect(0, 0, w, h);

    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "#ffd24a";
    g.font = `bold ${Math.round(h * 0.075)}px monospace`;
    g.fillText("NEW HIGH SCORE!", w / 2, h * 0.20);
    g.fillStyle = "#e8e8f0";
    g.font = `bold ${Math.round(h * 0.038)}px monospace`;
    g.fillText("ENTER YOUR INITIALS", w / 2, h * 0.30);

    const box = L.box;
    for (let i = 0; i < SLOTS; i++) {
      const c = L.cells[i];
      const active = i === cursor;
      g.fillStyle = active ? "rgba(255,210,74,0.18)" : "rgba(255,255,255,0.06)";
      g.fillRect(c.x, c.y, c.w, c.h);
      g.strokeStyle = active ? "#ffd24a" : "#5a5a72";
      g.lineWidth = Math.max(2, box * 0.04);
      g.strokeRect(c.x, c.y, c.w, c.h);
      g.fillStyle = active ? "#ffffff" : "#c8c8d8";
      g.font = `bold ${Math.round(box * 0.66)}px monospace`;
      g.fillText(ALPHABET[slots[i]], c.x + c.w / 2, c.y + c.h / 2 + box * 0.02);
    }

    // On-screen buttons (also usable with a mouse; keyboard still works).
    for (const b of [L.up, L.down, L.enter]) {
      g.fillStyle = "rgba(255,255,255,0.10)";
      g.fillRect(b.x, b.y, b.w, b.h);
      g.strokeStyle = "#7a7a92";
      g.lineWidth = Math.max(2, box * 0.03);
      g.strokeRect(b.x, b.y, b.w, b.h);
      g.fillStyle = "#ffd24a";
      g.font = `bold ${Math.round(b.h * (b.label.length > 1 ? 0.34 : 0.5))}px monospace`;
      g.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2);
    }

    g.fillStyle = "#9a9ab0";
    g.font = `${Math.round(h * 0.028)}px monospace`;
    g.fillText("tap a slot · ▲ ▼ letter · ENTER = next", w / 2, h * 0.82);
    g.textAlign = "left";
    g.textBaseline = "alphabetic";
  }

  return { handle, tap, text, draw, isDone: () => done };
}
