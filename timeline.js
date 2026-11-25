// Counter project stages: Quoted, Working, Paid. The data and the math only.
// Pure functions: nothing here touches the page or storage. Works in the
// browser (as the global projectTimeline) and in Node (through module.exports).
//
// A project with no timeline is Quoted. Once it moves to Working it keeps a
// timeline:
// {
//   "stage": "quoted" | "working" | "paid",
//   "quotedAt": ISO date, "workingAt": ISO date or null, "paidAt": ISO date or null,
//   "agreedCents", "plannedHours", "expensesCents", "targetCents": set at Working,
//   "requests": [ { "id", "at", "text", "hours", "decision", "rateCents", "chargeCents" } ],
//   "receivedCents", "actualHours": set at Paid
// }
// Money is whole cents (integers). The agreed price, planned hours, expenses,
// and target are snapshots taken when the project moves to Working, so editing
// the calculation later never rewrites them. Every function returns a new
// object and never changes what it's given.

const STAGES = ["quoted", "working", "paid"];
const DECISIONS = ["free", "charge"];
// $100,000.
const MAX_CENTS = 10000000;
const MAX_HOURS = 1000;
const REQUEST_TEXT_MAX = 120;

// Whole cents from 0 to $100,000.
function isCents(value) {
  return Number.isInteger(value) && value >= 0 && value <= MAX_CENTS;
}

// Hours above 0 and at most 1000, with no more than 2 decimals.
function isHours(value) {
  return typeof value === "number" && isFinite(value) && value > 0 && value <= MAX_HOURS &&
    Math.round(value * 100) / 100 === value;
}

// An ISO date as toISOString writes it ("2026-11-23T14:05:00.000Z"), or with
// an offset, that names a real moment.
const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
function isIso(value) {
  return typeof value === "string" && ISO_PATTERN.test(value) && !isNaN(Date.parse(value));
}

function isMissing(value) {
  return value === null || value === undefined;
}

function isValidDate(now) {
  return now instanceof Date && !isNaN(now.getTime());
}

// One change request, cleaned, or null. Free requests charge nothing.
function cleanRequest(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (typeof raw.id !== "string" || !raw.id) return null;
  if (!isIso(raw.at)) return null;
  if (typeof raw.text !== "string") return null;
  const text = raw.text.trim();
  if (!text || text.length > REQUEST_TEXT_MAX) return null;
  if (!isHours(raw.hours)) return null;
  if (DECISIONS.indexOf(raw.decision) === -1) return null;
  if (!isCents(raw.rateCents) || !isCents(raw.chargeCents)) return null;
  if (raw.decision === "free" && raw.chargeCents !== 0) return null;
  return {
    id: raw.id, at: raw.at, text: text, hours: raw.hours, decision: raw.decision,
    rateCents: raw.rateCents, chargeCents: raw.chargeCents,
  };
}

// A clean copy of a saved timeline, or null if anything is wrong. The fields
// must match the stage, the dates must be in order, and unknown keys are
// dropped. A missing field counts as null.
function cleanTimeline(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (STAGES.indexOf(raw.stage) === -1) return null;
  if (!isIso(raw.quotedAt)) return null;
  if (!Array.isArray(raw.requests)) return null;
  const requests = [];
  for (let i = 0; i < raw.requests.length; i++) {
    const request = cleanRequest(raw.requests[i]);
    if (!request) return null;
    requests.push(request);
  }

  const working = raw.stage !== "quoted";
  const paid = raw.stage === "paid";
  const workingFields = ["workingAt", "agreedCents", "plannedHours", "expensesCents", "targetCents"];
  const paidFields = ["paidAt", "receivedCents", "actualHours"];

  if (working) {
    if (!isIso(raw.workingAt)) return null;
    if (!isCents(raw.agreedCents) || raw.agreedCents <= 0) return null;
    if (!isHours(raw.plannedHours)) return null;
    if (!isCents(raw.expensesCents) || !isCents(raw.targetCents)) return null;
    if (Date.parse(raw.quotedAt) > Date.parse(raw.workingAt)) return null;
  } else {
    if (!workingFields.every(function (key) { return isMissing(raw[key]); })) return null;
    // Requests only happen while working.
    if (requests.length) return null;
  }
  if (paid) {
    if (!isIso(raw.paidAt)) return null;
    if (!isCents(raw.receivedCents)) return null;
    if (!isHours(raw.actualHours)) return null;
    if (Date.parse(raw.workingAt) > Date.parse(raw.paidAt)) return null;
  } else if (!paidFields.every(function (key) { return isMissing(raw[key]); })) {
    return null;
  }

  return {
    stage: raw.stage,
    quotedAt: raw.quotedAt,
    workingAt: working ? raw.workingAt : null,
    paidAt: paid ? raw.paidAt : null,
    agreedCents: working ? raw.agreedCents : null,
    plannedHours: working ? raw.plannedHours : null,
    expensesCents: working ? raw.expensesCents : null,
    targetCents: working ? raw.targetCents : null,
    requests: requests,
    receivedCents: paid ? raw.receivedCents : null,
    actualHours: paid ? raw.actualHours : null,
  };
}

