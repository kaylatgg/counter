const GROUP_NAMES = {
  production: "Production",
  communication: "Communication",
  revisions: "Revisions",
  delivery: "Delivery",
};

// Chart sizes from docs/DESIGN.md, in px.
const LABEL_SPACE = 8;
// The split label may come this close to its line, to fit.
const MIN_LABEL_SPACE = 6;
// Minimum space between two labels, in px.
const LABEL_GAP = 8;
// Room between a budget bar label and the edges of its part of the bar.
const BUDGET_LABEL_PAD = 16;

// A label's width, rounded up. offsetWidth rounds, so a 172.8px label read as
// 172 could end 0.8px past the chart's edge.
function labelWidth(element) {
  return Math.ceil(element.getBoundingClientRect().width);
}

function isOne(amount) {
  return calc.formatNumber(amount) === "1";
}

// Makes a parent hold exactly `count` children of one kind, reusing the ones
// already there, so values can animate from their old state.
function ensureChildren(parent, count, make) {
  while (parent.children.length < count) parent.appendChild(make());
  while (parent.children.length > count) parent.lastElementChild.remove();
  return Array.prototype.slice.call(parent.children);
}

// Places labels in one row with calc.spreadLabels so none overlap. Each item is
// { element, left } where left is the wanted left edge. If they can't all fit
// in one row, every second label drops to a second row. Returns true if it used two rows.
function placeLabels(items, width) {
  function place(row) {
    const result = calc.spreadLabels(row.map(function (item) {
      return { left: item.left, width: labelWidth(item.element) };
    }), width, LABEL_GAP);
    row.forEach(function (item, i) { item.element.style.left = result.lefts[i] + "px"; });
    return result.fits;
  }
  items.forEach(function (item) { item.element.classList.remove("second-row"); });
  if (place(items)) return false;
  const first = items.filter(function (item, i) { return i % 2 === 0; });
  const second = items.filter(function (item, i) { return i % 2 === 1; });
  second.forEach(function (item) { item.element.classList.add("second-row"); });
  place(first);
  place(second);
  return true;
}

// Chart 1: Where your hours go

// The offer's budget, when there's one to show: an offer that covers expenses.
function budgetFor(r) {
  return r.offer && !r.offer.belowExpenses ? r.offer : null;
}

function renderHoursChart(r) {
  const total = r.hours.total;
  const budget = budgetFor(r);
  byId("hours-title").textContent = "Where your " + hoursInWords(total) + " go";
  const sub = byId("hours-sub");
  show(sub, Boolean(budget));
  show(byId("budget"), Boolean(budget));
  if (budget) {
    sub.textContent = "How far " + calc.formatPrice(budget.amount - r.expenses) + " goes at your " +
      calc.formatPrice(r.rate) + " target";
  }

  // What screen readers get instead of the bars.
  const items = ensureChildren(byId("hours-list"), WORK_GROUPS.length, function () {
    return document.createElement("li");
  });
  WORK_GROUPS.forEach(function (group, i) {
    items[i].textContent = GROUP_NAMES[group] + ": " + calc.formatHours(r.hours[group]);
  });

  // By task: every group, even at 0 hrs. Widths follow hours (CSS flex-grow),
  // but never get narrower than the label.
  const tasks = ensureChildren(byId("group-legend"), WORK_GROUPS.length, function () {
    const item = document.createElement("li");
    item.innerHTML = '<span class="task-hours"><b></b><span class="unit"></span></span><span class="task-name"></span>';
    return item;
  });
  WORK_GROUPS.forEach(function (group, i) {
    const hours = r.hours[group];
    tasks[i].dataset.group = group;
    tasks[i].style.flexGrow = hours;
    tasks[i].querySelector("b").textContent = calc.formatNumber(hours);
    tasks[i].querySelector(".unit").textContent = isOne(hours) ? "hr" : "hrs";
    tasks[i].querySelector(".task-name").textContent = GROUP_NAMES[group];
  });

  const outside = r.outsideProduction;
  if (outside > 0) {
    setRichText(byId("hours-summary"), [[calc.formatHours(outside)],
      (isOne(outside) ? " is" : " are") + " outside production, the easiest to forget."]);
  } else {
    setRichText(byId("hours-summary"), ["All ", [calc.formatHours(total)], " are production."]);
  }

  layoutHoursChart(r);
}

