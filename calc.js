// Counter math. Pure functions only: no page code here.
// Works in the browser (as globals) and in Node (through module.exports).

// Each number field: the name used in messages, and whether it must be a whole number.
const FIELDS = {
  pages: { label: "Pages", whole: true },
  rounds: { label: "Rounds of changes", whole: true },
  conceptHours: { label: "Concepts and sketches" },
  pageHours: { label: "Layout per page" },
  communicationHours: { label: "Emails, calls, and meetings" },
  roundHours: { label: "Hours per round of changes" },
  deliveryHours: { label: "File prep and export" },
  rate: { label: "Target hourly rate" },
  expenses: { label: "Project expenses" },
  offer: { label: "Amount they offered" },
  quote: { label: "Price you'll send" },
};

// The fields the hours depend on. The page can show group totals
// whenever these are fine, even if another field has an error.
const HOURS_FIELDS = [
  "pages", "rounds", "conceptHours", "pageHours",
  "communicationHours", "roundHours", "deliveryHours",
];

// Digits with an optional decimal part. Commas are allowed only as
// thousands separators ("1,000" or "12,500.50"), so "1,5" isn't misread as 15.
const NUMBER_PATTERN = /^((\d{1,3}(,\d{3})+|\d+)(\.\d*)?|\.\d+)$/;

function lowerFirst(text) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function isBlank(raw) {
  return String(raw == null ? "" : raw).trim() === "";
}

// Removes extra spaces, a leading "$", and a minus sign (before or after the "$").
// Returns the bare number text and whether it was negative.
function cleanNumberText(raw) {
  let text = String(raw == null ? "" : raw).trim();
  let negative = false;
  if (text.charAt(0) === "-") {
    negative = true;
    text = text.slice(1).trim();
  }
  if (text.charAt(0) === "$") {
    text = text.slice(1).trim();
  }
  if (!negative && text.charAt(0) === "-") {
    negative = true;
    text = text.slice(1).trim();
  }
  return { text: text, negative: negative };
}

// Turns the text from one field into { value } or { error, kind }.
// Blank text gives { value: null } so each caller decides what blank means.
function parseNumber(raw, field) {
  if (isBlank(raw)) return { value: null };
  const cleaned = cleanNumberText(raw);
  if (!NUMBER_PATTERN.test(cleaned.text)) {
    return { error: field.label + " needs to be a number.", kind: "notNumber" };
  }
  const size = Number(cleaned.text.replace(/,/g, ""));
  if (cleaned.negative && size > 0) {
    return { error: field.label + " can't be negative.", kind: "negative" };
  }
  if (field.whole && !Number.isInteger(size)) {
    return { error: field.label + " needs to be a whole number.", kind: "notWhole" };
  }
  return { value: size };
}

// Checks every field. Takes the raw text from the form, returns
// { values, errors } where errors maps a field name to its message.
function validateInputs(raw) {
  const values = {};
  const errors = {};

  const required = HOURS_FIELDS.concat(["rate", "expenses"]);
  required.forEach(function (name) {
    const result = parseNumber(raw[name], FIELDS[name]);
    if (result.error) {
      errors[name] = result.error;
    } else if (result.value === null) {
      errors[name] = "Enter " + lowerFirst(FIELDS[name].label) + ". Use 0 if there is none.";
    } else {
      values[name] = result.value;
    }
  });

  // The rate has its own message for blank, 0, or negative, since the target must be above 0.
  const rateIsNegative = parseNumber(raw.rate, FIELDS.rate).kind === "negative";
  if (isBlank(raw.rate) || values.rate === 0 || rateIsNegative) {
    delete values.rate;
    errors.rate = "Your target hourly rate needs to be more than 0.";
  }

  // "No offer yet" is valid. An offer chosen but left blank is an error. $0 is valid.
  values.hasOffer = raw.offerStatus !== "none";
  values.offer = null;
  if (values.hasOffer) {
    const result = parseNumber(raw.offer, FIELDS.offer);
    if (result.error) {
      errors.offer = result.error;
    } else if (result.value === null) {
      errors.offer = "Enter the amount they offered. Use 0 if they offered nothing.";
    } else {
      values.offer = result.value;
    }
  }

  // The quote is optional. Blank means "use the estimate."
  values.quote = null;
  const quote = parseNumber(raw.quote, FIELDS.quote);
  if (quote.error) {
    errors.quote = quote.error;
  } else {
    values.quote = quote.value;
  }

  return { values: values, errors: errors };
}

