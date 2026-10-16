// Counter page behavior: reads the fields, runs the math from calc.js,
// and writes the results onto the page. All math lives in calc.js.

// Which field on the page holds each value calc.js needs.
const FIELD_IDS = {
  count: "count",
  rounds: "rounds",
  setupHours: "setup-hours",
  itemHours: "item-hours",
  communicationHours: "communication-hours",
  roundHours: "round-hours",
  deliveryHours: "delivery-hours",
  rate: "rate",
  expenses: "expenses",
  offer: "offer",
  quote: "quote",
};

const WORK_GROUPS = ["production", "communication", "revisions", "delivery"];

function byId(id) {
  return document.getElementById(id);
}

function show(element, visible) {
  element.hidden = !visible;
}

// Reads every field as text, the way calc.validateInputs expects.
function readForm() {
  const raw = {};
  Object.keys(FIELD_IDS).forEach(function (name) {
    raw[name] = byId(FIELD_IDS[name]).value;
  });
  raw.offerStatus = document.querySelector('input[name="offerStatus"]:checked').value;
  return raw;
}

// Error messages

// 16px alert icon shown before every error. Decorative: the message says it all.
const ALERT_ICON =
  '<svg class="icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
  '<circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/>' +
  '<path d="M8 4.5v4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' +
  '<circle cx="8" cy="11.4" r="0.95" fill="currentColor"/></svg>';

// Shows or clears one field's error. The message goes right under the field,
// is linked with aria-describedby, and the field gets aria-invalid.
function setFieldError(input, message) {
  const errorId = input.id + "-error";
  let error = byId(errorId);
  const describedBy = (input.getAttribute("aria-describedby") || "")
    .split(" ")
    .filter(function (id) { return id && id !== errorId; });

  if (message) {
    if (!error) {
      error = document.createElement("p");
      error.className = "error";
      error.id = errorId;
      error.innerHTML = ALERT_ICON + '<span class="error-text"></span>';
      const box = input.closest(".unit-input, .stepper") || input;
      box.insertAdjacentElement("afterend", error);
    }
    error.querySelector(".error-text").textContent = message;
    input.setAttribute("aria-invalid", "true");
    describedBy.unshift(errorId);
  } else {
    if (error) error.remove();
    input.removeAttribute("aria-invalid");
  }

  if (describedBy.length) {
    input.setAttribute("aria-describedby", describedBy.join(" "));
  } else {
    input.removeAttribute("aria-describedby");
  }
}

// Fields whose error is on screen right now.
let shownErrors = {};

// New errors wait until the field is left or typing pauses ("commit").
// An error that's already showing updates or clears right away.
function showErrors(errors, commit) {
  const next = {};
  Object.keys(errors).forEach(function (name) {
    if (commit || shownErrors[name]) next[name] = true;
  });
  shownErrors = next;
  Object.keys(FIELD_IDS).forEach(function (name) {
    setFieldError(byId(FIELD_IDS[name]), shownErrors[name] ? errors[name] : "");
  });
}

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

// Stats: 4 columns. Each is { label, value, unit, note, number, format }.
// number and format let it count: format(number) gives value.
// morph: numbers tween from the old ones (same label, same place), 250ms.
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
    if (!old || old.label !== item.label || typeof old.number !== "number" || old.number === item.number) return;
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
    const money = calc.formatMoney(r.offer.hourlyBefore);
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
      byId("hero-label").textContent = "This offer pays";
      byId("hero-amount").textContent = money.slice(1);
      byId("hero-unit").textContent = "/hr";
      byId("hero-spoken").textContent = money + " per hour";
    }
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
      { label: "Hours the offer pays for", value: calc.formatNumber(covered), number: covered,
        format: calc.formatNumber,
        unit: "of " + calc.formatHours(r.hours.total), unitLine: true },
      { label: "After expenses", value: calc.formatMoney(r.offer.hourlyAfter), unit: "/hr",
        number: r.offer.hourlyAfter, format: calc.formatMoney },
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

const GROUP_NAMES = {
  production: "Production",
  communication: "Communication",
  revisions: "Revisions",
  delivery: "Delivery",
};

// The three groups people usually forget.
const FORGOTTEN_GROUPS = ["communication", "revisions", "delivery"];

// Chart sizes from docs/DESIGN.md, in px.
const BAR_GAP = 4;
const LABEL_SPACE = 8;
// The runs-out label may come this close to its line, to fit.
const MIN_LABEL_SPACE = 6;
// Minimum space between two labels, in px.
const LABEL_GAP = 8;

// A label's width, rounded up. offsetWidth rounds, so a 172.8px label read as
// 172 could end 0.8px past the chart's edge.
function labelWidth(element) {
  return Math.ceil(element.getBoundingClientRect().width);
}

function isOne(amount) {
  return calc.formatNumber(amount) === "1";
}

// Makes a parent hold exactly `count` children of one kind, reusing the ones
// already there, so values can animate from their old state.
function ensureChildren(parent, count, make) {
  while (parent.children.length < count) parent.appendChild(make());
  while (parent.children.length > count) parent.lastElementChild.remove();
  return Array.prototype.slice.call(parent.children);
}

// Places labels in one row with calc.spreadLabels so none overlap. Each item is
// { element, left } where left is the wanted left edge. If they can't all fit
// in one row, every second label drops to a second row. Returns true if it used two rows.
function placeLabels(items, width) {
  function place(row) {
    const result = calc.spreadLabels(row.map(function (item) {
      return { left: item.left, width: labelWidth(item.element) };
    }), width, LABEL_GAP);
    row.forEach(function (item, i) { item.element.style.left = result.lefts[i] + "px"; });
    return result.fits;
  }
  items.forEach(function (item) { item.element.classList.remove("second-row"); });
  if (place(items)) return false;
  const first = items.filter(function (item, i) { return i % 2 === 0; });
  const second = items.filter(function (item, i) { return i % 2 === 1; });
  second.forEach(function (item) { item.element.classList.add("second-row"); });
  place(first);
  place(second);
  return true;
}

// Chart 1: Where your hours go

function renderHoursChart(r) {
  const total = r.hours.total;
  const offer = r.offer;
  byId("hours-title").textContent = "Where your " + hoursInWords(total) + " go";

  // What screen readers get instead of the bars.
  const items = ensureChildren(byId("hours-list"), WORK_GROUPS.length, function () {
    return document.createElement("li");
  });
  WORK_GROUPS.forEach(function (group, i) {
    items[i].textContent = GROUP_NAMES[group] + ": " + calc.formatHours(r.hours[group]);
  });

  // With an offer: gradient = paid, stripes = unpaid.
  // Without one: solid = design work, stripes = usually forgotten.
  byId("legend-first").textContent = offer ? "paid by the offer" : "design work";
  byId("legend-second").textContent = offer ? "unpaid" : "usually forgotten";
  byId("legend-first-swatch").className = "legend-swatch " + (offer ? "paid" : "solid");

  const parts = [];
  const unpaid = offer ? offer.unpaidHours : 0;
  if (unpaid > 1e-9) {
    parts.push([hoursInWords(unpaid)], isOne(unpaid) ? " goes unpaid, and " : " go unpaid, and ");
  }
  if (r.outsideProduction > 0) {
    parts.push([hoursInWords(r.outsideProduction)],
      isOne(r.outsideProduction) ? " is work outside production." : " are work outside production.");
  } else {
    parts.push(parts.length ? "all " : "All ", [hoursInWords(total)], " are production.");
  }
  setRichText(byId("hours-summary"), parts);

  layoutHoursChart(r);
}

// One bar per group, widths by hours. Paid hours share one continuous gradient
// across the groups; unpaid hours are stripes. A dashed line marks where the money runs out.
function layoutHoursChart(r) {
  const row = byId("bar-row");
  const width = row.clientWidth;
  if (!width) return;

  const total = r.hours.total;
  const offer = r.offer;
  const groups = WORK_GROUPS.filter(function (group) { return r.hours[group] > 1e-9; });
  const usable = width - (groups.length - 1) * BAR_GAP;

  // Hours the offer pays for, from the start. null means no offer.
  let covered = null;
  if (offer && offer.belowExpenses) covered = 0;
  else if (offer && offer.coversAllHours) covered = Infinity;
  else if (offer) covered = offer.hoursCovered;
  const showLine = Boolean(offer) && !offer.belowExpenses && !offer.coversAllHours;

  const bars = ensureChildren(row, groups.length, function () {
    const bar = document.createElement("div");
    bar.className = "bar-group";
    bar.innerHTML = '<span class="bar-paid"></span><span class="bar-unpaid"></span>';
    return bar;
  });

  let x = 0;
  let start = 0;
  let lineX = null;
  const spans = [];
  groups.forEach(function (group, i) {
    const hours = r.hours[group];
    const w = (hours / total) * usable;
    const bar = bars[i];
    bar.dataset.group = group;
    bar.style.width = w + "px";
    bar.classList.toggle("no-offer", covered === null);

    let share;
    if (covered === null) share = group === "production" ? 1 : 0;
    else share = Math.max(0, Math.min(1, (covered - start) / hours));
    const paid = bar.firstElementChild;
    paid.style.width = (share * 100) + "%";
    paid.style.backgroundSize = width + "px 100%";
    paid.style.backgroundPosition = (-x) + "px 0";
    bar.lastElementChild.style.width = ((1 - share) * 100) + "%";

    if (showLine && lineX === null && covered <= start + hours + 1e-9) {
      lineX = x + share * w;
    }
    spans.push({ group: group, left: x, right: x + w });
    x += w + BAR_GAP;
    start += hours;
  });

  // The runs-out line and its label. With no line, the label row says why.
  const line = byId("runs-out");
  const lineLabel = byId("runs-out-label");
  let flag = "";
  if (offer && offer.belowExpenses) {
    flag = calc.formatPrice(offer.amount) + " doesn't cover your expenses";
  } else if (offer && offer.coversAllHours) {
    flag = calc.formatPrice(offer.amount) + " covers all " + calc.formatHours(total);
  }
  show(line, Boolean(flag) || lineX !== null);
  line.classList.toggle("flag", Boolean(flag));
  line.style.top = "";
  line.style.height = "";
  lineLabel.style.left = "";
  lineLabel.style.right = "";
  lineLabel.style.top = "";
  if (flag) {
    lineLabel.textContent = flag;
    line.style.left = "0px";
  } else if (lineX !== null) {
    lineLabel.textContent = calc.formatPrice(offer.amount) + " runs out at " +
      calc.formatHours(offer.hoursCovered);
    line.style.left = lineX + "px";
    // Left of the line, then right of it, 8px away, then 6px. If neither fits,
    // the label is centered on the line, inside the chart, and the line starts
    // 4px below it so it never runs through the text. The label is placed from
    // just inside the line's 1px border.
    const from = lineX + line.clientLeft;
    const w = labelWidth(lineLabel);
    let side = null;
    [LABEL_SPACE, MIN_LABEL_SPACE].forEach(function (gap) {
      if (side) return;
      if (from - gap - w >= 0) side = { right: gap };
      else if (from + gap + w <= width) side = { left: gap };
    });
    if (side) {
      lineLabel.style.left = side.left !== undefined ? side.left + "px" : "auto";
      lineLabel.style.right = side.right !== undefined ? side.right + "px" : "auto";
    } else {
      lineLabel.style.left = (Math.max(0, Math.min(width - w, from - w / 2)) - from) + "px";
      lineLabel.style.right = "auto";
      const drop = lineLabel.offsetTop + lineLabel.offsetHeight + 4;
      const lineStyle = getComputedStyle(line);
      line.style.top = (parseFloat(lineStyle.top) + drop) + "px";
      line.style.height = (parseFloat(lineStyle.height) - drop) + "px";
      lineLabel.style.top = (lineLabel.offsetTop - drop) + "px";
    }
  }

  // A bracket over the forgotten groups.
  const forgotten = spans.filter(function (span) { return FORGOTTEN_GROUPS.indexOf(span.group) !== -1; });
  const bracket = byId("bracket");
  show(bracket, forgotten.length > 0);
  if (forgotten.length) {
    const left = forgotten[0].left;
    const right = forgotten[forgotten.length - 1].right;
    bracket.style.left = left + "px";
    bracket.style.width = (right - left) + "px";
    const label = byId("bracket-label");
    label.textContent = calc.formatHours(r.outsideProduction) + " usually forgotten";
    // Keep the label inside the chart.
    // It's placed from just inside the bracket's 1px border.
    label.style.left = Math.min(0, width - (left + bracket.clientLeft + labelWidth(label))) + "px";
  }

  // Phone: group names and hours in a 2-column legend under the bar, each with
  // a swatch of how it's drawn (paid, unpaid, or with no offer, solid or striped).
  const legend = ensureChildren(byId("group-legend"), groups.length, function () {
    const item = document.createElement("li");
    item.innerHTML = '<span class="legend-swatch"></span><span class="group-name"></span><span class="group-hours"></span>';
    return item;
  });
  let legendStart = 0;
  groups.forEach(function (group, i) {
    let drawn;
    if (covered === null) drawn = group === "production" ? "solid" : "striped";
    else drawn = covered > legendStart + 1e-9 ? "paid" : "striped";
    legendStart += r.hours[group];
    legend[i].firstElementChild.className = "legend-swatch " + drawn;
    legend[i].querySelector(".group-name").textContent = GROUP_NAMES[group];
    legend[i].querySelector(".group-hours").textContent = calc.formatNumber(r.hours[group]) + "h";
  });

  // Under each group: hours and name. Labels never overlap.
  const labels = ensureChildren(byId("bar-labels"), groups.length, function () {
    const label = document.createElement("span");
    label.className = "bar-label";
    label.innerHTML = '<span class="bar-hours"><b></b><span class="unit"></span></span><span class="bar-name"></span>';
    return label;
  });
  groups.forEach(function (group, i) {
    const hours = r.hours[group];
    labels[i].querySelector("b").textContent = calc.formatNumber(hours);
    labels[i].querySelector(".unit").textContent = isOne(hours) ? "hr" : "hrs";
    labels[i].querySelector(".bar-name").textContent = GROUP_NAMES[group];
  });
  const twoRows = placeLabels(spans.map(function (span, i) {
    return { element: labels[i], left: span.left };
  }), width);
  byId("bar-labels").classList.toggle("two-rows", twoRows);
}

// Chart 2: Your rate drops as hours grow

// Hidden when the offer is at or below expenses: then the curve is flat or rises,
// which would contradict the title. The hero and the hours chart already explain it.
function showsRateChart(r) {
  return Boolean(r.offer) && r.offer.amount > r.expenses;
}

function renderOfferChart(r) {
  const chart = byId("offer-chart");
  show(chart, showsRateChart(r));
  byId("hours-chart").parentElement.classList.toggle("single", !showsRateChart(r));
  if (!showsRateChart(r)) return;
  const offer = r.offer;

  const items = byId("pay-list").children;
  items[0].textContent = "Offer, before expenses: " + calc.formatMoney(offer.hourlyBefore) + "/hr";
  items[1].textContent = "Offer, after " + calc.formatMoney(r.expenses) + " expenses: " +
    calc.formatMoney(offer.hourlyAfter) + "/hr";
  items[2].textContent = "Your target rate: " + calc.formatMoney(r.rate) + "/hr";

  const amount = calc.formatPrice(offer.amount);
  byId("rate-sub").textContent = (r.expenses > 0
    ? "After your " + calc.formatPrice(r.expenses) + " in expenses, " + amount
    : upperFirst(amount)) + " spread over more hours pays less per hour.";

  // Under 1 hour, "only up to 0.04 hrs" is exact but hard to read.
  const target = calc.formatPrice(r.rate);
  byId("offer-summary").textContent = "After expenses, the offer pays " +
    calc.formatMoney(offer.hourlyAfter) + " an hour for " + hoursInWords(r.hours.total) + ". " +
    (offer.hoursCovered < 1
      ? "It stays below your " + target + " target for any job longer than an hour."
      : "It pays your " + target + " target or more " + (offer.coversAllHours ? "" : "only ") +
        "up to " + calc.formatHours(offer.hoursCovered) + ".");

  layoutRateChart(r, true);
}

// The smallest round step at least as big as rough: 0.25, 0.5, then 1, 2, 5 times a
// power of ten, with no top, so even millions of hours get a handful of lines.
function niceStep(rough) {
  if (rough <= 0.25) return 0.25;
  if (rough <= 0.5) return 0.5;
  let power = 1;
  while (power * 5 < rough) power *= 10;
  if (rough <= power) return power;
  if (rough <= power * 2) return power * 2;
  return power * 5;
}

const SVG_NS = "http://www.w3.org/2000/svg";

function svgElement(parent, name, attributes, text) {
  const element = document.createElementNS(SVG_NS, name);
  Object.keys(attributes).forEach(function (key) { element.setAttribute(key, attributes[key]); });
  if (text) element.textContent = text;
  parent.appendChild(element);
  return element;
}

