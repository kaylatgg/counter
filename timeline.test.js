// Project stage tests. Run with: node timeline.test.js
// Uses only Node's built-in assert, so nothing needs installing.

const assert = require("assert");
const projectTimeline = require("./timeline.js");

let passed = 0;
let failed = 0;

function group(title) {
  console.log("\n" + title);
}

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log("  PASS  " + name);
  } catch (error) {
    failed++;
    console.log("  FAIL  " + name);
    console.log("        " + error.message.split("\n").join("\n        "));
  }
}

// Freezes an object and everything in it, so a function that changes its
// input throws (in strict mode) or leaves it as it was, and the test sees it.
function deepFreeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

const CREATED = "2026-10-11T15:42:00.000Z";
const WORKING_AT = new Date("2026-10-13T09:00:00.000Z");
const PAID_AT = new Date("2026-10-30T17:30:00.000Z");

// Luigi's menu from the design: $270 agreed, 10 planned hours, $20 expenses,
// a $25 target.
const LUIGI = deepFreeze({
  id: "3f0c2a9e-1b7d-4c55-9a43-0d2f8e6b1c11", name: "Luigi's menu", field: "graphic", job: "menu",
  inputs: { count: "2", rounds: "2", setupHours: "2", itemHours: "2", communicationHours: "1.5",
    roundHours: "1.5", deliveryHours: "1", rate: "25", expenses: "20", offerStatus: "amount", offer: "200" },
  quote: "270", reply: "", replyEdited: false, gapChoice: "",
  created: CREATED, edited: "2026-10-12T09:05:00.000Z",
});
const AGREED = deepFreeze({ agreedCents: 27000, plannedHours: 10, expensesCents: 2000, targetCents: 2500 });
const RECEIVED = deepFreeze({ receivedCents: 31000, actualHours: 13 });

const WORKING_TIMELINE = deepFreeze({
  stage: "working", quotedAt: CREATED, workingAt: WORKING_AT.toISOString(), paidAt: null,
  agreedCents: 27000, plannedHours: 10, expensesCents: 2000, targetCents: 2500,
  requests: [], receivedCents: null, actualHours: null,
});
const PAID_TIMELINE = deepFreeze(Object.assign({}, WORKING_TIMELINE, {
  stage: "paid", paidAt: PAID_AT.toISOString(), receivedCents: 31000, actualHours: 13,
}));
const FREE_REQUEST = deepFreeze({
  id: "r1", at: "2026-10-20T12:00:00.000Z", text: "Add a dessert section", hours: 1,
  decision: "free", rateCents: 2500, chargeCents: 0,
});
const CHARGED_REQUEST = deepFreeze({
  id: "r2", at: "2026-10-21T12:00:00.000Z", text: "Second language version", hours: 2,
  decision: "charge", rateCents: 2500, chargeCents: 5000,
});

function withTimeline(timeline) {
  return deepFreeze(Object.assign(copy(LUIGI), { timeline: copy(timeline) }));
}
function timelineWith(base, changes) {
  return Object.assign(copy(base), changes);
}

// A function's result for a frozen input, checking the input didn't change.
function unchanged(input, fn) {
  const before = JSON.stringify(input);
  const result = fn(input);
  assert.strictEqual(JSON.stringify(input), before, "the input changed");
  return result;
}

group("Stages");

test("STAGES lists quoted, working, paid in order", function () {
  assert.deepStrictEqual(projectTimeline.STAGES, ["quoted", "working", "paid"]);
});

test("a project with no timeline is Quoted, starting when it was made", function () {
  assert.deepStrictEqual(projectTimeline.timelineOf(LUIGI), {
    stage: "quoted", quotedAt: CREATED, workingAt: null, paidAt: null,
    agreedCents: null, plannedHours: null, expensesCents: null, targetCents: null,
    requests: [], receivedCents: null, actualHours: null,
  });
  assert.strictEqual("timeline" in LUIGI, false);
});

test("timelineOf gives the project's own timeline as a clean copy", function () {
  const project = withTimeline(WORKING_TIMELINE);
  const timeline = projectTimeline.timelineOf(project);
  assert.deepStrictEqual(timeline, WORKING_TIMELINE);
  assert.notStrictEqual(timeline, project.timeline);
});

test("timelineOf gives null for a timeline that isn't valid", function () {
  assert.strictEqual(projectTimeline.timelineOf(withTimeline(timelineWith(WORKING_TIMELINE, { stage: "done" }))), null);
  assert.strictEqual(projectTimeline.timelineOf(null), null);
});

group("markWorking");

test("Quoted to Working keeps the snapshots and the dates", function () {
  const result = unchanged(LUIGI, function (p) { return projectTimeline.markWorking(p, AGREED, WORKING_AT); });
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(result.project.timeline, WORKING_TIMELINE);
  // Everything else about the project stays the same.
  const rest = Object.assign({}, result.project);
  delete rest.timeline;
  assert.deepStrictEqual(rest, LUIGI);
  assert.notStrictEqual(result.project, LUIGI);
});

test("the snapshots don't follow later edits to the calculation", function () {
  const working = projectTimeline.markWorking(LUIGI, AGREED, WORKING_AT).project;
  const edited = Object.assign({}, working, { inputs: Object.assign({}, working.inputs, { rate: "40", expenses: "90" }), quote: "500" });
  assert.deepStrictEqual(projectTimeline.timelineOf(edited), WORKING_TIMELINE);
  assert.strictEqual(projectTimeline.rateNowCents(edited), 2500);
});

test("refused when the project isn't Quoted", function () {
  for (const timeline of [WORKING_TIMELINE, PAID_TIMELINE]) {
    assert.deepStrictEqual(projectTimeline.markWorking(withTimeline(timeline), AGREED, PAID_AT), { ok: false, reason: "not-quoted" });
  }
});

test("refused when the timeline or created date isn't valid", function () {
  assert.deepStrictEqual(projectTimeline.markWorking(withTimeline({ stage: "nope" }), AGREED, WORKING_AT), { ok: false, reason: "bad-timeline" });
  const noDate = deepFreeze(Object.assign(copy(LUIGI), { created: "yesterday" }));
  assert.deepStrictEqual(projectTimeline.markWorking(noDate, AGREED, WORKING_AT), { ok: false, reason: "bad-timeline" });
});

// Values outside the ranges, for every snapshot.
const BAD_CENTS = [-1, 0.5, 10000001, NaN, Infinity, "2700", null, undefined, true];
const BAD_HOURS = [0, -1, 1000.01, 1001, 1.234, 0.001, NaN, Infinity, "10", null, undefined];

