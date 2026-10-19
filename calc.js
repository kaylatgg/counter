// Counter math. Pure functions only: no page code here.
// Works in the browser (as globals) and in Node (through module.exports).

// Each number field: how messages name it, whether it holds hours, and
// whether it must be a whole number.
const FIELDS = {
  count: { name: "pages", whole: true },
  rounds: { name: "rounds of changes", whole: true },
  setupHours: { name: "concepts and sketches", hours: true },
  itemHours: { name: "layout, per page", hours: true },
  communicationHours: { name: "emails, calls, and meetings", hours: true },
  roundHours: { name: "each round of changes", hours: true },
  deliveryHours: { name: "print setup and export", hours: true },
  rate: { name: "your target hourly rate" },
  expenses: { name: "project expenses" },
  offer: { name: "the amount they offered" },
  quote: { name: "your price" },
};

// Jobs. Each one names its stepper ("Pages"), its item ("page", "pages"), its
// setup, per-item, and delivery rows, and its phrase for the reply, and brings
// provisional example numbers. Production is always setup + count x hours per
// item, so the math is the same for every job.
const JOBS = {
  menu: {
    name: "Menu", phrase: "a menu", countLabel: "Pages", item: "page", items: "pages",
    setup: "Concepts and sketches", perItem: "Layout, per page", delivery: "Print setup and export",
    example: { count: 2, rounds: 2, setupHours: 2, itemHours: 2,
      communicationHours: 1.5, roundHours: 1.5, deliveryHours: 1 },
  },
  logo: {
    name: "Logo", phrase: "a logo", countLabel: "Concepts", item: "concept", items: "concepts",
    setup: "Research and sketches", perItem: "Design, per concept", delivery: "Formats and color versions",
    example: { count: 3, rounds: 2, setupHours: 2, itemHours: 2,
      communicationHours: 1.5, roundHours: 1, deliveryHours: 1.5 },
  },
  social: {
    name: "Social posts", phrase: "a set of social posts", countLabel: "Posts", item: "post", items: "posts",
    setup: "Template and style", perItem: "Design, per post", delivery: "Resizing and export",
    example: { count: 6, rounds: 2, setupHours: 2, itemHours: 0.5,
      communicationHours: 1, roundHours: 1, deliveryHours: 0.5 },
  },
  poster: {
    name: "Poster or flyer", phrase: "a poster or flyer", countLabel: "Sizes", item: "size", items: "sizes",
    setup: "Concept and layout", perItem: "Design, per size", delivery: "Print setup and export",
    example: { count: 2, rounds: 2, setupHours: 4, itemHours: 0.75,
      communicationHours: 1, roundHours: 1, deliveryHours: 1 },
  },
  website: {
    name: "Website", phrase: "a website", countLabel: "Pages", item: "page", items: "pages",
    setup: "Research and wireframes", perItem: "Design, per page", delivery: "Responsive versions and handoff",
    example: { count: 5, rounds: 2, setupHours: 4, itemHours: 3,
      communicationHours: 2, roundHours: 2, deliveryHours: 2 },
  },
  portrait: {
    name: "Portrait commission", phrase: "a portrait commission", countLabel: "Figures",
    item: "figure", items: "figures",
    setup: "Sketches", perItem: "Drawing, per figure", delivery: "Scan and export",
    example: { count: 1, rounds: 2, setupHours: 1.5, itemHours: 4,
      communicationHours: 1, roundHours: 1, deliveryHours: 0.5 },
  },
  editorial: {
    name: "Editorial illustration", phrase: "an editorial illustration", countLabel: "Illustrations",
    item: "illustration", items: "illustrations",
    setup: "Research and sketches", perItem: "Drawing, per illustration", delivery: "Final files",
    example: { count: 1, rounds: 2, setupHours: 2, itemHours: 6,
      communicationHours: 1, roundHours: 1.5, deliveryHours: 0.5 },
  },
  session: {
    name: "Portrait session", phrase: "a portrait session", countLabel: "Edited photos",
    item: "photo", items: "photos",
    setup: "Shoot and travel", perItem: "Editing, per photo", delivery: "Gallery and export",
    example: { count: 20, rounds: 1, setupHours: 3, itemHours: 0.2,
      communicationHours: 1, roundHours: 1, deliveryHours: 1 },
  },
  event: {
    name: "Event", phrase: "an event shoot", countLabel: "Edited photos",
    item: "photo", items: "photos",
    setup: "Shoot and travel", perItem: "Editing, per photo", delivery: "Gallery and export",
    example: { count: 60, rounds: 1, setupHours: 5, itemHours: 0.1,
      communicationHours: 1.5, roundHours: 1, deliveryHours: 1 },
  },
  product: {
    name: "Product photos", phrase: "a product shoot", countLabel: "Products",
    item: "product", items: "products",
    setup: "Setup and lighting", perItem: "Shooting and editing, per product", delivery: "Retouch and export",
    example: { count: 8, rounds: 1, setupHours: 2, itemHours: 1,
      communicationHours: 1, roundHours: 1.5, deliveryHours: 1 },
  },
  logoanim: {
    name: "Logo animation", phrase: "a logo animation", countLabel: "Seconds",
    item: "second", items: "seconds",
    setup: "Storyboard and style frames", perItem: "Animation, per second", delivery: "Render and export",
    example: { count: 5, rounds: 2, setupHours: 2, itemHours: 1.5,
      communicationHours: 1, roundHours: 1.5, deliveryHours: 1.5 },
  },
  socialvideo: {
    name: "Social video", phrase: "a social video", countLabel: "Seconds",
    item: "second", items: "seconds",
    setup: "Script and storyboard", perItem: "Animation, per second", delivery: "Render, sizes, and captions",
    example: { count: 15, rounds: 2, setupHours: 3, itemHours: 0.8,
      communicationHours: 1.5, roundHours: 2, deliveryHours: 1.5 },
  },
  character: {
    name: "Character animation", phrase: "a character animation", countLabel: "Seconds",
    item: "second", items: "seconds",
    setup: "Character design and rig", perItem: "Animation, per second", delivery: "Render and export",
    example: { count: 10, rounds: 2, setupHours: 6, itemHours: 2,
      communicationHours: 1, roundHours: 2, deliveryHours: 1 },
  },
  explainer: {
    name: "Explainer video", phrase: "an explainer video", countLabel: "Seconds",
    item: "second", items: "seconds",
    setup: "Script, storyboard, and voice timing", perItem: "Animation, per second", delivery: "Sound sync and export",
    example: { count: 30, rounds: 2, setupHours: 5, itemHours: 1,
      communicationHours: 2, roundHours: 3, deliveryHours: 2 },
  },
  // Every field ends with Custom: the same blank job in each.
  custom: {
    name: "Custom project", tab: "Custom", phrase: "a custom project", countLabel: "Pieces",
    item: "piece", items: "pieces",
    setup: "Setup", perItem: "Work, per piece", delivery: "File prep and export",
    example: { count: 1, rounds: 0, setupHours: 0, itemHours: 0,
      communicationHours: 0, roundHours: 0, deliveryHours: 0 },
  },
};

