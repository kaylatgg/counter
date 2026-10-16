// Counter project tests. Run with: node projects.test.js
// Uses only Node's built-in assert, so nothing needs installing.

const assert = require("assert");
const store = require("./projects.js");

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

// A stand-in for localStorage. `broken` makes every call throw, like blocked
// storage; `full` makes saving throw, like a full quota.
function fakeStorage(options) {
  const data = {};
  options = options || {};
  return {
    data: data,
    getItem: function (key) {
      if (options.broken) throw new Error("blocked");
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem: function (key, value) {
      if (options.broken || options.full) throw new Error("QuotaExceededError");
      data[key] = String(value);
    },
  };
}

const MON = new Date(2026, 9, 12, 15, 42);   // Mon Oct 12, 2026, 3:42 PM
const TUE = new Date(2026, 9, 13, 9, 5);

// A project saved from a job's fresh example.
function make(name, job, id, date) {
  return store.createProject(name, store.exampleDraft(job), id, date);
}

function sample() {
  return [
    make("Luigi's menu", "menu", "a", MON),
    make("Bakery logo", "logo", "b", TUE),
  ];
}

group("Fresh calculations and saving one as a project");

test("a fresh calculation has the job's example numbers and its field", function () {
  const draft = store.exampleDraft("logo");
  assert.strictEqual(draft.field, "graphic");
  assert.strictEqual(draft.job, "logo");
  assert.strictEqual(draft.inputs.count, "3");
  assert.strictEqual(draft.inputs.itemHours, "2");
  assert.strictEqual(store.exampleDraft("event").field, "photography");
  assert.strictEqual(store.exampleDraft("custom", "illustration").field, "illustration");
  assert.strictEqual(draft.inputs.rate, "25");
  assert.strictEqual(draft.inputs.offerStatus, "amount");
  assert.strictEqual(draft.inputs.offer, "200");
  assert.strictEqual(draft.quote, "");
  assert.strictEqual(draft.replyEdited, false);
  assert.strictEqual(draft.gapChoice, "estimate");
});

test("saving keeps everything from the calculation, with a trimmed name and dates", function () {
  const draft = store.exampleDraft("menu");
  draft.inputs.rounds = "3";
  draft.quote = "300";
  draft.reply = "Hi!";
  draft.replyEdited = true;
  draft.gapChoice = "trade";
  const project = store.createProject("  Luigi's menu  ", draft, "a", MON);
  assert.strictEqual(project.gapChoice, "trade");
  assert.strictEqual(project.name, "Luigi's menu");
  assert.strictEqual(project.job, "menu");
  assert.strictEqual(project.inputs.rounds, "3");
  assert.strictEqual(project.quote, "300");
  assert.strictEqual(project.reply, "Hi!");
  assert.strictEqual(project.replyEdited, true);
  assert.strictEqual(project.created, MON.toISOString());
  assert.strictEqual(project.edited, MON.toISOString());
});

test("the project gets its own copy of the inputs", function () {
  const draft = store.exampleDraft("menu");
  const project = store.createProject("Menu", draft, "a", MON);
  draft.inputs.rate = "99";
  assert.strictEqual(project.inputs.rate, "25");
});

test("the suggested name is the job and today's date", function () {
  assert.strictEqual(store.defaultProjectName("menu", new Date(2026, 9, 11)), "Menu, Oct 11");
  assert.strictEqual(store.defaultProjectName("session", new Date(2026, 9, 11)), "Portrait session, Oct 11");
  assert.strictEqual(store.defaultProjectName("poster", new Date(2026, 0, 3)), "Poster or flyer, Jan 3");
});

test("an untouched calculation has nothing to lose; any change counts", function () {
  assert.strictEqual(store.isUntouched(store.exampleDraft("logo")), true);
  const changed = store.exampleDraft("logo");
  changed.inputs.offer = "250";
  assert.strictEqual(store.isUntouched(changed), false);
  const quoted = store.exampleDraft("logo");
  quoted.quote = "300";
  assert.strictEqual(store.isUntouched(quoted), false);
  const edited = store.exampleDraft("logo");
  edited.replyEdited = true;
  assert.strictEqual(store.isUntouched(edited), false);
  const picked = store.exampleDraft("logo");
  picked.gapChoice = "offer";
  assert.strictEqual(store.isUntouched(picked), false);
  // A different job's example, still unchanged, is untouched too.
  assert.strictEqual(store.isUntouched(store.exampleDraft("custom")), true);
});

test("names are required and 60 characters at most", function () {
  assert.strictEqual(store.validateName(""), "Enter a project name.");
  assert.strictEqual(store.validateName("   "), "Enter a project name.");
  assert.strictEqual(store.validateName("x".repeat(60)), null);
  assert.ok(store.validateName("x".repeat(61)));
});

group("Saving and loading");

test("saves under one key and loads the same projects back", function () {
  const storage = fakeStorage();
  const list = sample();
  assert.deepStrictEqual(store.saveProjects(storage, list), { ok: true });
  assert.deepStrictEqual(Object.keys(storage.data), [store.STORAGE_KEY]);
  const loaded = store.loadProjects(storage);
  assert.strictEqual(loaded.ok, true);
  assert.deepStrictEqual(loaded.projects, list);
});

test("keeps the quote, the reply, and the edited flag", function () {
  const storage = fakeStorage();
  const list = store.updateProject(sample(), "a",
    { quote: "280", reply: "Hi Luigi!", replyEdited: true }, TUE, true);
  store.saveProjects(storage, list);
  const project = store.findProject(store.loadProjects(storage).projects, "a");
  assert.strictEqual(project.quote, "280");
  assert.strictEqual(project.reply, "Hi Luigi!");
  assert.strictEqual(project.replyEdited, true);
});

test("nothing saved yet gives an empty list", function () {
  assert.deepStrictEqual(store.loadProjects(fakeStorage()), { ok: true, projects: [] });
});

test("blocked storage loads an empty list and says so", function () {
  assert.deepStrictEqual(store.loadProjects(fakeStorage({ broken: true })), { ok: false, projects: [] });
});

test("full storage says it couldn't save, without throwing", function () {
  assert.deepStrictEqual(store.saveProjects(fakeStorage({ full: true }), sample()), { ok: false });
});

test("lists newest edit first", function () {
  const sorted = store.sortByEdited(sample());
  assert.deepStrictEqual(sorted.map(function (p) { return p.id; }), ["b", "a"]);
});

test("an update moves the edited date only when asked", function () {
  const moved = store.updateProject(sample(), "a", { quote: "300" }, TUE, true);
  assert.strictEqual(store.findProject(moved, "a").edited, TUE.toISOString());
  const kept = store.updateProject(sample(), "a", { quote: "300" }, TUE, false);
  assert.strictEqual(store.findProject(kept, "a").edited, MON.toISOString());
});

group("Renaming");

test("renames and moves the edited date", function () {
  const list = store.renameProject(sample(), "a", " Luigi's dinner menu ", TUE);
  const project = store.findProject(list, "a");
  assert.strictEqual(project.name, "Luigi's dinner menu");
  assert.strictEqual(project.edited, TUE.toISOString());
});

test("a blank name keeps the old name", function () {
  const list = sample();
  assert.strictEqual(store.renameProject(list, "a", "   ", TUE), list);
  assert.strictEqual(store.findProject(list, "a").name, "Luigi's menu");
});

test("long names are cut to 60 characters", function () {
  const list = store.renameProject(sample(), "a", "y".repeat(80), TUE);
  assert.strictEqual(store.findProject(list, "a").name.length, 60);
});

group("Duplicating");

test("adds \"[name] copy\" with a new id and its own dates", function () {
  const list = store.duplicateProject(sample(), "a", "c", TUE);
  assert.strictEqual(list.length, 3);
  const copy = store.findProject(list, "c");
  assert.strictEqual(copy.name, "Luigi's menu copy");
  assert.strictEqual(copy.job, "menu");
  assert.deepStrictEqual(copy.inputs, store.findProject(list, "a").inputs);
  assert.strictEqual(copy.created, TUE.toISOString());
});

test("the copy is separate: changing it leaves the original alone", function () {
  let list = store.duplicateProject(sample(), "a", "c", TUE);
  list[2].inputs.rate = "40";
  assert.strictEqual(store.findProject(list, "a").inputs.rate, "25");
});

test("a copy of a 60-character name is shortened to fit", function () {
  const list = [make("z".repeat(60), "menu", "a", MON)];
  const copy = store.findProject(store.duplicateProject(list, "a", "c", TUE), "c");
  assert.strictEqual(copy.name.length, 60);
  assert.ok(copy.name.endsWith(" copy"));
});

group("Deleting");

test("removes only that project", function () {
  const list = store.deleteProject(sample(), "a");
  assert.deepStrictEqual(list.map(function (p) { return p.id; }), ["b"]);
});

test("deleting an id that isn't there changes nothing", function () {
  assert.strictEqual(store.deleteProject(sample(), "zzz").length, 2);
});

group("Bad saved data");

test("text that isn't JSON gives an empty list", function () {
  assert.deepStrictEqual(store.parseProjects("{not json"), []);
});

test("JSON that isn't a list gives an empty list", function () {
  assert.deepStrictEqual(store.parseProjects('{"id":"a"}'), []);
  assert.deepStrictEqual(store.parseProjects("null"), []);
});

test("broken projects are skipped, good ones kept", function () {
  const good = make("Good", "menu", "good", MON);
  const noName = Object.assign({}, good, { id: "x1", name: "  " });
  const badJob = Object.assign({}, good, { id: "x2", job: "website" });
  const badDate = Object.assign({}, good, { id: "x3", edited: "someday" });
  const missingInput = JSON.parse(JSON.stringify(good));
  missingInput.id = "x4";
  delete missingInput.inputs.rate;
  const badOffer = JSON.parse(JSON.stringify(good));
  badOffer.id = "x5";
  badOffer.inputs.offerStatus = "maybe";
  const text = JSON.stringify([null, 42, "text", [], noName, badJob, badDate, missingInput, badOffer, good]);
  const list = store.parseProjects(text);
  assert.deepStrictEqual(list.map(function (p) { return p.id; }), ["good"]);
});

test("missing optional parts get their defaults", function () {
  const raw = make("Old", "menu", "old", MON);
  delete raw.quote;
  delete raw.reply;
  delete raw.replyEdited;
  delete raw.gapChoice;
  const project = store.parseProjects(JSON.stringify([raw]))[0];
  assert.strictEqual(project.quote, "");
  assert.strictEqual(project.reply, "");
  assert.strictEqual(project.replyEdited, false);
  assert.strictEqual(project.gapChoice, "estimate");
});

test("the picked way to close the gap is saved and read back; unknown values get the default", function () {
  const saved = store.createProject("Menu", Object.assign(store.exampleDraft("menu"), { gapChoice: "offer" }), "g", MON);
  assert.strictEqual(store.parseProjects(store.serializeProjects([saved]))[0].gapChoice, "offer");
  const none = Object.assign({}, saved, { gapChoice: "" });
  assert.strictEqual(store.parseProjects(store.serializeProjects([none]))[0].gapChoice, "");
  const odd = Object.assign({}, saved, { gapChoice: "banana" });
  assert.strictEqual(store.parseProjects(store.serializeProjects([odd]))[0].gapChoice, "estimate");
  // An older save with its own typed price keeps it: nothing picked.
  const typed = Object.assign({}, saved, { quote: "280" });
  delete typed.gapChoice;
  assert.strictEqual(store.parseProjects(store.serializeProjects([typed]))[0].gapChoice, "");
});

test("numbers saved as numbers are read as text", function () {
  const raw = make("Old", "menu", "old", MON);
  raw.inputs.rate = 30;
  assert.strictEqual(store.parseProjects(JSON.stringify([raw]))[0].inputs.rate, "30");
});

test("the field is saved, and older projects without one load as Graphic design", function () {
  const photo = store.createProject("Shoot", store.exampleDraft("custom", "photography"), "p", MON);
  assert.strictEqual(photo.field, "photography");
  const loaded = store.parseProjects(JSON.stringify([photo]))[0];
  assert.strictEqual(loaded.field, "photography");
  assert.strictEqual(loaded.job, "custom");

  const old = make("Old menu", "menu", "old", MON);
  delete old.field;
  assert.strictEqual(store.parseProjects(JSON.stringify([old]))[0].field, "graphic");
  const oldCustom = make("Old custom", "custom", "oc", MON);
  delete oldCustom.field;
  assert.strictEqual(store.parseProjects(JSON.stringify([oldCustom]))[0].field, "graphic");
});

test("a field that doesn't match the job is corrected from the job", function () {
  const raw = make("Event", "event", "e", MON);
  raw.field = "graphic";
  assert.strictEqual(store.parseProjects(JSON.stringify([raw]))[0].field, "photography");
  raw.field = "sculpture";
  assert.strictEqual(store.parseProjects(JSON.stringify([raw]))[0].field, "photography");
});

test("a repeated id keeps only the first", function () {
  const a = make("First", "menu", "same", MON);
  const b = make("Second", "logo", "same", TUE);
  const list = store.parseProjects(JSON.stringify([a, b]));
  assert.deepStrictEqual(list.map(function (p) { return p.name; }), ["First"]);
});

test("loading broken saved text from storage doesn't throw", function () {
  const storage = fakeStorage();
  storage.data[store.STORAGE_KEY] = "[{\"id\":";
  assert.deepStrictEqual(store.loadProjects(storage), { ok: true, projects: [] });
});

group("The unsaved draft");

test("saves under its own key and loads back", function () {
  const storage = fakeStorage();
  const draft = store.exampleDraft("social");
  draft.inputs.offer = "180";
  assert.deepStrictEqual(store.saveDraft(storage, draft), { ok: true });
  assert.deepStrictEqual(store.loadDraft(storage), { ok: true, draft: draft });
});

test("saving the draft never touches the projects", function () {
  const storage = fakeStorage();
  store.saveProjects(storage, sample());
  const before = storage.data[store.STORAGE_KEY];
  store.saveDraft(storage, store.exampleDraft("logo"));
  assert.strictEqual(storage.data[store.STORAGE_KEY], before);
  assert.notStrictEqual(store.DRAFT_KEY, store.STORAGE_KEY);
});

test("no draft, a broken draft, or blocked storage gives no draft", function () {
  assert.deepStrictEqual(store.loadDraft(fakeStorage()), { ok: true, draft: null });
  const storage = fakeStorage();
  storage.data[store.DRAFT_KEY] = "{oops";
  assert.deepStrictEqual(store.loadDraft(storage), { ok: true, draft: null });
  storage.data[store.DRAFT_KEY] = JSON.stringify({ job: "website", inputs: {} });
  assert.deepStrictEqual(store.loadDraft(storage), { ok: true, draft: null });
  assert.deepStrictEqual(store.loadDraft(fakeStorage({ broken: true })), { ok: false, draft: null });
  assert.deepStrictEqual(store.saveDraft(fakeStorage({ full: true }), store.exampleDraft("menu")), { ok: false });
});

group("Edited dates");

test("just now, today, yesterday, then the date", function () {
  const now = new Date(2026, 9, 12, 16, 0);
  assert.strictEqual(store.formatEdited(new Date(2026, 9, 12, 15, 59, 30).toISOString(), now), "just now");
  assert.strictEqual(store.formatEdited(new Date(2026, 9, 12, 15, 42).toISOString(), now), "today at 3:42 PM");
  assert.strictEqual(store.formatEdited(new Date(2026, 9, 12, 0, 5).toISOString(), now), "today at 12:05 AM");
  assert.strictEqual(store.formatEdited(new Date(2026, 9, 11, 22, 0).toISOString(), now), "yesterday");
  assert.strictEqual(store.formatEdited(new Date(2026, 9, 9, 10, 0).toISOString(), now), "Oct 9");
  assert.strictEqual(store.formatEdited(new Date(2025, 11, 30, 10, 0).toISOString(), now), "Dec 30, 2025");
});

group("Your pricing so far (the Projects dashboard)");

// A menu project with all its hours in setup, so the total is exact.
function priced(name, rate, hours, offer, expenses, day, extra) {
  const date = new Date(2026, 9, day, 12, 0);
  const inputs = { count: "0", setupHours: String(hours), itemHours: "0", communicationHours: "0",
    rounds: "0", roundHours: "0", deliveryHours: "0", rate: String(rate), expenses: String(expenses),
    offerStatus: "amount", offer: String(offer) };
  return Object.assign({ id: name, name: name, field: "graphic", job: "menu", inputs: inputs, quote: "",
    reply: "", replyEdited: false, gapChoice: "estimate", created: date.toISOString(), edited: date.toISOString() }, extra);
}

function exampleSet() {
  return [
    priced("Social posts, Oct 14", 55, 24, 500, 20, 14),
    priced("Portrait session, Oct 7", 30, 10, 150, 25, 7),
    priced("Menu, Oct 11", 25, 11.5, 200, 20, 11),
    priced("Editorial illustration, Oct 15", 25, 11, 200, 0, 15),
    priced("Logo, Oct 9", 25, 13, 400, 15, 9),
  ];
}

function names(jobs) {
  return jobs.map(function (job) { return job.name; });
}

test("the example set: totals, steps, unpaid hours, and the biggest fix", function () {
  const s = store.pricingSummary(exampleSet());
  assert.strictEqual(s.counted, 5);
  assert.strictEqual(s.targetPay, 2508);
  assert.strictEqual(s.kept, 1370);
  assert.strictEqual(s.shortfall, 1138);
  assert.strictEqual(Math.round(s.percent * 100), 55);
  assert.deepStrictEqual(s.steps.map(function (job) { return job.step; }), [-840, -175, -108, -75, 60]);
  assert.strictEqual(s.other, null);
  assert.strictEqual(s.unpaidHours.toFixed(1), "28.4");
  assert.strictEqual(s.hours, 69.5);
  assert.strictEqual(s.paidHours.toFixed(1), "41.1");
  assert.strictEqual(s.met, 1);
  assert.deepStrictEqual(names(s.jobs.filter(function (job) { return job.metTarget; })), ["Logo, Oct 9"]);
  assert.strictEqual(s.biggestFix.name, "Social posts, Oct 14");
  assert.strictEqual(s.biggestFix.step, -840);
  assert.strictEqual(Math.round(s.withFixPercent * 100), 88);
  assert.strictEqual(Math.round(s.gapShare * 100), 74);
  assert.strictEqual(new Date(s.firstCreated).getDate(), 7);
  assert.strictEqual(new Date(s.lastCreated).getDate(), 15);
});

test("each job's percent is after expenses, lowest first", function () {
  const s = store.pricingSummary(exampleSet());
  assert.deepStrictEqual(names(s.byPercent),
    ["Social posts, Oct 14", "Portrait session, Oct 7", "Menu, Oct 11", "Editorial illustration, Oct 15", "Logo, Oct 9"]);
  assert.deepStrictEqual(s.byPercent.map(function (job) { return Math.round(job.percent * 100); }), [36, 42, 63, 73, 118]);
  assert.strictEqual(s.byPercent[0].hourlyAfter, 20);
  assert.strictEqual(s.byPercent[0].unpaidHours.toFixed(1), "15.3");
});

test("projects without an offer, hours, or working numbers are left out", function () {
  const list = exampleSet().concat([
    priced("No offer", 25, 10, 200, 20, 1, {}),
    priced("No hours", 25, 0, 200, 20, 2),
    priced("Broken rate", 0, 10, 200, 20, 3),
    priced("Broken price", 25, 10, 300, 20, 4, { quote: "abc" }),
  ]);
  list[5].inputs.offerStatus = "none";
  const s = store.pricingSummary(list);
  assert.strictEqual(s.counted, 6);
  assert.strictEqual(s.total, 9);
  assert.ok(names(s.jobs).indexOf("Broken price") !== -1);
});

test("no counted projects gives nothing", function () {
  assert.strictEqual(store.pricingSummary([]), null);
  const none = priced("No offer", 25, 10, 200, 20, 1);
  none.inputs.offerStatus = "none";
  assert.strictEqual(store.pricingSummary([none]), null);
});

test("an offer below expenses keeps a negative amount", function () {
  const s = store.pricingSummary([priced("Low", 25, 10, 15, 20, 1)]);
  assert.strictEqual(s.kept, -5);
  assert.strictEqual(s.jobs[0].step, -255);
  assert.ok(s.jobs[0].percent < 0);
  assert.strictEqual(s.unpaidHours, 10);
  assert.strictEqual(s.biggestFix.name, "Low");
  // All of the gap came from it, so there's no share to show.
  assert.strictEqual(s.gapShare, null);
});

test("every job at its target: no shortfall and no biggest fix", function () {
  const s = store.pricingSummary([priced("A", 25, 10, 270, 20, 1), priced("B", 25, 4, 100, 0, 2)]);
  assert.strictEqual(s.shortfall, 0);
  assert.strictEqual(s.met, 2);
  assert.strictEqual(s.biggestFix, null);
  assert.strictEqual(s.withFixPercent, null);
  assert.strictEqual(s.gapShare, null);
  assert.strictEqual(s.unpaidHours, 0);
});

test("one project: all of the gap is its own", function () {
  const s = store.pricingSummary([priced("Menu, Oct 11", 25, 11.5, 200, 20, 11)]);
  assert.strictEqual(s.targetPay, 288);
  assert.strictEqual(s.kept, 180);
  assert.strictEqual(s.shortfall, 108);
  assert.strictEqual(s.biggestFix.step, -108);
  assert.strictEqual(s.gapShare, null);
  assert.strictEqual(Math.round(s.withFixPercent * 100), 100);
  assert.strictEqual(s.firstCreated, s.lastCreated);
});

test("gains larger than the shortfall: over 100%, still a biggest fix, no share", function () {
  const s = store.pricingSummary([priced("Short", 25, 10, 220, 20, 1), priced("Over", 25, 10, 520, 20, 2)]);
  assert.strictEqual(s.targetPay, 500);
  assert.strictEqual(s.kept, 700);
  assert.strictEqual(s.shortfall, -200);
  assert.strictEqual(s.percent, 1.4);
  assert.strictEqual(s.biggestFix.name, "Short");
  assert.strictEqual(s.gapShare, null);
  assert.strictEqual(s.withFixPercent, 1.5);
  assert.deepStrictEqual(s.steps.map(function (job) { return job.step; }), [-50, 250]);
});

test("ties keep the list's order; more than 6 jobs group the rest as Other jobs", function () {
  const tied = store.pricingSummary([priced("First", 25, 10, 220, 20, 1), priced("Second", 25, 10, 220, 20, 2)]);
  assert.strictEqual(tied.biggestFix.name, "First");
  assert.deepStrictEqual(names(tied.steps), ["First", "Second"]);
  assert.deepStrictEqual(names(tied.byPercent), ["First", "Second"]);
  // Steps of -100, -10, +200, -50, +5, -1, +30, -300.
  const offers = [170, 260, 470, 220, 275, 269, 300, -1];
  const list = offers.map(function (offer, i) { return priced("Job " + i, 25, 10, offer === -1 ? 0 : offer, offer === -1 ? 50 : 20, i + 1); });
  const s = store.pricingSummary(list);
  assert.deepStrictEqual(s.jobs.map(function (job) { return job.step; }), [-100, -10, 200, -50, 5, -1, 30, -300]);
  assert.deepStrictEqual(names(s.steps), ["Job 7", "Job 0", "Job 3", "Job 2", "Job 6"]);
  assert.deepStrictEqual(s.other, { count: 3, step: -6 });
});

console.log("\n" + passed + " passed, " + failed + " failed");
if (failed > 0) process.exitCode = 1;
