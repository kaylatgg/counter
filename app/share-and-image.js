// Share link: the inputs of this calculation in the address, after "#s=".
// Desktop copies it; a phone opens the share sheet, or copies if it can't.

const LINK_COPIED_MS = 2000;
let linkCopiedTimer = null;

function shareUrl() {
  const snap = snapshot();
  return location.href.split("#")[0] + shareLink.encodeShare(snap.field, snap.job, snap.inputs);
}

function showLinkCopied() {
  const button = byId("share-link");
  clearTimeout(linkCopiedTimer);
  button.classList.add("copied");
  announce("Link copied");
  linkCopiedTimer = setTimeout(function () {
    button.classList.remove("copied");
  }, LINK_COPIED_MS);
}

// When copying fails: the link in a read-only field, selected, to copy by hand.
function showShareField(url) {
  openDialog("share-panel", byId("share-link"));
  const input = byId("share-url");
  input.value = url;
  input.focus({ preventScroll: true });
  input.select();
}

function copyLink(url) {
  if (!navigator.clipboard || !navigator.clipboard.writeText) {
    showShareField(url);
    return;
  }
  navigator.clipboard.writeText(url).then(showLinkCopied, function () { showShareField(url); });
}

function shareResult() {
  const url = shareUrl();
  if (isPhone() && navigator.share) {
    navigator.share({ url: url }).catch(function (error) {
      // Closing the share sheet isn't a failure: nothing happens.
      if (error && error.name === "AbortError") return;
      copyLink(url);
    });
    return;
  }
  copyLink(url);
}

// Opening a shared link. It becomes the unsaved calculation (never a saved
// project). If the unsaved one has changes, it asks first.

let pendingShare = null;
let sharedSnapshot = null;

const SHARED_NOTES = {
  ok: "Shared result. Change anything to make it yours.",
  partial: "Some numbers in this link didn't work, so we used examples.",
  broken: "Some numbers in this link didn't work, so we used examples.",
};

function openShareLink(hash, onLoad) {
  const shared = shareLink.decodeShare(hash);
  // Underneath: the person's own calculation, screen 1. The address keeps the
  // link until they answer.
  history.replaceState({ screen: "inputs" }, "", location.href);
  route({ screen: "inputs" });
  if (draft && !projectStore.isUntouched(draft)) {
    openDialog("share-question");
    pendingShare = shared;
    byId("share-open").focus({ preventScroll: true });
    return;
  }
  pendingShare = shared;
  applyShare(onLoad);
}

function applyShare(onLoad) {
  const shared = pendingShare;
  closePanels();
  if (!shared) return;
  leaveProject();
  draft = shared.draft;
  persistDraft();
  draftOnScreen = false;
  const quiet = onLoad === true;

  if (shared.status === "broken") {
    // Nothing usable: screen 1 with the examples.
    const state = { screen: "inputs" };
    history.replaceState(state, "", addressFor(state));
    route(state);
    showSharedNote(shared.status);
    return;
  }

  // Screen 1 first, so the reveal can grow from the button into the result.
  route({ screen: "inputs" });
  const state = { screen: "results" };
  history.replaceState(state, "", addressFor(state));
  showSharedNote(shared.status);
  if (lastResult && byId("result-summary") && !document.querySelector(".results-pair").hidden) {
    revealResults(quiet);
  } else {
    openResults(quiet);
  }
}

function keepMine() {
  closePanels();
  const state = { screen: "inputs" };
  history.replaceState(state, "", addressFor(state));
  byId("page-title").focus({ preventScroll: true });
}

function showSharedNote(status) {
  const onInputs = status === "broken";
  const note = byId(onInputs ? "shared-note-inputs" : "shared-note");
  note.querySelector(".shared-text").textContent = SHARED_NOTES[status];
  show(onInputs ? note : byId("shared-row"), true);
  sharedSnapshot = JSON.stringify(snapshot());
}

function hideSharedNote() {
  sharedSnapshot = null;
  show(byId("shared-row"), false);
  show(byId("shared-note-inputs"), false);
}

// Save image: a 1080 by 1350 PNG for the client, drawn on a canvas.
// It speaks to the client: "Design" for production, "work you don't see",
// "$200 covers 7.2 hrs". No target rate gaps or losses.

const IMAGE_W = 1080;
const IMAGE_H = 1350;
const IMAGE_X = 80;
const IMAGE_RIGHT = 1000;
const IMAGE_COLORS = {
  bg: "#ECECEA", ink: "#161616", ink2: "#4D4D4A", line: "#CFCFCB",
};
const PRODUCTION_NAMES = { graphic: "Design", illustration: "Drawing", photography: "Shooting and editing", motion: "Animation" };
const IMAGE_GROUP_NAMES = { communication: "Communication", revisions: "Revisions", delivery: "Delivery" };

