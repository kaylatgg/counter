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
    pages: "2",
    rounds: "2",
    conceptHours: "2",
    pageHours: "2",
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
  const r = run({ pages: "1", rounds: "1" });
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
    conceptHours: "0",
    pageHours: "0",
    communicationHours: "0",
    roundHours: "0",
    deliveryHours: "0",
  });
  assert.strictEqual(r.hasHours, false);
  closeTo(r.hours.total, 0);
});

test("0 pages and 0 rounds can still have hours", function () {
  const r = run({ pages: "0", rounds: "0" });
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
    rate: "Target hourly rate needs to be a number.",
  });
});

test("negative hours", function () {
  assert.deepStrictEqual(errorsFor({ deliveryHours: "-1" }), {
    deliveryHours: "File prep and export can't be negative.",
  });
});

test("text in a number field", function () {
  assert.deepStrictEqual(errorsFor({ expenses: "twenty" }), {
    expenses: "Project expenses needs to be a number.",
  });
});

test("1.5 pages", function () {
  assert.deepStrictEqual(errorsFor({ pages: "1.5" }), {
    pages: "Pages needs to be a whole number.",
  });
});

test("blank required field", function () {
  assert.deepStrictEqual(errorsFor({ communicationHours: "" }), {
    communicationHours: "Enter emails, calls, and meetings. Use 0 if there is none.",
  });
});

test("several errors at once are all reported", function () {
  const errors = errorsFor({ pages: "1.5", rounds: "-2", rate: "0" });
  assert.deepStrictEqual(Object.keys(errors).sort(), ["pages", "rate", "rounds"]);
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
      "Amount they offered needs to be a number.",
      text + " should not be accepted"
    );
  });
});

test("other text is still not a number", function () {
  ["$", "-", "200 dollars", "USD 200", "$$200", "2 00", "1e3", "0x10"].forEach(function (text) {
    assert.strictEqual(
      calc.parseNumber(text, calc.FIELDS.offer).error,
      "Amount they offered needs to be a number.",
      text + " should not be accepted"
    );
  });
});

test("\"-$5\" and \"$-5\" are both negative", function () {
  assert.strictEqual(calc.parseNumber("-$5", calc.FIELDS.expenses).error, "Project expenses can't be negative.");
  assert.strictEqual(calc.parseNumber("$-5", calc.FIELDS.expenses).error, "Project expenses can't be negative.");
});

test("\"1,000\" pages is still a whole number", function () {
  assert.deepStrictEqual(calc.parseNumber("1,000", calc.FIELDS.pages), { value: 1000 });
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
    quote: "Price you'll send needs to be a number.",
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

console.log("\n" + passed + " passed, " + failed + " failed");
if (failed > 0) process.exitCode = 1;
