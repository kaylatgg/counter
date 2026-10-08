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
  stopCountUp();
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
      comparison = ["Over their offer", "+" + calc.formatPrice(r.offer.gap)];
    } else if (r.offer.gap < 0) {
      comparison = ["Under their offer", "-" + calc.formatPrice(-r.offer.gap)];
    } else {
      comparison = ["Same as their offer", "$0"];
    }
    renderMetrics([
      ["After expenses", calc.formatMoney(r.offer.hourlyAfter) + "/hr"],
      ["Your estimate", calc.formatWholeMoney(r.estimate)],
      comparison,
    ]);
  } else {
    const estimate = calc.formatWholeMoney(r.estimate);
    byId("hero-label").textContent = "Your estimate";
    byId("hero-whole").textContent = estimate;
    byId("hero-cents").textContent = "";
    byId("hero-unit").textContent = "";
    byId("hero-spoken").textContent = estimate;

    const parts = [[hoursInWords(r.hours.total)], " at your ",
      [calc.formatMoney(r.rate) + "/hr"], " target, plus ",
      [calc.formatMoney(r.expenses)], " in expenses."];
    if (r.rounding > 0) {
      parts.push(" Rounded up from ", [calc.formatMoney(r.subtotal)], ".");
    }
    setRichText(sentence, parts);
    show(sentence, true);
    show(warning, false);

    renderMetrics([
      ["Total hours", calc.formatHours(r.hours.total)],
      ["Your time at " + calc.formatPrice(r.rate) + "/hr", calc.formatMoney(r.timeCost)],
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

// Reveal timing, in ms. The CSS uses these through custom properties.
const REVEAL_BLOCKS_START_MS = 150;
const REVEAL_STAGGER_MS = 18;
const REVEAL_FILL_MS = 400;
const REVEAL_BLOCK_MS = 220;
const BLOCK_HEIGHT = 64;
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
      isOne(r.outsideProduction) ? " is work outside production." : " are work outside production.");
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

  // Reuse the group elements that exist, in the fixed order, and fill in their labels.
  container.querySelectorAll(".block-group").forEach(function (element) {
    if (groups.indexOf(element.dataset.group) === -1) element.remove();
  });
  const elements = groups.map(function (group) {
    let element = container.querySelector('.block-group[data-group="' + group + '"]');
    if (!element) {
      element = document.createElement("div");
      element.className = "block-group";
      element.dataset.group = group;
      element.innerHTML = '<div class="block-row"></div><p class="group-label"><b></b> <span></span></p>';
    }
    container.appendChild(element);
    element.querySelector(".group-label b").textContent = calc.formatHours(r.hours[group]);
    element.querySelector(".group-label span").textContent = GROUP_NAMES[group];
    return element;
  });
  const labelWidths = elements.map(function (element) {
    return element.querySelector(".group-label").offsetWidth;
  });

  // Block width fills the space: (width minus gaps) divided by blocks, at least 8px.
  // Gaps between groups are 14px, or wider where a group's label needs the room,
  // so a label never reaches into the next group. Widening the gaps narrows the
  // blocks, which can need more room again, so this settles over a few passes.
  let innerGaps = 0;
  blocksByGroup.forEach(function (blocks) { innerGaps += (blocks.length - 1) * BLOCK_GAP; });
  let blockWidth = BLOCK_MIN;
  let extras = groups.map(function () { return 0; });
  for (let pass = 0; pass < 4; pass++) {
    const groupGaps = extras.reduce(function (sum, extra) { return sum + extra; },
      (groups.length - 1) * GROUP_GAP);
    blockWidth = Math.max(BLOCK_MIN, (width - innerGaps - groupGaps) / (total / unit));
    extras = blocksByGroup.map(function (blocks, g) {
      if (g === groups.length - 1) return 0;
      const blocksWidth = (total === 0 ? 0 : blocks.reduce(function (sum, size) {
        return sum + size * blockWidth;
      }, 0)) + (blocks.length - 1) * BLOCK_GAP;
      return Math.max(0, labelWidths[g] + LABEL_SPACE - (blocksWidth + GROUP_GAP));
    });
  }

  // Where the money runs out, in hours from the start. Infinity means never.
  const offer = r.offer;
  let covered = Infinity;
  if (offer && offer.belowExpenses) covered = 0;
  else if (offer && !offer.coversAllHours) covered = offer.hoursCovered;
  const showLine = Boolean(offer) && !offer.belowExpenses && !offer.coversAllHours;

  let start = 0;
  let lineBlock = null;
  let lineFraction = 0;

  // For the reveal: blocks fill in left to right, about 0.4 seconds in all,
  // then the lime line drops in.
  const blockCount = blocksByGroup.reduce(function (sum, blocks) { return sum + blocks.length; }, 0);
  const stagger = Math.min(REVEAL_STAGGER_MS, REVEAL_FILL_MS / Math.max(1, blockCount));
  container.style.setProperty("--stagger", stagger.toFixed(1) + "ms");
  container.style.setProperty("--line-delay",
    Math.round(REVEAL_BLOCKS_START_MS + blockCount * stagger + REVEAL_BLOCK_MS) + "ms");
  let blockIndex = 0;

  elements.forEach(function (element, g) {
    element.style.marginRight = extras[g] + "px";
    const sizes = blocksByGroup[g];
    const blocks = ensureChildren(element.querySelector(".block-row"), sizes.length, function () {
      const block = document.createElement("div");
      block.className = "block";
      return block;
    });

    blocks.forEach(function (block, i) {
      const end = start + sizes[i] * unit;
      block.style.width = (sizes[i] * blockWidth) + "px";
      block.style.setProperty("--i", blockIndex++);

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

    // The last label stays inside the chart's right edge.
    const label = element.querySelector(".group-label");
    label.style.left = Math.min(0, width - (element.offsetLeft + labelWidths[g])) + "px";
  });

  const line = byId("runs-out");
  show(line, showLine && Boolean(lineBlock));
  if (showLine && lineBlock) {
    // Measured from the chart's own edge (the block's group sits inside it).
    // Layout offsets, not on-screen boxes, so the reveal's grow-in animation
    // can't shift the line.
    const group = lineBlock.closest(".block-group");
    const x = group.offsetLeft + lineBlock.offsetLeft + lineFraction * lineBlock.offsetWidth;
    line.style.left = x + "px";
    line.style.top = (group.offsetTop + lineBlock.offsetTop - LINE_ABOVE) + "px";
    line.style.height = (LINE_ABOVE + BLOCK_HEIGHT) + "px";
    byId("runs-out-label").textContent = calc.formatPrice(offer.amount) + " runs out at " +
      calc.formatHours(offer.hoursCovered);
    // The label sits right of the line, unless that would run past the edge.
    const label = byId("runs-out-label");
    line.classList.remove("flip");
    if (x + LABEL_SPACE + label.offsetWidth > width) line.classList.add("flip");
  }
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
    ? "Before expenses, the offer meets your target."
    : "Before expenses, the offer pays " + calc.formatMoney(offer.shortPerHour) +
      " an hour less than your target.";
  if (offer.hourlyAfter < 0) {
    summary += " After expenses, you would lose money on this job.";
  }
  byId("offer-summary").textContent = summary;

  layoutRuler(r);
}

// Minimum space between two labels in the same row, in px.
const LABEL_GAP = 8;

// Places each row of labels with calc.spreadLabels, so none overlap and all stay
// inside the ruler. Each entry is { label, left } where left is the wanted left edge.
// Optional labels are dropped, last first, if a row can't fit everything.
function placeRow(entries, width) {
  let visible = entries.filter(function (entry) { return !entry.label.hidden; });
  for (;;) {
    const items = visible.map(function (entry) {
      return { left: entry.left(entry.label.offsetWidth), width: entry.label.offsetWidth };
    });
    const result = calc.spreadLabels(items, width, LABEL_GAP);
    const optional = visible.filter(function (entry) { return entry.optional; });
    if (result.fits || !optional.length) {
      visible.forEach(function (entry, i) { entry.label.style.left = result.lefts[i] + "px"; });
      return;
    }
    const drop = optional[optional.length - 1];
    show(drop.label, false);
    visible = visible.filter(function (entry) { return entry !== drop; });
  }
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
    // The last tick carries the unit for the whole ruler.
    tick.querySelector("span").textContent = calc.formatWholeMoney(scale.ticks[i]) +
      (i === ticks.length - 1 ? "/hr" : "");
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

  // Above the target: a small "+$X/hr" between the target and the offer.
  const overLabel = byId("over-label");
  const overCents = Math.round((offer.hourlyBefore - r.rate) * 100);
  show(overLabel, overCents > 0 && offerX - targetX >= BAND_LABEL_MIN);
  if (overCents > 0) overLabel.textContent = "+" + calc.formatMoney(overCents / 100) + "/hr";

  const targetLabel = byId("target-label");
  const offerLabel = byId("offer-label");
  const afterLabel = byId("after-label");
  targetLabel.textContent = "target " + calc.formatPrice(r.rate) + "/hr";
  offerLabel.textContent = "offer " + calc.formatMoney(offer.hourlyBefore) + "/hr";
  afterLabel.textContent = "after expenses " + calc.formatMoney(offer.hourlyAfter) + "/hr";

  // Above the ruler: the offer label left of its dot, the target label centered on its mark.
  placeRow([
    { label: offerLabel, left: function (w) { return offerX - LABEL_SPACE - w; } },
    { label: targetLabel, left: function (w) { return targetX - w / 2; } },
  ], width);

  // Below the ruler: the gap amount under the band's center, and the optional
  // "+$X/hr" between the target and the offer.
  placeRow([
    { label: gapLabel, left: function (w) { return offerX + bandWidth / 2 - w / 2; } },
    { label: overLabel, optional: true, left: function (w) { return (targetX + offerX) / 2 - w / 2; } },
  ], width);

  // "after expenses" sits under its dot. If that's closer than 8px to another label
  // below the ruler, it moves to a second row, and the tick labels move down with it.
  const afterWidth = afterLabel.offsetWidth;
  const afterLeft = Math.max(0, Math.min(width - afterWidth, afterX - afterWidth / 2));
  const others = [gapLabel, overLabel].filter(function (label) { return !label.hidden; })
    .map(function (label) {
      const left = parseFloat(label.style.left) || 0;
      return { left: left, right: left + label.offsetWidth };
    });
  const secondRow = calc.isCrowded({ left: afterLeft, right: afterLeft + afterWidth }, others, LABEL_GAP);
  afterLabel.style.left = afterLeft + "px";
  afterLabel.classList.toggle("second-row", secondRow);
  ruler.classList.toggle("has-second-row", secondRow);
}

// "1 page", "2 pages"
function countOf(amount, singular, plural) {
  return calc.formatNumber(amount) + " " + (amount === 1 ? singular : plural);
}

function renderReceipt(r, values) {
  const rows = [
    ["Production",
      calc.formatHours(values.conceptHours) + " + " + countOf(values.pages, "page", "pages") +
        " x " + calc.formatHours(values.pageHours),
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
function buildReply(r, values) {
  const price = calc.formatPrice(r.quote.amount);
  const pages = calc.formatNumber(values.pages) + "-page menu";
  const rounds = countOf(values.rounds, "round", "rounds") + " of changes";
  let text = "Hi! Thanks for reaching out about the menu. For a " + pages + " with " + rounds +
    " and print-ready files, my price is " + price + ".";
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
}

function updateDraft() {
  draftWhenEdited = null;
  byId("reply").value = currentDraft;
  show(byId("reply-notice"), false);
  byId("reply").focus();
}

// Screen 1 extras: the work total and the button's live preview

function renderTotals(hours) {
  byId("total-hours").textContent = hours ? calc.formatHours(hours.total) : "";
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

// Control bar: pages, rounds, offer, and rate on screen 2 are the same values
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

// Runs on every change: check the fields, do the math, update the page.
// commit is true when the person has left a field, paused typing, or clicked a control.
// Until then, a new error leaves the page as it was, so nothing flashes mid-typing.
function update(commit) {
  const checked = calc.validateInputs(readForm());
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
    } else {
      clearGroupTotals();
      renderTotals(null);
    }
    renderCheckButton(checked.values, null);
    renderErrorState(errors);
    showResultState("errors");
    return;
  }

  const r = calc.calculate(checked.values);
  renderGroupTotals(r.hours);
  renderTotals(r.hours);
  renderCheckButton(checked.values, r.hours);
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
  if (!errors.quote) renderReply(r, checked.values);
  if (!errors.quote || shownErrors.quote) renderQuote(r, errors.quote);
}

// Charts measure the page, so they redraw when the size or font changes.
let lastResult = null;

function relayoutCharts() {
  if (!lastResult || byId("result").hidden) return;
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

function paintHeroNumber(r, value) {
  if (r.offer) {
    const money = calc.formatMoney(value);
    const point = money.lastIndexOf(".");
    byId("hero-whole").textContent = money.slice(0, point);
    byId("hero-cents").textContent = money.slice(point);
  } else {
    byId("hero-whole").textContent = calc.formatWholeMoney(Math.round(value));
  }
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

// Screens: inputs (white) and results (black), one at a time, no reload.

function showScreen(name) {
  const results = name === "results";
  byId("screen-inputs").hidden = results;
  byId("result").hidden = !results;
  document.body.classList.toggle("on-inputs", !results);
  document.body.classList.toggle("on-results", results);
  window.scrollTo(0, 0);
}

// The browser's Back button goes from results to inputs, with every value kept.
// Showing the results adds a history step; Back (or "Edit all details") removes it.
function openResults() {
  showScreen("results");
  relayoutCharts();
  const target = !byId("result-summary").hidden ? byId("hero-label") : byId("empty-state");
  target.focus();
}

function openInputs() {
  showScreen("inputs");
  byId("page-title").focus();
}

window.addEventListener("popstate", function (event) {
  if (event.state && event.state.screen === "results") {
    openResults();
  } else {
    openInputs();
  }
});

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
  history.pushState({ screen: "results" }, "", "#results");
  revealResults();
}

// The reveal plays once per press of "Check the offer", about 1 second in all:
// screen 1 fades out as the page turns black, screen 2 fades in, the hero counts
// up, the blocks fill in, and the lime line drops in last. Under reduced motion,
// the final state shows right away. Later changes use the normal transitions.
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const REVEAL_FADE_MS = 100;
const REVEAL_TOTAL_MS = 1100;

function revealResults() {
  const body = document.body;
  if (reduceMotion.matches) {
    openResults();
    return;
  }
  const results = byId("result");
  body.classList.add("revealing", "reveal-out");
  setTimeout(function () {
    results.classList.add("reveal-hidden");
    body.classList.remove("reveal-out");
    openResults();
    if (lastResult && !byId("result-summary").hidden) countUpHero(lastResult);
    void results.offsetWidth;
    results.classList.remove("reveal-hidden");
    setTimeout(function () { body.classList.remove("revealing"); }, REVEAL_TOTAL_MS);
  }, REVEAL_FADE_MS);
}

function editDetails() {
  if (history.state && history.state.screen === "results") {
    history.back();
  } else {
    openInputs();
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

// Always start on screen 1. A leftover #results in the address goes away.
if (location.hash === "#results") history.replaceState(null, "", location.pathname);

showOfferField();
update(true);

// Bars and dots animate only after the first render, never on load.
requestAnimationFrame(function () {
  requestAnimationFrame(function () {
    document.body.classList.add("charts-ready");
  });
});
