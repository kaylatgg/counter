// Backup tests. Run with: node backup.test.js
// Uses only Node's built-in assert, so nothing needs installing.

const assert = require("assert");
const projectStore = require("./projects.js");
const projectStorage = require("./store.js");
const projectBackup = require("./backup.js");
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

// A stand-in for localStorage, starting with `initial`. `full` makes saving
// throw, like a full quota. `writes` lists the keys written, in order.
function fakeStorage(initial, options) {
  const data = Object.assign({}, initial);
  options = options || {};
  const storage = {
    data: data,
    writes: [],
    getItem: function (key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem: function (key, value) {
      if (options.full) throw new Error("QuotaExceededError");
      storage.writes.push(key);
      data[key] = String(value);
    },
  };
  return storage;
}

const NOW = new Date("2026-11-18T10:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const daysBefore = (days) => new Date(NOW.getTime() - days * DAY).toISOString();

// A project made the way the app makes one, edited at `edited`.
function project(id, name, jobKey, fieldKey, edited) {
  const made = projectStore.createProject(name, projectStore.exampleDraft(jobKey, fieldKey), id, new Date("2026-10-01T09:00:00.000Z"));
  made.edited = edited || made.edited;
  return made;
}

// Three projects in different fields, with a typed price, an edited reply,
// and a picked way to close the gap, so every field round-trips.
const THREE = [
  Object.assign(project("p-menu", "Luigi's menu", "menu", "graphic", "2026-10-12T09:05:00.000Z"),
    { quote: "280", gapChoice: "", reply: "Hi! My price is $280.", replyEdited: true }),
  Object.assign(project("p-portrait", "Bakery portrait", "portrait", "illustration", "2026-10-21T08:00:00.000Z"),
    { gapChoice: "trade" }),
  project("p-event", "Open studio <b>event</b> & \"party\"", "event", "photography", "2026-11-05T08:15:00.000Z"),
];

function fileWith(changes) {
  return JSON.stringify(Object.assign({ app: "counter", kind: "backup", version: 3, exportedAt: NOW.toISOString(), projects: THREE, unreadable: [] }, changes));
}

group("Writing a backup");

test("buildBackup writes the format, pretty-printed with 2 spaces", () => {
  const text = projectBackup.buildBackup(THREE, [], NOW);
  const data = JSON.parse(text);
  assert.deepStrictEqual(Object.keys(data), ["app", "kind", "version", "exportedAt", "projects", "unreadable"]);
  assert.strictEqual(data.app, "counter");
  assert.strictEqual(data.kind, "backup");
  assert.strictEqual(data.version, 3);
  assert.strictEqual(data.exportedAt, "2026-11-18T10:00:00.000Z");
  assert.ok(text.startsWith('{\n  "app": "counter",\n  "kind": "backup",'));
});

test("buildBackup keeps the unreadable items", () => {
  const unreadable = [{ raw: "{oops", reason: "not valid JSON", at: "2026-11-01T00:00:00.000Z" }];
  assert.deepStrictEqual(JSON.parse(projectBackup.buildBackup(THREE, unreadable, NOW)).unreadable, unreadable);
});

test("backupFileName uses the local date, with zero padding", () => {
  assert.strictEqual(projectBackup.backupFileName(new Date(2026, 10, 18, 23, 59)), "counter-backup-2026-11-18.json");
  assert.strictEqual(projectBackup.backupFileName(new Date(2027, 0, 5, 0, 1)), "counter-backup-2027-01-05.json");
});

group("Reading a backup");

test("export then read gives back the same projects, field for field", () => {
  const read = projectBackup.readBackup(projectBackup.buildBackup(THREE, [], NOW), NOW);
  assert.strictEqual(read.ok, true);
  assert.deepStrictEqual(read.projects, THREE);
  assert.deepStrictEqual(read.unreadable, []);
});

test("not JSON", () => {
  assert.deepStrictEqual(projectBackup.readBackup("{\"app\": \"counter\"", NOW), { ok: false, reason: "not-json" });
  assert.deepStrictEqual(projectBackup.readBackup("", NOW), { ok: false, reason: "not-json" });
});

test("not a Counter backup: another app, another kind, a plain value", () => {
  for (const text of [fileWith({ app: "other" }), fileWith({ kind: "projects" }), fileWith({ app: undefined }), "42", "null", "\"counter\""]) {
    assert.deepStrictEqual(projectBackup.readBackup(text, NOW), { ok: false, reason: "not-counter" }, text.slice(0, 40));
  }
});

test("a version 1 plain list of projects is not a Counter backup", () => {
  assert.deepStrictEqual(projectBackup.readBackup(JSON.stringify(THREE), NOW), { ok: false, reason: "not-counter" });
});

test("a file from a newer version", () => {
  assert.deepStrictEqual(projectBackup.readBackup(fileWith({ version: 4 }), NOW), { ok: false, reason: "newer" });
  assert.deepStrictEqual(projectBackup.readBackup(fileWith({ version: 3.1 }), NOW), { ok: false, reason: "newer" });
});

test("a version 2 file (from before timelines) still reads and restores", () => {
  const read = projectBackup.readBackup(fileWith({ version: 2 }), NOW);
  assert.deepStrictEqual(read, { ok: true, projects: THREE, unreadable: [] });
  const storage = fakeStorage({});
  const result = projectBackup.restoreBackup(storage, [], read, NOW);
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(JSON.parse(storage.data["counter.v2"]), { version: 3, projects: THREE });
});

test("a backup with timelines round-trips exactly", () => {
  const working = projectTimeline.markWorking(THREE[0],
    { agreedCents: 27000, plannedHours: 10, expensesCents: 2000, targetCents: 2500 }, new Date("2026-10-13T09:00:00.000Z")).project;
  const withRequest = Object.assign({}, working, { timeline: Object.assign({}, working.timeline, { requests: [
    { id: "r1", at: "2026-10-20T12:00:00.000Z", text: "Add a dessert section", hours: 1, decision: "free", rateCents: 2500, chargeCents: 0 },
  ] }) });
  const paid = projectTimeline.markPaid(withRequest, { receivedCents: 31000, actualHours: 13 }, new Date("2026-10-30T17:30:00.000Z")).project;
  const list = [paid, THREE[1], projectTimeline.markWorking(THREE[2],
    { agreedCents: 1, plannedHours: 0.01, expensesCents: 0, targetCents: 0 }, NOW).project];
  const text = projectBackup.buildBackup(list, [], NOW);
  const read = projectBackup.readBackup(text, NOW);
  assert.deepStrictEqual(read, { ok: true, projects: list, unreadable: [] });
  assert.strictEqual(projectBackup.buildBackup(read.projects, read.unreadable, NOW), text);
  // Restored into an empty browser, then loaded again: still the same.
  const storage = fakeStorage({});
  projectBackup.restoreBackup(storage, [], read, NOW);
  assert.deepStrictEqual(projectStorage.loadStore(storage, NOW).projects, list);
});

test("a backup project with a bad timeline goes to unreadable; the rest restore", () => {
  const working = projectTimeline.markWorking(THREE[0],
    { agreedCents: 27000, plannedHours: 10, expensesCents: 2000, targetCents: 2500 }, new Date("2026-10-13T09:00:00.000Z")).project;
  const bad = Object.assign({}, working, { timeline: Object.assign({}, working.timeline, { stage: "paid" }) });
  const read = projectBackup.readBackup(fileWith({ projects: [bad, THREE[1]] }), NOW);
  assert.deepStrictEqual(read.projects, [THREE[1]]);
  assert.deepStrictEqual(read.unreadable, [{ raw: bad, reason: "timeline is not valid", at: NOW.toISOString() }]);
});

test("an unknown version: older, missing, not a number, or projects not a list", () => {
  for (const changes of [{ version: 1 }, { version: 0 }, { version: 2.5 }, { version: undefined }, { version: "2" }, { version: "3" }, { version: null },
    { projects: {} }, { projects: undefined }, { version: 2, projects: {} }]) {
    assert.deepStrictEqual(projectBackup.readBackup(fileWith(changes), NOW), { ok: false, reason: "unknown-version" }, JSON.stringify(changes));
  }
});

test("a file over 5 MB is too big, before it's parsed", () => {
  const big = "x".repeat(5 * 1024 * 1024 + 1);
  assert.deepStrictEqual(projectBackup.readBackup(big, NOW), { ok: false, reason: "too-big" });
  const atLimit = fileWith({ exportedAt: "" });
  const padded = atLimit + " ".repeat(5 * 1024 * 1024 - atLimit.length);
  assert.strictEqual(projectBackup.readBackup(padded, NOW).ok, true);
});

test("broken projects and repeated ids go to unreadable, and the good ones still restore", () => {
  const broken = { id: "p-broken", name: "No job", inputs: {} };
  const repeat = Object.assign({}, THREE[0], { name: "Second copy" });
  const read = projectBackup.readBackup(fileWith({ projects: [THREE[0], broken, repeat, THREE[1], "text"] }), NOW);
  assert.strictEqual(read.ok, true);
  assert.deepStrictEqual(read.projects.map((p) => p.id), ["p-menu", "p-portrait"]);
  assert.strictEqual(read.projects[0].name, "Luigi's menu");
  assert.deepStrictEqual(read.unreadable.map((u) => u.reason), ["not a working project", "repeated id p-menu", "not a working project"]);
  assert.deepStrictEqual(read.unreadable[0].raw, broken);
  assert.strictEqual(read.unreadable[1].raw.name, "Second copy");
  assert.strictEqual(read.unreadable[0].at, NOW.toISOString());
});

test("the file's own unreadable items come along, before the new ones", () => {
  const old = { raw: "{oops", reason: "not valid JSON", at: "2026-11-01T00:00:00.000Z" };
  const read = projectBackup.readBackup(fileWith({ unreadable: [old, "loose"], projects: [THREE[0], { id: "x" }] }), NOW);
  assert.deepStrictEqual(read.unreadable[0], old);
  assert.deepStrictEqual(read.unreadable[1], { raw: "loose", reason: "not an unreadable item", at: NOW.toISOString() });
  assert.strictEqual(read.unreadable[2].reason, "not a working project");
});

test("a missing unreadable list is fine; one that isn't a list is kept whole", () => {
  assert.deepStrictEqual(projectBackup.readBackup(fileWith({ unreadable: undefined }), NOW).unreadable, []);
  assert.deepStrictEqual(projectBackup.readBackup(fileWith({ unreadable: { a: 1 } }), NOW).unreadable,
    [{ raw: { a: 1 }, reason: "unreadable is not a list", at: NOW.toISOString() }]);
});

test("names are read as plain text, exactly as written", () => {
  const read = projectBackup.readBackup(fileWith({}), NOW);
  assert.strictEqual(read.projects[2].name, "Open studio <b>event</b> & \"party\"");
});

group("Merging");

const HERE = [
  project("a", "Same", "menu", "graphic", "2026-10-01T09:00:00.000Z"),
  project("b", "Mine older", "logo", "graphic", "2026-10-02T09:00:00.000Z"),
  project("c", "Mine newer", "poster", "graphic", "2026-10-20T09:00:00.000Z"),
  project("d", "Equal dates", "website", "graphic", "2026-10-04T09:00:00.000Z"),
  project("e", "Only here", "social", "graphic", "2026-10-05T09:00:00.000Z"),
];
const FILE = [
  project("a", "Same", "menu", "graphic", "2026-10-01T09:00:00.000Z"),
  Object.assign(project("b", "File newer", "logo", "graphic", "2026-10-10T09:00:00.000Z"), { quote: "500" }),
  project("c", "File older", "poster", "graphic", "2026-10-03T09:00:00.000Z"),
  project("d", "Equal dates, file", "website", "graphic", "2026-10-04T09:00:00.000Z"),
  project("f", "Only in file", "event", "photography", "2026-10-06T09:00:00.000Z"),
  project("g", "Also only in file", "logoanim", "motion", "2026-10-07T09:00:00.000Z"),
];

test("the newer copy wins, equal dates keep the copy here, new ones are added", () => {
  const merged = projectBackup.mergeRestore(HERE, FILE);
  assert.deepStrictEqual(merged.map((p) => p.id + ":" + p.name), [
    "a:Same", "b:File newer", "c:Mine newer", "d:Equal dates", "e:Only here", "f:Only in file", "g:Also only in file",
  ]);
  assert.strictEqual(merged[1].quote, "500");
});

test("nothing here is ever removed, even by an empty file", () => {
  assert.deepStrictEqual(projectBackup.mergeRestore(HERE, []), HERE);
  const merged = projectBackup.mergeRestore(HERE, [FILE[4]]);
  HERE.forEach((p) => assert.ok(merged.some((m) => m.id === p.id), p.id));
});

test("merging doesn't change the lists it's given", () => {
  const here = JSON.stringify(HERE), file = JSON.stringify(FILE);
  projectBackup.mergeRestore(HERE, FILE);
  projectBackup.previewRestore(HERE, FILE);
  assert.strictEqual(JSON.stringify(HERE), here);
  assert.strictEqual(JSON.stringify(FILE), file);
});

test("restoring into nothing adds everything", () => {
  assert.deepStrictEqual(projectBackup.mergeRestore([], THREE), THREE);
  assert.deepStrictEqual(projectBackup.previewRestore([], THREE), { added: 3, updated: 0, unchanged: 0, kept: 0 });
});

test("restoring the same file twice changes nothing the second time", () => {
  const once = projectBackup.mergeRestore(HERE, FILE);
  assert.deepStrictEqual(projectBackup.mergeRestore(once, FILE), once);
  // "c" and "d" stay as they are here, so they're still "kept".
  assert.deepStrictEqual(projectBackup.previewRestore(once, FILE), { added: 0, updated: 0, unchanged: 4, kept: 2 });
});

test("a repeated id in the file counts once, as its first copy", () => {
  const twice = [FILE[4], Object.assign({}, FILE[4], { name: "Later copy", edited: "2026-12-01T00:00:00.000Z" })];
  assert.deepStrictEqual(projectBackup.mergeRestore([], twice).map((p) => p.name), ["Only in file"]);
  assert.deepStrictEqual(projectBackup.previewRestore([], twice), { added: 1, updated: 0, unchanged: 0, kept: 0 });
});

group("Preview");

test("the counts for each case", () => {
  assert.deepStrictEqual(projectBackup.previewRestore(HERE, FILE), { added: 2, updated: 1, unchanged: 1, kept: 2 });
});

test("the counts match what mergeRestore does", () => {
  const cases = [[HERE, FILE], [[], THREE], [THREE, THREE], [HERE, []], [FILE, HERE]];
  cases.forEach(([here, file], i) => {
    const counts = projectBackup.previewRestore(here, file);
    const merged = projectBackup.mergeRestore(here, file);
    const before = {};
    here.forEach((p) => { before[p.id] = p; });
    assert.strictEqual(merged.length - here.length, counts.added, "added, case " + i);
    const replaced = merged.filter((p) => before[p.id] && before[p.id] !== p).length;
    assert.strictEqual(replaced, counts.updated, "updated, case " + i);
    assert.strictEqual(counts.added + counts.updated + counts.unchanged + counts.kept, new Set(file.map((p) => p.id)).size, "total, case " + i);
  });
});

test("the same project with keys in another order is unchanged", () => {
  const reordered = {};
  Object.keys(HERE[0]).reverse().forEach((key) => { reordered[key] = HERE[0][key]; });
  assert.deepStrictEqual(projectBackup.previewRestore([HERE[0]], [reordered]), { added: 0, updated: 0, unchanged: 1, kept: 0 });
});

group("Backup reminder");

const FIVE = [0, 1, 2, 3, 4].map((i) => project("r" + i, "Job " + i, "menu", "graphic", daysBefore(40 - i)));

test("4 projects: never a reminder", () => {
  assert.strictEqual(projectBackup.needsBackupReminder(FIVE.slice(0, 4), null, NOW), false);
});

test("5 projects, never backed up: a reminder", () => {
  assert.strictEqual(projectBackup.needsBackupReminder(FIVE, null, NOW), true);
  assert.strictEqual(projectBackup.needsBackupReminder(FIVE, "not a date", NOW), true);
});

test("edited since a backup 29 days ago: no reminder yet", () => {
  const edited = FIVE.concat([project("r5", "New", "menu", "graphic", daysBefore(1))]);
  assert.strictEqual(projectBackup.needsBackupReminder(edited, daysBefore(29), NOW), false);
});

test("edited since a backup 30 days ago: a reminder", () => {
  const edited = FIVE.concat([project("r5", "New", "menu", "graphic", daysBefore(1))]);
  assert.strictEqual(projectBackup.needsBackupReminder(edited, daysBefore(30), NOW), true);
});

test("nothing edited since the last backup: no reminder, however old", () => {
  assert.strictEqual(projectBackup.needsBackupReminder(FIVE, daysBefore(35), NOW), false);
  const longAgo = FIVE.map((p, i) => Object.assign({}, p, { edited: daysBefore(500 + i) }));
  assert.strictEqual(projectBackup.needsBackupReminder(longAgo, daysBefore(400), NOW), false);
});

group("Storage");

test("the last backup date lives in counter.v2.backup and never touches counter.v2", () => {
  const storage = fakeStorage({ "counter.v2": "unchanged" });
  assert.strictEqual(projectBackup.loadLastBackup(storage), null);
  assert.deepStrictEqual(projectBackup.saveLastBackup(storage, NOW), { ok: true });
  assert.deepStrictEqual(JSON.parse(storage.data["counter.v2.backup"]), { at: NOW.toISOString() });
  assert.strictEqual(projectBackup.loadLastBackup(storage), NOW.toISOString());
  assert.deepStrictEqual(storage.writes, ["counter.v2.backup"]);
  assert.strictEqual(storage.data["counter.v2"], "unchanged");
});

test("a broken or blocked backup date reads as never; a full storage gives ok false", () => {
  assert.strictEqual(projectBackup.loadLastBackup(fakeStorage({ "counter.v2.backup": "{oops" })), null);
  assert.strictEqual(projectBackup.loadLastBackup(fakeStorage({ "counter.v2.backup": "{\"at\":\"soon\"}" })), null);
  assert.strictEqual(projectBackup.loadLastBackup({ getItem: () => { throw new Error("blocked"); } }), null);
  assert.deepStrictEqual(projectBackup.saveLastBackup(fakeStorage({}, { full: true }), NOW), { ok: false });
});

test("restore saves the merged list to counter.v2 and keeps the file's unreadable items once", () => {
  const storage = fakeStorage({ "counter.v2": JSON.stringify({ version: 3, projects: HERE }) });
  const current = projectStorage.loadStore(storage, NOW).projects;
  const old = { raw: "{oops", reason: "not valid JSON", at: "2026-11-01T00:00:00.000Z" };
  const backup = projectBackup.readBackup(fileWith({ projects: FILE.concat([{ id: "bad" }]), unreadable: [old] }), NOW);
  const result = projectBackup.restoreBackup(storage, current, backup, NOW);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.unreadableKept, true);
  assert.deepStrictEqual(result.counts, { added: 2, updated: 1, unchanged: 1, kept: 2 });
  assert.deepStrictEqual(JSON.parse(storage.data["counter.v2"]).projects, projectBackup.mergeRestore(HERE, FILE));
  assert.deepStrictEqual(JSON.parse(storage.data["counter.v2.unreadable"]).map((u) => u.reason), ["not valid JSON", "not a working project"]);
  // Again: nothing doubles.
  const again = projectBackup.restoreBackup(storage, result.projects, backup, NOW);
  assert.deepStrictEqual(again.counts, { added: 0, updated: 0, unchanged: 4, kept: 2 });
  assert.strictEqual(JSON.parse(storage.data["counter.v2"]).projects.length, 7);
  assert.strictEqual(JSON.parse(storage.data["counter.v2.unreadable"]).length, 2);
});

test("restore after a newer version's load is refused and writes nothing", () => {
  const newer = JSON.stringify({ version: 4, projects: HERE });
  const storage = fakeStorage({ "counter.v2": newer });
  const loaded = projectStorage.loadStore(storage, NOW);
  assert.strictEqual(loaded.readOnly, true);
  const backup = projectBackup.readBackup(fileWith({ projects: FILE.concat([{ id: "bad" }]) }), NOW);
  const result = projectBackup.restoreBackup(storage, loaded.projects, backup, NOW);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.readOnly, true);
  assert.deepStrictEqual(storage.writes, []);
  assert.strictEqual(storage.data["counter.v2"], newer);
  assert.strictEqual(result.projects, loaded.projects);
});

test("restore when storage is full: ok false, and the list here is unchanged", () => {
  const storage = fakeStorage({}, { full: true });
  const backup = projectBackup.readBackup(fileWith({}), NOW);
  const result = projectBackup.restoreBackup(storage, [], backup, NOW);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.readOnly, false);
  assert.deepStrictEqual(result.projects, []);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
