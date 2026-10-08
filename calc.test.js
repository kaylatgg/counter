// Counter math tests. Run with: node calc.test.js
// Uses only Node's built-in assert, so nothing needs installing.

const assert = require("assert");
const calc = require("./calc.js");

let passed = 0;
let failed = 0;

function group(title) {
  console.log("\n" + title);
}

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log("  PASS  " + name);
  } catch (error) {
    failed++;
    console.log("  FAIL  " + name);
    console.log("        " + error.message.split("\n").join("\n        "));
  }
}

// Money compared to the cent, hours compared exactly as displayed.
function closeTo(actual, expected) {
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    "expected " + expected + ", got " + actual
  );
}

// The example data from CLAUDE.md, as the form would send it (all text).
function example(changes) {
  return Object.assign({
    count: "2",
    rounds: "2",
    setupHours: "2",
    itemHours: "2",
    communicationHours: "1.5",
    roundHours: "1.5",
    deliveryHours: "1",
    rate: "25",
    expenses: "20",
    offerStatus: "amount",
    offer: "200",
    quote: "",
  }, changes);
}

// Validates and calculates, failing loudly if the input has errors.
function run(changes) {
  const checked = calc.validateInputs(example(changes));
  assert.deepStrictEqual(checked.errors, {}, "expected no errors");
  return calc.calculate(checked.values);
}

function errorsFor(changes) {
  return calc.validateInputs(example(changes)).errors;
}

group("Example job: hours and estimate");

test("total hours is 11.5", function () {
  const r = run();
  closeTo(r.hours.production, 6);
  closeTo(r.hours.communication, 1.5);
  closeTo(r.hours.revisions, 3);
  closeTo(r.hours.delivery, 1);
  closeTo(r.hours.total, 11.5);
  assert.strictEqual(calc.formatHours(r.hours.total), "11.5 hrs");
});

test("subtotal is $307.50, estimate $310, rounding $2.50", function () {
  const r = run();
  closeTo(r.timeCost, 287.5);
  closeTo(r.subtotal, 307.5);
  assert.strictEqual(r.estimate, 310);
  closeTo(r.rounding, 2.5);
  assert.strictEqual(calc.formatMoney(r.subtotal), "$307.50");
  assert.strictEqual(calc.formatWholeMoney(r.estimate), "$310");
  assert.strictEqual(calc.formatMoney(r.rounding), "$2.50");
});

group("A $200 offer");

test("pays $17.39/hr before expenses and $15.65/hr after", function () {
  const r = run();
  assert.strictEqual(calc.formatMoney(r.offer.hourlyBefore), "$17.39");
  assert.strictEqual(calc.formatMoney(r.offer.hourlyAfter), "$15.65");
});

test("full precision is kept until display", function () {
  const r = run();
  closeTo(r.offer.hourlyBefore, 200 / 11.5);
  closeTo(r.offer.hourlyAfter, 180 / 11.5);
});

test("covers 7.2 hrs at the target rate", function () {
  const r = run();
  closeTo(r.offer.hoursCovered, 7.2);
  assert.strictEqual(calc.formatNumber(r.offer.hoursCovered), "7.2");
});

test("is $7.61 an hour under the $25 target", function () {
  const r = run();
  assert.strictEqual(r.offer.meetsTarget, false);
  assert.strictEqual(calc.formatMoney(r.offer.shortPerHour), "$7.61");
});

test("an hourly within half a cent of the target meets it", function () {
  // 1 page, 1 round: $200 / 8 hrs = exactly $25.00/hr.
  const exact = run({ count: "1", rounds: "1" });
  assert.strictEqual(exact.offer.meetsTarget, true);
  // $287.49 / 11.5 hrs = $24.9991/hr, which displays as $25.00.
  assert.strictEqual(run({ offer: "287.49" }).offer.meetsTarget, true);
  assert.strictEqual(run({ offer: "287.30" }).offer.meetsTarget, false);
});

test("does not cover all the hours", function () {
  assert.strictEqual(run().offer.coversAllHours, false);
});

test("a $1,000 offer covers all the hours", function () {
  const r = run({ offer: "1000" });
  closeTo(r.offer.hoursCovered, 39.2);
  assert.strictEqual(r.offer.coversAllHours, true);
});