test("refused for every out-of-range agreed price, including 0", function () {
  for (const value of BAD_CENTS.concat([0])) {
    assert.deepStrictEqual(projectTimeline.markWorking(LUIGI, Object.assign({}, AGREED, { agreedCents: value }), WORKING_AT),
      { ok: false, reason: "bad-agreed" }, String(value));
  }
});

test("refused for every out-of-range planned hours", function () {
  for (const value of BAD_HOURS) {
    assert.deepStrictEqual(projectTimeline.markWorking(LUIGI, Object.assign({}, AGREED, { plannedHours: value }), WORKING_AT),
      { ok: false, reason: "bad-planned-hours" }, String(value));
  }
});

test("refused for every out-of-range expenses and target", function () {
  for (const value of BAD_CENTS) {
    assert.deepStrictEqual(projectTimeline.markWorking(LUIGI, Object.assign({}, AGREED, { expensesCents: value }), WORKING_AT),
      { ok: false, reason: "bad-expenses" }, String(value));
    assert.deepStrictEqual(projectTimeline.markWorking(LUIGI, Object.assign({}, AGREED, { targetCents: value }), WORKING_AT),
      { ok: false, reason: "bad-target" }, String(value));
  }
});

test("missing values are refused", function () {
  assert.deepStrictEqual(projectTimeline.markWorking(LUIGI, undefined, WORKING_AT), { ok: false, reason: "bad-agreed" });
  assert.deepStrictEqual(projectTimeline.markWorking(LUIGI, {}, WORKING_AT), { ok: false, reason: "bad-agreed" });
});

test("the edges of the ranges are allowed", function () {
  const edges = { agreedCents: 10000000, plannedHours: 1000, expensesCents: 0, targetCents: 0 };
  assert.strictEqual(projectTimeline.markWorking(LUIGI, edges, WORKING_AT).ok, true);
  const small = { agreedCents: 1, plannedHours: 0.01, expensesCents: 10000000, targetCents: 10000000 };
  assert.strictEqual(projectTimeline.markWorking(LUIGI, small, WORKING_AT).ok, true);
  assert.strictEqual(projectTimeline.markWorking(LUIGI, Object.assign({}, AGREED, { plannedHours: 0.29 }), WORKING_AT).ok, true);
});

test("refused when now isn't a date or is before the project was made", function () {
  for (const now of [new Date("nope"), "2026-10-13T09:00:00.000Z", null, new Date("2026-10-11T15:41:59.999Z")]) {
    assert.deepStrictEqual(projectTimeline.markWorking(LUIGI, AGREED, now), { ok: false, reason: "bad-date" }, String(now));
  }
  assert.strictEqual(projectTimeline.markWorking(LUIGI, AGREED, new Date(CREATED)).ok, true);
});

group("markPaid");

test("Working to Paid adds the money received, the real hours, and the date", function () {
  const working = withTimeline(WORKING_TIMELINE);
  const result = unchanged(working, function (p) { return projectTimeline.markPaid(p, RECEIVED, PAID_AT); });
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(result.project.timeline, PAID_TIMELINE);
});

test("requests are kept when marked Paid", function () {
  const working = withTimeline(timelineWith(WORKING_TIMELINE, { requests: [FREE_REQUEST] }));
  const result = projectTimeline.markPaid(working, RECEIVED, PAID_AT);
  assert.deepStrictEqual(result.project.timeline.requests, [FREE_REQUEST]);
});

test("$0 received is allowed", function () {
  const result = projectTimeline.markPaid(withTimeline(WORKING_TIMELINE), { receivedCents: 0, actualHours: 13 }, PAID_AT);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.project.timeline.receivedCents, 0);
});

test("refused unless the project is Working", function () {
  assert.deepStrictEqual(projectTimeline.markPaid(LUIGI, RECEIVED, PAID_AT), { ok: false, reason: "not-working" });
  assert.deepStrictEqual(projectTimeline.markPaid(withTimeline(PAID_TIMELINE), RECEIVED, PAID_AT), { ok: false, reason: "not-working" });
  assert.deepStrictEqual(projectTimeline.markPaid(withTimeline({ stage: "paid" }), RECEIVED, PAID_AT), { ok: false, reason: "bad-timeline" });
});

test("refused for every out-of-range money received and real hours", function () {
  const working = withTimeline(WORKING_TIMELINE);
  for (const value of BAD_CENTS) {
    assert.deepStrictEqual(projectTimeline.markPaid(working, { receivedCents: value, actualHours: 13 }, PAID_AT),
      { ok: false, reason: "bad-received" }, String(value));
  }
  for (const value of BAD_HOURS) {
    assert.deepStrictEqual(projectTimeline.markPaid(working, { receivedCents: 31000, actualHours: value }, PAID_AT),
      { ok: false, reason: "bad-actual-hours" }, String(value));
  }
  assert.deepStrictEqual(projectTimeline.markPaid(working, undefined, PAID_AT), { ok: false, reason: "bad-received" });
});

test("refused when now isn't a date or is before Working began", function () {
  const working = withTimeline(WORKING_TIMELINE);
  for (const now of [new Date("nope"), "2026-10-30", new Date("2026-10-13T08:59:59.999Z")]) {
    assert.deepStrictEqual(projectTimeline.markPaid(working, RECEIVED, now), { ok: false, reason: "bad-date" }, String(now));
  }
  assert.strictEqual(projectTimeline.markPaid(working, RECEIVED, WORKING_AT).ok, true);
});

group("moveBack");

test("Paid to Working clears the paid date, money received, and real hours", function () {
  const paid = withTimeline(timelineWith(PAID_TIMELINE, { requests: [FREE_REQUEST] }));
  const result = unchanged(paid, function (p) { return projectTimeline.moveBack(p, PAID_AT); });
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(result.project.timeline, timelineWith(WORKING_TIMELINE, { requests: [FREE_REQUEST] }));
});

test("Working to Quoted removes the timeline entirely", function () {
  const working = withTimeline(WORKING_TIMELINE);
  const result = unchanged(working, function (p) { return projectTimeline.moveBack(p, PAID_AT); });
  assert.strictEqual(result.ok, true);
  assert.strictEqual("timeline" in result.project, false);
  assert.deepStrictEqual(result.project, LUIGI);
});

test("Working to Quoted is refused while there are requests", function () {
  const working = withTimeline(timelineWith(WORKING_TIMELINE, { requests: [FREE_REQUEST] }));
  assert.deepStrictEqual(projectTimeline.moveBack(working, PAID_AT), { ok: false, reason: "has-requests" });
});

