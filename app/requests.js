// Client requests while a project is Working (saved projects only): the
// "Client asked for more" dialog (step 1, the request and what doing it free
// or charging does to the rate; step 2, the message to send when charging),
// the request rows under "Your rate, request by request" with their switch
// and Remove, and the Remove dialog. All money math is in timeline.js; this
// file reads it and writes it onto the page, always with textContent.

// Refusals from timeline.js for requests, in plain words, next to the stage ones.
Object.assign(STAGE_REFUSALS, {
  "bad-text": "Enter what they asked for, in 120 characters or less.",
  "bad-hours": "The hours need to be more than 0 and at most 1,000.",
  "bad-decision": "Choose Do it free or Charge.",
  "too-much-money": "That would take this project over $100,000, so it can't be added.",
  "too-many-hours": "That would take this project over 1,000 hours, so it can't be added.",
  "no-request": "This request isn't on the project anymore. Reload the page and try again.",
});

const REQUEST_TEXT_ERROR = "Enter what they asked for, like one more round of changes.";
const REQUEST_HOURS_STEP = 0.5;
const REQUEST_HOURS_MAX = 100;

function sumHours(requests, decision) {
  return projectTimeline.roundHours(requests.reduce(function (total, request) {
    return request.decision === decision ? total + request.hours : total;
  }, 0));
}

function sumCharges(requests) {
  return requests.reduce(function (total, request) { return total + request.chargeCents; }, 0);
}

// The stats' extras while Working: "incl. $40 extra" after the agreed price,
// and " · 10 planned, 1 free, 1.5 charged" after the hours so far. Each part
// shows only when it's above 0.
function requestChargesUnit(timeline) {
  const charges = sumCharges(timeline.requests);
  return charges > 0 ? "incl. " + centsPrice(charges) + " extra" : "";
}

function requestHoursUnit(timeline) {
  if (!timeline.requests.length) return "";
  const parts = [calc.formatNumber(timeline.plannedHours) + " planned"];
  const free = sumHours(timeline.requests, "free");
  const charged = sumHours(timeline.requests, "charge");
  if (free > 0) parts.push(calc.formatNumber(free) + " free");
  if (charged > 0) parts.push(calc.formatNumber(charged) + " charged");
  return " · " + parts.join(", ");
}

// One rate bar row per request, for renderRateBars. While Working the last
// one is coral (it's the rate now) and each row can switch or be removed.
function requestRows(project, timeline) {
  const steps = projectTimeline.requestSteps(project) || [];
  const working = timeline.stage === "working";
  const canChange = working && !projectsReadOnly;
  return steps.map(function (step, i) {
    const request = step.request;
    const free = request.decision === "free";
    const row = {
      label: request.text,
      note: stageDate(request.at) + " · " + calc.formatHours(request.hours) +
        (free ? ", done free" : ", charged " + centsPrice(request.chargeCents)),
      cents: step.rateCents,
      deltaCents: step.deltaCents,
      fill: working && i === steps.length - 1 ? "now" : null,
    };
    if (canChange) {
      const charge = projectTimeline.requestChargeCents(request.hours, request.rateCents);
      row.actions = [
        free
          // The visible words come first in the name, so voice control can use them.
          ? { text: "charge " + centsPrice(charge) + " instead", label: "Charge " + centsPrice(charge) + " instead: " + request.text, action: "switch", requestId: request.id }
          : { text: "make it free", label: "Make it free: " + request.text, action: "switch", requestId: request.id },
        { text: "Remove", label: "Remove " + request.text, action: "remove", requestId: request.id },
      ];
    }
    return row;
  });
}

// Saves a changed project like applyStage does (the edited date is now), which
// re-renders the project page through the header. Doesn't close or focus.
function saveRequestChange(project) {
  finishPlays();
  const saved = Object.assign({}, project, { edited: new Date().toISOString() });
  projectList = projectList.map(function (item) { return item.id === saved.id ? saved : item; });
  persist();
  // The rate bars may have changed size.
  relayoutCharts();
  return saved;
}