// The budget bar: the hours the offer covers at the target (the gradient), then
// the rest. A charcoal line at the split, labeled. Labels that don't fit inside
// their part of the bar go under it.
function layoutHoursChart(r) {
  const budget = budgetFor(r);
  const bar = byId("budget-bar");
  const width = bar.clientWidth;
  if (!budget || !width) return;

  const total = r.hours.total;
  const all = budget.coversAllHours;
  const covered = all ? total : Math.max(0, budget.hoursCovered);
  const coveredWidth = (covered / total) * width;
  byId("budget-covered").style.width = coveredWidth + "px";
  bar.classList.toggle("all", all);

  const coveredLabel = byId("covered-label");
  const beyondLabel = byId("beyond-label");
  coveredLabel.textContent = all ? "All " + calc.formatHours(total) + " at your target"
    : calc.formatHours(covered) + " at your target";
  beyondLabel.textContent = calc.formatHours(total - covered) + " more than it covers";
  show(beyondLabel, !all);

  // Inside its part of the bar if it fits, otherwise under the bar, at the
  // part's left edge. Labels under the bar never overlap.
  const under = byId("budget-under");
  const parts = [
    { label: coveredLabel, inside: byId("budget-covered"), left: 0, width: coveredWidth },
  ];
  if (!all) parts.push({ label: beyondLabel, inside: byId("budget-beyond"), left: coveredWidth, width: width - coveredWidth });
  const moved = [];
  parts.forEach(function (part) {
    if (part.label.parentElement !== part.inside) part.inside.appendChild(part.label);
    part.label.style.left = "";
    if (labelWidth(part.label) + 2 * BUDGET_LABEL_PAD > part.width) {
      under.appendChild(part.label);
      moved.push({ element: part.label, left: part.left });
    }
  });
  under.classList.toggle("two-rows", moved.length ? placeLabels(moved, width) : false);
  show(under, moved.length > 0);

  // The split line and its label: left of the line, then right of it, 8px
  // away, then 6px. If neither fits, the label is centered on the line, inside
  // the chart, and the line starts 4px below it so it never runs through the text.
  const line = byId("budget-split");
  const lineLabel = byId("budget-split-label");
  show(line, !all);
  if (all) return;
  lineLabel.textContent = calc.formatPrice(budget.amount - r.expenses) + " covers up to here at " +
    calc.formatPrice(r.rate) + "/hr";
  line.style.left = coveredWidth + "px";
  line.style.top = "";
  line.style.height = "";
  lineLabel.style.left = "";
  lineLabel.style.right = "";
  lineLabel.style.top = "";
  const from = coveredWidth;
  const w = labelWidth(lineLabel);
  let side = null;
  [LABEL_SPACE, MIN_LABEL_SPACE].forEach(function (gap) {
    if (side) return;
    if (from - gap - w >= 0) side = { right: gap };
    else if (from + gap + w <= width) side = { left: gap };
  });
  if (side) {
    lineLabel.style.left = side.left !== undefined ? side.left + "px" : "auto";
    lineLabel.style.right = side.right !== undefined ? side.right + "px" : "auto";
  } else {
    lineLabel.style.left = (Math.max(0, Math.min(width - w, from - w / 2)) - from) + "px";
    lineLabel.style.right = "auto";
    const drop = lineLabel.offsetTop + lineLabel.offsetHeight + 4;
    const lineStyle = getComputedStyle(line);
    line.style.top = (parseFloat(lineStyle.top) + drop) + "px";
    line.style.height = (parseFloat(lineStyle.height) - drop) + "px";
    lineLabel.style.top = (lineLabel.offsetTop - drop) + "px";
  }
}