test("refused on Quoted, and on a timeline that isn't valid", function () {
  assert.deepStrictEqual(projectTimeline.moveBack(LUIGI, PAID_AT), { ok: false, reason: "already-quoted" });
  assert.deepStrictEqual(projectTimeline.moveBack(withTimeline(timelineWith(WORKING_TIMELINE, { requests: "x" })), PAID_AT),
    { ok: false, reason: "bad-timeline" });
});

test("the whole round trip: Quoted, Working, Paid, then back to Quoted", function () {
  const working = projectTimeline.markWorking(LUIGI, AGREED, WORKING_AT).project;
  const paid = projectTimeline.markPaid(working, RECEIVED, PAID_AT).project;
  const back = projectTimeline.moveBack(paid).project;
  assert.deepStrictEqual(back, working);
  assert.deepStrictEqual(projectTimeline.moveBack(back).project, LUIGI);
});

group("rateNowCents");

test("Luigi's menu, Working: $270 less $20 over 10 hrs is 2500 cents", function () {
  assert.strictEqual(projectTimeline.rateNowCents(withTimeline(WORKING_TIMELINE)), 2500);
});

test("with one free 1 hr request: $250 over 11 hrs is 2273 cents", function () {
  assert.strictEqual(projectTimeline.rateNowCents(withTimeline(timelineWith(WORKING_TIMELINE, { requests: [FREE_REQUEST] }))), 2273);
});

test("a charged request adds its money and its hours", function () {
  // ($270 + $50 - $20) over 12 hrs is $25.
  assert.strictEqual(projectTimeline.rateNowCents(withTimeline(timelineWith(WORKING_TIMELINE, { requests: [CHARGED_REQUEST] }))), 2500);
  // ($270 + $50 - $20) over 13 hrs is 2307.69 cents.
  assert.strictEqual(projectTimeline.rateNowCents(withTimeline(timelineWith(WORKING_TIMELINE, { requests: [FREE_REQUEST, CHARGED_REQUEST] }))), 2308);
});

test("Paid: $310 less $20 over 13 real hrs is 2231 cents", function () {
  assert.strictEqual(projectTimeline.rateNowCents(withTimeline(PAID_TIMELINE)), 2231);
});

test("Quoted, and a timeline that isn't valid, give null", function () {
  assert.strictEqual(projectTimeline.rateNowCents(LUIGI), null);
  assert.strictEqual(projectTimeline.rateNowCents(withTimeline({ stage: "paid" })), null);
});

test("less money than expenses gives a negative rate", function () {
  // $0 received, $20 expenses, 13 hrs: -153.85 cents.
  assert.strictEqual(projectTimeline.rateNowCents(withTimeline(timelineWith(PAID_TIMELINE, { receivedCents: 0 }))), -154);
  const working = timelineWith(WORKING_TIMELINE, { agreedCents: 1000, expensesCents: 2000 });
  assert.strictEqual(projectTimeline.rateNowCents(withTimeline(working)), -100);
});

test("halves round up, toward +infinity, for negative rates too; -0.5 gives 0, never -0", function () {
  const paid = function (received, hours) {
    return withTimeline(timelineWith(PAID_TIMELINE, { receivedCents: received, expensesCents: 2000, actualHours: hours }));
  };
  // 1 cent short over 2 hrs: -0.5 cents.
  assert.ok(Object.is(projectTimeline.rateNowCents(paid(1999, 2)), 0));
  // 3 cents short over 2 hrs: -1.5 cents.
  assert.strictEqual(projectTimeline.rateNowCents(paid(1997, 2)), -1);
  // 5 cents short over 2 hrs: -2.5 cents.
  assert.strictEqual(projectTimeline.rateNowCents(paid(1995, 2)), -2);
  // 1 cent over over 2 hrs: 0.5 cents.
  assert.strictEqual(projectTimeline.rateNowCents(paid(2001, 2)), 1);
  // Exactly expenses: 0, not -0.
  assert.ok(Object.is(projectTimeline.rateNowCents(paid(2000, 2)), 0));
});

group("cleanTimeline");

test("valid Working and Paid timelines come back equal, as new objects", function () {
  for (const timeline of [WORKING_TIMELINE, PAID_TIMELINE, timelineWith(WORKING_TIMELINE, { requests: [FREE_REQUEST, CHARGED_REQUEST] })]) {
    const clean = unchanged(timeline, projectTimeline.cleanTimeline);
    assert.deepStrictEqual(clean, timeline);
    assert.notStrictEqual(clean, timeline);
  }
});

test("a Quoted timeline is valid with no working or paid fields", function () {
  const quoted = projectTimeline.timelineOf(LUIGI);
  assert.deepStrictEqual(projectTimeline.cleanTimeline(quoted), quoted);
  // Missing fields count as null.
  assert.deepStrictEqual(projectTimeline.cleanTimeline({ stage: "quoted", quotedAt: CREATED, requests: [] }), quoted);
});

test("unknown keys are dropped, in the timeline and in requests", function () {
  const extra = timelineWith(WORKING_TIMELINE, { color: "red", requests: [Object.assign({ note: "x" }, FREE_REQUEST)] });
  assert.deepStrictEqual(projectTimeline.cleanTimeline(extra), timelineWith(WORKING_TIMELINE, { requests: [FREE_REQUEST] }));
});

test("request text is trimmed", function () {
  const padded = timelineWith(WORKING_TIMELINE, { requests: [Object.assign({}, FREE_REQUEST, { text: "  Add a dessert section \n" })] });
  assert.strictEqual(projectTimeline.cleanTimeline(padded).requests[0].text, "Add a dessert section");
});

test("not an object, or an unknown stage, is null", function () {
  for (const raw of [null, undefined, "working", 3, [], timelineWith(WORKING_TIMELINE, { stage: "done" }), timelineWith(WORKING_TIMELINE, { stage: "Working" })]) {
    assert.strictEqual(projectTimeline.cleanTimeline(raw), null, JSON.stringify(raw));
  }
});

test("Quoted with any working or paid field set is null", function () {
  const quoted = projectTimeline.timelineOf(LUIGI);
  const fields = { workingAt: WORKING_AT.toISOString(), agreedCents: 27000, plannedHours: 10, expensesCents: 2000, targetCents: 2500,
    paidAt: PAID_AT.toISOString(), receivedCents: 31000, actualHours: 13, requests: [FREE_REQUEST] };
  Object.keys(fields).forEach(function (key) {
    assert.strictEqual(projectTimeline.cleanTimeline(timelineWith(quoted, { [key]: fields[key] })), null, key);
  });
  // A 0 counts as set.
  assert.strictEqual(projectTimeline.cleanTimeline(timelineWith(quoted, { expensesCents: 0 })), null);
});