test("an offer of exactly expenses plus all hours at the rate covers all the hours", function () {
  // $20 + 11.5 hrs x $25 = $307.50
  assert.strictEqual(run({ offer: "307.50" }).offer.coversAllHours, true);
  assert.strictEqual(run({ offer: "307.49" }).offer.coversAllHours, false);
});

test("an offer below expenses never covers all the hours", function () {
  assert.strictEqual(run({ offer: "15" }).offer.coversAllHours, false);
});

test("estimate is $110 above the offer", function () {
  const r = run();
  closeTo(r.offer.gap, 110);
  assert.strictEqual(r.offer.belowExpenses, false);
});

group("Smaller scope: 1 page and 1 round");

test("8 hrs, $220 estimate, still $20 above the offer", function () {
  const r = run({ count: "1", rounds: "1" });
  closeTo(r.hours.total, 8);
  assert.strictEqual(r.estimate, 220);
  closeTo(r.offer.gap, 20);
});

group("Rounding up to the nearest $5");

test("a subtotal already on a multiple of $5 doesn't round up", function () {
  // 11.5 hrs x $20 + $20 = $250 exactly.
  const r = run({ rate: "20" });
  closeTo(r.subtotal, 250);
  assert.strictEqual(r.estimate, 250);
  closeTo(r.rounding, 0);
});

test("a subtotal just over a multiple of $5 rounds up", function () {
  assert.strictEqual(calc.roundUpToFive(250.01), 255);
  assert.strictEqual(calc.roundUpToFive(0), 0);
});

test("floating point noise doesn't add an extra $5", function () {
  // 0.1 + 0.2 is 0.30000000000000004 in JavaScript.
  assert.strictEqual(calc.roundUpToFive((0.1 + 0.2) * 1000), 300);
});

group("Offer choices");

test("\"No offer yet\" is valid and shows no offer results", function () {
  const r = run({ offerStatus: "none", offer: "" });
  assert.strictEqual(r.offer, null);
  assert.strictEqual(r.estimate, 310);
});

test("\"No offer yet\" ignores whatever is left in the amount field", function () {
  assert.deepStrictEqual(errorsFor({ offerStatus: "none", offer: "abc" }), {});
});

test("offer chosen but blank is an error", function () {
  assert.deepStrictEqual(errorsFor({ offer: "" }), {
    offer: "Enter the amount they offered. Use 0 if they offered nothing.",
  });
});

test("a $0 offer is valid: $0.00/hr and a $20.00 shortfall", function () {
  const r = run({ offer: "0" });
  assert.strictEqual(calc.formatMoney(r.offer.hourlyBefore), "$0.00");
  assert.strictEqual(calc.formatMoney(r.offer.hourlyAfter), "-$1.74");
  assert.strictEqual(r.offer.belowExpenses, true);
  closeTo(r.offer.shortfall, 20);
  assert.strictEqual(r.offer.hoursCovered, null);
});

group("Offer below expenses");

test("a $15 offer is $5.00 below expenses and covers no hours", function () {
  const r = run({ offer: "15" });
  assert.strictEqual(r.offer.belowExpenses, true);
  assert.strictEqual(calc.formatMoney(r.offer.shortfall), "$5.00");
  assert.strictEqual(r.offer.hoursCovered, null);
});

test("its after-expense hourly is negative", function () {
  const r = run({ offer: "15" });
  assert.ok(r.offer.hourlyAfter < 0);
  assert.strictEqual(calc.formatMoney(r.offer.hourlyAfter), "-$0.43");
});

test("an offer equal to expenses is not below them", function () {
  const r = run({ offer: "20" });
  assert.strictEqual(r.offer.belowExpenses, false);
  closeTo(r.offer.hoursCovered, 0);
});

group("Zero hours");

test("all hours at 0 gives the \"add some hours\" state", function () {
  const r = run({
    setupHours: "0",
    itemHours: "0",
    communicationHours: "0",
    roundHours: "0",
    deliveryHours: "0",
  });
  assert.strictEqual(r.hasHours, false);
  closeTo(r.hours.total, 0);
});

