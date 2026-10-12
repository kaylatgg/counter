// Counter share links: the inputs of one calculation, written into the URL hash
// after "#s=", and read back. Pure functions only. Works in the browser (as the
// global shareLink) and in Node (through module.exports).

const shareCalc = typeof calc !== "undefined" ? calc : require("./calc.js");
const shareStore = typeof projectStore !== "undefined" ? projectStore : require("./projects.js");

const SHARE_PREFIX = "#s=";
const SHARE_VERSION = "1";

// The short name each input has in the link. The project name, price to send,
// and reply are never shared.
const SHARE_KEYS = {
  count: "count",
  rounds: "rounds",
  setupHours: "setup",
  itemHours: "item",
  communicationHours: "comm",
  roundHours: "round",
  deliveryHours: "delivery",
  rate: "rate",
  expenses: "expenses",
};

function isShareHash(hash) {
  return typeof hash === "string" && hash.indexOf(SHARE_PREFIX) === 0;
}

// Number text without thousands commas, so the link stays short: "1,000" gives "1000".
function plainNumber(text) {
  return String(text == null ? "" : text).trim().replace(/,/g, "");
}

// "#s=v=1&field=graphic&job=menu&count=2&...&offer=200" (or offer=none).
// inputs holds the form's text, as projects keep it.
function encodeShare(field, job, inputs) {
  const parts = [["v", SHARE_VERSION], ["field", field], ["job", job]];
  Object.keys(SHARE_KEYS).forEach(function (name) {
    parts.push([SHARE_KEYS[name], plainNumber(inputs[name])]);
  });
  parts.push(["offer", inputs.offerStatus === "none" ? "none" : plainNumber(inputs.offer)]);
  return SHARE_PREFIX + parts.map(function (part) {
    return part[0] + "=" + encodeURIComponent(part[1]);
  }).join("&");
}

// Reads the pairs after "#s=". Returns null if the text can't be read at all.
function readPairs(hash) {
  const pairs = {};
  const body = hash.slice(SHARE_PREFIX.length);
  if (!body) return null;
  try {
    body.split("&").forEach(function (part) {
      const at = part.indexOf("=");
      if (at < 1) return;
      pairs[part.slice(0, at)] = decodeURIComponent(part.slice(at + 1));
    });
  } catch (error) {
    return null;
  }
  return pairs;
}

// A whole number of 0 or more, a number of hours of 0 or more, and so on.
// Returns the plain text, or null when the value can't be used.
function cleanValue(text, name) {
  if (typeof text !== "string" || !text.trim()) return null;
  const parsed = shareCalc.parseNumber(text, shareCalc.FIELDS[name]);
  if (parsed.error || parsed.value === null) return null;
  if (name === "rate" && !(parsed.value > 0)) return null;
  return String(parsed.value);
}

// Reads a share hash. Returns:
//   { status: "ok", draft }       every value worked
//   { status: "partial", draft }  some values didn't, so they use the examples
//   { status: "broken", draft }   unreadable or an unknown version: the examples
// draft is a calculation like projectStore.exampleDraft gives.
function decodeShare(hash) {
  const pairs = isShareHash(hash) ? readPairs(hash) : null;
  if (!pairs || pairs.v !== SHARE_VERSION) {
    return { status: "broken", draft: shareStore.exampleDraft("menu") };
  }

  let bad = false;
  let job = pairs.job;
  if (!Object.prototype.hasOwnProperty.call(shareCalc.JOBS, job)) {
    bad = true;
    job = "menu";
  }
  // The field must be one the job belongs to (Custom is in every field).
  const field = shareCalc.fieldForJob(job, pairs.field);
  if (field !== pairs.field) bad = true;

  const draft = shareStore.exampleDraft(job, field);
  Object.keys(SHARE_KEYS).forEach(function (name) {
    const value = cleanValue(pairs[SHARE_KEYS[name]], name);
    if (value === null) bad = true;
    else draft.inputs[name] = value;
  });

  if (pairs.offer === "none") {
    draft.inputs.offerStatus = "none";
  } else {
    const offer = cleanValue(pairs.offer, "offer");
    if (offer === null) bad = true;
    else draft.inputs.offer = offer;
  }

  return { status: bad ? "partial" : "ok", draft: draft };
}

const shareLink = {
  SHARE_PREFIX,
  SHARE_VERSION,
  isShareHash,
  encodeShare,
  decodeShare,
};

if (typeof module !== "undefined") module.exports = shareLink;
