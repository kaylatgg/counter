// Client requests while Working: the "Client asked for more" button, the
// dialog's two steps (the choice, then the message when charging), the request
// rows with their switch and Remove, Move back with requests, Mark as paid
// with requests, the Projects list's "1 hr free", and the layout and axe at
// every width with the dialog open on both steps.
import { forEachConfig, fresh, note, tap, closeAll, report, sideways, badText, axe, seedProjects, savedProjects, BASE } from "./lib.mjs";

// Luigi's menu: $270 agreed for 10 hrs, $20 expenses, a $25 target.
const WORKING = { stage: "working", quotedAt: "2026-11-20T10:00:00.000Z", workingAt: "2026-11-21T10:00:00.000Z", paidAt: null,
  agreedCents: 27000, plannedHours: 10, expensesCents: 2000, targetCents: 2500, requests: [], receivedCents: null, actualHours: null };
const FREE = { id: "r1", at: "2026-11-23T10:00:00.000Z", text: "Darker background on both pages", hours: 1, decision: "free", rateCents: 2500, chargeCents: 0 };
const CHARGED = { id: "r2", at: "2026-11-24T10:00:00.000Z", text: "One more round of changes", hours: 1.5, decision: "charge", rateCents: 2500, chargeCents: 4000 };
const TEXT = "Darker background on both pages";
const SECOND = "Swap the photo on page 2.";

// Seeds Luigi's menu (Working, with these requests) and a Quoted logo, and opens the menu's result.
async function seed(p, requests = []) {
  const list = await p.evaluate(([timeline, requests]) => [
    Object.assign(projectStore.createProject("Luigi's menu", projectStore.exampleDraft("menu"), "w1", new Date("2026-11-20T10:00:00Z")),
      { timeline: Object.assign({}, timeline, { requests }) }),
    projectStore.createProject("Logo", projectStore.exampleDraft("logo"), "q1", new Date("2026-11-20T10:00:00Z")),
  ], [WORKING, requests]);
  await seedProjects(p, list);
  await p.goto("about:blank"); await p.goto(BASE + "#p/w1/result"); await p.waitForTimeout(400);
}

// What the project page and the dialog show right now.
const state = (p) => p.evaluate(() => {
  const vis = (e) => Boolean(e) && !e.hidden && !e.closest("[hidden]");
  const text = (e) => e ? e.textContent.replace(/\s+/g, " ").trim() : null;
  const row = (r) => ({
    label: text(r.querySelector(".rbar-label")),
    note: text(r.querySelector(".rbar-date > span")),
    value: text(r.querySelector(".rbar-value").firstChild),
    delta: text(r.querySelector(".rbar-delta")),
    actions: [...r.querySelectorAll(".rbar-action")].map((b) => b.textContent),
    fill: r.querySelector(".rbar-fill").className.replace("rbar-fill", "").trim(),
  });
  const active = document.activeElement;
  return {
    request: vis(document.getElementById("stage-request")) ? text(document.getElementById("stage-request")) : null,
    forwardOutline: document.getElementById("stage-forward").classList.contains("outline"),
    amount: text(document.getElementById("project-hero-amount")),
    sentence: text(document.getElementById("project-hero-sentence")),
    stats: [...document.querySelectorAll("#project-stats > div")].map((d) => text(d.querySelector("dt")) + " | " + text(d.querySelector("dd"))),
    rows: [...document.querySelectorAll("#project-rate-bars .rbar-row")].map(row),
    note: vis(document.getElementById("project-rates-note")),
    dialog: [...document.getElementById("request-bars").querySelectorAll(".rbar-row")].map(row),
    hours: text(document.getElementById("request-hours")),
    rule: text(document.getElementById("request-rule")),
    add: text(document.getElementById("request-add")),
    step: vis(document.getElementById("request-form")) ? 1 : vis(document.getElementById("request-message")) ? 2 : 0,
    open: [...document.querySelectorAll("dialog")].filter((d) => d.open).map((d) => d.id),
    focus: active && (active.id || (active.dataset.action ? active.dataset.action + ":" + active.textContent : active.tagName)),
    announced: text(document.getElementById("announcer")),
  };
});
const check = (ctx, where, got, want) => {
  for (const [key, value] of Object.entries(want)) {
    if (JSON.stringify(got[key]) !== JSON.stringify(value)) note(ctx, where, `${key}: ${JSON.stringify(got[key])}, expected ${JSON.stringify(value)}`, "high");
  }
};