// "This project now pays $20.00 an hour."
function paysNowText(project) {
  return centsMoney(projectTimeline.rateNowCents(project)) + " an hour.";
}

function focusStageRequest() {
  const button = byId("stage-request");
  if (!button.closest("[hidden]")) button.focus({ preventScroll: true });
}

// The dialog, step 1

let requestHours = 1;
let requestPick = null;
// After a charged request is added: the project, for step 2 and Done.
let requestAdded = null;

function requestTimeline() {
  const timeline = currentTimeline();
  return timeline && timeline.stage === "working" ? timeline : null;
}

// The most hours this request can take: 100, or less when the project would
// pass 1000 hours.
function requestHoursMax(preview) {
  return Math.min(REQUEST_HOURS_MAX, projectTimeline.MAX_HOURS - preview.hoursSoFar);
}

function openRequestDialog(event) {
  const project = currentProject();
  if (!requestTimeline() || projectsReadOnly) return;
  const opener = event && event.currentTarget ? event.currentTarget : byId("stage-request");
  openDialog("request-panel", opener);
  requestPick = null;
  requestAdded = null;
  requestHours = 1;
  const preview = projectTimeline.previewRequest(project, REQUEST_HOURS_STEP);
  // Near 1000 hours, start at the most that still fits (in half hours).
  if (preview) {
    const most = Math.floor(requestHoursMax(preview) / REQUEST_HOURS_STEP) * REQUEST_HOURS_STEP;
    requestHours = Math.max(REQUEST_HOURS_STEP, Math.min(1, most));
  }
  showRequestStep(1);
  const text = byId("request-text");
  text.value = "";
  setFieldError(text, "");
  showChoiceError(false);
  showRefusal("request-refusal", null);
  renderRequestPreview();
  renderAddLabel();
  text.focus({ preventScroll: true });
}

function showRequestStep(step) {
  show(byId("request-form"), step === 1);
  show(byId("request-message"), step === 2);
  byId("request-panel").setAttribute("aria-labelledby", step === 1 ? "request-title" : "request-message-title");
  byId("request-copy-status").textContent = "";
}

// Now, Do it free, and Charge $40, on one scale, and the charge rule under them.
function renderRequestPreview() {
  const project = currentProject();
  const preview = projectTimeline.previewRequest(project, requestHours);
  if (!preview) return;
  const after = projectTimeline.roundHours(preview.hoursSoFar + requestHours);
  const charge = preview.chargeAmountCents;

  byId("request-hours").textContent = calc.formatHours(requestHours);
  setStepperButton(byId("request-less"), requestHours - REQUEST_HOURS_STEP < REQUEST_HOURS_STEP, byId("request-more"));
  setStepperButton(byId("request-more"), requestHours + REQUEST_HOURS_STEP > requestHoursMax(preview), byId("request-less"));

  const describedBy = byId("request-choice-error").hidden ? null : "request-choice-error";
  renderRateBars(byId("request-bars"), [
    { label: "Now", note: calc.formatHours(preview.hoursSoFar) + " for " + centsPrice(preview.moneyCents),
      cents: preview.nowCents, fill: "now" },
    { label: "Do it free", note: "still " + centsPrice(preview.moneyCents) + " · " + calc.formatHours(after),
      cents: preview.freeCents, deltaCents: preview.freeCents - preview.nowCents, fill: "off",
      choice: { name: "request-decision", value: "free", checked: requestPick === "free", describedBy: describedBy } },
    { label: "Charge " + centsPrice(charge), note: centsPrice(preview.moneyCents + charge) + " · " + calc.formatHours(after),
      cents: preview.chargeCents, deltaCents: preview.chargeCents - preview.nowCents, fill: "off",
      choice: { name: "request-decision", value: "charge", checked: requestPick === "charge", describedBy: describedBy } },
  ], preview.targetCents, { legend: "Your choice" });

  const exact = Math.round(requestHours * preview.targetCents) === charge;
  byId("request-rule").textContent = centsPrice(charge) + " is " + calc.formatHours(requestHours) +
    " at your " + centsPrice(preview.targetCents) + " target" + (exact ? "" : ", rounded up to the next $5") + ".";
}

