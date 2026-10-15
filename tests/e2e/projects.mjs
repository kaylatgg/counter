// Flow 6: projects.
import { forEachConfig, fresh, note, tap, closeAll, report, findings, sideways, badText, axe } from "./lib.mjs";
const stored = (p) => p.evaluate(() => JSON.parse(localStorage.getItem("counter.projects") || "[]"));
const rows = (p) => p.evaluate(() => [...document.querySelectorAll("#project-rows tr")].map(r => r.innerText.replace(/\s+/g, " ").trim()));
await forEachConfig(async (ctx) => {
  const p = ctx.page;
  await fresh(ctx);
  // Empty state.
  await tap(ctx, "#projects-link"); await p.waitForTimeout(200);
  let r = await p.evaluate(() => [document.getElementById("projects-empty").hidden, document.getElementById("projects-empty").textContent.replace(/\s+/g, " ").trim(), document.getElementById("project-table").hidden, document.getElementById("projects-count").textContent]);
  if (r[0] || !/No projects yet\. Start one to see what a job really pays\./.test(r[1]) || !r[2] || r[3] !== "0") note(ctx, "projects empty", JSON.stringify(r), "medium");
  if (ctx.width === 390 || ctx.width === 1440) await axe(ctx, "projects empty");
  await tap(ctx, "#back-to-calc"); await p.waitForTimeout(150);
  // Save from screen 2.
  await tap(ctx, "#check-offer"); await p.waitForTimeout(300);
  await tap(ctx, "#save-project"); await p.waitForTimeout(150);
  const def = await p.inputValue("#save-name");
  const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (def !== "Menu, " + today) note(ctx, "save default name", `"${def}"`, "medium");
  await p.fill("#save-name", "x".repeat(70));
  const len = (await p.inputValue("#save-name")).length;
  if (len !== 60) note(ctx, "save 60 chars", "length " + len, "medium");
  await p.fill("#save-name", "Client menu");
  await p.keyboard.press("Enter"); await p.waitForTimeout(200);
  r = await p.evaluate(() => [document.getElementById("save-project").textContent.trim(), document.getElementById("save-project").disabled, document.getElementById("crumb-name").textContent, document.getElementById("projects-count").textContent, location.hash]);
  if (r[0] !== "Saved" || !r[1] || r[2] !== "Client menu" || r[3] !== "1" || !/^#p\/.+\/result$/.test(r[4])) note(ctx, "save", JSON.stringify(r), "high");
  let list = await stored(p);
  if (list.length !== 1) note(ctx, "save", "stored " + list.length, "high");
  const id = list[0] && list[0].id;
  // Autosave.
  const edited0 = list[0].edited;
  await p.waitForTimeout(50);
  await tap(ctx, '#result button[data-target=rounds][data-step="1"]'); await p.waitForTimeout(1300);
  list = await stored(p);
  if (list[0].inputs.rounds !== "3") note(ctx, "autosave", "stored rounds " + list[0].inputs.rounds, "high");
  // Draft reset after saving.
  const d = await p.evaluate(() => JSON.parse(localStorage.getItem("counter.draft") || "null"));
  if (!d || d.job !== "menu" || d.inputs.rounds !== "2") note(ctx, "draft after save", JSON.stringify(d).slice(0, 100), "medium");
  // Header rename: Escape cancels, blank keeps, Enter saves.
  await tap(ctx, "#crumb-name"); await p.fill("#crumb-input", "Nope"); await p.keyboard.press("Escape"); await p.waitForTimeout(100);
  if ((await p.textContent("#crumb-name")) !== "Client menu") note(ctx, "header rename Escape", "changed", "medium");
  await tap(ctx, "#crumb-name"); await p.fill("#crumb-input", "   "); await p.keyboard.press("Enter"); await p.waitForTimeout(100);
  if ((await p.textContent("#crumb-name")) !== "Client menu") note(ctx, "header rename blank", "changed", "medium");
  await tap(ctx, "#crumb-name"); await p.fill("#crumb-input", "y".repeat(70));
  const l2 = (await p.inputValue("#crumb-input")).length; if (l2 !== 60) note(ctx, "header rename 60", "length " + l2, "medium");
  await p.fill("#crumb-input", "Menu for Ana"); await p.keyboard.press("Enter"); await p.waitForTimeout(100);
  list = await stored(p);
  if ((await p.textContent("#crumb-name")) !== "Menu for Ana" || list[0].name !== "Menu for Ana") note(ctx, "header rename", "not saved", "high");
  await sideways(ctx, "screen 2 in a project");
  // Projects page.
  await tap(ctx, "#projects-link"); await p.waitForTimeout(200);
  let rs = await rows(p);
  if (!/Menu for Ana/.test(rs[0]) || !/Menu/.test(rs[0]) || !/\$345/.test(rs[0]) && ctx.width >= 760 || !/Edited just now/.test(rs[0])) note(ctx, "projects row", rs[0], "medium");
  if (ctx.width >= 760 && !/\$15\.38\/hr/.test(rs[0])) note(ctx, "projects row offer", rs[0], "low");
  const backLabel = (await p.textContent("#back-to-calc-label")).trim();
  if (backLabel !== "Back to Menu for Ana") note(ctx, "back pill", `"${backLabel}"`, "medium");
  // Duplicate.
  await tap(ctx, '#project-rows [data-action="duplicate"]'); await p.waitForTimeout(150);
  rs = await rows(p);
  if (rs.length !== 2 || !/Menu for Ana copy/.test(rs.join("|"))) note(ctx, "duplicate", JSON.stringify(rs), "high");
  const f = await p.evaluate(() => document.activeElement.textContent);
  if (f !== "Menu for Ana copy") note(ctx, "duplicate focus", f, "low");
  if ((await p.textContent("#projects-count")) !== "2") note(ctx, "count after duplicate", await p.textContent("#projects-count"), "medium");
  // Row rename with 60-char limit, and duplicate of a 60-char name.
  await tap(ctx, '#project-rows tr:first-child [data-action="rename"]');
  await p.fill(".row-rename", "z".repeat(70));
  const l3 = (await p.inputValue(".row-rename")).length; if (l3 !== 60) note(ctx, "row rename 60", "length " + l3, "medium");
  await p.keyboard.press("Enter"); await p.waitForTimeout(150);
  await tap(ctx, '#project-rows tr:first-child [data-action="duplicate"]'); await p.waitForTimeout(150);
  list = await stored(p);
  const long = list.map(x => x.name).filter(n => n.length > 60);
  if (long.length) note(ctx, "duplicate long name", "names over 60: " + long.join(", "), "medium");
  if (ctx.width === 390 || ctx.width === 1440) await axe(ctx, "projects list");
  await sideways(ctx, "projects list");
  await badText(ctx, "projects list");
  // Delete: cancel, then delete.
  const before = (await rows(p)).length;
  await tap(ctx, '#project-rows tr:first-child [data-action="delete"]'); await p.waitForTimeout(100);
  const q = await p.evaluate(() => document.querySelector(".delete-question")?.textContent);
  if (!/^Delete .+\? This can't be undone\.$/.test(q || "")) note(ctx, "delete question", q, "medium");
  if (await p.evaluate(() => document.activeElement.dataset.action) !== "cancel-delete") note(ctx, "delete focus", "not on Cancel", "low");
  await p.keyboard.press("Enter"); await p.waitForTimeout(100);
  if ((await rows(p)).length !== before || await p.evaluate(() => document.activeElement.dataset.action) !== "delete") note(ctx, "cancel delete", "rows or focus wrong", "medium");
  await tap(ctx, '#project-rows tr:first-child [data-action="delete"]'); await tap(ctx, '[data-action="confirm-delete"]'); await p.waitForTimeout(150);
  if ((await rows(p)).length !== before - 1 || (await stored(p)).length !== before - 1) note(ctx, "delete", "not removed", "high");
  if ((await p.textContent("#projects-count")) !== String(before - 1)) note(ctx, "count after delete", await p.textContent("#projects-count"), "medium");
  // Edit opens screen 1; reopen opens screen 2; opening doesn't change edited.
  list = await stored(p);
  const ed = list.map(x => x.edited).join();
  await tap(ctx, '#project-rows tr:first-child [data-action="edit"]'); await p.waitForTimeout(200);
  r = await p.evaluate(() => [document.body.className, location.hash, document.getElementById("crumb-name").textContent]);
  if (!/on-inputs/.test(r[0]) || !/^#p\/[^/]+$/.test(r[1])) note(ctx, "edit", JSON.stringify(r), "high");
  await tap(ctx, "#projects-link"); await p.waitForTimeout(150);
  await tap(ctx, "#project-rows tr:first-child .project-open"); await p.waitForTimeout(250);
  r = await p.evaluate(() => [document.body.className, location.hash]);
  if (!/on-results/.test(r[0]) || !/\/result$/.test(r[1])) note(ctx, "reopen", JSON.stringify(r), "high");
  if ((await stored(p)).map(x => x.edited).join() !== ed) note(ctx, "reopen", "edited date changed by opening", "medium");
  // Delete everything: empty state again, focus to New calculation.
  await tap(ctx, "#projects-link"); await p.waitForTimeout(150);
  while ((await rows(p)).length) { await tap(ctx, '#project-rows tr:first-child [data-action="delete"]'); await tap(ctx, '[data-action="confirm-delete"]'); await p.waitForTimeout(100); }
  r = await p.evaluate(() => [document.getElementById("projects-empty").hidden, document.activeElement.id, document.getElementById("projects-count").textContent]);
  if (r[0] || r[1] !== "new-calc-empty" || r[2] !== "0") note(ctx, "delete all", JSON.stringify(r), "medium");
  // Back to calculator after deleting the project we came from.
  await tap(ctx, "#back-to-calc"); await p.waitForTimeout(200);
  r = await p.evaluate(() => [document.body.className, location.hash, document.getElementById("crumb").hidden]);
  if (/#p\//.test(r[1]) || !r[2]) note(ctx, "back after deleting its project", JSON.stringify(r), "high");
});
report("projects"); await closeAll();
