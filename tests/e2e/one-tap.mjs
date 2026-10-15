// One tap on Check the offer right after typing in each field, both browsers.
import { forEachConfig, fresh, note, closeAll, report } from "./lib.mjs";
await forEachConfig(async (ctx) => {
  const p = ctx.page;
  for (const [id, v] of [["offer", "200"], ["offer", "1,000"], ["rate", "30"], ["setup-hours", "3"], ["count", "4"], ["expenses", "25"]]) {
    await fresh(ctx);
    await p.click("#" + id, { clickCount: 3 }); await p.keyboard.type(v);
    const b = await p.locator("#check-offer").boundingBox();
    if (b.y + b.height > (await p.evaluate(() => innerHeight))) { await p.evaluate(() => document.getElementById("check-offer").scrollIntoView({ block: "center" })); }
    const b2 = await p.locator("#check-offer").boundingBox();
    await p.mouse.click(b2.x + b2.width / 2, b2.y + b2.height / 2); await p.waitForTimeout(350);
    if (!/on-results/.test(await p.evaluate(() => document.body.className))) note(ctx, `one tap after typing in ${id}`, "result didn't open", "high");
  }
});
report("one tap"); await closeAll();
