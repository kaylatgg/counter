// Flow 8: storage blocked.
import { forEachConfig, note, tap, closeAll, report, findings, BASE, sideways, badText, log } from "./lib.mjs";
const blocked = () => { Object.defineProperty(window, "localStorage", { get() { throw new DOMException("The operation is insecure.", "SecurityError"); } }); };
const full = () => { const proto = Storage.prototype; proto.setItem = function () { throw new DOMException("Quota exceeded", "QuotaExceededError"); }; };
for (const [name, init] of [["blocked", blocked], ["full", full]]) {
  await forEachConfig(async (ctx) => {
    const p = ctx.page;
    await p.goto(BASE); await p.waitForTimeout(300);
    let r = await p.evaluate(() => [document.body.className, document.getElementById("total-hours").textContent, document.getElementById("save-error").hidden]);
    if (!/on-inputs/.test(r[0]) || r[1].trim() !== "11.5") note(ctx, `storage ${name}: load`, JSON.stringify(r), "high");
    await p.fill("#rounds", "3"); await p.locator("#rounds").blur(); await p.waitForTimeout(150);
    if ((await p.textContent("#total-hours")).trim() !== "13") note(ctx, `storage ${name}: typing`, "total didn't update", "high");
    await tap(ctx, "#check-offer"); await p.waitForTimeout(300);
    r = await p.evaluate(() => [document.body.className, document.getElementById("hero-amount").textContent]);
    if (!/on-results/.test(r[0]) || r[1] !== "15.38") note(ctx, `storage ${name}: result`, JSON.stringify(r), "high");
    const errShownEarly = await p.evaluate(() => !document.getElementById("save-error").hidden);
    log("f8-notes.txt", `${ctx.browser} ${ctx.width} ${name}: save error before saving = ${errShownEarly}`);
    await tap(ctx, "#save-project"); await p.waitForTimeout(150);
    await p.keyboard.press("Enter"); await p.waitForTimeout(250);
    r = await p.evaluate(() => [document.getElementById("save-error").hidden, document.getElementById("save-error").textContent.trim(), [...document.querySelectorAll("dialog[open]")].map(d => d.id), document.getElementById("save-project").textContent.trim(), document.getElementById("crumb").hidden, location.hash]);
    if (r[0] || r[1] !== "Couldn't save. Your changes will be lost if you leave this page.") note(ctx, `storage ${name}: save`, JSON.stringify(r), "high");
    log("f8-notes.txt", `${ctx.browser} ${ctx.width} ${name}: after save ${JSON.stringify(r.slice(2))}`);
    // Keeps working afterwards.
    await tap(ctx, '#result button[data-target=rounds][data-step="1"]'); await p.waitForTimeout(400);
    if ((await p.textContent("#hero-amount")) !== "13.79") note(ctx, `storage ${name}: after save error`, "live change broke: " + await p.textContent("#hero-amount"), "high");
    await tap(ctx, "#projects-link"); await p.waitForTimeout(200);
    if (!/on-projects/.test(await p.evaluate(() => document.body.className))) note(ctx, `storage ${name}: projects`, "projects page didn't open", "high");
    await sideways(ctx, `storage ${name}`); await badText(ctx, `storage ${name}`);
    // Share link still opens.
    await p.goto("about:blank"); await p.goto(BASE + "#s=v=1&field=graphic&job=logo&count=3&rounds=2&setup=2&item=2&comm=1.5&round=1&delivery=1.5&rate=25&expenses=20&offer=200"); await p.waitForTimeout(300);
    r = await p.evaluate(() => [document.body.className, location.hash]);
    if (!/on-results/.test(r[0])) note(ctx, `storage ${name}: share link`, JSON.stringify(r), "high");
  }, { widths: [390, 1440], opts: { init } });
}
report("storage"); await closeAll();
