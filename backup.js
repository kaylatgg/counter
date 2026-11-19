// Counter backups: the saved projects as a file to download, and restoring one
// by merging it with the projects here. Pure functions plus a small storage
// helper. Works in the browser (as the global projectBackup) and in Node
// (through module.exports).
//
// A restore never removes a project that's here: a project in both keeps the
// copy with the later edited date (the one here when the dates are equal), and
// projects not here yet are added. A backup file is only ever read with
// JSON.parse.

const backupProjects = typeof projectStore !== "undefined" ? projectStore : require("./projects.js");
const backupStorage = typeof projectStorage !== "undefined" ? projectStorage : require("./store.js");

const BACKUP_VERSION = backupStorage.STORE_VERSION;
// A real backup is far smaller; a bigger file is something else.
const BACKUP_MAX_LENGTH = 5 * 1024 * 1024;
const REMINDER_PROJECTS = 5;
const REMINDER_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

// The file's text, pretty-printed so it reads clearly if someone opens it.
function buildBackup(projects, unreadable, now) {
  return JSON.stringify({
    app: "counter",
    kind: "backup",
    version: BACKUP_VERSION,
    exportedAt: (now || new Date()).toISOString(),
    projects: projects,
    unreadable: unreadable || [],
  }, null, 2);
}

function pad(number) {
  return (number < 10 ? "0" : "") + number;
}

// "counter-backup-2026-11-18.json", on the local date.
function backupFileName(now) {
  const date = now || new Date();
  return "counter-backup-" + date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) + ".json";
}

// Checks a backup file's text. Returns { ok: true, projects, unreadable }, with
// broken projects and repeated ids moved into unreadable with a reason, or
// { ok: false, reason }: "too-big", "not-json", "not-counter", "newer", or
// "unknown-version".
function readBackup(text, now) {
  const at = (now || new Date()).toISOString();
  if (typeof text !== "string") return { ok: false, reason: "not-json" };
  if (text.length > BACKUP_MAX_LENGTH) return { ok: false, reason: "too-big" };
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    return { ok: false, reason: "not-json" };
  }
  if (!data || typeof data !== "object" || Array.isArray(data) || data.app !== "counter" || data.kind !== "backup") {
    return { ok: false, reason: "not-counter" };
  }
  if (typeof data.version === "number" && data.version > BACKUP_VERSION) return { ok: false, reason: "newer" };
  if (data.version !== BACKUP_VERSION || !Array.isArray(data.projects)) return { ok: false, reason: "unknown-version" };

  const sorted = backupStorage.sortItems(data.projects, at);
  // The file's own unreadable items come along as they are.
  let kept = [];
  if (Array.isArray(data.unreadable)) {
    kept = data.unreadable.map(function (entry) {
      return entry && typeof entry === "object" && !Array.isArray(entry) && "raw" in entry
        ? entry : { raw: entry, reason: "not an unreadable item", at: at };
    });
  } else if (data.unreadable !== undefined) {
    kept = [{ raw: data.unreadable, reason: "unreadable is not a list", at: at }];
  }
  return { ok: true, projects: sorted.projects, unreadable: kept.concat(sorted.unreadable) };
}

// The same text for the same content, whatever order its keys are in.
function canonical(value) {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.keys(value).sort().map(function (key) {
      return JSON.stringify(key) + ":" + canonical(value[key]);
    }).join(",") + "}";
  }
  return JSON.stringify(value);
}

// What a restore does with each project in the file: "added" (not here yet),
// "unchanged" (the same as here), "updated" (the file's copy was edited later),
// or "kept" (the copy here is newer, or the dates are equal). A repeated id in
// the file counts once, as its first copy.
function restorePlan(current, incoming) {
  const here = {};
  current.forEach(function (project) { here[project.id] = project; });
  const seen = {};
  const plan = [];
  incoming.forEach(function (project) {
    if (seen[project.id]) return;
    seen[project.id] = true;
    const mine = here[project.id];
    let action;
    if (!mine) action = "added";
    else if (canonical(mine) === canonical(project)) action = "unchanged";
    else if (Date.parse(project.edited) > Date.parse(mine.edited)) action = "updated";
    else action = "kept";
    plan.push({ action: action, project: project });
  });
  return plan;
}

// Counts for the restore question. Changes nothing.
function previewRestore(current, incoming) {
  const counts = { added: 0, updated: 0, unchanged: 0, kept: 0 };
  restorePlan(current, incoming).forEach(function (step) { counts[step.action]++; });
  return counts;
}

// The project list after a restore: the projects here, in their order, with
// newer copies from the file in their place, then the added ones.
function mergeRestore(current, incoming) {
  const newer = {};
  const added = [];
  restorePlan(current, incoming).forEach(function (step) {
    if (step.action === "updated") newer[step.project.id] = step.project;
    if (step.action === "added") added.push(step.project);
  });
  return current.map(function (project) { return newer[project.id] || project; }).concat(added);
}

// The quiet reminder: 5 or more projects, and either never backed up, or
// edited since the last backup and that backup is 30 or more days old.
function needsBackupReminder(projects, lastBackupAt, now) {
  if (projects.length < REMINDER_PROJECTS) return false;
  const last = typeof lastBackupAt === "string" ? Date.parse(lastBackupAt) : NaN;
  if (isNaN(last)) return true;
  const editedSince = projects.some(function (project) { return Date.parse(project.edited) > last; });
  return editedSince && (now || new Date()).getTime() - last >= REMINDER_DAYS * DAY_MS;
}

const projectBackup = {
  BACKUP_VERSION,
  BACKUP_MAX_LENGTH,
  buildBackup,
  backupFileName,
  readBackup,
  previewRestore,
  mergeRestore,
  needsBackupReminder,
};

if (typeof module !== "undefined") module.exports = projectBackup;
