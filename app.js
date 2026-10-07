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
      const box = input.closest(".unit-input, .stepper") || input;
      box.insertAdjacentElement("afterend", error);
    }
    error.textContent = message;
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

function renderHero(r) {
  const total = calc.formatHours(r.hours.total);
  const target = calc.formatMoney(r.rate) + "/hr";

  if (r.offer) {
    byId("hero-label").textContent = "This offer pays";
    byId("hero-value").textContent = calc.formatMoney(r.offer.hourlyBefore);
    byId("hero-unit").textContent = "/hr";
    byId("hero-detail").textContent =
      "before expenses, for " + total + " of work. Your target is " + target + ".";
  } else {
    let detail = total + " at your " + target + " target, plus " +
      calc.formatMoney(r.expenses) + " in expenses.";
    if (r.rounding > 0) {
      detail += " Rounded up from " + calc.formatMoney(r.subtotal) + ".";
    }
    byId("hero-label").textContent = "Estimated project price";
    byId("hero-value").textContent = calc.formatWholeMoney(r.estimate);
    byId("hero-unit").textContent = "";
    byId("hero-detail").textContent = detail;
  }
}

function renderStatus(r) {
  const list = byId("status-lines");
  const warning = byId("offer-warning");
  list.textContent = "";

  if (!r.offer) {
    show(list, false);
    show(warning, false);
    return;
  }

  const total = calc.formatHours(r.hours.total);
  const lines = [
    "After your " + calc.formatMoney(r.expenses) + " in expenses: " +
      calc.formatMoney(r.offer.hourlyAfter) + "/hr.",
  ];
  if (r.offer.coversAllHours) {
    lines.push("At your target rate, the offer covers all " + total + ".");
  } else if (r.offer.hoursCovered !== null) {
    lines.push("At your target rate, the offer pays for " +
      calc.formatNumber(r.offer.hoursCovered) + " of the " + total + ".");
  }
  lines.forEach(function (text) {
    const item = document.createElement("li");
    item.textContent = text;
    list.appendChild(item);
  });

  const estimate = calc.formatWholeMoney(r.estimate);
  let comparison;
  if (r.offer.gap > 0) {
    comparison = "Your estimate of " + estimate + " is " +
      calc.formatPrice(r.offer.gap) + " above the offer.";
  } else if (r.offer.gap === 0) {
    comparison = "Your estimate of " + estimate + " matches the offer.";
  } else {
    comparison = "Your estimate of " + estimate + " fits within the offer, with " +
      calc.formatPrice(-r.offer.gap) + " to spare.";
  }
  const last = document.createElement("li");
  const strong = document.createElement("strong");
  strong.textContent = comparison;
  last.appendChild(strong);
  list.appendChild(last);
  show(list, true);

  if (r.offer.belowExpenses) {
    warning.textContent = "This offer is " + calc.formatMoney(r.offer.shortfall) +
      " less than your expenses alone. You would lose money before counting any of your time.";
  }
  show(warning, r.offer.belowExpenses);
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

  // Compare to the cent, so $24.999 doesn't read as "less than your target."
  const shortCents = Math.round((r.rate - r.offer.hourlyBefore) * 100);
  let summary = shortCents > 0
    ? "Before expenses, the offer pays " + calc.formatMoney(shortCents / 100) +
      " an hour less than your target."
    : "Before expenses, the offer meets your target rate.";
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
    const math = document.createElement("td");
    math.textContent = row[1];
    const amount = document.createElement("td");
    amount.textContent = row[2];
    tr.append(th, math, amount);
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
  renderStatus(r);
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
