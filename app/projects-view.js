// Projects

// Where "Back to ..." on the Projects page goes: the calculation you came from.
// After a reload straight onto Projects, that's the unsaved calculation.
let returnState = { screen: "inputs" };

function backTarget() {
  if (returnState.project && !projectStore.findProject(projectList, returnState.project)) {
    return { screen: "inputs" };
  }
  return returnState;
}

function renderBackButton() {
  const project = projectStore.findProject(projectList, backTarget().project);
  byId("back-to-calc-label").textContent = "Back to " + (project ? project.name : "calculator");
}

function openProjects() {
  showScreen("projects");
  renderProjects();
  focusScreen(byId("projects-title"));
}

// Estimate and offer per hour after expenses for a row, from the saved numbers.
// Also the offer's rate and the target in whole cents for the row's bar: no
// bar when there's no estimate, and rateCents is null with no offer.
function projectSummary(project) {
  const raw = Object.assign({}, project.inputs, { quote: project.quote });
  const checked = calc.validateInputs(raw, project.job);
  const blocking = Object.keys(checked.errors).filter(function (name) { return name !== "quote"; });
  const none = { estimate: "No estimate yet", offer: "", hasEstimate: false, rateCents: null, targetCents: null };
  if (blocking.length) return none;
  const r = calc.calculate(checked.values);
  if (!r.hasHours) return none;
  return {
    estimate: calc.formatWholeMoney(r.estimate),
    offer: r.offer ? calc.formatMoney(r.offer.hourlyAfter) + "/hr" : "No offer yet",
    hasEstimate: true,
    rateCents: r.offer ? Math.round(r.offer.hourlyAfter * 100) : null,
    targetCents: Math.round(checked.values.rate * 100),
  };
}

function cell(row, className, text) {
  const td = document.createElement("td");
  td.setAttribute("role", "cell");
  td.className = className;
  if (text) td.textContent = text;
  row.appendChild(td);
  return td;
}

function rowButton(parent, action, text, label, className) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className || "row-action";
  button.dataset.action = action;
  button.textContent = text;
  if (label) button.setAttribute("aria-label", label);
  parent.appendChild(button);
  return button;
}

// rowMode: { id, mode: "rename" | "delete" } for the one row being changed.
let rowMode = null;

// The stage pill that's pressed: "all", "working", "quoted", or "paid". Not
// saved, so a reload shows every stage again.
let stageFilter = "all";

const GROUP_ORDER = ["working", "quoted", "paid"];
const GROUP_NOTES = { working: "client said yes", quoted: "waiting on the client", paid: "with real hours" };
// The small labels before the number and the rate below 1024px.
const NUMBER_LABELS = { working: "Agreed", quoted: "Estimate", paid: "Received" };
const RATE_LABELS = { working: "Pays now", quoted: "Their offer pays", paid: "Really paid" };

// Everything a row shows, from the project and its timeline. hasBar: the row
// draws a bar (every Working and Paid row, and Quoted rows with an estimate).
function listRow(project, now) {
  const timeline = projectTimeline.timelineOf(project);
  // A broken timeline never gets this far (cleanProject); Quoted to be safe.
  const stage = timeline ? timeline.stage : "quoted";
  if (stage === "quoted") {
    const summary = projectSummary(project);
    return {
      project: project, stage: stage,
      number: summary.estimate, rate: summary.offer,
      hasBar: summary.hasEstimate, rateCents: summary.rateCents, targetCents: summary.targetCents,
      date: dashDate(timeline ? timeline.quotedAt : project.created, now),
      canSayYes: summary.hasEstimate && !projectsReadOnly,
    };
  }
  const rateCents = projectTimeline.rateNowCents(project);
  const paid = stage === "paid";
  return {
    project: project, stage: stage,
    number: centsPrice(paid ? timeline.receivedCents : timeline.agreedCents),
    rate: centsMoney(rateCents) + "/hr",
    hasBar: true, rateCents: rateCents, targetCents: timeline.targetCents,
    date: paid
      ? dashDate(timeline.paidAt, now) + " · " + calc.formatNumber(timeline.actualHours) + " of " + calc.formatHours(timeline.plannedHours)
      : dashDate(timeline.workingAt, now),
    canSayYes: false,
  };
}

// The one target every row with a bar shares, or null when they differ (or
// there are none).
function sharedTarget(rows) {
  const targets = rows.filter(function (row) { return row.hasBar; }).map(function (row) { return row.targetCents; });
  if (!targets.length) return null;
  return targets.every(function (target) { return target === targets[0]; }) ? targets[0] : null;
}

// "Target $25" as the bar's label: its place (0 to 1) and its length in
// characters, so CSS can center it over the mark and keep it in the column.
function placeTargetLabel(label, text, share) {
  label.textContent = text;
  label.style.setProperty("--share", share);
  label.style.setProperty("--chars", text.length);
}