// Chart 2: Your rate drops as hours grow

// Hidden when the offer is at or below expenses: then the curve is flat or rises,
// which would contradict the title. The hero and the hours chart already explain it.
function showsRateChart(r) {
  return Boolean(r.offer) && r.offer.amount > r.expenses;
}

function renderOfferChart(r) {
  const chart = byId("offer-chart");
  show(chart, showsRateChart(r));
  byId("hours-chart").parentElement.classList.toggle("single", !showsRateChart(r));
  if (!showsRateChart(r)) return;
  const offer = r.offer;

  const items = byId("pay-list").children;
  items[0].textContent = "Offer, before expenses: " + calc.formatMoney(offer.hourlyBefore) + "/hr";
  items[1].textContent = "Offer, after " + calc.formatMoney(r.expenses) + " expenses: " +
    calc.formatMoney(offer.hourlyAfter) + "/hr";
  items[2].textContent = "Your target rate: " + calc.formatMoney(r.rate) + "/hr";

  byId("rate-sub").textContent = r.expenses > 0
    ? "After " + calc.formatPrice(r.expenses) + " in expenses, more hours means less per hour."
    : "More hours means less per hour.";

  // Under 1 hour, "only up to 0.04 hrs" is exact but hard to read.
  const target = calc.formatPrice(r.rate);
  byId("offer-summary").textContent = "After expenses, the offer pays " +
    calc.formatMoney(offer.hourlyAfter) + " an hour for " + hoursInWords(r.hours.total) + ". " +
    (offer.hoursCovered < 1
      ? "It stays below your " + target + " target for any job longer than an hour."
      : "It pays your " + target + " target or more " + (offer.coversAllHours ? "" : "only ") +
        "up to " + calc.formatHours(offer.hoursCovered) + ".");

  layoutRateChart(r, true);
}

// The smallest round step at least as big as rough: 0.25, 0.5, then 1, 2, 5 times a
// power of ten, with no top, so even millions of hours get a handful of lines.
function niceStep(rough) {
  if (rough <= 0.25) return 0.25;
  if (rough <= 0.5) return 0.5;
  let power = 1;
  while (power * 5 < rough) power *= 10;
  if (rough <= power) return power;
  if (rough <= power * 2) return power * 2;
  return power * 5;
}

const SVG_NS = "http://www.w3.org/2000/svg";

function svgElement(parent, name, attributes, text) {
  const element = document.createElementNS(SVG_NS, name);
  Object.keys(attributes).forEach(function (key) { element.setAttribute(key, attributes[key]); });
  if (text) element.textContent = text;
  parent.appendChild(element);
  return element;
}

