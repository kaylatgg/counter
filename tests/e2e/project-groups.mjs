// Projects grouped by stage: the Working, Quoted, and Paid tables, the stage
// pills, the rate bars and their target labels, "They said yes" on a Quoted
// row, read-only mode, and the layout at every width.
import { forEachConfig, fresh, note, tap, closeAll, report, sideways, badText, axe, seedProjects, BASE } from "./lib.mjs";

const working = (agreedCents, plannedHours, targetCents) => ({ stage: "working", quotedAt: "2026-11-10T10:00:00.000Z",
  workingAt: "2026-11-21T10:00:00.000Z", paidAt: null, agreedCents, plannedHours, expensesCents: 2000, targetCents,
  requests: [], receivedCents: null, actualHours: null });
const paid = (receivedCents, actualHours) => ({ stage: "paid", quotedAt: "2026-11-05T10:00:00.000Z",
  workingAt: "2026-11-07T10:00:00.000Z", paidAt: "2026-11-14T10:00:00.000Z", agreedCents: 27000, plannedHours: 11.5,
  expensesCents: 2000, targetCents: 2500, requests: [], receivedCents, actualHours });

// Saved projects, made in the page. Each spec: [id, name, job, timeline or
// null, extra inputs]. Edited dates go newest first in the order given.
async function seed(p, specs, options) {
  const list = await p.evaluate((specs) => specs.map(([id, name, job, timeline, inputs], i) => {
    const project = projectStore.createProject(name, projectStore.exampleDraft(job), id, new Date(Date.UTC(2026, 10, 20 - i, 10)));
    Object.assign(project.inputs, inputs || {});
    if (timeline) project.timeline = timeline;
    return project;
  }), specs);
  await seedProjects(p, list, options);
  await p.goto("about:blank"); await p.goto(BASE + "#projects"); await p.waitForTimeout(300);
}

// 2 Working, 2 Quoted (one with no offer), 1 Paid, all with a $25 target.
const FIVE = [
  ["w1", "Luigi's menu", "menu", working(27000, 11.5, 2500)],
  ["w2", "Logo for Sam", "logo", working(40000, 13, 2500)],
  ["q1", "Poster for the fair", "poster", null],
  ["q2", "Website for Ana", "website", null, { offerStatus: "none" }],
  ["p1", "Bakery menu", "menu", paid(31000, 13)],
];