// The bar: a track from $0, the fill to the rate, and one mark at the target.
// Hidden from screen readers; the rate is in the text next to it.
function listBar(row, scale, firstLabel) {
  const wrap = make("div", "list-bar list-bar-" + row.stage);
  wrap.setAttribute("aria-hidden", "true");
  if (firstLabel) {
    const label = make("span", "list-bar-label");
    placeTargetLabel(label, firstLabel, projectTimeline.barShare(row.targetCents, scale));
    wrap.appendChild(label);
  }
  const track = make("div", "list-bar-track");
  if (row.rateCents !== null) {
    const fill = make("span", "list-bar-fill");
    fill.style.width = projectTimeline.barShare(row.rateCents, scale) * 100 + "%";
    track.appendChild(fill);
  }
  const mark = make("span", "list-bar-mark");
  mark.style.left = projectTimeline.barShare(row.targetCents, scale) * 100 + "%";
  track.appendChild(mark);
  wrap.appendChild(track);
  return wrap;
}

function renderProjects() {
  const list = projectStore.sortByEdited(projectList);
  const now = new Date();
  show(byId("projects-empty"), list.length === 0);
  show(byId("project-groups"), list.length > 0);
  show(byId("all-projects-title"), list.length > 0);
  renderBackButton();
  renderDashboard(list);
  renderBackupRow();

  const rows = list.map(function (project) { return listRow(project, now); });
  const groups = {};
  GROUP_ORDER.forEach(function (stage) {
    groups[stage] = rows.filter(function (row) { return row.stage === stage; });
  });

  // The pills: only with two or more stages. A stage that ran out of
  // projects (deleted, or moved back) goes back to All.
  const stagesShown = GROUP_ORDER.filter(function (stage) { return groups[stage].length > 0; });
  if (stagesShown.length < 2 || (stageFilter !== "all" && !groups[stageFilter].length)) stageFilter = "all";
  renderStagePills(rows.length, groups, stagesShown.length >= 2);

  // One scale for the whole page, from every project, so the bars don't
  // move when a pill is pressed.
  const barRows = rows.filter(function (row) { return row.hasBar; });
  const rates = barRows.map(function (row) { return row.rateCents; }).filter(function (rate) { return rate !== null; });
  const largestTarget = Math.max.apply(null, [0].concat(barRows.map(function (row) { return row.targetCents; })));
  const scale = projectTimeline.barScaleCents(rates, largestTarget);

  const intro = byId("projects-intro");
  show(intro, barRows.length > 0);
  const pageTarget = sharedTarget(rows);
  intro.textContent = "Every rate is after expenses. The bars start at $0, and the mark is " +
    (pageTarget !== null ? "your " + centsPrice(pageTarget) + " target." : "each project's target.");

  GROUP_ORDER.forEach(function (stage) {
    renderGroup(stage, groups[stage], scale, now);
  });
  renderHeader();
}

function renderStagePills(total, groups, visible) {
  const pills = byId("stage-pills");
  show(pills, visible);
  pills.querySelectorAll("button").forEach(function (button) {
    const filter = button.dataset.filter;
    const count = filter === "all" ? total : groups[filter].length;
    button.querySelector(".stage-pill-count").textContent = count;
    button.setAttribute("aria-pressed", String(filter === stageFilter));
    show(button, count > 0);
  });
}

function renderGroup(stage, rows, scale, now) {
  const section = byId("group-" + stage);
  show(section, rows.length > 0 && (stageFilter === "all" || stageFilter === stage));
  byId("group-" + stage + "-note").textContent = rows.length + " · " + GROUP_NOTES[stage];

  // "Target $25" in the header when every bar in this table has the same
  // target; otherwise each row says its own.
  const target = sharedTarget(rows);
  const headLabel = section.querySelector(".list-bar-head-label");
  if (target !== null) placeTargetLabel(headLabel, "Target " + centsPrice(target), projectTimeline.barShare(target, scale));
  else headLabel.textContent = "";

  const body = section.querySelector("tbody");
  body.textContent = "";
  let labelled = false;
  rows.forEach(function (item) {
    body.appendChild(projectRow(item, scale, target, labelled ? null : target));
    if (item.hasBar) labelled = true;
  });
}

