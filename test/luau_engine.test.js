import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Cross-language ENGINE contract: the Luau engine twin must reproduce the
// engine goldens (hashes + census) byte-identically. Skips when lune is
// unavailable so the JS suite stays runnable without the Luau toolchain.
function runLuauGate(script, okMarker) {
  let out;
  try {
    out = execFileSync("lune", ["run", script], { cwd: repoRoot, encoding: "utf8" });
  } catch (err) {
    if (err.code === "ENOENT") {
      console.log(`lune not installed — skipping ${script}`);
      return;
    }
    assert.fail(`lune gate ${script} failed:\n${err.stdout || ""}${err.stderr || ""}`);
  }
  assert.match(out, okMarker);
}

test("luau engine twin reproduces checkpoint_1a (via lune)", () => {
  runLuauGate("luau/checkpoint-1a-check.luau", /LUAU ENGINE PARITY OK/);
});

test("luau engine twin reproduces collision_1a (via lune)", () => {
  runLuauGate("luau/collision-1a-check.luau", /LUAU COLLISION PARITY OK/);
});

test("luau engine twin reproduces fork_1a (via lune)", () => {
  runLuauGate("luau/fork-1a-check.luau", /LUAU FORK PARITY OK/);
});