// A Quoted timeline that starts when the project was made.
function quotedTimeline(quotedAt) {
  return {
    stage: "quoted", quotedAt: quotedAt, workingAt: null, paidAt: null,
    agreedCents: null, plannedHours: null, expensesCents: null, targetCents: null,
    requests: [], receivedCents: null, actualHours: null,
  };
}

// The project's timeline (a clean copy), or a Quoted one starting at
// project.created when it has none. A timeline that isn't valid gives null.
function timelineOf(project) {
  if (!project || typeof project !== "object") return null;
  if (project.timeline === undefined) return quotedTimeline(project.created);
  return cleanTimeline(project.timeline);
}

// A copy of the project with this timeline, or with none for Quoted.
function withTimeline(project, timeline) {
  const next = Object.assign({}, project);
  if (timeline) next.timeline = timeline;
  else delete next.timeline;
  return next;
}

// Quoted to Working, keeping the agreed price, planned hours, expenses, and
// target as they are now. Returns { ok: true, project } or { ok: false, reason }:
// "bad-timeline", "not-quoted", "bad-agreed", "bad-planned-hours",
// "bad-expenses", "bad-target", or "bad-date" (now isn't a date, or is before
// the project was made).
function markWorking(project, values, now) {
  const current = timelineOf(project);
  if (!current || !isIso(current.quotedAt)) return { ok: false, reason: "bad-timeline" };
  if (current.stage !== "quoted") return { ok: false, reason: "not-quoted" };
  const v = values || {};
  if (!isCents(v.agreedCents) || v.agreedCents <= 0) return { ok: false, reason: "bad-agreed" };
  if (!isHours(v.plannedHours)) return { ok: false, reason: "bad-planned-hours" };
  if (!isCents(v.expensesCents)) return { ok: false, reason: "bad-expenses" };
  if (!isCents(v.targetCents)) return { ok: false, reason: "bad-target" };
  const at = now === undefined ? new Date() : now;
  if (!isValidDate(at) || at.getTime() < Date.parse(current.quotedAt)) return { ok: false, reason: "bad-date" };
  const timeline = Object.assign(quotedTimeline(current.quotedAt), {
    stage: "working",
    workingAt: at.toISOString(),
    agreedCents: v.agreedCents,
    plannedHours: v.plannedHours,
    expensesCents: v.expensesCents,
    targetCents: v.targetCents,
  });
  return { ok: true, project: withTimeline(project, timeline) };
}

// Working to Paid. receivedCents can be 0; actualHours is the real total.
// Returns { ok: true, project } or { ok: false, reason }: "bad-timeline",
// "not-working", "bad-received", "bad-actual-hours", or "bad-date" (now isn't
// a date, or is before the project moved to Working).
function markPaid(project, values, now) {
  const current = timelineOf(project);
  if (!current) return { ok: false, reason: "bad-timeline" };
  if (current.stage !== "working") return { ok: false, reason: "not-working" };
  const v = values || {};
  if (!isCents(v.receivedCents)) return { ok: false, reason: "bad-received" };
  if (!isHours(v.actualHours)) return { ok: false, reason: "bad-actual-hours" };
  const at = now === undefined ? new Date() : now;
  if (!isValidDate(at) || at.getTime() < Date.parse(current.workingAt)) return { ok: false, reason: "bad-date" };
  const timeline = Object.assign(current, {
    stage: "paid",
    paidAt: at.toISOString(),
    receivedCents: v.receivedCents,
    actualHours: v.actualHours,
  });
  return { ok: true, project: withTimeline(project, timeline) };
}

// Back one stage, to fix a mistake. Paid to Working clears the paid date, the
// money received, and the real hours. Working to Quoted removes the timeline,
// and is refused while there are change requests, since they'd be lost.
// Returns { ok: true, project } or { ok: false, reason }: "bad-timeline",
// "already-quoted", or "has-requests". `now` isn't used: moving back records
// no date. It's taken so every stage change is called the same way.
function moveBack(project, now) {
  const current = timelineOf(project);
  if (!current) return { ok: false, reason: "bad-timeline" };
  if (current.stage === "quoted") return { ok: false, reason: "already-quoted" };
  if (current.stage === "paid") {
    const timeline = Object.assign(current, { stage: "working", paidAt: null, receivedCents: null, actualHours: null });
    return { ok: true, project: withTimeline(project, timeline) };
  }
  if (current.requests.length) return { ok: false, reason: "has-requests" };
  return { ok: true, project: withTimeline(project, null) };
}

function sum(list, key) {
  return list.reduce(function (total, item) { return total + item[key]; }, 0);
}

