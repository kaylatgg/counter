// Shared helpers for the browser regression tests. See README.md.
import { createRequire } from "module";
import { fileURLToPath } from "url";
import fs from "fs";
import os from "os";
import path from "path";
import pw from "playwright-core";

const require = createRequire(import.meta.url);
const AXE = require.resolve("axe-core/axe.min.js");

// The site is opened straight from the file, as a person would open index.html.
export const BASE = new URL("../../index.html", import.meta.url).href;
const list = (text, fallback) => (text ? text.split(",").map((s) => s.trim()).filter(Boolean) : fallback);
// E2E_BROWSERS=chromium and E2E_WIDTHS=390,1440 make a quicker run.
export const WIDTHS = list(process.env.E2E_WIDTHS, ["320", "390", "768", "1024", "1440"]).map(Number);
export const BROWSERS = list(process.env.E2E_BROWSERS, ["chromium", "webkit"]);

// Extra notes (measurements, tab orders) go to a temp folder, never the repo.
export const OUT = path.join(os.tmpdir(), "counter-e2e");
fs.mkdirSync(OUT, { recursive: true });
export function log(file, line) { fs.appendFileSync(path.join(OUT, file), line + "\n"); }

export const findings = [];
export function note(ctx, where, what, severity = "?") {
  findings.push({ browser: ctx.browser, width: ctx.width, where, what, severity });
  console.log(`  !! ${ctx.browser} ${ctx.width} | ${where} | ${what}`);
}

const browsers = {};
export async function open(browser, width, opts = {}) {
  browsers[browser] = browsers[browser] || await pw[browser].launch();
  const context = await browsers[browser].newContext({
    viewport: { width, height: width < 760 ? 844 : 900 },
    reducedMotion: opts.motion ? "no-preference" : "reduce",
    acceptDownloads: true,
  });
  if (browser === "chromium") await context.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {});
  if (opts.init) await context.addInitScript(opts.init);
  const page = await context.newPage();
  const ctx = { browser, width, page, context, errors: [] };
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") ctx.errors.push(m.type() + ": " + m.text()); });
  page.on("pageerror", (e) => ctx.errors.push("pageerror: " + e.message));
  return ctx;
}

// A fresh start: empty storage, then the page at the given address.
export async function fresh(ctx, hash = "") {
  await ctx.page.goto(BASE);
  await ctx.page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await ctx.page.goto("about:blank");
  await ctx.page.goto(BASE + hash);
  await ctx.page.evaluate(() => document.fonts && document.fonts.ready);
  await ctx.page.waitForTimeout(150);
}

// The page must never scroll sideways. (Screen 1's glow reaches past the
// window but is clipped, so this tries to scroll rather than comparing widths.)
export async function sideways(ctx, where) {
  const x = await ctx.page.evaluate(() => { const y = scrollY; scrollTo(50, y); const sx = scrollX; scrollTo(0, y); return sx; });
  if (x > 0) note(ctx, where, `page scrolls sideways by ${x}px`, "high");
}

export async function badText(ctx, where) {
  const bad = await ctx.page.evaluate(() => {
    const t = document.body.innerText;
    return ["NaN", "Infinity", "undefined", "null", "[object", "—"].filter((w) => t.includes(w));
  });
  if (bad.length) note(ctx, where, "visible text contains " + bad.join(", "), "high");
}

export async function flushErrors(ctx, where) {
  // axe reads stylesheets over XHR, which file:// pages block; that's axe, not Counter.
  const errs = ctx.errors.filter((e) => !/favicon|ERR_FILE_NOT_FOUND|fonts\.g|styles\.css|preload assets|net::ERR_FAILED|Cross origin requests are only supported/.test(e));
  if (errs.length) note(ctx, where, "console: " + [...new Set(errs)].slice(0, 3).join(" || "), "high");
  ctx.errors.length = 0;
}

export async function axe(ctx, where) {
  await ctx.page.addScriptTag({ path: AXE }).catch(() => {});
  const v = await ctx.page.evaluate(async () => (await axe.run(document, { resultTypes: ["violations"] })).violations.map((x) => x.id + " (" + x.nodes.map((n) => n.target.join(" ")).slice(0, 2).join(", ") + ")"));
  if (v.length) note(ctx, where, "axe: " + v.join("; "), "medium");
}

export async function tap(ctx, sel) {
  const el = ctx.page.locator(sel).first();
  await el.scrollIntoViewIfNeeded();
  await el.click();
}

// Types into a field the way a person does (select what's there, then type).
export async function typeInto(ctx, sel, text) {
  await ctx.page.click(sel, { clickCount: 3 });
  await ctx.page.keyboard.type(text);
}

export async function closeAll() { for (const b of Object.values(browsers)) await b.close(); }

// Prints the count and fails the run (exit code 1) when anything was found.
export function report(name) {
  console.log(`\n${name}: ${findings.length} findings`);
  if (findings.length) process.exitCode = 1;
}

// Runs fn once per browser and width. A test's own widths are used as given,
// unless E2E_WIDTHS is set: then they filter that list.
export async function forEachConfig(fn, { widths, opts } = {}) {
  const ws = !widths ? WIDTHS : process.env.E2E_WIDTHS ? WIDTHS.filter((w) => widths.includes(w)) : widths;
  for (const b of BROWSERS) for (const w of (ws.length ? ws : WIDTHS)) {
    const ctx = await open(b, w, opts);
    console.log(`-- ${b} ${w}`);
    try { await fn(ctx); } catch (e) { note(ctx, "test", "threw: " + e.message.split("\n")[0], "?"); }
    await flushErrors(ctx, "end");
    await ctx.context.close();
  }
}