test("Working missing any working field, or with any paid field set, is null", function () {
  ["workingAt", "agreedCents", "plannedHours", "expensesCents", "targetCents"].forEach(function (key) {
    assert.strictEqual(projectTimeline.cleanTimeline(timelineWith(WORKING_TIMELINE, { [key]: null })), null, key);
  });
  const paidFields = { paidAt: PAID_AT.toISOString(), receivedCents: 0, actualHours: 13 };
  Object.keys(paidFields).forEach(function (key) {
    assert.strictEqual(projectTimeline.cleanTimeline(timelineWith(WORKING_TIMELINE, { [key]: paidFields[key] })), null, key);
  });
});

test("Paid missing any field is null", function () {
  ["quotedAt", "workingAt", "paidAt", "agreedCents", "plannedHours", "expensesCents", "targetCents", "receivedCents", "actualHours", "requests"].forEach(function (key) {
    const missing = copy(PAID_TIMELINE);
    delete missing[key];
    assert.strictEqual(projectTimeline.cleanTimeline(missing), null, key);
  });
});

test("out-of-range money and hours are null", function () {
  for (const value of BAD_CENTS.concat([0])) {
    assert.strictEqual(projectTimeline.cleanTimeline(timelineWith(PAID_TIMELINE, { agreedCents: value })), null, "agreed " + value);
  }
  for (const value of BAD_CENTS) {
    for (const key of ["expensesCents", "targetCents", "receivedCents"]) {
      assert.strictEqual(projectTimeline.cleanTimeline(timelineWith(PAID_TIMELINE, { [key]: value })), null, key + " " + value);
    }
  }
  for (const value of BAD_HOURS) {
    for (const key of ["plannedHours", "actualHours"]) {
      assert.strictEqual(projectTimeline.cleanTimeline(timelineWith(PAID_TIMELINE, { [key]: value })), null, key + " " + value);
    }
  }
});

test("dates that aren't ISO dates are null", function () {
  for (const value of ["", "yesterday", "2026-10-13", "10/13/2026", "2026-13-45T09:00:00.000Z", 1760000000000, null]) {
    for (const key of ["quotedAt", "workingAt", "paidAt"]) {
      assert.strictEqual(projectTimeline.cleanTimeline(timelineWith(PAID_TIMELINE, { [key]: value })), null, key + " " + value);
    }
  }
  // Without milliseconds, or with an offset, is still ISO.
  assert.ok(projectTimeline.cleanTimeline(timelineWith(PAID_TIMELINE, { paidAt: "2026-10-30T17:30:00Z" })));
  assert.ok(projectTimeline.cleanTimeline(timelineWith(PAID_TIMELINE, { paidAt: "2026-10-30T13:30:00-04:00" })));
});

test("dates out of order are null; equal dates are fine", function () {
  assert.strictEqual(projectTimeline.cleanTimeline(timelineWith(WORKING_TIMELINE, { quotedAt: "2026-10-14T00:00:00.000Z" })), null);
  assert.strictEqual(projectTimeline.cleanTimeline(timelineWith(PAID_TIMELINE, { paidAt: "2026-10-12T00:00:00.000Z" })), null);
  const same = WORKING_AT.toISOString();
  assert.ok(projectTimeline.cleanTimeline(timelineWith(PAID_TIMELINE, { quotedAt: same, paidAt: same })));
  // Compared as moments, not as text: 13:30 at -04:00 is after 17:00Z.
  assert.ok(projectTimeline.cleanTimeline(timelineWith(PAID_TIMELINE, { workingAt: "2026-10-30T17:00:00.000Z", paidAt: "2026-10-30T13:30:00-04:00" })));
});

test("requests that aren't a list are null", function () {
  for (const value of [null, undefined, {}, "none", 0]) {
    assert.strictEqual(projectTimeline.cleanTimeline(timelineWith(WORKING_TIMELINE, { requests: value })), null, String(value));
  }
});

test("bad requests are null", function () {
  const bad = [
    null, "request", [], {},
    { id: "" }, { id: 7 }, { id: undefined },
    { at: "today" }, { at: null },
    { text: "" }, { text: "   " }, { text: "x".repeat(121) }, { text: 5 }, { text: undefined },
    { hours: 0 }, { hours: -1 }, { hours: 1000.5 }, { hours: 1.234 }, { hours: "1" }, { hours: NaN },
    { decision: "maybe" }, { decision: "Free" }, { decision: undefined },
    { rateCents: -1 }, { rateCents: 2500.5 }, { rateCents: 10000001 }, { rateCents: "2500" },
    { chargeCents: -1 }, { chargeCents: 0.5 }, { chargeCents: 10000001 }, { chargeCents: null },
    // Free requests charge nothing.
    { decision: "free", chargeCents: 100 },
  ];
  bad.forEach(function (changes) {
    const request = changes && typeof changes === "object" && !Array.isArray(changes) && Object.keys(changes).length
      ? Object.assign({}, FREE_REQUEST, changes) : changes;
    assert.strictEqual(projectTimeline.cleanTimeline(timelineWith(WORKING_TIMELINE, { requests: [CHARGED_REQUEST, request] })), null, JSON.stringify(changes));
  });
});

test("request edges: 120 characters, 1000 hours, a $0 charge", function () {
  const edges = [
    Object.assign({}, FREE_REQUEST, { text: "x".repeat(120), hours: 1000 }),
    Object.assign({}, CHARGED_REQUEST, { chargeCents: 0, rateCents: 0, hours: 0.01 }),
  ];
  assert.deepStrictEqual(projectTimeline.cleanTimeline(timelineWith(WORKING_TIMELINE, { requests: edges })).requests, edges);
});

group("dollarsToCents");

test("typed dollars become whole cents", function () {
  const cases = { "270": 27000, "$270": 27000, "270.5": 27050, "270.50": 27050, "1,200": 120000, " 270 ": 27000,
    "0": 0, "0.05": 5, "$1,234,567.89": null, "100,000": 10000000, "100000.00": 10000000, "99999.99": 9999999, "1,000,000": null };
  Object.keys(cases).forEach(function (text) {
    assert.strictEqual(projectTimeline.dollarsToCents(text), cases[text], JSON.stringify(text));
  });
});