// What the list shows right now.
const view = (p) => p.evaluate(() => {
  const vis = (e) => Boolean(e) && !e.hidden && !e.closest("[hidden]") && e.getClientRects().length > 0;
  const clean = (t) => t.replace(/\s+/g, " ").trim();
  const row = (id) => {
    const r = document.querySelector('#project-groups tr[data-id="' + id + '"]');
    return r ? { text: clean(r.innerText), date: clean(r.querySelector(".project-date").textContent), target: r.querySelector(".list-target") ? r.querySelector(".list-target").textContent : null, shown: vis(r) } : null;
  };
  return {
    sections: [...document.querySelectorAll("#project-groups > section")].filter(vis).map((s) => s.dataset.stage),
    headings: [...document.querySelectorAll("#project-groups h3")].filter(vis).map((h) => clean(h.textContent)),
    pills: vis(document.getElementById("stage-pills")) ? [...document.querySelectorAll("#stage-pills button")].filter(vis).map((b) => clean(b.textContent) + (b.getAttribute("aria-pressed") === "true" ? "*" : "")) : null,
    intro: vis(document.getElementById("projects-intro")) ? document.getElementById("projects-intro").textContent : null,
    headLabels: Object.fromEntries([...document.querySelectorAll("#project-groups > section")].map((s) => [s.dataset.stage, s.querySelector(".list-bar-head-label").textContent])),
    sayYes: document.querySelectorAll('#project-groups [data-action="said-yes"]').length,
    focus: document.activeElement && (document.activeElement.id || clean(document.activeElement.textContent)),
    rows: Object.fromEntries([...document.querySelectorAll("#project-groups tbody tr")].map((r) => [r.dataset.id, row(r.dataset.id)])),
  };
});

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Every width: three groups in order, the right numbers, bars that match
// barShare, no sideways scroll, and axe.
await forEachConfig(async (ctx) => {
  const p = ctx.page;
  await fresh(ctx);
  await seed(p, FIVE);
  const v = await view(p);
  if (!same(v.sections, ["working", "quoted", "paid"])) note(ctx, "sections", JSON.stringify(v.sections), "high");
  if (!same(v.headings, ["Working 2 · client said yes", "Quoted 2 · waiting on the client", "Paid 1 · with real hours"])) note(ctx, "headings", JSON.stringify(v.headings), "high");
  if (!same(v.pills, ["All 5*", "Working 2", "Quoted 2", "Paid 1"])) note(ctx, "pills", JSON.stringify(v.pills), "high");
  // The Working default sample at $270: ($270 - $20) / 11.5 hrs.
  if (!/\$270/.test(v.rows.w1.text) || !/\$21\.74\/hr/.test(v.rows.w1.text)) note(ctx, "working row", v.rows.w1.text, "high");
  // Paid with $310 for 13 hrs: ($310 - $20) / 13.
  if (!/\$310/.test(v.rows.p1.text) || !/\$22\.31\/hr/.test(v.rows.p1.text) || !/ of /.test(v.rows.p1.date) || !/13 of 11\.5 hrs/.test(v.rows.p1.date)) note(ctx, "paid row", JSON.stringify(v.rows.p1), "high");
  if (!/No offer yet/.test(v.rows.q2.text)) note(ctx, "quoted, no offer", v.rows.q2.text, "medium");
  if (v.intro !== "Every rate is after expenses. The bars start at $0, and the mark is your $25 target.") note(ctx, "intro", v.intro, "high");
  if (!same(v.headLabels, { working: "Target $25", quoted: "Target $25", paid: "Target $25" })) note(ctx, "header labels", JSON.stringify(v.headLabels), "medium");
  if (v.sayYes !== 2) note(ctx, "they said yes links", String(v.sayYes), "high");

  // Fills: barShare of the row's rate on one page-wide scale, within 1px.
  // The target label shows once per table: in the header at 1024 and up,
  // above the first bar below.
  const bars = await p.evaluate(() => {
    const out = [];
    const rows = [...document.querySelectorAll("#project-groups tbody tr")];
    const cents = (r) => { const t = r.querySelector(".list-rate"); return t && /\$/.test(t.textContent) ? Math.round(Number(t.textContent.replace(/[^0-9.-]/g, "")) * 100) : null; };
    const rates = rows.map(cents).filter((c) => c !== null);
    const scale = projectTimeline.barScaleCents(rates, 2500);
    rows.forEach((r) => {
      const track = r.querySelector(".list-bar-track");
      const fill = r.querySelector(".list-bar-fill");
      const mark = r.querySelector(".list-bar-mark");
      if (!track) return;
      const t = track.getBoundingClientRect();
      const rate = cents(r);
      const want = rate === null ? 0 : projectTimeline.barShare(rate, scale) * t.width;
      const got = fill ? fill.getBoundingClientRect().width : 0;
      const m = mark.getBoundingClientRect();
      const markWant = t.left + projectTimeline.barShare(2500, scale) * t.width;
      if (Math.abs(got - want) > 1) out.push(r.dataset.id + " fill " + got.toFixed(1) + " want " + want.toFixed(1));
      if (Math.abs(m.left + m.width / 2 - markWant) > 1) out.push(r.dataset.id + " mark at " + (m.left + m.width / 2).toFixed(1) + " want " + markWant.toFixed(1));
      if (Math.round(t.height) !== 10) out.push(r.dataset.id + " track " + t.height + "px");
      if (!r.querySelector(".list-bar").closest("[aria-hidden=true]")) out.push(r.dataset.id + " bar not aria-hidden");
    });
    const labels = [...document.querySelectorAll("#project-groups > section")].map((s) => {
      const vis = (e) => Boolean(e) && e.getClientRects().length > 0 && getComputedStyle(e).display !== "none";
      const head = s.querySelector(".list-bar-head-label");
      const first = [...s.querySelectorAll(".list-bar-label")];
      return { head: vis(head) && innerWidth >= 1024, rows: first.filter(vis).length, total: first.length };
    });
    return { out, labels };
  });
  bars.out.forEach((issue) => note(ctx, "bars", issue, "high"));
  bars.labels.forEach((l, i) => {
    const ok = ctx.width >= 1024 ? l.head && l.rows === 0 : !l.head && l.rows === 1;
    if (!ok || l.total !== 1) note(ctx, "target label " + i, JSON.stringify(l), "medium");
  });
  // The bar header's visually hidden name.
  const barHead = await p.evaluate(() => [...document.querySelectorAll(".list-bar-head .visually-hidden")].map((e) => e.textContent));
  if (!barHead.every((t) => t === "Rate compared with target") || barHead.length !== 3) note(ctx, "bar header", JSON.stringify(barHead), "medium");
  // Nothing cut off: every cell's text fits its box. (The job cell on phones
  // is visually hidden on purpose, 1px, for screen readers; its copy shows
  // in the date line.)
  const cut = await p.evaluate(() => [...document.querySelectorAll("#project-groups td, #project-groups tbody th, #stage-pills button")]
    .filter((e) => e.getClientRects().length && e.getBoundingClientRect().width > 1)
    .filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== "visible" || e.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
    .map((e) => e.className + " " + e.textContent.slice(0, 30)));
  if (cut.length) note(ctx, "cut off", cut.slice(0, 3).join(" | "), "high");
  await sideways(ctx, "grouped list");
  await badText(ctx, "grouped list");
  await axe(ctx, "grouped list");
});

