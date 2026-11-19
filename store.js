// Counter saving, version 2: the saved projects under one versioned key, and a
// safe upgrade from version 1. Pure functions plus a small storage helper. Works
// in the browser (as the global projectStorage) and in Node (through module.exports).
//
// Two rules. A save is never destroyed: version 1's list is read but never
// changed, and broken items are kept in their own list, not dropped. And a
// newer version's save is never overwritten.

const storeProjects = typeof projectStore !== "undefined" ? projectStore : require("./projects.js");

const STORE_VERSION = 2;
// { "version": 2, "projects": [ ... ] }
const STORE_KEY = "counter.v2";
// [{ "raw": the original item, "reason": "short text", "at": "ISO date" }]
const UNREADABLE_KEY = "counter.v2.unreadable";
// Version 1's list. Read once to upgrade, never written or deleted.
const V1_KEY = "counter.projects";

// Storages whose last load found a newer version's save: saving there is refused.
const newerStorages = new WeakSet();

function unreadableEntry(raw, reason, at) {
  return { raw: raw, reason: reason, at: at };
}

// What counter.v2's text holds: "missing", "unreadable" (with a reason), or
// "ok" with the data. Version 2 needs a list of projects; a newer version is
// read as far as it can be, since it's only shown, never written.
function readStoreText(text) {
  if (text === null || text === undefined) return { status: "missing" };
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    return { status: "unreadable", reason: "not valid JSON" };
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return { status: "unreadable", reason: "not an object" };
  if (typeof data.version !== "number" || !isFinite(data.version)) return { status: "unreadable", reason: "no version number" };
  if (data.version < STORE_VERSION || (data.version === STORE_VERSION && !Array.isArray(data.projects))) {
    return { status: "unreadable", reason: data.version === STORE_VERSION ? "projects is not a list" : "unknown version " + data.version };
  }
  return { status: "ok", data: data };
}

// Splits saved items into projects that work and unreadable entries. A project
// that fails the check, or repeats an id already seen, is kept with a reason.
function sortItems(items, at) {
  const projects = [];
  const unreadable = [];
  const seen = Object.create(null);
  items.forEach(function (raw) {
    const project = storeProjects.cleanProject(raw);
    if (!project) {
      unreadable.push(unreadableEntry(raw, "not a working project", at));
    } else if (seen[project.id]) {
      unreadable.push(unreadableEntry(raw, "repeated id " + project.id, at));
    } else {
      seen[project.id] = true;
      projects.push(project);
    }
  });
  return { projects: projects, unreadable: unreadable };
}

// The kept unreadable items. A list that can't be read is never replaced, so
// nothing can be added to it.
function readUnreadable(storage) {
  const text = storage.getItem(UNREADABLE_KEY);
  if (text === null || text === undefined) return { ok: true, list: [] };
  try {
    const list = JSON.parse(text);
    return Array.isArray(list) ? { ok: true, list: list } : { ok: false, list: [] };
  } catch (error) {
    return { ok: false, list: [] };
  }
}

// Adds entries to counter.v2.unreadable after the ones already there. An item
// already kept (the same raw content) isn't added again, so loading the same
// data twice adds nothing.
function keepUnreadable(storage, entries) {
  try {
    const stored = readUnreadable(storage);
    if (!entries.length) return stored;
    if (!stored.ok) return { ok: false, list: entries };
    const kept = {};
    stored.list.forEach(function (entry) { kept[JSON.stringify(entry && entry.raw)] = true; });
    const added = entries.filter(function (entry) {
      const key = JSON.stringify(entry.raw);
      if (kept[key]) return false;
      kept[key] = true;
      return true;
    });
    if (!added.length) return stored;
    const list = stored.list.concat(added);
    storage.setItem(UNREADABLE_KEY, JSON.stringify(list));
    return { ok: true, list: list };
  } catch (error) {
    return { ok: false, list: entries };
  }
}