test("anything else gives null", function () {
  for (const text of ["", "   ", "abc", "-5", "1.234", "1,20", "100000.01", "100001", "$", "270.", ".5", "1,2000", "12 70", "$-5", "270$", "1e3", "0x10"]) {
    assert.strictEqual(projectTimeline.dollarsToCents(text), null, JSON.stringify(text));
  }
  for (const value of [null, undefined, 270, NaN]) {
    assert.strictEqual(projectTimeline.dollarsToCents(value), null, String(value));
  }
});

group("Client requests");

// Luigi's menu, Working since WORKING_AT.
const REQUEST_AT = new Date("2026-10-20T12:00:00.000Z");
const WORKING_LUIGI = withTimeline(WORKING_TIMELINE);

// Adds a request and checks the result is clean, saved-shape data.
function added(project, values, now, id) {
  const result = unchanged(project, function (p) { return projectTimeline.addRequest(p, values, now || REQUEST_AT, id || "r1"); });
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  assert.deepStrictEqual(projectTimeline.cleanTimeline(result.project.timeline), result.project.timeline);
  return deepFreeze(result.project);
}

test("charge: hours x rate, rounded up to the next $5", function () {
  assert.strictEqual(projectTimeline.requestChargeCents(1.5, 2500), 4000);
  assert.strictEqual(projectTimeline.requestChargeCents(1, 2500), 2500);
  assert.strictEqual(projectTimeline.requestChargeCents(2, 2500), 5000);
  assert.strictEqual(projectTimeline.requestChargeCents(0.5, 2500), 1500);
  // Rounded to the cent first: 0.33 x 1503 = 495.99 cents, 496, up to $5.
  assert.strictEqual(projectTimeline.requestChargeCents(0.33, 1503), 500);
  assert.strictEqual(projectTimeline.requestChargeCents(1, 0), 0);
  [[0, 2500], [-1, 2500], [1.234, 2500], [1001, 2500], [null, 2500], [1, -1], [1, 25.5], [1, null], [1, 10000001]].forEach(function (pair) {
    assert.strictEqual(projectTimeline.requestChargeCents(pair[0], pair[1]), null, JSON.stringify(pair));
  });
});

test("a 1 hr free request: the rate now is $22.73, down $2.27 from planned", function () {
  const project = added(WORKING_LUIGI, { text: "  Darker background on both pages ", hours: 1, decision: "free" });
  assert.deepStrictEqual(project.timeline.requests, [{
    id: "r1", at: REQUEST_AT.toISOString(), text: "Darker background on both pages", hours: 1,
    decision: "free", rateCents: 2500, chargeCents: 0,
  }]);
  assert.strictEqual(projectTimeline.rateNowCents(project), 2273);
  const steps = projectTimeline.requestSteps(project);
  assert.strictEqual(steps.length, 1);
  assert.strictEqual(steps[0].rateCents, 2273);
  assert.strictEqual(steps[0].deltaCents, -227);
  assert.deepStrictEqual(steps[0].request, project.timeline.requests[0]);
  // Everything but the timeline stays the same.
  const rest = Object.assign({}, project);
  delete rest.timeline;
  assert.deepStrictEqual(rest, LUIGI);
});

test("a charged request: the charge is at the target, and adds to the money", function () {
  const project = added(WORKING_LUIGI, { text: "One more round", hours: 1.5, decision: "charge" });
  assert.strictEqual(project.timeline.requests[0].chargeCents, 4000);
  assert.strictEqual(project.timeline.requests[0].rateCents, 2500);
  // ($270 + $40 - $20) / 11.5 = $25.217...
  assert.strictEqual(projectTimeline.rateNowCents(project), 2522);
});

test("preview after a 1 hr free request, for 1.5 hrs more", function () {
  const project = added(WORKING_LUIGI, { text: "Darker background", hours: 1, decision: "free" });
  const preview = unchanged(project, function (p) { return projectTimeline.previewRequest(p, 1.5); });
  assert.deepStrictEqual(preview, {
    moneyCents: 27000, hoursSoFar: 11, nowCents: 2273, freeCents: 2000,
    chargeAmountCents: 4000, chargeCents: 2320, targetCents: 2500,
  });
});

test("preview with no requests: now is the planned rate", function () {
  const preview = projectTimeline.previewRequest(WORKING_LUIGI, 1);
  assert.deepStrictEqual(preview, {
    moneyCents: 27000, hoursSoFar: 10, nowCents: 2500, freeCents: 2273,
    chargeAmountCents: 2500, chargeCents: 2500, targetCents: 2500,
  });
});

test("preview counts earlier charges and hours", function () {
  const project = withTimeline(timelineWith(WORKING_TIMELINE, { requests: [FREE_REQUEST, CHARGED_REQUEST] }));
  const preview = projectTimeline.previewRequest(project, 1);
  assert.strictEqual(preview.moneyCents, 32000);
  assert.strictEqual(preview.hoursSoFar, 13);
  assert.strictEqual(preview.nowCents, projectTimeline.rateNowCents(project));
});

test("preview is null unless Working with valid hours", function () {
  assert.strictEqual(projectTimeline.previewRequest(LUIGI, 1), null);
  assert.strictEqual(projectTimeline.previewRequest(withTimeline(PAID_TIMELINE), 1), null);
  assert.strictEqual(projectTimeline.previewRequest(withTimeline(timelineWith(WORKING_TIMELINE, { stage: "done" })), 1), null);
  [0, -1, 1.234, 1001, null, "1", NaN].forEach(function (hours) {
    assert.strictEqual(projectTimeline.previewRequest(WORKING_LUIGI, hours), null, String(hours));
  });
});

test("switching a request to charge and back to free", function () {
  const free = added(WORKING_LUIGI, { text: "Darker background", hours: 1, decision: "free" });
  const charged = unchanged(free, function (p) { return projectTimeline.setRequestDecision(p, "r1", "charge"); });
  assert.strictEqual(charged.ok, true);
  assert.strictEqual(charged.project.timeline.requests[0].chargeCents, 2500);
  assert.strictEqual(charged.project.timeline.requests[0].decision, "charge");
  assert.strictEqual(charged.project.timeline.requests[0].at, REQUEST_AT.toISOString());
  assert.strictEqual(projectTimeline.rateNowCents(charged.project), 2500);
  assert.strictEqual(projectTimeline.requestSteps(charged.project)[0].rateCents, 2500);
  assert.deepStrictEqual(projectTimeline.cleanTimeline(charged.project.timeline), charged.project.timeline);
  const back = projectTimeline.setRequestDecision(deepFreeze(charged.project), "r1", "free");
  assert.strictEqual(back.ok, true);
  assert.strictEqual(back.project.timeline.requests[0].chargeCents, 0);
  assert.deepStrictEqual(back.project.timeline, free.timeline);
});

