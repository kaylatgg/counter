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

function renderHoursChart(r) {
  const legend = byId("hours-legend");
  WORK_GROUPS.forEach(function (group) {
    const item = legend.querySelector('[data-group="' + group + '"]');
    const hours = r.hours[group];
    item.querySelector(".legend-hours").textContent = calc.formatHours(hours);
    item.querySelector(".legend-percent").textContent =
      Math.round((hours / r.hours.total) * 100) + "%";
  });

  const total = calc.formatHours(r.hours.total);
  byId("hours-summary").textContent = r.outsideProduction === 0
    ? "All " + total + " are production."
    : calc.formatNumber(r.outsideProduction) + " of the " + total +
      " are communication, revisions, and delivery, not production.";
}

function renderOfferChart(r) {
  const chart = byId("offer-chart");
  show(chart, Boolean(r.offer));
  if (!r.offer) return;

  const rows = byId("offer-bars").children;
  rows[0].querySelector(".bar-value").textContent = calc.formatMoney(r.offer.hourlyBefore) + "/hr";
  rows[1].querySelector(".bar-label").textContent =
    "Offer, after " + calc.formatMoney(r.expenses) + " expenses";
  rows[1].querySelector(".bar-value").textContent = calc.formatMoney(r.offer.hourlyAfter) + "/hr";
  rows[2].querySelector(".bar-value").textContent = calc.formatMoney(r.rate) + "/hr";

  let summary = r.offer.meetsTarget
    ? "Before expenses, the offer meets your target rate."
    : "Before expenses, the offer pays " + calc.formatMoney(r.offer.shortPerHour) +
      " an hour less than your target.";
  if (r.offer.hourlyAfter < 0) {
    summary += " After expenses, it pays less than $0 an hour, so you would lose money on this job.";
  }
  byId("offer-summary").textContent = summary;
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
  renderHero(r);
  renderHoursChart(r);
  renderOfferChart(r);
  renderReceipt(r, checked.values);
  if (!errors.quote || shownErrors.quote) renderQuote(r, errors.quote);
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

showOfferField();
update(true);
