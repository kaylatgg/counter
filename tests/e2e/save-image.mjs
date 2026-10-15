// Flow 4: Save image.
import { forEachConfig, fresh, note, tap, closeAll, report, findings, axe } from "./lib.mjs";
const spy = () => {
  window.__texts = [];
  const orig = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function (t, x, y) {
    const w = this.measureText(t).width;
    const left = this.textAlign === "right" || this.textAlign === "end" ? x - w : this.textAlign === "center" ? x - w / 2 : x;
    if (this.canvas.width === 1080) window.__texts.push({ t: String(t), left: Math.round(left), right: Math.round(left + w), y: Math.round(y) });
    return orig.apply(this, arguments);
  };
};
const cases = {
  "200": { has: ["11.5 hours", "of work", "$200 covers 7.2 hrs", "covered by $200", "not covered", "5.5 hrs of work you don't see", "My price", "$310", "11.5 hrs at $25/hr", "plus $20 in expenses", "Made with Counter", "Design"], not: [] },
  none: { has: ["$310", "11.5 hrs at $25/hr"], not: ["covers", "covered by", "not covered"] },
  "1000": { has: ["$1,000"], not: ["covers", "not covered", "11.5 hrs at $25/hr"] },
  "15": { has: ["$15 covers none of the hours", "not covered", "$310"], not: ["covered by"] },
  "0": { has: ["$0 covers none of the hours", "not covered"], not: ["covered by"] },
  "20": { has: ["$20 covers none of the hours", "not covered"], not: ["covered by"] },
  "310": { has: ["$310", "11.5 hrs at $25/hr"], not: ["covers none", "not covered"] },
  bigprice: { quote: "99999999", has: ["$99,999,999"], not: ["11.5 hrs at $25/hr"] },
  noexpenses: { expenses: "0", has: ["11.5 hrs at $25/hr", "$290"], not: ["in expenses"] },
};
await forEachConfig(async (ctx) => {
  const p = ctx.page;
  let first = true;
  for (const [name, c] of Object.entries(cases)) {
    await fresh(ctx);
    if (name === "none") await tap(ctx, "label[for=offer-none]");
    else if (/^\d+$/.test(name)) await p.fill("#offer", name);
    if (c.expenses) await p.fill("#expenses", c.expenses);
    await tap(ctx, "#check-offer"); await p.waitForTimeout(300);
    if (c.quote) { await p.fill("#quote", c.quote); await p.locator("#quote").blur(); }
    await p.evaluate(() => { window.__texts = []; });
    await tap(ctx, "#save-image");
    await p.waitForFunction(() => document.getElementById("image-dialog").open && document.getElementById("image-preview").complete && document.getElementById("image-preview").naturalWidth > 0, null, { timeout: 8000 }).catch(() => note(ctx, "image " + name, "preview never loaded", "high"));
    const r = await p.evaluate(() => ({ texts: window.__texts, nat: [document.getElementById("image-preview").naturalWidth, document.getElementById("image-preview").naturalHeight], alt: document.getElementById("image-preview").alt, text: document.getElementById("image-dialog-text").textContent, button: document.getElementById("image-save").textContent.trim(), focus: document.activeElement.id }));
    if (r.nat[0] !== 1080 || r.nat[1] !== 1350) note(ctx, "image " + name, "size " + r.nat.join("x"), "high");
    const all = r.texts.map(t => t.t).join(" | ");
    for (const h of c.has) if (!all.includes(h)) note(ctx, "image " + name, `missing "${h}"`, "high");
    for (const n of c.not) if (all.includes(n)) note(ctx, "image " + name, `should not have "${n}"`, "high");
    const out = r.texts.filter(t => t.left < 0 || t.right > 1080);
    if (out.length) note(ctx, "image " + name, "text past the image edge: " + out.map(t => `"${t.t}" ${t.left}-${t.right}`).join("; "), "medium");
    // Text overlapping other text on the same baseline area.
    const ov = [];
    r.texts.forEach((a, i) => r.texts.slice(i + 1).forEach(b => { if (Math.abs(a.y - b.y) < 20 && a.left < b.right - 2 && b.left < a.right - 2) ov.push(`"${a.t}"/"${b.t}"`); }));
    if (ov.length) note(ctx, "image " + name, "overlapping text: " + ov.join("; "), "medium");
    if (!/^This is exactly what they'll see\. It uses your price to send, \$[\d,]+\.$/.test(r.text.trim())) note(ctx, "image " + name, `dialog text "${r.text.trim()}"`, "low");
    if (!/^Image for your client: [\d.,]+ hours? of work, price \$[\d,]+$/.test(r.alt)) note(ctx, "image " + name, `alt "${r.alt}"`, "medium");
    if (first) { await axe(ctx, "image dialog"); first = false; }
    if (name === "200") {
      // Download, or on a phone that can share files, the share sheet.
      const dl = p.waitForEvent("download", { timeout: 5000 }).catch(() => null);
      await p.click("#image-save");
      const d = await dl;
      if (r.button === "Download image" && !d) note(ctx, "image download", "no download", "high");
      else if (d && d.suggestedFilename() !== "counter-menu-310.png") note(ctx, "image download", "filename " + d.suggestedFilename(), "medium");
      else if (r.button !== "Download image" && r.button !== "Share image") note(ctx, "image download", `button "${r.button}"`, "medium");
      await p.waitForTimeout(200);
      const after = await p.evaluate(() => [document.getElementById("image-dialog").open, document.activeElement.id]);
      if (after[0]) note(ctx, "image download", "dialog stayed open", "medium");
      if (after[1] !== "save-image") note(ctx, "image download", "focus went to " + after[1], "medium");
    } else {
      await p.keyboard.press("Escape"); await p.waitForTimeout(150);
      const after = await p.evaluate(() => [document.getElementById("image-dialog").open, document.activeElement.id]);
      if (after[0] || after[1] !== "save-image") note(ctx, "image Escape", JSON.stringify(after), "medium");
    }
  }
}, { widths: [390, 1440], opts: { init: spy } });
report("save image"); await closeAll();
