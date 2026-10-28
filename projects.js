// Counter projects: the unsaved draft, and the saved list of projects.
// Pure functions plus a small storage helper. Works in the browser (as the
// global projectStore) and in Node (through module.exports).

const projectCalc = typeof calc !== "undefined" ? calc : require("./calc.js");

// Saved projects live under one localStorage key, as a list. The unsaved
// calculation (the draft) has its own key, so it can never overwrite a project.
const STORAGE_KEY = "counter.projects";
const DRAFT_KEY = "counter.draft";
const NAME_MAX = 60;

// The inputs a project keeps, besides the job, quote, and reply.
const INPUT_NAMES = projectCalc.HOURS_FIELDS.concat(["rate", "expenses", "offerStatus", "offer"]);

// "Ways to close the gap": which one is picked. "estimate" (the default),
// "trade", "offer", or "" when the person typed their own price.
const GAP_CHOICES = ["estimate", "trade", "offer", ""];

// The rate, expenses, and offer every new project starts with.
const STARTING_NUMBERS = { rate: "25", expenses: "20", offerStatus: "amount", offer: "200" };

// "Enter a project name." or null when the name is fine.
function validateName(name) {
  const trimmed = String(name == null ? "" : name).trim();
  if (!trimmed) return "Enter a project name.";
  if (trimmed.length > NAME_MAX) return "Use " + NAME_MAX + " characters or fewer.";
  return null;
}

// A fresh calculation: the job's example numbers, no quote, the reply not edited.
// fieldKey matters only for Custom, which is in every field.
function exampleDraft(jobKey, fieldKey) {
  const example = projectCalc.JOBS[jobKey].example;
  const inputs = {};
  projectCalc.HOURS_FIELDS.forEach(function (field) { inputs[field] = String(example[field]); });
  Object.keys(STARTING_NUMBERS).forEach(function (field) { inputs[field] = STARTING_NUMBERS[field]; });
  return {
    field: projectCalc.fieldForJob(jobKey, fieldKey), job: jobKey,
    inputs: inputs, quote: "", reply: "", replyEdited: false, gapChoice: "estimate",
  };
}

// True when a draft is still exactly its job's example: nothing to lose.
// The reply text alone doesn't count, since an unedited reply is just the draft.
function isUntouched(draft) {
  const fresh = exampleDraft(draft.job);
  const sameInputs = INPUT_NAMES.every(function (name) { return draft.inputs[name] === fresh.inputs[name]; });
  return sameInputs && draft.quote === "" && !draft.replyEdited && draft.gapChoice === "estimate";
}

// "Menu, Oct 11"
function defaultProjectName(jobKey, now) {
  return projectCalc.JOBS[jobKey].name + ", " + MONTHS[now.getMonth()] + " " + now.getDate();
}

// A project made from the calculation on screen. `now` is a Date, `id` a string.
function createProject(name, draft, id, now) {
  return {
    id: id,
    name: String(name).trim().slice(0, NAME_MAX),
    field: projectCalc.fieldForJob(draft.job, draft.field),
    job: draft.job,
    inputs: Object.assign({}, draft.inputs),
    quote: draft.quote,
    reply: draft.reply,
    replyEdited: draft.replyEdited,
    gapChoice: draft.gapChoice,
    created: now.toISOString(),
    edited: now.toISOString(),
  };
}

function isDate(value) {
  return typeof value === "string" && !isNaN(Date.parse(value));
}

// Checks the parts a project and a draft share: the field, the job, every input, the
// quote, and the reply. Returns a clean copy, or null if something needed is broken.
function cleanCalculation(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (!Object.prototype.hasOwnProperty.call(projectCalc.JOBS, raw.job)) return null;
  if (!raw.inputs || typeof raw.inputs !== "object") return null;
  const inputs = {};
  for (let i = 0; i < INPUT_NAMES.length; i++) {
    const value = raw.inputs[INPUT_NAMES[i]];
    if (typeof value !== "string" && typeof value !== "number") return null;
    inputs[INPUT_NAMES[i]] = String(value);
  }
  if (inputs.offerStatus !== "amount" && inputs.offerStatus !== "none") return null;
  return {
    // Older saves have no field: they were all Graphic design.
    field: projectCalc.fieldForJob(raw.job, raw.field),
    job: raw.job,
    inputs: inputs,
    quote: typeof raw.quote === "string" ? raw.quote : "",
    reply: typeof raw.reply === "string" ? raw.reply : "",
    replyEdited: raw.replyEdited === true,
    // Older saves have none: "Raise your price" (the default), or none picked
    // if they typed their own price, so it's kept.
    gapChoice: GAP_CHOICES.indexOf(raw.gapChoice) !== -1 ? raw.gapChoice
      : (typeof raw.quote === "string" && raw.quote !== "" ? "" : "estimate"),
  };
}