// firstTarget: the shared target for the label above the first bar below
// 1024px, where the column headers are hidden. Null for every other row.
function projectRow(item, scale, tableTarget, firstTarget) {
  const project = item.project;
  const row = document.createElement("tr");
  row.setAttribute("role", "row");
  row.dataset.id = project.id;
  const mode = rowMode && rowMode.id === project.id ? rowMode.mode : null;

  const nameCell = document.createElement("th");
  nameCell.scope = "row";
  nameCell.setAttribute("role", "rowheader");
  nameCell.className = "project-name";
  row.appendChild(nameCell);
  if (mode === "rename") {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "row-rename";
    input.maxLength = projectStore.NAME_MAX;
    input.value = project.name;
    input.setAttribute("aria-label", "Project name");
    nameCell.appendChild(input);
  } else {
    rowButton(nameCell, "open", project.name, null, "project-open");
  }

  cell(row, "project-job", calc.JOBS[project.job].name);

  const number = cell(row, "project-number");
  number.append(make("span", "list-label", NUMBER_LABELS[item.stage]), make("span", "list-number", item.number));
  number.firstChild.setAttribute("aria-hidden", "true");

  const rate = cell(row, "project-rate");
  if (item.rate) {
    rate.append(make("span", "list-label", RATE_LABELS[item.stage]), make("span", "list-rate", item.rate));
    rate.firstChild.setAttribute("aria-hidden", "true");
  }
  if (item.hasBar && tableTarget === null) rate.appendChild(make("span", "list-target", "Target " + centsPrice(item.targetCents)));

  const bar = cell(row, "project-bar");
  if (item.hasBar) bar.appendChild(listBar(item, scale, firstTarget !== null ? "Target " + centsPrice(firstTarget) : null));

  // On phones the job shows here, "Menu · Nov 21", from a copy hidden from
  // screen readers; the job cell stays for them.
  const date = cell(row, "project-date");
  const job = make("span", "list-job", calc.JOBS[project.job].name + " · ");
  job.setAttribute("aria-hidden", "true");
  date.append(job, item.date);
  if (item.canSayYes) {
    date.append(" · ");
    rowButton(date, "said-yes", "They said yes", "They said yes to " + project.name, "said-yes");
  }

  const actions = cell(row, "project-actions");
  if (mode === "delete") {
    const question = document.createElement("span");
    question.className = "delete-question";
    question.textContent = "Delete " + project.name + "? This can't be undone.";
    actions.appendChild(question);
    rowButton(actions, "confirm-delete", "Delete", null, "action-button");
    rowButton(actions, "cancel-delete", "Cancel", null, "action-button outline");
  } else {
    rowButton(actions, "edit", "Edit", "Edit " + project.name);
    rowButton(actions, "rename", "Rename", "Rename " + project.name);
    rowButton(actions, "duplicate", "Duplicate", "Duplicate " + project.name);
    rowButton(actions, "delete", "Delete", "Delete " + project.name);
  }
  return row;
}

// A stage pill: show only that stage, or every stage for All.
function onStagePill(event) {
  const button = event.target.closest("button[data-filter]");
  if (!button) return;
  stageFilter = button.dataset.filter;
  renderProjects();
}

// Backup (backup.js): download the projects as a file, or restore one.

const STORAGE_NOTE = "Projects save in this browser on this device.";
const BACKUP_REMINDER = "Your projects are only in this browser. Download a backup so you don't lose them.";
const RESTORE_REFUSALS = {
  "not-json": "This file isn't a Counter backup.",
  "not-counter": "This file isn't a Counter backup.",
  "unknown-version": "This file isn't a Counter backup.",
  newer: "This backup is from a newer version of Counter. Reload the page and try again.",
  "too-big": "This file is too big to be a Counter backup.",
};
// The checked file waiting for Restore.
let pendingBackup = null;

function plural(count, one, many) {
  return count + " " + (count === 1 ? one : many);
}

// The note under the list, or the reminder in its place; the buttons only
// when there's something to back up (the empty screen has its own Restore).
function renderBackupRow() {
  const now = new Date();
  const reminder = projectBackup.needsBackupReminder(projectList, projectBackup.loadLastBackup(storage()), now);
  byId("storage-note").textContent = reminder ? BACKUP_REMINDER : STORAGE_NOTE;
  byId("storage-note").classList.toggle("reminder", reminder);
  show(byId("backup-actions"), projectList.length > 0);
}

