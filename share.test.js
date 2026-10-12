// Share link tests. Run with: node share.test.js
// Uses only Node's built-in assert, so nothing needs installing.

const assert = require("assert");
const calc = require("./calc.js");
const projectStore = require("./projects.js");
const share = require("./share.js");

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

// A link made from a job's example, with changes to its inputs.
function linkFor(job, field, changes) {
  const draft = projectStore.exampleDraft(job, field);
  Object.assign(draft.inputs, changes || {});
  return { draft: draft, hash: share.encodeShare(draft.field, draft.job, draft.inputs) };
}

group("Round trip");

test("every field's jobs come back exactly, with an offer", function () {
  Object.keys(calc.WORK_FIELDS).forEach(function (field) {
    calc.WORK_FIELDS[field].jobs.forEach(function (job) {
      const made = linkFor(job, field, { offer: "350" });
      const read = share.decodeShare(made.hash);
      assert.strictEqual(read.status, "ok", job);
      assert.strictEqual(read.draft.field, field);
      assert.strictEqual(read.draft.job, job);
      assert.deepStrictEqual(read.draft.inputs, made.draft.inputs);
    });
  });
});

test("with no offer, offer=none comes back as Not yet", function () {
  ["graphic", "illustration", "photography"].forEach(function (field) {
    const job = calc.WORK_FIELDS[field].jobs[0];
    const made = linkFor(job, field, { offerStatus: "none" });
    assert.ok(made.hash.indexOf("offer=none") !== -1);
    const read = share.decodeShare(made.hash);
    assert.strictEqual(read.status, "ok");
    assert.strictEqual(read.draft.inputs.offerStatus, "none");
  });
});

test("the link has the version, field, job, and every number, and nothing else", function () {
  const made = linkFor("menu", "graphic", { offer: "1,000", rate: "1,250.5" });
  assert.strictEqual(made.hash,
    "#s=v=1&field=graphic&job=menu&count=2&rounds=2&setup=2&item=2&comm=1.5&round=1.5" +
    "&delivery=1&rate=1250.5&expenses=20&offer=1000");
});

test("a shared calculation has no price to send and no reply", function () {
  const read = share.decodeShare(linkFor("logo", "graphic").hash);
  assert.strictEqual(read.draft.quote, "");
  assert.strictEqual(read.draft.reply, "");
  assert.strictEqual(read.draft.replyEdited, false);
});

test("Custom keeps the field it was shared from", function () {
  const read = share.decodeShare(linkFor("custom", "photography", { setupHours: "3" }).hash);
  assert.strictEqual(read.status, "ok");
  assert.strictEqual(read.draft.field, "photography");
  assert.strictEqual(read.draft.inputs.setupHours, "3");
});

group("Broken links");

test("a link cut off partway uses the examples for what's missing", function () {
  const full = linkFor("logo", "graphic", { count: "5" }).hash;
  const read = share.decodeShare(full.slice(0, full.indexOf("&item")));
  assert.strictEqual(read.status, "partial");
  assert.strictEqual(read.draft.job, "logo");
  assert.strictEqual(read.draft.inputs.count, "5");
  assert.strictEqual(read.draft.inputs.itemHours, String(calc.JOBS.logo.example.itemHours));
  assert.strictEqual(read.draft.inputs.offer, "200");
});

test("bad values use the examples, and the rest are kept", function () {
  const read = share.decodeShare(linkFor("menu", "graphic", {
    count: "1.5", rounds: "-1", setupHours: "abc", rate: "0", expenses: "", offer: "lots",
  }).hash.replace("comm=1.5", "comm=4"));
  assert.strictEqual(read.status, "partial");
  assert.strictEqual(read.draft.inputs.count, "2");
  assert.strictEqual(read.draft.inputs.rounds, "2");
  assert.strictEqual(read.draft.inputs.setupHours, "2");
  assert.strictEqual(read.draft.inputs.rate, "25");
  assert.strictEqual(read.draft.inputs.expenses, "20");
  assert.strictEqual(read.draft.inputs.offer, "200");
  assert.strictEqual(read.draft.inputs.communicationHours, "4");
});

test("an unknown job uses the menu; a field that doesn't match the job is corrected", function () {
  const unknown = share.decodeShare(linkFor("menu", "graphic").hash.replace("job=menu", "job=mural"));
  assert.strictEqual(unknown.status, "partial");
  assert.strictEqual(unknown.draft.job, "menu");
  const mismatch = share.decodeShare(linkFor("menu", "graphic").hash.replace("field=graphic", "field=photography"));
  assert.strictEqual(mismatch.status, "partial");
  assert.strictEqual(mismatch.draft.field, "graphic");
});

test("an unreadable link or an unknown version gives the menu example", function () {
  ["#s=", "#s=%E0%A4%A", "#s=v", "#s=hello", "#s=v=2&field=graphic&job=logo"].forEach(function (hash) {
    const read = share.decodeShare(hash);
    assert.strictEqual(read.status, "broken", hash);
    assert.deepStrictEqual(read.draft, projectStore.exampleDraft("menu"));
  });
});

test("only hashes starting with #s= are share links", function () {
  assert.strictEqual(share.isShareHash("#s=v=1"), true);
  assert.strictEqual(share.isShareHash("#result"), false);
  assert.strictEqual(share.isShareHash(""), false);
});

console.log("\n" + passed + " passed, " + failed + " failed");
if (failed > 0) process.exitCode = 1;