// After expenses, the offer divided by hours, from about a third of the current
// hours to 1.4 times. It meets the target at the same point the hours chart's
// money runs out.
// morph: a live change, so the curve and dots tween from where they were (250ms).
function layoutRateChart(r, morph) {
  const plot = byId("rate-plot");
  const width = plot.clientWidth;
  if (!width) return;
  const height = isPhone() ? 170 : 210;
  // pad.left is set below, from the widest y label.
  const pad = { left: 0, right: 4, top: 12, bottom: 26 };
  const offer = r.offer;
  const total = r.hours.total;
  const net = offer.amount - r.expenses;
  function value(hours) { return net / hours; }

  // Hours across: grid lines on a round step.
  const step = niceStep((total * 1.4 - total / 3) / 7);
  let x0 = Math.ceil((total / 3) / step) * step;
  if (x0 <= 0) x0 = step;
  let x1 = Math.floor((total * 1.4) / step) * step;
  if (x1 <= total) x1 = Math.ceil(total / step) * step + step;
  if (x0 >= total) x0 = Math.max(step, Math.floor(total / step) * step - step);

  // Dollars per hour up: $0, the target, and a round top value. Below $0 when
  // the offer doesn't cover the expenses.
  const top = calc.rulerScale(Math.max(value(x0), r.rate)).max;
  const bottom = net < 0 ? -calc.rulerScale(-value(x0)).max : 0;
  function px(hours) { return pad.left + ((hours - x0) / (x1 - x0)) * (width - pad.left - pad.right); }
  function py(amount) { return pad.top + ((top - amount) / (top - bottom)) * (height - pad.top - pad.bottom); }

  plot.textContent = "";
  const svg = svgElement(plot, "svg", { width: width, height: height, viewBox: "0 0 " + width + " " + height,
    "aria-hidden": "true", focusable: "false" });

  // Y labels: the target always; $0, the top, and the bottom only where they
  // don't crowd it. The space left of the plot is the widest of them plus 8px,
  // so none is ever cut off ("$1,250" needs more room than "$50").
  const yLabels = [[r.rate, calc.formatPrice(r.rate)]];
  [[0, "$0"], [top, calc.formatPrice(top)], [bottom, "-" + calc.formatPrice(-bottom)]]
    .forEach(function (item) {
      if (item[0] === r.rate || (item[0] === bottom && bottom >= 0)) return;
      if (Math.abs(py(item[0]) - py(r.rate)) >= 16) yLabels.push(item);
    });
  const yTexts = yLabels.map(function (item) {
    return svgElement(svg, "text", { class: "rate-tick", y: py(item[0]) + 4, "text-anchor": "end" }, item[1]);
  });
  pad.left = Math.ceil(Math.max.apply(null, yTexts.map(function (text) { return text.getBBox().width; }))) + 8;
  yTexts.forEach(function (text) { text.setAttribute("x", pad.left - 8); });

  for (let h = x0; h <= x1 + 1e-9; h += step) {
    svgElement(svg, "line", { class: "rate-grid", x1: px(h), x2: px(h), y1: pad.top, y2: height - pad.bottom });
    const tick = svgElement(svg, "text", { class: "rate-tick", x: px(h), y: height - 6, "text-anchor": "middle" },
      calc.formatNumber(h) + "h");
    // The ticks at the ends line up with the edge instead of hanging past it.
    const box = tick.getBBox();
    if (box.x + box.width > width) {
      tick.setAttribute("x", width);
      tick.setAttribute("text-anchor", "end");
    } else if (box.x < 0) {
      tick.setAttribute("x", 0);
      tick.setAttribute("text-anchor", "start");
    }
  }

  if (bottom < 0) {
    svgElement(svg, "line", { class: "rate-zero", x1: pad.left, x2: width - pad.right, y1: py(0), y2: py(0) });
  }

  // The target: a solid line. Its label is placed after the dots' labels.
  const targetY = py(r.rate);
  svgElement(svg, "line", { class: "rate-target", x1: pad.left, x2: width - pad.right, y1: targetY, y2: targetY });

  // The curve, and the area between it and the target where it's below the
  // target (drawn first, so the lines sit on top of it).
  const points = [];
  const samples = [];
  for (let i = 0; i <= 80; i++) {
    const h = x0 + ((x1 - x0) * i) / 80;
    samples.push({ x: px(h), y: py(value(h)) });
    points.push((i ? "L" : "M") + px(h).toFixed(1) + " " + py(value(h)).toFixed(1));
  }
  const short = svgElement(svg, "path", { class: "rate-short", d: shortArea(samples, targetY) });
  svg.insertBefore(short, svg.querySelector(".rate-target"));
  const curve = svgElement(svg, "path", { class: "rate-curve", d: points.join(" ") });

  // Labels never overlap each other. They're placed in priority order: the
  // current-hours label, then the target, then the target crossing. Each may
  // only use a spot inside the chart and clear of every label placed before it;
  // of those, it takes the one touching the least (dots, then axis labels, then
  // the curve, then the target line), the earlier spot on a tie. With no allowed spot, the
  // label is hidden from the drawing; the summary under the chart still says it.
  // The target label is never hidden (see below).
  // Axis labels come last: one that a label covers is hidden.
  const placed = [];
  const marks = [];
  function touches(a, b, gap) {
    return a.x < b.x + b.width + gap && b.x < a.x + a.width + gap &&
      a.y < b.y + b.height + gap && b.y < a.y + a.height + gap;
  }
  function allowed(box, keepClear) {
    if (box.x < 0 || box.x + box.width > width || box.y < 0 || box.y + box.height > height - pad.bottom) return false;
    return !placed.concat(keepClear || []).some(function (other) { return touches(box, other, 4); });
  }
  // While the current-hours label is placed, it also avoids the strip along the
  // target line when it can, so the target label (next) has room there.
  let avoidTargetBand = false;
  function conflicts(box) {
    let score = 0;
    if (avoidTargetBand && box.y < targetY + 24 && box.y + box.height > targetY - 24) score += 8;
    marks.forEach(function (mark) { if (touches(box, mark, 4)) score += 20; });
    yTexts.forEach(function (text) { if (touches(box, text.getBBox(), 4)) score += 10; });
    const hitsCurve = samples.some(function (point) {
      return point.x > box.x - 3 && point.x < box.x + box.width + 3 &&
        point.y > box.y - 3 && point.y < box.y + box.height + 3;
    });
    if (hitsCurve) score += 5;
    if (targetY > box.y - 3 && targetY < box.y + box.height + 3) score += 2;
    return score;
  }
  // spots: [x, y, anchor] in order of preference. An anchor of "fit" centers the
  // label on x but slides it sideways to stay inside the chart, so a label is
  // never cut off at the edge: it's tried after the others, above and below.
  function placeText(label, spots, keepTrying, keepClear) {
    label.setAttribute("text-anchor", "start");
    const labelWidth = label.getBBox().width;
    let best = null;
    spots.forEach(function (spot) {
      if (spot[2] === "fit") {
        const left = Math.max(0, Math.min(width - labelWidth, spot[0] - labelWidth / 2));
        spot = [left, spot[1], "start"];
      }
      label.setAttribute("x", spot[0]);
      label.setAttribute("y", spot[1]);
      label.setAttribute("text-anchor", spot[2]);
      const box = label.getBBox();
      if (!allowed(box, keepClear)) return;
      const score = conflicts(box);
      if (!best || score < best.score) best = { spot: spot, score: score };
    });
    if (!best) {
      if (!keepTrying) label.setAttribute("display", "none");
      return false;
    }
    label.setAttribute("x", best.spot[0]);
    label.setAttribute("y", best.spot[1]);
    label.setAttribute("text-anchor", best.spot[2]);
    placed.push(label.getBBox());
    return true;
  }

  // Now: a coral dot with a soft halo at the current hours.
  const dotX = px(total);
  const dotY = py(value(total));
  const dot = svgElement(svg, "g", { class: "rate-now" });
  svgElement(dot, "circle", { class: "rate-halo", cx: dotX, cy: dotY, r: 12 });
  svgElement(dot, "circle", { class: "rate-dot", cx: dotX, cy: dotY, r: 6 });
  marks.push({ x: dotX - 12, y: dotY - 12, width: 24, height: 24 });

  // Where the curve meets the target: the same hours as "runs out".
  let cross = null;
  if (net > 0 && offer.hoursCovered >= x0 && offer.hoursCovered <= x1) {
    cross = px(offer.hoursCovered);
    svgElement(svg, "circle", { class: "rate-cross", cx: cross, cy: targetY, r: 4.5 });
    marks.push({ x: cross - 5, y: targetY - 5, width: 10, height: 10 });
  }

  const nowLabel = svgElement(svg, "text", { class: "rate-label rate-now-label" },
    calc.formatNumber(total) + "h → " + calc.formatMoney(value(total)) + "/hr after expenses");
  avoidTargetBand = true;
  placeText(nowLabel, [
    [dotX + 14, dotY + 28, "start"], [dotX + 18, dotY - 18, "start"],
    [dotX - 14, dotY + 28, "end"], [dotX - 18, dotY - 18, "end"],
    [dotX, dotY + 30, "middle"], [dotX, dotY - 22, "middle"],
    [dotX - 18, dotY - 34, "end"], [dotX + 18, dotY - 34, "start"],
    [dotX, dotY - 38, "middle"], [dotX, dotY + 44, "middle"],
    [dotX, dotY - 22, "fit"], [dotX, dotY + 30, "fit"],
    [dotX, dotY - 38, "fit"], [dotX, dotY + 44, "fit"],
  ]);

  avoidTargetBand = false;
  // The target's label comes next, and is never hidden: right or left end of
  // the line, above or below it, then the chart's left edge (over the y labels'
  // column). If the full label fits nowhere, the short "target" tries the same
  // spots, but only ones that leave the y axis's "$25" showing: the target's
  // value always shows somewhere. Failing that, the full label slides along the
  // line, above and below it, to any spot that's clear.
  const targetLabel = svgElement(svg, "text", { class: "rate-label rate-target-label" },
    "your target " + calc.formatPrice(r.rate) + "/hr");
  const targetSpots = [
    [width - pad.right, targetY - 8, "end"], [pad.left + 4, targetY - 8, "start"],
    [width - pad.right, targetY + 16, "end"], [pad.left + 4, targetY + 16, "start"],
    [width - pad.right, targetY - 24, "end"], [pad.left + 4, targetY - 24, "start"],
    [width - pad.right, targetY + 32, "end"], [pad.left + 4, targetY + 32, "start"],
    [0, targetY - 8, "start"], [0, targetY + 16, "start"],
  ];
  if (!placeText(targetLabel, targetSpots, true)) {
    const fullText = targetLabel.textContent;
    targetLabel.textContent = "target";
    if (!placeText(targetLabel, targetSpots, true, [yTexts[0].getBBox()])) {
      targetLabel.textContent = fullText;
      const slides = [];
      [-8, 16, -24, 32].forEach(function (dy) {
        for (let x = 0; x <= width; x += 4) slides.push([x, targetY + dy, "start"]);
      });
      placeText(targetLabel, slides);
    }
  }

  if (cross !== null) {
    const crossLabel = svgElement(svg, "text", { class: "rate-label rate-cross-label" },
      "at " + calc.formatNumber(offer.hoursCovered) + "h you hit " + calc.formatPrice(r.rate));
    placeText(crossLabel, [
      [cross - 8, targetY - 8, "end"], [cross + 8, targetY - 8, "start"],
      [cross - 8, targetY + 16, "end"], [cross + 8, targetY + 16, "start"],
      [cross - 8, targetY - 24, "end"], [cross - 8, targetY + 32, "end"],
      [cross, targetY - 24, "middle"], [cross, targetY + 32, "middle"],
      [cross, targetY - 8, "fit"], [cross, targetY + 16, "fit"],
      [cross, targetY - 24, "fit"], [cross, targetY + 32, "fit"],
    ]);
  }

  // Axis labels last: any that a label covers is hidden.
  svg.querySelectorAll(".rate-tick").forEach(function (text) {
    const box = text.getBBox();
    if (placed.some(function (other) { return touches(box, other, 2); })) text.setAttribute("display", "none");
  });

  // Live change: the curve and dots move from their old places to the new ones.
  const geometry = { samples: samples, dot: { x: dotX, y: dotY }, cross: cross, targetY: targetY };
  if (morph && rateGeometry && canMove()) {
    const from = rateGeometry;
    const dotParts = dot.querySelectorAll("circle");
    const crossDot = svg.querySelector(".rate-cross");
    tween(MORPH_MS, function (t) {
      const moving = samples.map(function (point, i) {
        const old = from.samples[i] || point;
        return { x: mix(old.x, point.x, t), y: mix(old.y, point.y, t) };
      });
      curve.setAttribute("d", moving.map(function (point, i) {
        return (i ? "L" : "M") + point.x.toFixed(1) + " " + point.y.toFixed(1);
      }).join(" "));
      short.setAttribute("d", shortArea(moving, mix(from.targetY, targetY, t)));
      dotParts.forEach(function (circle) {
        circle.setAttribute("cx", mix(from.dot.x, dotX, t));
        circle.setAttribute("cy", mix(from.dot.y, dotY, t));
      });
      if (crossDot && from.cross !== null) crossDot.setAttribute("cx", mix(from.cross, cross, t));
    });
  }
  rateGeometry = geometry;

  // What scrubbing needs: the hours range and where things go.
  rateView = { r: r, svg: svg, x0: x0, x1: x1, px: px, py: py, value: value, width: width, pad: pad,
    height: height };
  plot.setAttribute("aria-valuemin", x0);
  plot.setAttribute("aria-valuemax", x1);
  if (scrubHours === null || scrubHours < x0 || scrubHours > x1) scrubHours = Math.round(total * 2) / 2;
  if (scrubShown) drawScrub();
  else setScrubValue();
}

