// Download a backup and restore it: the Backup row, the empty screen, the
// restore dialog in each state, read-only mode, and the reminder.
import fs from "fs";
import path from "path";
import { forEachConfig, fresh, note, tap, closeAll, report, axe, flushErrors, OUT, BASE, seedProjects, savedProjects } from "./lib.mjs";

const NEWER = "These jobs were saved by a newer version of Counter. Reload the page to keep editing.";
const state = (p) => p.evaluate(() => {
  const open = document.getElementById("restore-panel").open;
  const visible = (id) => !document.getElementById(id).hidden && !document.getElementById(id).closest("[hidden]");
  return {
    open,
    question: document.getElementById("restore-question").textContent,
    text: visible("restore-text") ? document.getElementById("restore-text").textContent : "",
    unreadable: visible("restore-unreadable") ? document.getElementById("restore-unreadable").textContent : "",
    buttons: ["restore-yes", "restore-cancel", "restore-close"].filter(visible).join(","),
    focus: document.activeElement.id,
    note: document.getElementById("storage-note").textContent,
    rows: document.querySelectorAll("#project-rows tr").length,
    rowActions: visible("backup-actions"),
    emptyRestore: visible("backup-restore-empty"),
    announcer: document.getElementById("announcer").textContent,
  };
});
// Picks `file` in the file picker that the button opens.
async function pick(ctx, button, file) {
  const chooser = ctx.page.waitForEvent("filechooser", { timeout: 5000 });
  await tap(ctx, button);
  await (await chooser).setFiles(file);
  await ctx.page.waitForTimeout(300);
}
function writeFile(ctx, name, text) {
  const file = path.join(OUT, `${ctx.browser}-${ctx.width}-${name}`);
  fs.writeFileSync(file, text);
  return file;
}

