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

function sample() {
  return [
    store.createProject("Luigi's menu", "menu", "a", MON),
    store.createProject("Bakery logo", "logo", "b", TUE),
  ];
}

group("Creating");

test("a new project starts with its job's example numbers", function () {
  const project = store.createProject("  Luigi's menu  ", "logo", "a", MON);
  assert.strictEqual(project.name, "Luigi's menu");
  assert.strictEqual(project.job, "logo");
  assert.strictEqual(project.inputs.count, "3");
  assert.strictEqual(project.inputs.itemHours, "1.5");
  assert.strictEqual(project.inputs.rate, "25");
  assert.strictEqual(project.inputs.offerStatus, "amount");
  assert.strictEqual(project.inputs.offer, "200");
  assert.strictEqual(project.quote, "");
  assert.strictEqual(project.replyEdited, false);
  assert.strictEqual(project.screen, "inputs");
  assert.strictEqual(project.created, MON.toISOString());
  assert.strictEqual(project.edited, MON.toISOString());
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

test("keeps the quote, the reply, the edited flag, and the last screen", function () {
  const storage = fakeStorage();
  const list = store.updateProject(sample(), "a",
    { quote: "280", reply: "Hi Luigi!", replyEdited: true, screen: "results" }, TUE, true);
  store.saveProjects(storage, list);
  const project = store.findProject(store.loadProjects(storage).projects, "a");
  assert.strictEqual(project.quote, "280");
  assert.strictEqual(project.reply, "Hi Luigi!");
  assert.strictEqual(project.replyEdited, true);
  assert.strictEqual(project.screen, "results");
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
  const kept = store.updateProject(sample(), "a", { screen: "results" }, TUE, false);
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
  const list = [store.createProject("z".repeat(60), "menu", "a", MON)];
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
  const good = store.createProject("Good", "menu", "good", MON);
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
  const raw = store.createProject("Old", "menu", "old", MON);
  delete raw.quote;
  delete raw.reply;
  delete raw.replyEdited;
  raw.screen = "somewhere";
  const project = store.parseProjects(JSON.stringify([raw]))[0];
  assert.strictEqual(project.quote, "");
  assert.strictEqual(project.reply, "");
  assert.strictEqual(project.replyEdited, false);
  assert.strictEqual(project.screen, "inputs");
});

test("numbers saved as numbers are read as text", function () {
  const raw = store.createProject("Old", "menu", "old", MON);
  raw.inputs.rate = 30;
  assert.strictEqual(store.parseProjects(JSON.stringify([raw]))[0].inputs.rate, "30");
});

test("a repeated id keeps only the first", function () {
  const a = store.createProject("First", "menu", "same", MON);
  const b = store.createProject("Second", "logo", "same", TUE);
  const list = store.parseProjects(JSON.stringify([a, b]));
  assert.deepStrictEqual(list.map(function (p) { return p.name; }), ["First"]);
});

test("loading broken saved text from storage doesn't throw", function () {
  const storage = fakeStorage();
  storage.data[store.STORAGE_KEY] = "[{\"id\":";
  assert.deepStrictEqual(store.loadProjects(storage), { ok: true, projects: [] });
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

console.log("\n" + passed + " passed, " + failed + " failed");
if (failed > 0) process.exitCode = 1;