// The area between the target line and the curve, where the curve is below
// the target (larger y in the drawing). Above it, the area has no height.
function shortArea(samples, targetY) {
  const last = samples[samples.length - 1];
  return samples.map(function (point, i) {
    return (i ? "L" : "M") + point.x.toFixed(1) + " " + Math.max(point.y, targetY).toFixed(1);
  }).join(" ") + " L" + last.x.toFixed(1) + " " + targetY.toFixed(1) +
    " L" + samples[0].x.toFixed(1) + " " + targetY.toFixed(1) + " Z";
}

// Scrubbing the rate chart: a line, a dot on the curve, and "14h → $12.86/hr",
// snapping to half hours. Pointer: hover or drag. Keyboard: the chart is a
// slider; left and right move half an hour, Escape hides the line.
let rateView = null;
let rateGeometry = null;
let scrubHours = null;
let scrubShown = false;

function setScrubValue() {
  const plot = byId("rate-plot");
  if (!rateView || scrubHours === null) return;
  const pay = rateView.value(scrubHours);
  plot.setAttribute("aria-valuenow", scrubHours);
  plot.setAttribute("aria-valuetext", "At " + hoursInWords(scrubHours) + ", the offer pays " +
    calc.formatMoney(pay) + " an hour after expenses.");
}