test("0 pages and 0 rounds can still have hours", function () {
  const r = run({ count: "0", rounds: "0" });
  closeTo(r.hours.total, 4.5);
  assert.strictEqual(r.hasHours, true);
});

group("Error messages");

test("rate of 0", function () {
  assert.deepStrictEqual(errorsFor({ rate: "0" }), {
    rate: "Your target hourly rate needs to be more than 0.",
  });
});

test("rate left blank", function () {
  assert.deepStrictEqual(errorsFor({ rate: "  " }), {
    rate: "Your target hourly rate needs to be more than 0.",
  });
});

test("negative rate", function () {
  assert.deepStrictEqual(errorsFor({ rate: "-25" }), {
    rate: "Your target hourly rate needs to be more than 0.",
  });
});

test("rate that isn't a number keeps the number message", function () {
  assert.deepStrictEqual(errorsFor({ rate: "abc" }), {
    rate: "Use a number for your target hourly rate.",
  });
});

test("negative hours", function () {
  assert.deepStrictEqual(errorsFor({ deliveryHours: "-1" }), {
    deliveryHours: "File prep and export can't be less than 0.",
  });
});

test("text in a number field", function () {
  assert.deepStrictEqual(errorsFor({ expenses: "twenty" }), {
    expenses: "Use a number for project expenses.",
  });
});

test("1.5 pages", function () {
  assert.deepStrictEqual(errorsFor({ count: "1.5" }), {
    count: "Use a whole number for pages.",
  });
});

test("blank required field", function () {
  assert.deepStrictEqual(errorsFor({ communicationHours: "" }), {
    communicationHours: "Enter the hours for emails, calls, and meetings. Use 0 if there are none.",
  });
});

test("messages name each field in plain words", function () {
  assert.deepStrictEqual(errorsFor({ count: "", roundHours: "", quote: "-5" }), {
    count: "Enter pages. Use 0 if there are none.",
    roundHours: "Enter the hours for each round of changes. Use 0 if there are none.",
    quote: "Your price can't be less than 0.",
  });
  assert.deepStrictEqual(errorsFor({ rounds: "2.5" }), {
    rounds: "Use a whole number for rounds of changes.",
  });
});

test("several errors at once are all reported", function () {
  const errors = errorsFor({ count: "1.5", rounds: "-2", rate: "0" });
  assert.deepStrictEqual(Object.keys(errors).sort(), ["count", "rate", "rounds"]);
});

group("Typing style: commas, \"$\", and spaces");

test("\"$1,000\" and \" 1,000 \" both read as 1000", function () {
  assert.deepStrictEqual(calc.parseNumber("$1,000", calc.FIELDS.offer), { value: 1000 });
  assert.deepStrictEqual(calc.parseNumber(" 1,000 ", calc.FIELDS.offer), { value: 1000 });
});

test("a space after the \"$\" and cents with commas work", function () {
  assert.deepStrictEqual(calc.parseNumber("$ 12,500.50", calc.FIELDS.offer), { value: 12500.5 });
});

test("an offer typed as \"$1,000\" gives the right results", function () {
  const r = run({ offer: "$1,000" });
  closeTo(r.offer.amount, 1000);
  closeTo(r.offer.gap, -690);
});

test("commas in the wrong place are not a number", function () {
  ["1,5", "1,00", "10,00,000", ",100", "1,000,"].forEach(function (text) {
    assert.strictEqual(
      calc.parseNumber(text, calc.FIELDS.offer).error,
      "Use a number for the amount they offered.",
      text + " should not be accepted"
    );
  });
});

test("other text is still not a number", function () {
  ["$", "-", "200 dollars", "USD 200", "$$200", "2 00", "1e3", "0x10"].forEach(function (text) {
    assert.strictEqual(
      calc.parseNumber(text, calc.FIELDS.offer).error,
      "Use a number for the amount they offered.",
      text + " should not be accepted"
    );
  });
});

test("\"-$5\" and \"$-5\" are both negative", function () {
  assert.strictEqual(calc.parseNumber("-$5", calc.FIELDS.expenses).error, "Project expenses can't be less than 0.");
  assert.strictEqual(calc.parseNumber("$-5", calc.FIELDS.expenses).error, "Project expenses can't be less than 0.");
});