function downloadBackup() {
  const now = new Date();
  let unreadable = [];
  try {
    unreadable = projectStorage.readUnreadable(storage()).list;
  } catch (error) {
    // Storage can't be read: the projects on screen still go in the file.
  }
  try {
    const blob = new Blob([projectBackup.buildBackup(projectList, unreadable, now)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = projectBackup.backupFileName(now);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  } catch (error) {
    return;
  }
  projectBackup.saveLastBackup(storage(), now);
  announce("Backup downloaded");
  renderBackupRow();
}

// One dialog, three states: the preview (Restore and Cancel), or a message
// with only Close.
function showRestoreDialog(question, text, unreadable, canRestore, opener) {
  byId("restore-question").textContent = question;
  byId("restore-text").textContent = text;
  show(byId("restore-text"), Boolean(text));
  byId("restore-unreadable").textContent = unreadable;
  show(byId("restore-unreadable"), Boolean(unreadable));
  show(byId("restore-yes"), canRestore);
  show(byId("restore-cancel"), canRestore);
  show(byId("restore-close"), !canRestore);
  openDialog("restore-panel", opener);
  // Like the start-over question, focus opens on the safe choice.
  byId(canRestore ? "restore-cancel" : "restore-close").focus({ preventScroll: true });
}

// Restore from backup: the file picker, or in read-only mode the reason it
// can't work until a reload.
function startRestore(event) {
  const opener = event.currentTarget;
  if (projectsReadOnly) {
    showRestoreDialog(byId("newer-version").textContent, "", "", false, opener);
    return;
  }
  restoreOpener = opener;
  byId("backup-file").click();
}
let restoreOpener = null;

// "12 projects in this backup: 3 new, 2 updated with newer changes, 7 already up to date."
function restoreSummary(counts) {
  const upToDate = counts.unchanged + counts.kept;
  const total = counts.added + counts.updated + upToDate;
  if (!total) return "No projects in this backup.";
  const head = plural(total, "project", "projects") + " in this backup";
  if (!counts.added && !counts.updated) return head + (total === 1 ? ", already up to date." : ", all already up to date.");
  const parts = [];
  if (counts.added) parts.push(counts.added + " new");
  if (counts.updated) parts.push(counts.updated + " updated with newer changes");
  if (upToDate) parts.push(upToDate + " already up to date");
  return head + ": " + parts.join(", ") + ".";
}

function unreadableSentence(count) {
  if (!count) return "";
  return count === 1 ? "1 item in this file can't be read. It'll be kept aside, not restored."
    : count + " items in this file can't be read. They'll be kept aside, not restored.";
}

// A file was picked: check it and show what Restore would do. The file is
// only read as text and parsed as JSON.
function onBackupFile() {
  const input = byId("backup-file");
  const file = input.files && input.files[0];
  const opener = restoreOpener;
  input.value = "";
  if (!file) return;
  if (file.size > projectBackup.BACKUP_MAX_LENGTH) {
    showRestoreDialog(RESTORE_REFUSALS["too-big"], "", "", false, opener);
    return;
  }
  file.text().then(function (text) {
    const backup = projectBackup.readBackup(text);
    if (!backup.ok) {
      showRestoreDialog(RESTORE_REFUSALS[backup.reason], "", "", false, opener);
      return;
    }
    const counts = projectBackup.previewRestore(projectList, backup.projects);
    const unreadable = unreadableSentence(backup.unreadable.length);
    if (!counts.added && !counts.updated) {
      showRestoreDialog(restoreSummary(counts), "", unreadable, false, opener);
      return;
    }
    showRestoreDialog("Restore from this backup?", restoreSummary(counts), unreadable, true, opener);
    pendingBackup = backup;
  }, function () {
    showRestoreDialog(RESTORE_REFUSALS["not-json"], "", "", false, opener);
  });
}

// Restore: merge, save through saveStore, then show the list. Focus goes back
// to the button that opened it, or to the heading if that button is gone (the
// empty screen's Restore).
function confirmRestore() {
  const backup = pendingBackup;
  const opener = dialogOpener;
  if (!backup) return;
  const result = projectBackup.restoreBackup(storage(), projectList, backup);
  if (!result.ok) {
    if (result.readOnly) {
      projectsReadOnly = true;
      show(byId("newer-version"), true);
      showRestoreDialog(byId("newer-version").textContent, "", "", false, opener);
    } else {
      showRestoreDialog("Couldn't restore this backup. Nothing was changed.", "", "", false, opener);
    }
    renderHeader();
    return;
  }
  closePanels();
  projectList = result.projects;
  projectsUnsaved = false;
  showSaveResult(true);
  renderProjects();
  const changed = result.counts.added + result.counts.updated;
  const parts = [];
  if (result.counts.added) parts.push(result.counts.added + " new");
  if (result.counts.updated) parts.push(result.counts.updated + " updated");
  announce("Restored " + plural(changed, "project", "projects") + ": " + parts.join(", ") + ".");
  if (opener && opener.isConnected && !opener.closest("[hidden]")) opener.focus({ preventScroll: true });
  else byId("projects-title").focus({ preventScroll: true });
}

function rowElement(id, selector) {
  const row = byId("project-groups").querySelector('tr[data-id="' + CSS.escape(id) + '"]');
  return row ? row.querySelector(selector) : null;
}

function setRowMode(mode) {
  rowMode = mode;
  renderProjects();
}

function finishRowRename(id, save) {
  if (!rowMode || rowMode.id !== id || rowMode.mode !== "rename") return;
  if (save) {
    const before = projectList;
    projectList = projectStore.renameProject(projectList, id, rowElement(id, ".row-rename").value, new Date());
    if (projectList !== before) persist();
  }
  setRowMode(null);
  rowElement(id, ".project-open").focus();
}

function onRowClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const id = button.closest("tr").dataset.id;
  const action = button.dataset.action;

  if (action === "open") {
    // A saved project opens on its result.
    go({ screen: "results", project: id });
  } else if (action === "edit") {
    // Edit opens the same project on its inputs.
    go({ screen: "inputs", project: id });
  } else if (action === "rename") {
    setRowMode({ id: id, mode: "rename" });
    const input = rowElement(id, ".row-rename");
    input.focus();
    input.select();
  } else if (action === "said-yes") {
    // Opens the result with "They said yes" open (sayYesOnOpen, in route).
    sayYesOnOpen = true;
    go({ screen: "results", project: id });
  } else if (action === "duplicate") {
    const copyId = projectStore.newProjectId();
    projectList = projectStore.duplicateProject(projectList, id, copyId, new Date());
    persist();
    // The copy starts Quoted; if the pressed pill would hide it, show All.
    const copy = projectStore.findProject(projectList, copyId);
    const copyTimeline = copy ? projectTimeline.timelineOf(copy) : null;
    const copyStage = copyTimeline ? copyTimeline.stage : "quoted";
    if (stageFilter !== "all" && stageFilter !== copyStage) stageFilter = "all";
    setRowMode(null);
    rowElement(copyId, ".project-open").focus();
  } else if (action === "delete") {
    setRowMode({ id: id, mode: "delete" });
    rowElement(id, '[data-action="cancel-delete"]').focus();
  } else if (action === "cancel-delete") {
    setRowMode(null);
    rowElement(id, '[data-action="delete"]').focus();
  } else if (action === "confirm-delete") {
    // Focus moves to the next row's name on the page, or the previous one, or
    // New calculation. Rows in a section the pills hide don't count, unless
    // this was the last row showing: then the stage empties, the list goes
    // back to All, and every row shows again.
    const row = button.closest("tr");
    const all = Array.prototype.slice.call(byId("project-groups").querySelectorAll("tbody tr"));
    const showing = all.filter(function (item) { return !item.closest("[hidden]"); });
    function around(rows) {
      const index = rows.indexOf(row);
      return rows[index + 1] || rows[index - 1];
    }
    const neighbor = around(showing) || around(all);
    const nextId = neighbor ? neighbor.dataset.id : null;
    projectList = projectStore.deleteProject(projectList, id);
    persist();
    setRowMode(null);
    if (nextId) rowElement(nextId, ".project-open").focus();
    else byId("new-calc-empty").focus();
  }
}

function onRowKey(event) {
  if (!event.target.classList.contains("row-rename")) return;
  const id = event.target.closest("tr").dataset.id;
  if (event.key === "Enter") {
    event.preventDefault();
    finishRowRename(id, true);
  } else if (event.key === "Escape") {
    finishRowRename(id, false);
  }
}

// Your pricing so far: the Projects dashboard and the summary card on a saved
// result. All after expenses, like Ways to close the gap. The numbers come from
// projectStore.pricingSummary, each job rounded to whole dollars first.

const MINUS = "−";

// "$2,508", "−$5"
function dashMoney(amount) {
  return amount < 0 ? MINUS + calc.formatWholeMoney(-amount) : calc.formatWholeMoney(amount);
}

// "−$840", "+$60"
function signedMoney(amount) {
  return amount > 0 ? "+" + calc.formatWholeMoney(amount) : dashMoney(amount);
}

// "$20.00/hr", "−$0.50/hr"
function dashHourly(amount) {
  const text = calc.formatMoney(Math.abs(amount)) + "/hr";
  return amount < 0 && Math.abs(amount) >= 0.005 ? MINUS + text : text;
}

// "$20.00", "−$0.50"
function dashCents(amount) {
  const text = calc.formatMoney(Math.abs(amount));
  return amount < 0 && Math.abs(amount) >= 0.005 ? MINUS + text : text;
}

// A whole-dollar target shows no cents: "$55/hr", "$27.50/hr".
function targetHourly(rate) {
  return calc.formatPrice(rate) + "/hr";
}

function jobsText(count) {
  return count + (count === 1 ? " job" : " jobs");
}

function percentText(share) {
  return Math.round(share * 100) + "%";
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

// Hours to one decimal, so paid and unpaid add up to the total shown.
function tenths(hours) {
  return Math.round(hours * 10) / 10;
}

// "Oct 7", or "Oct 7, 2025" when it isn't this year.
function dashDate(iso, now) {
  const date = new Date(iso);
  const text = MONTHS[date.getMonth()] + " " + date.getDate();
  return date.getFullYear() === now.getFullYear() ? text : text + ", " + date.getFullYear();
}

function make(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text != null) element.textContent = text;
  return element;
}

// "Show as table" choices, kept across re-renders.
let waterfallAsTable = false;
let bulletAsTable = false;

// "Fix [project]": a one-time flag, never in history, so Back, Forward, and
// reload don't jump to the gap again.
let landOnGap = false;

// "They said yes" on a Quoted row: a one-time flag like landOnGap.
let sayYesOnOpen = false;

function renderDashboard(list) {
  const s = projectStore.pricingSummary(list);
  show(byId("dashboard"), Boolean(s));
  show(byId("dashboard-empty"), !s && list.length > 0);
  if (!s) return;
  const now = new Date();
  renderDashHero(s, now);
  renderWaterfall(s);
  renderUnpaid(s);
  renderMet(s);
  renderFix(s);
  renderBullets(s);
}

function renderDashHero(s, now) {
  const percent = percentText(s.percent);
  const lead = byId("dash-lead");
  lead.textContent = "";
  if (s.kept >= s.targetPay) {
    lead.textContent = "You kept " + percent + " of your target pay. Your offers covered every hour.";
  } else {
    // "left to right" next to the chart, "down" when it's rows.
    lead.append("You kept " + percent + " of your target pay. Read ",
      make("span", "wide-only", "left to right"), make("span", "narrow-only", "down"),
      " to see where the other " + dashMoney(s.shortfall) + " went.");
  }
  const fix = s.biggestFix;
  let gapLine = "";
  if (s.shortfall > 0 && s.gapShare !== null) gapLine = fix.name + " is " + percentText(s.gapShare) + " of the gap.";
  else if (s.shortfall > 0 && fix) gapLine = "All of it came from " + fix.name + ".";
  byId("dash-gapline").textContent = gapLine;
  show(byId("dash-gapline"), Boolean(gapLine));

  const first = dashDate(s.firstCreated, now);
  const last = dashDate(s.lastCreated, now);
  byId("dash-meta").textContent = jobsText(s.counted) + " · " + (first === last ? first : first + " to " + last) + " · after expenses";
  const based = byId("dash-based");
  show(based, s.counted < s.total);
  based.textContent = "Based on " + s.counted + " of " + s.total + " projects. The rest need an offer or hours.";
  byId("dash-percent").textContent = percent;
}

// The waterfall's bars: target pay, one step per job (or "Other jobs"), you kept.
function waterfallBars(s) {
  const bars = [{ kind: "total", name: "Target pay", note: "your hours at target", from: 0, to: s.targetPay, value: dashMoney(s.targetPay) }];
  let level = s.targetPay;
  function step(name, amount, note) {
    bars.push({ kind: amount < 0 ? "short" : "gain", name: name, note: note, from: level, to: level + amount, value: signedMoney(amount) });
    level += amount;
  }
  s.steps.forEach(function (job) { step(job.name, job.step, job.step < 0 ? "short of target" : "over target"); });
  if (s.other) step("Other jobs (" + s.other.count + ")", s.other.step, "net of " + jobsText(s.other.count));
  bars.push({ kind: "kept", name: "You kept", note: "after expenses", from: 0, to: s.kept, value: dashMoney(s.kept) });
  return bars;
}

function renderWaterfall(s) {
  const bars = waterfallBars(s);
  // One scale: $0 and every running total.
  const levels = [0];
  bars.forEach(function (bar) { levels.push(bar.from, bar.to); });
  const low = Math.min.apply(null, levels);
  const high = Math.max.apply(null, levels);
  const range = high - low || 1;
  function at(value) { return (value - low) / range * 100; }

  const chart = byId("waterfall");
  chart.textContent = "";

  // Desktop: columns, with dashed connectors and a $0 baseline.
  const cols = make("div", "wf-cols");
  cols.style.setProperty("--wf-count", bars.length);
  const plot = make("div", "wf-plot");
  const baseline = make("span", "wf-baseline");
  baseline.style.bottom = at(0) + "%";
  plot.appendChild(baseline);
  bars.forEach(function (bar, i) {
    const column = make("div", "wf-col");
    column.style.gridColumn = String(i + 1);
    const top = Math.max(bar.from, bar.to);
    const bottom = Math.min(bar.from, bar.to);
    const shape = make("span", "wf-bar " + bar.kind);
    shape.style.bottom = at(bottom) + "%";
    shape.style.height = (at(top) - at(bottom)) + "%";
    column.appendChild(shape);
    const value = make("span", "wf-value" + (bar.kind === "total" || bar.kind === "kept" ? " total" : ""), bar.value);
    value.style.bottom = at(top) + "%";
    column.appendChild(value);
    if (i < bars.length - 1) {
      const link = make("span", "wf-link");
      link.style.bottom = at(bar.to) + "%";
      column.appendChild(link);
    }
    plot.appendChild(column);
  });
  cols.appendChild(plot);
  const labels = make("div", "wf-labels");
  bars.forEach(function (bar) {
    const label = make("div", "wf-label");
    const name = make("span", "wf-name", bar.name);
    name.title = bar.name;
    label.append(name, make("span", "wf-note", bar.note));
    labels.appendChild(label);
  });
  cols.appendChild(labels);
  chart.appendChild(cols);

  // Below 1024px: the same steps as rows.
  const rows = make("div", "wf-rows");
  bars.forEach(function (bar) {
    const row = make("div", "wf-row " + bar.kind);
    const line = make("p", "wf-row-line");
    const name = make("span", "wf-name", bar.name);
    name.title = bar.name;
    line.append(name, make("span", "wf-row-value", bar.value));
    const track = make("div", "wf-track");
    const shape = make("span", "wf-bar " + bar.kind);
    const left = at(Math.min(bar.from, bar.to));
    shape.style.left = left + "%";
    shape.style.width = (at(Math.max(bar.from, bar.to)) - left) + "%";
    track.appendChild(shape);
    row.append(line, track);
    rows.appendChild(row);
  });
  chart.appendChild(rows);

  // The written summary and the table.
  byId("waterfall-summary").textContent = bars.map(function (bar) {
    if (bar.kind === "total") return "Target pay " + bar.value + ".";
    if (bar.kind === "kept") return "You kept " + bar.value + ".";
    const amount = dashMoney(Math.abs(bar.to - bar.from));
    return bar.name + (bar.kind === "short" ? " short " : " over ") + amount + ".";
  }).join(" ");
  const body = byId("waterfall-rows");
  body.textContent = "";
  bars.forEach(function (bar) {
    const row = document.createElement("tr");
    const name = make("th", null, bar.name);
    name.scope = "row";
    row.append(name, make("td", null, bar.value));
    body.appendChild(row);
  });
  applyTableToggle("waterfall-toggle", byId("waterfall"), byId("waterfall-table"), waterfallAsTable);
}

function applyTableToggle(buttonId, chart, table, asTable) {
  show(chart, !asTable);
  show(table, asTable);
  byId(buttonId).textContent = asTable ? "Show as chart" : "Show as table";
}

function renderUnpaid(s) {
  const unpaid = tenths(s.unpaidHours);
  const paid = tenths(s.hours) - unpaid;
  byId("dash-unpaid").textContent = calc.formatNumber(unpaid);
  byId("dash-unpaid-line").textContent = projectStore.unpaidLine(s.unpaidHours, s.hours);
  setBar(byId("dash-paid-bar"), paid);
  setBar(byId("dash-unpaid-bar"), unpaid);
  byId("dash-paid-hours").textContent = calc.formatHours(paid);
  byId("dash-unpaid-hours").textContent = calc.formatHours(unpaid);
}

// A part of a split bar; parts with nothing in them are left out, so no
// stray 2px gap shows.
function setBar(element, amount) {
  element.style.flexGrow = Math.max(0, amount);
  show(element, amount > 0);
}

function renderMet(s) {
  byId("dash-met").textContent = s.met;
  byId("dash-met-of").textContent = "of " + s.counted;
  let line;
  if (s.met === s.counted) line = "Every job paid what you asked for.";
  else if (s.met === 0) line = "No job paid what you asked for yet.";
  else if (s.met === 1) line = "Only " + s.jobs.filter(function (job) { return job.metTarget; })[0].name + " paid what you asked for.";
  else line = jobsText(s.met) + " paid what you asked for.";
  byId("dash-met-line").textContent = line;

  const list = byId("met-list");
  list.textContent = "";
  s.byPercent.slice(0, 5).forEach(function (job) {
    const item = make("li", "met-row");
    const name = make("span", "met-name", job.name);
    name.title = job.name;
    const status = make("span", "met-status", job.metTarget ? "met" : "missed");
    status.appendChild(make("span", "met-dot " + (job.metTarget ? "dash-paid" : "dash-short")));
    item.append(name, status);
    list.appendChild(item);
  });
  if (s.byPercent.length > 5) list.appendChild(make("li", "met-row met-more", "+ " + (s.byPercent.length - 5) + " more"));
}

function renderFix(s) {
  const fix = s.biggestFix;
  show(byId("dash-fix-amount"), Boolean(fix));
  show(byId("fix-chart"), Boolean(fix));
  show(byId("fix-button"), Boolean(fix));
  if (!fix) {
    byId("dash-fix-line").textContent = "Every job met your target.";
    return;
  }
  byId("dash-fix-amount").textContent = signedMoney(-fix.step);
  byId("dash-fix-line").textContent = "Price " + fix.name + " at your target and you go from " +
    percentText(s.percent) + " to " + percentText(s.withFixPercent) + " of your target pay.";
  const now = clamp01(s.percent);
  const withFix = clamp01(s.withFixPercent);
  byId("fix-now-bar").style.width = now * 100 + "%";
  byId("fix-added-bar").style.width = (withFix - now) * 100 + "%";
  byId("fix-track-bar").style.width = (1 - withFix) * 100 + "%";
  show(byId("fix-added-bar"), withFix > now);
  byId("fix-labels").style.width = withFix * 100 + "%";
  byId("fix-now-label").textContent = "now " + percentText(s.percent);
  byId("fix-with-label").textContent = "with fix " + percentText(s.withFixPercent);
  byId("fix-button").textContent = "Fix " + fix.name;
  byId("fix-button").dataset.id = fix.id;
}

// Each job vs its target: 0% to 150%, lowest first.
const BULLET_MAX = 1.5;

function renderBullets(s) {
  const rows = byId("bullet-rows");
  rows.textContent = "";
  const head = make("div", "bullet-grid bullet-head");
  head.setAttribute("aria-hidden", "true");
  const headTrack = make("div", "bullet-track");
  headTrack.appendChild(make("span", "bullet-target-label", "your target"));
  head.appendChild(headTrack);
  rows.appendChild(head);

  const summary = [];
  s.byPercent.forEach(function (job) {
    const row = make("div", "bullet-grid bullet-row");
    row.dataset.id = job.id;
    row.setAttribute("aria-hidden", "true");
    const name = make("p", "bullet-name", job.name);
    name.title = job.name;
    const below = job.percent < 0;
    const value = make("p", "bullet-value", below ? "below expenses" : percentText(job.percent));
    const rate = make("p", "bullet-rate", dashCents(job.hourlyAfter) + " of " + targetHourly(job.rate));
    const track = make("div", "bullet-track");
    const bar = make("div", "bullet-bar");
    const paid = make("span", "dash-paid");
    paid.style.width = Math.max(0, Math.min(job.percent, BULLET_MAX)) / BULLET_MAX * 100 + "%";
    const short = make("span", "dash-short");
    short.style.width = (1 - clamp01(job.percent)) / BULLET_MAX * 100 + "%";
    show(paid, job.percent > 0);
    show(short, job.percent < 1);
    bar.append(paid, short);
    track.appendChild(bar);
    row.append(name, track, value, rate);
    rows.appendChild(row);
    summary.push(job.name + (below ? " pays below expenses, " : " pays " + percentText(job.percent) + " of its target, ") +
      dashCents(job.hourlyAfter) + " of " + targetHourly(job.rate) + ".");
  });
  const tip = make("div", "bullet-tip");
  tip.id = "bullet-tip";
  tip.setAttribute("aria-hidden", "true");
  tip.hidden = true;
  rows.appendChild(tip);
  byId("bullet-summary").textContent = "Real pay per hour after expenses as a share of each target, lowest first. " + summary.join(" ");

  const body = byId("bullet-table-rows");
  body.textContent = "";
  s.byPercent.forEach(function (job) {
    const row = document.createElement("tr");
    const name = make("th", null, job.name);
    name.scope = "row";
    row.append(name,
      make("td", null, dashHourly(job.hourlyAfter)),
      make("td", null, targetHourly(job.rate)),
      make("td", null, job.percent < 0 ? "below expenses" : percentText(job.percent)),
      make("td", null, calc.formatPrice(job.offer)),
      make("td", null, calc.formatHours(job.hours)),
      make("td", null, calc.formatHours(tenths(job.unpaidHours))));
    body.appendChild(row);
  });
  applyTableToggle("bullet-toggle", byId("bullet-chart"), byId("bullet-table"), bulletAsTable);
}

// The tooltip: in the empty space right of the target line, never over the values.
const bulletHover = window.matchMedia("(min-width: 1024px) and (hover: hover)");

function showBulletTip(row) {
  const tip = byId("bullet-tip");
  if (!tip) return;
  if (!row || !bulletHover.matches) {
    tip.hidden = true;
    return;
  }
  const job = projectStore.pricingSummary(projectStore.sortByEdited(projectList)).jobs
    .filter(function (item) { return item.id === row.dataset.id; })[0];
  if (!job) return;
  tip.textContent = "";
  tip.append(make("span", "bullet-tip-name", job.name),
    make("span", "bullet-tip-line", "Offer " + calc.formatPrice(job.offer) + " · " + calc.formatHours(job.hours)),
    make("span", "bullet-tip-line", calc.formatHours(tenths(job.unpaidHours)) + " unpaid"));
  const track = row.querySelector(".bullet-track");
  const left = track.offsetLeft + track.offsetWidth / BULLET_MAX + 12;
  tip.style.left = left + "px";
  tip.style.maxWidth = (track.offsetLeft + track.offsetWidth - left) + "px";
  tip.hidden = false;
  tip.style.top = (row.offsetTop + row.offsetHeight / 2 - tip.offsetHeight / 2) + "px";
}

// The summary card on a saved project's result: 2 or more projects count.
function renderPricingCard() {
  const card = byId("pricing-card");
  const s = currentId ? projectStore.pricingSummary(projectList) : null;
  show(card, Boolean(s) && s.counted >= 2);
  if (card.hidden) return;
  byId("pricing-card-percent").textContent = percentText(s.percent);
  byId("pricing-card-text").textContent = "of your target pay, across " + jobsText(s.counted);
  const kept = clamp01(s.percent);
  setBar(byId("pricing-card-kept-bar"), kept);
  setBar(byId("pricing-card-short-bar"), 1 - kept);
  byId("pricing-card-kept").textContent = dashMoney(s.kept) + " kept";
  byId("pricing-card-short").textContent = s.kept >= s.targetPay ? "nothing short" : dashMoney(s.shortfall) + " short";
}

// After "Fix [project]" opens screen 2: go to its Ways to close the gap.
function landOnGapSection() {
  if (!landOnGap) return;
  landOnGap = false;
  const section = byId("gap-section");
  if (section.hidden) return;
  section.scrollIntoView({ behavior: reduceMotion.matches ? "instant" : "smooth", block: "start" });
  byId("gap-heading").focus({ preventScroll: true });
}

// After "They said yes" on a row opens screen 2: open the same dialog the
// stage bar opens, if the project is still Quoted. Cancel or Escape returns
// focus to the stage bar's "They said yes".
function openSayYesFromRow() {
  if (!sayYesOnOpen) return;
  sayYesOnOpen = false;
  const timeline = currentTimeline();
  if (!timeline || timeline.stage !== "quoted" || projectsReadOnly) return;
  openWorkingDialog(byId("stage-forward"));
}

// "Check the offer": with errors, go to the first one. Otherwise show the result
// and move focus to its first line, so screen readers announce it.
function checkOffer() {
  if (document.body.classList.contains("revealing")) return;
  clearTimeout(commitTimer);
  update(true);
  const firstError = Object.keys(FIELD_IDS).filter(function (name) {
    return name !== "quote" && shownErrors[name];
  })[0];
  if (firstError) {
    byId(FIELD_IDS[firstError]).focus();
    return;
  }
  // 0 hours: nothing to show yet, so stay here and ask for hours.
  if (lastHours && !(lastHours.total > 0)) {
    showWorkError(true);
    byId("setup-hours").focus();
    return;
  }
  // fromInputs: Back from here returns to screen 1 of the same calculation.
  const state = { screen: "results", project: currentId || undefined, fromInputs: true };
  history.pushState(state, "", addressFor(state));
  revealResults();
}

// "Add at least one hour of work." under 02 The work, linked to the first hours field.
function showWorkError(visible) {
  const error = byId("work-error");
  show(error, visible);
  const field = byId("setup-hours");
  const ids = (field.getAttribute("aria-describedby") || "").split(" ")
    .filter(function (id) { return id && id !== "work-error"; });
  if (visible) ids.push("work-error");
  if (ids.length) field.setAttribute("aria-describedby", ids.join(" "));
  else field.removeAttribute("aria-describedby");
}