// After expenses, the offer divided by hours, from about a third of the current
// hours to 1.4 times. It meets the target at the same point the hours chart's
// money runs out.
// morph: a live change, so the curve and dots tween from where they were (250ms).
function layoutRateChart(r, morph) {
  const plot = byId("rate-plot");
  const width = plot.clientWidth;
  if (!width) return;
  const height = isPhone() ? 170 : 210;
  // pad.left is set below, from the widest y label.
  const pad = { left: 0, right: 4, top: 12, bottom: 26 };
  const offer = r.offer;
  const total = r.hours.total;
  const net = offer.amount - r.expenses;
  function value(hours) { return net / hours; }

  // Hours across: grid lines on a round step.
  const step = niceStep((total * 1.4 - total / 3) / 7);
  let x0 = Math.ceil((total / 3) / step) * step;
  if (x0 <= 0) x0 = step;
  let x1 = Math.floor((total * 1.4) / step) * step;
  if (x1 <= total) x1 = Math.ceil(total / step) * step + step;
  if (x0 >= total) x0 = Math.max(step, Math.floor(total / step) * step - step);

  // Dollars per hour up: $0, the target, and a round top value. Below $0 when
  // the offer doesn't cover the expenses.
  const top = calc.rulerScale(Math.max(value(x0), r.rate)).max;
  const bottom = net < 0 ? -calc.rulerScale(-value(x0)).max : 0;
  function px(hours) { return pad.left + ((hours - x0) / (x1 - x0)) * (width - pad.left - pad.right); }
  function py(amount) { return pad.top + ((top - amount) / (top - bottom)) * (height - pad.top - pad.bottom); }

  plot.textContent = "";
  const svg = svgElement(plot, "svg", { width: width, height: height, viewBox: "0 0 " + width + " " + height,
    "aria-hidden": "true", focusable: "false" });

  // Y labels: the target always; $0, the top, and the bottom only where they
  // don't crowd it. The space left of the plot is the widest of them plus 8px,
  // so none is ever cut off ("$1,250" needs more room than "$50").
  const yLabels = [[r.rate, calc.formatPrice(r.rate)]];
  [[0, "$0"], [top, calc.formatPrice(top)], [bottom, "-" + calc.formatPrice(-bottom)]]
    .forEach(function (item) {
      if (item[0] === r.rate || (item[0] === bottom && bottom >= 0)) return;
      if (Math.abs(py(item[0]) - py(r.rate)) >= 16) yLabels.push(item);
    });
  const yTexts = yLabels.map(function (item) {
    return svgElement(svg, "text", { class: "rate-tick", y: py(item[0]) + 4, "text-anchor": "end" }, item[1]);
  });
  pad.left = Math.ceil(Math.max.apply(null, yTexts.map(function (text) { return text.getBBox().width; }))) + 8;
  yTexts.forEach(function (text) { text.setAttribute("x", pad.left - 8); });

  for (let h = x0; h <= x1 + 1e-9; h += step) {
    svgElement(svg, "line", { class: "rate-grid", x1: px(h), x2: px(h), y1: pad.top, y2: height - pad.bottom });
    const tick = svgElement(svg, "text", { class: "rate-tick", x: px(h), y: height - 6, "text-anchor": "middle" },
      calc.formatNumber(h) + "h");
    // The ticks at the ends line up with the edge instead of hanging past it.
    const box = tick.getBBox();
    if (box.x + box.width > width) {
      tick.setAttribute("x", width);
      tick.setAttribute("text-anchor", "end");
    } else if (box.x < 0) {
      tick.setAttribute("x", 0);
      tick.setAttribute("text-anchor", "start");
    }
  }

  if (bottom < 0) {
    svgElement(svg, "line", { class: "rate-zero", x1: pad.left, x2: width - pad.right, y1: py(0), y2: py(0) });
  }

  // The target: a solid line. Its label is placed after the dots' labels.
  const targetY = py(r.rate);
  svgElement(svg, "line", { class: "rate-target", x1: pad.left, x2: width - pad.right, y1: targetY, y2: targetY });

  // The curve.
  const points = [];
  const samples = [];
  for (let i = 0; i <= 80; i++) {
    const h = x0 + ((x1 - x0) * i) / 80;
    samples.push({ x: px(h), y: py(value(h)) });
    points.push((i ? "L" : "M") + px(h).toFixed(1) + " " + py(value(h)).toFixed(1));
  }
  const curve = svgElement(svg, "path", { class: "rate-curve", d: points.join(" ") });

  // Labels never overlap each other. They're placed in priority order: the
  // current-hours label, then the target, then the target crossing. Each may
  // only use a spot inside the chart and clear of every label placed before it;
  // of those, it takes the one touching the least (dots, then axis labels, then
  // the curve, then the target line), the earlier spot on a tie. With no allowed spot, the
  // label is hidden from the drawing; the summary under the chart still says it.
  // The target label is never hidden (see below).
  // Axis labels come last: one that a label covers is hidden.
  const placed = [];
  const marks = [];
  function touches(a, b, gap) {
    return a.x < b.x + b.width + gap && b.x < a.x + a.width + gap &&
      a.y < b.y + b.height + gap && b.y < a.y + a.height + gap;
  }
  function allowed(box, keepClear) {
    if (box.x < 0 || box.x + box.width > width || box.y < 0 || box.y + box.height > height - pad.bottom) return false;
    return !placed.concat(keepClear || []).some(function (other) { return touches(box, other, 4); });
  }
  // While the current-hours label is placed, it also avoids the strip along the
  // target line when it can, so the target label (next) has room there.
  let avoidTargetBand = false;
  function conflicts(box) {
    let score = 0;
    if (avoidTargetBand && box.y < targetY + 24 && box.y + box.height > targetY - 24) score += 8;
    marks.forEach(function (mark) { if (touches(box, mark, 4)) score += 20; });
    yTexts.forEach(function (text) { if (touches(box, text.getBBox(), 4)) score += 10; });
    const hitsCurve = samples.some(function (point) {
      return point.x > box.x - 3 && point.x < box.x + box.width + 3 &&
        point.y > box.y - 3 && point.y < box.y + box.height + 3;
    });
    if (hitsCurve) score += 5;
    if (targetY > box.y - 3 && targetY < box.y + box.height + 3) score += 2;
    return score;
  }
  // spots: [x, y, anchor] in order of preference. An anchor of "fit" centers the
  // label on x but slides it sideways to stay inside the chart, so a label is
  // never cut off at the edge: it's tried after the others, above and below.
  function placeText(label, spots, keepTrying, keepClear) {
    label.setAttribute("text-anchor", "start");
    const labelWidth = label.getBBox().width;
    let best = null;
    spots.forEach(function (spot) {
      if (spot[2] === "fit") {
        const left = Math.max(0, Math.min(width - labelWidth, spot[0] - labelWidth / 2));
        spot = [left, spot[1], "start"];
      }
      label.setAttribute("x", spot[0]);
      label.setAttribute("y", spot[1]);
      label.setAttribute("text-anchor", spot[2]);
      const box = label.getBBox();
      if (!allowed(box, keepClear)) return;
      const score = conflicts(box);
      if (!best || score < best.score) best = { spot: spot, score: score };
    });
    if (!best) {
      if (!keepTrying) label.setAttribute("display", "none");
      return false;
    }
    label.setAttribute("x", best.spot[0]);
    label.setAttribute("y", best.spot[1]);
    label.setAttribute("text-anchor", best.spot[2]);
    placed.push(label.getBBox());
    return true;
  }

  // Now: a glowing red dot at the current hours.
  const dotX = px(total);
  const dotY = py(value(total));
  const dot = svgElement(svg, "g", { class: "rate-now" });
  svgElement(dot, "circle", { class: "rate-halo", cx: dotX, cy: dotY, r: 14 });
  svgElement(dot, "circle", { class: "rate-dot", cx: dotX, cy: dotY, r: 7 });
  marks.push({ x: dotX - 14, y: dotY - 14, width: 28, height: 28 });

  // Where the curve meets the target: the same hours as "runs out".
  let cross = null;
  if (net > 0 && offer.hoursCovered >= x0 && offer.hoursCovered <= x1) {
    cross = px(offer.hoursCovered);
    svgElement(svg, "circle", { class: "rate-cross", cx: cross, cy: targetY, r: 3.5 });
    marks.push({ x: cross - 4, y: targetY - 4, width: 8, height: 8 });
  }

  const nowLabel = svgElement(svg, "text", { class: "rate-label rate-now-label" },
    calc.formatNumber(total) + "h → " + calc.formatMoney(value(total)) + "/hr after expenses");
  avoidTargetBand = true;
  placeText(nowLabel, [
    [dotX + 14, dotY + 28, "start"], [dotX + 18, dotY - 18, "start"],
    [dotX - 14, dotY + 28, "end"], [dotX - 18, dotY - 18, "end"],
    [dotX, dotY + 30, "middle"], [dotX, dotY - 22, "middle"],
    [dotX - 18, dotY - 34, "end"], [dotX + 18, dotY - 34, "start"],
    [dotX, dotY - 38, "middle"], [dotX, dotY + 44, "middle"],
    [dotX, dotY - 22, "fit"], [dotX, dotY + 30, "fit"],
    [dotX, dotY - 38, "fit"], [dotX, dotY + 44, "fit"],
  ]);

  avoidTargetBand = false;
  // The target's label comes next, and is never hidden: right or left end of
  // the line, above or below it, then the chart's left edge (over the y labels'
  // column). If the full label fits nowhere, the short "target" tries the same
  // spots, but only ones that leave the y axis's "$25" showing: the target's
  // value always shows somewhere. Failing that, the full label slides along the
  // line, above and below it, to any spot that's clear.
  const targetLabel = svgElement(svg, "text", { class: "rate-label rate-target-label" },
    "your target " + calc.formatPrice(r.rate) + "/hr");
  const targetSpots = [
    [width - pad.right, targetY - 8, "end"], [pad.left + 4, targetY - 8, "start"],
    [width - pad.right, targetY + 16, "end"], [pad.left + 4, targetY + 16, "start"],
    [width - pad.right, targetY - 24, "end"], [pad.left + 4, targetY - 24, "start"],
    [width - pad.right, targetY + 32, "end"], [pad.left + 4, targetY + 32, "start"],
    [0, targetY - 8, "start"], [0, targetY + 16, "start"],
  ];
  if (!placeText(targetLabel, targetSpots, true)) {
    const fullText = targetLabel.textContent;
    targetLabel.textContent = "target";
    if (!placeText(targetLabel, targetSpots, true, [yTexts[0].getBBox()])) {
      targetLabel.textContent = fullText;
      const slides = [];
      [-8, 16, -24, 32].forEach(function (dy) {
        for (let x = 0; x <= width; x += 4) slides.push([x, targetY + dy, "start"]);
      });
      placeText(targetLabel, slides);
    }
  }

  if (cross !== null) {
    const crossLabel = svgElement(svg, "text", { class: "rate-label rate-cross-label" },
      "at " + calc.formatNumber(offer.hoursCovered) + "h you hit " + calc.formatPrice(r.rate));
    placeText(crossLabel, [
      [cross - 8, targetY - 8, "end"], [cross + 8, targetY - 8, "start"],
      [cross - 8, targetY + 16, "end"], [cross + 8, targetY + 16, "start"],
      [cross - 8, targetY - 24, "end"], [cross - 8, targetY + 32, "end"],
      [cross, targetY - 24, "middle"], [cross, targetY + 32, "middle"],
      [cross, targetY - 8, "fit"], [cross, targetY + 16, "fit"],
      [cross, targetY - 24, "fit"], [cross, targetY + 32, "fit"],
    ]);
  }

  // Axis labels last: any that a label covers is hidden.
  svg.querySelectorAll(".rate-tick").forEach(function (text) {
    const box = text.getBBox();
    if (placed.some(function (other) { return touches(box, other, 2); })) text.setAttribute("display", "none");
  });

  // Live change: the curve and dots move from their old places to the new ones.
  const geometry = { samples: samples, dot: { x: dotX, y: dotY }, cross: cross };
  if (morph && rateGeometry && canMove()) {
    const from = rateGeometry;
    const dotParts = dot.querySelectorAll("circle");
    const crossDot = svg.querySelector(".rate-cross");
    tween(MORPH_MS, function (t) {
      curve.setAttribute("d", samples.map(function (point, i) {
        const old = from.samples[i] || point;
        return (i ? "L" : "M") + mix(old.x, point.x, t).toFixed(1) + " " + mix(old.y, point.y, t).toFixed(1);
      }).join(" "));
      dotParts.forEach(function (circle) {
        circle.setAttribute("cx", mix(from.dot.x, dotX, t));
        circle.setAttribute("cy", mix(from.dot.y, dotY, t));
      });
      if (crossDot && from.cross !== null) crossDot.setAttribute("cx", mix(from.cross, cross, t));
    });
  }
  rateGeometry = geometry;

  // What scrubbing needs: the hours range and where things go.
  rateView = { r: r, svg: svg, x0: x0, x1: x1, px: px, py: py, value: value, width: width, pad: pad,
    height: height };
  plot.setAttribute("aria-valuemin", x0);
  plot.setAttribute("aria-valuemax", x1);
  if (scrubHours === null || scrubHours < x0 || scrubHours > x1) scrubHours = Math.round(total * 2) / 2;
  if (scrubShown) drawScrub();
  else setScrubValue();
}

// Scrubbing the rate chart: a line, a dot on the curve, and "14h → $12.86/hr",
// snapping to half hours. Pointer: hover or drag. Keyboard: the chart is a
// slider; left and right move half an hour, Escape hides the line.
let rateView = null;
let rateGeometry = null;
let scrubHours = null;
let scrubShown = false;

function setScrubValue() {
  const plot = byId("rate-plot");
  if (!rateView || scrubHours === null) return;
  const pay = rateView.value(scrubHours);
  plot.setAttribute("aria-valuenow", scrubHours);
  plot.setAttribute("aria-valuetext", "At " + hoursInWords(scrubHours) + ", the offer pays " +
    calc.formatMoney(pay) + " an hour after expenses.");
}

function drawScrub() {
  const view = rateView;
  if (!view) return;
  const old = view.svg.querySelector(".rate-scrub");
  if (old) old.remove();
  setScrubValue();
  if (!scrubShown) return;
  const x = view.px(scrubHours);
  const pay = view.value(scrubHours);
  const y = view.py(pay);
  const group = svgElement(view.svg, "g", { class: "rate-scrub" });
  svgElement(group, "line", { class: "rate-scrub-line", x1: x, x2: x, y1: view.pad.top, y2: view.height - view.pad.bottom });
  svgElement(group, "circle", { class: "rate-scrub-dot", cx: x, cy: y, r: 5 });
  const label = svgElement(group, "text", { class: "rate-label rate-scrub-label", y: Math.max(view.pad.top + 10, y - 14) },
    calc.formatNumber(scrubHours) + "h → " + calc.formatMoney(pay) + "/hr");
  // Right of the line, or left of it near the right edge.
  label.setAttribute("x", x + 10);
  label.setAttribute("text-anchor", "start");
  if (x + 10 + label.getBBox().width > view.width) {
    label.setAttribute("x", x - 10);
    label.setAttribute("text-anchor", "end");
  }
}

function scrubTo(hours) {
  if (!rateView) return;
  scrubHours = Math.max(rateView.x0, Math.min(rateView.x1, Math.round(hours * 2) / 2));
  scrubShown = true;
  drawScrub();
}

function hideScrub() {
  scrubShown = false;
  drawScrub();
}

function hoursAtPointer(event) {
  const view = rateView;
  const box = byId("rate-plot").getBoundingClientRect();
  const x = event.clientX - box.left;
  return view.x0 + ((x - view.pad.left) / (view.width - view.pad.left - view.pad.right)) * (view.x1 - view.x0);
}

// "1 page", "2 concepts"
function countOf(amount, singular, plural) {
  return calc.formatNumber(amount) + " " + (amount === 1 ? singular : plural);
}

function renderReceipt(r, values) {
  const rows = [
    ["Production",
      calc.formatHours(values.setupHours) + " + " + countOf(values.count, job().item, job().items) +
        " x " + calc.formatHours(values.itemHours),
      calc.formatHours(r.hours.production)],
    ["Communication", "", calc.formatHours(r.hours.communication)],
    ["Revisions",
      countOf(values.rounds, "round", "rounds") + " x " + calc.formatHours(values.roundHours),
      calc.formatHours(r.hours.revisions)],
    ["Delivery", "", calc.formatHours(r.hours.delivery)],
    ["Total hours", "", calc.formatHours(r.hours.total), "sum"],
    ["Your time",
      calc.formatHours(r.hours.total) + " x " + calc.formatPrice(r.rate) + "/hr",
      calc.formatMoney(r.timeCost)],
    ["Expenses", "", calc.formatMoney(r.expenses)],
    ["Subtotal", "", calc.formatMoney(r.subtotal), "sum"],
    ["Rounded up to the nearest $5", "", "+" + calc.formatMoney(r.rounding)],
    ["Your estimate", "", calc.formatWholeMoney(r.estimate), "total"],
  ];

  byId("math-estimate").textContent = calc.formatWholeMoney(r.estimate);

  const body = byId("receipt-rows");
  body.textContent = "";
  rows.forEach(function (row) {
    const tr = document.createElement("tr");
    tr.setAttribute("role", "row");
    if (row[3]) tr.className = row[3];
    const th = document.createElement("th");
    th.scope = "row";
    th.setAttribute("role", "rowheader");
    th.textContent = row[0];
    const amount = document.createElement("td");
    amount.setAttribute("role", "cell");
    amount.textContent = row[2];
    // The final row has no math, so its larger label can use that column too.
    if (row[3] === "total") {
      th.colSpan = 2;
      tr.append(th, amount);
    } else {
      const math = document.createElement("td");
      math.setAttribute("role", "cell");
      math.textContent = row[1];
      tr.append(th, math, amount);
    }
    body.appendChild(tr);
  });
}

function renderQuote(r, quoteError) {
  const line = byId("quote-result");
  const followsOffer = r.quote.defaultsTo === "offer";
  byId("quote").placeholder = calc.groupDigits(String(followsOffer ? r.offer.amount : r.estimate));
  byId("quote-hint").textContent = "Leave blank to use " + (followsOffer ? "their offer" : "your estimate") +
    ". This won't change your estimate or your target.";
  show(line, !quoteError);
  if (quoteError) return;

  const price = calc.formatPrice(r.quote.amount);
  // With a way to close the gap picked, the price is for that option's hours.
  const option = pickedOption();
  const hours = option ? option.hours : r.hours.total;
  let text = "At " + price + ", you'd earn " + calc.formatMoney(r.quote.amount / hours) +
    "/hr before expenses and " + calc.formatMoney((r.quote.amount - r.expenses) / hours) + "/hr after.";
  const difference = r.quote.differenceFromEstimate;
  if (r.quote.isCustom && difference !== 0) {
    text += " That's " + calc.formatPrice(Math.abs(difference)) +
      (difference < 0 ? " below" : " above") + " your estimate.";
  }
  line.textContent = text;
}

// 05 Ways to close the gap. With an offer below the estimate, up to three
// options (calc.gapOptions). The picked one sets the price to send, the reply,
// the quote line, and the image; it never changes the inputs or the charts.
// gapChoice: "estimate" (the default), "trade", "offer", or "" when the person
// typed their own price. gapQuoteWritten is the price text the pick last put
// in the field, so typing something else can be told apart.
let gapChoice = "estimate";
let gapQuoteWritten = null;
// The options on screen now.
let gapList = [];

const GAP_COPY = {
  estimate: { tag: "Your estimate", name: function () { return "Raise your price"; } },
  trade: { tag: "Middle ground", name: function () { return "Trade work for price"; } },
  offer: { tag: "Their budget", name: function (offer) { return "Take their " + calc.formatPrice(offer); } },
};

function pickedOption() {
  if (!gapChoice || gapChoice === "estimate") return null;
  return gapList.filter(function (option) { return option.type === gapChoice; })[0] || null;
}

// Puts the pick's price in the field. Returns true if the field changed.
function applyGapChoice(checked) {
  const field = byId("quote");
  // Typing a different price clears the pick.
  if (gapChoice && !loadingValues && gapQuoteWritten !== null &&
      field.value.replace(/,/g, "") !== gapQuoteWritten.replace(/,/g, "")) {
    gapChoice = "";
  }
  const blocking = Object.keys(checked.errors).some(function (name) { return name !== "quote"; });
  gapList = blocking ? [] : calc.gapOptions(checked.values);
  if (!gapChoice) {
    gapQuoteWritten = null;
    return false;
  }
  // A picked type that's gone falls back to option 1, which is a blank price.
  if (!gapList.some(function (option) { return option.type === gapChoice; })) gapChoice = "estimate";
  const option = pickedOption();
  const text = option ? calc.groupDigits(String(option.price)) : "";
  gapQuoteWritten = text;
  if (field.value === text) return false;
  field.value = text;
  return true;
}

function pickGap(type, focus) {
  gapChoice = type;
  gapQuoteWritten = null;
  clearTimeout(commitTimer);
  update(true);
  const option = gapList.filter(function (o) { return o.type === type; })[0];
  if (option) announce("Your reply now uses " + calc.formatPrice(option.price) + ".");
  if (focus) {
    const card = byId("gap-options").querySelector('[data-type="' + type + '"]');
    if (card) card.focus();
  }
}

// "2 pages · 2 rounds of changes"
function scopeWords(count, rounds) {
  const job = calc.JOBS[currentJob()];
  return calc.countWords(count, job.item, job.items) + " · " + calc.countWords(rounds, "round", "rounds") + " of changes";
}

