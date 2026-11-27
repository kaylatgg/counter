// Wiring

// Pressing Enter in a field shouldn't reload the page.
byId("counter-form").addEventListener("submit", function (event) {
  event.preventDefault();
});

document.querySelectorAll("button[data-step]").forEach(function (button) {
  button.addEventListener("click", function () { stepField(button); });
});

// The hours arrows never take focus, so tapping one doesn't open the phone
// keyboard or pull focus out of the box being edited.
document.querySelectorAll(".hour-arrow").forEach(function (button) {
  button.addEventListener("mousedown", function (event) { event.preventDefault(); });
});

// In the five hours boxes, Up and Down add or remove half an hour.
HOURS_ARROW_FIELDS.forEach(function (id) {
  byId(id).addEventListener("keydown", function (event) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    stepField({ dataset: { target: id, step: event.key === "ArrowUp" ? "0.5" : "-0.5" } });
  });
});

Object.keys(FIELD_IDS).forEach(function (name) {
  const input = byId(FIELD_IDS[name]);
  input.addEventListener("input", onType);
  input.addEventListener("blur", onLeaveField);
});

// Plain digits while typing. The selection is kept: Tab selects the whole
// value, and typing should replace it, not add to "1000".
MONEY_FIELDS.forEach(function (id) {
  byId(id).addEventListener("focus", function () {
    const input = byId(id);
    const plain = input.value.replace(/,/g, "");
    if (plain === input.value || calc.groupDigits(plain) !== input.value) return;
    const all = input.selectionStart === 0 && input.selectionEnd === input.value.length;
    const caret = input.value.slice(0, input.selectionEnd).replace(/,/g, "").length;
    input.value = plain;
    if (all) input.setSelectionRange(0, plain.length);
    else input.setSelectionRange(caret, caret);
  });
});

mirrors.forEach(function (mirror) {
  mirror.addEventListener("input", function () {
    byId(mirror.dataset.mirror).value = mirror.value;
    onType();
  });
  mirror.addEventListener("blur", onLeaveField);
});

document.querySelectorAll('input[name="offerStatus"]').forEach(function (radio) {
  radio.addEventListener("change", function () {
    showOfferField();
    clearTimeout(commitTimer);
    update(true);
  });
});

document.querySelectorAll('input[name="field"]').forEach(function (radio) {
  radio.addEventListener("change", switchField);
});
document.querySelectorAll('input[name="job"]').forEach(function (radio) {
  radio.addEventListener("change", switchJob);
});

// Phone: the header is clear at the top of screen 1, then gets a background.
window.addEventListener("scroll", function () {
  document.body.classList.toggle("scrolled", window.scrollY > 4);
}, { passive: true });

if (phoneQuery.addEventListener) phoneQuery.addEventListener("change", onLayoutChange);
else phoneQuery.addListener(onLayoutChange);
placeControls();
byId("job-replace-yes").addEventListener("click", function () { answerReplace(true); });
byId("job-replace-no").addEventListener("click", function () { answerReplace(false); });

byId("check-offer").addEventListener("click", checkOffer);
byId("edit-details").addEventListener("click", editDetails);
byId("skip-link").addEventListener("click", function (event) {
  event.preventDefault();
  checkOffer();
});

byId("reply").addEventListener("input", onReplyEdit);
byId("update-draft").addEventListener("click", updateDraft);
byId("use-estimate").addEventListener("click", useEstimate);
byId("gap-options").addEventListener("click", function (event) {
  const card = event.target.closest(".gap-card");
  if (card) pickGap(card.dataset.type, true);
});
// A radio group: arrows move and pick (wrapping), Space picks the focused card.
byId("gap-options").addEventListener("keydown", function (event) {
  const cards = Array.prototype.slice.call(byId("gap-options").children);
  const at = cards.indexOf(document.activeElement);
  if (at === -1) return;
  let next = null;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (at + 1) % cards.length;
  else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (at - 1 + cards.length) % cards.length;
  else if (event.key === " " || event.key === "Enter") next = at;
  if (next === null) return;
  event.preventDefault();
  pickGap(cards[next].dataset.type, true);
});
byId("copy-reply").addEventListener("click", copyReply);
byId("save-image").addEventListener("click", saveImage);

