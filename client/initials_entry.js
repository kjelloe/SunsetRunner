// client/initials_entry.js — old-school arcade high-score initials entry (CLIENT
// ONLY). No text typing: ◄ ► move between 5 slots, ▲ ▼ cycle the capital letter,
// ENTER confirms. Fed by input.js readMenuNav ("left"/"right"/"up"/"down"/"confirm").

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ.-"; // trailing "." / "-" as pad chars
const SLOTS = 5;

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

  // Returns true once the player has confirmed.
  function handle(ev) {
    if (done) return true;
    if (ev === "left") cursor = Math.max(0, cursor - 1);
    else if (ev === "right") cursor = Math.min(SLOTS - 1, cursor + 1);
    else if (ev === "up") slots[cursor] = (slots[cursor] + 1) % ALPHABET.length;
    else if (ev === "down") slots[cursor] = (slots[cursor] - 1 + ALPHABET.length) % ALPHABET.length;
    else if (ev === "confirm") done = true;
    return done;
  }

  function text() {
    const s = slots.map((i) => ALPHABET[i]).join("").replace(/[.\-]+$/g, "").trim();
    return s.length ? s : "AAA";
  }

  function draw(g, view) {
    const w = view.w;
    const h = view.h;
    // Dim the scene behind the entry.
    g.fillStyle = "rgba(10,6,20,0.72)";
    g.fillRect(0, 0, w, h);

    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "#ffd24a";
    g.font = `bold ${Math.round(h * 0.075)}px monospace`;
    g.fillText("NEW HIGH SCORE!", w / 2, h * 0.24);
    g.fillStyle = "#e8e8f0";
    g.font = `bold ${Math.round(h * 0.038)}px monospace`;
    g.fillText("ENTER YOUR INITIALS", w / 2, h * 0.34);

    const box = Math.min(w, h) * 0.13; // slot size
    const gap = box * 0.28;
    const totalW = SLOTS * box + (SLOTS - 1) * gap;
    const x0 = w / 2 - totalW / 2;
    const y = h * 0.52;
    for (let i = 0; i < SLOTS; i++) {
      const bx = x0 + i * (box + gap);
      const active = i === cursor;
      g.fillStyle = active ? "rgba(255,210,74,0.18)" : "rgba(255,255,255,0.06)";
      g.fillRect(bx, y - box / 2, box, box);
      g.strokeStyle = active ? "#ffd24a" : "#5a5a72";
      g.lineWidth = Math.max(2, box * 0.04);
      g.strokeRect(bx, y - box / 2, box, box);
      // the letter
      g.fillStyle = active ? "#ffffff" : "#c8c8d8";
      g.font = `bold ${Math.round(box * 0.66)}px monospace`;
      g.fillText(ALPHABET[slots[i]], bx + box / 2, y + box * 0.02);
      // up/down triangles on the active slot
      if (active) {
        g.fillStyle = "#ffd24a";
        const t = box * 0.16;
        g.beginPath(); // up
        g.moveTo(bx + box / 2, y - box / 2 - t * 1.4);
        g.lineTo(bx + box / 2 - t, y - box / 2 - t * 0.2);
        g.lineTo(bx + box / 2 + t, y - box / 2 - t * 0.2);
        g.closePath();
        g.fill();
        g.beginPath(); // down
        g.moveTo(bx + box / 2, y + box / 2 + t * 1.4);
        g.lineTo(bx + box / 2 - t, y + box / 2 + t * 0.2);
        g.lineTo(bx + box / 2 + t, y + box / 2 + t * 0.2);
        g.closePath();
        g.fill();
      }
    }

    g.fillStyle = "#9a9ab0";
    g.font = `${Math.round(h * 0.03)}px monospace`;
    g.fillText("◄ ► move    ▲ ▼ letter    ENTER = OK", w / 2, h * 0.72);
    g.textAlign = "left";
    g.textBaseline = "alphabetic";
  }

  return { handle, text, draw, isDone: () => done };
}