// Fields of creative work. Each lists its jobs in tab order (Custom last) and
// names the expenses people in that field usually have.
const WORK_FIELDS = {
  graphic: {
    name: "Graphic design",
    jobs: ["menu", "logo", "social", "poster", "website", "custom"],
    expensesHint: "Money you spend on this job, like fonts, stock photos, or printed proofs.",
  },
  illustration: {
    name: "Illustration",
    jobs: ["portrait", "editorial", "custom"],
    expensesHint: "Money you spend on this job, like paper, paint, printing, or shipping.",
  },
  photography: {
    name: "Photography",
    jobs: ["session", "event", "product", "custom"],
    expensesHint: "Money you spend on this job, like gear rental, mileage, or props.",
  },
  motion: {
    name: "Motion",
    jobs: ["logoanim", "socialvideo", "character", "explainer", "custom"],
    expensesHint: "Money you spend on this job, like music licenses, stock footage, fonts, plugins, or voiceover.",
  },
};

// The field a job belongs to. Custom is in every field, so it needs the one
// the person picked; without one (older saves), it's Graphic design.
function fieldForJob(jobKey, fieldKey) {
  if (WORK_FIELDS[fieldKey] && WORK_FIELDS[fieldKey].jobs.indexOf(jobKey) !== -1) return fieldKey;
  const keys = Object.keys(WORK_FIELDS);
  for (let i = 0; i < keys.length; i++) {
    if (WORK_FIELDS[keys[i]].jobs.indexOf(jobKey) !== -1) return keys[i];
  }
  return "graphic";
}

// The fields, named for one job, so messages say "concepts" for a logo.
function fieldsFor(jobKey) {
  const job = JOBS[jobKey] || JOBS.menu;
  return Object.assign({}, FIELDS, {
    count: { name: job.countLabel.toLowerCase(), whole: true },
    setupHours: { name: job.setup.toLowerCase(), hours: true },
    itemHours: { name: job.perItem.toLowerCase(), hours: true },
    deliveryHours: { name: job.delivery.toLowerCase(), hours: true },
  });
}

