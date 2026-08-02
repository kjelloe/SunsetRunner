// server/session_store.js — persist the race session to disk so a server restart
// (deploy) is a lossless handoff: save every few seconds + on shutdown, restore
// on boot if the file is younger than the grace window. Best-effort — any fs
// failure is non-fatal (never take the game down for a bad write). See specs/35.
// Keep the state file OUT of the deploy sync path, in a service-writable dir.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export function saveSession(path, room) {
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify({ savedAt: Date.now(), room: room.serialize() }));
    return true;
  } catch {
    return false; // quota / read-only fs — non-fatal
  }
}

// Returns the serialized room, or null if there's no file, it's unreadable, or
// it's older than maxAgeMs (every seat's grace would have expired anyway).
export function loadSession(path, maxAgeMs) {
  try {
    const data = JSON.parse(readFileSync(path));
    if (!data || typeof data.savedAt !== "number") return null;
    if (Date.now() - data.savedAt > maxAgeMs) return null;
    return data.room ?? null;
  } catch {
    return null;
  }
}
