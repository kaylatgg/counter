// Counter page behavior: reads the fields, runs the math from calc.js,
// and writes the results onto the page. All math lives in calc.js.

// Which field on the page holds each value calc.js needs.
const FIELD_IDS = {
  pages: "pages",
  rounds: "rounds",
  conceptHours: "concept-hours",
  pageHours: "page-hours",
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

function renderMetrics(items) {
  const list = byId("metrics");
  list.textContent = "";
  items.forEach(function (item) {
    const group = document.createElement("div");
    const label = document.createElement("dt");
    label.textContent = item[0];
    const value = document.createElement("dd");
    value.textContent = item[1];
    group.append(label, value);
    list.appendChild(group);
  });
}

function renderHero(r) {
  const sentence = byId("hero-sentence");
  const warning = byId("offer-warning");

  if (r.offer) {
    // "$17.39" shows as "$17" plus dimmed ".39". Screen readers get it in one piece.
    const money = calc.formatMoney(r.offer.hourlyBefore);
    const point = money.lastIndexOf(".");
    byId("hero-label").textContent = "This offer pays";
    byId("hero-whole").textContent = money.slice(0, point);
    byId("hero-cents").textContent = money.slice(point);
    byId("hero-unit").textContent = "/hr";
    byId("hero-spoken").textContent = money + " per hour";

    const target = calc.formatPrice(r.rate);
    if (r.offer.meetsTarget) {
      setRichText(sentence, ["for ", [hoursInWords(r.hours.total)],
        " of real work. That meets your " + target + " target."]);
    } else {
      setRichText(sentence, ["for ", [hoursInWords(r.hours.total)],
        " of real work. That's ", [calc.formatMoney(r.offer.shortPerHour) + " an hour", "signal"],
        " under your " + target + " target."]);
    }

    // Below expenses, the warning takes the sentence's place.
    if (r.offer.belowExpenses) {
      warning.innerHTML = ALERT_ICON + "<span></span>";
      warning.querySelector("span").textContent = "This offer is " +
        calc.formatMoney(r.offer.shortfall) + " less than your expenses alone.";
    }
    show(sentence, !r.offer.belowExpenses);
    show(warning, r.offer.belowExpenses);

    let comparison;
    if (r.offer.gap > 0) {
      comparison = ["Above the offer", "+" + calc.formatPrice(r.offer.gap)];
    } else if (r.offer.gap < 0) {
      comparison = ["Below the offer", "-" + calc.formatPrice(-r.offer.gap)];
    } else {
      comparison = ["Matches the offer", "$0"];
    }
    renderMetrics([
      ["After expenses", calc.formatMoney(r.offer.hourlyAfter) + "/hr"],
      ["Your estimate", calc.formatWholeMoney(r.estimate)],
      comparison,
    ]);
  } else {
    const estimate = calc.formatWholeMoney(r.estimate);
    byId("hero-label").textContent = "Estimated project price";
    byId("hero-whole").textContent = estimate;
    byId("hero-cents").textContent = "";
    byId("hero-unit").textContent = "";
    byId("hero-spoken").textContent = estimate;

    const parts = [[calc.formatHours(r.hours.total)], " at your ",
      [calc.formatMoney(r.rate) + "/hr"], " target, plus ",
      [calc.formatMoney(r.expenses)], " in expenses."];
    if (r.rounding > 0) {
      parts.push(" Rounded up from ", [calc.formatMoney(r.subtotal)], ".");
    }
    setRichText(sentence, parts);
    show(sentence, true);
    show(warning, false);

    renderMetrics([
      ["Total hours", calc.formatNumber(r.hours.total)],
      ["Your time", calc.formatMoney(r.timeCost)],
      ["Expenses", calc.formatMoney(r.expenses)],
    ]);
  }
}

const GROUP_NAMES = {
  production: "Production",
  communication: "Communication",
  revisions: "Revisions",
  delivery: "Delivery",
};

// Chart sizes from docs/DESIGN.md, in px.
const BLOCK_GAP = 4;
const GROUP_GAP = 14;
const BLOCK_MIN = 8;
const BLOCK_MAX = 22;
const BLOCK_HEIGHT = 56;
const LINE_ABOVE = 34;
const LABEL_SPACE = 12;
const BAND_LABEL_MIN = 64;

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

// Chart 1: Your hours, and where the money runs out

function renderHoursChart(r) {
  const total = r.hours.total;
  const offer = r.offer;
  byId("hours-title").textContent = offer
    ? "Your " + hoursInWords(total) + ", and where the money runs out"
    : "Your " + hoursInWords(total);

  const unit = calc.blockUnit(total);
  byId("block-unit").textContent = "1 block = " + (unit === 0.5 ? "30 min" : calc.formatHours(unit));

  // No line in these two cases, so the label sits next to the title.
  let flag = "";
  if (offer && offer.belowExpenses) {
    flag = calc.formatPrice(offer.amount) + " doesn't cover your expenses";
  } else if (offer && offer.coversAllHours) {
    flag = calc.formatPrice(offer.amount) + " covers all " + calc.formatHours(total);
  }
  byId("hours-flag").textContent = flag;
  show(byId("hours-flag"), flag !== "");

  // What screen readers get instead of the blocks.
  const items = ensureChildren(byId("hours-list"), WORK_GROUPS.length, function () {
    return document.createElement("li");
  });
  WORK_GROUPS.forEach(function (group, i) {
    items[i].textContent = GROUP_NAMES[group] + ": " + calc.formatHours(r.hours[group]);
  });

  const parts = [];
  const unpaid = offer ? offer.unpaidHours : 0;
  if (unpaid > 1e-9) {
    parts.push([hoursInWords(unpaid)], isOne(unpaid) ? " goes unpaid, and " : " go unpaid, and ");
  }
  if (r.outsideProduction > 0) {
    parts.push([hoursInWords(r.outsideProduction)],
      isOne(r.outsideProduction) ? " is work outside the design itself." : " are work outside the design itself.");
  } else {
    parts.push(parts.length ? "all " : "All ", [hoursInWords(total)], " are production.");
  }
  setRichText(byId("hours-summary"), parts);

  layoutBlocks(r);
}

// Draws the blocks, dims what the offer doesn't pay for, and places the lime line.
function layoutBlocks(r) {
  const container = byId("blocks");
  const width = container.clientWidth;
  if (!width) return;

  const total = r.hours.total;
  const unit = calc.blockUnit(total);
  const groups = WORK_GROUPS.filter(function (group) { return r.hours[group] > 1e-9; });
  const blocksByGroup = groups.map(function (group) {
    return calc.splitIntoBlocks(r.hours[group], unit);
  });

  // Block width fills the space: (width minus gaps) divided by blocks, 8px to 22px.
  let gaps = (groups.length - 1) * GROUP_GAP;
  blocksByGroup.forEach(function (blocks) { gaps += (blocks.length - 1) * BLOCK_GAP; });
  const blockWidth = Math.min(BLOCK_MAX, Math.max(BLOCK_MIN, (width - gaps) / (total / unit)));

  // Where the money runs out, in hours from the start. Infinity means never.
  const offer = r.offer;
  let covered = Infinity;
  if (offer && offer.belowExpenses) covered = 0;
  else if (offer && !offer.coversAllHours) covered = offer.hoursCovered;
  const showLine = Boolean(offer) && !offer.belowExpenses && !offer.coversAllHours;

  // Reuse the group elements that exist, in the fixed order.
  const line = byId("runs-out");
  container.querySelectorAll(".block-group").forEach(function (element) {
    if (groups.indexOf(element.dataset.group) === -1) element.remove();
  });

  let start = 0;
  let lineBlock = null;
  let lineFraction = 0;

  groups.forEach(function (group, g) {
    let element = container.querySelector('.block-group[data-group="' + group + '"]');
    if (!element) {
      element = document.createElement("div");
      element.className = "block-group";
      element.dataset.group = group;
      element.innerHTML = '<div class="block-row"></div><p class="group-label"><b></b> <span></span></p>';
    }
    container.appendChild(element);
    element.querySelector(".group-label b").textContent = calc.formatNumber(r.hours[group]) + "h";
    element.querySelector(".group-label span").textContent = GROUP_NAMES[group];

    const sizes = blocksByGroup[g];
    const blocks = ensureChildren(element.querySelector(".block-row"), sizes.length, function () {
      const block = document.createElement("div");
      block.className = "block";
      return block;
    });

    blocks.forEach(function (block, i) {
      const end = start + sizes[i] * unit;
      block.style.width = (sizes[i] * blockWidth) + "px";

      // Fully paid, fully unpaid (28% opacity), or split by the line.
      const paid = end <= covered + 1e-9;
      const unpaid = start >= covered - 1e-9;
      block.classList.toggle("unpaid", unpaid && !paid);
      if (!paid && !unpaid) {
        const percent = ((covered - start) / (end - start)) * 100;
        block.style.setProperty("--paid", percent.toFixed(2) + "%");
        block.classList.add("split");
      } else {
        block.classList.remove("split");
      }

      if (showLine && !lineBlock && covered >= start - 1e-9 && covered <= end + 1e-9) {
        lineBlock = block;
        lineFraction = (covered - start) / (end - start);
      }
      start = end;
    });
  });

  show(line, showLine && Boolean(lineBlock));
  if (showLine && lineBlock) {
    // Measured from the chart's own edge, since blocks sit inside their group.
    const box = container.getBoundingClientRect();
    const blockBox = lineBlock.getBoundingClientRect();
    const x = blockBox.left - box.left + lineFraction * blockBox.width;
    line.style.left = x + "px";
    line.style.top = (blockBox.top - box.top - LINE_ABOVE) + "px";
    line.style.height = (LINE_ABOVE + BLOCK_HEIGHT) + "px";
    byId("runs-out-label").textContent = calc.formatPrice(offer.amount) + " runs out at " +
      calc.formatHours(offer.hoursCovered);
    // The label sits right of the line, unless that would run past the edge.
    const label = byId("runs-out-label");
    line.classList.remove("flip");
    if (x + LABEL_SPACE + label.offsetWidth > width) line.classList.add("flip");
  }

  placeGroupLabels(container);
}

// Group labels may run past their group, but never into another label.
// A label that would collide moves down to the first row where it fits.
const LABEL_ROW_HEIGHT = 20;

function placeGroupLabels(container) {
  const width = container.clientWidth;
  const rowEnds = [];
  container.querySelectorAll(".block-group").forEach(function (element) {
    const label = element.querySelector(".group-label");
    // Shift left if the label would run past the chart's right edge.
    const shift = Math.min(0, width - (element.offsetLeft + label.offsetWidth));
    label.style.left = shift + "px";
    const left = element.offsetLeft + shift;

    let row = 0;
    while (row < rowEnds.length && left < rowEnds[row] + LABEL_SPACE) row++;
    rowEnds[row] = left + label.offsetWidth;
    label.style.setProperty("--row", row);
  });
  container.style.setProperty("--label-rows", Math.max(1, rowEnds.length));
}

// Chart 2: Pay per hour

function renderOfferChart(r) {
  const chart = byId("offer-chart");
  show(chart, Boolean(r.offer));
  if (!r.offer) return;
  const offer = r.offer;

  const items = byId("pay-list").children;
  items[0].textContent = "Offer, before expenses: " + calc.formatMoney(offer.hourlyBefore) + "/hr";
  items[1].textContent = "Offer, after " + calc.formatMoney(r.expenses) + " expenses: " +
    calc.formatMoney(offer.hourlyAfter) + "/hr";
  items[2].textContent = "Your target rate: " + calc.formatMoney(r.rate) + "/hr";

  let summary = offer.meetsTarget
    ? "Before expenses, the offer meets your target rate."
    : "Before expenses, the offer pays " + calc.formatMoney(offer.shortPerHour) +
      " an hour less than your target.";
  if (offer.hourlyAfter < 0) {
    summary += " After expenses, it pays less than $0 an hour, so you would lose money on this job.";
  }
  byId("offer-summary").textContent = summary;

  layoutRuler(r);
}

// Puts a label left or right of x. Returns its left and right edges.
function placeSide(label, x, side, width) {
  const w = label.offsetWidth;
  let left = side === "right" ? x + LABEL_SPACE - 2 : x - LABEL_SPACE + 2 - w;
  left = Math.max(0, Math.min(width - w, left));
  label.style.left = left + "px";
  return { left: left, right: left + w };
}

function placeCentered(label, x, width) {
  const w = label.offsetWidth;
  const left = Math.max(0, Math.min(width - w, x - w / 2));
  label.style.left = left + "px";
  return { left: left, right: left + w };
}

function overlaps(a, b) {
  return a.left < b.right + 6 && b.left < a.right + 6;
}

function layoutRuler(r) {
  const ruler = byId("ruler");
  const width = ruler.clientWidth;
  if (!width) return;
  const offer = r.offer;

  const scale = calc.rulerScale(Math.max(offer.hourlyBefore, offer.hourlyAfter, r.rate));
  // Below $0 draws at $0 and keeps its negative label.
  function x(value) {
    return (Math.max(0, value) / scale.max) * width;
  }

  // Ticks and their labels: first label left-aligned, last right-aligned.
  const ticks = ensureChildren(byId("ruler-ticks"), scale.ticks.length, function () {
    const tick = document.createElement("div");
    tick.className = "tick";
    tick.innerHTML = "<span></span>";
    return tick;
  });
  ticks.forEach(function (tick, i) {
    tick.style.left = x(scale.ticks[i]) + "px";
    tick.className = "tick" + (i === 0 ? " first" : "") + (i === ticks.length - 1 ? " last" : "");
    tick.querySelector("span").textContent = calc.formatWholeMoney(scale.ticks[i]);
  });

  const offerX = x(offer.hourlyBefore);
  const afterX = x(offer.hourlyAfter);
  const targetX = x(r.rate);
  byId("dot-offer").style.left = offerX + "px";
  byId("dot-after").style.left = afterX + "px";
  byId("target-mark").style.left = targetX + "px";

  // The gap: a dashed lime band from the offer to the target.
  const band = byId("gap-band");
  const gapLabel = byId("gap-label");
  const bandWidth = targetX - offerX;
  show(band, !offer.meetsTarget);
  if (!offer.meetsTarget) {
    band.style.left = offerX + "px";
    band.style.width = bandWidth + "px";
    gapLabel.textContent = "-" + calc.formatMoney(offer.shortPerHour) + "/hr";
  }
  show(gapLabel, !offer.meetsTarget && bandWidth >= BAND_LABEL_MIN);
  if (!offer.meetsTarget) placeCentered(gapLabel, offerX + bandWidth / 2, width);

  // Above the target: a small "+$X/hr" between the target and the offer.
  const overLabel = byId("over-label");
  const overCents = Math.round((offer.hourlyBefore - r.rate) * 100);
  const showOver = overCents > 0 && offerX - targetX >= BAND_LABEL_MIN;
  show(overLabel, showOver);
  if (showOver) {
    overLabel.textContent = "+" + calc.formatMoney(overCents / 100) + "/hr";
    placeCentered(overLabel, (targetX + offerX) / 2, width);
  }

  // Labels above the ruler: target centered, offer to the right, after expenses to the left.
  const targetLabel = byId("target-label");
  const offerLabel = byId("offer-label");
  const afterLabel = byId("after-label");
  targetLabel.textContent = "target " + calc.formatPrice(r.rate);
  offerLabel.textContent = "offer " + calc.formatMoney(offer.hourlyBefore);
  afterLabel.textContent = "after expenses " + calc.formatMoney(offer.hourlyAfter);

  const targetBox = placeCentered(targetLabel, targetX, width);

  // The offer label goes right of its dot, or left if that collides with the target.
  // If the offer sits right on the target, it drops below the ruler.
  offerLabel.classList.remove("below");
  let offerBox = placeSide(offerLabel, offerX, "right", width);
  if (overlaps(offerBox, targetBox)) offerBox = placeSide(offerLabel, offerX, "left", width);
  if (overlaps(offerBox, targetBox)) {
    offerLabel.classList.add("below");
    offerBox = placeSide(offerLabel, offerX, "right", width);
  }
  const aboveBoxes = [targetBox];
  const belowBoxes = [];
  if (offerLabel.classList.contains("below")) belowBoxes.push(offerBox);
  else aboveBoxes.push(offerBox);
  if (!gapLabel.hidden) belowBoxes.push(boxOf(gapLabel));

  // If labels would overlap, the after-expenses label moves below the ruler.
  afterLabel.classList.remove("below");
  let afterBox = placeBeside(afterLabel, afterX, width);
  if (aboveBoxes.some(function (box) { return overlaps(afterBox, box); })) {
    afterLabel.classList.add("below");
    afterBox = placeBeside(afterLabel, afterX, width);
  }
  if (afterLabel.classList.contains("below")) belowBoxes.push(afterBox);

  // "+$X/hr" is optional, so it gives way to any label it would touch.
  if (!overLabel.hidden && belowBoxes.some(function (box) { return overlaps(boxOf(overLabel), box); })) {
    show(overLabel, false);
  }
}

// Left of the dot, or right of it when there's no room on the left.
function placeBeside(label, x, width) {
  if (x - LABEL_SPACE - label.offsetWidth < 0) return placeSide(label, x, "right", width);
  return placeSide(label, x, "left", width);
}

function boxOf(label) {
  const left = parseFloat(label.style.left) || 0;
  return { left: left, right: left + label.offsetWidth };
}

// "1 page", "2 pages"
function countOf(amount, singular, plural) {
  return calc.formatNumber(amount) + " " + (amount === 1 ? singular : plural);
}

function renderReceipt(r, values) {
  const rows = [
    ["Production",
      calc.formatNumber(values.conceptHours) + " + " + countOf(values.pages, "page", "pages") +
        " x " + calc.formatNumber(values.pageHours),
      calc.formatHours(r.hours.production)],
    ["Communication", "", calc.formatHours(r.hours.communication)],
    ["Revisions",
      countOf(values.rounds, "round", "rounds") + " x " + calc.formatNumber(values.roundHours),
      calc.formatHours(r.hours.revisions)],
    ["Delivery", "", calc.formatHours(r.hours.delivery)],
    ["Total hours", "", calc.formatHours(r.hours.total), "sum"],
    ["Your time",
      calc.formatNumber(r.hours.total) + " x " + calc.formatMoney(r.rate),
      calc.formatMoney(r.timeCost)],
    ["Expenses", "", calc.formatMoney(r.expenses)],
    ["Subtotal", "", calc.formatMoney(r.subtotal), "sum"],
    ["Rounded up to nearest $5", "", "+" + calc.formatMoney(r.rounding)],
    ["Estimated project price", "", calc.formatWholeMoney(r.estimate), "total"],
  ];

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

// Which parts of the result are visible: the full result, "add hours," or "fix errors."
function showResultState(state) {
  show(byId("result-summary"), state === "result");
  show(byId("hours-chart"), state === "result");
  show(byId("receipt-section"), state === "result");
  show(byId("empty-state"), state === "no-hours");
  show(byId("error-state"), state === "errors");
  if (state !== "result") {
    show(byId("offer-chart"), false);
    show(byId("quote-result"), false);
  }
}

// Runs on every change: check the fields, do the math, update the page.
// commit is true when the person has left a field, paused typing, or clicked a control.
// Until then, a new error leaves the page as it was, so nothing flashes mid-typing.
function update(commit) {
  const checked = calc.validateInputs(readForm());
  const errors = checked.errors;
  showErrors(errors, commit);

  // Any error outside the quote stops the math. A quote error only hides the quote line.
  const blocking = Object.keys(errors).filter(function (name) { return name !== "quote"; });
  if (blocking.length) {
    const anyShown = blocking.some(function (name) { return shownErrors[name]; });
    if (!anyShown) return;
    const hoursAreFine = calc.HOURS_FIELDS.every(function (name) { return !errors[name]; });
    if (hoursAreFine) {
      renderGroupTotals(calc.workHours(checked.values));
    } else {
      clearGroupTotals();
    }
    showResultState("errors");
    return;
  }

  const r = calc.calculate(checked.values);
  renderGroupTotals(r.hours);
  if (!r.hasHours) {
    showResultState("no-hours");
    return;
  }

  showResultState("result");
  lastResult = r;
  renderHero(r);
  renderHoursChart(r);
  renderOfferChart(r);
  renderReceipt(r, checked.values);
  if (!errors.quote || shownErrors.quote) renderQuote(r, errors.quote);
}

// Charts measure the page, so they redraw when the size or font changes.
let lastResult = null;

function relayoutCharts() {
  if (!lastResult) return;
  layoutBlocks(lastResult);
  if (lastResult.offer) layoutRuler(lastResult);
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
}

// Wiring

// Pressing Enter in a field shouldn't reload the page.
byId("counter-form").addEventListener("submit", function (event) {
  event.preventDefault();
});

document.querySelectorAll(".stepper button").forEach(function (button) {
  button.addEventListener("click", function () { stepField(button); });
});

Object.keys(FIELD_IDS).forEach(function (name) {
  const input = byId(FIELD_IDS[name]);
  input.addEventListener("input", onType);
  input.addEventListener("blur", onLeaveField);
});

document.querySelectorAll('input[name="offerStatus"]').forEach(function (radio) {
  radio.addEventListener("change", function () {
    showOfferField();
    clearTimeout(commitTimer);
    update(true);
  });
});

let resizeFrame = null;
window.addEventListener("resize", function () {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(relayoutCharts);
});

if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(relayoutCharts);
}

showOfferField();
update(true);

// Bars and dots animate only after the first render, never on load.
requestAnimationFrame(function () {
  requestAnimationFrame(function () {
    document.body.classList.add("charts-ready");
  });
});