// Math.round rounds halves up (toward +infinity) for negative values too:
// -1.5 gives -1, and -0.5 gives 0 (never -0, so it can't show as "-$0.00").
function roundCents(value) {
  const rounded = Math.round(value);
  return rounded === 0 ? 0 : rounded;
}

// The hourly rate after expenses, in whole cents, or null when Quoted (or the
// timeline isn't valid). Working: the agreed price plus charged requests, less
// expenses, over the planned hours plus every request's hours. Paid: the money
// received less expenses, over the real hours. Less money than expenses gives
// a negative rate, not an error.
function rateNowCents(project) {
  const timeline = timelineOf(project);
  if (!timeline || timeline.stage === "quoted") return null;
  if (timeline.stage === "paid") {
    return roundCents((timeline.receivedCents - timeline.expensesCents) / timeline.actualHours);
  }
  const money = timeline.agreedCents + sum(timeline.requests, "chargeCents") - timeline.expensesCents;
  const hours = timeline.plannedHours + sum(timeline.requests, "hours");
  return roundCents(money / hours);
}

// Typed dollars as whole cents: "270", "$270", "270.5", "270.50", "1,200",
// " 270 ". Blank, negative, more than 2 decimals, commas not in groups of
// three, anything else, or over $100,000 give null.
const DOLLARS_PATTERN = /^\$?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/;
function dollarsToCents(text) {
  if (typeof text !== "string") return null;
  const match = DOLLARS_PATTERN.exec(text.trim());
  if (!match) return null;
  const whole = Number(match[1].replace(/,/g, ""));
  const fraction = match[2] ? Number((match[2] + "0").slice(0, 2)) : 0;
  const cents = whole * 100 + fraction;
  return isCents(cents) ? cents : null;
}

// Hours rounded to 2 decimals, the way they're saved ("6.000000001" from
// adding 0.1s becomes 6).
function roundHours(hours) {
  return Math.round(hours * 100) / 100;
}

// The planned rate after expenses, in whole cents: the agreed price less
// expenses, over the planned hours. Null when Quoted (or not valid).
function plannedRateCents(project) {
  const timeline = timelineOf(project);
  if (!timeline || timeline.stage === "quoted") return null;
  return roundCents((timeline.agreedCents - timeline.expensesCents) / timeline.plannedHours);
}

// Any money over any hours, after expenses, in whole cents. Null when a value
// isn't whole cents or the hours aren't valid hours.
function rateAfterCents(moneyCents, expensesCents, hours) {
  if (!isCents(moneyCents) || !isCents(expensesCents) || !isHours(hours)) return null;
  return roundCents((moneyCents - expensesCents) / hours);
}

// What "Mark as paid" starts with: the agreed price plus charged requests, and
// the planned hours plus every request's hours. Null unless Working.
function paidDefaults(project) {
  const timeline = timelineOf(project);
  if (!timeline || timeline.stage !== "working") return null;
  return {
    receivedCents: timeline.agreedCents + sum(timeline.requests, "chargeCents"),
    actualHours: roundHours(timeline.plannedHours + sum(timeline.requests, "hours")),
  };
}

// Typed hours as a number: "13", "13.5", ".75", " 13 ". Above 0, at most 1000,
// up to 2 decimals. Anything else gives null.
const HOURS_PATTERN = /^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/;
function hoursFromText(text) {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!HOURS_PATTERN.test(trimmed)) return null;
  const hours = Number(trimmed);
  return isHours(hours) ? hours : null;
}

// One scale for every bar in a rate chart, in whole cents: the largest of the
// values shown and the target, times 1.2, rounded up to the next $5. Never
// less than $5, so a chart of zeros still has a scale.
const BAR_STEP_CENTS = 500;
function barScaleCents(valuesCents, targetCents) {
  const all = (valuesCents || []).concat([targetCents]).filter(function (value) {
    return typeof value === "number" && isFinite(value);
  });
  const largest = Math.max.apply(null, [0].concat(all));
  // Rounded to the cent first, so 1.2 times a whole number of cents that
  // lands on a multiple of $5 doesn't round up a step from float noise.
  const scaled = Math.round(largest * 1.2);
  return Math.max(BAR_STEP_CENTS, Math.ceil(scaled / BAR_STEP_CENTS) * BAR_STEP_CENTS);
}

// How much of the bar a value fills, from 0 to 1. Negative fills nothing.
function barShare(valueCents, scaleCents) {
  if (!(scaleCents > 0) || !(valueCents > 0)) return 0;
  return Math.min(1, valueCents / scaleCents);
}

const projectTimeline = {
  STAGES,
  MAX_CENTS,
  MAX_HOURS,
  cleanTimeline,
  timelineOf,
  markWorking,
  markPaid,
  moveBack,
  rateNowCents,
  dollarsToCents,
  roundHours,
  plannedRateCents,
  rateAfterCents,
  paidDefaults,
  hoursFromText,
  barScaleCents,
  barShare,
};

if (typeof module !== "undefined") module.exports = projectTimeline;
