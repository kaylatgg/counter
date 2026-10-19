import { forEachConfig, fresh, note, closeAll, report, axe, BASE, log } from "./lib.mjs";
const init = () => {
  window.__fail = null;
  if (location.protocol !== "file:") return;
  const real = window.localStorage;
  Object.defineProperty(window, "localStorage", { configurable: true, get() { if (window.__fail === "blocked") throw new DOMException("The operation is insecure.", "SecurityError"); return real; } });
  const set = Storage.prototype.setItem;
  Storage.prototype.setItem = function () { if (window.__fail === "full") throw new DOMException("Quota exceeded", "QuotaExceededError"); return set.apply(this, arguments); };
};
const hdr = (p) => p.evaluate(() => ({
  button: document.getElementById("save-project").textContent.trim(), shown: document.getElementById("save-project").innerText.replace(/\s+/g, " ").trim(), disabled: document.getElementById("save-project").disabled,
  crumb: document.getElementById("crumb").hidden ? "" : document.getElementById("crumb-name").textContent,
  status: document.getElementById("save-status").textContent, statusMono: getComputedStyle(document.getElementById("save-status")).fontFamily.includes("Mono"),
  error: !document.getElementById("save-error").hidden, hash: location.hash, count: document.getElementById("projects-count").textContent,
  focus: document.activeElement.id, dialogs: [...document.querySelectorAll("dialog[open]")].length,
}));
const logState = (ctx, label, h) => log("not-saved.txt", `${ctx.browser} ${ctx.width} ${label}: ${JSON.stringify(h)}`);
for (const mode of ["blocked", "full"]) {
  await forEachConfig(async (ctx) => {
    const p = ctx.page;
    // A. The first save fails.
    await fresh(ctx, "#result");
    await p.evaluate((m) => { window.__fail = m; }, mode);
    await p.click("#save-project"); await p.waitForTimeout(100); await p.keyboard.press("Enter"); await p.waitForTimeout(200);
    let h = await hdr(p); logState(ctx, mode + " first save", h);
    if (!/^Save as project/.test(h.button) || h.disabled || h.crumb || !h.error || /#p\//.test(h.hash) || h.count !== "0" || h.dialogs) note(ctx, mode + " first save fails", JSON.stringify(h), "high");
    if (h.focus !== "save-project") note(ctx, mode + " first save fails", "focus on " + h.focus, "low");
    if (mode === "blocked" && ctx.width === 1440) await axe(ctx, "first save failed");
    // The work is still on screen and a later save works.
    await p.evaluate(() => { window.__fail = null; });
    await p.click("#save-project"); await p.waitForTimeout(100); await p.keyboard.press("Enter"); await p.waitForTimeout(200);
    h = await hdr(p); logState(ctx, mode + " save after storage back", h);
    if (h.button !== "Saved" || !h.disabled || !h.crumb || h.status !== "Saved" || h.error) note(ctx, mode + " save after storage back", JSON.stringify(h), "high");
    // B. Autosave fails on the project.
    await p.evaluate((m) => { window.__fail = m; }, mode);
    await p.click('#result button[data-target=rounds][data-step="1"]'); await p.waitForTimeout(400);
    h = await hdr(p); logState(ctx, mode + " autosave fails", h);
    // Phones: "Retry", named "Retry saving". Tablet and desktop: "Try again".
    const retry = ctx.width < 760 ? "Retry saving" : "Try again";
    if (h.shown !== retry || h.disabled || !h.crumb || h.status !== "Not saved" || !h.statusMono || !h.error) note(ctx, mode + " autosave fails", JSON.stringify(h), "high");
    if (mode === "blocked" && ctx.width === 1440) await axe(ctx, "not saved");
    // Try again while still failing: nothing else changes.
    await p.click("#save-project"); await p.waitForTimeout(150);
    const h2 = await hdr(p);
    if (h2.shown !== retry || h2.disabled || h2.status !== "Not saved" || !h2.error ) note(ctx, mode + " try again, still failing", JSON.stringify(h2), "high");
    // Storage back: Try again saves.
    await p.evaluate(() => { window.__fail = null; });
    await p.click("#save-project"); await p.waitForTimeout(150);
    h = await hdr(p); logState(ctx, mode + " try again works", h);
    if (h.button !== "Saved" || !h.disabled || h.status !== "Saved" || h.error) note(ctx, mode + " try again works", JSON.stringify(h), "high");
    const stored = await p.evaluate(() => JSON.parse(localStorage.getItem("counter.projects"))[0].inputs.rounds);
    if (stored !== "3") note(ctx, mode + " try again works", "stored rounds " + stored, "high");
    // Fail again, then a normal change once storage is back also returns to Saved.
    await p.evaluate((m) => { window.__fail = m; }, mode);
    await p.click('#result button[data-target=rounds][data-step="1"]'); await p.waitForTimeout(400);
    await p.evaluate(() => { window.__fail = null; });
    await p.click('#result button[data-target=rounds][data-step="-1"]'); await p.waitForTimeout(400);
    h = await hdr(p);
    if (h.button !== "Saved" || h.status !== "Saved" || h.error) note(ctx, mode + " later autosave works", JSON.stringify(h), "high");
    // Start over > Save as project with saving failing: doesn't start over.
    await fresh(ctx);
    await p.fill("#count", "7"); await p.locator("#count").blur(); await p.waitForTimeout(100);
    await p.evaluate((m) => { window.__fail = m; }, mode);
    await p.click("#projects-link"); await p.waitForTimeout(200);
    await p.click("#new-calc-empty"); await p.waitForTimeout(100);
    await p.click("#start-over-save"); await p.waitForTimeout(100); await p.keyboard.press("Enter"); await p.waitForTimeout(250);
    const count = await p.evaluate(() => document.getElementById("count").value);
    h = await hdr(p);
    if (count !== "7" || h.count !== "0" || !h.error) note(ctx, mode + " start over + save fails", JSON.stringify(h) + " count " + count, "high");
  }, { widths: [390, 1440], opts: { init } });
}
report("not saved"); await closeAll();
