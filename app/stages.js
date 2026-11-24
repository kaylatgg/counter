// Project stages on the result screen (saved projects only): the stage bar
// (Quoted, Working, Paid), the three stage dialogs ("They said yes", "Mark as
// paid", and moving back), the project hero that replaces the hero once a
// project is Working or Paid, and the rate bars. All money math is in
// timeline.js; this file only reads it and writes it onto the page, always
// with textContent.

// Refusals from timeline.js, in plain words.
const STAGE_REFUSALS = {
  "bad-timeline": "This project's stage can't be read, so it can't change.",
  "not-quoted": "This project has already moved past Quoted.",
  "not-working": "This project isn't Working anymore.",
  "already-quoted": "This project is already Quoted.",
  "bad-agreed": "The agreed price needs to be more than $0 and at most $100,000.",
  "bad-planned-hours": "The planned hours need to be more than 0 and at most 1,000. Check them in Edit details.",
  "bad-expenses": "Expenses need to be $100,000 or less to save a stage. Check them in Edit details.",
  "bad-target": "Your target needs to be $100,000 or less to save a stage. Check it in Edit details.",
  "bad-received": "Enter the amount you received, like 310.",
  "bad-actual-hours": "Enter the hours you worked, like 13.",
  "bad-date": "This device's date is earlier than the project's last stage. Check the date and try again.",
  "has-requests": "This project has client requests, so it can't move back to Quoted.",
};

const AGREED_ERROR = "Enter the price they agreed to, like 270.";
const RECEIVED_ERROR = "Enter the amount you received, like 310.";
const WORKED_ERROR = "Enter the hours you worked, like 13.";

// "$25.00", "-$2.00"
function centsMoney(cents) {
  return calc.formatMoney(cents / 100);
}

// "$270", "$270.50"
function centsPrice(cents) {
  return calc.formatPrice(cents / 100);
}

// "Nov 21", or "Nov 21, 2025" when it isn't this year.
function stageDate(iso) {
  return dashDate(iso, new Date());
}

// A dollar amount as a money field shows it: "1,000", "270.50".
function moneyFieldText(amount) {
  const whole = Math.abs(amount - Math.round(amount)) < 0.005;
  return calc.groupDigits(whole ? String(Math.round(amount)) : amount.toFixed(2));
}

function currentTimeline() {
  const project = currentProject();
  return project ? projectTimeline.timelineOf(project) : null;
}

// The calculation's result, or null when it has errors or no hours.
function validCalculation() {
  const checked = calc.validateInputs(readForm(), currentJob());
  const blocking = Object.keys(checked.errors).some(function (name) { return name !== "quote"; });
  if (blocking) return null;
  const r = calc.calculate(checked.values);
  return r.hasHours ? { r: r, values: checked.values } : null;
}

// Where focus goes on screen 2: the first of these that shows.
function heroFocusTarget() {
  return ["project-hero-label", "hero-label", "empty-state", "error-state"].map(byId).filter(function (element) {
    return !element.hidden && !element.closest("[hidden]");
  })[0] || null;
}

// The hero the reveal grows into.
function visibleHeroPanel() {
  return byId("project-hero").hidden ? byId("hero-panel") : byId("project-hero");
}

// The page

// Runs whenever the header or the calculation changes: the stage bar and the
// project hero always match the open project. The draft gets none of it.
function renderStageView() {
  const project = currentProject();
  const timeline = project ? projectTimeline.timelineOf(project) : null;
  const projectMode = Boolean(timeline) && timeline.stage !== "quoted";
  show(byId("stage-row"), Boolean(timeline));
  show(byId("hero-panel"), !projectMode);
  show(byId("project-hero"), projectMode);
  show(byId("project-body"), projectMode);
  if (!timeline) return;
  renderStageBar(timeline);
  if (projectMode) {
    renderProjectHero(project, timeline);
    renderPricingState();
  }
}

function renderStageBar(timeline) {
  const stage = timeline.stage;
  byId("stage-steps").querySelectorAll("li").forEach(function (item) {
    if (item.dataset.stage === stage) item.setAttribute("aria-current", "step");
    else item.removeAttribute("aria-current");
  });

  // Read only (a newer version saved the projects): nothing can change stage.
  const forward = byId("stage-forward");
  const back = byId("stage-back");
  if (stage === "quoted") {
    const action = validCalculation() ? "yes" : "fix";
    forward.dataset.action = action;
    forward.textContent = action === "yes" ? "They said yes" : "Fix the details to continue";
  } else if (stage === "working") {
    forward.dataset.action = "paid";
    forward.textContent = "Mark as paid";
  }
  show(forward, stage !== "paid" && !projectsReadOnly);

  show(byId("stage-paid-on"), stage === "paid");
  if (stage === "paid") byId("stage-paid-on").textContent = "Paid " + stageDate(timeline.paidAt);

  show(back, stage !== "quoted" && !projectsReadOnly);
  back.textContent = stage === "paid" ? "Move back to Working" : "Move back to Quoted";
}