function drawScrub() {
  const view = rateView;
  if (!view) return;
  const old = view.svg.querySelector(".rate-scrub");
  if (old) old.remove();
  setScrubValue();
  if (!scrubShown) return;
  const x = view.px(scrubHours);
  const pay = view.value(scrubHours);
  const y = view.py(pay);
  const group = svgElement(view.svg, "g", { class: "rate-scrub" });
  svgElement(group, "line", { class: "rate-scrub-line", x1: x, x2: x, y1: view.pad.top, y2: view.height - view.pad.bottom });
  svgElement(group, "circle", { class: "rate-scrub-dot", cx: x, cy: y, r: 5 });
  const label = svgElement(group, "text", { class: "rate-label rate-scrub-label", y: Math.max(view.pad.top + 10, y - 14) },
    calc.formatNumber(scrubHours) + "h → " + calc.formatMoney(pay) + "/hr");
  // Right of the line, or left of it near the right edge.
  label.setAttribute("x", x + 10);
  label.setAttribute("text-anchor", "start");
  if (x + 10 + label.getBBox().width > view.width) {
    label.setAttribute("x", x - 10);
    label.setAttribute("text-anchor", "end");
  }
}

function scrubTo(hours) {
  if (!rateView) return;
  scrubHours = Math.max(rateView.x0, Math.min(rateView.x1, Math.round(hours * 2) / 2));
  scrubShown = true;
  drawScrub();
}

