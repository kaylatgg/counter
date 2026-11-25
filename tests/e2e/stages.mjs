// Project stages on the result screen: the stage bar, They said yes, Mark as
// paid, Move back, the project hero, reload, the draft, read-only mode, and
// Escape and focus for each dialog. axe on each dialog and each stage.
import { forEachConfig, fresh, note, tap, closeAll, report, sideways, badText, axe, seedProjects, savedProjects, BASE } from "./lib.mjs";

const WORKING = { stage: "working", quotedAt: "2026-11-20T10:00:00.000Z", workingAt: "2026-11-21T10:00:00.000Z", paidAt: null,
  agreedCents: 27000, plannedHours: 10, expensesCents: 2000, targetCents: 2500, requests: [], receivedCents: null, actualHours: null };
const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });

// What the stage parts show right now.
const state = (p) => p.evaluate(() => {
  const vis = (id) => { const e = document.getElementById(id); return Boolean(e) && !e.hidden && !e.closest("[hidden]"); };
  const text = (id) => document.getElementById(id).textContent.replace(/\s+/g, " ").trim();
  const current = document.querySelector("#stage-steps li[aria-current=step]");
  return {
    bar: vis("stage-row"),
    stage: current ? current.dataset.stage : null,
    forward: vis("stage-forward") ? text("stage-forward") : null,
    back: vis("stage-back") ? text("stage-back") : null,
    paidOn: vis("stage-paid-on") ? text("stage-paid-on") : null,
    hero: vis("hero-panel"),
    projectHero: vis("project-hero"),
    label: text("project-hero-label"),
    amount: text("project-hero-sign") + text("project-hero-amount"),
    job: text("project-hero-job"),
    sentence: text("project-hero-sentence"),
    stats: [...document.querySelectorAll("#project-stats > div")].map((d) => d.querySelector("dt").textContent + " " + d.querySelector("dd").textContent),
    rows: [...document.querySelectorAll("#project-rate-bars .rbar-row")].map((r) => r.querySelector(".rbar-label").textContent + " " + r.querySelector(".rbar-value").textContent),
    pricing: vis("pricing-heading"),
    focus: document.activeElement && document.activeElement.id,
    open: [...document.querySelectorAll("dialog")].filter((d) => d.open).map((d) => d.id),
    announced: text("announcer"),
  };
});
const check = (ctx, where, got, want) => {
  for (const [key, value] of Object.entries(want)) {
    if (JSON.stringify(got[key]) !== JSON.stringify(value)) note(ctx, where, `${key}: ${JSON.stringify(got[key])}, expected ${JSON.stringify(value)}`, "high");
  }
};
const errorText = (p, id) => p.evaluate((id) => { const e = document.getElementById(id + "-error"); return e ? e.textContent.trim() : null; }, id);