test("switching uses the request's own rate, not today's target", function () {
  // Saved at a $30 target: 1.5 hrs is $45, even though the timeline's target is $25.
  const request = Object.assign({}, FREE_REQUEST, { hours: 1.5, rateCents: 3000 });
  const project = withTimeline(timelineWith(WORKING_TIMELINE, { requests: [request] }));
  const result = projectTimeline.setRequestDecision(project, "r1", "charge");
  assert.strictEqual(result.project.timeline.requests[0].chargeCents, 4500);
});

test("steps follow saved order, each compared to the one before", function () {
  let project = added(WORKING_LUIGI, { text: "Darker background", hours: 1, decision: "free" }, REQUEST_AT, "r1");
  project = added(project, { text: "One more round", hours: 1.5, decision: "charge" }, REQUEST_AT, "r2");
  const steps = projectTimeline.requestSteps(project);
  assert.deepStrictEqual(steps.map(function (step) { return [step.request.id, step.rateCents, step.deltaCents]; }),
    [["r1", 2273, -227], ["r2", 2320, 47]]);
  assert.strictEqual(steps[1].rateCents, projectTimeline.rateNowCents(project));
});

test("steps: none for no requests, kept when Paid, null when Quoted or broken", function () {
  assert.deepStrictEqual(projectTimeline.requestSteps(WORKING_LUIGI), []);
  const paid = withTimeline(timelineWith(PAID_TIMELINE, { requests: [FREE_REQUEST] }));
  assert.deepStrictEqual(projectTimeline.requestSteps(paid).map(function (step) { return step.rateCents; }), [2273]);
  assert.strictEqual(projectTimeline.requestSteps(LUIGI), null);
  assert.strictEqual(projectTimeline.requestSteps(withTimeline(timelineWith(WORKING_TIMELINE, { stage: "done" }))), null);
});

test("addRequest refusals", function () {
  const ok = { text: "Darker background", hours: 1, decision: "free" };
  function reason(project, values, now) {
    const result = projectTimeline.addRequest(project, values, now === undefined ? REQUEST_AT : now, "r1");
    assert.strictEqual(result.ok, false);
    assert.strictEqual("project" in result, false);
    return result.reason;
  }
  assert.strictEqual(reason(withTimeline(timelineWith(WORKING_TIMELINE, { stage: "done" })), ok), "bad-timeline");
  assert.strictEqual(reason(LUIGI, ok), "not-working");
  assert.strictEqual(reason(withTimeline(PAID_TIMELINE), ok), "not-working");
  // Text: 1 to 120 characters after trimming.
  [undefined, "", "   ", 5, "x".repeat(121)].forEach(function (text) {
    assert.strictEqual(reason(WORKING_LUIGI, Object.assign({}, ok, { text: text })), "bad-text", JSON.stringify(text));
  });
  assert.strictEqual(added(WORKING_LUIGI, Object.assign({}, ok, { text: "x".repeat(120) })).timeline.requests[0].text.length, 120);
  assert.strictEqual(added(WORKING_LUIGI, Object.assign({}, ok, { text: "  " + "x".repeat(120) + "  " })).timeline.requests[0].text.length, 120);
  [0, -1, 1.234, 1001, "1", null, NaN].forEach(function (hours) {
    assert.strictEqual(reason(WORKING_LUIGI, Object.assign({}, ok, { hours: hours })), "bad-hours", String(hours));
  });
  ["", "Free", "paid", null].forEach(function (decision) {
    assert.strictEqual(reason(WORKING_LUIGI, Object.assign({}, ok, { decision: decision })), "bad-decision", String(decision));
  });
  assert.strictEqual(reason(WORKING_LUIGI, null), "bad-text");
  // The date: a real date, not before Working. The same moment is OK.
  assert.strictEqual(reason(WORKING_LUIGI, ok, new Date(WORKING_AT.getTime() - 1)), "bad-date");
  assert.strictEqual(reason(WORKING_LUIGI, ok, new Date("nope")), "bad-date");
  assert.strictEqual(reason(WORKING_LUIGI, ok, "2026-10-20T12:00:00.000Z"), "bad-date");
  assert.strictEqual(reason(WORKING_LUIGI, ok, null), "bad-date");
  assert.strictEqual(added(WORKING_LUIGI, ok, new Date(WORKING_AT)).timeline.requests[0].at, WORKING_AT.toISOString());
});

test("addRequest refuses more than $100,000 or 1000 hours in all, and allows the edges", function () {
  // $99,990 agreed: a $10 charge reaches $100,000 exactly, $15 goes over.
  const rich = withTimeline(timelineWith(WORKING_TIMELINE, { agreedCents: 9999000 }));
  assert.strictEqual(added(rich, { text: "Tweak", hours: 0.4, decision: "charge" }).timeline.requests[0].chargeCents, 1000);
  assert.strictEqual(projectTimeline.addRequest(rich, { text: "Tweak", hours: 0.5, decision: "charge" }, REQUEST_AT, "r1").reason, "too-much-money");
  // Free adds no money, so it's fine.
  assert.strictEqual(projectTimeline.addRequest(rich, { text: "Tweak", hours: 0.5, decision: "free" }, REQUEST_AT, "r1").ok, true);
  // 999 planned hours: 1 more reaches 1000 exactly, 1.5 goes over.
  const long = withTimeline(timelineWith(WORKING_TIMELINE, { plannedHours: 999 }));
  assert.strictEqual(added(long, { text: "More", hours: 1, decision: "free" }).timeline.requests.length, 1);
  assert.strictEqual(projectTimeline.addRequest(long, { text: "More", hours: 1.5, decision: "free" }, REQUEST_AT, "r1").reason, "too-many-hours");
});

