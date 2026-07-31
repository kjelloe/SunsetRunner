import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Cross-language ENGINE contract: the Luau engine twin must reproduce the
// checkpoint_1a golden (hashes + census) byte-identically. Skips when lune is
// unavailable so the JS suite stays runnable without the Luau toolchain.
test("luau engine twin reproduces checkpoint_1a (via lune)", () => {
  let out;
  try {
    out = execFileSync("lune", ["run", "luau/checkpoint-1a-check.luau"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
  } catch (err) {
    if (err.code === "ENOENT") {
      console.log("lune not installed — skipping Luau engine parity gate");
      return;
    }
    assert.fail(`lune engine parity gate failed:\n${err.stdout || ""}${err.stderr || ""}`);
  }
  assert.match(out, /LUAU ENGINE PARITY OK/);
});