// "1 page", "2 pages"
function countWords(amount, singular, plural) {
  return formatNumber(amount) + " " + (formatNumber(amount) === "1" ? singular : plural);
}

// The reply draft. price, offer, and estimate are amounts; offer is null with no offer.
// "Hi! Thanks for reaching out. For a menu with 2 pages and 2 rounds of
// changes, my price is $310."
// When the offer is at or above the estimate and the price is the offer, the
// reply accepts it instead of asking for less: "..., $1,000 works for me."
// extras (optional): acceptsOffer, to accept the offer for this work even
// though it's under the estimate ("Take their $200"), and extraRoundPrice, which
// adds "Additional rounds of changes are $40 each." before the last sentence.
function replyText(jobKey, count, rounds, price, offer, estimate, extras) {
  const job = JOBS[jobKey];
  const more = extras || {};
  const work = "Hi! Thanks for reaching out. For " + job.phrase + " with " +
    countWords(count, job.item, job.items) + " and " +
    countWords(rounds, "round", "rounds") + " of changes, ";
  const extra = more.extraRoundPrice ? " Additional rounds of changes are " +
    formatPrice(more.extraRoundPrice) + " each." : "";
  const accepts = offer !== null && price === offer &&
    (more.acceptsOffer || (estimate != null && offer >= estimate));
  if (accepts) {
    return work + formatPrice(offer) + " works for me." + extra + " Let me know when you'd like to get started!";
  }
  let text = work + "my price is " + formatPrice(price) + ".";
  if (offer !== null && price > offer) {
    text += " I know that's more than the " + formatPrice(offer) +
      " you mentioned, so I'm happy to talk about what would fit your budget.";
  }
  return text + extra + " Let me know if you have any questions!";
}

// Over this many hours, the page asks the person to check their hours.
const LONG_JOB_HOURS = 160;

// Weeks of full-time work (40 hours a week), rounded to a whole number.
function fullTimeWeeks(totalHours) {
  return Math.round(totalHours / 40);
}

// The fields the hours depend on. The page can show group totals
// whenever these are fine, even if another field has an error.
const HOURS_FIELDS = [
  "count", "rounds", "setupHours", "itemHours",
  "communicationHours", "roundHours", "deliveryHours",
];

// Digits with an optional decimal part. Commas are allowed only as
// thousands separators ("1,000" or "12,500.50"), so "1,5" isn't misread as 15.
const NUMBER_PATTERN = /^((\d{1,3}(,\d{3})+|\d+)(\.\d*)?|\.\d+)$/;

function upperFirst(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
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
    return { error: "Use a number for " + field.name + ".", kind: "notNumber" };
  }
  const size = Number(cleaned.text.replace(/,/g, ""));
  if (cleaned.negative && size > 0) {
    return { error: upperFirst(field.name) + " can't be less than 0.", kind: "negative" };
  }
  if (field.whole && !Number.isInteger(size)) {
    return { error: "Use a whole number for " + field.name + ".", kind: "notWhole" };
  }
  return { value: size };
}

