// Results

function renderGroupTotals(hours) {
  WORK_GROUPS.forEach(function (group) {
    byId("total-" + group).textContent = calc.formatHours(hours[group]);
  });
}

function clearGroupTotals() {
  WORK_GROUPS.forEach(function (group) {
    byId("total-" + group).textContent = "";
  });
}

// "11.5 hours", "1 hour"
function hoursInWords(amount) {
  const text = calc.formatNumber(amount);
  return text + (text === "1" ? " hour" : " hours");
}

// Fills an element with text and emphasized numbers.
// Parts are plain strings, or [text, className] for a <strong>.
function setRichText(element, parts) {
  element.textContent = "";
  parts.forEach(function (part) {
    if (typeof part === "string") {
      element.append(part);
    } else {
      const strong = document.createElement("strong");
      strong.textContent = part[0];
      if (part[1]) strong.className = part[1];
      element.appendChild(strong);
    }
  });
}

// "$310" while counting up to $310, "$54.37" while counting to $109.50.
function priceFormat(final) {
  const hasCents = Math.abs(final - Math.round(final)) >= 0.005;
  return hasCents ? calc.formatMoney : function (v) { return calc.formatWholeMoney(Math.round(v)); };
}

// The stats on screen, so plays and live changes can count their numbers.
let shownStats = [];

function renderStatNumbers() {
  document.querySelectorAll("#metrics .stat-number").forEach(function (number, i) {
    if (shownStats[i]) number.textContent = shownStats[i].value;
  });
}

// Stats: 4 columns. Each is { label, value, unit, note, number, format, key }.
// number and format let it count: format(number) gives value.
// morph: numbers tween from the old ones (same key or label, same place), 250ms.
// key: for a label that changes with the numbers ("Hours $180 covers at $25/hr").
function renderStats(items, morph) {
  const previous = shownStats;
  shownStats = items;
  const list = byId("metrics");
  list.textContent = "";
  items.forEach(function (item) {
    const group = document.createElement("div");
    const label = document.createElement("dt");
    label.textContent = item.label;
    const value = document.createElement("dd");
    const number = document.createElement("span");
    number.className = "stat-number";
    number.textContent = item.value;
    value.appendChild(number);
    if (item.unit) {
      const unit = document.createElement("span");
      unit.className = "stat-unit" + (item.unitLine ? " stat-unit-line" : "");
      unit.textContent = item.unit;
      value.appendChild(unit);
    }
    if (item.note) {
      const note = document.createElement("span");
      note.className = "stat-note";
      note.textContent = item.note;
      value.appendChild(note);
    }
    group.append(label, value);
    list.appendChild(group);
  });
  fitStats();
  if (!morph) return;
  list.querySelectorAll(".stat-number").forEach(function (number, i) {
    const item = items[i];
    const old = previous[i];
    if (!old || (old.key || old.label) !== (item.key || item.label) || typeof old.number !== "number" || old.number === item.number) return;
    tween(MORPH_MS, function (t) { number.textContent = item.format(mix(old.number, item.number, t)); },
      function () { number.textContent = item.value; });
  });
}

// Big values ("$1,983,770") shrink to fit their column, down to 22px.
const STAT_MIN_SIZE = 22;

function fitStats() {
  document.querySelectorAll("#metrics dd").forEach(function (value) {
    value.style.fontSize = "";
    const room = value.clientWidth;
    if (!room) return;
    // Two passes, since the unit next to the number keeps its own size.
    for (let i = 0; i < 2 && value.scrollWidth > room; i++) {
      const size = parseFloat(getComputedStyle(value).fontSize);
      if (size <= STAT_MIN_SIZE) return;
      value.style.fontSize = Math.max(STAT_MIN_SIZE, Math.floor(size * room / value.scrollWidth)) + "px";
    }
  });
}

// Over 160 hours: "That's about 99 weeks of full-time work. Check your hours."
function renderWeeksNotes(hours) {
  const long = Boolean(hours) && hours.total > calc.LONG_JOB_HOURS;
  ["work-weeks", "hero-weeks"].forEach(function (id) {
    const note = byId(id);
    note.textContent = long ? "That's about " + calc.fullTimeWeeks(hours.total) +
      " weeks of full-time work. Check your hours." : "";
    show(note, long);
  });
}

// "Menu · 2 pages · 2 rounds"
function jobSummary(values) {
  return job().name + " · " + countOf(values.count, job().item, job().items) + " · " +
    countOf(values.rounds, "round", "rounds");
}

