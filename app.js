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

// Stats: 4 columns. Each is { label, value, unit, note }.
function renderStats(items) {
  const list = byId("metrics");
  list.textContent = "";
  items.forEach(function (item) {
    const group = document.createElement("div");
    const label = document.createElement("dt");
    label.textContent = item.label;
    const value = document.createElement("dd");
    value.textContent = item.value;
    if (item.unit) {
      const unit = document.createElement("span");
      unit.className = "stat-unit";
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
}

// "Restaurant menu · 2 pages · 2 rounds"
function jobSummary(values) {
  return job().name + " · " + countOf(values.count, job().item, job().items) + " · " +
    countOf(values.rounds, "round", "rounds");
}

function renderHero(r, values) {
  stopCountUp();
  const sentence = byId("hero-sentence");
  const warning = byId("offer-warning");
  byId("hero-job").textContent = jobSummary(values);

  if (r.offer) {
    const money = calc.formatMoney(r.offer.hourlyBefore);
    byId("hero-label").textContent = "This offer pays";
    byId("hero-amount").textContent = money.slice(1);
    byId("hero-unit").textContent = "/hr";
    byId("hero-spoken").textContent = money + " per hour";

    const target = calc.formatPrice(r.rate);
    if (r.offer.meetsTarget) {
      sentence.textContent = "for " + hoursInWords(r.hours.total) +
        " of real work. That meets your " + target + " target.";
    } else {
      sentence.textContent = "for " + hoursInWords(r.hours.total) + " of real work. That's " +
        calc.formatMoney(r.offer.shortPerHour) + " an hour under your " + target + " target.";
    }

    // Below expenses, the warning takes the sentence's place.
    if (r.offer.belowExpenses) {
      warning.innerHTML = ALERT_ICON + "<span></span>";
      warning.querySelector("span").textContent = "This offer is " +
        calc.formatMoney(r.offer.shortfall) + " less than your expenses alone.";
    }
    show(sentence, !r.offer.belowExpenses);
    show(warning, r.offer.belowExpenses);

    // No plus or minus signs: the label says which way the difference goes.
    let comparison;
    if (r.offer.gap > 0) {
      comparison = { label: "More than they offered", value: calc.formatPrice(r.offer.gap) };
    } else if (r.offer.gap < 0) {
      comparison = { label: "Less than they offered", value: calc.formatPrice(-r.offer.gap) };
    } else {
      comparison = { label: "Same as their offer", value: "$0" };
    }
    // "7.2 of 11.5 hrs". Below expenses the offer pays for none of it.
    const covered = r.offer.belowExpenses ? 0 : Math.min(r.offer.hoursCovered, r.hours.total);
    renderStats([
      { label: "Your estimate", value: calc.formatWholeMoney(r.estimate) },
      comparison,
      { label: "Hours the offer pays for", value: calc.formatNumber(covered),
        unit: "of " + calc.formatHours(r.hours.total) },
      { label: "After expenses", value: calc.formatMoney(r.offer.hourlyAfter), unit: "/hr" },
    ]);
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

    const forgotten = r.outsideProduction;
    renderStats([
      { label: "Total hours", value: calc.formatNumber(r.hours.total),
        unit: isOne(r.hours.total) ? "hr" : "hrs" },
      { label: "Your time at " + calc.formatPrice(r.rate) + "/hr", value: calc.formatMoney(r.timeCost) },
      { label: "Expenses", value: calc.formatMoney(r.expenses) },
      { label: "Usually forgotten", value: calc.formatNumber(forgotten),
        unit: isOne(forgotten) ? "hr" : "hrs",
        note: "worth " + calc.formatMoney(forgotten * r.rate) + " at your rate" },
    ]);
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
// Minimum space between two labels, in px.
const LABEL_GAP = 8;

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
      return { left: item.left, width: item.element.offsetWidth };
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
  line.classList.remove("flip");
  if (flag) {
    lineLabel.textContent = flag;
    line.style.left = "0px";
  } else if (lineX !== null) {
    lineLabel.textContent = calc.formatPrice(offer.amount) + " runs out at " +
      calc.formatHours(offer.hoursCovered);
    line.style.left = lineX + "px";
    // The label sits right of the line, unless that would run past the edge.
    if (lineX + LABEL_SPACE + lineLabel.offsetWidth > width) line.classList.add("flip");
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
    label.style.left = Math.min(0, width - (left + label.offsetWidth)) + "px";
  }

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

function renderOfferChart(r) {
  const chart = byId("offer-chart");
  show(chart, Boolean(r.offer));
  byId("hours-chart").parentElement.classList.toggle("single", !r.offer);
  if (!r.offer) return;
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

  let summary;
  if (offer.hourlyAfter < 0) {
    summary = "After expenses, this offer loses money however many hours the job takes.";
  } else if (offer.hourlyAfter === 0) {
    summary = "After expenses, this offer pays nothing for your time.";
  } else {
    summary = "After expenses, the offer pays " + calc.formatMoney(offer.hourlyAfter) +
      " an hour for " + hoursInWords(r.hours.total) + ". It pays your " +
      calc.formatPrice(r.rate) + " target or more " + (offer.coversAllHours ? "" : "only ") +
      "up to " + calc.formatHours(offer.hoursCovered) + ".";
  }
  byId("offer-summary").textContent = summary;

  layoutRateChart(r);
}

// The smallest round step that gives at most 7 grid spaces: 0.5, 1, 2, 5, 10...
function niceStep(rough) {
  const steps = [0.25, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
  for (let i = 0; i < steps.length; i++) if (steps[i] >= rough) return steps[i];
  return steps[steps.length - 1];
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
function layoutRateChart(r) {
  const plot = byId("rate-plot");
  const width = plot.clientWidth;
  if (!width) return;
  const height = 210;
  const pad = { left: 40, right: 4, top: 12, bottom: 26 };
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
  const svg = svgElement(plot, "svg", { width: width, height: height, viewBox: "0 0 " + width + " " + height });

  for (let h = x0; h <= x1 + 1e-9; h += step) {
    svgElement(svg, "line", { class: "rate-grid", x1: px(h), x2: px(h), y1: pad.top, y2: height - pad.bottom });
    svgElement(svg, "text", { class: "rate-tick", x: px(h), y: height - 6, "text-anchor": "middle" },
      calc.formatNumber(h) + "h");
  }

  // Y labels: the target always; $0, the top, and the bottom only where they
  // don't crowd it.
  const yLabels = [[r.rate, calc.formatPrice(r.rate)]];
  [[0, "$0"], [top, calc.formatPrice(top)], [bottom, "-" + calc.formatPrice(-bottom)]]
    .forEach(function (item) {
      if (item[0] === r.rate || (item[0] === bottom && bottom >= 0)) return;
      if (Math.abs(py(item[0]) - py(r.rate)) >= 16) yLabels.push(item);
    });
  yLabels.forEach(function (item) {
    svgElement(svg, "text", { class: "rate-tick", x: pad.left - 8, y: py(item[0]) + 4, "text-anchor": "end" }, item[1]);
  });
  if (bottom < 0) {
    svgElement(svg, "line", { class: "rate-zero", x1: pad.left, x2: width - pad.right, y1: py(0), y2: py(0) });
  }

  // The target: a solid line. Its label is placed last, where there's room.
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
  svgElement(svg, "path", { class: "rate-curve", d: points.join(" ") });

  // Each label takes the spot with the fewest conflicts: leaving the plot is
  // worst, then touching another label or a dot, then the curve, then the target line.
  const taken = [];
  function conflicts(box) {
    let score = 0;
    if (box.x < 0 || box.x + box.width > width || box.y < 0 || box.y + box.height > height - pad.bottom) score += 100;
    taken.forEach(function (other) {
      if (box.x < other.x + other.width + 4 && other.x < box.x + box.width + 4 &&
          box.y < other.y + other.height + 4 && other.y < box.y + box.height + 4) score += 10;
    });
    const hitsCurve = samples.some(function (point) {
      return point.x > box.x - 3 && point.x < box.x + box.width + 3 &&
        point.y > box.y - 3 && point.y < box.y + box.height + 3;
    });
    if (hitsCurve) score += 5;
    if (targetY > box.y - 3 && targetY < box.y + box.height + 3) score += 2;
    return score;
  }
  // spots: [x, y, anchor] in order of preference.
  function placeText(label, spots) {
    let best = null;
    spots.forEach(function (spot) {
      label.setAttribute("x", spot[0]);
      label.setAttribute("y", spot[1]);
      label.setAttribute("text-anchor", spot[2]);
      const score = conflicts(label.getBBox());
      if (!best || score < best.score) best = { spot: spot, score: score };
    });
    label.setAttribute("x", best.spot[0]);
    label.setAttribute("y", best.spot[1]);
    label.setAttribute("text-anchor", best.spot[2]);
    taken.push(label.getBBox());
  }

  // Now: a glowing red dot at the current hours.
  const dotX = px(total);
  const dotY = py(value(total));
  const dot = svgElement(svg, "g", { class: "rate-now" });
  svgElement(dot, "circle", { class: "rate-halo", cx: dotX, cy: dotY, r: 14 });
  svgElement(dot, "circle", { class: "rate-dot", cx: dotX, cy: dotY, r: 7 });
  taken.push({ x: dotX - 14, y: dotY - 14, width: 28, height: 28 });

  // Where the curve meets the target: the same hours as "runs out".
  let cross = null;
  if (net > 0 && offer.hoursCovered >= x0 && offer.hoursCovered <= x1) {
    cross = px(offer.hoursCovered);
    svgElement(svg, "circle", { class: "rate-cross", cx: cross, cy: targetY, r: 3.5 });
    taken.push({ x: cross - 4, y: targetY - 4, width: 8, height: 8 });
  }

  const nowLabel = svgElement(svg, "text", { class: "rate-label rate-now-label" },
    calc.formatNumber(total) + "h → " + calc.formatMoney(value(total)) + "/hr after expenses");
  placeText(nowLabel, [
    [dotX + 14, dotY + 28, "start"], [dotX + 18, dotY - 18, "start"],
    [dotX - 14, dotY + 28, "end"], [dotX - 18, dotY - 18, "end"],
    [dotX, dotY + 30, "middle"], [dotX, dotY - 22, "middle"],
    [dotX - 18, dotY - 34, "end"], [dotX + 18, dotY - 34, "start"],
    [dotX, dotY - 38, "middle"], [dotX, dotY + 44, "middle"],
  ]);

  if (cross !== null) {
    const crossLabel = svgElement(svg, "text", { class: "rate-label" },
      "at " + calc.formatNumber(offer.hoursCovered) + "h you hit " + calc.formatPrice(r.rate));
    placeText(crossLabel, [
      [cross - 8, targetY - 8, "end"], [cross + 8, targetY - 8, "start"],
      [cross - 8, targetY + 16, "end"], [cross + 8, targetY + 16, "start"],
      [cross - 8, targetY - 24, "end"], [cross - 8, targetY + 32, "end"],
      [cross, targetY - 24, "middle"], [cross, targetY + 32, "middle"],
    ]);
  }

  const targetLabel = svgElement(svg, "text", { class: "rate-label" },
    "your target " + calc.formatPrice(r.rate) + "/hr");
  placeText(targetLabel, [
    [width - pad.right, targetY - 8, "end"], [pad.left + 4, targetY - 8, "start"],
    [width - pad.right, targetY + 16, "end"], [pad.left + 4, targetY + 16, "start"],
  ]);
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
    if (row[3]) tr.className = row[3];
    const th = document.createElement("th");
    th.scope = "row";
    th.textContent = row[0];
    const amount = document.createElement("td");
    amount.textContent = row[2];
    // The final row has no math, so its larger label can use that column too.
    if (row[3] === "total") {
      th.colSpan = 2;
      tr.append(th, amount);
    } else {
      const math = document.createElement("td");
      math.textContent = row[1];
      tr.append(th, math, amount);
    }
    body.appendChild(tr);
  });
}

function renderQuote(r, quoteError) {
  const line = byId("quote-result");
  byId("quote").placeholder = String(r.estimate);
  show(line, !quoteError);
  if (quoteError) return;

  const price = calc.formatPrice(r.quote.amount);
  let text = "At " + price + ", you'd earn " + calc.formatMoney(r.quote.hourlyBefore) +
    "/hr before expenses and " + calc.formatMoney(r.quote.hourlyAfter) + "/hr after.";
  const difference = r.quote.differenceFromEstimate;
  if (r.quote.isCustom && difference !== 0) {
    text += " That's " + calc.formatPrice(Math.abs(difference)) +
      (difference < 0 ? " below" : " above") + " your estimate.";
  }
  line.textContent = text;
}

// Reply

// The draft from CLAUDE.md, using the quote if there is one, or the estimate.
// "For a logo with 3 concepts and 2 rounds of changes, my price is $310."
function buildReply(r, values) {
  const price = calc.formatPrice(r.quote.amount);
  const items = countOf(values.count, job().item, job().items);
  const rounds = countOf(values.rounds, "round", "rounds") + " of changes";
  let text = "Hi! Thanks for reaching out about the " + job().about + ". For " + job().phrase +
    " with " + items + " and " + rounds + ", my price is " + price + ".";
  if (r.offer && r.quote.amount > r.offer.amount) {
    text += " I know that's more than the " + calc.formatPrice(r.offer.amount) +
      " you mentioned, so I'm happy to talk about what would fit your budget.";
  }
  return text + " Let me know if you have any questions!";
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
function renderCheckButton(values, hours) {
  const preview = byId("check-preview");
  const hasOffer = values.hasOffer;
  byId("check-title").textContent = hasOffer ? "Check the offer" : "Get my estimate";
  if (!hours) {
    show(preview, false);
    return;
  }
  preview.textContent = calc.formatHours(hours.total) + " of work " + (hasOffer
    ? "for " + calc.formatPrice(values.offer)
    : "at " + calc.formatPrice(values.rate) + "/hr");
  show(preview, true);
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
function useEstimate() {
  byId("quote").value = "";
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
  if (state !== "result") {
    show(byId("offer-chart"), false);
    show(byId("quote-result"), false);
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
  const items = upperFirst(j.items);
  byId("count-label").textContent = items;
  byId("bar-count-label").textContent = items;
  byId("steppers-items").textContent = items;
  byId("setup-label").textContent = j.setup;
  byId("item-label").textContent = "Design, per " + j.item;
  byId("delivery-label").textContent = j.delivery;
  document.querySelectorAll('button[data-target="count"]').forEach(function (button) {
    button.setAttribute("aria-label",
      (button.dataset.step === "1" ? "One more " : "One less ") + j.item);
  });

  // "Fewer pages may not save time…" only makes sense for the menu.
  const isMenu = currentJob() === "menu";
  show(byId("page-hours-hint"), isMenu);
  byId("item-hours").setAttribute("aria-describedby",
    "unit-item-hours" + (isMenu ? " page-hours-hint" : ""));
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
  autosave();
}

function updatePage(commit) {
  const checked = calc.validateInputs(readForm(), currentJob());
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
    renderCheckButton(checked.values, null);
    renderErrorState(errors);
    showResultState("errors");
    return;
  }

  const r = calc.calculate(checked.values);
  renderGroupTotals(r.hours);
  renderTotals(r.hours);
  renderRowBars(checked.values);
  renderCheckButton(checked.values, r.hours);
  if (!r.hasHours) {
    showResultState("no-hours");
    return;
  }

  showResultState("result");
  lastResult = r;
  renderHero(r, checked.values);
  renderHoursChart(r);
  renderOfferChart(r);
  renderReceipt(r, checked.values);
  if (!errors.quote) renderReply(r, checked.values);
  if (!errors.quote || shownErrors.quote) renderQuote(r, errors.quote);
}

// Charts measure the page, so they redraw when the size or font changes.
let lastResult = null;

function relayoutCharts() {
  layoutTally(lastHours);
  if (!lastResult || byId("result").hidden) return;
  layoutHoursChart(lastResult);
  if (lastResult.offer) layoutRateChart(lastResult);
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
const COUNT_UP_MS = 500;
let countFrame = null;
let countTimer = null;

function stopCountUp() {
  if (countFrame) cancelAnimationFrame(countFrame);
  clearTimeout(countTimer);
  countFrame = null;
  countTimer = null;
}

// The digits after the "$", which has its own smaller, raised span.
function paintHeroNumber(r, value) {
  const money = r.offer ? calc.formatMoney(value) : calc.formatWholeMoney(Math.round(value));
  byId("hero-amount").textContent = money.slice(1);
}

function countUpHero(r) {
  stopCountUp();
  const target = r.offer ? r.offer.hourlyBefore : r.estimate;
  const started = performance.now();
  paintHeroNumber(r, 0);
  function frame(now) {
    const t = Math.min(1, (now - started) / COUNT_UP_MS);
    paintHeroNumber(r, target * (1 - Math.pow(1 - t, 3)));
    countFrame = t < 1 ? requestAnimationFrame(frame) : null;
    if (t === 1) stopCountUp();
  }
  countFrame = requestAnimationFrame(frame);
  // If frames don't run (for example a background tab), still land on the value.
  countTimer = setTimeout(function () {
    stopCountUp();
    paintHeroNumber(r, target);
  }, COUNT_UP_MS + 100);
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

// The browser's Back button goes from results to inputs, with every value kept.
// Showing the results adds a history step; Back (or "Edit details") removes it.
function openResults() {
  showScreen("results");
  relayoutCharts();
  const target = ["hero-label", "empty-state", "error-state"].map(byId).filter(function (element) {
    return !element.hidden && !element.closest("[hidden]");
  })[0];
  if (target) target.focus();
}

function openInputs() {
  showScreen("inputs");
  // The tally measures its width, so it draws once screen 1 is showing.
  relayoutCharts();
  byId("page-title").focus();
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
  if (state.screen === "results") openResults();
  else openInputs();
}

window.addEventListener("popstate", function (event) {
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

// If saving fails, the page keeps working and says so.
function showSaveResult(ok) {
  show(byId("save-error"), !ok);
  show(byId("save-status"), ok);
  return ok;
}

function persist() {
  const ok = showSaveResult(projectStore.saveProjects(storage(), projectList).ok);
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
    job: currentJob(),
    inputs: inputs,
    quote: raw.quote,
    reply: byId("reply").value,
    replyEdited: draftWhenEdited !== null,
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
  loadingValues = true;
  stopCountUp();
  clearTimeout(commitTimer);

  byId("job-" + values.job).checked = true;
  loadedJob = values.job;
  Object.keys(FIELD_IDS).forEach(function (name) {
    if (name !== "quote") byId(FIELD_IDS[name]).value = values.inputs[name];
  });
  byId(values.inputs.offerStatus === "none" ? "offer-none" : "offer-yes").checked = true;
  byId("quote").value = values.quote;
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
    closePanels();
    show(byId("start-over"), true);
    byId("start-over-cancel").focus();
  } else {
    startFresh();
  }
}

// "Save as project" from the start-over question: show the draft, save it,
// then start the new calculation.
function saveThenStartOver() {
  go({ screen: "inputs" });
  openSaveField(startFresh);
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

  const button = byId("save-project");
  button.hidden = !inCalculator;
  button.disabled = Boolean(project);
  button.textContent = project ? "Saved" : "Save as project";
}

function closePanels() {
  show(byId("save-panel"), false);
  show(byId("start-over"), false);
  setFieldError(byId("save-name"), "");
}

// "Save as project": a name field under the header, filled in and selected so
// typing replaces it. then runs after a successful save.
function openSaveField(then) {
  closePanels();
  afterSave = then || null;
  const input = byId("save-name");
  input.value = projectStore.defaultProjectName(currentJob(), new Date());
  show(byId("save-panel"), true);
  input.focus();
  input.select();
}

function cancelSaveField() {
  afterSave = null;
  closePanels();
  byId("save-project").focus();
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
  projectList = projectList.concat([project]);
  persist();
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
  show(byId("save-status"), true);
  byId("crumb-name").focus();
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

function openProjects() {
  showScreen("projects");
  renderProjects();
  byId("projects-title").focus();
}

// Estimate and offer per hour for a row, from the saved numbers.
function projectSummary(project) {
  const raw = Object.assign({}, project.inputs, { quote: project.quote });
  const checked = calc.validateInputs(raw, project.job);
  const blocking = Object.keys(checked.errors).filter(function (name) { return name !== "quote"; });
  if (blocking.length) return { estimate: "No estimate yet", offer: "" };
  const r = calc.calculate(checked.values);
  if (!r.hasHours) return { estimate: "No estimate yet", offer: "" };
  return {
    estimate: calc.formatWholeMoney(r.estimate),
    offer: r.offer ? calc.formatMoney(r.offer.hourlyBefore) + "/hr" : "No offer yet",
  };
}

function cell(row, className, text) {
  const td = document.createElement("td");
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

  const body = byId("project-rows");
  body.textContent = "";
  list.forEach(function (project) {
    const row = document.createElement("tr");
    row.dataset.id = project.id;
    const summary = projectSummary(project);
    const mode = rowMode && rowMode.id === project.id ? rowMode.mode : null;

    const nameCell = document.createElement("th");
    nameCell.scope = "row";
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
  // fromInputs: Back from here returns to screen 1 of the same calculation.
  const state = { screen: "results", project: currentId || undefined, fromInputs: true };
  history.pushState(state, "", addressFor(state));
  revealResults();
}

// The reveal plays once per press of "Check the offer": screen 1 fades out, the
// button's gradient circle grows into the hero panel (400ms), the number counts up,
// the paid fill sweeps left to right, then the red dot appears. Under reduced
// motion, the final state shows right away. Later changes use the normal transitions.
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const REVEAL_FADE_MS = 200;
const REVEAL_GROW_MS = 400;
const REVEAL_REST_MS = 1500;

function rectFrame(rect) {
  return { left: rect.left + "px", top: rect.top + "px", width: rect.width + "px", height: rect.height + "px" };
}

// Timers of a reveal in progress, so leaving the screen can stop it.
let revealTimers = [];

function cancelReveal() {
  revealTimers.forEach(clearTimeout);
  revealTimers = [];
  document.querySelectorAll(".reveal-orb").forEach(function (orb) { orb.remove(); });
  document.body.classList.remove("revealing", "reveal-out", "reveal-in");
}

function revealResults() {
  const body = document.body;
  cancelReveal();
  if (reduceMotion.matches || !Element.prototype.animate) {
    openResults();
    return;
  }

  // A copy of the gradient circle, fixed where the button's circle is.
  const from = byId("check-circle").getBoundingClientRect();
  const orb = document.createElement("div");
  orb.className = "reveal-orb";
  orb.setAttribute("aria-hidden", "true");
  Object.assign(orb.style, rectFrame(from));
  body.appendChild(orb);
  body.classList.add("revealing", "reveal-out");

  revealTimers.push(setTimeout(function () {
    body.classList.remove("reveal-out");
    openResults();
    const to = byId("hero-panel").getBoundingClientRect();
    const start = Object.assign(rectFrame(from), { borderRadius: from.width / 2 + "px" });
    const end = Object.assign(rectFrame(to), { borderRadius: "28px" });
    orb.animate([start, end], { duration: REVEAL_GROW_MS, easing: "cubic-bezier(0.3, 0.7, 0.2, 1)", fill: "forwards" });

    revealTimers.push(setTimeout(function () {
      body.classList.add("reveal-in");
      if (lastResult && !byId("result-summary").hidden) countUpHero(lastResult);
      orb.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" })
        .onfinish = function () { orb.remove(); };
      // Clean up even if the fade never reports finishing (for example a background tab).
      revealTimers.push(setTimeout(cancelReveal, REVEAL_REST_MS));
    }, REVEAL_GROW_MS));
  }, REVEAL_FADE_MS));
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

document.querySelectorAll('input[name="job"]').forEach(function (radio) {
  radio.addEventListener("change", switchJob);
});
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
byId("copy-reply").addEventListener("click", copyReply);

let resizeFrame = null;
window.addEventListener("resize", function () {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(relayoutCharts);
});

if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(relayoutCharts);
}

// Projects and saving: the header, the save field, the start-over question, and the list.
byId("projects-link").addEventListener("click", function (event) {
  event.preventDefault();
  go({ screen: "projects" });
});
byId("save-project").addEventListener("click", function () { openSaveField(null); });
byId("save-form").addEventListener("submit", saveAsProject);
byId("save-cancel").addEventListener("click", cancelSaveField);
byId("save-name").addEventListener("keydown", function (event) {
  if (event.key === "Escape") cancelSaveField();
});
byId("save-name").addEventListener("input", function () {
  if (byId("save-name").getAttribute("aria-invalid")) {
    setFieldError(byId("save-name"), projectStore.validateName(byId("save-name").value) || "");
  }
});
byId("new-calc").addEventListener("click", newCalculation);
byId("new-calc-empty").addEventListener("click", newCalculation);
byId("start-over-yes").addEventListener("click", startFresh);
byId("start-over-save").addEventListener("click", saveThenStartOver);
byId("start-over-cancel").addEventListener("click", function () {
  closePanels();
  byId(projectList.length ? "new-calc" : "new-calc-empty").focus();
});
byId("project-rows").addEventListener("click", onRowClick);
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
const startState = stateFromAddress(location.hash);
history.replaceState(startState, "", addressFor(startState));
route(startState);

// Bars and dots animate only after the first render, never on load.
requestAnimationFrame(function () {
  requestAnimationFrame(function () {
    document.body.classList.add("charts-ready");
  });
});
