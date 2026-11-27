// Saved projects upgrade from version 1 (counter.projects) to counter.v2 (version 3),
// and version 2 saves (from before project timelines) still load and become version 3.
import { forEachConfig, fresh, note, tap, closeAll, report, BASE, seedProjects, savedProjects } from "./lib.mjs";
const rows = (p) => p.evaluate(() => [...document.querySelectorAll("#project-groups tbody tr")].map(r => r.innerText.replace(/\s+/g, " ").trim()));
await forEachConfig(async (ctx) => {
  const p = ctx.page;
  await fresh(ctx);
  // Three projects saved by version 1, and nothing else.
  const list = await p.evaluate(() => [
    projectStore.createProject("Luigi's menu", projectStore.exampleDraft("menu"), "v1-a", new Date(2026, 9, 11, 15, 42)),
    projectStore.createProject("Bakery portrait", projectStore.exampleDraft("portrait", "illustration"), "v1-b", new Date(2026, 9, 20, 18)),
    projectStore.createProject("Open studio event", projectStore.exampleDraft("event", "photography"), "v1-c", new Date(2026, 10, 5, 8, 15)),
  ]);
  await seedProjects(p, list, { v1: true });
  const v1Before = await p.evaluate(() => localStorage.getItem("counter.projects"));
  const v2Before = await p.evaluate(() => localStorage.getItem("counter.v2"));
  if (v2Before !== null) note(ctx, "upgrade seed", "counter.v2 already there", "high");
  await p.goto("about:blank"); await p.goto(BASE + "#projects"); await p.waitForTimeout(300);
  // The Projects screen shows the same jobs, newest edit first.
  const r = await rows(p);
  const names = ["Open studio event", "Bakery portrait", "Luigi's menu"];
  const jobs = ["Event", "Portrait commission", "Menu"];
  if (r.length !== 3 || names.some((name, i) => !r[i] || !r[i].startsWith(name) || !r[i].includes(jobs[i]))) note(ctx, "upgrade rows", JSON.stringify(r), "high");
  if ((await p.textContent("#projects-count")).trim() !== "3") note(ctx, "upgrade count", await p.textContent("#projects-count"), "high");
  // counter.v2 now exists, with the same projects; counter.projects is unchanged.
  const v2 = await p.evaluate(() => JSON.parse(localStorage.getItem("counter.v2")));
  if (!v2 || v2.version !== 3 || JSON.stringify(v2.projects) !== JSON.stringify(list)) note(ctx, "upgrade counter.v2", JSON.stringify(v2).slice(0, 160), "high");
  if ((await p.evaluate(() => localStorage.getItem("counter.projects"))) !== v1Before) note(ctx, "upgrade counter.projects", "changed on load", "high");
  // An upgraded project still opens, edits, and saves, into counter.v2 only.
  await tap(ctx, '#project-groups tbody tr:last-child [data-action="open"]'); await p.waitForTimeout(400);
  if ((await p.textContent("#crumb-name")).trim() !== "Luigi's menu") note(ctx, "upgrade open", await p.textContent("#crumb-name"), "high");
  await tap(ctx, '#result button[data-target=rounds][data-step="1"]'); await p.waitForTimeout(500);
  const saved = (await savedProjects(p)).find((x) => x.id === "v1-a");
  if (!saved || saved.inputs.rounds !== "3") note(ctx, "upgrade edit saves", JSON.stringify(saved && saved.inputs), "high");
  if ((await p.evaluate(() => localStorage.getItem("counter.projects"))) !== v1Before) note(ctx, "upgrade counter.projects", "changed after a save", "high");
  if ((await p.textContent("#save-status")).trim() !== "Saved") note(ctx, "upgrade edit saves", "status " + await p.textContent("#save-status"), "high");
}, { widths: [390, 1440] });

// A version 2 save (from before project timelines) still loads, and the first
// save writes it back as version 3 with the same projects.
await forEachConfig(async (ctx) => {
  const p = ctx.page;
  await fresh(ctx);
  const list = await p.evaluate(() => [
    projectStore.createProject("Luigi's menu", projectStore.exampleDraft("menu"), "v2-a", new Date(2026, 9, 11, 15, 42)),
    projectStore.createProject("Bakery portrait", projectStore.exampleDraft("portrait", "illustration"), "v2-b", new Date(2026, 9, 20, 18)),
  ]);
  await seedProjects(p, list, { version: 2 });
  await p.goto("about:blank"); await p.goto(BASE + "#projects"); await p.waitForTimeout(300);
  const r = await rows(p);
  if (r.length !== 2 || !r[0].startsWith("Bakery portrait") || !r[1].startsWith("Luigi's menu")) note(ctx, "version 2 rows", JSON.stringify(r), "high");
  if (await p.evaluate(() => !document.getElementById("newer-version").hidden)) note(ctx, "version 2", "shows the newer-version line", "high");
  // Loading alone doesn't rewrite it.
  const atLoad = await p.evaluate(() => JSON.parse(localStorage.getItem("counter.v2")).version);
  if (atLoad !== 2) note(ctx, "version 2 load", "version became " + atLoad + " before any save", "high");
  await tap(ctx, '#project-groups tbody tr:last-child [data-action="open"]'); await p.waitForTimeout(400);
  await tap(ctx, '#result button[data-target=rounds][data-step="1"]'); await p.waitForTimeout(500);
  const v3 = await p.evaluate(() => JSON.parse(localStorage.getItem("counter.v2")));
  const a = v3.projects.find((x) => x.id === "v2-a");
  const b = v3.projects.find((x) => x.id === "v2-b");
  if (v3.version !== 3 || v3.projects.length !== 2) note(ctx, "version 2 save", JSON.stringify(v3).slice(0, 160), "high");
  if (!a || a.inputs.rounds !== "3" || "timeline" in a) note(ctx, "version 2 save", "edited project " + JSON.stringify(a && a.inputs), "high");
  if (JSON.stringify(b) !== JSON.stringify(list[1])) note(ctx, "version 2 save", "other project changed", "high");
  if ((await p.textContent("#save-status")).trim() !== "Saved") note(ctx, "version 2 save", "status " + await p.textContent("#save-status"), "high");
}, { widths: [390, 1440] });
report("upgrade"); await closeAll();