// Rounds a price up to the next multiple of $5. The tiny tolerance stops
// floating point noise (like 300.0000000001) from adding an extra $5.
// The "+ 0" turns JavaScript's -0 (from rounding $0) into a plain 0.
function roundUpToFive(amount) {
  return Math.ceil(amount / 5 - 1e-9) * 5 + 0;
}

// Hourly pay for a price, before and after expenses.
function hourlyFor(price, expenses, totalHours) {
  return {
    before: price / totalHours,
    after: (price - expenses) / totalHours,
  };
}

// Hours for each type of work, and the total.
function workHours(values) {
  const production = values.conceptHours + values.pages * values.pageHours;
  const communication = values.communicationHours;
  const revisions = values.rounds * values.roundHours;
  const delivery = values.deliveryHours;
  return {
    production: production,
    communication: communication,
    revisions: revisions,
    delivery: delivery,
    total: production + communication + revisions + delivery,
  };
}

// All the results. Expects values that passed validateInputs.
// Full precision throughout: round only when displaying.
function calculate(values) {
  const hours = workHours(values);
  const production = hours.production;
  const communication = hours.communication;
  const revisions = hours.revisions;
  const delivery = hours.delivery;
  const total = hours.total;

  // Zero hours: nothing per hour can be worked out.
  if (total === 0) {
    return { hasHours: false, hours: hours };
  }

  const timeCost = total * values.rate;
  const subtotal = timeCost + values.expenses;
  const estimate = roundUpToFive(subtotal);

  const result = {
    hasHours: true,
    hours: hours,
    outsideProduction: communication + revisions + delivery,
    rate: values.rate,
    expenses: values.expenses,
    timeCost: timeCost,
    subtotal: subtotal,
    estimate: estimate,
    rounding: estimate - subtotal,
    offer: null,
    quote: null,
  };

  if (values.hasOffer && values.offer !== null) {
    const offer = values.offer;
    const hourly = hourlyFor(offer, values.expenses, total);
    const belowExpenses = offer < values.expenses;
    result.offer = {
      amount: offer,
      hourlyBefore: hourly.before,
      hourlyAfter: hourly.after,
      gap: estimate - offer,
      belowExpenses: belowExpenses,
      shortfall: belowExpenses ? values.expenses - offer : 0,
      // Only when the offer covers expenses. Never negative hours.
      hoursCovered: belowExpenses ? null : (offer - values.expenses) / values.rate,
    };
    // How far the offer's hourly pay (before expenses) is under the target.
    // Compared to the cent, so $24.999 doesn't read as "under your target."
    const shortCents = Math.round((values.rate - hourly.before) * 100);
    result.offer.meetsTarget = shortCents <= 0;
    result.offer.shortPerHour = Math.max(0, values.rate - hourly.before);
    // True when the offer pays for every hour of the job at the target rate.
    // The tolerance stops floating point noise from deciding an exact match.
    result.offer.coversAllHours =
      result.offer.hoursCovered !== null && result.offer.hoursCovered >= total - 1e-9;
    // Hours the offer doesn't pay for at the target rate. All of them if it
    // doesn't even cover expenses, none if it covers everything.
    if (belowExpenses) {
      result.offer.unpaidHours = total;
    } else if (result.offer.coversAllHours) {
      result.offer.unpaidHours = 0;
    } else {
      result.offer.unpaidHours = total - result.offer.hoursCovered;
    }
  }

  // A custom quote never changes the estimate or the target rate.
  const isCustom = values.quote !== null;
  const quoteAmount = isCustom ? values.quote : estimate;
  const quoteHourly = hourlyFor(quoteAmount, values.expenses, total);
  result.quote = {
    amount: quoteAmount,
    isCustom: isCustom,
    hourlyBefore: quoteHourly.before,
    hourlyAfter: quoteHourly.after,
    differenceFromEstimate: quoteAmount - estimate,
  };

  return result;
}

// Chart math

// Hours per block in the hours chart: 30 min up to 24 hrs, 1 hr up to 48, then 2 hrs.
function blockUnit(totalHours) {
  if (totalHours <= 24) return 0.5;
  if (totalHours <= 48) return 1;
  return 2;
}