await forEachConfig(async (ctx) => {
  const p = ctx.page;
  await fresh(ctx);

  // The draft: no stage bar on either screen.
  check(ctx, "draft screen 1", await state(p), { bar: false });
  await tap(ctx, "#check-offer"); await p.waitForTimeout(300);
  check(ctx, "draft screen 2", await state(p), { bar: false, hero: true, projectHero: false, pricing: false });

  // Saved: Quoted, and today's hero.
  await tap(ctx, "#save-project"); await p.waitForTimeout(150);
  await p.fill("#save-name", "Luigi's menu");
  await p.keyboard.press("Enter"); await p.waitForTimeout(250);
  check(ctx, "quoted", await state(p), { bar: true, stage: "quoted", forward: "They said yes", back: null, paidOn: null, hero: true, projectHero: false, pricing: false });
  if (await p.textContent("#hero-amount") !== "15.65") note(ctx, "quoted", "hero changed: " + await p.textContent("#hero-amount"), "high");
  await axe(ctx, "quoted");

  // They said yes: Escape closes, focus back on the button.
  await tap(ctx, "#stage-forward"); await p.waitForTimeout(150);
  let s = await state(p);
  check(ctx, "yes dialog", s, { open: ["working-panel"], focus: "agreed-price" });
  if (await p.inputValue("#agreed-price") !== "310") note(ctx, "yes dialog", "prefilled " + await p.inputValue("#agreed-price"), "high");
  if (await p.textContent("#agreed-line") !== "That's $25.22 an hour after expenses for 11.5 hours.") note(ctx, "yes dialog", "line: " + await p.textContent("#agreed-line"), "high");
  await axe(ctx, "yes dialog");
  await p.keyboard.press("Escape"); await p.waitForTimeout(150);
  check(ctx, "yes dialog, Escape", await state(p), { open: [], focus: "stage-forward", stage: "quoted" });

  // An invalid price shows the error and stays open.
  await tap(ctx, "#stage-forward"); await p.waitForTimeout(150);
  await p.fill("#agreed-price", "abc");
  await tap(ctx, "#working-form button[type=submit]"); await p.waitForTimeout(150);
  if (await errorText(p, "agreed-price") !== "Enter the price they agreed to, like 270.") note(ctx, "yes, invalid", "error: " + await errorText(p, "agreed-price"), "high");
  check(ctx, "yes, invalid", await state(p), { open: ["working-panel"], stage: "quoted" });
  await axe(ctx, "yes dialog, error");
  // $0 is refused by the math, in words, and stays open.
  await p.fill("#agreed-price", "0");
  await tap(ctx, "#working-form button[type=submit]"); await p.waitForTimeout(150);
  if (!/more than \$0/.test(await p.textContent("#working-refusal"))) note(ctx, "yes, $0", "refusal: " + await p.textContent("#working-refusal"), "high");
  check(ctx, "yes, $0", await state(p), { open: ["working-panel"], stage: "quoted" });

  // 270: Working.
  await p.fill("#agreed-price", "270"); await p.waitForTimeout(50);
  if (await errorText(p, "agreed-price") !== null) note(ctx, "yes, fixed", "error still showing", "high");
  if (await p.textContent("#agreed-line") !== "That's $21.74 an hour after expenses for 11.5 hours.") note(ctx, "yes, 270", "line: " + await p.textContent("#agreed-line"), "high");
  await tap(ctx, "#working-form button[type=submit]"); await p.waitForTimeout(300);
  const working = {
    bar: true, stage: "working", forward: "Mark as paid", back: "Move back to Quoted", hero: false, projectHero: true, pricing: true,
    label: "This project pays now, after expenses", amount: "21.74", job: "Menu · working since " + today,
    sentence: "11.5 hrs for $270. You planned $21.74 an hour.",
    stats: ["Agreed price $270", "Hours planned 11.5hrs", "Planned rate $21.74/hr"], rows: ["Planned $21.74/hr"],
  };
  check(ctx, "working", await state(p), Object.assign({ open: [], focus: "project-hero-label", announced: "Moved to Working" }, working));
  let saved = (await savedProjects(p))[0];
  if (!saved.timeline || saved.timeline.agreedCents !== 27000 || saved.timeline.plannedHours !== 11.5) note(ctx, "working saved", JSON.stringify(saved.timeline), "high");
  await axe(ctx, "working");
  await sideways(ctx, "working"); await badText(ctx, "working");

  // Reload: still Working.
  await p.reload(); await p.waitForTimeout(400);
  check(ctx, "working, reload", await state(p), working);

  // Editing the calculation keeps the snapshots and the project hero.
  await tap(ctx, '#result button[data-target=rounds][data-step="1"]'); await p.waitForTimeout(1300);
  check(ctx, "working, rounds +1", await state(p), { amount: "21.74", stats: working.stats });
  saved = (await savedProjects(p))[0];
  if (saved.inputs.rounds !== "3" || saved.timeline.agreedCents !== 27000) note(ctx, "working, rounds +1", "saved " + saved.inputs.rounds + " " + JSON.stringify(saved.timeline), "high");
  await tap(ctx, '#result button[data-target=rounds][data-step="-1"]'); await p.waitForTimeout(1300);

  // Mark as paid: Escape, then an error, then 310 and 13.
  await tap(ctx, "#stage-forward"); await p.waitForTimeout(150);
  check(ctx, "paid dialog", await state(p), { open: ["paid-panel"], focus: "paid-amount" });
  const defaults = [await p.inputValue("#paid-amount"), await p.inputValue("#paid-hours")];
  if (defaults.join() !== "270,11.5") note(ctx, "paid dialog", "defaults " + defaults, "high");
  await axe(ctx, "paid dialog");
  await p.keyboard.press("Escape"); await p.waitForTimeout(150);
  check(ctx, "paid dialog, Escape", await state(p), { open: [], focus: "stage-forward", stage: "working" });
  await tap(ctx, "#stage-forward"); await p.waitForTimeout(150);
  await p.fill("#paid-amount", "");
  await p.fill("#paid-hours", "0");
  await tap(ctx, "#paid-form button[type=submit]"); await p.waitForTimeout(150);
  const errs = [await errorText(p, "paid-amount"), await errorText(p, "paid-hours")];
  if (errs.join("|") !== "Enter the amount you received, like 310.|Enter the hours you worked, like 13.") note(ctx, "paid, invalid", JSON.stringify(errs), "high");
  check(ctx, "paid, invalid", await state(p), { open: ["paid-panel"], stage: "working", focus: "paid-amount" });
  await axe(ctx, "paid dialog, errors");
  await p.fill("#paid-amount", "310");
  await p.fill("#paid-hours", "13"); await p.waitForTimeout(50);
  const live = await p.evaluate(() => [document.getElementById("paid-result-number").textContent,
    [...document.querySelectorAll("#paid-rate-bars .rbar-row")].map((r) => r.querySelector(".rbar-label").textContent + " " + r.querySelector(".rbar-value").textContent)]);
  if (JSON.stringify(live) !== JSON.stringify(["$22.31/hr", ["Planned $21.74/hr", "Real $22.31/hr"]])) note(ctx, "paid, live", JSON.stringify(live), "high");
  await tap(ctx, "#paid-form button[type=submit]"); await p.waitForTimeout(300);
  check(ctx, "paid", await state(p), {
    open: [], stage: "paid", forward: null, back: "Move back to Working", paidOn: "Paid " + today, hero: false, projectHero: true,
    label: "This project really paid, after expenses", amount: "22.31", job: "Menu · paid " + today,
    sentence: "13 hrs for $310. You planned $21.74 an hour.",
    stats: ["Received $310", "Real hours 13hrs", "Planned rate $21.74/hr"], rows: ["Planned $21.74/hr", "Real $22.31/hr"],
    focus: "project-hero-label", announced: "Marked as paid",
  });
  await axe(ctx, "paid");
  await sideways(ctx, "paid"); await badText(ctx, "paid");

  // Move back to Working: Escape first, then Move back.
  await tap(ctx, "#stage-back"); await p.waitForTimeout(150);
  check(ctx, "back dialog", await state(p), { open: ["back-panel"], focus: "back-cancel" });
  if (await p.textContent("#back-question") !== "Move back to Working?" || await p.textContent("#back-text") !== "The amount received and real hours are cleared.") note(ctx, "back dialog", "text", "high");
  await axe(ctx, "back dialog");
  await p.keyboard.press("Escape"); await p.waitForTimeout(150);
  check(ctx, "back dialog, Escape", await state(p), { open: [], focus: "stage-back", stage: "paid" });
  await tap(ctx, "#stage-back"); await p.waitForTimeout(150);
  await tap(ctx, "#back-yes"); await p.waitForTimeout(300);
  check(ctx, "back to working", await state(p), { stage: "working", amount: "21.74", rows: ["Planned $21.74/hr"], announced: "Moved back to Working" });

  // Then to Quoted: today's hero is back.
  await tap(ctx, "#stage-back"); await p.waitForTimeout(150);
  if (await p.textContent("#back-question") !== "Move back to Quoted?" || await p.textContent("#back-text") !== "The agreed price is cleared.") note(ctx, "back dialog 2", "text", "high");
  await tap(ctx, "#back-yes"); await p.waitForTimeout(300);
  check(ctx, "back to quoted", await state(p), { stage: "quoted", hero: true, projectHero: false, pricing: false, forward: "They said yes", back: null, focus: "hero-label" });
  if (await p.textContent("#hero-amount") !== "15.65") note(ctx, "back to quoted", "hero " + await p.textContent("#hero-amount"), "high");
  saved = (await savedProjects(p))[0];
  if (saved.timeline !== undefined) note(ctx, "back to quoted", "timeline still saved", "high");

  // With errors in the calculation, the action asks to fix them first.
  await p.fill("#bar-rate", "0"); await p.keyboard.press("Tab"); await p.waitForTimeout(200);
  check(ctx, "quoted, errors", await state(p), { forward: "Fix the details to continue" });
  await tap(ctx, "#stage-forward"); await p.waitForTimeout(300);
  if (!(await p.isVisible("#screen-inputs"))) note(ctx, "fix the details", "didn't open Edit details", "high");
  await p.fill("#rate", "25"); await p.keyboard.press("Tab"); await p.waitForTimeout(200);

  // New calculation: the draft has no stage bar.
  await tap(ctx, "#new-calc"); await p.waitForTimeout(200);
  if (await p.isVisible("#start-over")) { await tap(ctx, "#start-over-yes"); await p.waitForTimeout(200); }
  await tap(ctx, "#check-offer"); await p.waitForTimeout(300);
  check(ctx, "new calculation", await state(p), { bar: false, hero: true, projectHero: false });

  // A saved Working project, opened straight onto screen 2, then switched.
  const seeded = await p.evaluate((timeline) => [
    Object.assign(projectStore.createProject("Luigi's menu", projectStore.exampleDraft("menu"), "w1", new Date("2026-11-20T10:00:00Z")), { timeline }),
    projectStore.createProject("Logo", projectStore.exampleDraft("logo"), "q1", new Date("2026-11-20T10:00:00Z")),
  ], WORKING);
  await seedProjects(p, seeded);
  await p.goto("about:blank"); await p.goto(BASE + "#p/w1/result"); await p.waitForTimeout(400);
  check(ctx, "seeded working", await state(p), { stage: "working", projectHero: true, hero: false, amount: "25.00",
    sentence: "10 hrs for $270. You planned $25.00 an hour.", rows: ["Planned $25.00/hr"] });
  await p.evaluate(() => go({ screen: "results", project: "q1" })); await p.waitForTimeout(300);
  check(ctx, "switched to quoted", await state(p), { stage: "quoted", projectHero: false, hero: true });
  await p.goBack(); await p.waitForTimeout(300);
  check(ctx, "Back to working", await state(p), { stage: "working", projectHero: true });

  // Read only (a newer version saved the projects): no stage actions.
  await p.evaluate((list) => localStorage.setItem("counter.v2", JSON.stringify({ version: 4, projects: list })), seeded);
  await p.goto("about:blank"); await p.goto(BASE + "#p/w1/result"); await p.waitForTimeout(400);
  check(ctx, "read only", await state(p), { stage: "working", forward: null, back: null, projectHero: true });
}, { widths: [390, 1440] });

