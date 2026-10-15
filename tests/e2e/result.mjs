// Flow 3: result screen, with motion on.
import { forEachConfig, fresh, note, sideways, badText, tap, closeAll, report, findings, log } from "./lib.mjs";
const armedNow = (p) => p.evaluate(() => [...document.querySelectorAll(".armed")].map(e => e.id || e.className).concat(document.getElementById("hero-amount").textContent === "0.00" ? ["hero 0.00"] : []));
await forEachConfig(async (ctx) => {
  const p = ctx.page;
  await fresh(ctx);
  // Reveal.
  await tap(ctx, "#check-offer");
  await p.waitForTimeout(150);
  const mid = await p.evaluate(() => document.body.className);
  await p.waitForTimeout(3500);
  const after = await p.evaluate(() => ({ cls: document.body.className, focus: document.activeElement.id, amount: document.getElementById("hero-amount").textContent, orb: !!document.querySelector(".reveal-orb"), y: scrollY }));
  if (!/on-results/.test(after.cls) || /revealing|reveal-hidden/.test(after.cls)) note(ctx, "reveal", "ended in " + after.cls, "high");
  if (after.amount !== "17.39") note(ctx, "reveal", "hero after play " + after.amount, "high");
  if (after.orb) note(ctx, "reveal", "orb left behind", "medium");
  if (after.focus !== "hero-label") note(ctx, "reveal", "focus on " + after.focus, "medium");
  // Slow scroll to the bottom, then back up: everything final.
  const H = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y <= H; y += 120) { await p.evaluate((y) => scrollTo(0, y), y); await p.waitForTimeout(60); }
  await p.waitForTimeout(2500);
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300);
  let left = await armedNow(p);
  if (left.length) note(ctx, "slow scroll", "still armed after scrolling through: " + left.join(", "), "high");
  // Fast: reload into a fresh reveal, jump to the bottom at once, then back.
  await fresh(ctx);
  await tap(ctx, "#check-offer"); await p.waitForTimeout(900);
  await p.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await p.waitForTimeout(400);
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(3500);
  left = await armedNow(p);
  if (left.length) note(ctx, "fast scroll", "still armed: " + left.join(", "), "high");
  // Live controls morph.
  await tap(ctx, '#result button[data-target=rounds][data-step="1"]');
  await p.waitForTimeout(600);
  let r = await p.evaluate(() => [document.getElementById("hero-amount").textContent, document.getElementById("rounds").value, document.getElementById("bar-rounds").value]);
  if (r[0] !== "15.38" || r[1] !== "3" || r[2] !== "3") note(ctx, "live rounds +", JSON.stringify(r), "high");
  await p.click("#bar-offer", { clickCount: 3 }); await p.keyboard.type("300"); await p.locator("#bar-offer").blur(); await p.waitForTimeout(600);
  r = await p.evaluate(() => [document.getElementById("hero-amount").textContent, document.getElementById("offer").value, document.getElementById("bar-offer").value]);
  if (r[0] !== "23.08" || r[1] !== "300") note(ctx, "live offer 300", JSON.stringify(r), "high");
  await p.click("#bar-rate", { clickCount: 3 }); await p.keyboard.type("1,000"); await p.locator("#bar-rate").blur(); await p.waitForTimeout(600);
  r = await p.evaluate(() => [document.getElementById("hero-sentence").textContent, document.getElementById("bar-rate").value, document.getElementById("rate").value]);
  if (!/\$1,000 target/.test(r[0]) || r[1] !== "1,000") note(ctx, "live rate 1,000", JSON.stringify(r), "medium");
  await p.click("#bar-rate", { clickCount: 3 }); await p.keyboard.type("25"); await p.click("#bar-offer", { clickCount: 3 }); await p.keyboard.type("200"); await p.locator("#bar-offer").blur();
  await tap(ctx, '#result button[data-target=rounds][data-step="-1"]'); await p.waitForTimeout(600);
  await badText(ctx, "live controls");
  // Scrubbing: pointer.
  const plot = p.locator("#rate-plot");
  await plot.scrollIntoViewIfNeeded(); await p.waitForTimeout(1500);
  const box = await plot.boundingBox();
  await p.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2); await p.waitForTimeout(200);
  const scrub = await p.evaluate(() => { const g = document.querySelector("#rate-plot .rate-scrub"); return g ? g.textContent : ""; });
  if (!/h → \$[\d.,]+\/hr/.test(scrub)) note(ctx, "scrub pointer", `scrub label "${scrub}"`, "medium");
  await p.mouse.move(5, 5); await p.waitForTimeout(150);
  // Keyboard.
  await p.focus("#rate-plot");
  const v0 = +(await p.getAttribute("#rate-plot", "aria-valuenow"));
  await p.keyboard.press("ArrowRight"); const v1 = +(await p.getAttribute("#rate-plot", "aria-valuenow"));
  await p.keyboard.press("ArrowLeft"); await p.keyboard.press("ArrowLeft"); const v2 = +(await p.getAttribute("#rate-plot", "aria-valuenow"));
  await p.keyboard.press("Home"); const vmin = await p.getAttribute("#rate-plot", "aria-valuenow");
  await p.keyboard.press("End"); const vmax = await p.getAttribute("#rate-plot", "aria-valuenow");
  const text = await p.getAttribute("#rate-plot", "aria-valuetext");
  if (v1 !== v0 + 0.5 || v2 !== v0 - 0.5) note(ctx, "scrub keys", `values ${v0} ${v1} ${v2}`, "medium");
  if (vmin !== await p.getAttribute("#rate-plot", "aria-valuemin") || vmax !== await p.getAttribute("#rate-plot", "aria-valuemax")) note(ctx, "scrub Home/End", `${vmin} ${vmax}`, "low");
  if (!/^At [\d.]+ hours?, the offer pays \$[\d.,]+ an hour after expenses\.$/.test(text)) note(ctx, "scrub keys", `valuetext "${text}"`, "medium");
  await p.keyboard.press("Escape"); await p.waitForTimeout(100);
  const shown = await p.evaluate(() => !!document.querySelector("#rate-plot .rate-scrub") && document.querySelector("#rate-plot .rate-scrub").getClientRects().length > 0 && getComputedStyle(document.querySelector("#rate-plot .rate-scrub")).display !== "none");
  if (shown) note(ctx, "scrub Escape", "line still shown", "low");
  // Show the math.
  await tap(ctx, ".math summary"); await p.waitForTimeout(150);
  r = await p.evaluate(() => [document.querySelector(".math").open, [...document.querySelectorAll("#receipt-rows tr")].map(t => t.innerText.replace(/\s+/g, " ").trim())]);
  if (!r[0]) note(ctx, "show the math", "didn't open", "high");
  const rows = r[1].join(" | ");
  for (const want of ["Production", "2 hrs + 2 pages x 2 hrs", "Communication", "2 rounds x 1.5 hrs", "Total hours", "11.5 hrs x $25/hr", "Subtotal", "$307.50", "+$2.50", "Your estimate", "$310"]) if (!rows.includes(want)) note(ctx, "receipt", `missing "${want}"`, "medium");
  await sideways(ctx, "show the math open");
  // Price to send.
  await p.fill("#quote", "280"); await p.locator("#quote").blur(); await p.waitForTimeout(150);
  r = await p.evaluate(() => [document.getElementById("quote-result").textContent.trim(), document.getElementById("reply").value]);
  if (r[0] !== "At $280, you'd earn $24.35/hr before expenses and $22.61/hr after. That's $30 below your estimate.") note(ctx, "price 280", `"${r[0]}"`, "medium");
  if (!/my price is \$280\./.test(r[1])) note(ctx, "price 280", "reply not updated: " + r[1].slice(0, 100), "high");
  await tap(ctx, "#use-estimate"); await p.waitForTimeout(100);
  r = await p.evaluate(() => [document.getElementById("quote").value, document.getElementById("reply").value]);
  if (r[0] !== "" || !/\$310\./.test(r[1])) note(ctx, "use my estimate", JSON.stringify(r).slice(0, 150), "medium");
  // Reply edit, then change rounds.
  await p.fill("#reply", "My own words."); await p.waitForTimeout(100);
  await tap(ctx, '#result button[data-target=rounds][data-step="1"]'); await p.waitForTimeout(400);
  r = await p.evaluate(() => [document.getElementById("reply").value, !document.getElementById("reply-notice").hidden]);
  if (r[0] !== "My own words." || !r[1]) note(ctx, "edited reply", JSON.stringify(r), "high");
  await tap(ctx, "#update-draft"); await p.waitForTimeout(100);
  r = await p.evaluate(() => [document.getElementById("reply").value, !document.getElementById("reply-notice").hidden]);
  if (!/3 rounds of changes/.test(r[0]) || r[1]) note(ctx, "update draft", JSON.stringify(r).slice(0, 150), "high");
  // Copy reply.
  await tap(ctx, "#copy-reply"); await p.waitForTimeout(300);
  const status = (await p.textContent("#copy-status")).trim();
  if (status !== "Copied to clipboard." && status !== "Couldn't copy. Select the text and copy it yourself.") note(ctx, "copy reply", `status "${status}"`, "high");
  if (ctx.browser === "chromium") {
    const clip = await p.evaluate(() => navigator.clipboard.readText()).catch(e => "ERR " + e.message);
    const reply = await p.inputValue("#reply");
    if (clip !== reply) note(ctx, "copy reply", "clipboard differs: " + clip.slice(0, 60), "high");
  } else log("f3-notes.txt", `${ctx.browser} ${ctx.width} copy status: ${status}`);
  await sideways(ctx, "screen 2 end");
}, { opts: { motion: true } });
report("result"); await closeAll();
