import { forEachConfig, fresh, note, sideways, badText, closeAll, report, findings } from "./lib.mjs";
await forEachConfig(async (ctx) => {
  const p = ctx.page;
  for (const [id, v] of [["rate", "99999999999"], ["expenses", "99999999999"], ["offer", "99999999999"], ["setup-hours", "99999999"], ["count", "999999"], ["item-hours", "99999999"], ["rounds", "999999"]]) {
    await fresh(ctx);
    await p.fill("#" + id, v); await p.locator("#" + id).blur(); await p.waitForTimeout(80);
    const t0 = Date.now();
    try { await p.locator("#check-offer").click({ timeout: 6000 }); } catch (e) { note(ctx, "huge " + id, "Check the offer timed out (page frozen?)", "high"); continue; }
    await p.waitForTimeout(300);
    const ms = Date.now() - t0;
    const r = await p.evaluate(() => [document.body.className, document.querySelectorAll("#rate-plot .rate-grid").length]);
    if (!/on-results/.test(r[0])) note(ctx, "huge " + id, "no result", "high");
    if (r[1] > 12) note(ctx, "huge " + id, r[1] + " gridlines", "medium");
    if (ms > 2500) note(ctx, "huge " + id, `slow: ${ms}ms`, "medium");
    await sideways(ctx, "huge " + id); await badText(ctx, "huge " + id);
  }
}, { widths: [390, 1440] });
report("huge values"); await closeAll();
