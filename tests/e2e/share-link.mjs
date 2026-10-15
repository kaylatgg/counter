// Flow 5: share links.
import { forEachConfig, fresh, note, tap, closeAll, report, findings, BASE, sideways, axe, log } from "./lib.mjs";
const LINK = "#s=v=1&field=graphic&job=logo&count=3&rounds=2&setup=2&item=2&comm=1.5&round=1&delivery=1.5&rate=25&expenses=20&offer=200";
const state = (p) => p.evaluate(() => ({
  hash: location.hash, screen: document.body.className.match(/on-\w+/)?.[0],
  note: (() => { const r = document.getElementById("shared-row"), n = document.getElementById("shared-note-inputs"); return !r.hidden ? r.textContent.trim() : !n.hidden ? n.textContent.trim() : ""; })(),
  job: draft && draft.job, dialogs: [...document.querySelectorAll("dialog[open]")].map(d => d.id), focus: document.activeElement.id,
  amount: document.getElementById("hero-amount").textContent,
}));
await forEachConfig(async (ctx) => {
  const p = ctx.page;
  // Copy.
  await fresh(ctx, "#result");
  await tap(ctx, "#share-link"); await p.waitForTimeout(250);
  const label = (await p.textContent("#share-label")).trim();
  const panelOpen = await p.evaluate(() => document.getElementById("share-panel").open);
  if (label !== "Link copied" && !panelOpen) note(ctx, "share copy", `label "${label}"`, "high");
  if (ctx.browser === "chromium" && !panelOpen) {
    const clip = await p.evaluate(() => navigator.clipboard.readText()).catch(() => "");
    if (!clip.endsWith("#s=v=1&field=graphic&job=menu&count=2&rounds=2&setup=2&item=2&comm=1.5&round=1.5&delivery=1&rate=25&expenses=20&offer=200")) note(ctx, "share copy", "clipboard: " + clip, "high");
    if (!clip.startsWith(BASE + "#s=")) note(ctx, "share copy", "link base: " + clip.slice(0, 60), "medium");
  }
  if (panelOpen) log("f5-notes.txt", `${ctx.browser} ${ctx.width}: copy fell back to the link dialog`);
  await p.waitForTimeout(2200);
  const back = (await p.textContent("#share-label")).trim();
  if (!panelOpen && back !== "Share") note(ctx, "share copy", `label after 2s "${back}"`, "medium");
  // Opening a good link.
  await fresh(ctx, LINK); await p.waitForTimeout(300);
  let s = await state(p);
  if (s.hash !== "#result" || s.screen !== "on-results" || s.job !== "logo") note(ctx, "open link", JSON.stringify(s), "high");
  if (s.note !== "Shared result. Change anything to make it yours.") note(ctx, "open link", `note "${s.note}"`, "medium");
  await tap(ctx, '#result button[data-target=rounds][data-step="1"]'); await p.waitForTimeout(150);
  s = await state(p);
  if (s.note) note(ctx, "open link", "note stays after a change", "medium");
  // Reload after opening: stays on #result with the shared numbers, no question.
  await p.reload(); await p.waitForTimeout(300);
  s = await state(p);
  if (s.hash !== "#result" || s.job !== "logo" || s.dialogs.length) note(ctx, "open link, reload", JSON.stringify(s), "medium");
  // Cut-off and bad values.
  for (const [name, link] of [["cut off", LINK.slice(0, LINK.indexOf("&item"))], ["bad values", LINK.replace("count=3", "count=1.5").replace("rate=25", "rate=0")], ["unknown job", LINK.replace("job=logo", "job=mural")]]) {
    await fresh(ctx, link); await p.waitForTimeout(300);
    s = await state(p);
    if (s.screen !== "on-results" || s.note !== "Some numbers in this link didn't work, so we used examples.") note(ctx, "link " + name, JSON.stringify(s), "medium");
  }
  for (const [name, link] of [["unknown version", "#s=v=2&field=graphic&job=logo"], ["unreadable", "#s=%E0%A4%A"], ["empty", "#s="]]) {
    await fresh(ctx, link); await p.waitForTimeout(300);
    s = await state(p);
    if (s.screen !== "on-inputs" || s.hash !== "" || s.job !== "menu" || s.note !== "Some numbers in this link didn't work, so we used examples.") note(ctx, "link " + name, JSON.stringify(s), "medium");
    await sideways(ctx, "link " + name);
  }
  // Unsaved work: three ways out.
  for (const way of ["open", "keep", "escape"]) {
    await fresh(ctx);
    await p.fill("#count", "7"); await p.locator("#count").blur(); await p.waitForTimeout(100);
    await p.goto("about:blank"); await p.goto(BASE + LINK); await p.waitForTimeout(300);
    s = await state(p);
    if (!s.dialogs.includes("share-question")) { note(ctx, "unsaved + link", "no question: " + JSON.stringify(s), "high"); continue; }
    if (way === "open" && ctx.width === 390) await axe(ctx, "share question dialog");
    if (way === "open") await p.click("#share-open");
    else if (way === "keep") await p.click("#share-keep");
    else await p.keyboard.press("Escape");
    await p.waitForTimeout(300);
    s = await state(p);
    const count = await p.inputValue("#count");
    if (way === "open" && (s.screen !== "on-results" || s.job !== "logo" || s.hash !== "#result")) note(ctx, "question: open", JSON.stringify(s), "high");
    if (way !== "open" && (s.screen !== "on-inputs" || count !== "7" || s.hash !== "" || s.dialogs.length)) note(ctx, "question: " + way, JSON.stringify(s) + " count " + count, "high");
    // Reload after keeping mine: no question again, numbers kept.
    if (way === "keep") { await p.reload(); await p.waitForTimeout(300); s = await state(p); if (s.dialogs.length || (await p.inputValue("#count")) !== "7") note(ctx, "keep mine, reload", JSON.stringify(s), "medium"); }
  }
  // Pasting a link into the same tab (hash change, no reload).
  await fresh(ctx);
  await p.evaluate((l) => { location.hash = l.slice(1); }, LINK); await p.waitForTimeout(400);
  s = await state(p);
  if (s.screen !== "on-results" || s.job !== "logo") note(ctx, "link via hash change", JSON.stringify(s), "medium");
  // The failure path: copying fails.
  const ctx2 = { ...ctx };
}, {});
report("share link"); await closeAll();