// With motion: the reveal grows into the project hero, and nothing waits on the hidden hero.
await forEachConfig(async (ctx) => {
  const p = ctx.page;
  await fresh(ctx);
  await seedProjects(p, await p.evaluate((timeline) => [Object.assign(projectStore.createProject("Luigi's menu", projectStore.exampleDraft("menu"), "w1", new Date("2026-11-20T10:00:00Z")), { timeline })], WORKING));
  await p.goto("about:blank"); await p.goto(BASE + "#p/w1"); await p.waitForTimeout(400);
  const target = await p.evaluate(() => new Promise((resolve) => {
    // Where the orb is when it finishes growing (just before it fades).
    let last = null;
    const watch = () => {
      const orb = document.querySelector(".reveal-orb");
      if (orb) last = orb.getBoundingClientRect();
      if (document.body.classList.contains("revealing")) requestAnimationFrame(watch);
      else {
        const hero = document.getElementById("project-hero").getBoundingClientRect();
        resolve({ orb: last && [last.left, last.top, last.width, last.height].map(Math.round), hero: [hero.left, hero.top, hero.width, hero.height].map(Math.round) });
      }
    };
    document.getElementById("check-offer").click();
    requestAnimationFrame(watch);
  }));
  if (!target.orb || target.orb.some((v, i) => Math.abs(v - target.hero[i]) > 2)) note(ctx, "reveal", "orb ended at " + JSON.stringify(target.orb) + ", project hero at " + JSON.stringify(target.hero), "high");
  await p.waitForTimeout(2500);
  const after = await p.evaluate(() => ({ focus: document.activeElement.id, amount: document.getElementById("project-hero-amount").textContent, stats: document.getElementById("metrics").classList.contains("armed") }));
  if (after.focus !== "project-hero-label" || after.amount !== "25.00") note(ctx, "reveal", JSON.stringify(after), "high");
}, { widths: [390, 1440], opts: { motion: true } });

report("stages"); await closeAll();