// The one place counter.v2 is written. It never replaces a newer version's
// save. What it replaces that can't be loaded (unreadable text, broken or
// repeated projects) is kept in counter.v2.unreadable first; if that fails,
// nothing is written.
function writeStore(storage, projects, at) {
  const text = storage.getItem(STORE_KEY);
  const stored = readStoreText(text);
  if (stored.status === "ok" && stored.data.version > STORE_VERSION) {
    newerStorages.add(storage);
    return { ok: false, readOnly: true };
  }
  let replacing = [];
  if (stored.status === "unreadable") replacing = [unreadableEntry(text, stored.reason, at)];
  else if (stored.status === "ok") replacing = sortItems(stored.data.projects, at).unreadable;
  if (!keepUnreadable(storage, replacing).ok) return { ok: false };
  storage.setItem(STORE_KEY, JSON.stringify({ version: STORE_VERSION, projects: projects }));
  return { ok: true };
}

// Loads the saved projects. Returns { ok, projects, unreadable, readOnly, source }:
// ok is false when storage can't be read or a write here fails; unreadable is
// every kept unreadable item; source says which case applied. Never throws.
function loadStore(storage, now) {
  const at = (now || new Date()).toISOString();
  try {
    newerStorages.delete(storage);
    const text = storage.getItem(STORE_KEY);
    const stored = readStoreText(text);

    // a. Version 2: its projects.
    if (stored.status === "ok" && stored.data.version === STORE_VERSION) {
      const sorted = sortItems(stored.data.projects, at);
      const kept = keepUnreadable(storage, sorted.unreadable);
      return { ok: kept.ok, projects: sorted.projects, unreadable: kept.list, readOnly: false, source: "v2" };
    }

    // b. A newer version: shown if its projects pass the check, never written.
    if (stored.status === "ok") {
      newerStorages.add(storage);
      const sorted = sortItems(Array.isArray(stored.data.projects) ? stored.data.projects : [], at);
      const existing = readUnreadable(storage);
      return {
        ok: true, projects: sorted.projects, unreadable: existing.list.concat(sorted.unreadable),
        readOnly: true, source: "newer",
      };
    }

    // c. Version 2 that can't be read: its text is kept, then as d or e.
    const found = stored.status === "unreadable" ? [unreadableEntry(text, stored.reason, at)] : [];

    // d. Only version 1: converted, written as version 2, and left as it was.
    const v1Text = storage.getItem(V1_KEY);
    if (v1Text !== null && v1Text !== undefined) {
      let items = [];
      try {
        const data = JSON.parse(v1Text);
        if (Array.isArray(data)) items = data;
        else found.push(unreadableEntry(v1Text, "version 1 list is not a list", at));
      } catch (error) {
        found.push(unreadableEntry(v1Text, "version 1 list is not valid JSON", at));
      }
      const sorted = sortItems(items, at);
      const kept = keepUnreadable(storage, found.concat(sorted.unreadable));
      let wrote = { ok: false };
      try {
        wrote = writeStore(storage, sorted.projects, at);
      } catch (error) {
        // Storage full or blocked: the projects still show, and saving tries again.
      }
      return { ok: kept.ok && wrote.ok, projects: sorted.projects, unreadable: kept.list, readOnly: false, source: "upgraded" };
    }

    // e. Nothing saved yet.
    const kept = keepUnreadable(storage, found);
    return { ok: kept.ok, projects: [], unreadable: kept.list, readOnly: false, source: "empty" };
  } catch (error) {
    return { ok: false, projects: [], unreadable: [], readOnly: false, source: "error" };
  }
}

// Saves the projects as version 2. Returns { ok }, or { ok: false, readOnly: true }
// when a newer version's save is there (or was, at the last load). Never throws.
function saveStore(storage, projects, now) {
  if (newerStorages.has(storage)) return { ok: false, readOnly: true };
  try {
    return writeStore(storage, projects, (now || new Date()).toISOString());
  } catch (error) {
    return { ok: false };
  }
}

const projectStorage = {
  STORE_VERSION,
  STORE_KEY,
  UNREADABLE_KEY,
  V1_KEY,
  loadStore,
  saveStore,
  // For backup.js: the same checks and the same unreadable list.
  sortItems,
};

if (typeof module !== "undefined") module.exports = projectStorage;
