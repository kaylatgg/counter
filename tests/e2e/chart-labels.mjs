// Chart labels for every job and offer: no overlaps, nothing outside the
// chart, the target label never hidden, and the short "target" never used
// where the y axis's "$25" is hidden.
import { forEachConfig, note, closeAll, report, BASE } from "./lib.mjs";

const OFFERS = ["15", "200", "400", "1000", "5000", "10000"];
// Cases where the split label fits on neither side of its line at 320px.
const EXTRA = { socialvideo: ["300"], explainer: ["600"] };

await forEachConfig(async (ctx) => {
  const p = ctx.page;
  await p.goto(BASE); await p.waitForTimeout(150);
  const fields = await p.evaluate(() => Object.fromEntries(Object.keys(calc.WORK_FIELDS).map((f) => [f, calc.WORK_FIELDS[f].jobs])));
  for (const field of Object.keys(fields)) for (const job of fields[field]) for (const offer of OFFERS.concat(EXTRA[job] || [])) {
    if (job === "custom" && field !== "graphic") continue;
    const ex = await p.evaluate(([j, f]) => projectStore.exampleDraft(j, f).inputs, [job, field]);
    if (job === "custom") Object.assign(ex, { setupHours: "2", itemHours: "3", communicationHours: "1", roundHours: "1", deliveryHours: "1" });
    const hash = "#s=" + new URLSearchParams({ v: 1, field, job, count: ex.count, rounds: ex.rounds, setup: ex.setupHours, item: ex.itemHours, comm: ex.communicationHours, round: ex.roundHours, delivery: ex.deliveryHours, rate: 25, expenses: 20, offer });
    await p.goto(BASE); await p.evaluate(() => localStorage.clear());
    await p.goto("about:blank"); await p.goto(BASE + hash);
    // The charts lay out again once the fonts load; measure after that.
    await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400);
    const tag = `${job} $${offer}`;
    const res = await p.evaluate(() => {
      const issues = [];
      const overlapCheck = (boxes, area, what) => {
        boxes.forEach(([a, A], i) => {
          if (A.left < area.left - 0.5 || A.right > area.right + 0.5 || A.top < area.top - 0.5 || A.bottom > area.bottom + 0.5) issues.push(`${what}: "${a}" outside the chart`);
          boxes.slice(i + 1).forEach(([b, B]) => { if (A.left < B.right && B.left < A.right && A.top < B.bottom && B.top < A.bottom) issues.push(`${what}: "${a}" overlaps "${b}"`); });
        });
      };
      // Hours chart: the budget bar's labels and By task.
      const hc = document.getElementById("hours-chart").getBoundingClientRect();
      overlapCheck([...document.querySelectorAll("#budget-split-label, .budget-label, #group-legend li")].filter((e) => e.getClientRects().length && e.textContent.trim()).map((e) => [e.textContent.trim(), e.getBoundingClientRect()]), hc, "hours chart");
      // The split line never runs through its label, and the label never
      // touches the bar under it.
      const line = document.getElementById("budget-split");
      const label = document.getElementById("budget-split-label");
      if (line.getClientRects().length && !line.hidden) {
        const L = line.getBoundingClientRect(), l = label.getBoundingClientRect();
        if (l.left < L.left + 1 && l.right > L.left - 1 && L.top < l.bottom) issues.push(`hours chart: the split line crosses "${label.textContent}"`);
        const B = document.getElementById("budget-bar").getBoundingClientRect();
        if (l.left < B.right && B.left < l.right && l.top < B.bottom && B.top < l.bottom) issues.push(`hours chart: "${label.textContent}" overlaps the bar`);
      }
      // A label inside the bar stays inside its part of it.
      ["budget-covered", "budget-beyond"].forEach((id) => {
        const part = document.getElementById(id), inner = part.querySelector(".budget-label");
        if (!inner || !inner.getClientRects().length) return;
        const P = part.getBoundingClientRect(), I = inner.getBoundingClientRect();
        if (I.left < P.left - 0.5 || I.right > P.right + 0.5) issues.push(`hours chart: "${inner.textContent}" runs out of its part of the bar`);
      });
      // Rate chart, when it shows.
      const plot = document.getElementById("rate-plot");
      if (plot.getClientRects().length && !document.getElementById("offer-chart").hidden) {
        const texts = [...plot.querySelectorAll("svg text")].filter((e) => !e.closest(".rate-scrub"));
        overlapCheck(texts.filter((e) => e.getAttribute("display") !== "none").map((e) => [e.textContent, e.getBoundingClientRect()]), plot.getBoundingClientRect(), "rate chart");
        const t = plot.querySelector(".rate-target-label");
        if (!t || t.getAttribute("display") === "none") issues.push("rate chart: target label hidden");
        const axis = texts.find((e) => e.classList.contains("rate-tick") && e.textContent === "$25");
        if (t && t.textContent === "target" && (!axis || axis.getAttribute("display") === "none")) issues.push('rate chart: short "target" with "$25" hidden');
      }
      return issues;
    });
    res.forEach((i) => note(ctx, tag, i, "medium"));
  }
});
report("chart labels"); await closeAll();