// Scrubbing the rate chart.
const ratePlot = byId("rate-plot");
ratePlot.addEventListener("pointermove", function (event) { if (rateView) scrubTo(hoursAtPointer(event)); });
ratePlot.addEventListener("pointerdown", function (event) { if (rateView) scrubTo(hoursAtPointer(event)); });
ratePlot.addEventListener("pointerleave", function () {
  if (document.activeElement !== ratePlot) hideScrub();
});
ratePlot.addEventListener("focus", function () { if (rateView) scrubTo(scrubHours); });
ratePlot.addEventListener("blur", hideScrub);
ratePlot.addEventListener("keydown", function (event) {
  if (!rateView) return;
  const moves = { ArrowRight: 0.5, ArrowUp: 0.5, ArrowLeft: -0.5, ArrowDown: -0.5 };
  if (moves[event.key]) {
    scrubTo(scrubHours + moves[event.key]);
  } else if (event.key === "Home") {
    scrubTo(rateView.x0);
  } else if (event.key === "End") {
    scrubTo(rateView.x1);
  } else if (event.key === "Escape") {
    hideScrub();
  } else {
    return;
  }
  event.preventDefault();
});
byId("image-save").addEventListener("click", deliverImage);
byId("image-close").addEventListener("click", function () { byId("image-dialog").close(); });
// Escape and Close both end here: focus goes back to "Save image".
byId("image-dialog").addEventListener("close", function () { byId("save-image").focus(); });
byId("share-link").addEventListener("click", shareResult);
byId("share-open").addEventListener("click", applyShare);
byId("share-keep").addEventListener("click", keepMine);
byId("share-close").addEventListener("click", dismissDialog);

let resizeFrame = null;
window.addEventListener("resize", function () {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(relayoutCharts);
});

if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(function () {
    relayoutCharts();
    // Pill widths change once the font loads, so the selected pill is placed again.
    showSelectedJobPill();
  });
}