function renderGapOptions(r, values) {
  const section = byId("gap-section");
  const options = gapList;
  show(section, options.length > 0);
  if (!options.length) return;
  byId("gap-title").textContent = "Ways to close the " + calc.formatPrice(r.offer.gap) + " gap";
  const job = calc.JOBS[currentJob()];
  const fullHours = r.hours.total;
  const cards = ensureChildren(byId("gap-options"), options.length, function () {
    const card = document.createElement("div");
    card.className = "gap-card";
    card.setAttribute("role", "radio");
    card.innerHTML =
      '<div class="gap-top"><span class="gap-tag"></span><span class="gap-chip"></span></div>' +
      '<p class="gap-name"></p>' +
      '<p class="gap-price"><span class="gap-amount"></span><span class="gap-rate"></span></p>' +
      '<p class="gap-scope"></p>' +
      '<dl class="gap-levers"><div class="gap-lever"><dt>Price</dt><dd class="gap-price-change"></dd></div>' +
      '<div class="gap-lever"><dt>Work</dt><dd class="gap-work-change"></dd></div></dl>' +
      '<div class="gap-bar" aria-hidden="true"><span class="gap-paid"></span><span class="gap-unpaid"></span><span class="gap-saved"></span></div>' +
      '<div class="gap-bar-labels"><span class="gap-work"></span><span class="gap-saved-label"></span></div>' +
      '<div class="gap-use-wrap"><span class="gap-use"></span></div>';
    return card;
  });
  const anyPicked = options.some(function (option) { return option.type === gapChoice; });
  options.forEach(function (option, i) {
    const card = cards[i];
    const copy = GAP_COPY[option.type];
    const picked = option.type === gapChoice;
    const name = copy.name(r.offer.amount);
    card.dataset.type = option.type;
    card.setAttribute("aria-checked", String(picked));
    card.tabIndex = picked || (!anyPicked && i === 0) ? 0 : -1;
    const q = function (sel) { return card.querySelector(sel); };
    q(".gap-tag").textContent = copy.tag;
    const chip = q(".gap-chip");
    chip.classList.toggle("meets", option.meetsTarget);
    chip.textContent = option.meetsTarget ? "meets your target" : calc.formatMoney(option.underBy) + "/hr under";
    q(".gap-name").textContent = name;
    q(".gap-amount").textContent = calc.formatPrice(option.price);
    q(".gap-rate").textContent = calc.formatMoney(option.rateAfter) + "/hr";
    q(".gap-scope").textContent = scopeWords(option.count, option.rounds);
    const priceText = option.priceChange > 0 ? "+" + calc.formatPrice(option.priceChange) : "same price";
    const workText = gapWorkWords(option, job);
    const priceCell = q(".gap-price-change");
    priceCell.textContent = priceText;
    priceCell.classList.toggle("changed", option.priceChange > 0);
    const workCell = q(".gap-work-change");
    workCell.textContent = workText;
    workCell.classList.toggle("changed", Boolean(option.workChange));
    // The work bar, on one scale for every card: the current job's hours.
    const unpaid = option.hours - option.covered;
    const saved = Math.max(0, fullHours - option.hours);
    [[".gap-paid", option.covered], [".gap-unpaid", unpaid], [".gap-saved", saved]].forEach(function (part) {
      const el = q(part[0]);
      el.style.flexGrow = part[1];
      el.hidden = !(part[1] > 1e-9);
    });
    q(".gap-work").textContent = calc.formatHours(option.hours) + " of work, " + calc.formatNumber(unpaid) + " unpaid";
    q(".gap-saved-label").textContent = saved > 1e-9 ? calc.formatHours(saved) + " saved" : "";
    q(".gap-use").innerHTML = picked
      ? '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false"><path d="M2.5 7.5 5.5 10.5 11.5 3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>In your reply'
      : "Use in reply";
    // The radio's name says what it picks; its children are presentational.
    card.setAttribute("aria-label", name + ": " + calc.formatPrice(option.price) + ", " +
      calc.formatMoney(option.rateAfter) + " an hour after expenses, " +
      (option.meetsTarget ? "meets your target" : calc.formatMoney(option.underBy) + " an hour under your target") +
      ". " + scopeWords(option.count, option.rounds).replace(" · ", ", ") + ".");
  });

  // No middle ground: their offer already pays the target for the smaller job,
  // so a trade card would repeat "Take their $600". Say why it's missing.
  const take = options.filter(function (option) { return option.type === "offer"; })[0];
  const noTrade = !options.some(function (option) { return option.type === "trade"; });
  const explain = noTrade && take && take.workChange && take.meetsTarget;
  const note = byId("gap-note");
  show(note, Boolean(explain));
  note.textContent = explain ? "There's no middle ground here: their " + calc.formatPrice(r.offer.amount) +
    " already pays your target for " + gapWorkWords(take, job) + "." : "";
}

// The Work row's words: "same work", "1 round less", "1 page less".
function gapWorkWords(option, job) {
  if (!option.workChange) return "same work";
  return option.workChange.by + " " + (option.workChange.kind === "round" ? "round" : job.item) + " less";
}

// Extra rounds of changes: "$40 each", "1.5 hrs at $25/hr, rounded up".
function renderExtraRounds(values) {
  const extra = calc.extraRoundPrice(values);
  show(byId("extra-rounds"), Boolean(extra));
  if (!extra) return;
  byId("extra-rounds-value").textContent = calc.formatPrice(extra.price) + " each";
  byId("extra-rounds-note").textContent = calc.formatHours(extra.hours) + " at " + calc.formatPrice(extra.rate) +
    "/hr" + (extra.rounded ? ", rounded up" : "");
}

// The image uses the picked option's price, rounds, and hours.
function imageResult() {
  const option = pickedOption();
  if (!option) return { r: lastResult, values: lastValues };
  const values = Object.assign({}, lastValues, { count: option.count, rounds: option.rounds, quote: option.price });
  return { r: calc.calculate(values), values: values };
}

// Reply

// The draft from CLAUDE.md, using the quote if there is one, or the estimate.
// "Hi! Thanks for reaching out. For a menu with 2 pages and 2 rounds of changes, my price is $310."
function buildReply(r, values) {
  const extra = calc.extraRoundPrice(values);
  const option = pickedOption();
  const offer = r.offer ? r.offer.amount : null;
  const extras = { extraRoundPrice: extra ? extra.price : null, acceptsOffer: Boolean(option) && option.type === "offer" };
  if (option) return calc.replyText(currentJob(), option.count, option.rounds, option.price, offer, r.estimate, extras);
  return calc.replyText(currentJob(), values.count, values.rounds, r.quote.amount, offer, r.estimate, extras);
}

// Once the person edits the reply, it's never overwritten. If the numbers
// change after that, a notice offers to update the draft instead.
let currentDraft = "";
let draftWhenEdited = null;

function renderReply(r, values) {
  currentDraft = buildReply(r, values);
  const reply = byId("reply");
  if (draftWhenEdited === null) {
    reply.value = currentDraft;
  }
  show(byId("reply-notice"), draftWhenEdited !== null && draftWhenEdited !== currentDraft);
}

function onReplyEdit() {
  if (draftWhenEdited === null) draftWhenEdited = currentDraft;
  // Typing it back to exactly the draft counts as not edited.
  if (byId("reply").value === currentDraft) draftWhenEdited = null;
  show(byId("reply-notice"), draftWhenEdited !== null && draftWhenEdited !== currentDraft);
  autosave();
}

function updateDraft() {
  draftWhenEdited = null;
  byId("reply").value = currentDraft;
  show(byId("reply-notice"), false);
  byId("reply").focus();
  autosave();
}

// Screen 1 extras: the work total and the button's live preview

// The tally panel: the total, the hours usually forgotten, and one bar of all groups.
let lastHours = null;

function renderTotals(hours) {
  lastHours = hours;
  byId("total-hours").textContent = hours ? calc.formatNumber(hours.total) : "";
  byId("total-unit").textContent = hours ? (isOne(hours.total) ? "hr" : "hrs") : "";
  const forgotten = byId("tally-forgotten");
  forgotten.textContent = hours ? calc.formatHours(hours.total - hours.production) + " usually forgotten" : "";
  show(forgotten, Boolean(hours));
  layoutTally(hours);
}

// Solid for production, stripes for the groups people forget, with "6h" labels.
function layoutTally(hours) {
  const bar = byId("tally-bar");
  if (!hours || hours.total <= 0) {
    bar.textContent = "";
    return;
  }
  if (!bar.firstElementChild) {
    bar.innerHTML = '<div class="tally-segments"></div><div class="tally-labels"></div>';
  }
  const width = bar.clientWidth;
  if (!width) return;
  const groups = WORK_GROUPS.filter(function (group) { return hours[group] > 1e-9; });
  const usable = width - (groups.length - 1) * TALLY_GAP;
  const segments = ensureChildren(bar.firstElementChild, groups.length, function () {
    return document.createElement("span");
  });
  const labels = ensureChildren(bar.lastElementChild, groups.length, function () {
    return document.createElement("span");
  });
  let x = 0;
  const items = [];
  groups.forEach(function (group, i) {
    const w = (hours[group] / hours.total) * usable;
    segments[i].className = "tally-segment" + (group === "production" ? "" : " forgotten");
    segments[i].style.width = w + "px";
    labels[i].className = "tally-label";
    labels[i].textContent = calc.formatNumber(hours[group]) + "h";
    items.push({ element: labels[i], left: x });
    x += w + TALLY_GAP;
  });
  placeLabels(items, width);
}

const TALLY_GAP = 2;

// Each work row's own hours, drawn as a small bar.
const WORK_ROWS = [
  { id: "setup-hours", hours: function (v) { return v.setupHours; } },
  { id: "item-hours", hours: function (v) { return v.count * v.itemHours; } },
  { id: "communication-hours", hours: function (v) { return v.communicationHours; } },
  { id: "round-hours", hours: function (v) { return v.rounds * v.roundHours; } },
  { id: "delivery-hours", hours: function (v) { return v.deliveryHours; } },
];

// 25px per hour, narrower when one row would pass 150px, so every row shares one scale.
const ROW_BAR_PER_HOUR = 25;
const ROW_BAR_MAX = 150;

function renderRowBars(values) {
  const hours = values ? WORK_ROWS.map(function (row) { return row.hours(values); }) : [];
  const most = Math.max.apply(null, hours.concat([0]));
  const perHour = most > 0 ? Math.min(ROW_BAR_PER_HOUR, ROW_BAR_MAX / most) : ROW_BAR_PER_HOUR;
  WORK_ROWS.forEach(function (row, i) {
    const bar = byId("bar-" + row.id);
    const amount = values ? hours[i] : 0;
    bar.style.width = (amount * perHour) + "px";
    bar.classList.toggle("empty", !(amount > 0));
  });
}

// "11.5 hrs of work for $200", or "11.5 hrs of work at $25/hr" with no offer.
// On a phone the button is the bottom bar: a shorter line ("11.5 hrs · $200")
// and a thin bar of the hours under it. With errors it says how many fields
// to fix; with 0 hours it asks for hours. Either way it stays ink.
// Writes text only when it changed. Rewriting the button's text while a
// finger presses it makes Safari drop the tap: leaving a field re-renders the
// button, so the first tap on "Check the offer" did nothing.
function setText(element, text) {
  if (element.textContent !== text) element.textContent = text;
}

function renderCheckButton(values, hours, errorCount) {
  const hasOffer = values.hasOffer;
  setText(byId("check-title"), hasOffer ? "Check the offer" : "Get my estimate");
  byId("check-offer").classList.toggle("has-errors", Boolean(errorCount));
  let message = "";
  if (errorCount) {
    message = "Fix " + errorCount + (errorCount === 1 ? " field" : " fields") + " to continue";
  } else if (hours && !(hours.total > 0)) {
    message = hasOffer ? "Add hours to check the offer" : "Add hours to get your estimate";
  }
  show(byId("check-preview"), Boolean(message || hours));
  show(byId("check-hours"), Boolean(hours) && !message);
  if (message) {
    setText(byId("preview-long"), message);
    setText(byId("preview-short"), message);
    return;
  }
  if (!hours) return;
  const total = calc.formatHours(hours.total);
  setText(byId("preview-long"), total + " of work " + (hasOffer
    ? "for " + calc.formatPrice(values.offer)
    : "at " + calc.formatPrice(values.rate) + "/hr"));
  setText(byId("preview-short"), hasOffer
    ? total + " · " + calc.formatPrice(values.offer)
    : total + " at " + calc.formatPrice(values.rate) + "/hr");

  // Solid for production, stripes for the rest. Widths share the space by hours.
  const groups = WORK_GROUPS.filter(function (group) { return hours[group] > 1e-9; });
  const segments = ensureChildren(byId("check-hours"), groups.length, function () {
    return document.createElement("span");
  });
  groups.forEach(function (group, i) {
    segments[i].className = "check-segment" + (group === "production" ? "" : " forgotten");
    segments[i].style.flexGrow = hours[group];
  });
}

// Control bar: the item count, rounds, offer, and rate on screen 2 are the same values
// as on screen 1. Typing in either place updates the other.

const mirrors = Array.prototype.slice.call(document.querySelectorAll("[data-mirror]"));

// Copies screen 1's values into the bar, and shows any error right under
// the bar field (icon plus message), linked with aria-describedby.
function syncMirrors(errors) {
  mirrors.forEach(function (mirror) {
    const name = mirror.dataset.mirror;
    const source = byId(name);
    if (document.activeElement !== mirror) mirror.value = source.value;

    const errorId = mirror.id + "-error";
    let error = byId(errorId);
    const message = shownErrors[name] ? errors[name] : "";
    if (message) {
      if (!error) {
        error = document.createElement("p");
        error.className = "bar-error";
        error.id = errorId;
        error.innerHTML = ALERT_ICON + '<span class="error-text"></span>';
        mirror.closest(".bar-field, .bar-stepper").appendChild(error);
      }
      error.querySelector(".error-text").textContent = message;
      mirror.setAttribute("aria-invalid", "true");
      mirror.setAttribute("aria-describedby", errorId);
    } else {
      if (error) error.remove();
      mirror.removeAttribute("aria-invalid");
      mirror.removeAttribute("aria-describedby");
    }
  });
}

// Your price: "Use my estimate" clears the field, so the price follows the
// estimate again (and keeps following it when the numbers change).
// When a blank price follows their offer (it's at or above the estimate), the
// estimate is typed in instead.
function useEstimate() {
  if (gapList.length) {
    pickGap("estimate", false);
    return;
  }
  const followsOffer = lastResult && lastResult.quote.defaultsTo === "offer";
  byId("quote").value = followsOffer ? calc.groupDigits(String(lastResult.estimate)) : "";
  // Typing the estimate over their offer is a price of their own; a blank one follows.
  gapChoice = followsOffer ? "" : "estimate";
  gapQuoteWritten = followsOffer ? null : "";
  clearTimeout(commitTimer);
  update(true);
}

// Copy reply: copies the text and says so for a few seconds. If the browser
// won't allow it, the text is selected so it can be copied by hand.
const COPIED_MESSAGE_MS = 3000;
let copiedTimer = null;

function setCopyStatus(text) {
  const status = byId("copy-status");
  // Clearing first makes screen readers announce the message again on a repeat copy.
  status.textContent = "";
  setTimeout(function () { status.textContent = text; }, 50);
}

function copyReply() {
  const reply = byId("reply");
  clearTimeout(copiedTimer);

  function failed() {
    reply.focus();
    reply.select();
    setCopyStatus("Couldn't copy. Select the text and copy it yourself.");
  }

  if (!navigator.clipboard || !navigator.clipboard.writeText) {
    failed();
    return;
  }
  navigator.clipboard.writeText(reply.value).then(function () {
    setCopyStatus("Copied to clipboard.");
    copiedTimer = setTimeout(function () { byId("copy-status").textContent = ""; }, COPIED_MESSAGE_MS);
  }, failed);
}

// Which parts of the result are visible: the full result, "add hours," or "fix errors."
function showResultState(state) {
  show(byId("result-summary"), state === "result");
  show(byId("metrics"), state === "result");
  show(byId("hours-chart"), state === "result");
  show(byId("receipt-section"), state === "result");
  show(byId("empty-state"), state === "no-hours");
  show(byId("error-state"), state === "errors");
  // The price and reply are made from the result, so without one they hide
  // instead of showing old numbers.
  show(document.querySelector(".results-pair"), state === "result");
  if (state !== "result") {
    show(byId("offer-chart"), false);
    show(byId("quote-result"), false);
    show(byId("gap-section"), false);
  }
}

// On screen 2 the fields themselves are out of sight, so the "fix errors" line
// also says what's wrong.
function renderErrorState(errors) {
  const messages = Object.keys(shownErrors)
    .filter(function (name) { return name !== "quote"; })
    .map(function (name) { return errors[name]; });
  byId("error-state").textContent = "Fix the fields with errors to see your result." +
    (messages.length ? " " + messages.join(" ") : "");
}

// The job: five choices in a segmented control. Each names its item ("concepts") and setup row,
// and brings example numbers. The math is the same for all of them.

function currentField() {
  return document.querySelector('input[name="field"]:checked').value;
}

// Changing the field shows its jobs and picks the first one, then works like
// switching jobs (including the replace-numbers question).
function switchField() {
  byId("job-" + calc.WORK_FIELDS[currentField()].jobs[0]).checked = true;
  switchJob();
}

function currentJob() {
  return document.querySelector('input[name="job"]:checked').value;
}

function job() {
  return calc.JOBS[currentJob()];
}