function renderProjectHero(project, timeline) {
  const paid = timeline.stage === "paid";
  const rate = projectTimeline.rateNowCents(project);
  const planned = projectTimeline.plannedRateCents(project);
  const jobInfo = calc.JOBS[project.job];

  byId("project-hero-label").textContent = paid
    ? "This project really paid, after expenses"
    : "This project pays now, after expenses";
  byId("project-hero-sign").textContent = rate < 0 ? "-" : "";
  byId("project-hero-amount").textContent = centsMoney(Math.abs(rate)).slice(1);
  byId("project-hero-spoken").textContent = centsMoney(rate) + " per hour";
  byId("project-hero-job").textContent = (jobInfo ? jobInfo.name + " · " : "") +
    (paid ? "paid " + stageDate(timeline.paidAt) : "working since " + stageDate(timeline.workingAt));
  const hours = paid ? timeline.actualHours : timeline.plannedHours;
  const money = paid ? timeline.receivedCents : timeline.agreedCents;
  byId("project-hero-sentence").textContent = calc.formatHours(hours) + " for " + centsPrice(money) +
    ". You planned " + centsMoney(planned) + " an hour.";

  renderProjectStats([
    { label: paid ? "Received" : "Agreed price", value: centsPrice(money) },
    { label: paid ? "Real hours" : "Hours planned", value: calc.formatNumber(hours), unit: isOne(hours) ? "hr" : "hrs" },
    { label: "Planned rate", value: centsMoney(planned), unit: "/hr" },
  ]);

  const rows = [{ label: "Planned", note: stageDate(timeline.workingAt), cents: planned, planned: true }];
  if (paid) rows.push({ label: "Real", note: stageDate(timeline.paidAt), cents: rate });
  renderRateBars(byId("project-rate-bars"), rows, timeline.targetCents);
  show(byId("project-rates-note"), !paid);
  fitProjectNumber();
}

// The same stat look as the result's stats, without the count-up.
function renderProjectStats(items) {
  const list = byId("project-stats");
  list.textContent = "";
  items.forEach(function (item) {
    const group = document.createElement("div");
    const value = make("dd");
    value.appendChild(make("span", "stat-number", item.value));
    if (item.unit) value.appendChild(make("span", "stat-unit", item.unit));
    group.append(make("dt", null, item.label), value);
    list.appendChild(group);
  });
  fitStats();
}

// Working or Paid with a calculation that has errors or no hours: the hero
// that would say so is hidden, so the line goes under "Your pricing".
function renderPricingState() {
  const source = ["empty-state", "error-state"].map(byId).filter(function (element) { return !element.hidden; })[0];
  const state = byId("pricing-state");
  show(state, Boolean(source));
  state.textContent = source ? source.textContent : "";
}

// The rate bars (one component, in the project hero's section and in the
// Mark as paid dialog). rows: { label, note, cents, planned }. Every bar in
// one chart shares one scale, from $0. One target notch per bar, labeled once
// above the first. The bars are hidden from screen readers; the names and
// values next to them are text, read in order.
function renderRateBars(container, rows, targetCents) {
  const scale = projectTimeline.barScaleCents(rows.map(function (row) { return row.cents; }), targetCents);
  const notchAt = projectTimeline.barShare(targetCents, scale);
  container.textContent = "";
  rows.forEach(function (row, i) {
    const element = make("div", "rate-row");
    const name = make("div", "rate-name");
    name.appendChild(make("span", "rate-label", row.label));
    if (row.note) name.appendChild(make("span", "rate-date", row.note));

    const track = make("div", "rate-track");
    track.setAttribute("aria-hidden", "true");
    const fill = make("div", "rate-fill" + (row.planned ? " planned" : ""));
    fill.style.width = projectTimeline.barShare(row.cents, scale) * 100 + "%";
    const notch = make("div", "rate-notch" + (notchAt < 0.12 ? " at-start" : ""));
    notch.style.left = notchAt * 100 + "%";
    if (i === 0) notch.appendChild(make("span", "rate-target", "Target " + centsPrice(targetCents)));
    track.append(fill, notch);

    const value = make("p", "rate-value", row.cents === null ? "" : centsMoney(row.cents));
    if (row.cents !== null) value.appendChild(make("span", "rate-unit", "/hr"));
    element.append(name, track, value);
    container.appendChild(element);
  });
  container.appendChild(make("p", "visually-hidden", "Your target: " + centsMoney(targetCents) + " an hour."));
}

