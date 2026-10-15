// Flow 1: inputs.
import { forEachConfig, fresh, note, sideways, badText, tap, closeAll, report } from "./lib.mjs";
await forEachConfig(async (ctx) => {
  const p = ctx.page;
  await fresh(ctx);
  const fields = await p.evaluate(() => Object.fromEntries(Object.keys(calc.WORK_FIELDS).map(f => [f, calc.WORK_FIELDS[f].jobs])));
  // Every field and job (from a fresh draft, so no Replace question).
  for (const field of Object.keys(fields)) {
    await tap(ctx, `label[for=field-${field}]`);
    await p.waitForTimeout(60);
    const first = await p.evaluate(() => document.querySelector("input[name=job]:checked").value);
    if (first !== fields[field][0]) note(ctx, "field " + field, `first job selected is ${first}, expected ${fields[field][0]}`, "medium");
    for (const job of fields[field]) {
      const visible = await p.locator(`label[for=job-${job}]`).isVisible();
      if (!visible) { note(ctx, "job " + job, "pill not visible in its field", "high"); continue; }
      await tap(ctx, `label[for=job-${job}]`);
      await p.waitForTimeout(60);
      if (await p.locator("#job-replace").isVisible()) await tap(ctx, "#job-replace-yes");
      const r = await p.evaluate((job) => {
        const ex = calc.JOBS[job].example;
        const total = ex.setupHours + ex.count * ex.itemHours + ex.communicationHours + ex.rounds * ex.roundHours + ex.deliveryHours;
        return {
          total, shown: document.getElementById("total-hours").textContent.trim(),
          countLabel: document.getElementById("count-label").textContent.trim(), expectLabel: calc.JOBS[job].countLabel,
          setup: document.getElementById("setup-label").textContent.trim(), expectSetup: calc.JOBS[job].setup,
          pillInView: (() => { const l = document.querySelector(`label[for=job-${job}]`).getBoundingClientRect(); return l.left >= -1 && l.right <= innerWidth + 1; })(),
        };
      }, job);
      if (String(+r.shown.replace(/,/g, "")) !== String(r.total)) note(ctx, "job " + job, `tally shows ${r.shown}, expected ${r.total}`, "high");
      if (r.countLabel !== r.expectLabel) note(ctx, "job " + job, `stepper label "${r.countLabel}" expected "${r.expectLabel}"`, "medium");
      if (r.setup !== r.expectSetup) note(ctx, "job " + job, `setup label "${r.setup}"`, "medium");
      if (!r.pillInView) note(ctx, "job " + job, "selected pill not scrolled into view", "medium");
      await sideways(ctx, "job " + job);
    }
  }
  // Steppers.
  await fresh(ctx);
  for (const target of ["count", "rounds"]) {
    const v0 = +(await p.inputValue("#" + target));
    await tap(ctx, `#screen-inputs button[data-target=${target}][data-step="1"]`);
    const v1 = +(await p.inputValue("#" + target));
    if (v1 !== v0 + 1) note(ctx, "stepper " + target, `+ went ${v0} -> ${v1}`, "high");
    for (let i = 0; i < v1 + 2; i++) await tap(ctx, `#screen-inputs button[data-target=${target}][data-step="-1"]`);
    const v2 = await p.inputValue("#" + target);
    if (v2 !== "0") note(ctx, "stepper " + target, `minus floor is "${v2}"`, "high");
  }
  // Typing, blank, invalid.
  await fresh(ctx);
  const cases = [
    ["setup-hours", "", /Enter the hours for .*Use 0 if there are none\./],
    ["setup-hours", "abc", /Use a number for/],
    ["setup-hours", "-1", /can't be less than 0/],
    ["count", "1.5", /Use a whole number for pages/],
    ["rounds", "2.5", /Use a whole number for/],
    ["rate", "0", /Your target hourly rate needs to be more than 0\./],
    ["rate", "", /Your target hourly rate needs to be more than 0\./],
    ["expenses", "", /Enter .*Use 0 if there are none\./],
    ["expenses", "-5", /can't be less than 0/],
    ["communication-hours", "x", /Use a number for/],
  ];
  for (const [id, value, msg] of cases) {
    await fresh(ctx);
    await p.fill("#" + id, value);
    await p.locator("#" + id).blur();
    await p.waitForTimeout(80);
    const r = await p.evaluate((id) => {
      const el = document.getElementById(id);
      const ids = (el.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean);
      const texts = ids.map(i => document.getElementById(i)).filter(e => e && !e.hidden).map(e => e.textContent.trim());
      return { invalid: el.getAttribute("aria-invalid"), texts, button: document.getElementById("check-preview").textContent.trim() };
    }, id);
    if (r.invalid !== "true") note(ctx, `${id}="${value}"`, "no aria-invalid", "high");
    if (!r.texts.some(t => msg.test(t))) note(ctx, `${id}="${value}"`, `error text: ${JSON.stringify(r.texts)}`, "high");
    if (!/Fix 1 field to continue/.test(r.button)) note(ctx, `${id}="${value}"`, `button line: "${r.button}"`, "medium");
    // Pressing the button moves focus to the field with the error.
    await tap(ctx, "#check-offer"); await p.waitForTimeout(100);
    const focus = await p.evaluate(() => document.activeElement.id);
    if (focus !== id) note(ctx, `${id}="${value}"`, `Check the offer focused ${focus}`, "medium");
    await badText(ctx, `${id}="${value}"`);
  }
  // Commas in money fields.
  await fresh(ctx);
  for (const [typed, shown] of [["1983770", "1,983,770"], ["1,000", "1,000"], ["1000.5", "1,000.5"]]) {
    await p.fill("#rate", typed); await p.locator("#rate").blur(); await p.waitForTimeout(60);
    const v = await p.inputValue("#rate");
    if (v !== shown) note(ctx, `rate "${typed}"`, `shows "${v}", expected "${shown}"`, "medium");
    await p.focus("#rate");
    const f = await p.inputValue("#rate");
    if (f.includes(",")) note(ctx, `rate "${typed}"`, `focused shows "${f}" (should be plain digits)`, "low");
    const inv = await p.getAttribute("#rate", "aria-invalid");
    if (inv === "true") note(ctx, `rate "${typed}"`, "marked invalid", "high");
  }
  // Zero hours (Custom).
  await fresh(ctx);
  await tap(ctx, "label[for=job-custom]");
  await p.waitForTimeout(80);
  const zl = await p.textContent("#check-preview");
  if (!/Add hours to check the offer/.test(zl)) note(ctx, "custom 0 hrs", `button line "${zl.trim()}"`, "medium");
  await tap(ctx, "#check-offer"); await p.waitForTimeout(150);
  const z = await p.evaluate(() => [document.activeElement.id, document.getElementById("work-error").textContent.trim(), document.body.className]);
  if (z[0] !== "setup-hours") note(ctx, "custom 0 hrs", `focus went to ${z[0]}`, "medium");
  if (z[1] !== "Add at least one hour of work.") note(ctx, "custom 0 hrs", `work error "${z[1]}"`, "medium");
  await p.click("label[for=offer-none]"); await p.waitForTimeout(60);
  const zl2 = await p.textContent("#check-preview");
  if (!/Add hours to get your estimate/.test(zl2)) note(ctx, "custom 0 hrs, no offer", `button line "${zl2.trim()}"`, "medium");
  // Huge numbers.
  await fresh(ctx);
  await p.fill("#count", "99"); await p.fill("#item-hours", "40"); await p.locator("#item-hours").blur(); await p.waitForTimeout(100);
  const weeks = await p.evaluate(() => { const e = document.getElementById("work-weeks"); return e && !e.hidden ? e.textContent.trim() : ""; });
  if (!/That's about 99 weeks of full-time work\. Check your hours\./.test(weeks)) note(ctx, "huge hours", `weeks note "${weeks}"`, "medium");
  await sideways(ctx, "huge hours screen 1");
  for (const [id, v] of [["rate", "99999999999"], ["expenses", "99999999999"], ["offer", "99999999999"], ["setup-hours", "99999999"], ["count", "999999"]]) {
    await fresh(ctx);
    await p.fill("#" + id, v); await p.locator("#" + id).blur(); await p.waitForTimeout(80);
    await sideways(ctx, `huge ${id} screen 1`);
    await badText(ctx, `huge ${id} screen 1`);
    await tap(ctx, "#check-offer"); await p.waitForTimeout(300);
    if (await p.evaluate(() => document.body.classList.contains("on-results"))) {
      await sideways(ctx, `huge ${id} screen 2`);
      await badText(ctx, `huge ${id} screen 2`);
      // Text overflowing its own box (cut-off numbers).
      const clipped = await p.evaluate(() => [...document.querySelectorAll("#hero-panel .hero-amount, #metrics dd, .math-estimate, #bar-labels *")].filter(e => e.getClientRects().length && e.getBoundingClientRect().right > innerWidth + 1).map(e => e.id || e.className || e.tagName));
      if (clipped.length) note(ctx, `huge ${id} screen 2`, "text past the window: " + clipped.join(", "), "medium");
    }
  }
});
report("inputs"); await closeAll();