// A stepper button at its limit is disabled. If it had focus, focus moves to
// the other one, so it isn't lost.
function setStepperButton(button, atLimit, other) {
  const hadFocus = document.activeElement === button;
  button.disabled = atLimit;
  if (atLimit && hadFocus && !other.disabled) other.focus();
}

function stepRequestHours(direction) {
  const preview = projectTimeline.previewRequest(currentProject(), requestHours);
  if (!preview) return;
  const next = projectTimeline.roundHours(requestHours + direction * REQUEST_HOURS_STEP);
  if (next < REQUEST_HOURS_STEP || next > requestHoursMax(preview)) return;
  requestHours = next;
  showRefusal("request-refusal", null);
  renderRequestPreview();
}

function renderAddLabel() {
  byId("request-add").textContent = requestPick === "free" ? "Add as free"
    : requestPick === "charge" ? "Add and write the message" : "Add request";
}

// "Choose Do it free or Charge." under the choices, linked from both radios.
function showChoiceError(visible) {
  show(byId("request-choice-error"), visible);
  byId("request-bars").querySelectorAll('input[name="request-decision"]').forEach(function (radio) {
    if (visible) radio.setAttribute("aria-describedby", "request-choice-error");
    else radio.removeAttribute("aria-describedby");
  });
}

// Picking updates the radios in place, so the one with focus keeps it.
function onRequestPick(event) {
  if (event.target.name !== "request-decision") return;
  requestPick = event.target.value;
  showChoiceError(false);
  showRefusal("request-refusal", null);
  renderAddLabel();
}

function onRequestTextInput() {
  const text = byId("request-text");
  showRefusal("request-refusal", null);
  if (text.getAttribute("aria-invalid") && text.value.trim()) setFieldError(text, "");
}

function submitRequest(event) {
  event.preventDefault();
  const text = byId("request-text");
  const missingText = !text.value.trim();
  setFieldError(text, missingText ? REQUEST_TEXT_ERROR : "");
  showChoiceError(!requestPick);
  if (missingText) {
    text.focus();
    return;
  }
  if (!requestPick) {
    byId("request-bars").querySelector('input[name="request-decision"]').focus();
    return;
  }

  const result = projectTimeline.addRequest(currentProject(), {
    text: text.value, hours: requestHours, decision: requestPick,
  }, new Date(), projectStore.newProjectId());
  if (!result.ok) {
    showRefusal("request-refusal", result.reason);
    return;
  }
  const saved = saveRequestChange(result.project);

  if (requestPick === "free") {
    closePanels();
    focusStageRequest();
    announce("Request added as free. This project now pays " + paysNowText(saved));
    return;
  }
  requestAdded = saved;
  showRequestMessage(saved);
}

// The dialog, step 2 (charge only): the breakdown and the message.

function showRequestMessage(project) {
  const timeline = projectTimeline.timelineOf(project);
  const requests = timeline.requests;
  const request = requests[requests.length - 1];
  const earlier = sumCharges(requests.slice(0, -1));
  const total = timeline.agreedCents + earlier + request.chargeCents;

  const list = byId("request-breakdown");
  list.textContent = "";
  function line(term, value, className) {
    const group = make("div", className || null);
    group.append(make("dt", null, term), make("dd", null, value));
    list.appendChild(group);
  }
  line("Agreed price", centsPrice(timeline.agreedCents));
  if (earlier > 0) line("Earlier requests", "+" + centsPrice(earlier));
  line(request.text, "+" + centsPrice(request.chargeCents));
  line("New total", centsPrice(total), "request-total");

  byId("request-reply").value = "Hi! Happy to take on the extra request: " + request.text.replace(/\.+$/, "") +
    ". It's outside what we agreed on, so it's " + centsPrice(request.chargeCents) +
    " more, which makes the new total " + centsPrice(total) + ". Let me know if that works and I'll get started.";

  showRequestStep(2);
  byId("request-message-title").focus({ preventScroll: true });
}

