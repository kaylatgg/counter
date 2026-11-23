// Versioned saving tests. Run with: node store.test.js
// Uses only Node's built-in assert, so nothing needs installing.

const assert = require("assert");
const projectStorage = require("./store.js");

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

// A stand-in for localStorage, starting with `initial`. `broken` makes every
// call throw, like blocked storage; `full` makes saving throw, like a full quota.
// `writes` counts the saves.
function fakeStorage(initial, options) {
  const data = Object.assign({}, initial);
  options = options || {};
  const storage = {
    data: data,
    writes: 0,
    getItem: function (key) {
      if (options.broken) throw new Error("blocked");
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem: function (key, value) {
      if (options.broken || options.full) throw new Error("QuotaExceededError");
      storage.writes++;
      data[key] = String(value);
    },
  };
  return storage;
}

const NOW = new Date("2026-11-17T10:00:00.000Z");
const LATER = new Date("2026-11-18T10:00:00.000Z");

// Three projects as version 1 saved them, in different fields, with a typed
// price, an edited reply, and a picked way to close the gap.
const V1_PROJECTS = [
  {
    id: "3f0c2a9e-1b7d-4c55-9a43-0d2f8e6b1c11", name: "Luigi's menu", field: "graphic", job: "menu",
    inputs: { count: "2", rounds: "2", setupHours: "2", itemHours: "2", communicationHours: "1.5",
      roundHours: "1.5", deliveryHours: "1", rate: "25", expenses: "20", offerStatus: "amount", offer: "200" },
    quote: "", reply: "Hi! Thanks for reaching out. For a menu with 2 pages and 2 rounds of changes, my price is $310.",
    replyEdited: false, gapChoice: "estimate",
    created: "2026-10-11T15:42:00.000Z", edited: "2026-10-12T09:05:00.000Z",
  },
  {
    id: "8a1d6f40-77e2-4b0a-8f3c-5e9b2d7a4c22", name: "Bakery portrait commission", field: "illustration", job: "portrait",
    inputs: { count: "1", rounds: "1", setupHours: "1.5", itemHours: "5", communicationHours: "1",
      roundHours: "1", deliveryHours: "0.5", rate: "30", expenses: "35", offerStatus: "amount", offer: "250" },
    quote: "280", reply: "Hi Maya! For a portrait with 1 figure and 1 round of changes, my price is $280. Thanks!",
    replyEdited: true, gapChoice: "",
    created: "2026-10-20T18:00:00.000Z", edited: "2026-11-02T12:30:00.000Z",
  },
  {
    id: "c4e9b1a2-0d3f-4e8b-b6a7-9f1e2d3c4b33", name: "Open studio event", field: "photography", job: "event",
    inputs: { count: "60", rounds: "1", setupHours: "5", itemHours: "0.1", communicationHours: "1.5",
      roundHours: "1", deliveryHours: "1", rate: "40", expenses: "25", offerStatus: "none", offer: "" },
    quote: "", reply: "", replyEdited: false, gapChoice: "trade",
    created: "2026-11-05T08:15:00.000Z", edited: "2026-11-05T08:15:00.000Z",
  },
];

function v1Text() {
  return JSON.stringify(V1_PROJECTS);
}

function v2Text(projects, version) {
  return JSON.stringify({ version: version === undefined ? 3 : version, projects: projects });
}

function stored(storage, key) {
  const text = storage.getItem(key);
  return text === null ? null : JSON.parse(text);
}

group("Load cases");

test("STORE_VERSION is 3 (2 still loads), and the keys are counter.v2 and counter.v2.unreadable", function () {
  assert.strictEqual(projectStorage.STORE_VERSION, 3);
  assert.strictEqual(projectStorage.OLDEST_VERSION, 2);
  assert.strictEqual(projectStorage.STORE_KEY, "counter.v2");
  assert.strictEqual(projectStorage.UNREADABLE_KEY, "counter.v2.unreadable");
  assert.strictEqual(projectStorage.V1_KEY, "counter.projects");
});

test("a. version 3: its projects load, and nothing is written", function () {
  const storage = fakeStorage({ "counter.v2": v2Text(V1_PROJECTS) });
  const result = projectStorage.loadStore(storage, NOW);
  assert.deepStrictEqual(result, { ok: true, projects: V1_PROJECTS, unreadable: [], readOnly: false, source: "v2" });
  assert.strictEqual(storage.writes, 0);
});

test("a. version 3 wins over a version 1 list, which is ignored", function () {
  const storage = fakeStorage({ "counter.v2": v2Text([V1_PROJECTS[0]]), "counter.projects": v1Text() });
  const result = projectStorage.loadStore(storage, NOW);
  assert.strictEqual(result.source, "v2");
  assert.deepStrictEqual(result.projects, [V1_PROJECTS[0]]);
  assert.strictEqual(storage.data["counter.projects"], v1Text());
});

test("b. a newer version: its projects show, read only, and nothing is written", function () {
  const text = v2Text(V1_PROJECTS, 4);
  const storage = fakeStorage({ "counter.v2": text });
  const result = projectStorage.loadStore(storage, NOW);
  assert.deepStrictEqual(result, { ok: true, projects: V1_PROJECTS, unreadable: [], readOnly: true, source: "newer" });
  assert.strictEqual(storage.writes, 0);
  assert.strictEqual(storage.data["counter.v2"], text);
});

test("b. a newer version's broken items are reported but not written", function () {
  const text = v2Text([V1_PROJECTS[0], { id: "x", timeline: [] }], 4);
  const storage = fakeStorage({ "counter.v2": text });
  const result = projectStorage.loadStore(storage, NOW);
  assert.deepStrictEqual(result.projects, [V1_PROJECTS[0]]);
  assert.strictEqual(result.unreadable.length, 1);
  assert.strictEqual(storage.writes, 0);
});

test("c. unreadable counter.v2 text is kept, never overwritten at load, then version 1 upgrades", function () {
  ["{not json", "[1,2]", "\"text\"", JSON.stringify({ projects: [] }), JSON.stringify({ version: "2", projects: [] }),
    JSON.stringify({ version: 2, projects: "none" }), JSON.stringify({ version: 3, projects: "none" }),
    JSON.stringify({ version: 1, projects: [] }), JSON.stringify({ version: 2.5, projects: [] })].forEach(function (bad) {
    const storage = fakeStorage({ "counter.v2": bad, "counter.projects": v1Text() });
    const result = projectStorage.loadStore(storage, NOW);
    assert.strictEqual(result.source, "upgraded", bad);
    assert.deepStrictEqual(result.projects, V1_PROJECTS, bad);
    assert.strictEqual(result.unreadable.length, 1, bad);
    assert.strictEqual(result.unreadable[0].raw, bad, "the raw text is kept exactly: " + bad);
    assert.strictEqual(typeof result.unreadable[0].reason, "string");
    assert.strictEqual(result.unreadable[0].at, NOW.toISOString());
    assert.deepStrictEqual(stored(storage, "counter.v2.unreadable"), result.unreadable, bad);
    // Only now, with the old text kept, is counter.v2 replaced.
    assert.deepStrictEqual(stored(storage, "counter.v2"), { version: 3, projects: V1_PROJECTS }, bad);
    assert.strictEqual(storage.data["counter.projects"], v1Text(), bad);
  });
});

test("c. without version 1, unreadable text is kept and stays in counter.v2 until a save", function () {
  const storage = fakeStorage({ "counter.v2": "{not json" });
  const result = projectStorage.loadStore(storage, NOW);
  assert.strictEqual(result.source, "empty");
  assert.deepStrictEqual(result.projects, []);
  assert.deepStrictEqual(result.unreadable, [{ raw: "{not json", reason: "not valid JSON", at: NOW.toISOString() }]);
  assert.strictEqual(storage.data["counter.v2"], "{not json");
});

test("c. if the unreadable text can't be kept, counter.v2 is never replaced", function () {
  // The unreadable list itself is broken, so nothing can be added to it.
  const storage = fakeStorage({ "counter.v2": "{not json", "counter.v2.unreadable": "{also broken", "counter.projects": v1Text() });
  const result = projectStorage.loadStore(storage, NOW);
  assert.strictEqual(result.ok, false);
  assert.deepStrictEqual(result.projects, V1_PROJECTS);
  assert.strictEqual(storage.data["counter.v2"], "{not json");
  assert.strictEqual(storage.data["counter.v2.unreadable"], "{also broken");
  assert.deepStrictEqual(projectStorage.saveStore(storage, V1_PROJECTS, NOW), { ok: false });
  assert.strictEqual(storage.data["counter.v2"], "{not json");
});

test("d. only version 1: upgraded, written as version 3, and version 1 is left as it was", function () {
  const storage = fakeStorage({ "counter.projects": v1Text() });
  const result = projectStorage.loadStore(storage, NOW);
  assert.deepStrictEqual(result, { ok: true, projects: V1_PROJECTS, unreadable: [], readOnly: false, source: "upgraded" });
  assert.deepStrictEqual(stored(storage, "counter.v2"), { version: 3, projects: V1_PROJECTS });
  assert.strictEqual(storage.data["counter.projects"], v1Text());
});

test("d. an empty version 1 list upgrades to an empty version 3", function () {
  const storage = fakeStorage({ "counter.projects": "[]" });
  const result = projectStorage.loadStore(storage, NOW);
  assert.strictEqual(result.source, "upgraded");
  assert.deepStrictEqual(stored(storage, "counter.v2"), { version: 3, projects: [] });
  assert.strictEqual(storage.data["counter.projects"], "[]");
});

test("d. a version 1 list that isn't a list is kept as unreadable, and left as it was", function () {
  ["{not json", "{\"a\":1}"].forEach(function (bad) {
    const storage = fakeStorage({ "counter.projects": bad });
    const result = projectStorage.loadStore(storage, NOW);
    assert.strictEqual(result.source, "upgraded");
    assert.deepStrictEqual(result.projects, []);
    assert.strictEqual(result.unreadable[0].raw, bad);
    assert.strictEqual(storage.data["counter.projects"], bad);
  });
});

test("e. nothing saved: an empty list, and nothing is written", function () {
  const storage = fakeStorage();
  assert.deepStrictEqual(projectStorage.loadStore(storage, NOW),
    { ok: true, projects: [], unreadable: [], readOnly: false, source: "empty" });
  assert.strictEqual(storage.writes, 0);
});

group("Upgrading version 1");

test("3 version 1 projects upgrade with every field equal", function () {
  const storage = fakeStorage({ "counter.projects": v1Text() });
  const result = projectStorage.loadStore(storage, NOW);
  assert.strictEqual(result.projects.length, 3);
  result.projects.forEach(function (project, i) {
    assert.deepStrictEqual(project, V1_PROJECTS[i]);
    assert.deepStrictEqual(Object.keys(project).sort(), Object.keys(V1_PROJECTS[i]).sort());
  });
});

test("counter.projects is byte for byte unchanged after load and after saves", function () {
  const original = v1Text();
  const storage = fakeStorage({ "counter.projects": original });
  const loaded = projectStorage.loadStore(storage, NOW);
  assert.strictEqual(storage.data["counter.projects"], original);
  const edited = loaded.projects.slice(1).concat([Object.assign({}, loaded.projects[0], { name: "Renamed" })]);
  assert.deepStrictEqual(projectStorage.saveStore(storage, edited, LATER), { ok: true });
  assert.deepStrictEqual(projectStorage.saveStore(storage, [], LATER), { ok: true });
  assert.strictEqual(storage.data["counter.projects"], original);
  assert.deepStrictEqual(stored(storage, "counter.v2"), { version: 3, projects: [] });
});

test("after the upgrade, a later load reads counter.v2, not version 1", function () {
  const storage = fakeStorage({ "counter.projects": v1Text() });
  projectStorage.loadStore(storage, NOW);
  projectStorage.saveStore(storage, [V1_PROJECTS[2]], NOW);
  const again = projectStorage.loadStore(storage, LATER);
  assert.strictEqual(again.source, "v2");
  assert.deepStrictEqual(again.projects, [V1_PROJECTS[2]]);
});

test("older version 1 saves load the way they always did (no field means Graphic design)", function () {
  const old = Object.assign({}, V1_PROJECTS[0]);
  delete old.field;
  delete old.gapChoice;
  const storage = fakeStorage({ "counter.projects": JSON.stringify([old]) });
  const result = projectStorage.loadStore(storage, NOW);
  assert.strictEqual(result.projects[0].field, "graphic");
  assert.strictEqual(result.projects[0].gapChoice, "estimate");
  assert.strictEqual(storage.data["counter.projects"], JSON.stringify([old]));
});

group("Broken projects and repeated ids are kept, not dropped");

function brokenList() {
  return [
    V1_PROJECTS[0],
    { id: "no-job", name: "Mystery", inputs: {} },
    "just text",
    null,
    Object.assign({}, V1_PROJECTS[1], { name: "Same id as the first" , id: V1_PROJECTS[0].id }),
    V1_PROJECTS[2],
  ];
}

["counter.projects", "counter.v2"].forEach(function (key) {
  test("from " + key + ": the good ones load, the rest go to unreadable with a reason", function () {
    const initial = {};
    initial[key] = key === "counter.v2" ? v2Text(brokenList()) : JSON.stringify(brokenList());
    const storage = fakeStorage(initial);
    const result = projectStorage.loadStore(storage, NOW);
    assert.deepStrictEqual(result.projects, [V1_PROJECTS[0], V1_PROJECTS[2]]);
    assert.deepStrictEqual(result.unreadable.map(function (entry) { return entry.raw; }), brokenList().slice(1, 5));
    result.unreadable.forEach(function (entry) {
      assert.ok(typeof entry.reason === "string" && entry.reason.length > 0);
      assert.strictEqual(entry.at, NOW.toISOString());
    });
    assert.ok(/repeated id/.test(result.unreadable[3].reason));
    assert.deepStrictEqual(stored(storage, "counter.v2.unreadable"), result.unreadable);
  });
});

test("a save after loading broken items keeps them in unreadable, then leaves them out of counter.v2", function () {
  const storage = fakeStorage({ "counter.v2": v2Text(brokenList()) });
  const loaded = projectStorage.loadStore(storage, NOW);
  assert.deepStrictEqual(projectStorage.saveStore(storage, loaded.projects, LATER), { ok: true });
  assert.deepStrictEqual(stored(storage, "counter.v2"), { version: 3, projects: [V1_PROJECTS[0], V1_PROJECTS[2]] });
  assert.strictEqual(stored(storage, "counter.v2.unreadable").length, 4);
});

test("new unreadable items are added after the old ones, which stay", function () {
  const old = [{ raw: "older", reason: "not valid JSON", at: "2026-11-01T00:00:00.000Z" }];
  const storage = fakeStorage({ "counter.v2": v2Text(brokenList()), "counter.v2.unreadable": JSON.stringify(old) });
  const result = projectStorage.loadStore(storage, NOW);
  assert.deepStrictEqual(result.unreadable[0], old[0]);
  assert.strictEqual(result.unreadable.length, 5);
});

test("broken items in counter.v2 are never replaced if they can't be kept", function () {
  const text = v2Text(brokenList());
  const storage = fakeStorage({ "counter.v2": text, "counter.v2.unreadable": "{broken" });
  const loaded = projectStorage.loadStore(storage, NOW);
  assert.strictEqual(loaded.ok, false);
  assert.deepStrictEqual(projectStorage.saveStore(storage, loaded.projects, NOW), { ok: false });
  assert.strictEqual(storage.data["counter.v2"], text);
});

group("A newer version is never overwritten");

test("saveStore after a newer load refuses and writes nothing", function () {
  const text = v2Text(V1_PROJECTS, 4);
  const storage = fakeStorage({ "counter.v2": text });
  projectStorage.loadStore(storage, NOW);
  assert.deepStrictEqual(projectStorage.saveStore(storage, [], NOW), { ok: false, readOnly: true });
  assert.deepStrictEqual(projectStorage.saveStore(storage, V1_PROJECTS, LATER), { ok: false, readOnly: true });
  assert.strictEqual(storage.data["counter.v2"], text);
  assert.strictEqual(storage.writes, 0);
});

test("a newer version saved by another tab after this load is never overwritten", function () {
  const storage = fakeStorage({ "counter.v2": v2Text(V1_PROJECTS) });
  assert.strictEqual(projectStorage.loadStore(storage, NOW).readOnly, false);
  const newer = v2Text(V1_PROJECTS, 4);
  storage.data["counter.v2"] = newer;
  assert.deepStrictEqual(projectStorage.saveStore(storage, [], NOW), { ok: false, readOnly: true });
  assert.strictEqual(storage.data["counter.v2"], newer);
  // And it stays refused, even if the newer save goes away.
  storage.data["counter.v2"] = v2Text([]);
  assert.deepStrictEqual(projectStorage.saveStore(storage, [], NOW), { ok: false, readOnly: true });
});

test("a later load that finds version 3 again allows saving", function () {
  const storage = fakeStorage({ "counter.v2": v2Text(V1_PROJECTS, 4) });
  projectStorage.loadStore(storage, NOW);
  storage.data["counter.v2"] = v2Text(V1_PROJECTS);
  assert.strictEqual(projectStorage.loadStore(storage, NOW).readOnly, false);
  assert.deepStrictEqual(projectStorage.saveStore(storage, [], NOW), { ok: true });
});

group("Storage that fails");

test("storage that throws on getItem gives ok false, with no crash", function () {
  const storage = fakeStorage({ "counter.projects": v1Text() }, { broken: true });
  assert.deepStrictEqual(projectStorage.loadStore(storage, NOW),
    { ok: false, projects: [], unreadable: [], readOnly: false, source: "error" });
  assert.deepStrictEqual(projectStorage.saveStore(storage, V1_PROJECTS, NOW), { ok: false });
});

test("storage that throws on setItem: the upgrade still shows the projects, saving gives ok false", function () {
  const storage = fakeStorage({ "counter.projects": v1Text() }, { full: true });
  const result = projectStorage.loadStore(storage, NOW);
  assert.strictEqual(result.ok, false);
  assert.deepStrictEqual(result.projects, V1_PROJECTS);
  assert.deepStrictEqual(projectStorage.saveStore(storage, V1_PROJECTS, NOW), { ok: false });
  assert.strictEqual(storage.data["counter.projects"], v1Text());
  assert.strictEqual(storage.data["counter.v2"], undefined);
});

group("Loading twice");

test("loading the same data twice gives the same result, with no repeated unreadable entries", function () {
  [
    { "counter.v2": v2Text(brokenList()) },
    { "counter.projects": JSON.stringify(brokenList()) },
    { "counter.v2": "{not json" },
    { "counter.v2": "{not json", "counter.projects": JSON.stringify(brokenList()) },
    { "counter.projects": v1Text() },
  ].forEach(function (initial, i) {
    const storage = fakeStorage(initial);
    const first = projectStorage.loadStore(storage, NOW);
    const second = projectStorage.loadStore(storage, NOW);
    assert.deepStrictEqual(second.projects, first.projects, "case " + i);
    assert.deepStrictEqual(second.unreadable, first.unreadable, "case " + i);
    assert.deepStrictEqual(stored(storage, "counter.v2.unreadable") || [], first.unreadable, "case " + i);
    // A later day adds nothing either.
    projectStorage.loadStore(storage, LATER);
    assert.deepStrictEqual(stored(storage, "counter.v2.unreadable") || [], first.unreadable, "case " + i);
  });
});

group("Version 3: project timelines");

const projectTimeline = require("./timeline.js");

// Luigi's menu, moved to Working.
const WORKING = projectTimeline.markWorking(V1_PROJECTS[0],
  { agreedCents: 27000, plannedHours: 10, expensesCents: 2000, targetCents: 2500 }, new Date("2026-10-13T09:00:00.000Z")).project;

test("version 2 loads as usual, and the next save writes version 3", function () {
  const text = v2Text(V1_PROJECTS, 2);
  const storage = fakeStorage({ "counter.v2": text });
  const result = projectStorage.loadStore(storage, NOW);
  assert.deepStrictEqual(result, { ok: true, projects: V1_PROJECTS, unreadable: [], readOnly: false, source: "v2" });
  // Loading writes nothing: version 2 stays until something is saved.
  assert.strictEqual(storage.writes, 0);
  assert.strictEqual(storage.data["counter.v2"], text);
  assert.deepStrictEqual(projectStorage.saveStore(storage, result.projects, LATER), { ok: true });
  assert.deepStrictEqual(stored(storage, "counter.v2"), { version: 3, projects: V1_PROJECTS });
});

test("version 3 with a timeline loads and saves it exactly", function () {
  const list = [WORKING, V1_PROJECTS[1]];
  const storage = fakeStorage({ "counter.v2": v2Text(list) });
  const result = projectStorage.loadStore(storage, NOW);
  assert.deepStrictEqual(result, { ok: true, projects: list, unreadable: [], readOnly: false, source: "v2" });
  assert.deepStrictEqual(projectStorage.saveStore(storage, result.projects, LATER), { ok: true });
  assert.deepStrictEqual(stored(storage, "counter.v2"), { version: 3, projects: list });
});

test("version 4 is read only: its projects show, and nothing is written", function () {
  const text = v2Text([WORKING], 4);
  const storage = fakeStorage({ "counter.v2": text });
  const result = projectStorage.loadStore(storage, NOW);
  assert.deepStrictEqual(result, { ok: true, projects: [WORKING], unreadable: [], readOnly: true, source: "newer" });
  assert.deepStrictEqual(projectStorage.saveStore(storage, [], LATER), { ok: false, readOnly: true });
  assert.strictEqual(storage.writes, 0);
  assert.strictEqual(storage.data["counter.v2"], text);
});

test("a project with a bad timeline goes to unreadable with a reason, and the rest load", function () {
  const bad = Object.assign({}, WORKING, { timeline: Object.assign({}, WORKING.timeline, { plannedHours: -2 }) });
  const storage = fakeStorage({ "counter.v2": v2Text([V1_PROJECTS[0], bad, V1_PROJECTS[2]]) });
  const result = projectStorage.loadStore(storage, NOW);
  assert.deepStrictEqual(result.projects, [V1_PROJECTS[0], V1_PROJECTS[2]]);
  assert.deepStrictEqual(result.unreadable, [{ raw: bad, reason: "timeline is not valid", at: NOW.toISOString() }]);
  assert.deepStrictEqual(stored(storage, "counter.v2.unreadable"), result.unreadable);
  // A project broken in other ways still says so.
  const both = Object.assign({}, bad, { job: "spaceship" });
  const other = projectStorage.sortItems([both], NOW.toISOString());
  assert.strictEqual(other.unreadable[0].reason, "not a working project");
});

test("a version 1 upgrade writes version 3", function () {
  const storage = fakeStorage({ "counter.projects": v1Text() });
  assert.strictEqual(projectStorage.loadStore(storage, NOW).source, "upgraded");
  assert.strictEqual(stored(storage, "counter.v2").version, 3);
});

console.log("\n" + passed + " passed, " + failed + " failed");
if (failed > 0) process.exitCode = 1;
