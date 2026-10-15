import { forEachConfig, fresh, note, closeAll, report, sideways, log } from "./lib.mjs";
const measure = (p) => p.evaluate(() => {
  const room = document.getElementById("result-summary").getBoundingClientRect();
  const panel = document.getElementById("hero-panel").getBoundingClientRect();
  const parts = ["hero-currency", "hero-amount", "hero-unit"].map(c => document.querySelector("." + c)).map(e => e.getBoundingClientRect());
  const digits = document.querySelector(".hero-digits");
  const lines = new Set(parts.filter(r => r.width).map(r => Math.round(r.bottom / 40))).size;
  return { right: Math.max(...parts.map(r => r.right)), left: Math.min(...parts.filter(r => r.width).map(r => r.left)), roomR: room.right, panelR: panel.right, size: getComputedStyle(digits).fontSize, unit: getComputedStyle(document.querySelector(".hero-unit")).fontSize, text: digits.textContent.replace(/\s+/g, ""), oneLine: digits.getBoundingClientRect().height < parseFloat(getComputedStyle(digits).fontSize) * 1.3 };
});
const cases = [["offer", "200"], ["offer", "10000"], ["offer", "1000000"], ["offer", "99999999999"], ["expenses", "99999999999"], ["none+rate", "99999999999"], ["none", ""], ["offer", "0"]];
await forEachConfig(async (ctx) => {
  const p = ctx.page;
  for (const [what, v] of cases) {
    await fresh(ctx);
    if (what.startsWith("none")) await p.click("label[for=offer-none]");
    if (what === "none+rate") await p.fill("#rate", v);
    else if (what !== "none") await p.fill("#" + what, v);
    await p.evaluate(() => document.activeElement.blur());
    await p.locator("#check-offer").click(); await p.waitForTimeout(350);
    const m = await measure(p);
    const tag = `${what} ${v}`;
    if (m.right > m.roomR + 0.5) note(ctx, tag, `number ends at ${m.right | 0}, room ends ${m.roomR | 0} (${m.text} at ${m.size})`, "high");
    if (!m.oneLine) note(ctx, tag, "number wraps", "high");
    log("hero-sizes.txt", `${ctx.browser} ${ctx.width} ${tag}: ${m.text} at ${m.size}, unit ${m.unit}`);
    await sideways(ctx, tag);
  }
});
// Live change between small and huge, with motion on: no frame is cut off.
await forEachConfig(async (ctx) => {
  const p = ctx.page;
  for (const [a, b] of [["200", "99999999999"], ["99999999999", "200"]]) {
    await fresh(ctx); await p.fill("#offer", a); await p.evaluate(() => document.activeElement.blur());
    await p.locator("#check-offer").click(); await p.waitForTimeout(3500);
    await p.evaluate(() => scrollTo(0, 0));
    await p.click("#bar-offer", { clickCount: 3 }); await p.keyboard.type(b);
    await p.evaluate(() => { window.__worst = 0; const room = () => document.getElementById("result-summary").getBoundingClientRect().right; const t0 = performance.now(); (function f() { const parts = ["hero-amount", "hero-unit"].map(c => document.querySelector("." + c).getBoundingClientRect().right); window.__worst = Math.max(window.__worst, Math.max(...parts) - room()); if (performance.now() - t0 < 1500) requestAnimationFrame(f); })(); });
    await p.evaluate(() => document.activeElement.blur());
    await p.waitForTimeout(1700);
    const worst = await p.evaluate(() => window.__worst);
    if (worst > 0.5) note(ctx, `live ${a} -> ${b}`, `a frame ran ${worst.toFixed(1)}px past the panel`, "medium");
    const m = await measure(p);
    if (m.right > m.roomR + 0.5) note(ctx, `live ${a} -> ${b}`, "final number past the panel", "high");
    log("hero-sizes.txt", `${ctx.browser} ${ctx.width} live ${a}->${b}: ${m.text} at ${m.size}, worst frame ${worst.toFixed(1)}px`);
  }
}, { widths: [390, 1440], opts: { motion: true } });
report("hero fit"); await closeAll();
