// Screen 1 doesn't shift while it loads: right on the first paint.
// Two loads per width: as a file (the way the other tests open it), and over a
// slow network (scripts 300ms late, fonts 600ms late), where the page paints
// before the scripts run and before Geist arrives.
// Chromium: total layout shift (CLS) must be 0.05 or less.
// WebKit has no layout-shift entries, so it compares where the header, the Save
// button, the heading, the intro, and the steppers are in the first painted
// frame and once settled: none may move more than 2px.
// Then the same for opening a saved Working project on screen 2 (#p/w1/result):
// the stage bar, the project hero, and its stats stay put once they show.
import fs from "fs";
import { fileURLToPath } from "url";
import { forEachConfig, note, closeAll, report, log, BASE } from "./lib.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SLOW = "http://counter.test/index.html";
const TYPES = { html: "text/html", js: "text/javascript", css: "text/css", woff2: "font/woff2", png: "image/png", svg: "image/svg+xml" };
const MOVING = ["header.topbar", "#save-project", "#page-title", ".lede", ".steppers"];
const PROJECT_MOVING = ["#stage-row", "#project-hero", "#project-stats", "#project-rates-title"];
const WORKING = { stage: "working", quotedAt: "2026-11-20T10:00:00.000Z", workingAt: "2026-11-21T10:00:00.000Z", paidAt: null,
  agreedCents: 27000, plannedHours: 10, expensesCents: 2000, targetCents: 2500, requests: [], receivedCents: null, actualHours: null };
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function watch(moving) {
  window.__shift = { total: 0, sources: [] };
  if (window.PerformanceObserver && PerformanceObserver.supportedEntryTypes && PerformanceObserver.supportedEntryTypes.includes("layout-shift")) {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.hadRecentInput) continue;
        window.__shift.total += e.value;
        (e.sources || []).forEach((s) => {
          const n = s.node;
          window.__shift.sources.push(!n ? "?" : n.nodeType === 3 ? "text" : n.tagName.toLowerCase() + (n.id ? "#" + n.id : ""));
        });
      }
    }).observe({ type: "layout-shift", buffered: true });
  }
  // Positions per frame, for engines without layout-shift entries.
  window.__frames = [];
  const start = performance.now();
  (function tick() {
    if (moving.every((s) => document.querySelector(s))) {
      window.__frames.push(moving.map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return [r.left, r.top, r.width, r.height];
      }));
    }
    if (performance.now() - start < 2500) requestAnimationFrame(tick);
  })();
}

await forEachConfig(async (ctx) => {
  const p = ctx.page;
  await ctx.context.addInitScript(watch, MOVING.concat(PROJECT_MOVING));
  // The repo folder served at http://counter.test/, with scripts and fonts held back.
  await ctx.context.route("http://counter.test/**", async (route) => {
    const file = ROOT + decodeURIComponent(new URL(route.request().url()).pathname.slice(1));
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: "" });
    if (file.endsWith(".js")) await wait(300);
    if (file.endsWith(".woff2")) await wait(600);
    return route.fulfill({ status: 200, contentType: TYPES[file.split(".").pop()] || "application/octet-stream", body: fs.readFileSync(file) });
  });
  for (const [how, url] of [["as a file", BASE], ["slow network", SLOW]]) {
    await p.goto(url);
    await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await p.goto("about:blank");
    await p.goto(url);
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(2600);
    const { shift, frames } = await p.evaluate(() => ({ shift: window.__shift, frames: window.__frames }));
    if (ctx.browser === "chromium") {
      log("load-shift.txt", `${ctx.browser} ${ctx.width} ${how}: ${shift.total.toFixed(4)}`);
      if (shift.total > 0.05) note(ctx, "screen 1 load, " + how, `layout shift ${shift.total.toFixed(3)} (moved: ${[...new Set(shift.sources)].join(", ")})`, "high");
    } else {
      if (!frames.length) { note(ctx, "screen 1 load, " + how, "no frames recorded", "high"); continue; }
      const first = frames[0], last = frames[frames.length - 1];
      MOVING.forEach((sel, i) => {
        const moved = Math.max(...first[i].map((v, k) => Math.abs(v - last[i][k])));
        if (moved > 2) note(ctx, "screen 1 load, " + how, `${sel} moved ${Math.round(moved)}px after the first paint`, "high");
      });
    }
  }

  // A Working project opened straight onto screen 2.
  for (const [how, url] of [["as a file", BASE], ["slow network", SLOW]]) {
    await p.goto(url);
    await p.evaluate((timeline) => {
      localStorage.clear();
      const project = Object.assign(projectStore.createProject("Luigi's menu", projectStore.exampleDraft("menu"), "w1", new Date("2026-11-20T10:00:00Z")), { timeline });
      localStorage.setItem("counter.v2", JSON.stringify({ version: 3, projects: [project] }));
    }, WORKING);
    await p.goto("about:blank");
    await p.goto(url + "#p/w1/result");
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(2600);
    const { shift, frames, shown } = await p.evaluate(() => ({ shift: window.__shift, frames: window.__frames, shown: !document.getElementById("project-hero").hidden }));
    if (!shown) note(ctx, "working project load, " + how, "project hero not showing", "high");
    if (ctx.browser === "chromium") {
      log("load-shift.txt", `${ctx.browser} ${ctx.width} working project ${how}: ${shift.total.toFixed(4)}`);
      if (shift.total > 0.05) note(ctx, "working project load, " + how, `layout shift ${shift.total.toFixed(3)} (moved: ${[...new Set(shift.sources)].join(", ")})`, "high");
    } else {
      PROJECT_MOVING.forEach((sel, j) => {
        const i = MOVING.length + j;
        // From the first frame it shows in (it's hidden until the scripts route).
        const first = frames.find((f) => f[i][2] > 0 && f[i][3] > 0);
        const last = frames[frames.length - 1];
        if (!first) { note(ctx, "working project load, " + how, sel + " never showed", "high"); return; }
        const moved = Math.max(...first[i].map((v, k) => Math.abs(v - last[i][k])));
        if (moved > 2) note(ctx, "working project load, " + how, `${sel} moved ${Math.round(moved)}px after it first showed`, "high");
      });
    }
  }
}, { widths: [360, 390, 1440] });
report("load-shift"); await closeAll();