// Checks every field. Takes the raw text from the form (and the job, which
// names the fields in messages; the menu if left out), returns
// { values, errors } where errors maps a field name to its message.
function validateInputs(raw, jobKey) {
  const FIELDS = fieldsFor(jobKey);
  const values = {};
  const errors = {};

  const required = HOURS_FIELDS.concat(["rate", "expenses"]);
  required.forEach(function (name) {
    const result = parseNumber(raw[name], FIELDS[name]);
    if (result.error) {
      errors[name] = result.error;
    } else if (result.value === null) {
      const field = FIELDS[name];
      errors[name] = (field.hours ? "Enter the hours for " : "Enter ") + field.name +
        ". Use 0 if there are none.";
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
  const production = values.setupHours + values.count * values.itemHours;
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
    result.offer.aboveTarget = shortCents < 0;
    result.offer.overPerHour = Math.max(0, hourly.before - values.rate);
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

  // A custom quote never changes the estimate or the target rate. Left blank,
  // the price is the estimate, or their offer when it's at or above the estimate,
  // so the price never asks the client for less than they offered.
  const isCustom = values.quote !== null;
  const offerFits = result.offer !== null && result.offer.amount >= estimate;
  const quoteAmount = isCustom ? values.quote : (offerFits ? result.offer.amount : estimate);
  const quoteHourly = hourlyFor(quoteAmount, values.expenses, total);
  result.quote = {
    amount: quoteAmount,
    isCustom: isCustom,
    // What a blank price follows: "offer" or "estimate".
    defaultsTo: offerFits ? "offer" : "estimate",
    hourlyBefore: quoteHourly.before,
    hourlyAfter: quoteHourly.after,
    differenceFromEstimate: quoteAmount - estimate,
  };

  return result;
}

// One extra round of changes: hours per round x rate, rounded up to $5.
// null when a round takes no hours. The menu: 1.5 hrs x $25 = $37.50, so $40.
function extraRoundPrice(values) {
  if (!(values.roundHours > 0)) return null;
  const exact = values.roundHours * values.rate;
  const price = roundUpToFive(exact);
  return { price: price, hours: values.roundHours, rate: values.rate, rounded: price !== exact };
}

// Ways to close the gap, when there's an offer below the estimate. Up to three:
//   estimate  "Raise your price": the estimate, same work.
//   trade     "Trade work for price": one round of changes fewer (or with 0
//             rounds, one item fewer), at that smaller job's estimate. Left out
//             if there's no smaller job, or its estimate isn't above the offer.
//   offer     "Take their $200": the offer, for the smaller job (or the same
//             work if there's no smaller job). Left out at or below expenses.
// Each: { type, price, count, rounds, hours, covered, rateAfter, meetsTarget,
// underBy, priceChange (price - offer), workChange (null, or { kind, by }) }.
function gapOptions(values) {
  const base = Object.assign({}, values, { quote: null });
  const r = calculate(base);
  if (!r.hasHours || !r.offer || !(r.offer.gap > 0)) return [];
  const offer = r.offer.amount;

  function option(type, price, scope, workChange) {
    const hours = workHours(scope).total;
    const covered = Math.min(hours, Math.max(0, (price - scope.expenses) / scope.rate));
    const rateAfter = (price - scope.expenses) / hours;
    // To the cent, like the hero: $24.999 doesn't read as under the target.
    const underCents = Math.round((scope.rate - rateAfter) * 100);
    return {
      type: type, price: price, count: scope.count, rounds: scope.rounds,
      hours: hours, covered: covered, rateAfter: rateAfter,
      meetsTarget: underCents <= 0, underBy: Math.max(0, scope.rate - rateAfter),
      priceChange: price - offer, workChange: workChange,
    };
  }

  // The smaller job: one round fewer, or with no rounds, one item fewer.
  let smaller = null;
  let change = null;
  if (base.rounds >= 1) {
    smaller = Object.assign({}, base, { rounds: base.rounds - 1 });
    change = { kind: "round", by: 1 };
  } else if (base.count >= 2) {
    smaller = Object.assign({}, base, { count: base.count - 1 });
    change = { kind: "item", by: 1 };
  }
  if (smaller && !(workHours(smaller).total > 0)) smaller = null;

  const options = [option("estimate", r.estimate, base, null)];
  if (smaller) {
    const smallerEstimate = calculate(smaller).estimate;
    if (smallerEstimate > offer) options.push(option("trade", smallerEstimate, smaller, change));
  }
  if (offer > base.expenses) {
    options.push(smaller ? option("offer", offer, smaller, change) : option("offer", offer, base, null));
  }
  return options;
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

// True when a label box comes closer than `gap` px to any of the other boxes.
// Boxes are { left, right }.
function isCrowded(box, others, gap) {
  return others.some(function (other) {
    return box.left < other.right + gap && other.left < box.right + gap;
  });
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

// Money field text with thousands commas: "1983770" gives "1,983,770",
// "1000.5" gives "1,000.5". Text that isn't a plain number stays as typed.
function groupDigits(text) {
  const plain = String(text == null ? "" : text).trim().replace(/,/g, "");
  if (!/^\d+(\.\d*)?$/.test(plain) || !NUMBER_PATTERN.test(String(text).trim())) return text;
  const parts = plain.split(".");
  const whole = parts[0].replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.length > 1 ? whole + "." + parts[1] : whole;
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
  JOBS,
  WORK_FIELDS,
  fieldForJob,
  replyText,
  extraRoundPrice,
  gapOptions,
  countWords,
  LONG_JOB_HOURS,
  fullTimeWeeks,
  HOURS_FIELDS,
  fieldsFor,
  parseNumber,
  validateInputs,
  roundUpToFive,
  workHours,
  calculate,
  blockUnit,
  splitIntoBlocks,
  rulerScale,
  spreadLabels,
  isCrowded,
  formatMoney,
  formatWholeMoney,
  formatNumber,
  formatHours,
  formatPrice,
  groupDigits,
};

if (typeof module !== "undefined") module.exports = calc;