test("\"1,000\" pages is still a whole number", function () {
  assert.deepStrictEqual(calc.parseNumber("1,000", calc.FIELDS.count), { value: 1000 });
});

group("Your quote");

test("a custom quote of $280 keeps the estimate at $310 and the rate at $25", function () {
  const r = run({ quote: "280" });
  assert.strictEqual(r.estimate, 310);
  assert.strictEqual(r.rate, 25);
  assert.strictEqual(r.quote.isCustom, true);
  assert.strictEqual(calc.formatMoney(r.quote.hourlyBefore), "$24.35");
  closeTo(r.quote.differenceFromEstimate, -30);
});

test("a blank quote uses the estimate: $26.96/hr before, $25.22/hr after", function () {
  const r = run();
  assert.strictEqual(r.quote.isCustom, false);
  assert.strictEqual(r.quote.amount, 310);
  assert.strictEqual(calc.formatMoney(r.quote.hourlyBefore), "$26.96");
  assert.strictEqual(calc.formatMoney(r.quote.hourlyAfter), "$25.22");
});

test("a quote that isn't a number is an error", function () {
  assert.deepStrictEqual(errorsFor({ quote: "lots" }), {
    quote: "Use a number for your price.",
  });
});

group("Display formats");

test("hours: up to 2 decimals, no trailing zeros, \"1 hr\" for one", function () {
  assert.strictEqual(calc.formatHours(11.5), "11.5 hrs");
  assert.strictEqual(calc.formatHours(1), "1 hr");
  assert.strictEqual(calc.formatHours(0), "0 hrs");
  assert.strictEqual(calc.formatHours(2.25), "2.25 hrs");
  assert.strictEqual(calc.formatHours(10 / 3), "3.33 hrs");
});

test("money: cents, thousands separators, minus sign in front", function () {
  assert.strictEqual(calc.formatMoney(1250), "$1,250.00");
  assert.strictEqual(calc.formatMoney(-1.739), "-$1.74");
  assert.strictEqual(calc.formatWholeMoney(1250), "$1,250");
});

test("prices: whole dollars when there are no cents", function () {
  assert.strictEqual(calc.formatPrice(110), "$110");
  assert.strictEqual(calc.formatPrice(109.5), "$109.50");
  assert.strictEqual(calc.formatPrice(-30), "-$30");
  assert.strictEqual(calc.formatPrice(1000), "$1,000");
});

group("Hours chart: blocks");

test("a block is 30 min up to 24 hrs, 1 hr up to 48, then 2 hrs", function () {
  assert.strictEqual(calc.blockUnit(11.5), 0.5);
  assert.strictEqual(calc.blockUnit(24), 0.5);
  assert.strictEqual(calc.blockUnit(24.5), 1);
  assert.strictEqual(calc.blockUnit(48), 1);
  assert.strictEqual(calc.blockUnit(48.5), 2);
});

test("the example splits into 12, 3, 6, and 2 blocks of 30 min", function () {
  const r = run();
  const unit = calc.blockUnit(r.hours.total);
  assert.strictEqual(calc.splitIntoBlocks(r.hours.production, unit).length, 12);
  assert.strictEqual(calc.splitIntoBlocks(r.hours.communication, unit).length, 3);
  assert.strictEqual(calc.splitIntoBlocks(r.hours.revisions, unit).length, 6);
  assert.strictEqual(calc.splitIntoBlocks(r.hours.delivery, unit).length, 2);
});

test("an uneven group ends with a narrower block", function () {
  assert.deepStrictEqual(calc.splitIntoBlocks(1.25, 0.5), [1, 1, 0.5]);
  assert.deepStrictEqual(calc.splitIntoBlocks(0.2, 0.5).length, 1);
  closeTo(calc.splitIntoBlocks(0.2, 0.5)[0], 0.4);
});

test("0 hrs gives no blocks, and float noise doesn't add a sliver", function () {
  assert.deepStrictEqual(calc.splitIntoBlocks(0, 0.5), []);
  assert.deepStrictEqual(calc.splitIntoBlocks(0.1 + 0.2, 0.1).length, 3);
});

