// The 12/8/4 column grid: every block starts and ends on a column edge
// (read from the ?grid overlay), on screen 1, screen 2, a Working project's
// screen 2, and Projects.
import { forEachConfig, note, closeAll, report, BASE, seedProjects } from "./lib.mjs";

// [name, selector, every match?, only "left" or "right" edge?]
const SCREENS = {
  "screen 1": ["", [["header", ".topbar-inner"], ["headline", ".inputs-top"], ["left column", ".inputs-columns > .inputs-column:first-child"], ["right column", ".inputs-columns > .inputs-column:last-child"], ["tally card", ".tally"], ["button", "#check-offer"], ["footer", ".site-footer p"]]],
  "screen 2": ["#result", [["header", ".topbar-inner"], ["edit details", "#edit-details", false, "left"], ["controls", ".control-bar", false, "right"], ["hero panel", "#hero-panel"], ["stat", "#metrics > div", true], ["chart", ".charts-row > .chart", true], ["show the math", ".math summary"], ["price/reply", ".results-pair > *", true], ["reply box", "#reply"], ["footer", ".site-footer p"]]],
  "working project": ["#p/w1/result", [["stage bar", ".stage-bar"], ["project hero", "#project-hero"], ["project stat", "#project-stats > div", true], ["rate bar", "#project-rate-bars .rate-track", true], ["your pricing", "#pricing-heading"], ["stat", "#metrics > div", true]]],
  projects: ["#projects", [["header", ".topbar-inner"], ["back pill", "#back-to-calc", false, "left"], ["title", "#projects-title", false, "left"], ["table", "#project-table"], ["footer", ".site-footer p"]]],
};

await forEachConfig(async (ctx) => {
  const p = ctx.page;
  await p.goto(BASE + "?grid"); await p.waitForTimeout(200);
  await p.evaluate(() => localStorage.clear());
  await seedProjects(p, await p.evaluate(() => [projectStore.createProject("Menu, Oct 11", projectStore.exampleDraft("menu"), "a1", new Date()),
    Object.assign(projectStore.createProject("Luigi's menu", projectStore.exampleDraft("menu"), "w1", new Date("2026-11-20T10:00:00Z")), { timeline: {
      stage: "working", quotedAt: "2026-11-20T10:00:00.000Z", workingAt: "2026-11-21T10:00:00.000Z", paidAt: null, agreedCents: 27000,
      plannedHours: 10, expensesCents: 2000, targetCents: 2500, requests: [], receivedCents: null, actualHours: null } })]));
  for (const [label, [hash, rows]] of Object.entries(SCREENS)) {
    await p.goto("about:blank"); await p.goto(BASE + "?grid" + hash); await p.waitForTimeout(400);
    const out = await p.evaluate((rows) => {
      const spans = [...document.querySelectorAll(".grid-overlay > span")].filter((s) => s.getClientRects().length).map((s) => s.getBoundingClientRect());
      const L = spans.map((r) => Math.round(r.left)), R = spans.map((r) => Math.round(r.right));
      const bad = [];
      for (const [name, sel, all, only] of rows) {
        let els = [...document.querySelectorAll(sel)].filter((e) => e.getClientRects().length && !e.closest("[hidden]"));
        if (!all) els = els.slice(0, 1);
        els.forEach((e, i) => {
          const b = e.getBoundingClientRect(), l = Math.round(b.left), r = Math.round(b.right);
          const okL = only === "right" || L.some((x) => Math.abs(x - l) <= 1);
          const okR = only === "left" || R.some((x) => Math.abs(x - r) <= 1);
          if (!okL || !okR) bad.push(`${name}${all ? " " + (i + 1) : ""} at ${l}-${r}`);
        });
      }
      return { columns: spans.length, bad };
    }, rows);
    const want = ctx.width < 760 ? 4 : ctx.width < 1024 ? 8 : 12;
    if (out.columns !== want) note(ctx, label, `${out.columns} columns, expected ${want}`, "high");
    out.bad.forEach((b) => note(ctx, label, "off the column edges: " + b, "medium"));
  }
  // Without ?grid there's no overlay.
  await p.goto("about:blank"); await p.goto(BASE); await p.waitForTimeout(150);
  if (await p.evaluate(() => document.querySelectorAll(".grid-overlay").length)) note(ctx, "no ?grid", "overlay shown", "high");
});
report("layout grid"); await closeAll();