// Behavior, at 390 and 1440.
await forEachConfig(async (ctx) => {
  const p = ctx.page;
  await fresh(ctx);

  // Only Quoted projects: no pills.
  await seed(p, [["q1", "Poster for the fair", "poster", null], ["q2", "Website for Ana", "website", null]]);
  let v = await view(p);
  if (v.pills !== null || !same(v.sections, ["quoted"])) note(ctx, "only quoted", JSON.stringify({ pills: v.pills, sections: v.sections }), "high");

  // Mixed targets in Working: no header label; each row says its target.
  await seed(p, [["w1", "Luigi's menu", "menu", working(27000, 11.5, 2500)], ["w2", "Logo for Sam", "logo", working(40000, 13, 3000)], ["q1", "Poster for the fair", "poster", null]]);
  v = await view(p);
  if (v.headLabels.working !== "" || v.rows.w1.target !== "Target $25" || v.rows.w2.target !== "Target $30") note(ctx, "mixed targets", JSON.stringify({ head: v.headLabels.working, w1: v.rows.w1.target, w2: v.rows.w2.target }), "high");
  if (v.headLabels.quoted !== "Target $25" || v.rows.q1.target !== null) note(ctx, "mixed targets, quoted table", JSON.stringify({ head: v.headLabels.quoted, q1: v.rows.q1.target }), "medium");
  if (v.intro !== "Every rate is after expenses. The bars start at $0, and the mark is each project's target.") note(ctx, "mixed intro", v.intro, "high");
  if (await p.evaluate(() => [...document.querySelectorAll(".list-bar-label")].some((e) => e.textContent && e.closest("#group-working")))) note(ctx, "mixed targets", "a bar label in the Working table", "medium");
  await axe(ctx, "mixed targets");

  // Pills: Working hides Quoted and Paid.
  await seed(p, FIVE);
  await tap(ctx, '#stage-pills [data-filter="working"]'); await p.waitForTimeout(100);
  v = await view(p);
  if (!same(v.sections, ["working"]) || !same(v.pills, ["All 5", "Working 2*", "Quoted 2", "Paid 1"])) note(ctx, "Working pill", JSON.stringify({ sections: v.sections, pills: v.pills }), "high");
  // The bars keep the page-wide scale.
  const fillWorking = await p.evaluate(() => document.querySelector('tr[data-id="w1"] .list-bar-fill').style.width);
  await tap(ctx, '#stage-pills [data-filter="all"]'); await p.waitForTimeout(100);
  if ((await p.evaluate(() => document.querySelector('tr[data-id="w1"] .list-bar-fill').style.width)) !== fillWorking) note(ctx, "scale", "bars changed with the pill", "high");
  await axe(ctx, "pills");

  // Deleting the last Paid project while "Paid" is pressed goes back to All.
  await tap(ctx, '#stage-pills [data-filter="paid"]'); await p.waitForTimeout(100);
  await tap(ctx, 'tr[data-id="p1"] [data-action="delete"]'); await p.waitForTimeout(100);
  await tap(ctx, 'tr[data-id="p1"] [data-action="confirm-delete"]'); await p.waitForTimeout(150);
  v = await view(p);
  if (!same(v.sections, ["working", "quoted"]) || v.pills === null || v.pills[0] !== "All 4*" || v.pills.some((x) => /^Paid/.test(x))) note(ctx, "delete last paid", JSON.stringify({ sections: v.sections, pills: v.pills }), "high");
  if (v.focus !== "Website for Ana") note(ctx, "delete last paid focus", v.focus, "medium");

  // Deleting a Working row while "Working" is pressed: focus stays on a row
  // that shows, not one in a hidden section.
  await tap(ctx, '#stage-pills [data-filter="working"]'); await p.waitForTimeout(100);
  await tap(ctx, 'tr[data-id="w2"] [data-action="delete"]'); await p.waitForTimeout(100);
  await tap(ctx, 'tr[data-id="w2"] [data-action="confirm-delete"]'); await p.waitForTimeout(150);
  v = await view(p);
  if (v.focus !== "Luigi's menu" || !same(v.sections, ["working"])) note(ctx, "delete in Working", JSON.stringify({ focus: v.focus, sections: v.sections }), "medium");

  // Duplicate while "Working" is pressed: All, and focus on the copy.
  await tap(ctx, 'tr[data-id="w1"] [data-action="duplicate"]'); await p.waitForTimeout(150);
  v = await view(p);
  if (v.pills[0] !== "All 4*" || !same(v.sections, ["working", "quoted"]) || v.focus !== "Luigi's menu copy") note(ctx, "duplicate in Working", JSON.stringify({ pills: v.pills, sections: v.sections, focus: v.focus }), "high");

  // A negative Paid rate: an empty fill.
  await seed(p, [["w1", "Luigi's menu", "menu", working(27000, 11.5, 2500)], ["p1", "Bakery menu", "menu", paid(1000, 13)]]);
  const negative = await p.evaluate(() => {
    const r = document.querySelector('tr[data-id="p1"]');
    return { rate: r.querySelector(".list-rate").textContent, fill: r.querySelector(".list-bar-fill").getBoundingClientRect().width };
  });
  if (negative.rate !== "-$0.77/hr" || negative.fill > 0.5) note(ctx, "negative paid", JSON.stringify(negative), "high");

  // "They said yes" on a row: the result with the dialog open, focus in the
  // agreed price; Escape returns focus to the stage bar's button.
  await seed(p, FIVE);
  const link = await p.evaluate(() => document.querySelector('tr[data-id="q1"] [data-action="said-yes"]').getAttribute("aria-label"));
  if (link !== "They said yes to Poster for the fair") note(ctx, "said yes label", link, "medium");
  await tap(ctx, 'tr[data-id="q1"] [data-action="said-yes"]'); await p.waitForTimeout(500);
  let s = await p.evaluate(() => ({ hash: location.hash, open: document.getElementById("working-panel").open, focus: document.activeElement.id }));
  if (s.hash !== "#p/q1/result" || !s.open || s.focus !== "agreed-price") note(ctx, "said yes from row", JSON.stringify(s), "high");
  await axe(ctx, "said yes from row");
  await p.keyboard.press("Escape"); await p.waitForTimeout(200);
  s = await p.evaluate(() => ({ open: document.getElementById("working-panel").open, focus: document.activeElement.id }));
  if (s.open || s.focus !== "stage-forward") note(ctx, "said yes Escape", JSON.stringify(s), "high");
  // The flag is used once: Back and Forward don't open the dialog again.
  await p.goBack(); await p.waitForTimeout(300);
  await p.goForward(); await p.waitForTimeout(400);
  if (await p.evaluate(() => document.getElementById("working-panel").open)) note(ctx, "said yes, Forward", "dialog opened again", "high");

  // Read only (a newer version saved the projects): no "They said yes".
  await seed(p, FIVE, { version: 4 });
  v = await view(p);
  if (v.sayYes !== 0 || !same(v.sections, ["working", "quoted", "paid"])) note(ctx, "read only", JSON.stringify({ sayYes: v.sayYes, sections: v.sections }), "high");
}, { widths: [390, 1440] });

report("project-groups"); await closeAll();