group("Hours chart: unpaid hours");

test("$200 leaves 4.3 hrs unpaid", function () {
  closeTo(run().offer.unpaidHours, 4.3);
  assert.strictEqual(calc.formatNumber(run().offer.unpaidHours), "4.3");
});

test("an offer below expenses leaves every hour unpaid", function () {
  closeTo(run({ offer: "15" }).offer.unpaidHours, 11.5);
});

test("an offer that covers all the hours leaves none unpaid", function () {
  assert.strictEqual(run({ offer: "1000" }).offer.unpaidHours, 0);
});

group("Pay per hour: ruler scale");

test("the example ($17.39, $15.65, $25) gives $0, $10, $20, $30", function () {
  assert.deepStrictEqual(calc.rulerScale(25).ticks, [0, 10, 20, 30]);
});

test("$5 steps up to $20", function () {
  assert.deepStrictEqual(calc.rulerScale(12).ticks, [0, 5, 10, 15]);
  assert.deepStrictEqual(calc.rulerScale(19.99).ticks, [0, 5, 10, 15, 20]);
});

test("the max is always a little above the largest value", function () {
  assert.strictEqual(calc.rulerScale(20).max, 30);
  assert.strictEqual(calc.rulerScale(30).max, 40);
});

test("larger values use $25, $50, $100 steps", function () {
  assert.deepStrictEqual(calc.rulerScale(86.96).ticks, [0, 25, 50, 75, 100]);
  assert.deepStrictEqual(calc.rulerScale(130).ticks, [0, 50, 100, 150]);
  assert.strictEqual(calc.rulerScale(1000).step, 250);
});

test("never more than 6 ticks", function () {
  [0.5, 3, 7, 19, 21, 33, 49, 51, 99, 101, 240, 499, 777, 2600, 9999].forEach(function (value) {
    const scale = calc.rulerScale(value);
    assert.ok(scale.ticks.length <= 6, value + " gave " + scale.ticks.length + " ticks");
    assert.ok(scale.max > value, value + " is not below the max " + scale.max);
  });
});

group("Pay per hour: labels never overlap");

function checkSpread(items, width, gap) {
  const result = calc.spreadLabels(items, width, gap);
  if (!result.fits) return result;
  const placed = items.map(function (item, i) {
    return { left: result.lefts[i], right: result.lefts[i] + item.width };
  }).sort(function (a, b) { return a.left - b.left; });
  placed.forEach(function (box, i) {
    assert.ok(box.left >= -1e-9, "label starts before the ruler: " + box.left);
    assert.ok(box.right <= width + 1e-9, "label runs past the ruler: " + box.right);
    if (i > 0) {
      assert.ok(box.left - placed[i - 1].right >= gap - 1e-9,
        "labels too close: " + JSON.stringify(placed));
    }
  });
  return result;
}

test("labels that already fit don't move", function () {
  const result = checkSpread([{ left: 10, width: 50 }, { left: 200, width: 60 }], 400, 8);
  assert.deepStrictEqual(result.lefts, [10, 200]);
});

test("two labels wanting the same spot are pushed apart", function () {
  checkSpread([{ left: 100, width: 80 }, { left: 100, width: 60 }], 400, 8);
});

test("labels near the edges stay inside the ruler", function () {
  checkSpread([{ left: -40, width: 120 }, { left: 380, width: 70 }], 400, 8);
});

test("2,000 random rows of labels never overlap", function () {
  let seed = 7;
  function random() {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  }
  for (let run = 0; run < 2000; run++) {
    const width = 200 + random() * 600;
    const count = 1 + Math.floor(random() * 3);
    const items = [];
    for (let i = 0; i < count; i++) {
      items.push({ left: random() * width - 40, width: 40 + random() * 100 });
    }
    checkSpread(items, width, 8);
  }
});

test("\"after expenses\" too close to the gap label needs its own row", function () {
  // The example on a 400px ruler: "after expenses $15.65/hr" centered under
  // $15.65 runs into "-$7.61/hr" centered under the gap band.
  const after = { left: 148, right: 278 };
  const gapLabel = { left: 262, right: 330 };
  assert.strictEqual(calc.isCrowded(after, [gapLabel], 8), true);
});