function upperFirst(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Puts the job's names on every label, button, and header that mentions it.
function renderJob() {
  const j = job();
  const field = calc.WORK_FIELDS[currentField()];
  byId("count-label").textContent = j.countLabel;
  byId("bar-count-label").textContent = j.countLabel;
  byId("steppers-items").textContent = j.countLabel;
  byId("setup-label").textContent = j.setup;
  byId("item-label").textContent = j.perItem;
  byId("delivery-label").textContent = j.delivery;
  byId("expenses-hint").textContent = field.expensesHint;

  // Only this field's jobs show. Hidden radios also drop out of arrow-key order.
  document.querySelectorAll('input[name="job"]').forEach(function (radio) {
    const inField = field.jobs.indexOf(radio.value) !== -1;
    radio.hidden = !inField;
    radio.nextElementSibling.hidden = !inField;
  });
  document.querySelectorAll('button[data-target="count"]').forEach(function (button) {
    button.setAttribute("aria-label",
      (button.dataset.step === "1" ? "One more " : "One less ") + j.item);
  });

  showSelectedJobPill();

  // "Fewer pages may not save time…" only makes sense for the menu.
  const isMenu = currentJob() === "menu";
  show(byId("page-hours-hint"), isMenu);
  byId("item-hours").setAttribute("aria-describedby",
    "unit-item-hours" + (isMenu ? " page-hours-hint" : ""));
}

// On a phone the job pills scroll sideways. The selected pill scrolls fully into
// view (tap, keyboard, a field tab, or a loaded project), without moving the page:
// "nearest" only scrolls what's needed. Smooth, unless reduced motion is on.
// Desktop shows every pill, so nothing happens there.
// Desktop: a pill row that wrapped onto two lines gets square-ish corners.
function markWrappedPills() {
  const row = document.querySelector(".job-choice");
  const pills = Array.prototype.filter.call(row.querySelectorAll("label"), function (label) {
    return !label.hidden;
  });
  const wrapped = !isPhone() && pills.length > 0 &&
    pills[pills.length - 1].offsetTop > pills[0].offsetTop + 1;
  row.classList.toggle("wrapped", wrapped);
}

function showSelectedJobPill() {
  markWrappedPills();
  if (!isPhone()) return;
  // The field tabs scroll the same way, since four don't fit on a phone.
  scrollRowTo(document.querySelector('input[name="field"]:checked').nextElementSibling);
  scrollRowTo(document.querySelector('input[name="job"]:checked').nextElementSibling);
}

function scrollRowTo(label) {
  if (!label.offsetParent) return;
  // Scrolls only the row, by setting its own scroll position. scrollIntoView
  // would also move the browser's Tab starting point to the label, so the first
  // Tab after load would skip the skip link and the header.
  const row = label.parentElement;
  const rowBox = row.getBoundingClientRect();
  const box = label.getBoundingClientRect();
  let left = row.scrollLeft;
  if (box.left < rowBox.left) left -= rowBox.left - box.left;
  else if (box.right > rowBox.right) left += box.right - rowBox.right;
  if (left !== row.scrollLeft) {
    row.scrollTo({ left: left, behavior: reduceMotion.matches ? "auto" : "smooth" });
  }
}

// The job whose example numbers are in the fields. Changing any of them
// (count, rounds, or hours) counts as editing. Rate, expenses, and the offer
// never change with the job.
let loadedJob = "menu";

function numbersEdited() {
  const example = calc.JOBS[loadedJob].example;
  return calc.HOURS_FIELDS.some(function (name) {
    const parsed = calc.parseNumber(byId(FIELD_IDS[name]).value, calc.FIELDS[name]);
    return parsed.value !== example[name];
  });
}

function loadExample(key) {
  const example = calc.JOBS[key].example;
  calc.HOURS_FIELDS.forEach(function (name) {
    byId(FIELD_IDS[name]).value = String(example[name]);
  });
  loadedJob = key;
}

// Switching jobs loads its numbers. If the person changed any, ask first.
// Focus stays on the job control, so arrow keys can still move between jobs.
function switchJob() {
  clearTimeout(commitTimer);
  renderJob();
  if (numbersEdited()) {
    byId("job-replace-question").textContent =
      "Replace your numbers with the " + job().name + " example?";
    show(byId("job-replace"), true);
  } else {
    show(byId("job-replace"), false);
    loadExample(currentJob());
  }
  update(true);
}

function answerReplace(replace) {
  if (replace) loadExample(currentJob());
  show(byId("job-replace"), false);
  byId("job-replace-question").textContent = "";
  document.querySelector('input[name="job"]:checked').focus();
  clearTimeout(commitTimer);
  update(true);
}

// Runs on every change: check the fields, do the math, update the page.
// commit is true when the person has left a field, paused typing, or clicked a control.
// Until then, a new error leaves the page as it was, so nothing flashes mid-typing.
function update(commit) {
  updatePage(commit);
  formatMoneyFields();
  autosave();
  if (sharedSnapshot !== null && !loadingValues && JSON.stringify(snapshot()) !== sharedSnapshot) {
    hideSharedNote();
  }
}

// Money fields show "1,000" when not focused, and "1000" while typing.
// Typing "1,000" works too: the math reads commas.
const MONEY_FIELDS = ["rate", "expenses", "offer", "quote", "bar-offer", "bar-rate"];

function formatMoneyFields() {
  MONEY_FIELDS.forEach(function (id) {
    const input = byId(id);
    if (document.activeElement === input) return;
    const grouped = calc.groupDigits(input.value);
    if (grouped !== input.value) input.value = grouped;
  });
}

function updatePage(commit) {
  let checked = calc.validateInputs(readForm(), currentJob());
  // Ways to close the gap: the pick sets the price to send, so it goes first.
  if (applyGapChoice(checked)) checked = calc.validateInputs(readForm(), currentJob());
  const errors = checked.errors;
  showErrors(errors, commit);
  syncMirrors(errors);

  // Any error outside the quote stops the math. A quote error only hides the quote line.
  const blocking = Object.keys(errors).filter(function (name) { return name !== "quote"; });
  if (blocking.length) {
    const anyShown = blocking.some(function (name) { return shownErrors[name]; });
    if (!anyShown) return;
    const hoursAreFine = calc.HOURS_FIELDS.every(function (name) { return !errors[name]; });
    if (hoursAreFine) {
      const hours = calc.workHours(checked.values);
      renderGroupTotals(hours);
      renderTotals(hours);
      renderRowBars(checked.values);
    } else {
      clearGroupTotals();
      renderTotals(null);
      renderRowBars(null);
    }
    const errorCount = blocking.filter(function (name) { return shownErrors[name]; }).length;
    renderWeeksNotes(hoursAreFine ? calc.workHours(checked.values) : null);
    renderCheckButton(checked.values, null, errorCount);
    renderErrorState(errors);
    showResultState("errors");
    return;
  }

  const r = calc.calculate(checked.values);
  renderGroupTotals(r.hours);
  renderTotals(r.hours);
  renderRowBars(checked.values);
  renderCheckButton(checked.values, r.hours, 0);
  renderWeeksNotes(r.hours);
  if (r.hasHours) showWorkError(false);
  if (!r.hasHours) {
    showResultState("no-hours");
    return;
  }

  showResultState("result");
  // A live change on screen 2 (not the first render, not the reveal): anything
  // still playing jumps to its end, then the numbers and curve tween to the new result.
  const formKey = JSON.stringify(readForm()) + currentField() + currentJob();
  const morph = currentScreen() === "results" && !document.body.classList.contains("revealing") &&
    Boolean(lastResult) && formKey !== lastFormKey;
  lastFormKey = formKey;
  const heroBefore = morph ? { kind: heroKind(lastResult), value: heroValue(lastResult) } : null;
  if (morph) finishPlays();
  lastResult = r;
  lastValues = checked.values;
  renderHero(r, checked.values, morph);
  if (heroBefore && heroBefore.kind === heroKind(r) && heroBefore.value !== heroValue(r) && canMove()) {
    countUpHero(r, heroBefore.value, MORPH_MS);
  }
  renderHoursChart(r);
  renderOfferChart(r);
  renderReceipt(r, checked.values);
  renderGapOptions(r, checked.values);
  renderExtraRounds(checked.values);
  if (!errors.quote) renderReply(r, checked.values);
  if (!errors.quote || shownErrors.quote) renderQuote(r, errors.quote);
}

// Charts measure the page, so they redraw when the size or font changes.
let lastResult = null;
let lastValues = null;
let lastFormKey = null;

function relayoutCharts() {
  markWrappedPills();
  layoutTally(lastHours);
  if (!lastResult || byId("result").hidden) return;
  fitHeroNumber();
  fitStats();
  layoutHoursChart(lastResult);
  if (showsRateChart(lastResult)) layoutRateChart(lastResult);
}

// Phone layout: below 760px, the same value as the one media query in styles.css.
const phoneQuery = window.matchMedia("(max-width: 759px)");

function isPhone() {
  return phoneQuery.matches;
}

// The hero number stays on one line and is never cut off: if it's wider than
// the panel, it shrinks to fit, like the stat numbers, at every width. "$" and
// "/hr" shrink with it. alsoFit is another value to make room for (the old
// number during a live change), so nothing is cut off mid-tween.
function fitHeroNumber(alsoFit) {
  const digits = document.querySelector(".hero-digits");
  const amount = byId("hero-amount");
  const unit = byId("hero-unit");
  digits.style.fontSize = "";
  unit.style.fontSize = "";
  const room = byId("result-summary").clientWidth;
  if (!room) return;
  const baseSize = parseFloat(getComputedStyle(digits).fontSize);
  const baseUnit = parseFloat(getComputedStyle(unit).fontSize);
  const texts = [amount.textContent];
  if (alsoFit && alsoFit !== texts[0]) texts.push(alsoFit);
  let scale = 1;
  texts.forEach(function (text) {
    amount.textContent = text;
    // Two passes, since rounding to whole pixels can leave it a hair too wide.
    let s = 1;
    for (let i = 0; i < 2 && digits.scrollWidth > room; i++) {
      s *= room / digits.scrollWidth;
      digits.style.fontSize = Math.floor(baseSize * s) + "px";
      unit.style.fontSize = Math.floor(baseUnit * s * 10) / 10 + "px";
    }
    scale = Math.min(scale, s);
    digits.style.fontSize = "";
    unit.style.fontSize = "";
  });
  amount.textContent = texts[0];
  if (scale < 1) {
    digits.style.fontSize = Math.floor(baseSize * scale) + "px";
    unit.style.fontSize = Math.floor(baseUnit * scale * 10) / 10 + "px";
  }
}

// On a phone the live controls sit in a panel right under the hero; on desktop
// they're in the header row. Moving them keeps reading and Tab order the same
// as what's on screen.
function placeControls() {
  const controls = document.querySelector(".control-bar");
  if (isPhone()) {
    document.querySelector(".hero-after").insertAdjacentElement("afterend", controls);
  } else {
    document.querySelector(".results-header").appendChild(controls);
  }
}

function onLayoutChange() {
  placeControls();
  relayoutCharts();
}

// Typing updates right away, then commits after about 1 second without typing.
const TYPING_PAUSE_MS = 1000;
let commitTimer = null;

function onType() {
  clearTimeout(commitTimer);
  update(false);
  commitTimer = setTimeout(function () { update(true); }, TYPING_PAUSE_MS);
}

function onLeaveField() {
  clearTimeout(commitTimer);
  update(true);
}

// Steppers: add or remove one, never below 0. Text that isn't a whole number counts as 0.
function stepField(button) {
  const input = byId(button.dataset.target);
  const parsed = calc.parseNumber(input.value, calc.FIELDS[input.name]);
  const current = parsed.value == null ? 0 : parsed.value;
  input.value = String(Math.max(0, current + Number(button.dataset.step)));
  clearTimeout(commitTimer);
  update(true);
}

function showOfferField() {
  const hasOffer = byId("offer-yes").checked;
  show(byId("offer-field"), hasOffer);
  show(byId("bar-offer-field"), hasOffer);
}

// Reveal: the hero number counts up from $0 (500ms, ease-out). Screen readers
// already have the final value in the hidden label, so only the visible digits move.
const COUNT_UP_MS = 700;
let countFrame = null;
let countTimer = null;

function stopCountUp() {
  if (countFrame) cancelAnimationFrame(countFrame);
  clearTimeout(countTimer);
  countFrame = null;
  countTimer = null;
}

// The digits after the "$", which has its own smaller, raised span.
function heroText(r, value) {
  const money = r.offer ? calc.formatMoney(value) : calc.formatWholeMoney(Math.round(value));
  return money.slice(1);
}

function paintHeroNumber(r, value) {
  byId("hero-amount").textContent = heroText(r, value);
}

// The number the hero shows: the estimate, the loss, or the offer per hour.
function heroValue(r) {
  return !r.offer ? r.estimate : (r.offer.belowExpenses ? r.offer.shortfall : r.offer.hourlyBefore);
}

// Which kind of number that is. A live change only tweens within the same kind.
function heroKind(r) {
  return !r.offer ? "estimate" : (r.offer.belowExpenses ? "loss" : "rate");
}

// Counts the hero up to its value: from 0 when it plays (700ms), or from the
// old value on a live change (250ms).
function countUpHero(r, from, ms) {
  stopCountUp();
  const target = heroValue(r);
  const start = from || 0;
  const duration = ms || COUNT_UP_MS;
  const started = performance.now();
  paintHeroNumber(r, start);
  // One size for the whole count, fitting both ends, then the final fit.
  fitHeroNumber(heroText(r, target));
  function frame(now) {
    const t = Math.min(1, (now - started) / duration);
    paintHeroNumber(r, mix(start, target, ease(t)));
    countFrame = t < 1 ? requestAnimationFrame(frame) : null;
    if (t === 1) {
      stopCountUp();
      fitHeroNumber();
    }
  }
  countFrame = requestAnimationFrame(frame);
  // If frames don't run (for example a background tab), still land on the value.
  countTimer = setTimeout(function () {
    stopCountUp();
    paintHeroNumber(r, target);
    fitHeroNumber();
  }, duration + 100);
}

// Screens: the calculator (screen 1 and screen 2) and the projects list.
// One at a time, no reload. The calculator holds either the unsaved draft or
// one saved project (currentId).

const SCREENS = { projects: "screen-projects", inputs: "screen-inputs", results: "result" };

function showScreen(name) {
  Object.keys(SCREENS).forEach(function (key) {
    byId(SCREENS[key]).hidden = key !== name;
    document.body.classList.toggle("on-" + key, key === name);
  });
  byId("skip-link").hidden = name !== "inputs";
  renderHeader();
  window.scrollTo(0, 0);
}

function currentScreen() {
  return Object.keys(SCREENS).filter(function (key) { return !byId(SCREENS[key]).hidden; })[0];
}

// Switching screens moves focus to the new screen's start, so screen readers
// announce it. Not on first load: then focus stays at the top of the page, so
// the first Tab reaches the skip link and the header.
let firstLoad = true;

function focusScreen(element) {
  if (!firstLoad) element.focus();
}

// The browser's Back button goes from results to inputs, with every value kept.
// Showing the results adds a history step; Back (or "Edit details") removes it.
// quiet: leave focus where it is (a shared link opening on page load).
function openResults(quiet) {
  showScreen("results");
  relayoutCharts();
  // Each block plays once as it scrolls in (see "Plays once"). During the
  // reveal, plays start when the orb lands.
  armPlays();
  if (!document.body.classList.contains("revealing")) startPlays();
  const target = ["hero-label", "empty-state", "error-state"].map(byId).filter(function (element) {
    return !element.hidden && !element.closest("[hidden]");
  })[0];
  if (target && !quiet) focusScreen(target);
}

function openInputs() {
  showScreen("inputs");
  // Screen 1 was hidden while a project loaded, so its pill row scrolls now.
  showSelectedJobPill();
  // The tally measures its width, so it draws once screen 1 is showing.
  relayoutCharts();
  focusScreen(byId("page-title"));
}

// Routes: every screen has an address, so Back works and a reload lands in the
// same place. { screen, project } where project is an id, or none for the draft.
function addressFor(state) {
  if (state.screen === "projects") return "#projects";
  if (state.project) return "#p/" + state.project + (state.screen === "results" ? "/result" : "");
  return state.screen === "results" ? "#result" : location.pathname + location.search;
}

function stateFromAddress(hash) {
  const match = /^#p\/([^/]+)(\/result)?$/.exec(hash);
  if (match) return { screen: match[2] ? "results" : "inputs", project: decodeURIComponent(match[1]) };
  if (hash === "#projects") return { screen: "projects" };
  if (hash === "#result") return { screen: "results" };
  return { screen: "inputs" };
}

function go(state, replace) {
  history[replace ? "replaceState" : "pushState"](state, "", addressFor(state));
  route(state);
}

function route(state) {
  // Leaving mid-reveal (Back, or a link) stops it, so it can't open screen 2 later.
  cancelReveal();
  closePanels();
  if (state.screen === "projects") {
    // Remember the calculation and screen we came from, for "Back to ...".
    const from = currentScreen();
    if (from === "inputs" || from === "results") returnState = { screen: from, project: currentId || undefined };
    leaveProject();
    openProjects();
    return;
  }
  if (state.project) {
    if (!projectStore.findProject(projectList, state.project)) {
      go({ screen: "inputs" }, true);
      return;
    }
    if (state.project !== currentId) openProject(state.project);
  } else if (currentId || !draftOnScreen) {
    openDraft();
  }
  if (state.screen === "results") {
    openResults();
    landOnGapSection();
  } else {
    openInputs();
  }
}

window.addEventListener("popstate", function (event) {
  if (shareLink.isShareHash(location.hash)) {
    openShareLink(location.hash, false);
    return;
  }
  route(event.state || stateFromAddress(location.hash));
});

// Saving. Projects live in one list; the unsaved calculation is a draft under
// its own key, so a refresh doesn't lose it and it never overwrites a project.

let projectList = [];
let currentId = null;
let draft = null;
// True when the calculator holds the draft (not a project, and not stale).
let draftOnScreen = false;
let lastSaved = null;
let loadingValues = false;

// localStorage itself can throw (blocked storage), so it's reached through this.
function storage() {
  try {
    return window.localStorage;
  } catch (error) {
    return { getItem: function () { throw error; }, setItem: function () { throw error; } };
  }
}

// If saving fails, the page keeps working and says so: "Couldn't save" under
// the header, and in a project "Not saved" with a "Try again" button.
let projectsUnsaved = false;

function showSaveResult(ok) {
  show(byId("save-error"), !ok);
  return ok;
}

function persist() {
  const ok = showSaveResult(projectStore.saveProjects(storage(), projectList).ok);
  projectsUnsaved = !ok;
  renderHeader();
  return ok;
}

function persistDraft() {
  return showSaveResult(projectStore.saveDraft(storage(), draft).ok);
}

function currentProject() {
  return projectStore.findProject(projectList, currentId);
}

// Everything a calculation keeps from the page.
function snapshot() {
  const raw = readForm();
  const inputs = {};
  projectStore.INPUT_NAMES.forEach(function (name) { inputs[name] = raw[name]; });
  return {
    field: currentField(),
    job: currentJob(),
    inputs: inputs,
    quote: raw.quote,
    reply: byId("reply").value,
    replyEdited: draftWhenEdited !== null,
    gapChoice: gapChoice,
  };
}

// Autosave after every change: into the open project, or into the draft.
function autosave() {
  if (loadingValues || (!currentId && !draftOnScreen)) return;
  const snap = snapshot();
  const text = JSON.stringify(snap);
  if (text === lastSaved) return;
  lastSaved = text;
  if (currentId) {
    projectList = projectStore.updateProject(projectList, currentId, snap, new Date(), true);
    persist();
  } else {
    draft = snap;
    persistDraft();
  }
}

// Puts a calculation's values into the page.
function fillCalculator(values) {
  hideSharedNote();
  loadingValues = true;
  stopCountUp();
  clearTimeout(commitTimer);

  byId("field-" + calc.fieldForJob(values.job, values.field)).checked = true;
  byId("job-" + values.job).checked = true;
  loadedJob = values.job;
  Object.keys(FIELD_IDS).forEach(function (name) {
    if (name !== "quote") byId(FIELD_IDS[name]).value = values.inputs[name];
  });
  byId(values.inputs.offerStatus === "none" ? "offer-none" : "offer-yes").checked = true;
  byId("quote").value = values.quote;
  gapChoice = typeof values.gapChoice === "string" ? values.gapChoice : (values.quote ? "" : "estimate");
  gapQuoteWritten = null;
  showWorkError(false);
  byId("reply").value = values.reply;
  currentDraft = values.reply;
  draftWhenEdited = null;
  shownErrors = {};
  show(byId("job-replace"), false);
  show(byId("reply-notice"), false);
  byId("copy-status").textContent = "";

  renderJob();
  showOfferField();
  update(true);

  // An edited reply stays as written. The notice shows only if the numbers change later.
  if (values.replyEdited) {
    draftWhenEdited = currentDraft;
    byId("reply").value = values.reply;
    show(byId("reply-notice"), false);
  }
  loadingValues = false;
  lastSaved = JSON.stringify(snapshot());
}

function openProject(id) {
  currentId = id;
  draftOnScreen = false;
  fillCalculator(currentProject());
  renderHeader();
}

function openDraft() {
  currentId = null;
  if (!draft) draft = projectStore.exampleDraft("menu");
  fillCalculator(draft);
  draftOnScreen = true;
  renderHeader();
}

function leaveProject() {
  if (currentId) draftOnScreen = false;
  currentId = null;
  lastSaved = null;
}

// "New calculation": a fresh menu example. If the unsaved one has changes,
// ask first.
let afterSave = null;

function startFresh() {
  draft = projectStore.exampleDraft("menu");
  persistDraft();
  draftOnScreen = false;
  go({ screen: "inputs" });
}

function newCalculation() {
  if (draft && !projectStore.isUntouched(draft)) {
    openDialog("start-over");
    byId("start-over-cancel").focus({ preventScroll: true });
  } else {
    startFresh();
  }
}

// "Save as project" from the start-over question: the Save dialog takes its
// place, saves the draft, then starts the new calculation. The page stays put
// underneath; the draft is loaded into the (hidden) calculator so it's what gets saved.
function saveThenStartOver() {
  const opener = dialogOpener;
  if (!draftOnScreen) openDraft();
  openSaveField(startFresh, opener);
}

// The header: project name and "Saved" in a project, "Projects 3", and the save button.

function renderHeader() {
  const screen = currentScreen();
  const inCalculator = screen === "inputs" || screen === "results";
  const project = currentProject();
  byId("crumb").hidden = !(inCalculator && project);
  if (project) {
    byId("crumb-name").textContent = project.name;
    byId("crumb-name").setAttribute("aria-label", project.name + ", rename project");
  }
  byId("projects-count").textContent = projectList.length;
  const link = byId("projects-link");
  if (screen === "projects") link.setAttribute("aria-current", "page");
  else link.removeAttribute("aria-current");

  byId("share-link").hidden = screen !== "results";

  byId("save-status").textContent = projectsUnsaved ? "Not saved" : "Saved";

  const button = byId("save-project");
  button.hidden = !inCalculator;
  button.disabled = Boolean(project) && !projectsUnsaved;
  if (project) {
    button.textContent = projectsUnsaved ? "Try again" : "Saved";
    button.removeAttribute("aria-label");
  } else {
    // On a phone only "Save" fits; the name stays "Save as project".
    button.innerHTML = '<span class="save-long">Save as project</span><span class="save-short">Save</span>';
    button.setAttribute("aria-label", "Save as project");
  }
  renderPricingCard();
}

// The four dialogs: Save as project, Start over?, Open the shared result?, and
// the link to copy by hand. One is open at a time. Focus moves without
// scrolling, so the page underneath never jumps.
const PANEL_DIALOGS = ["save-panel", "start-over", "share-question", "share-panel"];
let dialogOpener = null;

function openDialog(id, opener) {
  const from = opener || document.activeElement;
  closePanels();
  dialogOpener = from && from !== document.body ? from : null;
  byId(id).showModal();
}

function closePanels() {
  PANEL_DIALOGS.forEach(function (id) {
    if (byId(id).open) byId(id).close();
  });
  dialogOpener = null;
  pendingShare = null;
  setFieldError(byId("save-name"), "");
}

// Cancel, Close, and Escape: focus goes back to the button that opened the dialog.
function dismissDialog() {
  const opener = dialogOpener;
  afterSave = null;
  closePanels();
  if (opener && opener.isConnected && !opener.disabled && !opener.closest("[hidden]")) {
    opener.focus({ preventScroll: true });
  }
}

// "Save as project": the name, filled in and selected so typing replaces it.
// then runs after a successful save.
function openSaveField(then, opener) {
  openDialog("save-panel", opener);
  afterSave = then || null;
  const input = byId("save-name");
  input.value = projectStore.defaultProjectName(currentJob(), new Date());
  input.focus({ preventScroll: true });
  input.select();
}

function saveAsProject(event) {
  event.preventDefault();
  const input = byId("save-name");
  const error = projectStore.validateName(input.value);
  setFieldError(input, error || "");
  if (error) {
    input.focus();
    return;
  }
  const project = projectStore.createProject(input.value, snapshot(), projectStore.newProjectId(), new Date());
  const before = projectList;
  projectList = projectList.concat([project]);
  if (!persist()) {
    // Nothing was saved: no project, the work stays the unsaved calculation,
    // and "Start over" doesn't go ahead. "Couldn't save" stays.
    projectList = before;
    projectsUnsaved = false;
    afterSave = null;
    const opener = byId("save-project");
    closePanels();
    renderHeader();
    opener.focus({ preventScroll: true });
    return;
  }
  // The work now lives in the project, so the draft starts fresh.
  draft = projectStore.exampleDraft("menu");
  persistDraft();
  closePanels();

  const then = afterSave;
  afterSave = null;
  if (then) {
    then();
    return;
  }
  currentId = project.id;
  draftOnScreen = false;
  lastSaved = JSON.stringify(snapshot());
  const state = { screen: currentScreen(), project: project.id };
  history.replaceState(state, "", addressFor(state));
  renderHeader();
  byId("crumb-name").focus({ preventScroll: true });
}

// Click the project name to rename: Enter or leaving the field saves, Escape
// cancels. A blank name keeps the old one.
function startHeaderRename() {
  const input = byId("crumb-input");
  input.value = currentProject().name;
  show(byId("crumb-name"), false);
  show(input, true);
  input.focus();
  input.select();
}

function finishHeaderRename(save) {
  const input = byId("crumb-input");
  if (input.hidden) return;
  if (save) {
    const before = projectList;
    projectList = projectStore.renameProject(projectList, currentId, input.value, new Date());
    if (projectList !== before) persist();
  }
  show(input, false);
  show(byId("crumb-name"), true);
  renderHeader();
  byId("crumb-name").focus();
}

// Projects

// Where "Back to ..." on the Projects page goes: the calculation you came from.
// After a reload straight onto Projects, that's the unsaved calculation.
let returnState = { screen: "inputs" };

function backTarget() {
  if (returnState.project && !projectStore.findProject(projectList, returnState.project)) {
    return { screen: "inputs" };
  }
  return returnState;
}

function renderBackButton() {
  const project = projectStore.findProject(projectList, backTarget().project);
  byId("back-to-calc-label").textContent = "Back to " + (project ? project.name : "calculator");
}

function openProjects() {
  showScreen("projects");
  renderProjects();
  focusScreen(byId("projects-title"));
}

// Estimate and offer per hour after expenses for a row, from the saved numbers.
function projectSummary(project) {
  const raw = Object.assign({}, project.inputs, { quote: project.quote });
  const checked = calc.validateInputs(raw, project.job);
  const blocking = Object.keys(checked.errors).filter(function (name) { return name !== "quote"; });
  if (blocking.length) return { estimate: "No estimate yet", offer: "" };
  const r = calc.calculate(checked.values);
  if (!r.hasHours) return { estimate: "No estimate yet", offer: "" };
  return {
    estimate: calc.formatWholeMoney(r.estimate),
    offer: r.offer ? calc.formatMoney(r.offer.hourlyAfter) + "/hr" : "No offer yet",
  };
}

function cell(row, className, text) {
  const td = document.createElement("td");
  td.setAttribute("role", "cell");
  td.className = className;
  if (text) td.textContent = text;
  row.appendChild(td);
  return td;
}

function rowButton(parent, action, text, label, className) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className || "row-action";
  button.dataset.action = action;
  button.textContent = text;
  if (label) button.setAttribute("aria-label", label);
  parent.appendChild(button);
  return button;
}

