// Flow 2: offers.
import { forEachConfig, fresh, note, sideways, badText, tap, closeAll, report, findings, log } from "./lib.mjs";
const expect = {
  none: { label: "Your estimate", amount: "310", unit: "", sentence: /^11\.5 hours at your \$25\.00\/hr target, plus \$20\.00 in expenses\. Rounded up from \$307\.50\.$/, chart: "hidden", stats: ["Total hours", "Your time at $25/hr", "Expenses", "Usually forgotten"], reply: /my price is \$310\./ },
  "0": { label: "This offer costs you", amount: "20.00", unit: "", sentence: /before counting any of your 11\.5 hours\./, chart: "hidden", reply: /my price is \$310\./ },
  "15": { label: "This offer costs you", amount: "5.00", unit: "", sentence: /before counting any of your 11\.5 hours\./, chart: "hidden", reply: /my price is \$310\./ },
  "20": { label: "This offer pays", amount: "1.74", unit: "/hr", sentence: /\$23\.26 an hour under your \$25 target/, chart: "hidden", reply: /my price is \$310\./ },
  "200": { label: "This offer pays", amount: "17.39", unit: "/hr", sentence: /^for 11\.5 hours of real work\. That's \$7\.61 an hour under your \$25 target\.$/, chart: "shown", stats: ["Your estimate", "More than they offered", "Hours the offer pays for", "After expenses"], reply: /my price is \$310\./ },
  "310": { label: "This offer pays", amount: "26.96", unit: "/hr", sentence: /over your \$25 target/, chart: "shown", stats: ["Your estimate", "Same as their offer"], reply: /\$310 works for me/ },
  "1000": { label: "This offer pays", amount: "86.96", unit: "/hr", sentence: /That's \$61\.96 an hour over your \$25 target\./, chart: "shown", stats: ["Your estimate", "Above your estimate"], reply: /\$1,000 works for me/ },
  "10000": { label: "This offer pays", amount: "869.57", unit: "/hr", sentence: /over your \$25 target/, chart: "shown", reply: /\$10,000 works for me/ },
};
await forEachConfig(async (ctx) => {
  const p = ctx.page;
  for (const [offer, e] of Object.entries(expect)) {
    await fresh(ctx);
    if (offer === "none") await tap(ctx, "label[for=offer-none]");
    else { await p.fill("#offer", offer); await p.locator("#offer").blur(); }
    await p.waitForTimeout(60);
    const offerShown = await p.locator("#offer").isVisible();
    if (offer === "none" && offerShown) note(ctx, "offer Not yet", "amount field still visible", "medium");
    await tap(ctx, "#check-offer");
    await p.waitForTimeout(400);
    const r = await p.evaluate(() => ({
      screen: document.body.className,
      label: document.getElementById("hero-label").textContent.trim(),
      amount: document.getElementById("hero-amount").textContent.trim(),
      unit: document.getElementById("hero-unit").textContent.trim(),
      unitVisible: !!document.getElementById("hero-unit").getClientRects().length && document.getElementById("hero-unit").textContent.trim() !== "",
      sentence: document.getElementById("hero-sentence").textContent.trim(),
      stats: [...document.querySelectorAll("#metrics dt")].map(d => d.textContent.trim()),
      statValues: [...document.querySelectorAll("#metrics dd")].map(d => d.textContent.trim()),
      chartHidden: document.getElementById("offer-chart").hidden || !document.getElementById("offer-chart").getClientRects().length,
      chartAria: document.getElementById("offer-chart").closest("[aria-hidden=true]") !== null,
      reply: document.getElementById("reply").value,
      warning: (() => { const w = document.getElementById("offer-warning"); return w.hidden ? "" : w.textContent.trim(); })(),
      spoken: document.getElementById("hero-spoken").textContent.trim(),
      single: document.querySelector(".charts-row").classList.contains("single"),
    }));
    const where = "offer " + offer;
    if (!/on-results/.test(r.screen)) { note(ctx, where, "didn't reach screen 2", "high"); continue; }
    if (r.label !== e.label) note(ctx, where, `hero label "${r.label}"`, "high");
    if (r.amount !== e.amount) note(ctx, where, `hero amount "${r.amount}", expected ${e.amount}`, "high");
    if ((r.unitVisible ? r.unit : "") !== e.unit) note(ctx, where, `hero unit "${r.unit}" visible=${r.unitVisible}`, "medium");
    if (!e.sentence.test(r.sentence)) note(ctx, where, `sentence "${r.sentence}"`, "medium");
    if (e.stats && !e.stats.every((s, i) => r.stats[i] === s)) note(ctx, where, `stats ${JSON.stringify(r.stats)}`, "medium");
    const hidden = r.chartHidden;
    if ((e.chart === "hidden") !== hidden) note(ctx, where, `rate chart hidden=${hidden}`, "high");
    if (e.chart === "hidden" && !r.single) note(ctx, where, "hours chart not full row", "low");
    if (!e.reply.test(r.reply)) note(ctx, where, `reply "${r.reply.slice(0, 120)}"`, "high");
    await badText(ctx, where);
    await sideways(ctx, where);
    // The hero number and stat numbers never run past their space.
    const clipped = await p.evaluate(() => {
      const out = [];
      const room = document.getElementById("result-summary").getBoundingClientRect().right;
      const heroRight = Math.max(...[".hero-amount", ".hero-unit"].map(s => document.querySelector(s).getBoundingClientRect().right));
      if (heroRight > room + 0.5) out.push("hero number");
      document.querySelectorAll("#metrics dd").forEach((d, i) => { if (d.scrollWidth > d.clientWidth + 1) out.push("stat " + (i + 1)); });
      return out;
    });
    if (clipped.length) note(ctx, where, "clipped text: " + clipped.join(", "), "medium");
    log("f2-values.txt", `${ctx.browser} ${ctx.width} ${offer}: ${r.label} | ${r.amount}${r.unit} | ${r.sentence} | ${r.statValues.join(" / ")} | warn: ${r.warning}`);
  }
});
report("offers"); await closeAll();