test("labels exactly 8px apart are fine, 7px apart are crowded", function () {
  assert.strictEqual(calc.isCrowded({ left: 0, right: 100 }, [{ left: 108, right: 150 }], 8), false);
  assert.strictEqual(calc.isCrowded({ left: 0, right: 100 }, [{ left: 107, right: 150 }], 8), true);
  assert.strictEqual(calc.isCrowded({ left: 0, right: 100 }, [], 8), false);
});

test("says when labels can't all fit", function () {
  assert.strictEqual(calc.spreadLabels([{ left: 0, width: 150 }, { left: 0, width: 150 }], 200, 8).fits, false);
});

group("Job options");

// One job's example numbers, as the form would send them, with the menu's
// rate, expenses, and offer (those don't change with the job).
function jobExample(key) {
  const raw = example();
  const numbers = calc.JOBS[key].example;
  Object.keys(numbers).forEach(function (name) { raw[name] = String(numbers[name]); });
  return raw;
}

function runJob(key) {
  const checked = calc.validateInputs(jobExample(key), key);
  assert.deepStrictEqual(checked.errors, {}, "expected no errors");
  return calc.calculate(checked.values);
}

test("there are five jobs, each with every work number", function () {
  assert.deepStrictEqual(Object.keys(calc.JOBS), ["menu", "logo", "social", "poster", "custom"]);
  Object.keys(calc.JOBS).forEach(function (key) {
    assert.deepStrictEqual(Object.keys(calc.JOBS[key].example).sort(), calc.HOURS_FIELDS.slice().sort());
  });
});

test("restaurant menu: 6 + 1.5 + 3 + 1 = 11.5 hrs, $310", function () {
  const r = runJob("menu");
  closeTo(r.hours.production, 6);
  closeTo(r.hours.total, 11.5);
  assert.strictEqual(r.estimate, 310);
});

test("logo: 2 + 3 x 1.5 = 6.5 production, 11.5 hrs, $310", function () {
  const r = runJob("logo");
  closeTo(r.hours.production, 6.5);
  closeTo(r.hours.communication, 1.5);
  closeTo(r.hours.revisions, 2);
  closeTo(r.hours.delivery, 1.5);
  closeTo(r.hours.total, 11.5);
  assert.strictEqual(r.estimate, 310);
});

test("social media posts: 2 + 6 x 0.5 = 5 production, 8.5 hrs, $235", function () {
  const r = runJob("social");
  closeTo(r.hours.production, 5);
  closeTo(r.hours.revisions, 2);
  closeTo(r.hours.total, 8.5);
  closeTo(r.subtotal, 232.5);
  assert.strictEqual(r.estimate, 235);
});

test("poster or flyer: 3 + 2 x 0.75 = 4.5 production, 8.5 hrs, $235", function () {
  const r = runJob("poster");
  closeTo(r.hours.production, 4.5);
  closeTo(r.hours.total, 8.5);
  assert.strictEqual(r.estimate, 235);
});

test("custom: starts at 0 hours, so it shows the \"add hours\" state", function () {
  const r = runJob("custom");
  closeTo(r.hours.total, 0);
  assert.strictEqual(r.hasHours, false);
});

test("messages name the job's item and setup row", function () {
  const raw = jobExample("logo");
  raw.count = "1.5";
  raw.itemHours = "";
  raw.setupHours = "-1";
  assert.deepStrictEqual(calc.validateInputs(raw, "logo").errors, {
    count: "Use a whole number for concepts.",
    itemHours: "Enter the hours for design, per concept. Use 0 if there are none.",
    setupHours: "Research and sketches can't be less than 0.",
  });
});

test("with no job given, messages use the menu's names", function () {
  assert.strictEqual(errorsFor({ itemHours: "x" }).itemHours, "Use a number for design, per page.");
  assert.strictEqual(errorsFor({ setupHours: "x" }).setupHours, "Use a number for concepts and sketches.");
});

console.log("\n" + passed + " passed, " + failed + " failed");
if (failed > 0) process.exitCode = 1;