// Checks one saved project. Returns a clean copy, or null if it's broken.
// Optional parts that are missing get their defaults; anything the project
// can't work without (id, name, job, inputs, dates) makes it broken.
function cleanProject(raw) {
  const calculation = cleanCalculation(raw);
  if (!calculation) return null;
  if (typeof raw.id !== "string" || !raw.id) return null;
  if (typeof raw.name !== "string" || !raw.name.trim()) return null;
  if (!isDate(raw.created) || !isDate(raw.edited)) return null;
  return Object.assign({ id: raw.id, name: raw.name.trim().slice(0, NAME_MAX) }, calculation,
    { created: raw.created, edited: raw.edited });
}

// Reads the saved draft. Broken or missing gives null, so the page starts fresh.
function parseDraft(text) {
  if (typeof text !== "string" || !text) return null;
  try {
    return cleanCalculation(JSON.parse(text));
  } catch (error) {
    return null;
  }
}

// Reads the saved text. Broken projects (and repeated ids) are skipped, and
// text that isn't a list at all gives an empty list, so nothing crashes.
function parseProjects(text) {
  if (typeof text !== "string" || !text) return [];
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const seen = {};
  const list = [];
  data.forEach(function (raw) {
    const project = cleanProject(raw);
    if (project && !seen[project.id]) {
      seen[project.id] = true;
      list.push(project);
    }
  });
  return list;
}

function serializeProjects(list) {
  return JSON.stringify(list);
}

// Newest edit first.
function sortByEdited(list) {
  return list.slice().sort(function (a, b) { return Date.parse(b.edited) - Date.parse(a.edited); });
}

// Changes one project. With touch, its edited date moves to now.
function updateProject(list, id, changes, now, touch) {
  return list.map(function (project) {
    if (project.id !== id) return project;
    const next = Object.assign({}, project, changes);
    if (touch) next.edited = now.toISOString();
    return next;
  });
}

// Renaming to a blank name keeps the old name.
function renameProject(list, id, name, now) {
  const trimmed = String(name == null ? "" : name).trim().slice(0, NAME_MAX);
  if (!trimmed) return list;
  const current = findProject(list, id);
  if (!current || current.name === trimmed) return list;
  return updateProject(list, id, { name: trimmed }, now, true);
}

// "[name] copy", shortening the name so the whole thing fits in 60 characters.
function copyName(name) {
  const suffix = " copy";
  return name.slice(0, NAME_MAX - suffix.length).trim() + suffix;
}

function duplicateProject(list, id, newId, now) {
  const original = findProject(list, id);
  if (!original) return list;
  const copy = JSON.parse(JSON.stringify(original));
  copy.id = newId;
  copy.name = copyName(original.name);
  copy.created = now.toISOString();
  copy.edited = now.toISOString();
  return list.concat([copy]);
}

function deleteProject(list, id) {
  return list.filter(function (project) { return project.id !== id; });
}

function findProject(list, id) {
  return list.filter(function (project) { return project.id === id; })[0] || null;
}

// Storage. Both return { ok } so the page can say when saving fails, and
// neither ever throws (storage can be missing, blocked, or full).
function loadProjects(storage) {
  try {
    return { ok: true, projects: parseProjects(storage.getItem(STORAGE_KEY)) };
  } catch (error) {
    return { ok: false, projects: [] };
  }
}

function saveProjects(storage, list) {
  try {
    storage.setItem(STORAGE_KEY, serializeProjects(list));
    return { ok: true };
  } catch (error) {
    return { ok: false };
  }
}

function loadDraft(storage) {
  try {
    return { ok: true, draft: parseDraft(storage.getItem(DRAFT_KEY)) };
  } catch (error) {
    return { ok: false, draft: null };
  }
}

function saveDraft(storage, draft) {
  try {
    storage.setItem(DRAFT_KEY, JSON.stringify(draft));
    return { ok: true };
  } catch (error) {
    return { ok: false };
  }
}

// "just now", "today at 3:42 PM", "yesterday", "Oct 9", "Oct 9, 2025".
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatEdited(iso, now) {
  const date = new Date(iso);
  if (now - date < 60 * 1000 && now - date >= -60 * 1000) return "just now";
  if (sameDay(date, now)) {
    const hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return "today at " + (hours % 12 || 12) + ":" + minutes + (hours < 12 ? " AM" : " PM");
  }
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (sameDay(date, yesterday)) return "yesterday";
  const text = MONTHS[date.getMonth()] + " " + date.getDate();
  return date.getFullYear() === now.getFullYear() ? text : text + ", " + date.getFullYear();
}

// The Projects dashboard: what the saved offers paid against each target,
// after expenses. A project counts when it has an offer, its numbers work
// (a broken price to send doesn't block, like the list), and it has hours.
// Each job is rounded to whole dollars first, so every total adds up.
function pricingJob(project) {
  if (project.inputs.offerStatus !== "amount") return null;
  const raw = Object.assign({}, project.inputs, { quote: project.quote });
  const checked = projectCalc.validateInputs(raw, project.job);
  const blocking = Object.keys(checked.errors).filter(function (name) { return name !== "quote"; });
  if (blocking.length) return null;
  const r = projectCalc.calculate(checked.values);
  if (!r.hasHours || !r.offer) return null;
  const targetPay = Math.round(r.rate * r.hours.total);
  const kept = Math.round(r.offer.amount - r.expenses);
  return {
    id: project.id,
    name: project.name,
    created: project.created,
    rate: r.rate,
    hours: r.hours.total,
    offer: r.offer.amount,
    expenses: r.expenses,
    hourlyAfter: r.offer.hourlyAfter,
    targetPay: targetPay,
    kept: kept,
    step: kept - targetPay,
    percent: r.offer.hourlyAfter / r.rate,
    metTarget: kept >= targetPay,
    unpaidHours: r.offer.unpaidHours,
  };
}

