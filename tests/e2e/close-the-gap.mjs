// 05 Ways to close the gap: every job with offers of $15, $200, $300, $310,
// and $1,000 and 0, 1, or 2 rounds. The section shows only with an offer below
// the estimate, the cards match calc.gapOptions, the middle ground never asks
// for less than the offer, the cards sit on the column grid, and nothing
// overlaps. Then, once per browser and width: the keyboard, axe, and how the
// pick drives the price, the reply, saving, and the image.
import { forEachConfig, note, closeAll, report, BASE, axe, sideways } from "./lib.mjs";

const OFFERS = ["15", "200", "300", "310", "1000"];
const ROUNDS = ["0", "1", "2"];

function linkFor(ex, field, job, offer, rounds) {
  return "#s=" + new URLSearchParams({ v: 1, field, job, count: ex.count, rounds, setup: ex.setupHours, item: ex.itemHours, comm: ex.communicationHours, round: ex.roundHours, delivery: ex.deliveryHours, rate: 25, expenses: 20, offer });
}

async function openLink(p, hash) {
  await p.goto(BASE); await p.evaluate(() => localStorage.clear());
  await p.goto("about:blank"); await p.goto(BASE + "?grid" + hash);
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(150);
}

await forEachConfig(async (ctx) => {
  const p = ctx.page;
  await p.goto(BASE);
  const fields = await p.evaluate(() => Object.fromEntries(Object.keys(calc.WORK_FIELDS).map((f) => [f, calc.WORK_FIELDS[f].jobs])));
  const count = { cases: 0, shown: 0, cards: 0 };
  for (const field of Object.keys(fields)) for (const job of fields[field]) {
    if (job === "custom" && field !== "graphic") continue;
    await p.goto(BASE);
    const ex = await p.evaluate(([j, f]) => projectStore.exampleDraft(j, f).inputs, [job, field]);
    if (job === "custom") Object.assign(ex, { setupHours: "2", itemHours: "3", communicationHours: "1", roundHours: "1", deliveryHours: "1" });
    for (const offer of OFFERS) for (const rounds of ROUNDS) {
      const tag = `${job} $${offer} ${rounds} rounds`;
      await openLink(p, linkFor(ex, field, job, offer, rounds));
      const res = await p.evaluate(() => {
        const issues = [];
        const checked = calc.validateInputs(Object.assign({}, (() => { const raw = {}; ["count", "rounds", "setupHours", "itemHours", "communicationHours", "roundHours", "deliveryHours", "rate", "expenses", "offer"].forEach((n) => { raw[n] = draft.inputs[n]; }); raw.offerStatus = draft.inputs.offerStatus; raw.quote = ""; return raw; })()), draft.job);
        const expected = calc.gapOptions(checked.values);
        const r = calc.calculate(checked.values);
        const section = document.getElementById("gap-section");
        const shown = !section.hidden && section.getClientRects().length > 0;
        const shouldShow = Boolean(r.offer) && r.offer.amount < r.estimate;
        if (shown !== shouldShow) issues.push(`section shown=${shown}, expected ${shouldShow}`);
        // The no-middle-ground note: only with no trade card and a "Take their"
        // card for the smaller job that meets the target.
        const take = expected.filter((o) => o.type === "offer")[0];
        const wantNote = shouldShow && !expected.some((o) => o.type === "trade") && Boolean(take && take.workChange && take.meetsTarget);
        const noteEl = document.getElementById("gap-note");
        const noteShown = !noteEl.hidden && noteEl.getClientRects().length > 0;
        if (noteShown !== wantNote) issues.push(`note shown=${noteShown}, expected ${wantNote}`);
        if (noteShown && noteEl.closest(".gap-card, #gap-options")) issues.push("note is inside the cards");
        if (!shown) return { issues, cards: 0 };
        const cards = [...document.querySelectorAll("#gap-options .gap-card")];
        if (cards.length !== expected.length) issues.push(`${cards.length} cards, expected ${expected.length}`);
        expected.forEach((o, i) => {
          const card = cards[i];
          if (!card) return;
          const price = card.querySelector(".gap-amount").textContent;
          if (card.dataset.type !== o.type || price !== calc.formatPrice(o.price)) issues.push(`card ${i + 1} is ${card.dataset.type} ${price}, expected ${o.type} ${calc.formatPrice(o.price)}`);
          if (o.type === "trade" && !(o.price > r.offer.amount)) issues.push(`middle ground ${o.price} is not above the offer ${r.offer.amount}`);
        });
        // Option 1 is picked by default, and exactly one is picked.
        const picked = cards.filter((c) => c.getAttribute("aria-checked") === "true");
        if (picked.length !== 1 || picked[0].dataset.type !== "estimate") issues.push("default pick: " + picked.map((c) => c.dataset.type).join(","));
        // On the grid: each card starts and ends on a column edge.
        const spans = [...document.querySelectorAll(".grid-overlay > span")].filter((s) => s.getClientRects().length).map((s) => s.getBoundingClientRect());
        const L = spans.map((s) => s.left), R = spans.map((s) => s.right);
        const wide = innerWidth >= 1024;
        cards.forEach((c, i) => {
          const b = c.getBoundingClientRect();
          const li = L.findIndex((x) => Math.abs(x - b.left) <= 1), ri = R.findIndex((x) => Math.abs(x - b.right) <= 1);
          if (li < 0 || ri < 0) issues.push(`card ${i + 1} off the grid at ${Math.round(b.left)}-${Math.round(b.right)}`);
          else if (wide && ri - li !== 3) issues.push(`card ${i + 1} spans ${ri - li + 1} columns`);
          else if (!wide && (li !== 0 || ri !== spans.length - 1)) issues.push(`card ${i + 1} isn't full width`);
        });
        // Nothing overlaps: cards, and everything inside each card.
        const rects = cards.map((c) => c.getBoundingClientRect());
        rects.forEach((a, i) => rects.slice(i + 1).forEach((b, j) => {
          if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) issues.push(`cards ${i + 1} and ${i + j + 2} overlap`);
        }));
        cards.forEach((c, i) => {
          const box = c.getBoundingClientRect();
          c.querySelectorAll("*").forEach((e) => {
            if (!e.getClientRects().length) return;
            const b = e.getBoundingClientRect();
            if (b.left < box.left - 0.5 || b.right > box.right + 0.5 || b.bottom > box.bottom + 0.5) issues.push(`card ${i + 1}: ${e.className || e.tagName} leaves the card`);
            if (e.children.length === 0 && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).display !== "inline") issues.push(`card ${i + 1}: ${e.className || e.tagName} text is cut off`);
          });
          const pairs = [[".gap-tag", ".gap-chip"], [".gap-amount", ".gap-rate"], [".gap-work", ".gap-saved-label"]];
          pairs.forEach(([a, b]) => {
            const A = c.querySelector(a).getBoundingClientRect(), B = c.querySelector(b).getBoundingClientRect();
            if (A.width && B.width && A.left < B.right && B.left < A.right && A.top < B.bottom && B.top < A.bottom) issues.push(`card ${i + 1}: ${a} overlaps ${b}`);
          });
        });
        return { issues, cards: cards.length };
      });
      count.cases++;
      if (res.cards) { count.shown++; count.cards += res.cards; }
      res.issues.forEach((i) => note(ctx, tag, i, "medium"));
    }
  }

  console.log(`   ${count.cases} cases, ${count.shown} with the section, ${count.cards} cards checked`);

  // Once per browser and width: the menu with a $200 offer.
  const ex = await p.evaluate(() => projectStore.exampleDraft("menu").inputs);
  await openLink(p, linkFor(ex, "graphic", "menu", "200", "2"));
  await sideways(ctx, "ways to close the gap");
  await axe(ctx, "ways to close the gap");
  const picked = () => p.evaluate(() => ({
    type: document.querySelector('.gap-card[aria-checked="true"]')?.dataset.type || "",
    focus: document.activeElement.dataset ? document.activeElement.dataset.type || document.activeElement.id : "",
    quote: document.getElementById("quote").value,
    reply: document.getElementById("reply").value,
    line: document.getElementById("quote-result").textContent,
    tabbable: [...document.querySelectorAll(".gap-card")].filter((c) => c.tabIndex === 0).length,
  }));
  // Keyboard: one card in the Tab order, arrows move and pick, wrapping.
  await p.focus('.gap-card[tabindex="0"]');
  let s = await picked();
  if (s.tabbable !== 1) note(ctx, "keyboard", `${s.tabbable} cards in the Tab order`, "medium");
  await p.keyboard.press("ArrowRight"); s = await picked();
  if (s.type !== "trade" || s.focus !== "trade" || s.quote !== "270") note(ctx, "ArrowRight", JSON.stringify(s).slice(0, 160), "high");
  if (!/2 pages and 1 round of changes, my price is \$270\./.test(s.reply)) note(ctx, "trade reply", s.reply, "high");
  if (!/^At \$270, you'd earn \$27\.00\/hr before expenses and \$25\.00\/hr after\./.test(s.line)) note(ctx, "trade quote line", s.line, "medium");
  await p.keyboard.press("ArrowDown"); s = await picked();
  if (s.type !== "offer" || !/1 round of changes, \$200 works for me\. Additional rounds of changes are \$40 each\. Let me know when you'd like to get started!$/.test(s.reply)) note(ctx, "ArrowDown to Take their $200", JSON.stringify(s).slice(0, 200), "high");
  await p.keyboard.press("ArrowRight"); s = await picked();
  if (s.type !== "estimate" || s.quote !== "") note(ctx, "ArrowRight wraps to option 1", JSON.stringify(s).slice(0, 160), "high");
  await p.keyboard.press("ArrowLeft"); s = await picked();
  if (s.type !== "offer") note(ctx, "ArrowLeft wraps to option 3", s.type, "high");
  await axe(ctx, "ways to close the gap, option 3 picked");
  // The image uses the pick: $200, 1 round.
  const name = await p.evaluate(() => imageFileName(imageResult().r));
  if (name !== "counter-menu-200.png") note(ctx, "image with option 3", name, "high");
  const imageRounds = await p.evaluate(() => imageResult().values.rounds);
  if (imageRounds !== 1) note(ctx, "image with option 3", "rounds " + imageRounds, "high");
  // A live change keeps the type: one more page keeps "Take their $200".
  await p.click('#result button[data-target=count][data-step="1"]'); await p.waitForTimeout(200);
  s = await picked();
  if (s.type !== "offer" || s.quote !== "200") note(ctx, "live change keeps the pick", JSON.stringify(s).slice(0, 160), "high");
  await p.click('#result button[data-target=count][data-step="-1"]'); await p.waitForTimeout(200);
  // Typing a different price clears the pick; Use my estimate picks option 1.
  await p.click("#quote", { clickCount: 3 }); await p.keyboard.type("280"); await p.waitForTimeout(200);
  s = await picked();
  if (s.type !== "" || !/my price is \$280\./.test(s.reply)) note(ctx, "typed price clears the pick", JSON.stringify(s).slice(0, 160), "high");
  await p.click("#use-estimate"); await p.waitForTimeout(200);
  s = await picked();
  if (s.type !== "estimate" || s.quote !== "") note(ctx, "Use my estimate picks option 1", JSON.stringify(s).slice(0, 160), "high");
  // An edited reply isn't overwritten: the notice shows instead.
  await p.click("#reply"); await p.keyboard.press("End"); await p.keyboard.type(" Thanks!");
  await p.click('.gap-card[data-type="trade"]'); await p.waitForTimeout(200);
  const edited = await p.evaluate(() => [document.getElementById("reply").value.includes(" Thanks!"), !document.getElementById("reply-notice").hidden, document.getElementById("quote").value]);
  if (!edited[0] || !edited[1] || edited[2] !== "270") note(ctx, "edited reply", JSON.stringify(edited), "high");
  // The pick saves with a project, and comes back after a reload.
  await p.click("#save-project"); await p.waitForTimeout(100); await p.keyboard.press("Enter"); await p.waitForTimeout(300);
  await p.reload(); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  s = await picked();
  if (s.type !== "trade" || s.quote !== "270") note(ctx, "pick saved with the project", JSON.stringify(s).slice(0, 160), "high");
  // And it's not in the share link.
  const link = await p.evaluate(() => shareLink.encodeShare(currentField(), currentJob(), snapshot().inputs));
  if (/gap|trade/.test(link)) note(ctx, "share link", "has the pick: " + link, "high");

  // No middle ground: an offer equal to the smaller job's estimate shows the
  // note; $5 more still does (still no trade), $5 less brings the trade card back.
  const noteState = () => p.evaluate(() => {
    const el = document.getElementById("gap-note");
    return { shown: !el.hidden && el.getClientRects().length > 0, text: el.textContent,
      types: [...document.querySelectorAll("#gap-options .gap-card")].map((c) => c.dataset.type).join(",") };
  });
  for (const [rounds, words] of [["2", "1 round less"], ["0", "1 page less"]]) {
    const smaller = await p.evaluate(([ex, r]) => {
      const raw = Object.assign({}, ex, { rounds: String(Number(r) - (r === "0" ? 0 : 1)), quote: "", offerStatus: "amount" });
      if (r === "0") raw.count = String(Number(ex.count) - 1);
      return calc.calculate(calc.validateInputs(raw, "menu").values).estimate;
    }, [ex, rounds]);
    const cases = [[smaller, true], [smaller + 5, true], [smaller - 5, false]];
    for (const [offer, want] of cases) {
      await openLink(p, linkFor(ex, "graphic", "menu", String(offer), rounds));
      const n = await noteState();
      const text = `There's no middle ground here: their ${await p.evaluate((o) => calc.formatPrice(o), offer)} already pays your target for ${words}.`;
      if (n.shown !== want || (want && n.text !== text)) note(ctx, `note, ${rounds} rounds, offer $${offer}`, JSON.stringify(n), "high");
      if (!want && !/trade/.test(n.types)) note(ctx, `note, ${rounds} rounds, offer $${offer}`, "no trade card: " + n.types, "medium");
    }
  }
  // It follows live changes: one more round makes the smaller job pricier than the offer.
  const smaller1 = await p.evaluate((ex) => calc.calculate(calc.validateInputs(Object.assign({}, ex, { rounds: "1", quote: "", offerStatus: "amount" }), "menu").values).estimate, ex);
  await openLink(p, linkFor(ex, "graphic", "menu", String(smaller1), "2"));
  await p.click('#result button[data-target=rounds][data-step="1"]'); await p.waitForTimeout(200);
  let live = await noteState();
  if (live.shown) note(ctx, "note after a live change", JSON.stringify(live), "high");
  await p.click('#result button[data-target=rounds][data-step="-1"]'); await p.waitForTimeout(200);
  live = await noteState();
  if (!live.shown) note(ctx, "note after changing back", JSON.stringify(live), "high");
  await axe(ctx, "no middle ground note");
  // Never with 0 rounds and 1 item: there's no smaller job.
  for (const offer of OFFERS) {
    await openLink(p, linkFor(Object.assign({}, ex, { count: "1" }), "graphic", "menu", offer, "0"));
    const n = await noteState();
    if (n.shown) note(ctx, `note with no smaller job, offer $${offer}`, n.text, "high");
  }
}, { widths: [390, 768, 1024, 1440] });
report("close the gap"); await closeAll();