// Nothing in the open dialog (or the rate bars) sticks out past its box.
async function cutOff(ctx, where) {
  const out = await ctx.page.evaluate(() => {
    const found = [];
    const inside = (box, root) => root.querySelectorAll("*").forEach((e) => {
      if (e.closest(".visually-hidden") || e.closest("[hidden]") || e.matches("svg *")) return;
      const r = e.getBoundingClientRect();
      if (!r.width) return;
      if (r.left < box.left - 1 || r.right > box.right + 1) found.push((e.id || e.className || e.tagName) + " " + Math.round(r.left) + "-" + Math.round(r.right));
    });
    const dialog = [...document.querySelectorAll("dialog")].find((d) => d.open);
    if (dialog) inside(dialog.getBoundingClientRect(), dialog);
    if (dialog && dialog.scrollWidth > dialog.clientWidth + 1) found.push("dialog scrolls sideways");
    const bars = document.getElementById("project-rate-bars");
    if (bars.offsetParent) inside(document.querySelector(".project-rates").getBoundingClientRect(), bars);
    return found.slice(0, 4);
  });
  if (out.length) note(ctx, where, "cut off: " + out.join("; "), "high");
}

// The row in the project's rate bars for this request.
const rowButton = (id, action) => `#project-rate-bars button[data-action=${action}][data-request-id="${id}"]`;