// Splits each group's hours into blocks. Each block is a fraction of one unit:
// 1 for a full block, less for the narrower last block of an uneven group.
// Example: 1.25 hrs at 30 min per block gives [1, 1, 0.5].
function splitIntoBlocks(hours, unit) {
  const units = hours / unit;
  const full = Math.floor(units + 1e-9);
  const blocks = [];
  for (let i = 0; i < full; i++) blocks.push(1);
  const rest = units - full;
  if (rest > 1e-9) blocks.push(rest);
  return blocks;
}

// The dollars-per-hour ruler: from $0 to a rounded max a little above the largest value.
// Steps of $5 while the max is $20 or less, then $10, $25, $50, $100, $250, and so on.
// At most 6 ticks (5 steps).
function rulerScale(largest) {
  const steps = [5, 10, 25, 50];
  let step = null;
  let max = 0;
  for (let i = 0; step === null; i++) {
    const candidate = steps[i % 4] * Math.pow(10, Math.floor(i / 4));
    const candidateMax = (Math.floor(largest / candidate + 1e-9) + 1) * candidate;
    const fits = candidateMax / candidate <= 5;
    const fiveOnlyToTwenty = candidate !== 5 || candidateMax <= 20;
    if (fits && fiveOnlyToTwenty) {
      step = candidate;
      max = candidateMax;
    }
  }
  const ticks = [];
  for (let value = 0; value <= max + 1e-9; value += step) ticks.push(value);
  return { max: max, step: step, ticks: ticks };
}

// Places one row of chart labels so none overlap. Each item has the left edge it
// wants and its width. Labels keep at least `gap` px between them and stay inside
// 0..width, moving as little as needed: a left-to-right pass pushes labels right,
// then a right-to-left pass pulls them back inside the edge.
// Returns { lefts, fits }. fits is false when the labels can't all fit at once.
function spreadLabels(items, width, gap) {
  const order = items.map(function (item, i) { return i; })
    .sort(function (a, b) { return items[a].left - items[b].left; });
  const lefts = items.map(function (item) {
    return Math.max(0, Math.min(width - item.width, item.left));
  });

  let edge = -Infinity;
  order.forEach(function (i) {
    if (lefts[i] < edge) lefts[i] = edge;
    edge = lefts[i] + items[i].width + gap;
  });

  edge = width;
  order.slice().reverse().forEach(function (i) {
    if (lefts[i] + items[i].width > edge) lefts[i] = edge - items[i].width;
    edge = lefts[i] - gap;
  });

  const needed = items.reduce(function (sum, item) { return sum + item.width; }, 0) +
    Math.max(0, items.length - 1) * gap;
  return { lefts: lefts, fits: needed <= width };
}

// Display helpers. These are the only places numbers get rounded.

const centsFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const wholeFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});
const hoursFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

// "$17.39", "-$1.74", "$1,250.00"
function formatMoney(amount) {
  const sign = amount < 0 && Math.abs(amount) >= 0.005 ? "-" : "";
  return sign + "$" + centsFormat.format(Math.abs(amount));
}

// "$310" for the estimate, which is always whole dollars.
function formatWholeMoney(amount) {
  const sign = amount < 0 ? "-" : "";
  return sign + "$" + wholeFormat.format(Math.abs(amount));
}

// "11.5", "7.2", "1": up to 2 decimals, no trailing zeros.
function formatNumber(amount) {
  return hoursFormat.format(amount);
}

// "11.5 hrs", "1 hr", "0 hrs"
function formatHours(amount) {
  const text = formatNumber(amount);
  return text + (text === "1" ? " hr" : " hrs");
}

// Prices like the gap or a quote: "$110" when whole dollars, "$109.50" when not.
function formatPrice(amount) {
  const hasCents = Math.abs(amount - Math.round(amount)) >= 0.005;
  return hasCents ? formatMoney(amount) : formatWholeMoney(Math.round(amount));
}

// One object holding everything, so the page can call calc.calculate(...) and so on.
const calc = {
  FIELDS,
  HOURS_FIELDS,
  parseNumber,
  validateInputs,
  roundUpToFive,
  workHours,
  calculate,
  blockUnit,
  splitIntoBlocks,
  rulerScale,
  spreadLabels,
  formatMoney,
  formatWholeMoney,
  formatNumber,
  formatHours,
  formatPrice,
};

if (typeof module !== "undefined") module.exports = calc;
