// Flow 9: accessibility.
import { forEachConfig, fresh, note, tap, closeAll, report, findings, axe, BASE, log } from "./lib.mjs";
// Tab through the page; returns the sequence and problems.
async function tabWalk(ctx, label, { within = null, max = 140 } = {}) {
  const p = ctx.page;
  const tabKey = ctx.browser === "webkit" ? "Alt+Tab" : "Tab";
  const seen = [];
  const problems = [];
  for (let i = 0; i < max; i++) {
    await p.keyboard.press(tabKey);
    // WebKit scrolls the focused field into view a moment after the key press.
    await p.waitForTimeout(ctx.browser === "webkit" ? 150 : 0);
    const info = await p.evaluate((within) => {
      const e = document.activeElement;
      if (!e || e === document.body) return { id: "BODY" };
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      const ring = (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== "none");
      // A focus ring on a wrapper (unit-input with :focus-within) counts too.
      let wrapRing = false;
      for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { const s = getComputedStyle(a); if ((s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || (s.boxShadow !== "none" && a.matches(":focus-within"))) { wrapRing = true; break; } }
      const key = e.id || (e.dataset.action ? e.dataset.action + ":" + (e.closest("tr")?.dataset.id || "") : "") || e.getAttribute("aria-label") || e.textContent.trim().slice(0, 20) || e.tagName;
      return { id: key, visible: r.width > 0 && r.height > 0 && cs.visibility !== "hidden", inView: r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth, ring: ring || wrapRing, outside: within ? !e.closest(within) : false, hiddenAncestor: !!e.closest("[hidden],[inert],[aria-hidden=true]") };
    }, within);
    if (info.id === "BODY") { seen.push("BODY"); continue; }
    if (seen.includes(info.id) && seen.length > 3 && info.id === seen.find(x => x !== "BODY")) break;
    seen.push(info.id);
    if (!info.visible) problems.push(`invisible focus: ${info.id}`);
    else if (!info.inView) problems.push(`focus off screen: ${info.id}`);
    if (!info.ring) problems.push(`no focus ring: ${info.id}`);
    if (info.outside) problems.push(`focus left the dialog: ${info.id}`);
    if (info.hiddenAncestor) problems.push(`focus inside hidden/aria-hidden: ${info.id}`);
  }
  if (problems.length) note(ctx, "keyboard " + label, [...new Set(problems)].join("; "), "medium");
  log("f9-tab.txt", `${ctx.browser} ${ctx.width} ${label}: ${seen.join(" > ")}`);
  return seen;
}
await forEachConfig(async (ctx) => {
  const p = ctx.page;
  // Screen 1.
  await fresh(ctx);
  await axe(ctx, "screen 1");
  const s1 = await tabWalk(ctx, "screen 1");
  for (const must of ["skip-link", "projects-link", "save-project", "count", "rounds", "setup-hours", "rate", "expenses", "offer", "check-offer"]) if (!s1.includes(must)) note(ctx, "keyboard screen 1", "never reached " + must, "high");
  // Errors on screen 1.
  await p.fill("#setup-hours", "abc"); await p.fill("#rate", "0"); await p.locator("#rate").blur(); await p.waitForTimeout(100);
  await axe(ctx, "screen 1 with errors");
  // Job replace question.
  await fresh(ctx); await p.fill("#count", "5"); await p.locator("#count").blur();
  await p.focus("#job-logo"); await p.keyboard.press("ArrowRight"); await p.waitForTimeout(150);
  const replaceShown = await p.locator("#job-replace").isVisible();
  if (!replaceShown) note(ctx, "job replace (keyboard)", "question didn't show after arrow key", "medium");
  else await axe(ctx, "job replace question");
  // Keyboard reaches the result: Enter on Check the offer.
  await fresh(ctx);
  await p.focus("#check-offer"); await p.keyboard.press("Enter"); await p.waitForTimeout(400);
  if (!/on-results/.test(await p.evaluate(() => document.body.className))) note(ctx, "keyboard check", "Enter on Check the offer didn't open the result", "high");
  if ((await p.evaluate(() => document.activeElement.id)) !== "hero-label") note(ctx, "keyboard check", "focus not on the result", "medium");
  // Screen 2 with each offer case.
  await axe(ctx, "screen 2 ($200)");
  const s2 = await tabWalk(ctx, "screen 2");
  for (const must of ["edit-details", "share-link", "save-project", "bar-count", "bar-rounds", "bar-offer", "bar-rate", "rate-plot", "quote", "use-estimate", "reply", "copy-reply", "save-image"]) if (!s2.includes(must)) note(ctx, "keyboard screen 2", "never reached " + must, "high");
  if (!s2.some(x => /math|Show the math/i.test(x)) && !(await p.evaluate(() => { const s = document.querySelector(".math summary"); s.focus(); return document.activeElement === s; }))) note(ctx, "keyboard screen 2", "Show the math not focusable", "high");
  await p.focus(".math summary"); await p.keyboard.press("Enter"); await p.waitForTimeout(100);
  if (!(await p.evaluate(() => document.querySelector(".math").open))) note(ctx, "keyboard", "Enter doesn't open Show the math", "medium");
  await axe(ctx, "screen 2 with the math open");
  for (const [name, setup] of [["no offer", async () => { await p.click("label[for=offer-none]"); }], ["$15 offer", async () => { await p.fill("#offer", "15"); }], ["0 hours", async () => { await p.click("label[for=job-custom]"); }]]) {
    await fresh(ctx); await setup(); await p.waitForTimeout(100);
    await p.goto(BASE + "#result"); await p.waitForTimeout(300);
    await axe(ctx, "screen 2 " + name);
  }
  // Dialogs: save, start over, share question, share panel, image.
  await fresh(ctx, "#result");
  await p.focus("#save-project"); await p.keyboard.press("Enter"); await p.waitForTimeout(200);
  await axe(ctx, "save dialog");
  await tabWalk(ctx, "save dialog", { within: "#save-panel", max: 8 });
  await p.keyboard.press("Escape"); await p.waitForTimeout(100);
  if ((await p.evaluate(() => document.activeElement.id)) !== "save-project") note(ctx, "save dialog Escape", "focus not returned", "medium");
  // Blank name error in the dialog.
  await p.focus("#save-project"); await p.keyboard.press("Enter"); await p.fill("#save-name", ""); await p.keyboard.press("Enter"); await p.waitForTimeout(100);
  await axe(ctx, "save dialog with error"); await p.keyboard.press("Escape");
  await fresh(ctx); await p.fill("#count", "7"); await p.locator("#count").blur();
  await p.goto(BASE + "#projects"); await p.waitForTimeout(300);
  await p.focus("#new-calc-empty"); await p.keyboard.press("Enter"); await p.waitForTimeout(200);
  if (!(await p.evaluate(() => document.getElementById("start-over").open))) note(ctx, "start over dialog", "didn't open from keyboard", "high");
  else { await axe(ctx, "start over dialog"); await tabWalk(ctx, "start over dialog", { within: "#start-over", max: 8 }); }
  await p.keyboard.press("Escape"); await p.waitForTimeout(100);
  if ((await p.evaluate(() => document.activeElement.id)) !== "new-calc-empty") note(ctx, "start over Escape", "focus " + await p.evaluate(() => document.activeElement.id), "medium");
  await tabWalk(ctx, "projects (empty)");
  await p.goto("about:blank"); await p.goto(BASE + "#s=v=1&field=graphic&job=logo&count=3&rounds=2&setup=2&item=2&comm=1.5&round=1&delivery=1.5&rate=25&expenses=20&offer=200"); await p.waitForTimeout(300);
  if (await p.evaluate(() => document.getElementById("share-question").open)) { await axe(ctx, "share question dialog"); await tabWalk(ctx, "share question dialog", { within: "#share-question", max: 6 }); }
  else note(ctx, "share question", "didn't open", "high");
  await p.keyboard.press("Escape");
  // Image dialog by keyboard.
  await fresh(ctx, "#result");
  await p.focus("#save-image"); await p.keyboard.press("Enter");
  await p.waitForFunction(() => document.getElementById("image-dialog").open, null, { timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(300);
  await axe(ctx, "image dialog");
  await tabWalk(ctx, "image dialog", { within: "#image-dialog", max: 6 });
  await p.keyboard.press("Escape"); await p.waitForTimeout(100);
  if ((await p.evaluate(() => document.activeElement.id)) !== "save-image") note(ctx, "image dialog Escape", "focus not returned", "medium");
  // Projects with rows.
  await p.evaluate(() => localStorage.setItem("counter.projects", projectStore.serializeProjects([projectStore.createProject("Menu, Oct 11", projectStore.exampleDraft("menu"), "a1", new Date()), projectStore.createProject("Logo for Sam", projectStore.exampleDraft("logo"), "a2", new Date())])));
  await p.goto("about:blank"); await p.goto(BASE + "#projects"); await p.waitForTimeout(300);
  await axe(ctx, "projects list");
  const sp = await tabWalk(ctx, "projects list");
  for (const must of ["back-to-calc", "new-calc", "edit:a1", "rename:a1", "duplicate:a1", "delete:a1"]) if (!sp.includes(must)) note(ctx, "keyboard projects", "never reached " + must, "high");
  await p.focus('[data-action="delete"]'); await p.keyboard.press("Enter"); await p.waitForTimeout(100);
  await axe(ctx, "projects delete question");
  // Share panel (copy fails).
}, { widths: [390, 1440] });
// Reduced motion: nothing moves.
await forEachConfig(async (ctx) => {
  const p = ctx.page;
  await fresh(ctx);
  await tap(ctx, "#check-offer");
  await p.waitForTimeout(30);
  const r = await p.evaluate(() => ({ anims: document.getAnimations().filter(a => a.playState === "running").map(a => (a.effect && a.effect.target && (a.effect.target.id || a.effect.target.className)) + ":" + (a.animationName || a.transitionProperty || "waapi")), orb: !!document.querySelector(".reveal-orb"), amount: document.getElementById("hero-amount").textContent, armed: document.querySelectorAll(".armed").length, cls: document.body.className }));
  if (r.anims.length || r.orb || r.amount !== "17.39" || r.armed || /reveal/.test(r.cls)) note(ctx, "reduced motion", JSON.stringify(r), "high");
  await tap(ctx, '#result button[data-target=rounds][data-step="1"]'); await p.waitForTimeout(20);
  const r2 = await p.evaluate(() => [document.getAnimations().filter(a => a.playState === "running").length, document.getElementById("hero-amount").textContent]);
  if (r2[0] || r2[1] !== "15.38") note(ctx, "reduced motion, live change", JSON.stringify(r2), "high");
  // Scrubbing still works.
  await p.focus("#rate-plot"); await p.keyboard.press("ArrowRight");
  if (!(await p.getAttribute("#rate-plot", "aria-valuetext"))) note(ctx, "reduced motion scrub", "no value", "medium");
}, { widths: [390, 1440] });
// The result summary for screen readers (CLAUDE.md section 8): announced once
// after a value changes, never on load, when a saved project or share link
// opens, or when only the screen changes. Errors announce nothing new.
const RECORD = () => {
  window.__said = [];
  document.addEventListener("DOMContentLoaded", () => {
    if (!document.getElementById("announcer")) return;
    new MutationObserver(() => {
      const t = document.getElementById("announcer").textContent;
      if (t) window.__said.push(t);
    }).observe(document.getElementById("announcer"), { childList: true, characterData: true, subtree: true });
  });
};
await forEachConfig(async (ctx) => {
  const p = ctx.page;
  const summaries = () => p.evaluate(() => window.__said.filter((t) => t.startsWith("Estimated price")));
  const clear = () => p.evaluate(() => { window.__said.length = 0; });
  async function expectSaid(where, expected) {
    await p.waitForTimeout(1400);
    const said = await summaries();
    const want = expected ? [expected] : [];
    if (JSON.stringify(said) !== JSON.stringify(want)) note(ctx, "result summary: " + where, "heard " + JSON.stringify(said) + ", expected " + JSON.stringify(want), "high");
    await clear();
  }
  await fresh(ctx);
  await expectSaid("page load", null);
  // A change event: right away, once.
  await tap(ctx, 'button[data-target=rounds][data-step="1"]');
  await p.waitForTimeout(300);
  if ((await summaries()).length !== 1) note(ctx, "result summary: stepper", "not announced right away", "high");
  await expectSaid("stepper (offer)", "Estimated price $345 for 13 hrs. The offer of $200 pays $15.38 an hour before expenses and $13.85 after. Your target is $25.00.");
  // Typing: nothing per keystroke, then once after the pause, and not again on leaving the field.
  await p.click("#offer", { clickCount: 3 });
  await p.keyboard.type("15", { delay: 150 });
  await p.waitForTimeout(500);
  if ((await summaries()).length) note(ctx, "result summary: typing", "announced before the pause", "high");
  await p.waitForTimeout(400);
  await p.locator("#offer").blur();
  await expectSaid("typing (offer below expenses)", "Estimated price $345 for 13 hrs. The offer of $15 is $5.00 less than your expenses.");
  await tap(ctx, 'label[for="offer-none"]');
  await expectSaid("no offer", "Estimated price $345 for 13 hrs. Your target is $25.00.");
  // Only the screen changes: nothing.
  await tap(ctx, "#check-offer");
  await expectSaid("screen change", null);
  await p.goBack();
  await expectSaid("Back", null);
  // Errors and 0 hours: nothing new.
  await p.fill("#rate", "0"); await p.locator("#rate").blur();
  await expectSaid("rate error", null);
  await p.fill("#rate", "25"); await p.locator("#rate").blur();
  await expectSaid("error fixed, same result as before", null);
  await p.evaluate(() => ["setup-hours", "item-hours", "communication-hours", "round-hours", "delivery-hours"].forEach((id) => { document.getElementById(id).value = "0"; }));
  await p.focus("#delivery-hours"); await p.locator("#delivery-hours").blur();
  await expectSaid("0 hours", null);
  // A saved project opening (from the list, and by address), and a share link.
  await p.evaluate(() => localStorage.setItem("counter.projects", projectStore.serializeProjects([projectStore.createProject("Logo for Sam", projectStore.exampleDraft("logo"), "a1", new Date())])));
  await p.goto("about:blank"); await p.goto(BASE + "#projects"); await p.waitForTimeout(300);
  await tap(ctx, '[data-action="open"]');
  await expectSaid("saved project opens", null);
  await p.goto("about:blank"); await p.goto(BASE + "#p/a1/result");
  await expectSaid("saved project by address", null);
  const link = await p.evaluate(() => shareLink.encodeShare("graphic", "menu", projectStore.exampleDraft("menu").inputs));
  await p.evaluate(() => localStorage.clear());
  await p.goto("about:blank"); await p.goto(BASE + link);
  await expectSaid("share link opens", null);
}, { widths: [390, 1440], opts: { init: RECORD } });
report("accessibility"); await closeAll();
