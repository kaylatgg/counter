// Screens: the calculator (screen 1 and screen 2) and the projects list.
// One at a time, no reload. The calculator holds either the unsaved draft or
// one saved project (currentId).

const SCREENS = { projects: "screen-projects", inputs: "screen-inputs", results: "result" };

function showScreen(name) {
  Object.keys(SCREENS).forEach(function (key) {
    byId(SCREENS[key]).hidden = key !== name;
    document.body.classList.toggle("on-" + key, key === name);
  });
  byId("skip-link").hidden = name !== "inputs";
  renderHeader();
  window.scrollTo(0, 0);
}

function currentScreen() {
  return Object.keys(SCREENS).filter(function (key) { return !byId(SCREENS[key]).hidden; })[0];
}

// Switching screens moves focus to the new screen's start, so screen readers
// announce it. Not on first load: then focus stays at the top of the page, so
// the first Tab reaches the skip link and the header.
let firstLoad = true;

function focusScreen(element) {
  if (!firstLoad) element.focus();
}

// The browser's Back button goes from results to inputs, with every value kept.
// Showing the results adds a history step; Back (or "Edit details") removes it.
// quiet: leave focus where it is (a shared link opening on page load).
function openResults(quiet) {
  showScreen("results");
  relayoutCharts();
  // Each block plays once as it scrolls in (see "Plays once"). During the
  // reveal, plays start when the orb lands.
  armPlays();
  if (!document.body.classList.contains("revealing")) startPlays();
  // The project hero's label when it shows, otherwise the hero's (app/stages.js).
  const target = heroFocusTarget();
  if (target && !quiet) focusScreen(target);
}

function openInputs() {
  showScreen("inputs");
  // Screen 1 was hidden while a project loaded, so its pill row scrolls now.
  showSelectedJobPill();
  // The tally measures its width, so it draws once screen 1 is showing.
  relayoutCharts();
  focusScreen(byId("page-title"));
}

// Routes: every screen has an address, so Back works and a reload lands in the
// same place. { screen, project } where project is an id, or none for the draft.
function addressFor(state) {
  if (state.screen === "projects") return "#projects";
  if (state.project) return "#p/" + state.project + (state.screen === "results" ? "/result" : "");
  return state.screen === "results" ? "#result" : location.pathname + location.search;
}

function stateFromAddress(hash) {
  const match = /^#p\/([^/]+)(\/result)?$/.exec(hash);
  if (match) return { screen: match[2] ? "results" : "inputs", project: decodeURIComponent(match[1]) };
  if (hash === "#projects") return { screen: "projects" };
  if (hash === "#result") return { screen: "results" };
  return { screen: "inputs" };
}

function go(state, replace) {
  history[replace ? "replaceState" : "pushState"](state, "", addressFor(state));
  route(state);
}

function route(state) {
  // Leaving mid-reveal (Back, or a link) stops it, so it can't open screen 2 later.
  cancelReveal();
  closePanels();
  if (state.screen === "projects") {
    // Remember the calculation and screen we came from, for "Back to ...".
    const from = currentScreen();
    if (from === "inputs" || from === "results") returnState = { screen: from, project: currentId || undefined };
    leaveProject();
    openProjects();
    return;
  }
  if (state.project) {
    if (!projectStore.findProject(projectList, state.project)) {
      go({ screen: "inputs" }, true);
      return;
    }
    if (state.project !== currentId) openProject(state.project);
  } else if (currentId || !draftOnScreen) {
    openDraft();
  }
  if (state.screen === "results") {
    openResults();
    landOnGapSection();
    openSayYesFromRow();
  } else {
    openInputs();
  }
}

window.addEventListener("popstate", function (event) {
  if (shareLink.isShareHash(location.hash)) {
    openShareLink(location.hash, false);
    return;
  }
  route(event.state || stateFromAddress(location.hash));
});

// Saving. Projects live in one list; the unsaved calculation is a draft under
// its own key, so a refresh doesn't lose it and it never overwrites a project.

let projectList = [];
let currentId = null;
let draft = null;
// True when the calculator holds the draft (not a project, and not stale).
let draftOnScreen = false;
let lastSaved = null;
let loadingValues = false;

// localStorage itself can throw (blocked storage), so it's reached through this.
function storage() {
  try {
    return window.localStorage;
  } catch (error) {
    return { getItem: function () { throw error; }, setItem: function () { throw error; } };
  }
}

// If saving fails, the page keeps working and says so: "Couldn't save" under
// the header, and in a project "Not saved" with a "Try again" button.
let projectsUnsaved = false;
// True when a newer version of Counter saved the projects: they show, but saving
// them is refused until a reload (store.js). The draft still saves.
let projectsReadOnly = false;

function showSaveResult(ok) {
  show(byId("save-error"), !ok);
  return ok;
}

function persist() {
  const result = projectStorage.saveStore(storage(), projectList);
  // A refused save says so in the newer-version line, not "Couldn't save".
  if (result.readOnly) projectsReadOnly = true;
  else showSaveResult(result.ok);
  show(byId("newer-version"), projectsReadOnly);
  const ok = result.ok;
  projectsUnsaved = !ok;
  renderHeader();
  return ok;
}

