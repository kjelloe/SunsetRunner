import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, relative } from "node:path";
import { startServer } from "../server/index.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Kept in sync with SERVE_DIRS in server/index.js — the dirs the host serves.
const SERVED = new Set(["client", "shared", "engine", "data"]);

function clientImportTargets() {
  const dir = resolve(repoRoot, "client");
  const targets = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".js"))) {
    const src = readFileSync(resolve(dir, file), "utf8");
    for (const m of src.matchAll(/(?:import|export)[^"']*from\s*["']([^"']+)["']/g)) {
      const spec = m[1];
      if (!spec.startsWith(".")) continue; // bare/builtin — n/a in browser here
      targets.push({ file, spec, abs: resolve(dir, spec) });
    }
  }
  return targets;
}

test("every client import resolves inside a served directory", () => {
  for (const { file, spec, abs } of clientImportTargets()) {
    const top = relative(repoRoot, abs).split(/[/\\]/)[0];
    assert.ok(
      SERVED.has(top),
      `client/${file} imports "${spec}" -> ${top}/, which the static host does NOT serve. ` +
      `Move shared contract into shared/ (this is the server/protocol.js regression).`
    );
  }
});

test("static host serves client-imported modules with a JS MIME type", async () => {
  const h = await startServer(0);
  try {
    const base = `http://localhost:${h.port}`;
    for (const path of ["/client/main.js", "/client/session_remote.js", "/shared/protocol.js", "/engine/reducer.js"]) {
      const res = await fetch(base + path);
      assert.equal(res.status, 200, `${path} should be 200`);
      assert.match(res.headers.get("content-type") || "", /javascript/, `${path} needs a JS MIME`);
    }
    const html = await fetch(`${base}/`);
    assert.equal(html.status, 200);
    assert.match(html.headers.get("content-type") || "", /html/);
    const data = await fetch(`${base}/data/roads.json`);
    assert.match(data.headers.get("content-type") || "", /json/);
  } finally {
    await h.close();
  }
});

// Deploy 404 guard (marker-0156): the page is served at "/" (not only at
// /client/index.html), so its entry <script src> must RESOLVE against "/" to a
// served file. A relative "./main.js" resolved to /main.js -> 404 -> dead game.
test("the entry script referenced by / actually resolves and is served", async () => {
  const h = await startServer(0);
  try {
    const base = `http://localhost:${h.port}`;
    const body = await (await fetch(`${base}/`)).text();
    const m = body.match(/<script[^>]*\bsrc=["']([^"']+)["']/i);
    assert.ok(m, "index.html must have a <script src>");
    const resolved = new URL(m[1], `${base}/`).href; // resolve like the browser at "/"
    const res = await fetch(resolved);
    assert.equal(res.status, 200, `entry script "${m[1]}" -> ${resolved} must be served (was 404 at /)`);
    assert.match(res.headers.get("content-type") || "", /javascript/);
  } finally {
    await h.close();
  }
});

test("health endpoint answers 200 ok for the deploy guard", async () => {
  const h = await startServer(0, { host: "127.0.0.1" });
  try {
    for (const path of ["/health", "/healthz"]) {
      const res = await fetch(`http://127.0.0.1:${h.port}${path}`);
      assert.equal(res.status, 200, `${path} should be 200`);
      assert.equal((await res.text()).trim(), "ok");
    }
  } finally {
    await h.close();
  }
});
