import { forEachConfig, note, closeAll, report, BASE, sideways, log } from "./lib.mjs";
const full = () => { Storage.prototype.setItem = function () { throw new DOMException("Quota exceeded", "QuotaExceededError"); }; };
await forEachConfig(async (ctx) => {
  const p = ctx.page;
  for (const hash of ["", "#result", "#projects"]) {
    await p.goto("about:blank"); await p.goto(BASE + hash); await p.waitForTimeout(200);
    await p.evaluate(() => { document.getElementById("save-error").hidden = false; });
    const r = await p.evaluate(() => {
      const e = document.getElementById("save-error").getBoundingClientRect();
      const w = innerWidth, edge = w < 760 ? 20 : w < 1024 ? 40 : 64;
      const lo = Math.max(edge, (document.documentElement.clientWidth - 1312) / 2);
      return { left: Math.round(e.left), right: Math.round(e.right), lo: Math.round(lo), hi: Math.round(document.documentElement.clientWidth - lo) };
    });
    log("errgrid.txt", `${ctx.browser} ${ctx.width} ${hash || "screen 1"}: ${r.left}-${r.right} (lines ${r.lo}-${r.hi})`);
    if (Math.abs(r.left - r.lo) > 1 || Math.abs(r.right - r.hi) > 1) note(ctx, "save error " + (hash || "screen 1"), `${r.left}-${r.right}, lines ${r.lo}-${r.hi}`, "medium");
    await sideways(ctx, "save error " + hash);
  }
}, { opts: { init: full } });
report("save error grid"); await closeAll();