// rowMode: { id, mode: "rename" | "delete" } for the one row being changed.
let rowMode = null;

function renderProjects() {
  const list = projectStore.sortByEdited(projectList);
  const now = new Date();
  show(byId("projects-empty"), list.length === 0);
  show(byId("project-table"), list.length > 0);
  show(byId("new-calc"), list.length > 0);
  show(byId("all-projects-title"), list.length > 0);
  renderBackButton();
  renderDashboard(list);

  const body = byId("project-rows");
  body.textContent = "";
  list.forEach(function (project) {
    const row = document.createElement("tr");
    row.setAttribute("role", "row");
    row.dataset.id = project.id;
    const summary = projectSummary(project);
    const mode = rowMode && rowMode.id === project.id ? rowMode.mode : null;

    const nameCell = document.createElement("th");
    nameCell.scope = "row";
    nameCell.setAttribute("role", "rowheader");
    nameCell.className = "project-name";
    row.appendChild(nameCell);
    if (mode === "rename") {
      const input = document.createElement("input");
      input.type = "text";
      input.className = "row-rename";
      input.maxLength = projectStore.NAME_MAX;
      input.value = project.name;
      input.setAttribute("aria-label", "Project name");
      nameCell.appendChild(input);
    } else {
      rowButton(nameCell, "open", project.name, null, "project-open");
    }

    cell(row, "project-job", calc.JOBS[project.job].name);
    cell(row, "project-estimate", summary.estimate);
    cell(row, "project-offer", summary.offer);
    cell(row, "project-edited", "Edited " + projectStore.formatEdited(project.edited, now));

    const actions = cell(row, "project-actions");
    if (mode === "delete") {
      const question = document.createElement("span");
      question.className = "delete-question";
      question.textContent = "Delete " + project.name + "? This can't be undone.";
      actions.appendChild(question);
      rowButton(actions, "confirm-delete", "Delete", null, "action-button");
      rowButton(actions, "cancel-delete", "Cancel", null, "action-button outline");
    } else {
      rowButton(actions, "edit", "Edit", "Edit " + project.name);
      rowButton(actions, "rename", "Rename", "Rename " + project.name);
      rowButton(actions, "duplicate", "Duplicate", "Duplicate " + project.name);
      rowButton(actions, "delete", "Delete", "Delete " + project.name);
    }
    body.appendChild(row);
  });
  renderHeader();
}

function rowElement(id, selector) {
  const row = byId("project-rows").querySelector('tr[data-id="' + CSS.escape(id) + '"]');
  return row ? row.querySelector(selector) : null;
}

function setRowMode(mode) {
  rowMode = mode;
  renderProjects();
}

function finishRowRename(id, save) {
  if (!rowMode || rowMode.id !== id || rowMode.mode !== "rename") return;
  if (save) {
    const before = projectList;
    projectList = projectStore.renameProject(projectList, id, rowElement(id, ".row-rename").value, new Date());
    if (projectList !== before) persist();
  }
  setRowMode(null);
  rowElement(id, ".project-open").focus();
}

function onRowClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const id = button.closest("tr").dataset.id;
  const action = button.dataset.action;

  if (action === "open") {
    // A saved project opens on its result.
    go({ screen: "results", project: id });
  } else if (action === "edit") {
    // Edit opens the same project on its inputs.
    go({ screen: "inputs", project: id });
  } else if (action === "rename") {
    setRowMode({ id: id, mode: "rename" });
    const input = rowElement(id, ".row-rename");
    input.focus();
    input.select();
  } else if (action === "duplicate") {
    const copyId = projectStore.newProjectId();
    projectList = projectStore.duplicateProject(projectList, id, copyId, new Date());
    persist();
    setRowMode(null);
    rowElement(copyId, ".project-open").focus();
  } else if (action === "delete") {
    setRowMode({ id: id, mode: "delete" });
    rowElement(id, '[data-action="cancel-delete"]').focus();
  } else if (action === "cancel-delete") {
    setRowMode(null);
    rowElement(id, '[data-action="delete"]').focus();
  } else if (action === "confirm-delete") {
    // Focus moves to the next row's name, or the previous one, or New calculation.
    const rows = Array.prototype.slice.call(byId("project-rows").children);
    const index = rows.indexOf(button.closest("tr"));
    const neighbor = rows[index + 1] || rows[index - 1];
    const nextId = neighbor ? neighbor.dataset.id : null;
    projectList = projectStore.deleteProject(projectList, id);
    persist();
    setRowMode(null);
    if (nextId) rowElement(nextId, ".project-open").focus();
    else byId("new-calc-empty").focus();
  }
}

function onRowKey(event) {
  if (!event.target.classList.contains("row-rename")) return;
  const id = event.target.closest("tr").dataset.id;
  if (event.key === "Enter") {
    event.preventDefault();
    finishRowRename(id, true);
  } else if (event.key === "Escape") {
    finishRowRename(id, false);
  }
}

// Your pricing so far: the Projects dashboard and the summary card on a saved
// result. All after expenses, like Ways to close the gap. The numbers come from
// projectStore.pricingSummary, each job rounded to whole dollars first.

const MINUS = "−";

// "$2,508", "−$5"
function dashMoney(amount) {
  return amount < 0 ? MINUS + calc.formatWholeMoney(-amount) : calc.formatWholeMoney(amount);
}

// "−$840", "+$60"
function signedMoney(amount) {
  return amount > 0 ? "+" + calc.formatWholeMoney(amount) : dashMoney(amount);
}

// "$20.00/hr", "−$0.50/hr"
function dashHourly(amount) {
  const text = calc.formatMoney(Math.abs(amount)) + "/hr";
  return amount < 0 && Math.abs(amount) >= 0.005 ? MINUS + text : text;
}

// "$20.00", "−$0.50"
function dashCents(amount) {
  const text = calc.formatMoney(Math.abs(amount));
  return amount < 0 && Math.abs(amount) >= 0.005 ? MINUS + text : text;
}

// A whole-dollar target shows no cents: "$55/hr", "$27.50/hr".
function targetHourly(rate) {
  return calc.formatPrice(rate) + "/hr";
}

function jobsText(count) {
  return count + (count === 1 ? " job" : " jobs");
}

function percentText(share) {
  return Math.round(share * 100) + "%";
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

// Hours to one decimal, so paid and unpaid add up to the total shown.
function tenths(hours) {
  return Math.round(hours * 10) / 10;
}

// "Oct 7", or "Oct 7, 2025" when it isn't this year.
function dashDate(iso, now) {
  const date = new Date(iso);
  const text = MONTHS[date.getMonth()] + " " + date.getDate();
  return date.getFullYear() === now.getFullYear() ? text : text + ", " + date.getFullYear();
}

function make(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text != null) element.textContent = text;
  return element;
}

// "Show as table" choices, kept across re-renders.
let waterfallAsTable = false;
let bulletAsTable = false;

// "Fix [project]": a one-time flag, never in history, so Back, Forward, and
// reload don't jump to the gap again.
let landOnGap = false;

function renderDashboard(list) {
  const s = projectStore.pricingSummary(list);
  show(byId("dashboard"), Boolean(s));
  show(byId("dashboard-empty"), !s && list.length > 0);
  if (!s) return;
  const now = new Date();
  renderDashHero(s, now);
  renderWaterfall(s);
  renderUnpaid(s);
  renderMet(s);
  renderFix(s);
  renderBullets(s);
}

function renderDashHero(s, now) {
  const percent = percentText(s.percent);
  const lead = byId("dash-lead");
  lead.textContent = "";
  if (s.kept >= s.targetPay) {
    lead.textContent = "You kept " + percent + " of your target pay. Your offers covered every hour.";
  } else {
    // "left to right" next to the chart, "down" when it's rows.
    lead.append("You kept " + percent + " of your target pay. Read ",
      make("span", "wide-only", "left to right"), make("span", "narrow-only", "down"),
      " to see where the other " + dashMoney(s.shortfall) + " went.");
  }
  const fix = s.biggestFix;
  let gapLine = "";
  if (s.shortfall > 0 && s.gapShare !== null) gapLine = fix.name + " is " + percentText(s.gapShare) + " of the gap.";
  else if (s.shortfall > 0 && fix) gapLine = "All of it came from " + fix.name + ".";
  byId("dash-gapline").textContent = gapLine;
  show(byId("dash-gapline"), Boolean(gapLine));

  const first = dashDate(s.firstCreated, now);
  const last = dashDate(s.lastCreated, now);
  byId("dash-meta").textContent = jobsText(s.counted) + " · " + (first === last ? first : first + " to " + last) + " · after expenses";
  const based = byId("dash-based");
  show(based, s.counted < s.total);
  based.textContent = "Based on " + s.counted + " of " + s.total + " projects. The rest need an offer or hours.";
  byId("dash-percent").textContent = percent;
}

// The waterfall's bars: target pay, one step per job (or "Other jobs"), you kept.
function waterfallBars(s) {
  const bars = [{ kind: "total", name: "Target pay", note: "your hours at target", from: 0, to: s.targetPay, value: dashMoney(s.targetPay) }];
  let level = s.targetPay;
  function step(name, amount, note) {
    bars.push({ kind: amount < 0 ? "short" : "gain", name: name, note: note, from: level, to: level + amount, value: signedMoney(amount) });
    level += amount;
  }
  s.steps.forEach(function (job) { step(job.name, job.step, job.step < 0 ? "short of target" : "over target"); });
  if (s.other) step("Other jobs (" + s.other.count + ")", s.other.step, "net of " + jobsText(s.other.count));
  bars.push({ kind: "kept", name: "You kept", note: "after expenses", from: 0, to: s.kept, value: dashMoney(s.kept) });
  return bars;
}

function renderWaterfall(s) {
  const bars = waterfallBars(s);
  // One scale: $0 and every running total.
  const levels = [0];
  bars.forEach(function (bar) { levels.push(bar.from, bar.to); });
  const low = Math.min.apply(null, levels);
  const high = Math.max.apply(null, levels);
  const range = high - low || 1;
  function at(value) { return (value - low) / range * 100; }

  const chart = byId("waterfall");
  chart.textContent = "";

  // Desktop: columns, with dashed connectors and a $0 baseline.
  const cols = make("div", "wf-cols");
  cols.style.setProperty("--wf-count", bars.length);
  const plot = make("div", "wf-plot");
  const baseline = make("span", "wf-baseline");
  baseline.style.bottom = at(0) + "%";
  plot.appendChild(baseline);
  bars.forEach(function (bar, i) {
    const column = make("div", "wf-col");
    column.style.gridColumn = String(i + 1);
    const top = Math.max(bar.from, bar.to);
    const bottom = Math.min(bar.from, bar.to);
    const shape = make("span", "wf-bar " + bar.kind);
    shape.style.bottom = at(bottom) + "%";
    shape.style.height = (at(top) - at(bottom)) + "%";
    column.appendChild(shape);
    const value = make("span", "wf-value" + (bar.kind === "total" || bar.kind === "kept" ? " total" : ""), bar.value);
    value.style.bottom = at(top) + "%";
    column.appendChild(value);
    if (i < bars.length - 1) {
      const link = make("span", "wf-link");
      link.style.bottom = at(bar.to) + "%";
      column.appendChild(link);
    }
    plot.appendChild(column);
  });
  cols.appendChild(plot);
  const labels = make("div", "wf-labels");
  bars.forEach(function (bar) {
    const label = make("div", "wf-label");
    const name = make("span", "wf-name", bar.name);
    name.title = bar.name;
    label.append(name, make("span", "wf-note", bar.note));
    labels.appendChild(label);
  });
  cols.appendChild(labels);
  chart.appendChild(cols);

  // Below 1024px: the same steps as rows.
  const rows = make("div", "wf-rows");
  bars.forEach(function (bar) {
    const row = make("div", "wf-row " + bar.kind);
    const line = make("p", "wf-row-line");
    const name = make("span", "wf-name", bar.name);
    name.title = bar.name;
    line.append(name, make("span", "wf-row-value", bar.value));
    const track = make("div", "wf-track");
    const shape = make("span", "wf-bar " + bar.kind);
    const left = at(Math.min(bar.from, bar.to));
    shape.style.left = left + "%";
    shape.style.width = (at(Math.max(bar.from, bar.to)) - left) + "%";
    track.appendChild(shape);
    row.append(line, track);
    rows.appendChild(row);
  });
  chart.appendChild(rows);

  // The written summary and the table.
  byId("waterfall-summary").textContent = bars.map(function (bar) {
    if (bar.kind === "total") return "Target pay " + bar.value + ".";
    if (bar.kind === "kept") return "You kept " + bar.value + ".";
    const amount = dashMoney(Math.abs(bar.to - bar.from));
    return bar.name + (bar.kind === "short" ? " short " : " over ") + amount + ".";
  }).join(" ");
  const body = byId("waterfall-rows");
  body.textContent = "";
  bars.forEach(function (bar) {
    const row = document.createElement("tr");
    const name = make("th", null, bar.name);
    name.scope = "row";
    row.append(name, make("td", null, bar.value));
    body.appendChild(row);
  });
  applyTableToggle("waterfall-toggle", byId("waterfall"), byId("waterfall-table"), waterfallAsTable);
}

function applyTableToggle(buttonId, chart, table, asTable) {
  show(chart, !asTable);
  show(table, asTable);
  byId(buttonId).textContent = asTable ? "Show as chart" : "Show as table";
}

function renderUnpaid(s) {
  const unpaid = tenths(s.unpaidHours);
  const paid = tenths(s.hours) - unpaid;
  byId("dash-unpaid").textContent = calc.formatNumber(unpaid);
  const tens = Math.round(s.unpaidHours / s.hours * 10);
  let line;
  if (s.unpaidHours <= 1e-9) line = "Every hour was covered.";
  else if (Math.abs(s.unpaidHours - s.hours) <= 1e-9) line = "None of your hours were covered.";
  else if (tens === 0) line = "Hours the offers did not cover. Less than 1 of every 10 hours.";
  else if (tens === 10) line = "Hours the offers did not cover. Almost every hour.";
  else line = "Hours the offers did not cover. About " + tens + " of every 10 hours.";
  byId("dash-unpaid-line").textContent = line;
  setBar(byId("dash-paid-bar"), paid);
  setBar(byId("dash-unpaid-bar"), unpaid);
  byId("dash-paid-hours").textContent = calc.formatHours(paid);
  byId("dash-unpaid-hours").textContent = calc.formatHours(unpaid);
}

