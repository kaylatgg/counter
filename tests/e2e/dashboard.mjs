// The Projects dashboard ("Your pricing so far") and its summary card on a
// saved result. Uses the example set from projects.test.js: the numbers, the
// table toggles (and that a rename keeps them), the tooltip, the Fix button
// landing on Ways to close the gap, and the layout at 375, 768, 1024, and 1440.
import { forEachConfig, note, closeAll, report, BASE, axe, sideways, badText } from "./lib.mjs";

function project(name, rate, hours, offer, expenses, day, offerStatus = "amount") {
  const date = new Date(2026, 9, day, 12).toISOString();
  return {
    id: name.split(",")[0].toLowerCase().replace(/ /g, "-"), name, field: "graphic", job: "menu",
    quote: "", reply: "", replyEdited: false, gapChoice: "estimate", created: date, edited: date,
    inputs: { count: "0", setupHours: String(hours), itemHours: "0", communicationHours: "0", rounds: "0",
      roundHours: "0", deliveryHours: "0", rate: String(rate), expenses: String(expenses), offerStatus, offer: String(offer) },
  };
}

const EXAMPLE = [
  project("Editorial illustration, Oct 15", 25, 11, 200, 0, 15),
  project("Social posts, Oct 14", 55, 24, 500, 20, 14),
  project("Menu, Oct 11", 25, 11.5, 200, 20, 11),
  project("Logo, Oct 9", 25, 13, 400, 15, 9),
  project("Portrait session, Oct 7", 30, 10, 150, 25, 7),
];

async function seed(p, list, hash) {
  await p.goto(BASE);
  await p.evaluate((data) => { localStorage.clear(); localStorage.setItem("counter.projects", JSON.stringify(data)); }, list);
  await p.goto("about:blank");
  await p.goto(BASE + hash);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(250);
}

const text = (p, id) => p.evaluate((i) => document.getElementById(i).textContent.replace(/\s+/g, " ").trim(), id);
const visible = (p, id) => p.evaluate((i) => { const e = document.getElementById(i); return !e.hidden && !e.closest("[hidden]") && e.getClientRects().length > 0; }, id);

// Text that overlaps other text, or leaves its card.
const LAYOUT = () => {
  const issues = [];
  const overlap = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
  const shown = (e) => e.getClientRects().length > 0 && !e.closest("[hidden]");
  const cards = [...document.querySelectorAll(".dash-card, .pricing-card")].filter(shown);
  cards.forEach((card) => {
    const box = card.getBoundingClientRect();
    card.querySelectorAll("*").forEach((e) => {
      if (!shown(e) || e.closest(".visually-hidden, .dash-table-wrap, .dash-table")) return;
      const b = e.getBoundingClientRect();
      if (!b.width) return;
      if (b.left < box.left - 0.5 || b.right > box.right + 0.5 || b.bottom > box.bottom + 0.5) issues.push(`${e.className || e.tagName} leaves ${card.className}`);
    });
  });
  const groups = [".wf-cols .wf-value", ".wf-cols .wf-label", ".fix-labels > span", ".dash-hero-top > *",
    ".wf-row-line > *", ".bullet-row > *", ".met-row > *", ".dash-number > *", ".pricing-card-number > *", ".dash-bar-labels > span"];
  groups.forEach((selector) => {
    const parents = new Map();
    document.querySelectorAll(selector).forEach((e) => {
      if (!shown(e)) return;
      const key = selector.startsWith(".wf-cols") ? "all" : e.parentElement;
      if (!parents.has(key)) parents.set(key, []);
      parents.get(key).push(e);
    });
    parents.forEach((items) => items.forEach((a, i) => items.slice(i + 1).forEach((b) => {
      if (overlap(a.getBoundingClientRect(), b.getBoundingClientRect())) issues.push(`${a.className || a.textContent} overlaps ${b.className || b.textContent}`);
    })));
  });
  // Cards start and end on the column grid.
  const spans = [...document.querySelectorAll(".grid-overlay > span")].filter((s) => s.getClientRects().length).map((s) => s.getBoundingClientRect());
  if (spans.length) [...document.querySelectorAll(".dash-card")].filter(shown).forEach((card) => {
    const b = card.getBoundingClientRect();
    if (!spans.some((s) => Math.abs(s.left - b.left) <= 1) || !spans.some((s) => Math.abs(s.right - b.right) <= 1)) issues.push(`${card.className} off the grid at ${Math.round(b.left)}-${Math.round(b.right)}`);
  });
  return issues;
};

