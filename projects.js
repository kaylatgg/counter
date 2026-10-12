// Counter projects: saving, loading, and changing the list of projects.
// Pure functions plus a small storage helper. Works in the browser (as the
// global projectStore) and in Node (through module.exports).

const projectCalc = typeof calc !== "undefined" ? calc : require("./calc.js");

// Everything lives under one localStorage key, as a list of projects.
const STORAGE_KEY = "counter.projects";
const NAME_MAX = 60;

// The inputs a project keeps, besides the job, quote, and reply.
const INPUT_NAMES = projectCalc.HOURS_FIELDS.concat(["rate", "expenses", "offerStatus", "offer"]);

// The rate, expenses, and offer every new project starts with.
const STARTING_NUMBERS = { rate: "25", expenses: "20", offerStatus: "amount", offer: "200" };

// "Enter a project name." or null when the name is fine.
function validateName(name) {
  const trimmed = String(name == null ? "" : name).trim();
  if (!trimmed) return "Enter a project name.";
  if (trimmed.length > NAME_MAX) return "Use " + NAME_MAX + " characters or fewer.";
  return null;
}

// A new project with the job's example numbers. `now` is a Date, `id` a string.
function createProject(name, jobKey, id, now) {
  const example = projectCalc.JOBS[jobKey].example;
  const inputs = {};
  projectCalc.HOURS_FIELDS.forEach(function (field) { inputs[field] = String(example[field]); });
  Object.keys(STARTING_NUMBERS).forEach(function (field) { inputs[field] = STARTING_NUMBERS[field]; });
  return {
    id: id,
    name: String(name).trim(),
    job: jobKey,
    inputs: inputs,
    quote: "",
    reply: "",
    replyEdited: false,
    screen: "inputs",
    created: now.toISOString(),
    edited: now.toISOString(),
  };
}

function isDate(value) {
  return typeof value === "string" && !isNaN(Date.parse(value));
}

// Checks one saved project. Returns a clean copy, or null if it's broken.
// Optional parts that are missing get their defaults; anything the project
// can't work without (id, name, job, inputs, dates) makes it broken.
function cleanProject(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (typeof raw.id !== "string" || !raw.id) return null;
  if (typeof raw.name !== "string" || !raw.name.trim()) return null;
  if (!Object.prototype.hasOwnProperty.call(projectCalc.JOBS, raw.job)) return null;
  if (!raw.inputs || typeof raw.inputs !== "object") return null;
  if (!isDate(raw.created) || !isDate(raw.edited)) return null;

  const inputs = {};
  for (let i = 0; i < INPUT_NAMES.length; i++) {
    const value = raw.inputs[INPUT_NAMES[i]];
    if (typeof value !== "string" && typeof value !== "number") return null;
    inputs[INPUT_NAMES[i]] = String(value);
  }
  if (inputs.offerStatus !== "amount" && inputs.offerStatus !== "none") return null;

  return {
    id: raw.id,
    name: raw.name.trim().slice(0, NAME_MAX),
    job: raw.job,
    inputs: inputs,
    quote: typeof raw.quote === "string" ? raw.quote : "",
    reply: typeof raw.reply === "string" ? raw.reply : "",
    replyEdited: raw.replyEdited === true,
    screen: raw.screen === "results" ? "results" : "inputs",
    created: raw.created,
    edited: raw.edited,
  };
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

// A new id: random where the browser can, otherwise time plus randomness.
function newProjectId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

const projectStore = {
  STORAGE_KEY,
  NAME_MAX,
  INPUT_NAMES,
  validateName,
  createProject,
  cleanProject,
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
};

if (typeof module !== "undefined") module.exports = projectStore;