function hideScrub() {
  scrubShown = false;
  drawScrub();
}

function hoursAtPointer(event) {
  const view = rateView;
  const box = byId("rate-plot").getBoundingClientRect();
  const x = event.clientX - box.left;
  return view.x0 + ((x - view.pad.left) / (view.width - view.pad.left - view.pad.right)) * (view.x1 - view.x0);
}

// "1 page", "2 concepts"
function countOf(amount, singular, plural) {
  return calc.formatNumber(amount) + " " + (amount === 1 ? singular : plural);
}

function renderReceipt(r, values) {
  const rows = [
    ["Production",
      calc.formatHours(values.setupHours) + " + " + countOf(values.count, job().item, job().items) +
        " x " + calc.formatHours(values.itemHours),
      calc.formatHours(r.hours.production)],
    ["Communication", "", calc.formatHours(r.hours.communication)],
    ["Revisions",
      countOf(values.rounds, "round", "rounds") + " x " + calc.formatHours(values.roundHours),
      calc.formatHours(r.hours.revisions)],
    ["Delivery", "", calc.formatHours(r.hours.delivery)],
    ["Total hours", "", calc.formatHours(r.hours.total), "sum"],
    ["Your time",
      calc.formatHours(r.hours.total) + " x " + calc.formatPrice(r.rate) + "/hr",
      calc.formatMoney(r.timeCost)],
    ["Expenses", "", calc.formatMoney(r.expenses)],
    ["Subtotal", "", calc.formatMoney(r.subtotal), "sum"],
    ["Rounded up to the nearest $5", "", "+" + calc.formatMoney(r.rounding)],
    ["Your estimate", "", calc.formatWholeMoney(r.estimate), "total"],
  ];

  byId("math-estimate").textContent = calc.formatWholeMoney(r.estimate);

  const body = byId("receipt-rows");
  body.textContent = "";
  rows.forEach(function (row) {
    const tr = document.createElement("tr");
    tr.setAttribute("role", "row");
    if (row[3]) tr.className = row[3];
    const th = document.createElement("th");
    th.scope = "row";
    th.setAttribute("role", "rowheader");
    th.textContent = row[0];
    const amount = document.createElement("td");
    amount.setAttribute("role", "cell");
    amount.textContent = row[2];
    // The final row has no math, so its larger label can use that column too.
    if (row[3] === "total") {
      th.colSpan = 2;
      tr.append(th, amount);
    } else {
      const math = document.createElement("td");
      math.setAttribute("role", "cell");
      math.textContent = row[1];
      tr.append(th, math, amount);
    }
    body.appendChild(tr);
  });
}

function renderQuote(r, quoteError) {
  const line = byId("quote-result");
  const followsOffer = r.quote.defaultsTo === "offer";
  byId("quote").placeholder = calc.groupDigits(String(followsOffer ? r.offer.amount : r.estimate));
  byId("quote-hint").textContent = "Leave blank to use " + (followsOffer ? "their offer" : "your estimate") +
    ". This won't change your estimate or your target.";
  show(line, !quoteError);
  if (quoteError) return;

  const price = calc.formatPrice(r.quote.amount);
  // With a way to close the gap picked, the price is for that option's hours.
  const option = pickedOption();
  const hours = option ? option.hours : r.hours.total;
  let text = "At " + price + ", you'd earn " + calc.formatMoney(r.quote.amount / hours) +
    "/hr before expenses and " + calc.formatMoney((r.quote.amount - r.expenses) / hours) + "/hr after.";
  const difference = r.quote.differenceFromEstimate;
  if (r.quote.isCustom && difference !== 0) {
    text += " That's " + calc.formatPrice(Math.abs(difference)) +
      (difference < 0 ? " below" : " above") + " your estimate.";
  }
  line.textContent = text;
}