// The project hero's number stays on one line and shrinks to fit, like the hero's.
function fitProjectNumber() {
  const digits = document.querySelector(".project-digits");
  const unit = digits.querySelector(".hero-unit");
  digits.style.fontSize = "";
  unit.style.fontSize = "";
  const room = byId("project-summary").clientWidth;
  if (!room || digits.scrollWidth <= room) return;
  const baseSize = parseFloat(getComputedStyle(digits).fontSize);
  const baseUnit = parseFloat(getComputedStyle(unit).fontSize);
  let scale = 1;
  for (let i = 0; i < 2 && digits.scrollWidth > room; i++) {
    scale *= room / digits.scrollWidth;
    digits.style.fontSize = Math.floor(baseSize * scale) + "px";
    unit.style.fontSize = Math.floor(baseUnit * scale * 10) / 10 + "px";
  }
}

// Dialogs

function showRefusal(id, reason) {
  const element = byId(id);
  element.textContent = "";
  if (reason) {
    element.innerHTML = ALERT_ICON;
    element.appendChild(make("span", "error-text", STAGE_REFUSALS[reason] || STAGE_REFUSALS["bad-timeline"]));
  }
  show(element, Boolean(reason));
}

// After a stage change: save, close, show the new stage, focus the hero, and say so.
function applyStage(project, message) {
  finishPlays();
  const now = new Date();
  const saved = Object.assign({}, project, { edited: now.toISOString() });
  projectList = projectList.map(function (item) { return item.id === saved.id ? saved : item; });
  closePanels();
  persist();
  // The hero that's showing now may never have been measured.
  relayoutCharts();
  const target = heroFocusTarget();
  if (target) target.focus({ preventScroll: true });
  announce(message);
}

// "They said yes" (or "Fix the details to continue", or "Mark as paid").
let workingPlan = null;

function onStageForward(event) {
  const action = event.currentTarget.dataset.action;
  if (action === "fix") editDetails();
  else if (action === "yes") openWorkingDialog(event.currentTarget);
  else if (action === "paid") openPaidDialog(event.currentTarget);
}

function openWorkingDialog(opener) {
  const check = validCalculation();
  if (!check) {
    editDetails();
    return;
  }
  // The price and work in the reply: the picked way to close the gap, if any.
  const option = pickedOption();
  const price = option ? option.price : check.r.quote.amount;
  workingPlan = {
    hours: projectTimeline.roundHours(option ? option.hours : check.r.hours.total),
    expensesCents: Math.round(check.values.expenses * 100),
    targetCents: Math.round(check.values.rate * 100),
  };
  openDialog("working-panel", opener);
  const input = byId("agreed-price");
  setFieldError(input, "");
  showRefusal("working-refusal", null);
  input.value = moneyFieldText(price);
  renderAgreedLine();
  input.focus({ preventScroll: true });
  input.select();
}

// "That's $25.00 an hour after expenses for 10 hours."
function renderAgreedLine() {
  const cents = projectTimeline.dollarsToCents(byId("agreed-price").value);
  const rate = projectTimeline.rateAfterCents(cents, workingPlan.expensesCents, workingPlan.hours);
  const line = byId("agreed-line");
  show(line, rate !== null);
  if (rate !== null) {
    line.textContent = "That's " + centsMoney(rate) + " an hour after expenses for " + hoursInWords(workingPlan.hours) + ".";
  }
}

function onAgreedInput() {
  const input = byId("agreed-price");
  showRefusal("working-refusal", null);
  if (input.getAttribute("aria-invalid")) {
    setFieldError(input, projectTimeline.dollarsToCents(input.value) === null ? AGREED_ERROR : "");
  }
  renderAgreedLine();
}