function persistDraft() {
  return showSaveResult(projectStore.saveDraft(storage(), draft).ok);
}

function currentProject() {
  return projectStore.findProject(projectList, currentId);
}

// Everything a calculation keeps from the page.
function snapshot() {
  const raw = readForm();
  const inputs = {};
  projectStore.INPUT_NAMES.forEach(function (name) { inputs[name] = raw[name]; });
  return {
    field: currentField(),
    job: currentJob(),
    inputs: inputs,
    quote: raw.quote,
    reply: byId("reply").value,
    replyEdited: draftWhenEdited !== null,
    gapChoice: gapChoice,
  };
}

// Autosave after every change: into the open project, or into the draft.
function autosave() {
  if (loadingValues || (!currentId && !draftOnScreen)) return;
  const snap = snapshot();
  const text = JSON.stringify(snap);
  if (text === lastSaved) return;
  lastSaved = text;
  if (currentId) {
    projectList = projectStore.updateProject(projectList, currentId, snap, new Date(), true);
    persist();
  } else {
    draft = snap;
    persistDraft();
  }
}

// Puts a calculation's values into the page.
function fillCalculator(values) {
  hideSharedNote();
  loadingValues = true;
  stopCountUp();
  clearTimeout(commitTimer);

  byId("field-" + calc.fieldForJob(values.job, values.field)).checked = true;
  byId("job-" + values.job).checked = true;
  loadedJob = values.job;
  Object.keys(FIELD_IDS).forEach(function (name) {
    if (name !== "quote") byId(FIELD_IDS[name]).value = values.inputs[name];
  });
  byId(values.inputs.offerStatus === "none" ? "offer-none" : "offer-yes").checked = true;
  byId("quote").value = values.quote;
  gapChoice = typeof values.gapChoice === "string" ? values.gapChoice : (values.quote ? "" : "estimate");
  gapQuoteWritten = null;
  showWorkError(false);
  byId("reply").value = values.reply;
  currentDraft = values.reply;
  draftWhenEdited = null;
  shownErrors = {};
  show(byId("job-replace"), false);
  show(byId("reply-notice"), false);
  byId("copy-status").textContent = "";

  renderJob();
  showOfferField();
  update(true);

  // An edited reply stays as written. The notice shows only if the numbers change later.
  if (values.replyEdited) {
    draftWhenEdited = currentDraft;
    byId("reply").value = values.reply;
    show(byId("reply-notice"), false);
  }
  loadingValues = false;
  lastSaved = JSON.stringify(snapshot());
  quietSummary();
}

function openProject(id) {
  currentId = id;
  draftOnScreen = false;
  fillCalculator(currentProject());
  renderHeader();
}

function openDraft() {
  currentId = null;
  if (!draft) draft = projectStore.exampleDraft("menu");
  fillCalculator(draft);
  draftOnScreen = true;
  renderHeader();
}

function leaveProject() {
  if (currentId) draftOnScreen = false;
  currentId = null;
  lastSaved = null;
}

// "New calculation": a fresh menu example. If the unsaved one has changes,
// ask first.
let afterSave = null;

function startFresh() {
  draft = projectStore.exampleDraft("menu");
  persistDraft();
  draftOnScreen = false;
  go({ screen: "inputs" });
}

// "Your unsaved menu calculation will be replaced if you start a new one."
// The job's name starts lowercase after "unsaved"; the rest stays as written.
function startOverText(jobKey) {
  const name = calc.JOBS[jobKey].name;
  return "Your unsaved " + name.charAt(0).toLowerCase() + name.slice(1) +
    " calculation will be replaced if you start a new one.";
}

// The button that was pressed is the opener, since Safari doesn't focus a
// clicked button; focus goes back to it when the dialog closes.
function newCalculation(event) {
  if (draft && !projectStore.isUntouched(draft)) {
    byId("start-over-text").textContent = startOverText(draft.job);
    openDialog("start-over", event && event.currentTarget);
    byId("start-over-cancel").focus({ preventScroll: true });
  } else {
    startFresh();
  }
}

// "Save as project" from the start-over question: the Save dialog takes its
// place, saves the draft, then starts the new calculation. The page stays put
// underneath; the draft is loaded into the (hidden) calculator so it's what gets saved.
function saveThenStartOver() {
  const opener = dialogOpener;
  if (!draftOnScreen) openDraft();
  openSaveField(startFresh, opener);
}

// The header: project name and "Saved" in a project, "Projects 3", and the save button.