test("setRequestDecision refusals", function () {
  const free = added(WORKING_LUIGI, { text: "Darker background", hours: 1, decision: "free" });
  assert.deepStrictEqual(projectTimeline.setRequestDecision(withTimeline(timelineWith(WORKING_TIMELINE, { stage: "done" })), "r1", "charge"), { ok: false, reason: "bad-timeline" });
  assert.deepStrictEqual(projectTimeline.setRequestDecision(LUIGI, "r1", "charge"), { ok: false, reason: "not-working" });
  const paid = withTimeline(timelineWith(PAID_TIMELINE, { requests: [FREE_REQUEST] }));
  assert.deepStrictEqual(projectTimeline.setRequestDecision(paid, "r1", "charge"), { ok: false, reason: "not-working" });
  assert.deepStrictEqual(projectTimeline.setRequestDecision(free, "nope", "charge"), { ok: false, reason: "no-request" });
  assert.deepStrictEqual(projectTimeline.setRequestDecision(free, "r1", "paid"), { ok: false, reason: "bad-decision" });
  // $99,990 agreed with a free 1 hr request: charging it ($25) would go over $100,000.
  const rich = added(withTimeline(timelineWith(WORKING_TIMELINE, { agreedCents: 9999000 })), { text: "Tweak", hours: 1, decision: "free" });
  assert.deepStrictEqual(projectTimeline.setRequestDecision(rich, "r1", "charge"), { ok: false, reason: "too-much-money" });
});

test("removeRequest takes one off, and refuses when it can't", function () {
  let project = added(WORKING_LUIGI, { text: "Darker background", hours: 1, decision: "free" }, REQUEST_AT, "r1");
  project = added(project, { text: "One more round", hours: 1.5, decision: "charge" }, REQUEST_AT, "r2");
  const result = unchanged(project, function (p) { return projectTimeline.removeRequest(p, "r1"); });
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(result.project.timeline.requests.map(function (request) { return request.id; }), ["r2"]);
  assert.deepStrictEqual(projectTimeline.cleanTimeline(result.project.timeline), result.project.timeline);
  assert.deepStrictEqual(projectTimeline.removeRequest(project, "nope"), { ok: false, reason: "no-request" });
  assert.deepStrictEqual(projectTimeline.removeRequest(LUIGI, "r1"), { ok: false, reason: "not-working" });
  const paid = withTimeline(timelineWith(PAID_TIMELINE, { requests: [FREE_REQUEST] }));
  assert.deepStrictEqual(projectTimeline.removeRequest(paid, "r1"), { ok: false, reason: "not-working" });
  assert.deepStrictEqual(projectTimeline.removeRequest(withTimeline(timelineWith(WORKING_TIMELINE, { stage: "done" })), "r1"), { ok: false, reason: "bad-timeline" });
});

test("after removing the only request, moving back to Quoted works again", function () {
  const project = added(WORKING_LUIGI, { text: "Darker background", hours: 1, decision: "free" });
  assert.deepStrictEqual(projectTimeline.moveBack(project), { ok: false, reason: "has-requests" });
  const removed = deepFreeze(projectTimeline.removeRequest(project, "r1").project);
  assert.deepStrictEqual(removed.timeline, WORKING_TIMELINE);
  const back = projectTimeline.moveBack(removed);
  assert.strictEqual(back.ok, true);
  assert.strictEqual("timeline" in back.project, false);
});

test("Mark as paid starts with the requests counted", function () {
  let project = added(WORKING_LUIGI, { text: "Darker background", hours: 1, decision: "free" }, REQUEST_AT, "r1");
  project = added(project, { text: "One more round", hours: 1.5, decision: "charge" }, REQUEST_AT, "r2");
  assert.deepStrictEqual(projectTimeline.paidDefaults(project), { receivedCents: 31000, actualHours: 12.5 });
});

test("request functions never change frozen inputs or share objects with them", function () {
  const project = withTimeline(timelineWith(WORKING_TIMELINE, { requests: [FREE_REQUEST, CHARGED_REQUEST] }));
  const now = deepFreeze(new Date(PAID_AT));
  const values = deepFreeze({ text: "More", hours: 1, decision: "charge" });
  const before = JSON.stringify(project);
  projectTimeline.previewRequest(project, 1);
  projectTimeline.requestSteps(project);
  const results = [
    projectTimeline.addRequest(project, values, now, "r3"),
    projectTimeline.setRequestDecision(project, "r1", "charge"),
    projectTimeline.removeRequest(project, "r1"),
  ];
  assert.strictEqual(JSON.stringify(project), before);
  assert.strictEqual(JSON.stringify(values), JSON.stringify({ text: "More", hours: 1, decision: "charge" }));
  assert.strictEqual(now.getTime(), PAID_AT.getTime());
  results.forEach(function (result) {
    assert.strictEqual(result.ok, true);
    assert.notStrictEqual(result.project.timeline, project.timeline);
    assert.notStrictEqual(result.project.timeline.requests, project.timeline.requests);
    result.project.timeline.requests.forEach(function (request) {
      project.timeline.requests.forEach(function (original) { assert.notStrictEqual(request, original); });
    });
    assert.deepStrictEqual(projectTimeline.cleanTimeline(result.project.timeline), result.project.timeline);
  });
});

group("No function changes its input");

test("frozen inputs come through every function unchanged", function () {
  const working = withTimeline(timelineWith(WORKING_TIMELINE, { requests: [FREE_REQUEST] }));
  const paid = withTimeline(PAID_TIMELINE);
  const values = deepFreeze({ agreedCents: 27000, plannedHours: 10, expensesCents: 2000, targetCents: 2500 });
  const now = deepFreeze(new Date(PAID_AT));
  [LUIGI, working, paid].forEach(function (project) {
    const before = JSON.stringify(project);
    projectTimeline.timelineOf(project);
    projectTimeline.cleanTimeline(project.timeline);
    projectTimeline.markWorking(project, values, now);
    projectTimeline.markPaid(project, RECEIVED, now);
    projectTimeline.moveBack(project, now);
    projectTimeline.rateNowCents(project);
    assert.strictEqual(JSON.stringify(project), before);
  });
  assert.strictEqual(now.getTime(), PAID_AT.getTime());
});

test("results never share objects with the input", function () {
  const paid = withTimeline(timelineWith(PAID_TIMELINE, { requests: [FREE_REQUEST] }));
  const back = projectTimeline.moveBack(paid).project;
  assert.notStrictEqual(back.timeline, paid.timeline);
  assert.notStrictEqual(back.timeline.requests, paid.timeline.requests);
  assert.notStrictEqual(back.timeline.requests[0], paid.timeline.requests[0]);
  // Changing the result leaves the input alone (it's frozen, so it would throw if shared).
  back.timeline.requests[0].text = "changed";
  assert.strictEqual(paid.timeline.requests[0].text, FREE_REQUEST.text);
});

group("Helpers for the stage screens");