await forEachConfig(async (ctx) => {
  const p = ctx.page;
  const wide = ctx.width >= 1024;
  await seed(p, EXAMPLE, "?grid#projects");

  // The numbers.
  const expect = {
    "dash-percent": "55%",
    "dash-lead": wide ? "You kept 55% of your target pay. Read left to right to see where the other $1,138 went."
      : "You kept 55% of your target pay. Read down to see where the other $1,138 went.",
    "dash-gapline": "Social posts, Oct 14 is 74% of the gap.",
    "dash-meta": "5 jobs · Oct 7 to Oct 15 · after expenses",
    "dash-unpaid": "28.4",
    "dash-unpaid-line": "Hours the offers did not cover. About 4 of every 10 hours.",
    "dash-paid-hours": "41.1 hrs",
    "dash-unpaid-hours": "28.4 hrs",
    "dash-met": "1",
    "dash-met-of": "of 5",
    "dash-met-line": "Only Logo, Oct 9 paid what you asked for.",
    "dash-fix-amount": "+$840",
    "dash-fix-line": "Price Social posts, Oct 14 at your target and you go from 55% to 88% of your target pay.",
    "fix-now-label": "now 55%",
    "fix-with-label": "with fix 88%",
    "fix-button": "Fix Social posts, Oct 14",
  };
  for (const [id, want] of Object.entries(expect)) {
    const got = (await p.evaluate((i) => document.getElementById(i).innerText.replace(/\s+/g, " ").trim(), id));
    if (got !== want) note(ctx, id, `"${got}", expected "${want}"`, "high");
  }
  if (await visible(p, "dash-based")) note(ctx, "based on", "shows with every project counted", "medium");
  if (!(await visible(p, "all-projects-title"))) note(ctx, "All projects", "heading hidden", "medium");
  const steps = await p.evaluate((w) => [...document.querySelectorAll(w ? ".wf-cols .wf-value" : ".wf-row-value")].map((e) => e.textContent), wide);
  const wantSteps = ["$2,508", "−$840", "−$175", "−$108", "−$75", "+$60", "$1,370"];
  if (steps.join() !== wantSteps.join()) note(ctx, "waterfall", steps.join(" "), "high");
  const bullets = await p.evaluate(() => [...document.querySelectorAll(".bullet-row")].map((r) => r.querySelector(".bullet-value").textContent + " " + r.querySelector(".bullet-rate").textContent));
  const wantBullets = ["36% $20.00 of $55/hr", "42% $12.50 of $30/hr", "63% $15.65 of $25/hr", "73% $18.18 of $25/hr", "118% $29.62 of $25/hr"];
  if (bullets.join("|") !== wantBullets.join("|")) note(ctx, "bullets", bullets.join(" | "), "high");
  const met = await p.evaluate(() => [...document.querySelectorAll(".met-row")].map((r) => r.innerText.replace(/\s+/g, " ").trim()));
  if (met.join("|") !== "Social posts, Oct 14 missed|Portrait session, Oct 7 missed|Menu, Oct 11 missed|Editorial illustration, Oct 15 missed|Logo, Oct 9 met") note(ctx, "met list", met.join(" | "), "medium");
  const dots = await p.evaluate(() => [...document.querySelectorAll(".met-dot")].map((d) => d.getBoundingClientRect().height));
  if (dots.some((h) => h !== 14)) note(ctx, "met dots", dots.join(), "medium");

  // Layout: nothing overlaps, nothing leaves a card, no sideways scroll.
  for (const issue of await p.evaluate(LAYOUT)) note(ctx, "layout", issue, "medium");
  await sideways(ctx, "dashboard");
  await badText(ctx, "dashboard");
  await axe(ctx, "dashboard");

  // The tooltip: only with a mouse on desktop, right of the target line, never over the values.
  const rows = await p.locator(".bullet-row").count();
  for (let i = 0; i < rows; i++) {
    await p.locator(".bullet-row").nth(i).hover({ position: { x: 5, y: 5 } });
    await p.waitForTimeout(50);
    const tip = await p.evaluate(() => {
      const tip = document.getElementById("bullet-tip");
      if (tip.hidden) return { shown: false };
      const t = tip.getBoundingClientRect();
      const row = document.querySelectorAll(".bullet-row")[0];
      const track = row.querySelector(".bullet-track").getBoundingClientRect();
      const target = track.left + track.width / 1.5;
      const values = [...document.querySelectorAll(".bullet-value, .bullet-rate")].map((e) => e.getBoundingClientRect());
      const over = values.some((v) => t.left < v.right && v.left < t.right && t.top < v.bottom && v.top < t.bottom);
      return { shown: true, text: tip.innerText.replace(/\s+/g, " "), over, left: t.left - target, right: track.right - t.right };
    });
    if (wide && !tip.shown) note(ctx, "tooltip", "row " + (i + 1) + " shows no tooltip", "medium");
    if (!wide && tip.shown) note(ctx, "tooltip", "shows below 1024px", "low");
    if (tip.shown && (tip.over || tip.left < 0 || tip.right < 0)) note(ctx, "tooltip", `row ${i + 1} ${JSON.stringify(tip)}`, "high");
    if (wide && i === 0 && tip.text !== "Social posts, Oct 14 Offer $500 · 24 hrs 15.3 hrs unpaid") note(ctx, "tooltip text", tip.text, "medium");
  }
  await p.mouse.move(0, 0);

  // Both table toggles: focus stays on the button, and a rename keeps them.
  for (const [button, chart, table] of [["waterfall-toggle", "waterfall", "waterfall-table"], ["bullet-toggle", "bullet-chart", "bullet-table"]]) {
    await p.focus("#" + button); await p.keyboard.press("Enter"); await p.waitForTimeout(50);
    const s = await p.evaluate(([b, c, t]) => [document.getElementById(b).textContent, document.activeElement.id, document.getElementById(c).hidden, document.getElementById(t).hidden], [button, chart, table]);
    if (s.join() !== `Show as chart,${button},true,false`) note(ctx, button, JSON.stringify(s), "high");
  }
  const tableRows = await p.evaluate(() => [...document.querySelectorAll("#waterfall-rows tr")].map((r) => r.innerText.replace(/\s+/g, " ").trim()));
  if (tableRows[1] !== "Social posts, Oct 14 −$840") note(ctx, "waterfall table", tableRows.join(" | "), "medium");
  const bulletTable = await p.evaluate(() => document.querySelector("#bullet-table-rows tr").innerText.replace(/\s+/g, " ").trim());
  if (bulletTable !== "Social posts, Oct 14 $20.00/hr $55/hr 36% $500 24 hrs 15.3 hrs") note(ctx, "bullet table", bulletTable, "medium");
  await axe(ctx, "dashboard tables");
  for (const issue of await p.evaluate(LAYOUT)) note(ctx, "layout with tables", issue, "medium");
  await sideways(ctx, "dashboard tables");
  await p.click('#project-rows tr:first-child [data-action="rename"]');
  await p.fill(".row-rename", "Editorial illustration, renamed"); await p.keyboard.press("Enter"); await p.waitForTimeout(150);
  const kept = await p.evaluate(() => [document.getElementById("waterfall-toggle").textContent, document.getElementById("waterfall-table").hidden, document.getElementById("bullet-toggle").textContent, document.getElementById("bullet-table").hidden, document.querySelector("#bullet-table-rows").innerText.includes("renamed")]);
  if (kept.join() !== "Show as chart,false,Show as chart,false,true") note(ctx, "toggles after rename", JSON.stringify(kept), "high");
  for (const button of ["waterfall-toggle", "bullet-toggle"]) await p.click("#" + button);

  // Fix: opens Social posts on screen 2, at its Ways to close the gap.
  await p.click("#fix-button"); await p.waitForTimeout(400);
  let s = await p.evaluate(() => ({ hash: location.hash, focus: document.activeElement.id, top: Math.round(document.getElementById("gap-section").getBoundingClientRect().top), h: innerHeight }));
  if (s.hash !== "#p/social-posts/result" || s.focus !== "gap-heading" || s.top < 0 || s.top > s.h / 2) note(ctx, "Fix button", JSON.stringify(s), "high");
  // The summary card: 5 projects count.
  const card = await p.evaluate(() => [...["pricing-card-percent", "pricing-card-text", "pricing-card-kept", "pricing-card-short"].map((i) => document.getElementById(i).textContent), !document.getElementById("pricing-card").hidden]);
  if (card.join("|") !== "55%|of your target pay, across 5 jobs|$1,370 kept|$1,138 short|true") note(ctx, "summary card", card.join(" | "), "high");
  for (const issue of await p.evaluate(LAYOUT)) note(ctx, "summary card layout", issue, "medium");
  await sideways(ctx, "summary card");
  await axe(ctx, "summary card");
  // Back returns to Projects. Forward and reload don't land on the gap again
  // (the browser may restore the scroll position, as on any page).
  await p.goBack(); await p.waitForTimeout(300);
  if ((await p.evaluate(() => location.hash)) !== "#projects") note(ctx, "Back after Fix", await p.evaluate(() => location.hash), "high");
  await p.goForward(); await p.waitForTimeout(400);
  s = await p.evaluate(() => ({ hash: location.hash, focus: document.activeElement.id }));
  if (s.hash !== "#p/social-posts/result" || s.focus === "gap-heading") note(ctx, "Forward after Fix", JSON.stringify(s), "high");
  await p.reload(); await p.waitForTimeout(400);
  s = await p.evaluate(() => ({ focus: document.activeElement.id }));
  if (s.focus === "gap-heading") note(ctx, "reload after Fix", JSON.stringify(s), "high");
  // Opening the same project from the list afterward starts at the top.
  await p.goto(BASE + "#projects"); await p.waitForTimeout(250);
  await p.click('#project-rows tr[data-id="social-posts"] .project-open'); await p.waitForTimeout(400);
  s = await p.evaluate(() => ({ y: scrollY, focus: document.activeElement.id }));
  if (s.y !== 0 || s.focus === "gap-heading") note(ctx, "open after Fix", JSON.stringify(s), "high");
  // The card's link goes to Projects.
  await p.locator("#pricing-card-link").scrollIntoViewIfNeeded();
  await p.click("#pricing-card-link"); await p.waitForTimeout(300);
  if ((await p.evaluate(() => location.hash)) !== "#projects") note(ctx, "summary card link", await p.evaluate(() => location.hash), "high");

  // The card is hidden on the draft and on a shared link, even with 5 projects.
  await p.goto(BASE + "#result"); await p.waitForTimeout(300);
  if (await visible(p, "pricing-card")) note(ctx, "summary card", "shows on the draft", "high");
  const link = await p.evaluate(() => shareLink.encodeShare("graphic", "menu", projectStore.exampleDraft("menu").inputs));
  await p.goto("about:blank"); await p.goto(BASE + link); await p.waitForTimeout(400);
  if (!(await p.evaluate(() => document.body.classList.contains("on-results")))) note(ctx, "share link", "didn't open screen 2", "medium");
  if (await visible(p, "pricing-card")) note(ctx, "summary card", "shows on a shared link", "high");

  // One counted project: no card. Another without an offer: the "Based on" note.
  const noOffer = project("No offer yet", 25, 10, 200, 20, 3, "none");
  await seed(p, [project("Menu, Oct 11", 25, 11.5, 200, 20, 11), noOffer], "#p/menu/result");
  if (await visible(p, "pricing-card")) note(ctx, "summary card", "shows with 1 counted project", "high");
  await p.goto(BASE + "#projects"); await p.waitForTimeout(250);
  const one = await p.evaluate(() => [document.getElementById("dash-based").textContent, document.getElementById("dash-gapline").textContent, document.getElementById("dash-meta").textContent]);
  if (one.join("|") !== "Based on 1 of 2 projects. The rest need an offer or hours.|All of it came from Menu, Oct 11.|1 job · Oct 11 · after expenses") note(ctx, "one project", one.join(" | "), "medium");
  // None counted: one line instead of the dashboard.
  await seed(p, [noOffer], "#projects");
  const none = await p.evaluate(() => [document.getElementById("dashboard").hidden, document.getElementById("dashboard-empty").hidden, document.getElementById("dashboard-empty").textContent]);
  if (none.join("|") !== "true|false|Add an offer to a project to see your pricing so far.") note(ctx, "none counted", none.join(" | "), "medium");
  // Every job at target, kept over 100%: no gap line, no fix, "nothing short".
  await seed(p, [project("Over, Oct 2", 25, 10, 520, 20, 2), project("Even, Oct 1", 25, 4, 100, 0, 1)], "#p/over/result");
  const over = await p.evaluate(() => [document.getElementById("pricing-card-percent").textContent, document.getElementById("pricing-card-short").textContent, getComputedStyle(document.getElementById("pricing-card-short-bar")).display]);
  if (over.join("|") !== "171%|nothing short|none") note(ctx, "summary card over 100%", over.join(" | "), "medium");
  await p.goto(BASE + "#projects"); await p.waitForTimeout(250);
  const all = await p.evaluate(() => [document.getElementById("dash-lead").textContent, document.getElementById("dash-gapline").hidden, document.getElementById("dash-fix-line").textContent, document.getElementById("fix-button").hidden, document.getElementById("dash-unpaid-line").textContent, document.getElementById("dash-met-line").textContent]);
  if (all.join("|") !== "You kept 171% of your target pay. Your offers covered every hour.|true|Every job met your target.|true|Every hour was covered.|Every job paid what you asked for.") note(ctx, "all at target", all.join(" | "), "medium");
  for (const issue of await p.evaluate(LAYOUT)) note(ctx, "layout, all at target", issue, "medium");
}, { widths: [375, 768, 1024, 1440] });
report("dashboard"); await closeAll();
