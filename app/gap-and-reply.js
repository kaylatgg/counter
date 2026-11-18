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