// morph: a live change on screen 2, so the stats tween from their old values.
function renderHero(r, values, morph) {
  stopCountUp();
  const sentence = byId("hero-sentence");
  const warning = byId("offer-warning");
  byId("hero-job").textContent = jobSummary(values);

  if (r.offer && r.offer.belowExpenses) {
    // Below expenses there's no pay to show, only what the job costs.
    const loss = calc.formatMoney(r.offer.shortfall);
    byId("hero-label").textContent = "This offer costs you";
    byId("hero-amount").textContent = loss.slice(1);
    byId("hero-unit").textContent = "";
    byId("hero-spoken").textContent = loss;
    sentence.textContent = "before counting any of your " + hoursInWords(r.hours.total) + ".";
  }

  if (r.offer) {
    // The headline rate is after expenses, the same rate the target is compared with.
    const money = calc.formatMoney(r.offer.hourlyAfter);
    const target = calc.formatPrice(r.rate);
    if (r.offer.belowExpenses) {
      // Set above.
    } else if (r.offer.aboveTarget) {
      sentence.textContent = "for " + hoursInWords(r.hours.total) + " of real work. That's " +
        calc.formatMoney(r.offer.overPerHour) + " an hour over your " + target + " target.";
    } else if (r.offer.meetsTarget) {
      sentence.textContent = "for " + hoursInWords(r.hours.total) +
        " of real work. That meets your " + target + " target.";
    } else {
      sentence.textContent = "for " + hoursInWords(r.hours.total) + " of real work. That's " +
        calc.formatMoney(r.offer.shortPerHour) + " an hour under your " + target + " target.";
    }

    if (!r.offer.belowExpenses) {
      byId("hero-label").textContent = "This offer pays, after expenses";
      byId("hero-amount").textContent = money.slice(1);
      byId("hero-unit").textContent = "/hr";
      byId("hero-spoken").textContent = money + " per hour";
    }
    renderBudgetSentence(r);
    // The hero itself says what a loss costs, so the warning isn't needed too.
    show(sentence, true);
    show(warning, false);
    fitHeroNumber();

    // The label says which way the difference goes. An offer above the
    // estimate gets a plus sign, since it's money on top of your price.
    let comparison;
    if (r.offer.gap > 0) {
      comparison = { label: "More than they offered", value: calc.formatPrice(r.offer.gap),
        number: r.offer.gap, format: priceFormat(r.offer.gap) };
    } else if (r.offer.gap < 0) {
      const over = priceFormat(-r.offer.gap);
      comparison = { label: "Above your estimate", value: "+" + calc.formatPrice(-r.offer.gap),
        number: -r.offer.gap, format: function (v) { return "+" + over(v); } };
    } else {
      comparison = { label: "Same as their offer", value: "$0", number: 0, format: priceFormat(0) };
    }
    // "7.2 of 11.5 hrs". Below expenses the offer pays for none of it.
    const covered = r.offer.belowExpenses ? 0 : Math.min(r.offer.hoursCovered, r.hours.total);
    renderStats([
      { label: "Your estimate", value: calc.formatWholeMoney(r.estimate), number: r.estimate,
        format: priceFormat(r.estimate) },
      comparison,
      { label: "Hours " + calc.formatPrice(r.offer.amount - r.expenses) + " covers at " +
        calc.formatPrice(r.rate) + "/hr", key: "covered", value: calc.formatNumber(covered), number: covered,
        format: calc.formatNumber,
        unit: "of " + calc.formatHours(r.hours.total), unitLine: true },
      { label: "Before expenses", value: calc.formatMoney(r.offer.hourlyBefore), unit: "/hr",
        number: r.offer.hourlyBefore, format: calc.formatMoney },
    ], morph);
  } else {
    const estimate = calc.formatWholeMoney(r.estimate);
    byId("hero-label").textContent = "Your estimate";
    byId("hero-amount").textContent = estimate.slice(1);
    byId("hero-unit").textContent = "";
    byId("hero-spoken").textContent = estimate;

    let text = hoursInWords(r.hours.total) + " at your " + calc.formatMoney(r.rate) +
      "/hr target, plus " + calc.formatMoney(r.expenses) + " in expenses.";
    if (r.rounding > 0) text += " Rounded up from " + calc.formatMoney(r.subtotal) + ".";
    sentence.textContent = text;
    show(sentence, true);
    show(warning, false);
    show(byId("budget-sentence"), false);
    fitHeroNumber();

    const forgotten = r.outsideProduction;
    renderStats([
      { label: "Total hours", value: calc.formatNumber(r.hours.total), number: r.hours.total,
        format: calc.formatNumber,
        unit: isOne(r.hours.total) ? "hr" : "hrs" },
      { label: "Your time at " + calc.formatPrice(r.rate) + "/hr", value: calc.formatMoney(r.timeCost),
        number: r.timeCost, format: calc.formatMoney },
      { label: "Expenses", value: calc.formatMoney(r.expenses), number: r.expenses, format: calc.formatMoney },
      { label: "Usually forgotten", value: calc.formatNumber(forgotten), number: forgotten,
        format: calc.formatNumber,
        unit: isOne(forgotten) ? "hr" : "hrs",
        note: "worth " + calc.formatMoney(forgotten * r.rate) + " at your rate" },
    ], morph);
  }
}

// Under the stats, with an offer that covers expenses: "After expenses, $200
// leaves $180 for your time: enough for 7.2 of your 11.5 hours at your $25 target."
function renderBudgetSentence(r) {
  const element = byId("budget-sentence");
  const offer = r.offer;
  show(element, !offer.belowExpenses);
  if (offer.belowExpenses) return;
  const hours = offer.coversAllHours
    ? "all " + hoursInWords(r.hours.total)
    : calc.formatNumber(offer.hoursCovered) + " of your " + hoursInWords(r.hours.total);
  setRichText(element, [
    "After expenses, " + calc.formatPrice(offer.amount) + " leaves ",
    [calc.formatPrice(offer.amount - r.expenses) + " for your time:"],
    " enough for ", [hours], " at your " + calc.formatPrice(r.rate) + " target.",
  ]);
}

