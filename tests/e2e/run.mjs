// Runs the browser regression tests one after another and prints a summary.
// Usage: node tests/e2e/run.mjs [name ...]   (no names runs them all)
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const here = path.dirname(fileURLToPath(import.meta.url));
const ALL = [
  "inputs", "offers", "result", "save-image", "share-link", "projects", "navigation",
  "storage", "accessibility", "huge-values", "one-tap", "hero-fit", "not-saved",
  "save-error-grid", "layout-grid", "chart-labels", "close-the-gap", "dashboard",
];
const names = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
const unknown = names.filter((n) => !ALL.includes(n));
if (unknown.length) {
  console.error("Unknown test: " + unknown.join(", ") + "\nTests: " + ALL.join(", "));
  process.exit(2);
}

const results = [];
for (const name of names) {
  console.log(`\n=== ${name}`);
  const started = Date.now();
  const run = spawnSync(process.execPath, [path.join(here, name + ".mjs")], { stdio: "inherit" });
  results.push({ name, ok: run.status === 0, seconds: Math.round((Date.now() - started) / 1000) });
}

console.log("\nBrowser tests");
results.forEach((r) => console.log(`  ${r.ok ? "PASS" : "FAIL"}  ${r.name} (${r.seconds}s)`));
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
