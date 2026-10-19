// Flow 7: navigation.
import { forEachConfig, fresh, note, tap, closeAll, report, findings, BASE, sideways, log } from "./lib.mjs";
const where = (p) => p.evaluate(() => !document.getElementById("crumb") ? { hash: location.href, screen: "not counter" } : ({ hash: location.hash, screen: document.body.className.match(/on-\w+/)?.[0], crumb: document.getElementById("crumb").hidden ? "" : document.getElementById("crumb-name").textContent, count: document.getElementById("count").value, dialogs: [...document.querySelectorAll("dialog[open]")].length, armed: document.querySelectorAll(".armed").length, revealing: /revealing|reveal-hidden/.test(document.body.className) }));
await forEachConfig(async (ctx) => {
  const p = ctx.page;
  await fresh(ctx);
  // Make a saved project to visit.
  await p.evaluate(() => { localStorage.setItem("counter.projects", projectStore.serializeProjects([projectStore.createProject("Poster job", projectStore.exampleDraft("poster"), "pp1", new Date(2026, 9, 1))])); });
  await p.reload(); await p.waitForTimeout(200);
  const trail = [];
  const stepTo = async (label, fn) => { await fn(); await p.waitForTimeout(350); const w = await where(p); trail.push([label, w]); };
  trail.push(["start", await where(p)]);
  await stepTo("check", () => tap(ctx, "#check-offer"));
  await stepTo("edit details", () => tap(ctx, "#edit-details"));
  await stepTo("projects", () => tap(ctx, "#projects-link"));
  await stepTo("open project", () => tap(ctx, "#project-rows .project-open"));
  await stepTo("projects again", () => tap(ctx, "#projects-link"));
  await stepTo("edit project", () => tap(ctx, '#project-rows [data-action="edit"]'));
  const expectScreens = { start: "on-inputs", check: "on-results", "edit details": "on-inputs", projects: "on-projects", "open project": "on-results", "projects again": "on-projects", "edit project": "on-inputs" };
  for (const [label, w] of trail) if (w.screen !== expectScreens[label]) note(ctx, "forward " + label, JSON.stringify(w), "high");
  // "Edit details" goes back in history (it came from screen 1), so the
  // history is: start, projects, open project, projects again, edit project.
  const all = trail.slice();
  trail.splice(0, trail.length, all[0], ...all.slice(3));
  for (const [label, w] of [all[2]]) if (w.hash !== all[0][1].hash) note(ctx, "edit details", "didn't return to the start entry", "medium");
  // Back through all of it, then Forward through all of it.
  for (let i = trail.length - 2; i >= 0; i--) {
    await p.goBack(); await p.waitForTimeout(350);
    const w = await where(p), want = trail[i][1];
    if (w.hash !== want.hash || w.screen !== want.screen || w.crumb !== want.crumb || w.count !== want.count) note(ctx, `Back to "${trail[i][0]}"`, `got ${JSON.stringify(w)} want ${JSON.stringify(want)}`, "high");
    if (w.revealing || w.dialogs) note(ctx, `Back to "${trail[i][0]}"`, "left a reveal or dialog", "medium");
  }
  for (let i = 1; i < trail.length; i++) {
    await p.goForward(); await p.waitForTimeout(350);
    const w = await where(p), want = trail[i][1];
    if (w.hash !== want.hash || w.screen !== want.screen || w.crumb !== want.crumb || w.count !== want.count) note(ctx, `Forward to "${trail[i][0]}"`, `got ${JSON.stringify(w)} want ${JSON.stringify(want)}`, "high");
  }
  // Reload on every screen.
  for (const [label, w0] of trail) {
    await p.goto("about:blank"); await p.goto(BASE + w0.hash); await p.waitForTimeout(300);
    const w = await where(p);
    if (w.hash !== w0.hash || w.screen !== w0.screen || w.crumb !== w0.crumb) note(ctx, `reload "${label}" (${w0.hash || "none"})`, JSON.stringify(w), "high");
    if (w.armed && !ctx.motion) note(ctx, `reload "${label}"`, "blocks armed under reduced motion", "medium");
    await sideways(ctx, `reload ${label}`);
  }
  // Opening Projects directly, in a fresh browser.
  await fresh(ctx, "#projects"); await p.waitForTimeout(200);
  let w = await where(p);
  if (w.screen !== "on-projects") note(ctx, "open #projects directly", JSON.stringify(w), "high");
  const back = (await p.textContent("#back-to-calc-label")).trim();
  if (back !== "Back to calculator") note(ctx, "open #projects directly", `back pill "${back}"`, "low");
  await tap(ctx, "#back-to-calc"); await p.waitForTimeout(200);
  w = await where(p);
  if (w.screen !== "on-inputs") note(ctx, "projects direct, back pill", JSON.stringify(w), "medium");
  // A project address that doesn't exist.
  await fresh(ctx, "#p/nope/result"); await p.waitForTimeout(200);
  w = await where(p);
  if (w.screen !== "on-inputs" || w.hash !== "") note(ctx, "unknown project address", JSON.stringify(w), "medium");
  // Unknown hash.
  await fresh(ctx, "#banana"); await p.waitForTimeout(200);
  w = await where(p);
  if (w.screen !== "on-inputs") note(ctx, "unknown hash", JSON.stringify(w), "medium");
});
// Back during the reveal, with motion on.
await forEachConfig(async (ctx) => {
  const p = ctx.page;
  await fresh(ctx);
  await tap(ctx, "#check-offer"); await p.waitForTimeout(250);
  await p.goBack().catch(() => {}); await p.waitForTimeout(1500);
  const w = await where(p);
  if (w.screen !== "on-inputs" || w.revealing || await p.evaluate(() => !!document.querySelector(".reveal-orb"))) note(ctx, "Back during reveal", JSON.stringify(w), "high");
  await p.goForward(); await p.waitForTimeout(3500);
  const w2 = await where(p);
  if (w2.screen !== "on-results" || w2.revealing || (await p.textContent("#hero-amount")) !== "17.39") note(ctx, "Forward after reveal", JSON.stringify(w2) + " " + await p.textContent("#hero-amount"), "high");
}, { widths: [390, 1440], opts: { motion: true } });
// New calculation, in the header: every screen (phone screen 2 leaves it out
// for room; Edit is one tap away), the "Save this calculation first?" dialog.
await forEachConfig(async (ctx) => {
  const p = ctx.page;
  const phone = ctx.width < 760;
  const state = () => p.evaluate(() => ({ screen: document.body.className.match(/on-\w+/)?.[0], job: document.querySelector('input[name="job"]:checked').value, count: document.getElementById("count").value,
    projects: document.getElementById("projects-count").textContent, dialog: document.getElementById("start-over").open, save: document.getElementById("save-panel").open,
    text: document.getElementById("start-over-text").textContent, focus: document.activeElement.id }));
  for (const [screen, hash] of [["screen 1", ""], ["screen 2", "#result"], ["projects", "#projects"]]) {
    await fresh(ctx, hash);
    const b = await p.evaluate(() => { const e = document.getElementById("new-calc"); const r = e.getBoundingClientRect(); return { shown: r.width > 0 && getComputedStyle(e).display !== "none", w: r.width, h: r.height, inHeader: !!e.closest(".topbar-inner") }; });
    const want = !(phone && screen === "screen 2");
    if (b.shown !== want || !b.inHeader) note(ctx, "new calculation " + screen, JSON.stringify(b), "high");
    if (b.shown && phone && (b.w < 44 || b.h < 44)) note(ctx, "new calculation " + screen, "tap area " + b.w + "x" + b.h, "high");
    if (b.shown && await p.locator(".topbar").getByRole("button", { name: "New calculation", exact: true }).count() !== 1) note(ctx, "new calculation " + screen, "no button named New calculation", "high");
  }
  // Nothing changed: straight to a fresh menu example, no dialog.
  await fresh(ctx, "#projects");
  await p.click("#new-calc"); await p.waitForTimeout(300);
  let s = await state();
  if (s.screen !== "on-inputs" || s.job !== "menu" || s.count !== "2" || s.dialog) note(ctx, "new calculation, untouched", JSON.stringify(s), "high");
  // Changed: the dialog names the job; focus on Cancel.
  const change = async (job, field) => {
    await fresh(ctx);
    await p.click(`label[for="field-${field}"]`); await p.click(`label[for="job-${job}"]`); await p.waitForTimeout(150);
    await p.fill("#count", "5"); await p.locator("#count").blur(); await p.waitForTimeout(150);
    await p.click("#new-calc"); await p.waitForTimeout(200);
  };
  for (const [job, field, name] of [["logo", "graphic", "logo"], ["custom", "graphic", "custom project"], ["socialvideo", "motion", "social video"]]) {
    await change(job, field);
    s = await state();
    if (!s.dialog || s.text !== `Your unsaved ${name} calculation will be replaced if you start a new one.` || s.focus !== "start-over-cancel") note(ctx, "dialog for " + job, JSON.stringify(s), "high");
  }
  const named = await p.evaluate(() => { const d = document.getElementById("start-over"); return [document.getElementById(d.getAttribute("aria-labelledby")).textContent, document.getElementById(d.getAttribute("aria-describedby")).textContent.slice(0, 13),
    ...["start-over-save", "start-over-yes", "start-over-cancel"].map((id) => { const e = document.getElementById(id); return e.textContent + ":" + e.className; })].join(" | "); });
  if (named !== "Save this calculation first? | Your unsaved  | Save as project:action-button | Don't save:action-button outline | Cancel:link-button") note(ctx, "dialog parts", named, "high");
  // Cancel keeps everything, focus back on the header button.
  await p.click("#start-over-cancel"); await p.waitForTimeout(150);
  s = await state();
  if (s.dialog || s.job !== "socialvideo" || s.count !== "5" || s.focus !== "new-calc") note(ctx, "dialog Cancel", JSON.stringify(s), "high");
  // Escape cancels too.
  await p.click("#new-calc"); await p.waitForTimeout(150); await p.keyboard.press("Escape"); await p.waitForTimeout(150);
  s = await state();
  if (s.dialog || s.count !== "5") note(ctx, "dialog Escape", JSON.stringify(s), "high");
  // Don't save: a fresh menu, nothing saved.
  await p.click("#new-calc"); await p.waitForTimeout(150); await p.click("#start-over-yes"); await p.waitForTimeout(300);
  s = await state();
  if (s.dialog || s.screen !== "on-inputs" || s.job !== "menu" || s.count !== "2" || s.projects !== "0") note(ctx, "Don't save", JSON.stringify(s), "high");
  // Save as project: saves, then a fresh menu.
  await change("logo", "graphic");
  await p.click("#start-over-save"); await p.waitForTimeout(150);
  if (!(await state()).save) note(ctx, "Save as project from dialog", "save dialog didn't open", "high");
  await p.keyboard.press("Enter"); await p.waitForTimeout(300);
  s = await state();
  const saved = await p.evaluate(() => { const list = JSON.parse(localStorage.getItem("counter.projects") || "[]"); return list.map((x) => x.job + ":" + x.inputs.count).join(","); });
  if (s.dialog || s.save || s.screen !== "on-inputs" || s.job !== "menu" || s.count !== "2" || s.projects !== "1" || saved !== "logo:5") note(ctx, "Save as project, then fresh", JSON.stringify(s) + " saved " + saved, "high");
}, { widths: [390, 1440] });
report("navigation"); await closeAll();