await forEachConfig(async (ctx) => {
  const p = ctx.page;
  await fresh(ctx);
  await seed(p);

  // Working: Mark as paid (outline), then Client asked for more.
  let s = await state(p);
  check(ctx, "working", s, { request: "Client asked for more", forwardOutline: true, note: true, amount: "25.00",
    stats: ["Agreed price | $270", "Hours planned | 10hrs", "Planned rate | $25.00/hr"] });
  check(ctx, "working, planned note", { rows: s.rows.map((r) => r.note) }, { rows: ["Nov 21 · agreed $270 for 10 hrs"] });
  const order = await p.evaluate(() => [...document.querySelectorAll(".stage-action button:not([hidden])")].map((b) => b.id));
  if (order.join() !== "stage-forward,stage-request") note(ctx, "working", "button order " + order, "high");
  if (ctx.width < 760) {
    const widths = await p.evaluate(() => ["stage-forward", "stage-request"].map((id) => Math.round(document.getElementById(id).getBoundingClientRect().width)));
    const row = await p.evaluate(() => Math.round(document.querySelector(".stage-action").getBoundingClientRect().width));
    if (widths.some((w) => Math.abs(w - row) > 1)) note(ctx, "phone buttons", "not full width: " + widths + " of " + row, "high");
  }

  // Open: step 1, empty, 1 hr, nothing picked, focus in the text.
  await tap(ctx, "#stage-request"); await p.waitForTimeout(150);
  s = await state(p);
  check(ctx, "dialog", s, { open: ["request-panel"], step: 1, focus: "request-text", hours: "1 hr", add: "Add request",
    rule: "$25 is 1 hr at your $25 target." });
  if (await p.inputValue("#request-text") !== "") note(ctx, "dialog", "text not empty", "high");
  if (await p.evaluate(() => document.querySelectorAll("input[name=request-decision]:checked").length)) note(ctx, "dialog", "something picked", "high");
  // 1 hr: less goes to 0.5, so it's enabled.
  if (await p.isDisabled("#request-less")) note(ctx, "dialog", "less disabled at 1 hr", "high");
  await axe(ctx, "dialog step 1, nothing picked");
  await sideways(ctx, "dialog step 1"); await cutOff(ctx, "dialog step 1");
  if (ctx.width === 1440 || ctx.width === 390) await p.screenshot({ path: `screenshots/client-requests/dialog-nothing-picked-${ctx.width}.png`, fullPage: false });

  // Submitting with nothing: the text error first, with focus; nothing saved.
  await tap(ctx, "#request-add"); await p.waitForTimeout(150);
  const errors = await p.evaluate(() => [document.getElementById("request-text-error"), document.getElementById("request-choice-error")].map((e) => e && !e.hidden ? e.textContent.trim() : null));
  if (errors.join("|") !== "Enter what they asked for, like one more round of changes.|Choose Do it free or Charge.") note(ctx, "empty submit", JSON.stringify(errors), "high");
  check(ctx, "empty submit", await state(p), { focus: "request-text", open: ["request-panel"] });
  await axe(ctx, "dialog step 1, errors");

  // Text but no pick: focus on the first radio; the radios point to the error.
  await p.fill("#request-text", TEXT);
  if (await p.evaluate(() => Boolean(document.getElementById("request-text-error")))) note(ctx, "text typed", "text error still showing", "high");
  await tap(ctx, "#request-add"); await p.waitForTimeout(150);
  const radio = await p.evaluate(() => [document.activeElement.name, document.activeElement.value, document.activeElement.getAttribute("aria-describedby")]);
  if (radio.join() !== "request-decision,free,request-choice-error") note(ctx, "no pick", "focus " + radio, "high");
  if ((await savedProjects(p))[0].timeline.requests.length) note(ctx, "no pick", "saved a request", "high");

  // Pick free: the error clears, the button says so.
  await p.click("#request-bars input[value=free]"); await p.waitForTimeout(50);
  check(ctx, "free picked", await state(p), { add: "Add as free" });
  if (await p.isVisible("#request-choice-error")) note(ctx, "free picked", "choice error still showing", "high");
  if (ctx.width === 1440 || ctx.width === 390) await p.screenshot({ path: `screenshots/client-requests/dialog-free-picked-${ctx.width}.png` });
  await tap(ctx, "#request-add"); await p.waitForTimeout(300);
  s = await state(p);
  check(ctx, "added free", s, { open: [], focus: "stage-request", amount: "22.73", note: false,
    announced: "Request added as free. This project now pays $22.73 an hour.",
    sentence: "11 hrs for $270. You planned $25.00 an hour.",
    stats: ["Agreed price | $270", "Hours so far | 11hrs · 10 planned, 1 free", "Planned rate | $25.00/hr"] });
  const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
  check(ctx, "added free, row", { row: s.rows[1] }, { row: { label: TEXT, note: today + " · 1 hr, done free", value: "$22.73", delta: "−$2.27",
    actions: ["charge $25 instead", "Remove"], fill: "now" } });
  const names = await p.evaluate(() => [...document.querySelectorAll("#project-rate-bars .rbar-action")].map((b) => b.getAttribute("aria-label")));
  if (names.join("|") !== "Charge $25 instead: " + TEXT + "|Remove " + TEXT) note(ctx, "added free, names", JSON.stringify(names), "high");
  let saved = (await savedProjects(p))[0].timeline.requests;
  if (saved.length !== 1 || saved[0].decision !== "free" || saved[0].chargeCents !== 0 || saved[0].text !== TEXT || saved[0].hours !== 1) note(ctx, "added free", "saved " + JSON.stringify(saved), "high");
  await sideways(ctx, "one request"); await badText(ctx, "one request"); await cutOff(ctx, "one request");

  // Again, at 1.5 hrs: now, free, and charge.
  await tap(ctx, "#stage-request"); await p.waitForTimeout(150);
  check(ctx, "reopen", await state(p), { step: 1, hours: "1 hr", add: "Add request", focus: "request-text" });
  if (await p.inputValue("#request-text") !== "") note(ctx, "reopen", "text kept", "high");
  await tap(ctx, "#request-more"); await p.waitForTimeout(50);
  s = await state(p);
  check(ctx, "1.5 hrs", s, { hours: "1.5 hrs", rule: "$40 is 1.5 hrs at your $25 target, rounded up to the next $5." });
  check(ctx, "1.5 hrs, rows", { rows: s.dialog.map((r) => [r.label, r.note, r.value, r.delta, r.fill]) }, { rows: [
    ["Now", "11 hrs for $270", "$22.73", null, "now"],
    ["Do it free", "still $270 · 12.5 hrs", "$20.00", "−$2.73", "off"],
    ["Charge $40", "$310 · 12.5 hrs", "$23.20", "+$0.47", "off"],
  ] });
  // The stepper's limits: 0.5 at the bottom.
  await tap(ctx, "#request-less"); await tap(ctx, "#request-less"); await p.waitForTimeout(50);
  check(ctx, "0.5 hrs", await state(p), { hours: "0.5 hrs" });
  if (!(await p.isDisabled("#request-less"))) note(ctx, "0.5 hrs", "less not disabled", "high");
  await tap(ctx, "#request-more"); await tap(ctx, "#request-more"); await p.waitForTimeout(50);

  // Pick charge with no text: the text error; nothing saved.
  await p.click("#request-bars input[value=charge]"); await p.waitForTimeout(50);
  check(ctx, "charge picked", await state(p), { add: "Add and write the message", hours: "1.5 hrs" });
  if (ctx.width === 1440 || ctx.width === 390) await p.screenshot({ path: `screenshots/client-requests/dialog-charge-picked-${ctx.width}.png` });
  await axe(ctx, "dialog step 1, charge picked");
  await tap(ctx, "#request-add"); await p.waitForTimeout(150);
  check(ctx, "charge, no text", await state(p), { focus: "request-text", step: 1 });
  if ((await savedProjects(p))[0].timeline.requests.length !== 1) note(ctx, "charge, no text", "saved", "high");

  // Add it: step 2.
  await p.fill("#request-text", SECOND);
  await tap(ctx, "#request-add"); await p.waitForTimeout(300);
  s = await state(p);
  check(ctx, "step 2", s, { step: 2, focus: "request-message-title", open: ["request-panel"], amount: "23.20" });
  const breakdown = await p.evaluate(() => [...document.querySelectorAll("#request-breakdown > div")].map((d) => d.querySelector("dt").textContent + " " + d.querySelector("dd").textContent));
  if (JSON.stringify(breakdown) !== JSON.stringify(["Agreed price $270", SECOND + " +$40", "New total $310"])) note(ctx, "step 2", "breakdown " + JSON.stringify(breakdown), "high");
  const message = await p.inputValue("#request-reply");
  const want = "Hi! Happy to take on the extra request: Swap the photo on page 2. It's outside what we agreed on, so it's $40 more, which makes the new total $310. Let me know if that works and I'll get started.";
  if (message !== want) note(ctx, "step 2", "message " + message, "high");
  if (await p.getAttribute("#request-panel", "aria-labelledby") !== "request-message-title") note(ctx, "step 2", "dialog name", "high");
  await axe(ctx, "dialog step 2");
  await sideways(ctx, "dialog step 2"); await cutOff(ctx, "dialog step 2");
  if (ctx.width === 1440 || ctx.width === 390) await p.screenshot({ path: `screenshots/client-requests/step-2-${ctx.width}.png` });
  await tap(ctx, "#request-copy"); await p.waitForTimeout(250);
  const copied = await p.textContent("#request-copy-status");
  if (!/^(Copied to clipboard\.|Couldn't copy\. Select the text and copy it yourself\.)$/.test(copied)) note(ctx, "copy", "status " + copied, "high");
  await tap(ctx, "#request-done"); await p.waitForTimeout(200);
  check(ctx, "done", await state(p), { open: [], focus: "stage-request", announced: "Request added. This project now pays $23.20 an hour.",
    stats: ["Agreed price | $310incl. $40 extra", "Hours so far | 12.5hrs · 10 planned, 1 free, 1.5 charged", "Planned rate | $25.00/hr"] });
  saved = (await savedProjects(p))[0].timeline.requests;
  if (saved.length !== 2 || saved[1].decision !== "charge" || saved[1].chargeCents !== 4000) note(ctx, "done", "saved " + JSON.stringify(saved), "high");
  if (Object.keys(saved[1]).sort().join() !== "at,chargeCents,decision,hours,id,rateCents,text") note(ctx, "done", "keys " + Object.keys(saved[1]), "high");
  s = await state(p);
  check(ctx, "two rows", { rows: s.rows.map((r) => [r.value, r.delta, r.fill, r.actions]) }, { rows: [
    ["$25.00", null, "planned", []],
    ["$22.73", "−$2.27", "", ["charge $25 instead", "Remove"]],
    ["$23.20", "+$0.47", "now", ["make it free", "Remove"]],
  ] });
  if (ctx.width === 1440 || ctx.width === 390) await p.screenshot({ path: `screenshots/client-requests/project-page-${ctx.width}.png`, fullPage: true });

  // Escape on step 2 does what Done does.
  await tap(ctx, "#stage-request"); await p.waitForTimeout(150);
  await p.fill("#request-text", "Third thing");
  await p.click("#request-bars input[value=charge]");
  await tap(ctx, "#request-add"); await p.waitForTimeout(300);
  const earlier = await p.evaluate(() => [...document.querySelectorAll("#request-breakdown dt")].map((d) => d.textContent));
  if (earlier.join("|") !== "Agreed price|Earlier requests|Third thing|New total") note(ctx, "third", "breakdown " + earlier, "high");
  await p.keyboard.press("Escape"); await p.waitForTimeout(200);
  check(ctx, "escape on step 2", await state(p), { open: [], focus: "stage-request" });
  if (!/^Request added\. This project now pays /.test((await state(p)).announced)) note(ctx, "escape on step 2", "no announcement", "high");
  // Remove it again (checked below in full).
  await tap(ctx, "#project-rate-bars div.rbar-row:last-of-type button[data-action=remove]"); await p.waitForTimeout(150);
  await tap(ctx, "#remove-request-yes"); await p.waitForTimeout(300);

  // Escape on step 1 is Cancel: nothing added, focus back.
  await tap(ctx, "#stage-request"); await p.waitForTimeout(150);
  await p.keyboard.press("Escape"); await p.waitForTimeout(150);
  check(ctx, "escape on step 1", await state(p), { open: [], focus: "stage-request" });
  if ((await savedProjects(p))[0].timeline.requests.length !== 2) note(ctx, "escape on step 1", "count changed", "high");

  // "charge $25 instead" on the first: the new rate, focus on its "make it free".
  const ids = (await savedProjects(p))[0].timeline.requests.map((r) => r.id);
  await tap(ctx, rowButton(ids[0], "switch")); await p.waitForTimeout(300);
  s = await state(p);
  // ($270 + $25 + $40 - $20) / 12.5 = $25.20.
  check(ctx, "switched to charge", s, { amount: "25.20", focus: "switch:make it free", announced: "Now charging $25. This project pays $25.20 an hour." });
  saved = (await savedProjects(p))[0].timeline.requests;
  if (saved[0].decision !== "charge" || saved[0].chargeCents !== 2500) note(ctx, "switched to charge", "saved " + JSON.stringify(saved[0]), "high");
  const focused = await p.evaluate(() => document.activeElement.dataset.requestId);
  if (focused !== ids[0]) note(ctx, "switched to charge", "focus on another row", "high");
  await tap(ctx, rowButton(ids[0], "switch")); await p.waitForTimeout(300);
  check(ctx, "switched back", await state(p), { amount: "23.20", focus: "switch:charge $25 instead", announced: "Now free. This project pays $23.20 an hour." });

  // With requests, Move back to Quoted is refused in words.
  await tap(ctx, "#stage-back"); await p.waitForTimeout(150);
  await tap(ctx, "#back-yes"); await p.waitForTimeout(200);
  if (await p.textContent("#back-refusal") !== "This project has client requests, so it can't move back to Quoted. Remove them first.") note(ctx, "move back", "refusal " + await p.textContent("#back-refusal"), "high");
  await p.keyboard.press("Escape"); await p.waitForTimeout(150);

  // Remove asks first. Cancel keeps it; Remove takes it off.
  await tap(ctx, rowButton(ids[1], "remove")); await p.waitForTimeout(150);
  check(ctx, "remove dialog", await state(p), { open: ["remove-request-panel"], focus: "remove-request-cancel" });
  if (await p.textContent("#remove-request-text") !== SECOND + " and its 1.5 hrs come off this project.") note(ctx, "remove dialog", await p.textContent("#remove-request-text"), "high");
  await axe(ctx, "remove dialog");
  await tap(ctx, "#remove-request-cancel"); await p.waitForTimeout(150);
  check(ctx, "remove, cancel", await state(p), { open: [], focus: "remove:Remove" });
  if ((await savedProjects(p))[0].timeline.requests.length !== 2) note(ctx, "remove, cancel", "removed", "high");
  await tap(ctx, rowButton(ids[1], "remove")); await p.waitForTimeout(150);
  await tap(ctx, "#remove-request-yes"); await p.waitForTimeout(300);
  check(ctx, "removed", await state(p), { open: [], focus: "stage-request", amount: "22.73", announced: "Request removed. This project pays $22.73 an hour." });
  await tap(ctx, rowButton(ids[0], "remove")); await p.waitForTimeout(150);
  await tap(ctx, "#remove-request-yes"); await p.waitForTimeout(300);
  check(ctx, "removed all", await state(p), { amount: "25.00", note: true, stats: ["Agreed price | $270", "Hours planned | 10hrs", "Planned rate | $25.00/hr"] });
  if ((await savedProjects(p))[0].timeline.requests.length !== 0) note(ctx, "removed all", "still saved", "high");

  // Now Move back to Quoted works.
  await tap(ctx, "#stage-back"); await p.waitForTimeout(150);
  await tap(ctx, "#back-yes"); await p.waitForTimeout(300);
  if ((await savedProjects(p))[0].timeline !== undefined) note(ctx, "move back", "still Working", "high");
  check(ctx, "quoted", await state(p), { request: null });

  // A fresh seed: one free 1 hr request and one charged 1.5 hr ($40).
  await seed(p, [FREE, CHARGED]);
  s = await state(p);
  check(ctx, "seeded two", s, { amount: "23.20", sentence: "12.5 hrs for $310. You planned $25.00 an hour." });
  await sideways(ctx, "seeded two"); await badText(ctx, "seeded two"); await cutOff(ctx, "seeded two");
  await axe(ctx, "project with requests");
  // Mark as paid starts with $310 and 12.5 hrs.
  await tap(ctx, "#stage-forward"); await p.waitForTimeout(150);
  const defaults = [await p.inputValue("#paid-amount"), await p.inputValue("#paid-hours")];
  if (defaults.join() !== "310,12.5") note(ctx, "paid defaults", defaults.join(), "high");
  await p.keyboard.press("Escape"); await p.waitForTimeout(150);

  // The Projects list: the Working row shows "1 hr free".
  await p.goto("about:blank"); await p.goto(BASE + "#projects"); await p.waitForTimeout(400);
  const rate = await p.evaluate(() => document.querySelector('tr[data-id="w1"] .project-rate').textContent.replace(/\s+/g, " ").trim());
  if (!/\$23\.20\/hr 1 hr free$/.test(rate)) note(ctx, "projects list", "rate cell " + rate, "high");
  await sideways(ctx, "projects list"); await axe(ctx, "projects list");
  if (ctx.width === 1440) await p.screenshot({ path: "screenshots/client-requests/projects-list-1440.png", fullPage: true });

  // Read only (a newer version saved the projects): no request button, no row actions.
  const list = await savedProjects(p);
  await p.evaluate((list) => localStorage.setItem("counter.v2", JSON.stringify({ version: 4, projects: list })), list);
  await p.goto("about:blank"); await p.goto(BASE + "#p/w1/result"); await p.waitForTimeout(400);
  s = await state(p);
  check(ctx, "read only", s, { request: null });
  if (s.rows.some((r) => r.actions.length)) note(ctx, "read only", "row actions showing", "high");

  // Paid: no request button; every request row and Real in charcoal.
  await seedProjects(p, [Object.assign({}, list[0], { timeline: Object.assign({}, list[0].timeline, {
    stage: "paid", paidAt: "2026-11-26T10:00:00.000Z", receivedCents: 31000, actualHours: 13 }) })]);
  await p.goto("about:blank"); await p.goto(BASE + "#p/w1/result"); await p.waitForTimeout(400);
  s = await state(p);
  check(ctx, "paid", s, { request: null });
  check(ctx, "paid rows", { rows: s.rows.map((r) => [r.label, r.fill, r.actions.length]) }, { rows: [
    ["Planned", "planned", 0], [FREE.text, "", 0], [CHARGED.text, "", 0], ["Real", "", 0]] });

  // Quoted: no request button.
  await p.goto("about:blank"); await p.goto(BASE + "#p/q1/result"); await p.waitForTimeout(400);
  check(ctx, "quoted", await state(p), { request: null });
});

await closeAll();
report("requests");
