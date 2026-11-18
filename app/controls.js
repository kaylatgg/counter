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
    show(byId("budget-sentence"), false);
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
  // The hours arrows name their row: "Add half an hour, Layout, per page".
  document.querySelectorAll(".hour-arrow").forEach(function (button) {
    const label = document.querySelector('label[for="' + button.dataset.target + '"]').textContent;
    button.setAttribute("aria-label",
      (Number(button.dataset.step) > 0 ? "Add half an hour, " : "Remove half an hour, ") + label);
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
  if (commit) announceSummary();
  if (sharedSnapshot !== null && !loadingValues && JSON.stringify(snapshot()) !== sharedSnapshot) {
    hideSharedNote();
  }
}

// Screen readers hear one short summary after the person changes a value:
// right away on a change, or after about 1 second without typing. Never the
// same text twice in a row, and never while a calculation is loading.
let lastSummary = null;

function summaryText() {
  const checked = calc.validateInputs(readForm(), currentJob());
  const blocking = Object.keys(checked.errors).filter(function (name) { return name !== "quote"; });
  if (blocking.length) return null;
  const r = calc.calculate(checked.values);
  if (!r.hasHours) return null;
  let text = "Estimated price " + calc.formatWholeMoney(r.estimate) + " for " +
    calc.formatHours(r.hours.total) + ".";
  if (r.offer && r.offer.belowExpenses) {
    return text + " The offer of " + calc.formatPrice(r.offer.amount) + " is " +
      calc.formatMoney(r.offer.shortfall) + " less than your expenses.";
  }
  if (r.offer) {
    text += " The offer of " + calc.formatPrice(r.offer.amount) + " pays " +
      calc.formatMoney(r.offer.hourlyBefore) + " an hour before expenses and " +
      calc.formatMoney(r.offer.hourlyAfter) + " after.";
  }
  return text + " Your target is " + calc.formatMoney(r.rate) + ".";
}

// Remembers what's on the page without saying it (on load, or when a
// project or share link fills the calculator).
function quietSummary() {
  lastSummary = summaryText();
}

function announceSummary() {
  if (loadingValues || firstLoad) {
    quietSummary();
    return;
  }
  const text = summaryText();
  if (text === null || text === lastSummary) return;
  lastSummary = text;
  announce(text);
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

// The five hours boxes with up and down arrows.
const HOURS_ARROW_FIELDS = ["setup-hours", "item-hours", "communication-hours", "round-hours", "delivery-hours"];

// Steppers: add or remove one (the hours arrows: half an hour), never below 0.
// Text that isn't a number counts as 0. Rounded to 2 decimals, so 2.3 - 0.5
// shows 1.8; whole numbers come out exactly as before.
function stepField(button) {
  const input = byId(button.dataset.target);
  const parsed = calc.parseNumber(input.value, calc.FIELDS[input.name]);
  const current = parsed.value == null ? 0 : parsed.value;
  const next = Math.max(0, current + Number(button.dataset.step));
  input.value = String(Math.round(next * 100) / 100);
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

// The number the hero shows: the estimate, the loss, or the offer per hour after expenses.
function heroValue(r) {
  return !r.offer ? r.estimate : (r.offer.belowExpenses ? r.offer.shortfall : r.offer.hourlyAfter);
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