// A part of a split bar; parts with nothing in them are left out, so no
// stray 2px gap shows.
function setBar(element, amount) {
  element.style.flexGrow = Math.max(0, amount);
  show(element, amount > 0);
}

function renderMet(s) {
  byId("dash-met").textContent = s.met;
  byId("dash-met-of").textContent = "of " + s.counted;
  let line;
  if (s.met === s.counted) line = "Every job paid what you asked for.";
  else if (s.met === 0) line = "No job paid what you asked for yet.";
  else if (s.met === 1) line = "Only " + s.jobs.filter(function (job) { return job.metTarget; })[0].name + " paid what you asked for.";
  else line = jobsText(s.met) + " paid what you asked for.";
  byId("dash-met-line").textContent = line;

  const list = byId("met-list");
  list.textContent = "";
  s.byPercent.slice(0, 5).forEach(function (job) {
    const item = make("li", "met-row");
    const name = make("span", "met-name", job.name);
    name.title = job.name;
    const status = make("span", "met-status", job.metTarget ? "met" : "missed");
    status.appendChild(make("span", "met-dot " + (job.metTarget ? "dash-paid" : "dash-short")));
    item.append(name, status);
    list.appendChild(item);
  });
  if (s.byPercent.length > 5) list.appendChild(make("li", "met-row met-more", "+ " + (s.byPercent.length - 5) + " more"));
}

function renderFix(s) {
  const fix = s.biggestFix;
  show(byId("dash-fix-amount"), Boolean(fix));
  show(byId("fix-chart"), Boolean(fix));
  show(byId("fix-button"), Boolean(fix));
  if (!fix) {
    byId("dash-fix-line").textContent = "Every job met your target.";
    return;
  }
  byId("dash-fix-amount").textContent = signedMoney(-fix.step);
  byId("dash-fix-line").textContent = "Price " + fix.name + " at your target and you go from " +
    percentText(s.percent) + " to " + percentText(s.withFixPercent) + " of your target pay.";
  const now = clamp01(s.percent);
  const withFix = clamp01(s.withFixPercent);
  byId("fix-now-bar").style.width = now * 100 + "%";
  byId("fix-added-bar").style.width = (withFix - now) * 100 + "%";
  byId("fix-track-bar").style.width = (1 - withFix) * 100 + "%";
  show(byId("fix-added-bar"), withFix > now);
  byId("fix-labels").style.width = withFix * 100 + "%";
  byId("fix-now-label").textContent = "now " + percentText(s.percent);
  byId("fix-with-label").textContent = "with fix " + percentText(s.withFixPercent);
  byId("fix-button").textContent = "Fix " + fix.name + "\u00a0→";
  byId("fix-button").dataset.id = fix.id;
}

// Each job vs its target: 0% to 150%, lowest first.
const BULLET_MAX = 1.5;

function renderBullets(s) {
  const rows = byId("bullet-rows");
  rows.textContent = "";
  const head = make("div", "bullet-grid bullet-head");
  head.setAttribute("aria-hidden", "true");
  const headTrack = make("div", "bullet-track");
  headTrack.appendChild(make("span", "bullet-target-label", "your target"));
  head.appendChild(headTrack);
  rows.appendChild(head);

  const summary = [];
  s.byPercent.forEach(function (job) {
    const row = make("div", "bullet-grid bullet-row");
    row.dataset.id = job.id;
    row.setAttribute("aria-hidden", "true");
    const name = make("p", "bullet-name", job.name);
    name.title = job.name;
    const below = job.percent < 0;
    const value = make("p", "bullet-value", below ? "below expenses" : percentText(job.percent));
    const rate = make("p", "bullet-rate", dashCents(job.hourlyAfter) + " of " + targetHourly(job.rate));
    const track = make("div", "bullet-track");
    const bar = make("div", "bullet-bar");
    const paid = make("span", "dash-paid");
    paid.style.width = Math.max(0, Math.min(job.percent, BULLET_MAX)) / BULLET_MAX * 100 + "%";
    const short = make("span", "dash-short");
    short.style.width = (1 - clamp01(job.percent)) / BULLET_MAX * 100 + "%";
    show(paid, job.percent > 0);
    show(short, job.percent < 1);
    bar.append(paid, short);
    track.appendChild(bar);
    row.append(name, track, value, rate);
    rows.appendChild(row);
    summary.push(job.name + (below ? " pays below expenses, " : " pays " + percentText(job.percent) + " of its target, ") +
      dashCents(job.hourlyAfter) + " of " + targetHourly(job.rate) + ".");
  });
  const tip = make("div", "bullet-tip");
  tip.id = "bullet-tip";
  tip.setAttribute("aria-hidden", "true");
  tip.hidden = true;
  rows.appendChild(tip);
  byId("bullet-summary").textContent = "Real pay per hour after expenses as a share of each target, lowest first. " + summary.join(" ");

  const body = byId("bullet-table-rows");
  body.textContent = "";
  s.byPercent.forEach(function (job) {
    const row = document.createElement("tr");
    const name = make("th", null, job.name);
    name.scope = "row";
    row.append(name,
      make("td", null, dashHourly(job.hourlyAfter)),
      make("td", null, targetHourly(job.rate)),
      make("td", null, job.percent < 0 ? "below expenses" : percentText(job.percent)),
      make("td", null, calc.formatPrice(job.offer)),
      make("td", null, calc.formatHours(job.hours)),
      make("td", null, calc.formatHours(tenths(job.unpaidHours))));
    body.appendChild(row);
  });
  applyTableToggle("bullet-toggle", byId("bullet-chart"), byId("bullet-table"), bulletAsTable);
}

// The tooltip: in the empty space right of the target line, never over the values.
const bulletHover = window.matchMedia("(min-width: 1024px) and (hover: hover)");

function showBulletTip(row) {
  const tip = byId("bullet-tip");
  if (!tip) return;
  if (!row || !bulletHover.matches) {
    tip.hidden = true;
    return;
  }
  const job = projectStore.pricingSummary(projectStore.sortByEdited(projectList)).jobs
    .filter(function (item) { return item.id === row.dataset.id; })[0];
  if (!job) return;
  tip.textContent = "";
  tip.append(make("span", "bullet-tip-name", job.name),
    make("span", "bullet-tip-line", "Offer " + calc.formatPrice(job.offer) + " · " + calc.formatHours(job.hours)),
    make("span", "bullet-tip-line", calc.formatHours(tenths(job.unpaidHours)) + " unpaid"));
  const track = row.querySelector(".bullet-track");
  const left = track.offsetLeft + track.offsetWidth / BULLET_MAX + 12;
  tip.style.left = left + "px";
  tip.style.maxWidth = (track.offsetLeft + track.offsetWidth - left) + "px";
  tip.hidden = false;
  tip.style.top = (row.offsetTop + row.offsetHeight / 2 - tip.offsetHeight / 2) + "px";
}

// The summary card on a saved project's result: 2 or more projects count.
function renderPricingCard() {
  const card = byId("pricing-card");
  const s = currentId ? projectStore.pricingSummary(projectList) : null;
  show(card, Boolean(s) && s.counted >= 2);
  if (card.hidden) return;
  byId("pricing-card-percent").textContent = percentText(s.percent);
  byId("pricing-card-text").textContent = "of your target pay, across " + jobsText(s.counted);
  const kept = clamp01(s.percent);
  setBar(byId("pricing-card-kept-bar"), kept);
  setBar(byId("pricing-card-short-bar"), 1 - kept);
  byId("pricing-card-kept").textContent = dashMoney(s.kept) + " kept";
  byId("pricing-card-short").textContent = s.kept >= s.targetPay ? "nothing short" : dashMoney(s.shortfall) + " short";
}

// After "Fix [project]" opens screen 2: go to its Ways to close the gap.
function landOnGapSection() {
  if (!landOnGap) return;
  landOnGap = false;
  const section = byId("gap-section");
  if (section.hidden) return;
  section.scrollIntoView({ behavior: reduceMotion.matches ? "instant" : "smooth", block: "start" });
  byId("gap-heading").focus({ preventScroll: true });
}

// "Check the offer": with errors, go to the first one. Otherwise show the result
// and move focus to its first line, so screen readers announce it.
function checkOffer() {
  if (document.body.classList.contains("revealing")) return;
  clearTimeout(commitTimer);
  update(true);
  const firstError = Object.keys(FIELD_IDS).filter(function (name) {
    return name !== "quote" && shownErrors[name];
  })[0];
  if (firstError) {
    byId(FIELD_IDS[firstError]).focus();
    return;
  }
  // 0 hours: nothing to show yet, so stay here and ask for hours.
  if (lastHours && !(lastHours.total > 0)) {
    showWorkError(true);
    byId("setup-hours").focus();
    return;
  }
  // fromInputs: Back from here returns to screen 1 of the same calculation.
  const state = { screen: "results", project: currentId || undefined, fromInputs: true };
  history.pushState(state, "", addressFor(state));
  revealResults();
}

// "Add at least one hour of work." under 02 The work, linked to the first hours field.
function showWorkError(visible) {
  const error = byId("work-error");
  show(error, visible);
  const field = byId("setup-hours");
  const ids = (field.getAttribute("aria-describedby") || "").split(" ")
    .filter(function (id) { return id && id !== "work-error"; });
  if (visible) ids.push("work-error");
  if (ids.length) field.setAttribute("aria-describedby", ids.join(" "));
  else field.removeAttribute("aria-describedby");
}

// Motion helpers. One ease for everything (DESIGN.md): cubic-bezier(.2,.7,.2,1).
const MORPH_MS = 250;

function canMove() {
  return !reduceMotion.matches && Boolean(Element.prototype.animate);
}

function mix(from, to, t) {
  return from + (to - from) * t;
}

// cubic-bezier(.2,.7,.2,1), solved for x by a few Newton steps.
function ease(x) {
  if (x <= 0 || x >= 1) return x;
  const ax = 0.2, bx = 0.2, ay = 0.7, by = 1;
  function curve(t, p1, p2) { return 3 * (1 - t) * (1 - t) * t * p1 + 3 * (1 - t) * t * t * p2 + t * t * t; }
  function slope(t, p1, p2) { return 3 * (1 - t) * (1 - t) * p1 + 6 * (1 - t) * t * (p2 - p1) + 3 * t * t * (1 - p2); }
  let t = x;
  for (let i = 0; i < 6; i++) {
    const d = slope(t, ax, bx);
    if (Math.abs(d) < 1e-6) break;
    t -= (curve(t, ax, bx) - x) / d;
  }
  return curve(Math.max(0, Math.min(1, t)), ay, by);
}
const EASE = "cubic-bezier(.2,.7,.2,1)";

// Tweens a value from 0 to 1. Under reduced motion it lands at once.
// Returns a function that jumps to the end.
let runningTweens = [];

function tween(ms, step, done) {
  if (!canMove()) {
    step(1);
    if (done) done();
    return function () {};
  }
  const started = performance.now();
  let frame = null;
  let over = false;
  function finish() {
    if (over) return;
    over = true;
    cancelAnimationFrame(frame);
    step(1);
    runningTweens = runningTweens.filter(function (f) { return f !== finish; });
    if (done) done();
  }
  function tick(now) {
    const t = Math.min(1, (now - started) / ms);
    if (t >= 1) { finish(); return; }
    step(ease(t));
    frame = requestAnimationFrame(tick);
  }
  frame = requestAnimationFrame(tick);
  runningTweens.push(finish);
  return finish;
}

// Web Animations with the shared ease. fill "backwards" hides a delayed part
// until its turn, and the final look is always the element's own styles.
function animate(element, frames, options) {
  if (!element || !canMove()) return null;
  return element.animate(frames, Object.assign({ easing: EASE, fill: "backwards" }, options));
}

// Plays once each time screen 2 is shown: the hero, the stats, the hours chart,
// and the rate chart (DESIGN.md, Motion).
// - Arm before screen 2 appears: whenever screen 2 is shown (Check the offer,
//   a shared link, a saved project, Back), every block switches to its starting
//   state in the same step that shows the screen, so its first frame is already
//   the start. Nothing is ever seen finished and then reset.
// - Each block plays when 35% of it is visible (for the charts, 35% of the
//   drawing itself), one after another through the queue below. A block that's
//   35% visible when screen 2 appears plays right away (after the reveal).
// - A block the person scrolls past (it leaves the top of the screen before it
//   plays) jumps to its final state. So does any armed block on a live change.
// Starting states are set by script, so without scripts (or under reduced
// motion) everything stays in its final state.
const PLAY_THRESHOLD = 0.35;
const PLAYS = {
  "hero-panel": playHero,
  metrics: playStats,
  "hours-chart": playHours,
  "offer-chart": playRate,
};
const ARMS = {
  "hero-panel": armHero,
  metrics: armStats,
  "hours-chart": armHours,
  "offer-chart": armRate,
};
// What the observer watches for each block: the drawing itself for the charts
// (the bars area, the plot), so headings and legends don't count.
const WATCH = {
  "hero-panel": "hero-panel",
  metrics: "metrics",
  "hours-chart": "bars",
  "offer-chart": "rate-plot",
};

function watched(id) {
  return byId(WATCH[id]);
}

function blockOf(element) {
  return Object.keys(WATCH).filter(function (id) { return WATCH[id] === element.id; })[0];
}

// For each block: "armed", "queued", "played", or "final".
let blockState = {};
let playObserver = null;
let playTimers = [];

// Screen 2 is being shown: forget what played, and arm every block that's on
// the page. Runs in the same step that shows the screen, before it's painted.
function armPlays() {
  finishPlays();
  blockState = {};
  lastPlay = { id: null, at: -Infinity };
  scrubHours = null;
  if (playObserver) playObserver.disconnect();
  if (!canMove() || !window.IntersectionObserver) return;
  Object.keys(ARMS).forEach(function (id) {
    const block = byId(id);
    if (block.hidden || block.closest("[hidden]")) return;
    blockState[id] = "armed";
    ARMS[id]();
  });
}

// Blocks play one after another, in page order, at least 200ms apart. The rate
// chart waits for the hours chart's fill to finish (wipe 400ms + fill 700ms).
const PLAY_ORDER = ["hero-panel", "metrics", "hours-chart", "offer-chart"];
const PLAY_GAP_MS = 200;
const HOURS_FILL_DONE_MS = 1100;
let playQueue = [];
let queueTimer = null;
let lastPlay = { id: null, at: -Infinity };

function gapAfter(previous, id) {
  return previous === "hours-chart" && id === "offer-chart" ? HOURS_FILL_DONE_MS : PLAY_GAP_MS;
}

function queuePlay(id) {
  blockState[id] = "queued";
  playQueue.push(id);
  playQueue.sort(function (a, b) { return PLAY_ORDER.indexOf(a) - PLAY_ORDER.indexOf(b); });
  pumpPlays();
}

function pumpPlays() {
  if (queueTimer !== null || !playQueue.length) return;
  const wait = Math.max(0, lastPlay.at + gapAfter(lastPlay.id, playQueue[0]) - performance.now());
  queueTimer = setTimeout(function () {
    queueTimer = null;
    const id = playQueue.shift();
    if (blockState[id] !== "queued") { pumpPlays(); return; }
    blockState[id] = "played";
    if (playObserver) playObserver.unobserve(watched(id));
    lastPlay = { id: id, at: performance.now() };
    PLAYS[id]();
    pumpPlays();
  }, wait);
}

function clearPlayQueue() {
  clearTimeout(queueTimer);
  queueTimer = null;
  playQueue = [];
}

// Plays start at t=0: when screen 2 is fully visible (after the reveal, or right away).
function startPlays() {
  if (!canMove() || !window.IntersectionObserver) return;
  if (!playObserver) {
    playObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        const id = blockOf(entry.target);
        const state = blockState[id];
        if (state !== "armed" && state !== "queued") return;
        // Scrolled past before it played: straight to its final state.
        if (!entry.isIntersecting && entry.boundingClientRect.bottom <= 0) {
          playObserver.unobserve(entry.target);
          finalizeBlock(id);
          return;
        }
        if (state === "armed" && entry.isIntersecting && entry.intersectionRatio >= PLAY_THRESHOLD) queuePlay(id);
      });
    }, { threshold: [0, PLAY_THRESHOLD] });
  }
  Object.keys(PLAYS).forEach(function (id) {
    if (blockState[id] === "armed") playObserver.observe(watched(id));
  });
}

// A jump from below the screen to above it crosses no threshold, so the
// observer never hears about it. A light scroll check catches those.
let pastFrame = null;

function finalizeScrolledPast() {
  pastFrame = null;
  Object.keys(blockState).forEach(function (id) {
    const state = blockState[id];
    if ((state === "armed" || state === "queued") && watched(id).getBoundingClientRect().bottom <= 0) {
      if (playObserver) playObserver.unobserve(watched(id));
      finalizeBlock(id);
    }
  });
}

window.addEventListener("scroll", function () {
  if (pastFrame === null) pastFrame = requestAnimationFrame(finalizeScrolledPast);
}, { passive: true });

// One block straight to its final state, without playing.
function finalizeBlock(id) {
  blockState[id] = "final";
  playQueue = playQueue.filter(function (queued) { return queued !== id; });
  if (id === "hero-panel") {
    if (lastResult && !byId("result-summary").hidden) paintHeroNumber(lastResult, heroValue(lastResult));
  } else {
    byId(id).classList.remove("armed");
    if (id === "metrics") renderStatNumbers();
  }
}

// Armed blocks that won't play after all (a live change) go to their final state.
function disarm() {
  clearPlayQueue();
  Object.keys(blockState).forEach(function (id) {
    if (blockState[id] === "armed" || blockState[id] === "queued") finalizeBlock(id);
  });
}

function later(ms, fn) {
  playTimers.push(setTimeout(fn, ms));
}

// Anything still playing jumps to its end: a live change, or leaving the screen.
function finishPlays() {
  playTimers.forEach(clearTimeout);
  playTimers = [];
  runningTweens.slice().forEach(function (finish) { finish(); });
  stopCountUp();
  if (lastResult && byId("hero-amount")) paintHeroNumber(lastResult, heroValue(lastResult));
  byId("result").getAnimations({ subtree: true }).forEach(function (animation) { animation.finish(); });
  endHoursPlay();
  byId("metrics").classList.remove("play");
  disarm();
  renderStatNumbers();
}

// Starting states, set while the block is still below the screen.
function armHero() {
  if (lastResult && !byId("result-summary").hidden) paintHeroNumber(lastResult, 0);
}

function armStats() {
  byId("metrics").classList.add("armed");
  document.querySelectorAll("#metrics .stat-number").forEach(function (number, i) {
    const item = shownStats[i];
    if (item && typeof item.number === "number") number.textContent = item.format(0);
  });
}

// No bars yet (the stripes wipe in), and the line, bracket, and labels wait.
function armHours() {
  byId("hours-chart").classList.add("armed");
}

// Nothing yet: the grid, target, curve, and dots each take their turn.
function armRate() {
  byId("offer-chart").classList.add("armed");
}

function playHero() {
  if (lastResult && !byId("result-summary").hidden) countUpHero(lastResult);
}

// Hairlines draw left to right (CSS), numbers count up 700ms, 80ms apart.
function playStats() {
  const metrics = byId("metrics");
  metrics.classList.add("play");
  metrics.classList.remove("armed");
  later(500, function () { metrics.classList.remove("play"); });
  metrics.querySelectorAll(".stat-number").forEach(function (number, i) {
    const item = shownStats[i];
    if (!item || typeof item.number !== "number") return;
    number.textContent = item.format(0);
    later(i * 80, function () {
      tween(COUNT_UP_MS, function (t) { number.textContent = item.format(item.number * t); },
        function () { number.textContent = item.value; });
    });
  });
}