// Projects and saving: the header, the save field, the start-over question, and the list.
byId("projects-link").addEventListener("click", function (event) {
  event.preventDefault();
  go({ screen: "projects" });
});
byId("save-project").addEventListener("click", function () {
  // In a project whose last save failed, the button is "Try again".
  if (currentProject()) {
    if (persist()) byId("crumb-name").focus({ preventScroll: true });
    return;
  }
  openSaveField(null);
});
byId("save-form").addEventListener("submit", saveAsProject);
byId("save-cancel").addEventListener("click", dismissDialog);
byId("save-name").addEventListener("input", function () {
  if (byId("save-name").getAttribute("aria-invalid")) {
    setFieldError(byId("save-name"), projectStore.validateName(byId("save-name").value) || "");
  }
});
byId("back-to-calc").addEventListener("click", function () { go(backTarget()); });
byId("new-calc").addEventListener("click", newCalculation);
byId("new-calc-empty").addEventListener("click", newCalculation);
byId("start-over-yes").addEventListener("click", startFresh);
byId("start-over-save").addEventListener("click", saveThenStartOver);
byId("start-over-cancel").addEventListener("click", dismissDialog);
// Escape works like Cancel (and like "Keep mine" for a shared link), with our
// own focus return instead of the browser's.
PANEL_DIALOGS.forEach(function (id) {
  byId(id).addEventListener("cancel", function (event) {
    event.preventDefault();
    if (id === "share-question") keepMine();
    else if (id === "request-panel") closeRequestDialog();
    else dismissDialog();
  });
});
byId("project-groups").addEventListener("click", onRowClick);
byId("stage-pills").addEventListener("click", onStagePill);
// Project stages (app/stages.js).
byId("stage-forward").addEventListener("click", onStageForward);
byId("stage-back").addEventListener("click", openBackDialog);
byId("working-form").addEventListener("submit", submitWorking);
byId("working-cancel").addEventListener("click", dismissDialog);
byId("agreed-price").addEventListener("input", onAgreedInput);
byId("paid-form").addEventListener("submit", submitPaid);
byId("paid-cancel").addEventListener("click", dismissDialog);
byId("paid-amount").addEventListener("input", onPaidInput);
byId("paid-hours").addEventListener("input", onPaidInput);
byId("back-yes").addEventListener("click", confirmBack);
byId("back-cancel").addEventListener("click", dismissDialog);
// Client requests (app/requests.js).
byId("stage-request").addEventListener("click", openRequestDialog);
byId("request-form").addEventListener("submit", submitRequest);
byId("request-cancel").addEventListener("click", dismissDialog);
byId("request-text").addEventListener("input", onRequestTextInput);
byId("request-less").addEventListener("click", function () { stepRequestHours(-1); });
byId("request-more").addEventListener("click", function () { stepRequestHours(1); });
byId("request-bars").addEventListener("change", onRequestPick);
byId("request-copy").addEventListener("click", copyRequestMessage);
byId("request-done").addEventListener("click", finishRequestMessage);
byId("request-panel").addEventListener("close", onRequestPanelClose);
byId("project-rate-bars").addEventListener("click", onRequestRowAction);
byId("remove-request-yes").addEventListener("click", confirmRemoveRequest);
byId("remove-request-cancel").addEventListener("click", dismissDialog);
["agreed-price", "paid-amount"].forEach(function (id) {
  byId(id).addEventListener("blur", groupOnLeave);
});
byId("backup-download").addEventListener("click", downloadBackup);
byId("backup-restore").addEventListener("click", startRestore);
byId("backup-restore-empty").addEventListener("click", startRestore);
byId("backup-file").addEventListener("change", onBackupFile);
byId("restore-yes").addEventListener("click", confirmRestore);
byId("restore-cancel").addEventListener("click", dismissDialog);
byId("restore-close").addEventListener("click", dismissDialog);
byId("waterfall-toggle").addEventListener("click", function () {
  waterfallAsTable = !waterfallAsTable;
  applyTableToggle("waterfall-toggle", byId("waterfall"), byId("waterfall-table"), waterfallAsTable);
});
byId("bullet-toggle").addEventListener("click", function () {
  bulletAsTable = !bulletAsTable;
  applyTableToggle("bullet-toggle", byId("bullet-chart"), byId("bullet-table"), bulletAsTable);
});
byId("bullet-rows").addEventListener("mouseover", function (event) {
  showBulletTip(event.target.closest(".bullet-row"));
});
byId("bullet-rows").addEventListener("mouseleave", function () { showBulletTip(null); });
byId("fix-button").addEventListener("click", function () {
  landOnGap = true;
  go({ screen: "results", project: this.dataset.id });
});
byId("pricing-card-link").addEventListener("click", function (event) {
  event.preventDefault();
  go({ screen: "projects" });
});
byId("project-groups").addEventListener("keydown", onRowKey);
byId("project-groups").addEventListener("focusout", function (event) {
  if (event.target.classList.contains("row-rename")) {
    finishRowRename(event.target.closest("tr").dataset.id, true);
  }
});
// Safari drops :focus-visible when arrow keys move between radios, so the
// page remembers whether the last input was a key or a pointer (see
// .keyboard-nav in styles.css).
document.addEventListener("keydown", function () {
  document.documentElement.classList.add("keyboard-nav");
}, true);
document.addEventListener("pointerdown", function () {
  document.documentElement.classList.remove("keyboard-nav");
}, true);

byId("crumb-name").addEventListener("click", startHeaderRename);
byId("crumb-input").addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    event.preventDefault();
    finishHeaderRename(true);
  } else if (event.key === "Escape") {
    finishHeaderRename(false);
  }
});
byId("crumb-input").addEventListener("blur", function () { finishHeaderRename(true); });

// Start: load saved projects and the draft, then go where the address says
// (the calculator by default).
const loadedStore = projectStorage.loadStore(storage());
projectList = loadedStore.projects;
projectsReadOnly = loadedStore.readOnly;
show(byId("newer-version"), projectsReadOnly);
draft = projectStore.loadDraft(storage()).draft;
if (shareLink.isShareHash(location.hash)) {
  openShareLink(location.hash, true);
} else {
  const startState = stateFromAddress(location.hash);
  history.replaceState(startState, "", addressFor(startState));
  route(startState);
}
firstLoad = false;
quietSummary();
// The right screen is showing now (see the script in index.html's head).
document.documentElement.classList.remove("routing");

// Bars and dots animate only after the first render, never on load.
requestAnimationFrame(function () {
  requestAnimationFrame(function () {
    document.body.classList.add("charts-ready");
  });
});

// ?grid in the address shows the layout columns over the page, for checking
// alignment. Off otherwise.
if (new URLSearchParams(location.search).has("grid")) {
  const overlay = document.createElement("div");
  overlay.className = "grid-overlay";
  overlay.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 12; i++) overlay.appendChild(document.createElement("span"));
  document.body.appendChild(overlay);
}