// A sort that keeps the list's order for ties (newest edit first).
function stableSort(list, compare) {
  return list.map(function (item, index) { return { item: item, index: index }; })
    .sort(function (a, b) { return compare(a.item, b.item) || a.index - b.index; })
    .map(function (entry) { return entry.item; });
}

// Waterfall order: shortfalls largest first, then gains largest first.
function waterfallOrder(jobs) {
  return stableSort(jobs, function (a, b) {
    const sideA = a.step < 0 ? 0 : 1;
    const sideB = b.step < 0 ? 0 : 1;
    return sideA - sideB || Math.abs(b.step) - Math.abs(a.step);
  });
}

// list: saved projects, newest edit first. Returns null when none count.
function pricingSummary(list) {
  const jobs = list.map(pricingJob).filter(Boolean);
  if (!jobs.length) return null;
  function sum(key) { return jobs.reduce(function (total, job) { return total + job[key]; }, 0); }
  const targetPay = sum("targetPay");
  const kept = sum("kept");
  const shortfall = targetPay - kept;
  const hours = sum("hours");
  const unpaidHours = sum("unpaidHours");
  const created = jobs.map(function (job) { return job.created; })
    .sort(function (a, b) { return Date.parse(a) - Date.parse(b); });

  // The biggest fix: the most negative step, if any.
  const short = jobs.filter(function (job) { return job.step < 0; });
  const biggestFix = short.length ? stableSort(short, function (a, b) { return a.step - b.step; })[0] : null;
  const gapShare = biggestFix && shortfall > 0 ? -biggestFix.step / shortfall : null;

  // The waterfall's steps. With more than 6 jobs: the 5 largest (either sign),
  // then "Other jobs" with the net of the rest.
  let steps = waterfallOrder(jobs);
  let other = null;
  if (jobs.length > 6) {
    const largest = stableSort(jobs, function (a, b) { return Math.abs(b.step) - Math.abs(a.step); }).slice(0, 5);
    steps = waterfallOrder(largest);
    const rest = jobs.filter(function (job) { return largest.indexOf(job) === -1; });
    other = { count: rest.length, step: rest.reduce(function (total, job) { return total + job.step; }, 0) };
  }

  return {
    jobs: jobs,
    counted: jobs.length,
    total: list.length,
    targetPay: targetPay,
    kept: kept,
    shortfall: shortfall,
    percent: kept / targetPay,
    hours: hours,
    unpaidHours: unpaidHours,
    paidHours: hours - unpaidHours,
    met: jobs.filter(function (job) { return job.metTarget; }).length,
    firstCreated: created[0],
    lastCreated: created[created.length - 1],
    biggestFix: biggestFix,
    withFixPercent: biggestFix ? (kept - biggestFix.step) / targetPay : null,
    // Used only when part of the gap, not all of it, came from one job.
    gapShare: gapShare !== null && gapShare < 1 ? gapShare : null,
    steps: steps,
    other: other,
    byPercent: stableSort(jobs, function (a, b) { return a.percent - b.percent; }),
  };
}

// The line under the unpaid hours. A quarter or less reads as "1 of every
// N hours": rounding to tenths would call 10.1 of 69.5 hours (about 1 in 7)
// "1 of every 10". More than a quarter reads as "N of every 10 hours".
function unpaidLine(unpaidHours, hours) {
  const lead = "Hours the offers did not cover. ";
  if (unpaidHours <= 1e-9) return "Every hour was covered.";
  if (Math.abs(unpaidHours - hours) <= 1e-9) return "None of your hours were covered.";
  const share = unpaidHours / hours;
  if (share < 0.05) return lead + "Less than 1 of every 20 hours.";
  if (share <= 0.25) return lead + "About 1 of every " + Math.round(1 / share) + " hours.";
  const tens = Math.round(share * 10);
  if (tens === 10) return lead + "Almost every hour.";
  return lead + "About " + tens + " of every 10 hours.";
}

// A new id: random where the browser can, otherwise time plus randomness.
function newProjectId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

const projectStore = {
  STORAGE_KEY,
  DRAFT_KEY,
  NAME_MAX,
  INPUT_NAMES,
  validateName,
  exampleDraft,
  isUntouched,
  defaultProjectName,
  createProject,
  cleanCalculation,
  cleanProject,
  parseDraft,
  loadDraft,
  saveDraft,
  parseProjects,
  serializeProjects,
  sortByEdited,
  updateProject,
  renameProject,
  copyName,
  duplicateProject,
  deleteProject,
  findProject,
  loadProjects,
  saveProjects,
  formatEdited,
  newProjectId,
  pricingSummary,
  unpaidLine,
};

if (typeof module !== "undefined") module.exports = projectStore;
