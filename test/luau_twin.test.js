import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Cross-language contract: the Luau twin must recompute every spine golden
// vector byte-identically. Skips (not fails) when lune is unavailable, so the
// JS suite stays runnable on machines without the Luau toolchain.
test("luau twin matches JS golden vectors (via lune)", () => {
  let out;
  try {
    out = execFileSync("lune", ["run", "luau/spine-check.luau"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
  } catch (err) {
    if (err.code === "ENOENT") {
      console.log("lune not installed — skipping Luau parity gate");
      return;
    }
    assert.fail(`lune parity gate failed:\n${err.stdout || ""}${err.stderr || ""}`);
  }
  assert.match(out, /LUAU PARITY OK/);
});