await forEachConfig(async (ctx) => {
  const p = ctx.page;
  await fresh(ctx);
  // Three projects, one with a name that looks like markup.
  const list = await p.evaluate(() => [
    projectStore.createProject("Luigi's menu", projectStore.exampleDraft("menu"), "b1", new Date(2026, 9, 11, 15, 42)),
    projectStore.createProject("<b>Bakery</b> & \"portrait\"", projectStore.exampleDraft("portrait", "illustration"), "b2", new Date(2026, 9, 20, 18)),
    projectStore.createProject("Open studio event", projectStore.exampleDraft("event", "photography"), "b3", new Date(2026, 10, 5, 8, 15)),
  ]);
  await seedProjects(p, list);
  await p.goto("about:blank"); await p.goto(BASE + "#projects"); await p.waitForTimeout(300);
  let s = await state(p);
  if (s.note !== "Projects save in this browser on this device." || !s.rowActions || s.emptyRestore) note(ctx, "backup row, 3 projects", JSON.stringify(s), "high");
  await axe(ctx, "projects with the backup row");

  // Download.
  const download = p.waitForEvent("download", { timeout: 5000 });
  await tap(ctx, "#backup-download");
  const d = await download.catch(() => null);
  if (!d) { note(ctx, "download", "no download", "high"); return; }
  if (!/^counter-backup-\d{4}-\d{2}-\d{2}\.json$/.test(d.suggestedFilename())) note(ctx, "download", "filename " + d.suggestedFilename(), "high");
  const file = writeFile(ctx, "backup.json", fs.readFileSync(await d.path(), "utf8"));
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  if (data.app !== "counter" || data.kind !== "backup" || data.version !== 2 || JSON.stringify(data.projects) !== JSON.stringify(list)) note(ctx, "download content", JSON.stringify(data).slice(0, 160), "high");
  if (!fs.readFileSync(file, "utf8").startsWith('{\n  "app": "counter"')) note(ctx, "download content", "not pretty-printed", "medium");
  const recorded = await p.evaluate(() => localStorage.getItem("counter.v2.backup"));
  if (!recorded || !/"at":"\d{4}-/.test(recorded)) note(ctx, "download records the date", String(recorded), "high");
  await p.waitForTimeout(150);
  if ((await state(p)).announcer !== "Backup downloaded") note(ctx, "download announcement", (await state(p)).announcer, "medium");

  // A new laptop: nothing saved. The empty screen offers Restore.
  await fresh(ctx, "#projects");
  s = await state(p);
  if (!s.emptyRestore || s.rowActions) note(ctx, "empty screen", JSON.stringify(s), "high");
  await axe(ctx, "empty projects screen");

  // Cancel changes nothing, and focus goes back to the button.
  await pick(ctx, "#backup-restore-empty", file);
  s = await state(p);
  if (!s.open || s.question !== "Restore from this backup?" || s.text !== "3 projects in this backup: 3 new." || s.buttons !== "restore-yes,restore-cancel" || s.focus !== "restore-cancel") note(ctx, "restore preview", JSON.stringify(s), "high");
  await axe(ctx, "restore dialog");
  await tap(ctx, "#restore-cancel"); await p.waitForTimeout(200);
  s = await state(p);
  if (s.open || s.rows || (await savedProjects(p)).length || s.focus !== "backup-restore-empty") note(ctx, "restore Cancel", JSON.stringify(s), "high");

  // Escape cancels too.
  await pick(ctx, "#backup-restore-empty", file);
  await p.keyboard.press("Escape"); await p.waitForTimeout(200);
  s = await state(p);
  if (s.open || (await savedProjects(p)).length || s.focus !== "backup-restore-empty") note(ctx, "restore Escape", JSON.stringify(s), "high");

  // Restore: all 3 come back, field for field. Focus goes to the heading,
  // since the empty screen's button is gone.
  await pick(ctx, "#backup-restore-empty", file);
  await tap(ctx, "#restore-yes"); await p.waitForTimeout(300);
  s = await state(p);
  const back = await savedProjects(p);
  if (JSON.stringify(back) !== JSON.stringify(list)) note(ctx, "restore", "saved " + JSON.stringify(back).slice(0, 160), "high");
  if (s.open || s.rows !== 3 || s.focus !== "projects-title" || s.emptyRestore || !s.rowActions) note(ctx, "restore", JSON.stringify(s), "high");
  if (s.announcer !== "Restored 3 projects: 3 new.") note(ctx, "restore announcement", s.announcer, "medium");
  if ((await p.textContent("#projects-count")).trim() !== "3") note(ctx, "restore count", await p.textContent("#projects-count"), "high");
  const names = await p.evaluate(() => [...document.querySelectorAll("#project-rows tr")].map((r) => r.querySelector("th").textContent.trim()));
  if (!names.some((n) => n.startsWith('<b>Bakery</b> & "portrait"')) || await p.evaluate(() => !!document.querySelector("#project-rows b"))) note(ctx, "names as text", JSON.stringify(names), "high");

  // Restoring again changes nothing and doubles nothing.
  await pick(ctx, "#backup-restore", file);
  s = await state(p);
  if (s.question !== "3 projects in this backup, all already up to date." || s.buttons !== "restore-close" || s.focus !== "restore-close") note(ctx, "restore twice", JSON.stringify(s), "high");
  await tap(ctx, "#restore-close"); await p.waitForTimeout(200);
  if ((await savedProjects(p)).length !== 3 || (await state(p)).focus !== "backup-restore") note(ctx, "restore twice", "doubled or focus " + (await state(p)).focus, "high");

  // Files that can't be used: a message with only Close.
  const refusals = [
    ["newer", JSON.stringify(Object.assign({}, data, { version: 3 })), "This backup is from a newer version of Counter. Reload the page and try again."],
    ["plain-list", JSON.stringify(list), "This file isn't a Counter backup."],
    ["not-json", "hello", "This file isn't a Counter backup."],
  ];
  for (const [name, text, message] of refusals) {
    await pick(ctx, "#backup-restore", writeFile(ctx, name + ".json", text));
    s = await state(p);
    if (!s.open || s.question !== message || s.text || s.buttons !== "restore-close") note(ctx, "refused " + name, JSON.stringify(s), "high");
    if (name === "newer") await axe(ctx, "restore dialog, refused");
    await p.keyboard.press("Escape"); await p.waitForTimeout(150);
  }
  // A file with an unreadable item says so, and the item is kept.
  const withBroken = Object.assign({}, data, { projects: data.projects.concat([Object.assign({}, data.projects[0], { id: "b9", name: "New one" }), { id: "broken" }]) });
  await pick(ctx, "#backup-restore", writeFile(ctx, "broken.json", JSON.stringify(withBroken)));
  s = await state(p);
  if (s.text !== "4 projects in this backup: 1 new, 3 already up to date." || s.unreadable !== "1 item in this file can't be read. It'll be kept aside, not restored.") note(ctx, "unreadable sentence", JSON.stringify(s), "high");
  await tap(ctx, "#restore-yes"); await p.waitForTimeout(300);
  const kept = await p.evaluate(() => JSON.parse(localStorage.getItem("counter.v2.unreadable") || "[]"));
  if ((await savedProjects(p)).length !== 4 || kept.length !== 1 || kept[0].raw.id !== "broken") note(ctx, "unreadable kept", JSON.stringify(kept), "high");
  if (ctx.width === 390 || ctx.width === 1440) await flushErrors(ctx, "backup flow");
}, { widths: [390, 1440] });

// Read-only: a newer version saved the projects. Restore is refused before the
// file picker; Download still works.
await forEachConfig(async (ctx) => {
  const p = ctx.page;
  await fresh(ctx);
  const list = await p.evaluate(() => [projectStore.createProject("Poster job", projectStore.exampleDraft("poster"), "r1", new Date(2026, 9, 1))]);
  await p.evaluate((projects) => localStorage.setItem("counter.v2", JSON.stringify({ version: 3, projects })), list);
  await p.goto("about:blank"); await p.goto(BASE + "#projects"); await p.waitForTimeout(300);
  const before = await p.evaluate(() => localStorage.getItem("counter.v2"));
  let chose = false;
  p.on("filechooser", () => { chose = true; });
  await tap(ctx, "#backup-restore"); await p.waitForTimeout(300);
  const s = await state(p);
  if (chose || !s.open || s.question !== NEWER || s.buttons !== "restore-close") note(ctx, "read-only restore", JSON.stringify(s) + " picker " + chose, "high");
  await tap(ctx, "#restore-close"); await p.waitForTimeout(150);
  const download = p.waitForEvent("download", { timeout: 5000 });
  await tap(ctx, "#backup-download");
  const d = await download.catch(() => null);
  if (!d) note(ctx, "read-only download", "no download", "high");
  else if (JSON.parse(fs.readFileSync(await d.path(), "utf8")).projects.length !== 1) note(ctx, "read-only download", "wrong projects", "high");
  if (await p.evaluate(() => localStorage.getItem("counter.v2")) !== before) note(ctx, "read-only", "counter.v2 changed", "high");
}, { widths: [390, 1440] });

// The reminder: 5 projects, never backed up. A download takes it away.
await forEachConfig(async (ctx) => {
  const p = ctx.page;
  await fresh(ctx);
  const five = await p.evaluate(() => [0, 1, 2, 3, 4].map((i) => projectStore.createProject("Job " + i, projectStore.exampleDraft("menu"), "m" + i, new Date(2026, 9, 1 + i))));
  await seedProjects(p, five.slice(0, 4));
  await p.goto("about:blank"); await p.goto(BASE + "#projects"); await p.waitForTimeout(300);
  if ((await state(p)).note !== "Projects save in this browser on this device.") note(ctx, "reminder at 4", (await state(p)).note, "high");
  await seedProjects(p, five);
  await p.goto("about:blank"); await p.goto(BASE + "#projects"); await p.waitForTimeout(300);
  if ((await state(p)).note !== "Your projects are saved only in this browser.") note(ctx, "reminder at 5", (await state(p)).note, "high");
  const download = p.waitForEvent("download", { timeout: 5000 });
  await tap(ctx, "#backup-download");
  await download.catch(() => null); await p.waitForTimeout(150);
  if ((await state(p)).note !== "Projects save in this browser on this device.") note(ctx, "reminder after download", (await state(p)).note, "high");
}, { widths: [390, 1440] });
report("backup"); await closeAll();