test("planned rate: (agreed - expenses) / planned hours, in cents", function () {
  assert.strictEqual(projectTimeline.plannedRateCents(withTimeline(WORKING_TIMELINE)), 2500);
  // Paid keeps the planned rate from the Working snapshot.
  assert.strictEqual(projectTimeline.plannedRateCents(withTimeline(PAID_TIMELINE)), 2500);
  // Requests don't change the plan.
  assert.strictEqual(projectTimeline.plannedRateCents(withTimeline(timelineWith(WORKING_TIMELINE, { requests: [CHARGED_REQUEST] }))), 2500);
  // $100 agreed, $20 expenses, 3 hrs: $26.666... rounds to $26.67.
  assert.strictEqual(projectTimeline.plannedRateCents(withTimeline(timelineWith(WORKING_TIMELINE, { agreedCents: 10000, plannedHours: 3 }))), 2667);
  // Below expenses: negative.
  assert.strictEqual(projectTimeline.plannedRateCents(withTimeline(timelineWith(WORKING_TIMELINE, { agreedCents: 1000 }))), -100);
});

test("planned rate is null when Quoted or broken", function () {
  assert.strictEqual(projectTimeline.plannedRateCents(LUIGI), null);
  assert.strictEqual(projectTimeline.plannedRateCents(withTimeline(timelineWith(WORKING_TIMELINE, { stage: "done" }))), null);
});

test("rate after expenses for any money and hours", function () {
  assert.strictEqual(projectTimeline.rateAfterCents(27000, 2000, 10), 2500);
  // Mark as paid with $310 and 13 hrs: $22.31.
  assert.strictEqual(projectTimeline.rateAfterCents(31000, 2000, 13), 2231);
  assert.strictEqual(projectTimeline.rateAfterCents(0, 2000, 10), -200);
  assert.strictEqual(projectTimeline.rateAfterCents(1500, 2000, 10), -50);
  assert.strictEqual(projectTimeline.rateAfterCents(null, 2000, 10), null);
  assert.strictEqual(projectTimeline.rateAfterCents(27000, 2000, 0), null);
  assert.strictEqual(projectTimeline.rateAfterCents(27000, 2000, 1001), null);
  assert.strictEqual(projectTimeline.rateAfterCents(27000.5, 2000, 10), null);
});

test("paid defaults: agreed plus charged requests, planned plus request hours", function () {
  assert.deepStrictEqual(projectTimeline.paidDefaults(withTimeline(WORKING_TIMELINE)), { receivedCents: 27000, actualHours: 10 });
  assert.deepStrictEqual(
    projectTimeline.paidDefaults(withTimeline(timelineWith(WORKING_TIMELINE, { requests: [FREE_REQUEST, CHARGED_REQUEST] }))),
    { receivedCents: 32000, actualHours: 13 });
  // Hours are rounded to 2 decimals, so float sums don't leak.
  const tenths = timelineWith(WORKING_TIMELINE, { plannedHours: 0.1, requests: [timelineWith(FREE_REQUEST, { hours: 0.2 })] });
  assert.strictEqual(projectTimeline.paidDefaults(withTimeline(tenths)).actualHours, 0.3);
  assert.strictEqual(projectTimeline.paidDefaults(LUIGI), null);
  assert.strictEqual(projectTimeline.paidDefaults(withTimeline(PAID_TIMELINE)), null);
});

test("typed hours: above 0, at most 1000, up to 2 decimals", function () {
  assert.strictEqual(projectTimeline.hoursFromText("13"), 13);
  assert.strictEqual(projectTimeline.hoursFromText(" 13.5 "), 13.5);
  assert.strictEqual(projectTimeline.hoursFromText("0.25"), 0.25);
  assert.strictEqual(projectTimeline.hoursFromText(".75"), 0.75);
  assert.strictEqual(projectTimeline.hoursFromText("1000"), 1000);
  ["", " ", "0", "0.00", "-1", "1000.01", "1001", "1.234", "abc", "1,000", "13 hrs", "1e2", "13.", null, 13].forEach(function (text) {
    assert.strictEqual(projectTimeline.hoursFromText(text), null, JSON.stringify(text));
  });
});

test("round hours to 2 decimals", function () {
  assert.strictEqual(projectTimeline.roundHours(0.1 * 3), 0.3);
  assert.strictEqual(projectTimeline.roundHours(11.5), 11.5);
  assert.strictEqual(projectTimeline.roundHours(6.0000000001), 6);
});

test("bar scale: largest of values and target, times 1.2, up to the next $5", function () {
  // Planned $25 and target $25: $30.
  assert.strictEqual(projectTimeline.barScaleCents([2500], 2500), 3000);
  // Planned $25, real $22.31, target $25: still $30.
  assert.strictEqual(projectTimeline.barScaleCents([2500, 2231], 2500), 3000);
  // A value above the target sets it: $40 x 1.2 = $48, up to $50.
  assert.strictEqual(projectTimeline.barScaleCents([4000], 2500), 5000);
  // The target above every value sets it: $60 x 1.2 = $72, up to $75.
  assert.strictEqual(projectTimeline.barScaleCents([1000], 6000), 7500);
  // Exactly on a $5 step stays there: $50 x 1.2 = $60.
  assert.strictEqual(projectTimeline.barScaleCents([5000], 2500), 6000);
  // Cents: $17.39 x 1.2 = $20.868, up to $25.
  assert.strictEqual(projectTimeline.barScaleCents([1739], 1000), 2500);
  // Negative values and nulls are ignored; never below $5.
  assert.strictEqual(projectTimeline.barScaleCents([-200, null], 0), 500);
  assert.strictEqual(projectTimeline.barScaleCents([], 0), 500);
  assert.strictEqual(projectTimeline.barScaleCents([-200], 2500), 3000);
});

test("bar share: 0 to 1, negative fills nothing", function () {
  assert.strictEqual(projectTimeline.barShare(2500, 3000), 2500 / 3000);
  assert.strictEqual(projectTimeline.barShare(3000, 3000), 1);
  assert.strictEqual(projectTimeline.barShare(4000, 3000), 1);
  assert.strictEqual(projectTimeline.barShare(0, 3000), 0);
  assert.strictEqual(projectTimeline.barShare(-200, 3000), 0);
  assert.strictEqual(projectTimeline.barShare(null, 3000), 0);
  assert.strictEqual(projectTimeline.barShare(2500, 0), 0);
});

console.log("\n" + passed + " passed, " + failed + " failed");
if (failed) process.exitCode = 1;