let requestCopiedTimer = null;

function setRequestCopyStatus(text) {
  const status = byId("request-copy-status");
  // Clearing first makes screen readers announce the message again on a repeat copy.
  status.textContent = "";
  setTimeout(function () { status.textContent = text; }, 50);
}

// Like Copy reply: "Copied to clipboard.", or the text selected to copy by hand.
function copyRequestMessage() {
  const reply = byId("request-reply");
  clearTimeout(requestCopiedTimer);

  function failed() {
    reply.focus();
    reply.select();
    setRequestCopyStatus("Couldn't copy. Select the text and copy it yourself.");
  }

  if (!navigator.clipboard || !navigator.clipboard.writeText) {
    failed();
    return;
  }
  navigator.clipboard.writeText(reply.value).then(function () {
    setRequestCopyStatus("Copied to clipboard.");
    requestCopiedTimer = setTimeout(function () { byId("request-copy-status").textContent = ""; }, COPIED_MESSAGE_MS);
  }, failed);
}

// Done and Escape on step 2 close the dialog; so can anything else that
// closes the panels. However it closes, onRequestPanelClose finishes.
function finishRequestMessage() {
  closePanels();
}

// Escape: Cancel on step 1, Done on step 2.
function closeRequestDialog() {
  if (requestAdded) finishRequestMessage();
  else dismissDialog();
}

// After a charged request, closing the dialog any way goes back to the stage
// bar and says the new rate.
function onRequestPanelClose() {
  const project = requestAdded;
  requestAdded = null;
  clearTimeout(requestCopiedTimer);
  if (!project) return;
  focusStageRequest();
  announce("Request added. This project now pays " + paysNowText(project));
}

// The request rows: switch between free and charge, or remove.

let removingRequestId = null;

function onRequestRowAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button || projectsReadOnly) return;
  if (button.dataset.action === "switch") switchRequest(button.dataset.requestId);
  else if (button.dataset.action === "remove") openRemoveRequest(button.dataset.requestId, button);
}

function findRequestById(id) {
  const timeline = requestTimeline();
  return timeline ? timeline.requests.filter(function (request) { return request.id === id; })[0] || null : null;
}

function switchRequest(id) {
  const request = findRequestById(id);
  const decision = request && request.decision === "free" ? "charge" : "free";
  const result = projectTimeline.setRequestDecision(currentProject(), id, decision);
  if (!result.ok) {
    showRefusal("request-row-refusal", result.reason);
    return;
  }
  showRefusal("request-row-refusal", null);
  const saved = saveRequestChange(result.project);
  const same = byId("project-rate-bars").querySelector('button[data-action="switch"][data-request-id="' + CSS.escape(id) + '"]');
  if (same) same.focus({ preventScroll: true });
  const changed = projectTimeline.timelineOf(saved).requests.filter(function (item) { return item.id === id; })[0];
  announce((decision === "charge" ? "Now charging " + centsPrice(changed.chargeCents) + "." : "Now free.") +
    " This project pays " + paysNowText(saved));
}

function openRemoveRequest(id, opener) {
  const request = findRequestById(id);
  if (!request) {
    showRefusal("request-row-refusal", "no-request");
    return;
  }
  removingRequestId = id;
  byId("remove-request-text").textContent = request.text + " and its " + calc.formatHours(request.hours) + " come off this project.";
  showRefusal("remove-request-refusal", null);
  openDialog("remove-request-panel", opener);
  byId("remove-request-cancel").focus({ preventScroll: true });
}

function confirmRemoveRequest() {
  const result = projectTimeline.removeRequest(currentProject(), removingRequestId);
  if (!result.ok) {
    showRefusal("remove-request-refusal", result.reason);
    return;
  }
  removingRequestId = null;
  showRefusal("request-row-refusal", null);
  closePanels();
  const saved = saveRequestChange(result.project);
  focusStageRequest();
  announce("Request removed. This project pays " + paysNowText(saved));
}