function imageFont(size, weight, mono) {
  return (weight || 400) + " " + size + "px " + (mono ? '"Geist Mono", ui-monospace, monospace' : '"Geist", system-ui, sans-serif');
}

// Words that fit in maxWidth, line by line.
function wrapWords(ctx, text, maxWidth) {
  const lines = [];
  let line = "";
  text.split(" ").forEach(function (word) {
    const next = line ? line + " " + word : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// The page's --sunset, drawn into a box: a 160deg base and three soft ellipses.
function drawSunset(ctx, x, y, w, h) {
  const angle = (160 * Math.PI) / 180;
  const dx = Math.sin(angle);
  const dy = -Math.cos(angle);
  const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const base = ctx.createLinearGradient(cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half);
  base.addColorStop(0, "#C9D3DC");
  base.addColorStop(0.42, "#DCD9D2");
  base.addColorStop(1, "#EBCDB8");
  ctx.fillStyle = base;
  ctx.fillRect(x, y, w, h);
  // [radius x, radius y, center x, center y, color rgb, where it fades out]
  [
    [0.40, 0.60, 0.55, 0.55, "244,180,142", 0.75],
    [0.50, 0.80, 0.70, 0.80, "245,154,98", 0.70],
    [0.55, 0.95, 0.88, 1.00, "229,96,63", 0.70],
  ].forEach(function (blob) {
    ctx.save();
    ctx.translate(x + blob[2] * w, y + blob[3] * h);
    ctx.scale(blob[0] * w, blob[1] * h);
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    glow.addColorStop(0, "rgba(" + blob[4] + ",1)");
    glow.addColorStop(blob[5], "rgba(" + blob[4] + ",0)");
    ctx.fillStyle = glow;
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
  });
}

// Vertical ink stripes with a thin outline, like the page's unpaid hours.
function drawStripes(ctx, x, y, w, h) {
  if (w <= 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = IMAGE_COLORS.ink;
  for (let at = x; at < x + w; at += 5) ctx.fillRect(at, y, 1.25, h);
  ctx.restore();
  ctx.strokeStyle = IMAGE_COLORS.ink;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5);
}

// Text with an optional letter spacing, where the browser supports it.
function setSpacing(ctx, value) {
  if ("letterSpacing" in ctx) ctx.letterSpacing = value;
}

// The header's mark, from favicon.svg (viewBox 4 4 92 92).
const IMAGE_MARK = "M4,50A46,46 0 1 0 96,50A46,46 0 1 0 4,50ZM31,44A27,27 0 1 0 85,44A27,27 0 1 0 31,44Z";

// The logo lockup at 34px: the mark 0.666em square, 0.012em below the
// baseline, 0.166em left of "counter". Returns where the mark starts.
function drawImageLogo(ctx, right, baseline) {
  const size = 34;
  const mark = 0.666 * size;
  ctx.fillStyle = IMAGE_COLORS.ink;
  ctx.font = imageFont(size, 400);
  setSpacing(ctx, (-0.035 * size) + "px");
  ctx.textAlign = "right";
  ctx.fillText("counter", right, baseline);
  const textLeft = right - ctx.measureText("counter").width;
  ctx.textAlign = "left";
  setSpacing(ctx, "0px");

  const markLeft = textLeft - 0.166 * size - mark;
  ctx.save();
  ctx.translate(markLeft, baseline + 0.012 * size - mark);
  ctx.scale(mark / 92, mark / 92);
  ctx.translate(-4, -4);
  ctx.fill(new Path2D(IMAGE_MARK), "evenodd");
  ctx.restore();
  return markLeft;
}

// The job summary in lines: whole " · " parts, the first line within
// firstWidth (beside the logo), later ones the full width.
function summaryLines(ctx, text, firstWidth) {
  const lines = [];
  let line = "";
  text.split(" · ").forEach(function (part) {
    const next = line ? line + " · " + part : part;
    const width = lines.length ? IMAGE_RIGHT - IMAGE_X : firstWidth;
    if (line && ctx.measureText(next).width > width) {
      lines.push(line);
      line = part;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function drawShareImage(canvas, r, values) {
  const ctx = canvas.getContext("2d");
  const ink = IMAGE_COLORS.ink;
  const ink2 = IMAGE_COLORS.ink2;
  ctx.fillStyle = IMAGE_COLORS.bg;
  ctx.fillRect(0, 0, IMAGE_W, IMAGE_H);
  ctx.textBaseline = "alphabetic";

  // The logo, top right: "counter" ends on the right margin, on the job
  // summary's baseline, with the mark to its left (sized as in the header).
  const logoLeft = drawImageLogo(ctx, IMAGE_RIGHT, 103);

  // Job summary, the hours, and the intro. A summary that would come within
  // 32px of the logo breaks at its " · " onto a second line.
  ctx.fillStyle = ink2;
  ctx.font = imageFont(22, 400, true);
  summaryLines(ctx, jobSummary(values), logoLeft - 32 - IMAGE_X)
    .forEach(function (line, i) { ctx.fillText(line, IMAGE_X, 103 + i * 30); });

  ctx.fillStyle = ink;
  ctx.font = imageFont(88, 300);
  setSpacing(ctx, "-2.5px");
  ctx.fillText(hoursInWords(r.hours.total), IMAGE_X - 4, 209);
  ctx.fillText("of work", IMAGE_X - 4, 297);
  setSpacing(ctx, "0px");

  ctx.fillStyle = ink2;
  ctx.font = imageFont(30, 400);
  wrapWords(ctx, "Here's where the time goes, including the work you don't see.", 720)
    .forEach(function (line, i) { ctx.fillText(line, IMAGE_X, 359 + i * 40); });

  // The bar: one segment per group with hours, 6px apart, on one scale.
  const barTop = 597;
  const barBottom = 795;
  const groups = WORK_GROUPS.filter(function (group) { return r.hours[group] > 1e-9; });
  const gap = 6;
  const usable = IMAGE_RIGHT - IMAGE_X - gap * (groups.length - 1);
  const segments = [];
  let x = IMAGE_X;
  let hoursSoFar = 0;
  groups.forEach(function (group) {
    const w = (r.hours[group] / r.hours.total) * usable;
    segments.push({ group: group, x: x, w: w, from: hoursSoFar, to: hoursSoFar + r.hours[group] });
    x += w + gap;
    hoursSoFar += r.hours[group];
  });
  // The x of an hour mark, skipping the gaps.
  function xAt(hours) {
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i];
      if (hours <= s.to + 1e-9) return s.x + ((hours - s.from) / (s.to - s.from)) * s.w;
    }
    return IMAGE_RIGHT;
  }

  // How much the offer covers: all of it (no offer, or enough), none (at or
  // below expenses), or part.
  const offer = r.offer;
  let covered = r.hours.total;
  let mode = "all";
  if (offer && offer.amount <= r.expenses) {
    covered = 0;
    mode = "none";
  } else if (offer && !offer.coversAllHours) {
    covered = offer.hoursCovered;
    mode = "part";
  }
  const coverX = xAt(covered);

  const paid = ctx.createLinearGradient(IMAGE_X, 0, IMAGE_RIGHT, 0);
  paid.addColorStop(0, "#C9D3DC");
  paid.addColorStop(0.3, "#E9D7C6");
  paid.addColorStop(0.7, "#F59A62");
  paid.addColorStop(1, "#E5603F");
  segments.forEach(function (s) {
    const paidEnd = Math.max(s.x, Math.min(s.x + s.w, coverX));
    if (paidEnd > s.x) {
      ctx.fillStyle = paid;
      ctx.fillRect(s.x, barTop, paidEnd - s.x, barBottom - barTop);
    }
    drawStripes(ctx, paidEnd, barTop, s.x + s.w - paidEnd, barBottom - barTop);
  });

  // The bracket over the work you don't see.
  const hidden = segments.filter(function (s) { return s.group !== "production"; });
  if (hidden.length) {
    const from = hidden[0].x;
    ctx.fillStyle = ink;
    ctx.font = imageFont(20, 400, true);
    const bracketLabel = calc.formatHours(r.outsideProduction) + " of work you don't see";
    // Starts over the bracket, or ends at the bar's end when that's too short.
    ctx.fillText(bracketLabel, Math.max(IMAGE_X, Math.min(from, IMAGE_RIGHT - ctx.measureText(bracketLabel).width)), 474);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(from + 0.75, 509);
    ctx.lineTo(from + 0.75, 493);
    ctx.lineTo(IMAGE_RIGHT - 0.75, 493);
    ctx.lineTo(IMAGE_RIGHT - 0.75, 509);
    ctx.stroke();
  }

  // The covers line: dashed, from its label down through the bar.
  if (mode !== "all") {
    const label = mode === "none"
      ? calc.formatPrice(offer.amount) + " covers none of the hours"
      : calc.formatPrice(offer.amount) + " covers " + calc.formatHours(covered);
    ctx.font = imageFont(22, 400, true);
    ctx.fillStyle = ink;
    const labelWidth = ctx.measureText(label).width;
    const fitsLeft = coverX - 14 - labelWidth >= IMAGE_X;
    ctx.textAlign = fitsLeft ? "right" : "left";
    ctx.fillText(label, fitsLeft ? coverX - 14 : Math.min(coverX + 14, IMAGE_RIGHT - labelWidth), 567);
    ctx.textAlign = "left";
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(coverX + (mode === "none" ? 1 : 0), 548);
    ctx.lineTo(coverX + (mode === "none" ? 1 : 0), barBottom);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Group labels on two alternating rows: "5.5 hrs" over "Design".
  const rows = [[], []];
  segments.forEach(function (s, i) {
    ctx.font = imageFont(40, 300);
    const number = calc.formatNumber(r.hours[s.group]);
    const numberWidth = ctx.measureText(number).width;
    ctx.font = imageFont(17, 400, true);
    const unit = isOne(r.hours[s.group]) ? "hr" : "hrs";
    const unitWidth = ctx.measureText(unit).width;
    ctx.font = imageFont(22, 400);
    const name = s.group === "production" ? PRODUCTION_NAMES[currentField()] : IMAGE_GROUP_NAMES[s.group];
    const width = Math.max(numberWidth + 6 + unitWidth, ctx.measureText(name).width);
    rows[i % 2].push({ segment: s, number: number, numberWidth: numberWidth, unit: unit, unitWidth: unitWidth,
      name: name, width: width, left: s.x - IMAGE_X });
  });
  rows.forEach(function (row, rowIndex) {
    const placed = calc.spreadLabels(row, IMAGE_RIGHT - IMAGE_X, 24).lefts;
    const numberY = rowIndex ? 946 : 853;
    row.forEach(function (item, i) {
      const left = IMAGE_X + placed[i];
      // Second row: a thin line from the bar down to the label, at the segment's
      // start, or its end, or its middle: the first one over the label.
      if (rowIndex) {
        const s = item.segment;
        const lineX = [s.x + 0.5, s.x + s.w - 0.5, s.x + s.w / 2].filter(function (at) {
          return at >= left - 1 && at <= left + item.width + 1;
        })[0] || s.x + s.w / 2;
        ctx.strokeStyle = IMAGE_COLORS.line;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(lineX, barBottom);
        ctx.lineTo(lineX, numberY - 40);
        ctx.stroke();
      }
      // A label pushed against the right end lines up with the bar's end.
      const alignRight = left + item.width >= IMAGE_RIGHT - 0.5 && Math.abs(left - item.segment.x) >= 1;
      ctx.fillStyle = ink;
      ctx.font = imageFont(40, 300);
      ctx.textAlign = "left";
      const numberLeft = alignRight ? IMAGE_RIGHT - item.numberWidth - 6 - item.unitWidth : left;
      ctx.fillText(item.number, numberLeft, numberY);
      ctx.fillStyle = ink2;
      ctx.font = imageFont(17, 400, true);
      if (alignRight) {
        ctx.textAlign = "right";
        ctx.fillText(item.unit, IMAGE_RIGHT, numberY);
      } else {
        ctx.fillText(item.unit, numberLeft + item.numberWidth + 6, numberY);
      }
      ctx.fillStyle = ink;
      ctx.font = imageFont(22, 400);
      ctx.fillText(item.name, alignRight ? IMAGE_RIGHT : left, numberY + 33);
      ctx.textAlign = "left";
    });
  });

  // Legend, only when the bar has both parts or only stripes.
  if (mode !== "all") {
    ctx.font = imageFont(22, 400);
    let legendX = IMAGE_X;
    if (mode === "part") {
      const swatch = ctx.createLinearGradient(legendX, 0, legendX + 30, 0);
      swatch.addColorStop(0, "#E9D7C6");
      swatch.addColorStop(1, "#E5603F");
      ctx.fillStyle = swatch;
      ctx.fillRect(legendX, 1015, 30, 16);
      ctx.fillStyle = ink;
      const text = "covered by " + calc.formatPrice(offer.amount);
      ctx.fillText(text, legendX + 40, 1030);
      legendX += 40 + ctx.measureText(text).width + 36;
    }
    drawStripes(ctx, legendX, 1015, 30, 16);
    ctx.fillStyle = ink;
    ctx.fillText("not covered", legendX + 40, 1030);
  }

  // My price, on a sunset panel.
  const panel = { x: IMAGE_X, y: 1060, w: IMAGE_RIGHT - IMAGE_X, h: 210 };
  ctx.save();
  roundedRect(ctx, panel.x, panel.y, panel.w, panel.h, 32);
  ctx.clip();
  drawSunset(ctx, panel.x, panel.y, panel.w, panel.h);
  ctx.restore();
  ctx.fillStyle = ink2;
  ctx.font = imageFont(26, 400);
  ctx.fillText("My price", panel.x + 40, 1119);
  ctx.fillStyle = ink;
  ctx.font = imageFont(110, 300);
  setSpacing(ctx, "-3px");
  ctx.fillText(calc.formatPrice(r.quote.amount), panel.x + 36, 1235);
  setSpacing(ctx, "0px");
  if (Math.abs(r.quote.amount - r.estimate) < 0.005) {
    ctx.fillStyle = ink2;
    ctx.font = imageFont(22, 400);
    ctx.textAlign = "right";
    const hoursLine = calc.formatHours(r.hours.total) + " at " + calc.formatPrice(r.rate) + "/hr";
    // With no expenses, only the hours line, on the lower row.
    if (r.expenses > 0) {
      ctx.fillText(hoursLine, panel.x + panel.w - 40, 1195);
      ctx.fillText("plus " + calc.formatPrice(r.expenses) + " in expenses", panel.x + panel.w - 40, 1227);
    } else {
      ctx.fillText(hoursLine, panel.x + panel.w - 40, 1227);
    }
    ctx.textAlign = "left";
  }

  ctx.fillStyle = ink2;
  ctx.font = imageFont(18, 400, true);
  ctx.fillText("Made with Counter", IMAGE_X, 1318);
}

// Waits for the fonts, so the image never falls back to a system font.
function makeShareImage() {
  const fonts = document.fonts;
  const ready = fonts ? Promise.all([
    fonts.ready,
    fonts.load(imageFont(88, 300)),
    fonts.load(imageFont(22, 400)),
    fonts.load(imageFont(34, 400)),
    fonts.load(imageFont(22, 400, true)),
  ]).catch(function () {}) : Promise.resolve();
  return ready.then(function () {
    const canvas = document.createElement("canvas");
    canvas.width = IMAGE_W;
    canvas.height = IMAGE_H;
    const picked = imageResult();
    drawShareImage(canvas, picked.r, picked.values);
    return canvas;
  });
}

// "counter-menu-310.png"
function imageFileName(r) {
  return "counter-" + currentJob() + "-" + calc.formatPrice(r.quote.amount).replace(/[$,]/g, "") + ".png";
}

function downloadImage(blob, name) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(function () { URL.revokeObjectURL(link.href); }, 10000);
  announce("Image saved");
}

// "Save image" draws the PNG once and shows it in a dialog. The dialog's main
// button downloads that same file (or shares it on a phone); nothing is redrawn.
let preparedImage = null;

function canShareFile(file) {
  return isPhone() && Boolean(file) && Boolean(navigator.canShare) && navigator.canShare({ files: [file] });
}

function saveImage() {
  if (!lastResult || !lastValues) return;
  const r = imageResult().r;
  const name = imageFileName(r);
  makeShareImage().then(function (canvas) {
    canvas.toBlob(function (blob) {
      if (!blob) return;
      const file = typeof File === "function" ? new File([blob], name, { type: "image/png" }) : null;
      if (preparedImage) URL.revokeObjectURL(preparedImage.url);
      preparedImage = { blob: blob, name: name, file: file, url: URL.createObjectURL(blob) };

      const price = calc.formatPrice(r.quote.amount);
      const preview = byId("image-preview");
      preview.src = preparedImage.url;
      preview.alt = "Image for your client: " + hoursInWords(r.hours.total) + " of work, price " + price;
      byId("image-dialog-text").textContent =
        "This is exactly what they'll see. It uses your price to send, " + price + ".";
      byId("image-save").textContent = canShareFile(file) ? "Share image" : "Download image";
      byId("image-dialog").showModal();
    }, "image/png");
  });
}

// The dialog's main button: share the file on a phone that can, otherwise download.
function deliverImage() {
  const image = preparedImage;
  if (!image) return;
  if (canShareFile(image.file)) {
    navigator.share({ files: [image.file] }).then(function () {
      announce("Image saved");
      byId("image-dialog").close();
    }, function (error) {
      if (error && error.name === "AbortError") return;
      downloadImage(image.blob, image.name);
      byId("image-dialog").close();
    });
  } else {
    downloadImage(image.blob, image.name);
    byId("image-dialog").close();
  }
}