// The hours chart acts out the finding, one step after another (DESIGN.md):
// stripes wipe in (400ms), the paid fill runs from the left and stops where the
// money runs out (700ms), the runs-out line drops in (200ms), the bracket draws
// (300ms), then the group labels rise in, 60ms apart. Only clip-path, opacity,
// and transform move.
const HOURS_WIPE_MS = 400;
const HOURS_FILL_MS = 700;
const HOURS_LINE_MS = 200;
const HOURS_BRACKET_MS = 300;
const HOURS_LABEL_MS = 300;
const HOURS_LABEL_GAP_MS = 60;

function playHours() {
  const chart = byId("hours-chart");
  const row = byId("bar-row");
  const lineAt = HOURS_WIPE_MS + HOURS_FILL_MS;
  const bracketAt = lineAt + HOURS_LINE_MS;
  const labelsAt = bracketAt + HOURS_BRACKET_MS;

  // The paid fill: one front moving left to right across the groups (with the
  // shared ease), drawn as a clip on each paid part. Sampled into keyframes so
  // the browser runs it, not a script on every frame.
  const paid = Array.prototype.slice.call(row.querySelectorAll(".bar-paid")).map(function (span) {
    return { span: span, left: span.parentElement.offsetLeft - row.offsetLeft, width: span.offsetWidth };
  });
  const fillTo = paid.reduce(function (most, part) { return Math.max(most, part.left + part.width); }, 0);
  const STEPS = 24;

  // From armed to playing in one frame: every animation starts in the armed look.
  chart.classList.add("hours-playing");
  chart.classList.remove("armed");
  animate(row, [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }], { duration: HOURS_WIPE_MS });
  paid.forEach(function (part) {
    const frames = [];
    for (let i = 0; i <= STEPS; i++) {
      const front = fillTo * ease(i / STEPS);
      const hidden = Math.max(0, Math.min(part.width, part.left + part.width - front));
      frames.push({ offset: i / STEPS, clipPath: "inset(0 " + hidden + "px 0 0)" });
    }
    animate(part.span, frames, { duration: HOURS_FILL_MS, delay: HOURS_WIPE_MS, easing: "linear" });
  });
  animate(byId("runs-out"), [{ opacity: 0, transform: "translateY(-8px)" }, { opacity: 1, transform: "none" }],
    { duration: HOURS_LINE_MS, delay: lineAt });
  animate(byId("bracket"), [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }],
    { duration: HOURS_BRACKET_MS, delay: bracketAt });
  animate(byId("bracket-label"), [{ opacity: 0 }, { opacity: 1 }], { duration: HOURS_BRACKET_MS, delay: bracketAt });
  const labels = Array.prototype.slice.call(document.querySelectorAll("#bar-labels .bar-label, #group-legend li"))
    .filter(function (label) { return label.offsetParent; });
  labels.forEach(function (label, i) {
    animate(label, [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }],
      { duration: HOURS_LABEL_MS, delay: labelsAt + i * HOURS_LABEL_GAP_MS });
  });
  // The stripes under the paid parts are only needed until the fill is done.
  later(lineAt, endHoursPlay);
}

function endHoursPlay() {
  byId("hours-chart").classList.remove("hours-playing");
}

// The rate chart: the grid fades in (200ms), the target line draws (300ms), the
// curve draws left to right (900ms) so you watch the rate fall, the black dot
// pops as the curve reaches it, and the red dot lands last with one halo pulse.
const RATE_GRID_MS = 200;
const RATE_TARGET_MS = 300;
const RATE_CURVE_MS = 900;

function playRate() {
  const svg = byId("rate-plot").querySelector("svg");
  byId("offer-chart").classList.remove("armed");
  if (!svg) return;
  const targetAt = RATE_GRID_MS;
  const curveAt = targetAt + RATE_TARGET_MS;
  const dotAt = curveAt + RATE_CURVE_MS;

  svg.querySelectorAll(".rate-grid, .rate-tick, .rate-zero").forEach(function (part) {
    animate(part, [{ opacity: 0 }, { opacity: 1 }], { duration: RATE_GRID_MS });
  });
  const target = svg.querySelector(".rate-target");
  const targetLength = Math.abs(target.x2.baseVal.value - target.x1.baseVal.value);
  animate(target, [{ strokeDasharray: targetLength + " " + targetLength, strokeDashoffset: targetLength },
    { strokeDasharray: targetLength + " " + targetLength, strokeDashoffset: 0 }], { duration: RATE_TARGET_MS, delay: targetAt });
  animate(svg.querySelector(".rate-target-label"), [{ opacity: 0 }, { opacity: 1 }], { duration: RATE_TARGET_MS, delay: targetAt });

  const curve = svg.querySelector(".rate-curve");
  const length = curve.getTotalLength();
  animate(curve, [{ strokeDasharray: length + " " + length, strokeDashoffset: length },
    { strokeDasharray: length + " " + length, strokeDashoffset: 0 }], { duration: RATE_CURVE_MS, delay: curveAt });

  const cross = svg.querySelector(".rate-cross");
  if (cross && rateView) {
    const share = Math.max(0, Math.min(1, (cross.cx.baseVal.value - rateView.pad.left) /
      (rateView.width - rateView.pad.left - rateView.pad.right)));
    const at = curveAt + RATE_CURVE_MS * Math.pow(share, 0.7);
    animate(cross, [{ transform: "scale(0)" }, { transform: "scale(1.4)" }, { transform: "scale(1)" }],
      { duration: 260, delay: at, easing: "ease-out" });
    animate(svg.querySelector(".rate-cross-label"), [{ opacity: 0 }, { opacity: 1 }], { duration: 250, delay: at });
  }

  animate(svg.querySelector(".rate-dot"), [{ transform: "scale(0)" }, { transform: "scale(1)" }],
    { duration: 260, delay: dotAt });
  animate(svg.querySelector(".rate-halo"),
    [{ transform: "scale(0.4)", opacity: 0 }, { transform: "scale(0.4)", opacity: 0.5, offset: 0.05 },
      { transform: "scale(1.6)", opacity: 0, offset: 0.6 }, { transform: "scale(1)", opacity: 0.25 }],
    { duration: 900, delay: dotAt + 120, easing: "ease-out" });
  animate(svg.querySelector(".rate-now-label"), [{ opacity: 0 }, { opacity: 1 }], { duration: 250, delay: dotAt + 260 });
}

// The reveal plays once per press of "Check the offer". Under reduced motion,
// the final state shows right away.
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const REVEAL_FADE_MS = 200;
const REVEAL_GROW_MS = 400;

function rectFrame(rect) {
  return { left: rect.left + "px", top: rect.top + "px", width: rect.width + "px", height: rect.height + "px" };
}

// The reveal runs in steps, each starting when the one before has finished, so
// nothing jumps: screen 1 fades out; while nothing is showing, the screens swap
// and the page scrolls to the top; the orb grows into the hero panel; screen 2
// fades in. Then t=0: the blocks in view play one after another.
const SCREEN1_PARTS = ".screen-inputs, .site-footer, .topbar, .glow";
const SCREEN2_PARTS = ".screen-results, .site-footer, .topbar";
let revealRun = 0;
let revealAnimations = [];

function cancelReveal() {
  revealRun++;
  revealAnimations.forEach(function (animation) { animation.cancel(); });
  revealAnimations = [];
  document.querySelectorAll(".reveal-orb").forEach(function (orb) { orb.remove(); });
  document.body.classList.remove("revealing", "reveal-hidden");
}

function revealAnimate(element, frames, options) {
  const animation = element.animate(frames, Object.assign({ easing: EASE, fill: "forwards" }, options));
  revealAnimations.push(animation);
  return animation;
}

function fadeAll(selector, from, to, ms) {
  return Promise.all(Array.prototype.map.call(document.querySelectorAll(selector), function (element) {
    return revealAnimate(element, [{ opacity: from }, { opacity: to }], { duration: ms }).finished;
  }));
}

function revealResults(quiet) {
  const body = document.body;
  cancelReveal();
  // Reduced motion: no reveal, no plays. The result shows in its final state.
  if (!canMove()) {
    openResults(quiet);
    return;
  }
  const run = revealRun;
  const live = function () { return run === revealRun; };

  // A copy of the gradient circle, fixed where the button's circle is.
  const from = byId("check-circle").getBoundingClientRect();
  const orb = document.createElement("div");
  orb.className = "reveal-orb";
  orb.setAttribute("aria-hidden", "true");
  // Round from the first frame, like the button's circle.
  Object.assign(orb.style, rectFrame(from), { borderRadius: "50%" });
  body.appendChild(orb);
  body.classList.add("revealing");

  // 1. Screen 1 fades out, 200ms. Nothing scrolls while it can be seen.
  fadeAll(SCREEN1_PARTS, 1, 0, REVEAL_FADE_MS).then(function () {
    if (!live()) return;
    // 2. Hidden now: swap the screens (this scrolls to the top) and arm the blocks.
    body.classList.add("reveal-hidden");
    revealAnimations.forEach(function (animation) { animation.cancel(); });
    revealAnimations = [];
    openResults(quiet);
    const to = byId("hero-panel").getBoundingClientRect();
    const start = Object.assign(rectFrame(from), { borderRadius: from.width / 2 + "px" });
    const end = Object.assign(rectFrame(to), { borderRadius: "28px" });
    // 3. The orb grows into the hero panel, 400ms.
    return revealAnimate(orb, [start, end], { duration: REVEAL_GROW_MS }).finished;
  }).then(function () {
    if (!live()) return;
    // 4. Screen 2 fades in over the orb, 200ms.
    revealAnimate(orb, [{ opacity: 1 }, { opacity: 0 }], { duration: REVEAL_FADE_MS });
    return fadeAll(SCREEN2_PARTS, 0, 1, REVEAL_FADE_MS);
  }).then(function () {
    if (!live()) return;
    // 5. t=0: screen 2 is fully visible.
    body.classList.remove("revealing", "reveal-hidden");
    revealAnimations.forEach(function (animation) { animation.cancel(); });
    revealAnimations = [];
    orb.remove();
    startPlays();
  }).catch(function () {
    // A cancelled animation ends the reveal; cancelReveal has cleaned up.
  });
}

// Back to screen 1. Uses the browser's Back when screen 2 was opened from screen 1,
// so history stays tidy; otherwise (opened from Projects, or after a reload) it
// adds a step to screen 1.
function editDetails() {
  if (history.state && history.state.fromInputs) {
    history.back();
  } else {
    go({ screen: "inputs", project: currentId || undefined });
  }
}

// Screen readers hear short confirmations ("Link copied", "Image saved") here.
function announce(text) {
  const region = byId("announcer");
  region.textContent = "";
  setTimeout(function () { region.textContent = text; }, 50);
}

// Share link: the inputs of this calculation in the address, after "#s=".
// Desktop copies it; a phone opens the share sheet, or copies if it can't.

const LINK_COPIED_MS = 2000;
let linkCopiedTimer = null;

function shareUrl() {
  const snap = snapshot();
  return location.href.split("#")[0] + shareLink.encodeShare(snap.field, snap.job, snap.inputs);
}

function showLinkCopied() {
  const button = byId("share-link");
  clearTimeout(linkCopiedTimer);
  button.classList.add("copied");
  announce("Link copied");
  linkCopiedTimer = setTimeout(function () {
    button.classList.remove("copied");
  }, LINK_COPIED_MS);
}

// When copying fails: the link in a read-only field, selected, to copy by hand.
function showShareField(url) {
  openDialog("share-panel", byId("share-link"));
  const input = byId("share-url");
  input.value = url;
  input.focus({ preventScroll: true });
  input.select();
}

function copyLink(url) {
  if (!navigator.clipboard || !navigator.clipboard.writeText) {
    showShareField(url);
    return;
  }
  navigator.clipboard.writeText(url).then(showLinkCopied, function () { showShareField(url); });
}

function shareResult() {
  const url = shareUrl();
  if (isPhone() && navigator.share) {
    navigator.share({ url: url }).catch(function (error) {
      // Closing the share sheet isn't a failure: nothing happens.
      if (error && error.name === "AbortError") return;
      copyLink(url);
    });
    return;
  }
  copyLink(url);
}

// Opening a shared link. It becomes the unsaved calculation (never a saved
// project). If the unsaved one has changes, it asks first.

let pendingShare = null;
let sharedSnapshot = null;

const SHARED_NOTES = {
  ok: "Shared result. Change anything to make it yours.",
  partial: "Some numbers in this link didn't work, so we used examples.",
  broken: "Some numbers in this link didn't work, so we used examples.",
};

function openShareLink(hash, onLoad) {
  const shared = shareLink.decodeShare(hash);
  // Underneath: the person's own calculation, screen 1. The address keeps the
  // link until they answer.
  history.replaceState({ screen: "inputs" }, "", location.href);
  route({ screen: "inputs" });
  if (draft && !projectStore.isUntouched(draft)) {
    openDialog("share-question");
    pendingShare = shared;
    byId("share-open").focus({ preventScroll: true });
    return;
  }
  pendingShare = shared;
  applyShare(onLoad);
}

function applyShare(onLoad) {
  const shared = pendingShare;
  closePanels();
  if (!shared) return;
  leaveProject();
  draft = shared.draft;
  persistDraft();
  draftOnScreen = false;
  const quiet = onLoad === true;

  if (shared.status === "broken") {
    // Nothing usable: screen 1 with the examples.
    const state = { screen: "inputs" };
    history.replaceState(state, "", addressFor(state));
    route(state);
    showSharedNote(shared.status);
    return;
  }

  // Screen 1 first, so the reveal can grow from the button into the result.
  route({ screen: "inputs" });
  const state = { screen: "results" };
  history.replaceState(state, "", addressFor(state));
  showSharedNote(shared.status);
  if (lastResult && byId("result-summary") && !document.querySelector(".results-pair").hidden) {
    revealResults(quiet);
  } else {
    openResults(quiet);
  }
}

function keepMine() {
  closePanels();
  const state = { screen: "inputs" };
  history.replaceState(state, "", addressFor(state));
  byId("page-title").focus({ preventScroll: true });
}

function showSharedNote(status) {
  const onInputs = status === "broken";
  const note = byId(onInputs ? "shared-note-inputs" : "shared-note");
  note.querySelector(".shared-text").textContent = SHARED_NOTES[status];
  show(onInputs ? note : byId("shared-row"), true);
  sharedSnapshot = JSON.stringify(snapshot());
}

function hideSharedNote() {
  sharedSnapshot = null;
  show(byId("shared-row"), false);
  show(byId("shared-note-inputs"), false);
}

// Save image: a 1080 by 1350 PNG for the client, drawn on a canvas.
// It speaks to the client: "Design" for production, "work you don't see",
// "$200 covers 7.2 hrs". No target rate gaps or losses.

const IMAGE_W = 1080;
const IMAGE_H = 1350;
const IMAGE_X = 80;
const IMAGE_RIGHT = 1000;
const IMAGE_COLORS = {
  bg: "#ECECEA", ink: "#161616", ink2: "#4D4D4A", line: "#CFCFCB",
};
const PRODUCTION_NAMES = { graphic: "Design", illustration: "Drawing", photography: "Shooting and editing", motion: "Animation" };
const IMAGE_GROUP_NAMES = { communication: "Communication", revisions: "Revisions", delivery: "Delivery" };

function imageFont(size, weight, mono) {
  return (weight || 400) + " " + size + "px " + (mono ? '"Geist Mono", ui-monospace, monospace' : '"Geist", system-ui, sans-serif');
}