function renderHeader() {
  const screen = currentScreen();
  const inCalculator = screen === "inputs" || screen === "results";
  const project = currentProject();
  byId("crumb").hidden = !(inCalculator && project);
  if (project) {
    byId("crumb-name").textContent = project.name;
    byId("crumb-name").setAttribute("aria-label", project.name + ", rename project");
  }
  byId("projects-count").textContent = projectList.length;
  const link = byId("projects-link");
  if (screen === "projects") link.setAttribute("aria-current", "page");
  else link.removeAttribute("aria-current");

  byId("share-link").hidden = screen !== "results";

  byId("save-status").textContent = projectsUnsaved ? "Not saved" : "Saved";

  const button = byId("save-project");
  // Read only: "Not saved" stays, but Try again can't work until a reload.
  button.hidden = !inCalculator || (Boolean(project) && projectsUnsaved && projectsReadOnly);
  button.disabled = Boolean(project) && !projectsUnsaved;
  if (project && projectsUnsaved) {
    // On a phone only "Retry" fits; its name there is "Retry saving", so it
    // starts with the visible word. Tablet and desktop: "Try again".
    button.innerHTML = '<span class="save-long">Try again</span>' +
      '<span class="save-short">Retry<span class="visually-hidden"> saving</span></span>';
    button.removeAttribute("aria-label");
  } else if (project) {
    button.textContent = "Saved";
    button.removeAttribute("aria-label");
  } else {
    // On a phone only "Save" fits; the name stays "Save as project".
    button.innerHTML = '<span class="save-long">Save as project</span><span class="save-short">Save</span>';
    button.setAttribute("aria-label", "Save as project");
  }
  renderPricingCard();
  renderStageView();
}

// The dialogs: Save as project, Start over?, Open the shared result?, the
// link to copy by hand, Restore from backup, the three stage dialogs
// (They said yes, Mark as paid, Move back), and the two client request
// dialogs (Client asked for more, Remove this request). One is open at a
// time. Focus moves without scrolling, so the page underneath never jumps.
const PANEL_DIALOGS = ["save-panel", "start-over", "share-question", "share-panel", "restore-panel",
  "working-panel", "paid-panel", "back-panel", "request-panel", "remove-request-panel"];
let dialogOpener = null;

function openDialog(id, opener) {
  const from = opener || document.activeElement;
  closePanels();
  dialogOpener = from && from !== document.body ? from : null;
  byId(id).showModal();
}

function closePanels() {
  PANEL_DIALOGS.forEach(function (id) {
    if (byId(id).open) byId(id).close();
  });
  dialogOpener = null;
  pendingShare = null;
  pendingBackup = null;
  setFieldError(byId("save-name"), "");
}

// Cancel, Close, and Escape: focus goes back to the button that opened the dialog.
function dismissDialog() {
  const opener = dialogOpener;
  afterSave = null;
  closePanels();
  if (opener && opener.isConnected && !opener.disabled && !opener.closest("[hidden]")) {
    opener.focus({ preventScroll: true });
  }
}

// "Save as project": the name, filled in and selected so typing replaces it.
// then runs after a successful save.
function openSaveField(then, opener) {
  openDialog("save-panel", opener);
  afterSave = then || null;
  const input = byId("save-name");
  input.value = projectStore.defaultProjectName(currentJob(), new Date());
  input.focus({ preventScroll: true });
  input.select();
}

function saveAsProject(event) {
  event.preventDefault();
  const input = byId("save-name");
  const error = projectStore.validateName(input.value);
  setFieldError(input, error || "");
  if (error) {
    input.focus();
    return;
  }
  const project = projectStore.createProject(input.value, snapshot(), projectStore.newProjectId(), new Date());
  const before = projectList;
  projectList = projectList.concat([project]);
  if (!persist()) {
    // Nothing was saved: no project, the work stays the unsaved calculation,
    // and "Start over" doesn't go ahead. "Couldn't save" stays.
    projectList = before;
    projectsUnsaved = false;
    afterSave = null;
    const opener = byId("save-project");
    closePanels();
    renderHeader();
    opener.focus({ preventScroll: true });
    return;
  }
  // The work now lives in the project, so the draft starts fresh.
  draft = projectStore.exampleDraft("menu");
  persistDraft();
  closePanels();

  const then = afterSave;
  afterSave = null;
  if (then) {
    then();
    return;
  }
  currentId = project.id;
  draftOnScreen = false;
  lastSaved = JSON.stringify(snapshot());
  const state = { screen: currentScreen(), project: project.id };
  history.replaceState(state, "", addressFor(state));
  renderHeader();
  byId("crumb-name").focus({ preventScroll: true });
}

// Click the project name to rename: Enter or leaving the field saves, Escape
// cancels. A blank name keeps the old one.
function startHeaderRename() {
  const input = byId("crumb-input");
  input.value = currentProject().name;
  show(byId("crumb-name"), false);
  show(input, true);
  input.focus();
  input.select();
}

function finishHeaderRename(save) {
  const input = byId("crumb-input");
  if (input.hidden) return;
  if (save) {
    const before = projectList;
    projectList = projectStore.renameProject(projectList, currentId, input.value, new Date());
    if (projectList !== before) persist();
  }
  show(input, false);
  show(byId("crumb-name"), true);
  renderHeader();
  byId("crumb-name").focus();
}