function submitWorking(event) {
  event.preventDefault();
  const input = byId("agreed-price");
  const cents = projectTimeline.dollarsToCents(input.value);
  setFieldError(input, cents === null ? AGREED_ERROR : "");
  if (cents === null) {
    input.focus();
    return;
  }
  const result = projectTimeline.markWorking(currentProject(), {
    agreedCents: cents,
    plannedHours: workingPlan.hours,
    expensesCents: workingPlan.expensesCents,
    targetCents: workingPlan.targetCents,
  }, new Date());
  if (!result.ok) {
    showRefusal("working-refusal", result.reason);
    return;
  }
  applyStage(result.project, "Moved to Working");
}

// "Mark as paid": the amount received and the real hours.
function openPaidDialog(opener) {
  const project = currentProject();
  const defaults = projectTimeline.paidDefaults(project);
  if (!defaults) return;
  openDialog("paid-panel", opener);
  const amount = byId("paid-amount");
  const hours = byId("paid-hours");
  setFieldError(amount, "");
  setFieldError(hours, "");
  showRefusal("paid-refusal", null);
  amount.value = moneyFieldText(defaults.receivedCents / 100);
  hours.value = String(defaults.actualHours);
  renderPaidResult();
  amount.focus({ preventScroll: true });
  amount.select();
}

// "This project really paid, after expenses", the rate, and Planned and Real.
function renderPaidResult() {
  const project = currentProject();
  const timeline = currentTimeline();
  if (!timeline || timeline.stage !== "working") return;
  const cents = projectTimeline.dollarsToCents(byId("paid-amount").value);
  const hours = projectTimeline.hoursFromText(byId("paid-hours").value);
  const rate = projectTimeline.rateAfterCents(cents, timeline.expensesCents, hours);
  const number = byId("paid-result-number");
  number.textContent = rate === null ? "" : centsMoney(rate);
  if (rate !== null) number.appendChild(make("span", "paid-result-unit", "/hr"));
  show(number, rate !== null);
  const rows = [{ label: "Planned", cents: projectTimeline.plannedRateCents(project), planned: true }];
  if (rate !== null) rows.push({ label: "Real", cents: rate });
  renderRateBars(byId("paid-rate-bars"), rows, timeline.targetCents);
}

function paidErrors() {
  return {
    amount: projectTimeline.dollarsToCents(byId("paid-amount").value) === null ? RECEIVED_ERROR : "",
    hours: projectTimeline.hoursFromText(byId("paid-hours").value) === null ? WORKED_ERROR : "",
  };
}

function onPaidInput() {
  showRefusal("paid-refusal", null);
  const errors = paidErrors();
  ["amount", "hours"].forEach(function (name) {
    const input = byId("paid-" + name);
    if (input.getAttribute("aria-invalid")) setFieldError(input, errors[name]);
  });
  renderPaidResult();
}

function submitPaid(event) {
  event.preventDefault();
  const errors = paidErrors();
  setFieldError(byId("paid-amount"), errors.amount);
  setFieldError(byId("paid-hours"), errors.hours);
  if (errors.amount || errors.hours) {
    byId(errors.amount ? "paid-amount" : "paid-hours").focus();
    return;
  }
  const result = projectTimeline.markPaid(currentProject(), {
    receivedCents: projectTimeline.dollarsToCents(byId("paid-amount").value),
    actualHours: projectTimeline.hoursFromText(byId("paid-hours").value),
  }, new Date());
  if (!result.ok) {
    showRefusal("paid-refusal", result.reason);
    return;
  }
  applyStage(result.project, "Marked as paid");
}

// Moving back one stage, after a confirm. Focus starts on Cancel, the safe choice.
function openBackDialog(event) {
  const timeline = currentTimeline();
  if (!timeline || timeline.stage === "quoted") return;
  const toWorking = timeline.stage === "paid";
  byId("back-question").textContent = toWorking ? "Move back to Working?" : "Move back to Quoted?";
  byId("back-text").textContent = toWorking
    ? "The amount received and real hours are cleared."
    : "The agreed price is cleared.";
  showRefusal("back-refusal", null);
  openDialog("back-panel", event.currentTarget);
  byId("back-cancel").focus({ preventScroll: true });
}

function confirmBack() {
  const result = projectTimeline.moveBack(currentProject(), new Date());
  if (!result.ok) {
    showRefusal("back-refusal", result.reason);
    return;
  }
  const stage = projectTimeline.timelineOf(result.project).stage;
  applyStage(result.project, stage === "working" ? "Moved back to Working" : "Moved back to Quoted");
}

// Money fields in the dialogs show commas when not focused, like the others.
function groupOnLeave(event) {
  event.target.value = calc.groupDigits(event.target.value);
}