// Words that fit in maxWidth, line by line.
function wrapWords(ctx, text, maxWidth) {
  const lines = [];
  let line = "";
  text.split(" ").forEach(function (word) {
    const next = line ? line + " " + word : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// The page's --sunset, drawn into a box: a 160deg base and three soft ellipses.
function drawSunset(ctx, x, y, w, h) {
  const angle = (160 * Math.PI) / 180;
  const dx = Math.sin(angle);
  const dy = -Math.cos(angle);
  const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const base = ctx.createLinearGradient(cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half);
  base.addColorStop(0, "#C9D6EA");
  base.addColorStop(0.4, "#D9CDE6");
  base.addColorStop(1, "#EBC7B5");
  ctx.fillStyle = base;
  ctx.fillRect(x, y, w, h);
  // [radius x, radius y, center x, center y, color rgb, where it fades out]
  [
    [0.40, 0.60, 0.55, 0.55, "247,185,143", 0.75],
    [0.50, 0.80, 0.70, 0.80, "255,138,61", 0.70],
    [0.55, 0.95, 0.88, 1.00, "232,67,46", 0.70],
  ].forEach(function (blob) {
    ctx.save();
    ctx.translate(x + blob[2] * w, y + blob[3] * h);
    ctx.scale(blob[0] * w, blob[1] * h);
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    glow.addColorStop(0, "rgba(" + blob[4] + ",1)");
    glow.addColorStop(blob[5], "rgba(" + blob[4] + ",0)");
    ctx.fillStyle = glow;
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
  });
}

// Vertical ink stripes with a thin outline, like the page's unpaid hours.
function drawStripes(ctx, x, y, w, h) {
  if (w <= 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = IMAGE_COLORS.ink;
  for (let at = x; at < x + w; at += 5) ctx.fillRect(at, y, 1.25, h);
  ctx.restore();
  ctx.strokeStyle = IMAGE_COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5);
}

// Text with an optional letter spacing, where the browser supports it.
function setSpacing(ctx, value) {
  if ("letterSpacing" in ctx) ctx.letterSpacing = value;
}

function drawShareImage(canvas, r, values) {
  const ctx = canvas.getContext("2d");
  const ink = IMAGE_COLORS.ink;
  const ink2 = IMAGE_COLORS.ink2;
  ctx.fillStyle = IMAGE_COLORS.bg;
  ctx.fillRect(0, 0, IMAGE_W, IMAGE_H);
  ctx.textBaseline = "alphabetic";

  // Job summary, the hours, and the intro.
  ctx.fillStyle = ink2;
  ctx.font = imageFont(22, 400, true);
  ctx.fillText(jobSummary(values), IMAGE_X, 103);

  ctx.fillStyle = ink;
  ctx.font = imageFont(88, 300);
  setSpacing(ctx, "-2.5px");
  ctx.fillText(hoursInWords(r.hours.total), IMAGE_X - 4, 209);
  ctx.fillText("of work", IMAGE_X - 4, 297);
  setSpacing(ctx, "0px");

  ctx.fillStyle = ink2;
  ctx.font = imageFont(30, 400);
  wrapWords(ctx, "Here's where the time goes, including the work you don't see.", 720)
    .forEach(function (line, i) { ctx.fillText(line, IMAGE_X, 359 + i * 40); });

  // The bar: one segment per group with hours, 6px apart, on one scale.
  const barTop = 597;
  const barBottom = 795;
  const groups = WORK_GROUPS.filter(function (group) { return r.hours[group] > 1e-9; });
  const gap = 6;
  const usable = IMAGE_RIGHT - IMAGE_X - gap * (groups.length - 1);
  const segments = [];
  let x = IMAGE_X;
  let hoursSoFar = 0;
  groups.forEach(function (group) {
    const w = (r.hours[group] / r.hours.total) * usable;
    segments.push({ group: group, x: x, w: w, from: hoursSoFar, to: hoursSoFar + r.hours[group] });
    x += w + gap;
    hoursSoFar += r.hours[group];
  });
  // The x of an hour mark, skipping the gaps.
  function xAt(hours) {
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i];
      if (hours <= s.to + 1e-9) return s.x + ((hours - s.from) / (s.to - s.from)) * s.w;
    }
    return IMAGE_RIGHT;
  }

  // How much the offer covers: all of it (no offer, or enough), none (at or
  // below expenses), or part.
  const offer = r.offer;
  let covered = r.hours.total;
  let mode = "all";
  if (offer && offer.amount <= r.expenses) {
    covered = 0;
    mode = "none";
  } else if (offer && !offer.coversAllHours) {
    covered = offer.hoursCovered;
    mode = "part";
  }
  const coverX = xAt(covered);

  const paid = ctx.createLinearGradient(IMAGE_X, 0, IMAGE_RIGHT, 0);
  paid.addColorStop(0, "#C9D6EA");
  paid.addColorStop(0.3, "#EBC7B5");
  paid.addColorStop(0.7, "#FF8A3D");
  paid.addColorStop(1, "#E8432E");
  segments.forEach(function (s) {
    const paidEnd = Math.max(s.x, Math.min(s.x + s.w, coverX));
    if (paidEnd > s.x) {
      ctx.fillStyle = paid;
      ctx.fillRect(s.x, barTop, paidEnd - s.x, barBottom - barTop);
    }
    drawStripes(ctx, paidEnd, barTop, s.x + s.w - paidEnd, barBottom - barTop);
  });

  // The bracket over the work you don't see.
  const hidden = segments.filter(function (s) { return s.group !== "production"; });
  if (hidden.length) {
    const from = hidden[0].x;
    ctx.fillStyle = ink;
    ctx.font = imageFont(20, 400, true);
    const bracketLabel = calc.formatHours(r.outsideProduction) + " of work you don't see";
    // Starts over the bracket, or ends at the bar's end when that's too short.
    ctx.fillText(bracketLabel, Math.max(IMAGE_X, Math.min(from, IMAGE_RIGHT - ctx.measureText(bracketLabel).width)), 474);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(from + 0.75, 509);
    ctx.lineTo(from + 0.75, 493);
    ctx.lineTo(IMAGE_RIGHT - 0.75, 493);
    ctx.lineTo(IMAGE_RIGHT - 0.75, 509);
    ctx.stroke();
  }

  // The covers line: dashed, from its label down through the bar.
  if (mode !== "all") {
    const label = mode === "none"
      ? calc.formatPrice(offer.amount) + " covers none of the hours"
      : calc.formatPrice(offer.amount) + " covers " + calc.formatHours(covered);
    ctx.font = imageFont(22, 400, true);
    ctx.fillStyle = ink;
    const labelWidth = ctx.measureText(label).width;
    const fitsLeft = coverX - 14 - labelWidth >= IMAGE_X;
    ctx.textAlign = fitsLeft ? "right" : "left";
    ctx.fillText(label, fitsLeft ? coverX - 14 : Math.min(coverX + 14, IMAGE_RIGHT - labelWidth), 567);
    ctx.textAlign = "left";
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(coverX + (mode === "none" ? 1 : 0), 548);
    ctx.lineTo(coverX + (mode === "none" ? 1 : 0), barBottom);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Group labels on two alternating rows: "5.5 hrs" over "Design".
  const rows = [[], []];
  segments.forEach(function (s, i) {
    ctx.font = imageFont(40, 300);
    const number = calc.formatNumber(r.hours[s.group]);
    const numberWidth = ctx.measureText(number).width;
    ctx.font = imageFont(17, 400, true);
    const unit = isOne(r.hours[s.group]) ? "hr" : "hrs";
    const unitWidth = ctx.measureText(unit).width;
    ctx.font = imageFont(22, 400);
    const name = s.group === "production" ? PRODUCTION_NAMES[currentField()] : IMAGE_GROUP_NAMES[s.group];
    const width = Math.max(numberWidth + 6 + unitWidth, ctx.measureText(name).width);
    rows[i % 2].push({ segment: s, number: number, numberWidth: numberWidth, unit: unit, unitWidth: unitWidth,
      name: name, width: width, left: s.x - IMAGE_X });
  });
  rows.forEach(function (row, rowIndex) {
    const placed = calc.spreadLabels(row, IMAGE_RIGHT - IMAGE_X, 24).lefts;
    const numberY = rowIndex ? 946 : 853;
    row.forEach(function (item, i) {
      const left = IMAGE_X + placed[i];
      // Second row: a thin line from the bar down to the label, at the segment's
      // start, or its end, or its middle: the first one over the label.
      if (rowIndex) {
        const s = item.segment;
        const lineX = [s.x + 0.5, s.x + s.w - 0.5, s.x + s.w / 2].filter(function (at) {
          return at >= left - 1 && at <= left + item.width + 1;
        })[0] || s.x + s.w / 2;
        ctx.strokeStyle = IMAGE_COLORS.line;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(lineX, barBottom);
        ctx.lineTo(lineX, numberY - 40);
        ctx.stroke();
      }
      // A label pushed against the right end lines up with the bar's end.
      const alignRight = left + item.width >= IMAGE_RIGHT - 0.5 && Math.abs(left - item.segment.x) >= 1;
      ctx.fillStyle = ink;
      ctx.font = imageFont(40, 300);
      ctx.textAlign = "left";
      const numberLeft = alignRight ? IMAGE_RIGHT - item.numberWidth - 6 - item.unitWidth : left;
      ctx.fillText(item.number, numberLeft, numberY);
      ctx.fillStyle = ink2;
      ctx.font = imageFont(17, 400, true);
      if (alignRight) {
        ctx.textAlign = "right";
        ctx.fillText(item.unit, IMAGE_RIGHT, numberY);
      } else {
        ctx.fillText(item.unit, numberLeft + item.numberWidth + 6, numberY);
      }
      ctx.fillStyle = ink;
      ctx.font = imageFont(22, 400);
      ctx.fillText(item.name, alignRight ? IMAGE_RIGHT : left, numberY + 33);
      ctx.textAlign = "left";
    });
  });

  // Legend, only when the bar has both parts or only stripes.
  if (mode !== "all") {
    ctx.font = imageFont(22, 400);
    let legendX = IMAGE_X;
    if (mode === "part") {
      const swatch = ctx.createLinearGradient(legendX, 0, legendX + 30, 0);
      swatch.addColorStop(0, "#EBC7B5");
      swatch.addColorStop(1, "#E8432E");
      ctx.fillStyle = swatch;
      ctx.fillRect(legendX, 1015, 30, 16);
      ctx.fillStyle = ink;
      const text = "covered by " + calc.formatPrice(offer.amount);
      ctx.fillText(text, legendX + 40, 1030);
      legendX += 40 + ctx.measureText(text).width + 36;
    }
    drawStripes(ctx, legendX, 1015, 30, 16);
    ctx.fillStyle = ink;
    ctx.fillText("not covered", legendX + 40, 1030);
  }

  // My price, on a sunset panel.
  const panel = { x: IMAGE_X, y: 1060, w: IMAGE_RIGHT - IMAGE_X, h: 210 };
  ctx.save();
  roundedRect(ctx, panel.x, panel.y, panel.w, panel.h, 32);
  ctx.clip();
  drawSunset(ctx, panel.x, panel.y, panel.w, panel.h);
  ctx.restore();
  ctx.fillStyle = ink2;
  ctx.font = imageFont(26, 400);
  ctx.fillText("My price", panel.x + 40, 1119);
  ctx.fillStyle = ink;
  ctx.font = imageFont(110, 300);
  setSpacing(ctx, "-3px");
  ctx.fillText(calc.formatPrice(r.quote.amount), panel.x + 36, 1235);
  setSpacing(ctx, "0px");
  if (Math.abs(r.quote.amount - r.estimate) < 0.005) {
    ctx.fillStyle = ink2;
    ctx.font = imageFont(22, 400);
    ctx.textAlign = "right";
    const hoursLine = calc.formatHours(r.hours.total) + " at " + calc.formatPrice(r.rate) + "/hr";
    // With no expenses, only the hours line, on the lower row.
    if (r.expenses > 0) {
      ctx.fillText(hoursLine, panel.x + panel.w - 40, 1195);
      ctx.fillText("plus " + calc.formatPrice(r.expenses) + " in expenses", panel.x + panel.w - 40, 1227);
    } else {
      ctx.fillText(hoursLine, panel.x + panel.w - 40, 1227);
    }
    ctx.textAlign = "left";
  }

  ctx.fillStyle = ink2;
  ctx.font = imageFont(18, 400, true);
  ctx.fillText("Made with Counter", IMAGE_X, 1318);
}

// Waits for the fonts, so the image never falls back to a system font.
function makeShareImage() {
  const fonts = document.fonts;
  const ready = fonts ? Promise.all([
    fonts.ready,
    fonts.load(imageFont(88, 300)),
    fonts.load(imageFont(22, 400)),
    fonts.load(imageFont(22, 400, true)),
  ]).catch(function () {}) : Promise.resolve();
  return ready.then(function () {
    const canvas = document.createElement("canvas");
    canvas.width = IMAGE_W;
    canvas.height = IMAGE_H;
    const picked = imageResult();
    drawShareImage(canvas, picked.r, picked.values);
    return canvas;
  });
}

// "counter-menu-310.png"
function imageFileName(r) {
  return "counter-" + currentJob() + "-" + calc.formatPrice(r.quote.amount).replace(/[$,]/g, "") + ".png";
}

function downloadImage(blob, name) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(function () { URL.revokeObjectURL(link.href); }, 10000);
  announce("Image saved");
}

// "Save image" draws the PNG once and shows it in a dialog. The dialog's main
// button downloads that same file (or shares it on a phone); nothing is redrawn.
let preparedImage = null;

function canShareFile(file) {
  return isPhone() && Boolean(file) && Boolean(navigator.canShare) && navigator.canShare({ files: [file] });
}

function saveImage() {
  if (!lastResult || !lastValues) return;
  const r = imageResult().r;
  const name = imageFileName(r);
  makeShareImage().then(function (canvas) {
    canvas.toBlob(function (blob) {
      if (!blob) return;
      const file = typeof File === "function" ? new File([blob], name, { type: "image/png" }) : null;
      if (preparedImage) URL.revokeObjectURL(preparedImage.url);
      preparedImage = { blob: blob, name: name, file: file, url: URL.createObjectURL(blob) };

      const price = calc.formatPrice(r.quote.amount);
      const preview = byId("image-preview");
      preview.src = preparedImage.url;
      preview.alt = "Image for your client: " + hoursInWords(r.hours.total) + " of work, price " + price;
      byId("image-dialog-text").textContent =
        "This is exactly what they'll see. It uses your price to send, " + price + ".";
      byId("image-save").textContent = canShareFile(file) ? "Share image" : "Download image";
      byId("image-dialog").showModal();
    }, "image/png");
  });
}

// The dialog's main button: share the file on a phone that can, otherwise download.
function deliverImage() {
  const image = preparedImage;
  if (!image) return;
  if (canShareFile(image.file)) {
    navigator.share({ files: [image.file] }).then(function () {
      announce("Image saved");
      byId("image-dialog").close();
    }, function (error) {
      if (error && error.name === "AbortError") return;
      downloadImage(image.blob, image.name);
      byId("image-dialog").close();
    });
  } else {
    downloadImage(image.blob, image.name);
    byId("image-dialog").close();
  }
}

// Wiring

// Pressing Enter in a field shouldn't reload the page.
byId("counter-form").addEventListener("submit", function (event) {
  event.preventDefault();
});

document.querySelectorAll("button[data-step]").forEach(function (button) {
  button.addEventListener("click", function () { stepField(button); });
});

Object.keys(FIELD_IDS).forEach(function (name) {
  const input = byId(FIELD_IDS[name]);
  input.addEventListener("input", onType);
  input.addEventListener("blur", onLeaveField);
});

// Plain digits while typing. The selection is kept: Tab selects the whole
// value, and typing should replace it, not add to "1000".
MONEY_FIELDS.forEach(function (id) {
  byId(id).addEventListener("focus", function () {
    const input = byId(id);
    const plain = input.value.replace(/,/g, "");
    if (plain === input.value || calc.groupDigits(plain) !== input.value) return;
    const all = input.selectionStart === 0 && input.selectionEnd === input.value.length;
    const caret = input.value.slice(0, input.selectionEnd).replace(/,/g, "").length;
    input.value = plain;
    if (all) input.setSelectionRange(0, plain.length);
    else input.setSelectionRange(caret, caret);
  });
});

mirrors.forEach(function (mirror) {
  mirror.addEventListener("input", function () {
    byId(mirror.dataset.mirror).value = mirror.value;
    onType();
  });
  mirror.addEventListener("blur", onLeaveField);
});

document.querySelectorAll('input[name="offerStatus"]').forEach(function (radio) {
  radio.addEventListener("change", function () {
    showOfferField();
    clearTimeout(commitTimer);
    update(true);
  });
});

document.querySelectorAll('input[name="field"]').forEach(function (radio) {
  radio.addEventListener("change", switchField);
});
document.querySelectorAll('input[name="job"]').forEach(function (radio) {
  radio.addEventListener("change", switchJob);
});

// Phone: the header is clear at the top of screen 1, then gets a background.
window.addEventListener("scroll", function () {
  document.body.classList.toggle("scrolled", window.scrollY > 4);
}, { passive: true });

if (phoneQuery.addEventListener) phoneQuery.addEventListener("change", onLayoutChange);
else phoneQuery.addListener(onLayoutChange);
placeControls();
byId("job-replace-yes").addEventListener("click", function () { answerReplace(true); });
byId("job-replace-no").addEventListener("click", function () { answerReplace(false); });

byId("check-offer").addEventListener("click", checkOffer);
byId("edit-details").addEventListener("click", editDetails);
byId("skip-link").addEventListener("click", function (event) {
  event.preventDefault();
  checkOffer();
});

byId("reply").addEventListener("input", onReplyEdit);
byId("update-draft").addEventListener("click", updateDraft);
byId("use-estimate").addEventListener("click", useEstimate);
byId("gap-options").addEventListener("click", function (event) {
  const card = event.target.closest(".gap-card");
  if (card) pickGap(card.dataset.type, true);
});
// A radio group: arrows move and pick (wrapping), Space picks the focused card.
byId("gap-options").addEventListener("keydown", function (event) {
  const cards = Array.prototype.slice.call(byId("gap-options").children);
  const at = cards.indexOf(document.activeElement);
  if (at === -1) return;
  let next = null;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (at + 1) % cards.length;
  else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (at - 1 + cards.length) % cards.length;
  else if (event.key === " " || event.key === "Enter") next = at;
  if (next === null) return;
  event.preventDefault();
  pickGap(cards[next].dataset.type, true);
});
byId("copy-reply").addEventListener("click", copyReply);
byId("save-image").addEventListener("click", saveImage);

// Scrubbing the rate chart.
const ratePlot = byId("rate-plot");
ratePlot.addEventListener("pointermove", function (event) { if (rateView) scrubTo(hoursAtPointer(event)); });
ratePlot.addEventListener("pointerdown", function (event) { if (rateView) scrubTo(hoursAtPointer(event)); });
ratePlot.addEventListener("pointerleave", function () {
  if (document.activeElement !== ratePlot) hideScrub();
});
ratePlot.addEventListener("focus", function () { if (rateView) scrubTo(scrubHours); });
ratePlot.addEventListener("blur", hideScrub);
ratePlot.addEventListener("keydown", function (event) {
  if (!rateView) return;
  const moves = { ArrowRight: 0.5, ArrowUp: 0.5, ArrowLeft: -0.5, ArrowDown: -0.5 };
  if (moves[event.key]) {
    scrubTo(scrubHours + moves[event.key]);
  } else if (event.key === "Home") {
    scrubTo(rateView.x0);
  } else if (event.key === "End") {
    scrubTo(rateView.x1);
  } else if (event.key === "Escape") {
    hideScrub();
  } else {
    return;
  }
  event.preventDefault();
});
byId("image-save").addEventListener("click", deliverImage);
byId("image-close").addEventListener("click", function () { byId("image-dialog").close(); });
// Escape and Close both end here: focus goes back to "Save image".
byId("image-dialog").addEventListener("close", function () { byId("save-image").focus(); });
byId("share-link").addEventListener("click", shareResult);
byId("share-open").addEventListener("click", applyShare);
byId("share-keep").addEventListener("click", keepMine);
byId("share-close").addEventListener("click", dismissDialog);

let resizeFrame = null;
window.addEventListener("resize", function () {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(relayoutCharts);
});

if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(function () {
    relayoutCharts();
    // Pill widths change once the font loads, so the selected pill is placed again.
    showSelectedJobPill();
  });
}

// Projects and saving: the header, the save field, the start-over question, and the list.
byId("projects-link").addEventListener("click", function (event) {
  event.preventDefault();
  go({ screen: "projects" });
});
byId("save-project").addEventListener("click", function () {
  // In a project whose last save failed, the button is "Try again".
  if (currentProject()) {
    if (persist()) byId("crumb-name").focus({ preventScroll: true });
    return;
  }
  openSaveField(null);
});
byId("save-form").addEventListener("submit", saveAsProject);
byId("save-cancel").addEventListener("click", dismissDialog);
byId("save-name").addEventListener("input", function () {
  if (byId("save-name").getAttribute("aria-invalid")) {
    setFieldError(byId("save-name"), projectStore.validateName(byId("save-name").value) || "");
  }
});
byId("back-to-calc").addEventListener("click", function () { go(backTarget()); });
byId("new-calc").addEventListener("click", newCalculation);
byId("new-calc-empty").addEventListener("click", newCalculation);
byId("start-over-yes").addEventListener("click", startFresh);
byId("start-over-save").addEventListener("click", saveThenStartOver);
byId("start-over-cancel").addEventListener("click", dismissDialog);
// Escape works like Cancel (and like "Keep mine" for a shared link), with our
// own focus return instead of the browser's.
PANEL_DIALOGS.forEach(function (id) {
  byId(id).addEventListener("cancel", function (event) {
    event.preventDefault();
    if (id === "share-question") keepMine();
    else dismissDialog();
  });
});
byId("project-rows").addEventListener("click", onRowClick);
byId("waterfall-toggle").addEventListener("click", function () {
  waterfallAsTable = !waterfallAsTable;
  applyTableToggle("waterfall-toggle", byId("waterfall"), byId("waterfall-table"), waterfallAsTable);
});
byId("bullet-toggle").addEventListener("click", function () {
  bulletAsTable = !bulletAsTable;
  applyTableToggle("bullet-toggle", byId("bullet-chart"), byId("bullet-table"), bulletAsTable);
});
byId("bullet-rows").addEventListener("mouseover", function (event) {
  showBulletTip(event.target.closest(".bullet-row"));
});
byId("bullet-rows").addEventListener("mouseleave", function () { showBulletTip(null); });
byId("fix-button").addEventListener("click", function () {
  landOnGap = true;
  go({ screen: "results", project: this.dataset.id });
});
byId("pricing-card-link").addEventListener("click", function (event) {
  event.preventDefault();
  go({ screen: "projects" });
});
byId("project-rows").addEventListener("keydown", onRowKey);
byId("project-rows").addEventListener("focusout", function (event) {
  if (event.target.classList.contains("row-rename")) {
    finishRowRename(event.target.closest("tr").dataset.id, true);
  }
});
byId("crumb-name").addEventListener("click", startHeaderRename);
byId("crumb-input").addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    event.preventDefault();
    finishHeaderRename(true);
  } else if (event.key === "Escape") {
    finishHeaderRename(false);
  }
});
byId("crumb-input").addEventListener("blur", function () { finishHeaderRename(true); });

// Start: load saved projects and the draft, then go where the address says
// (the calculator by default).
projectList = projectStore.loadProjects(storage()).projects;
draft = projectStore.loadDraft(storage()).draft;
if (shareLink.isShareHash(location.hash)) {
  openShareLink(location.hash, true);
} else {
  const startState = stateFromAddress(location.hash);
  history.replaceState(startState, "", addressFor(startState));
  route(startState);
}
firstLoad = false;

// Bars and dots animate only after the first render, never on load.
requestAnimationFrame(function () {
  requestAnimationFrame(function () {
    document.body.classList.add("charts-ready");
  });
});

// ?grid in the address shows the layout columns over the page, for checking
// alignment. Off otherwise.
if (new URLSearchParams(location.search).has("grid")) {
  const overlay = document.createElement("div");
  overlay.className = "grid-overlay";
  overlay.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 12; i++) overlay.appendChild(document.createElement("span"));
  document.body.appendChild(overlay);
}
