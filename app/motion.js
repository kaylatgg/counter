// Motion helpers. One ease for everything (DESIGN.md): cubic-bezier(.2,.7,.2,1).
const MORPH_MS = 250;

function canMove() {
  return !reduceMotion.matches && Boolean(Element.prototype.animate);
}

function mix(from, to, t) {
  return from + (to - from) * t;
}

// cubic-bezier(.2,.7,.2,1), solved for x by a few Newton steps.
function ease(x) {
  if (x <= 0 || x >= 1) return x;
  const ax = 0.2, bx = 0.2, ay = 0.7, by = 1;
  function curve(t, p1, p2) { return 3 * (1 - t) * (1 - t) * t * p1 + 3 * (1 - t) * t * t * p2 + t * t * t; }
  function slope(t, p1, p2) { return 3 * (1 - t) * (1 - t) * p1 + 6 * (1 - t) * t * (p2 - p1) + 3 * t * t * (1 - p2); }
  let t = x;
  for (let i = 0; i < 6; i++) {
    const d = slope(t, ax, bx);
    if (Math.abs(d) < 1e-6) break;
    t -= (curve(t, ax, bx) - x) / d;
  }
  return curve(Math.max(0, Math.min(1, t)), ay, by);
}
const EASE = "cubic-bezier(.2,.7,.2,1)";

// Tweens a value from 0 to 1. Under reduced motion it lands at once.
// Returns a function that jumps to the end.
let runningTweens = [];

function tween(ms, step, done) {
  if (!canMove()) {
    step(1);
    if (done) done();
    return function () {};
  }
  const started = performance.now();
  let frame = null;
  let over = false;
  function finish() {
    if (over) return;
    over = true;
    cancelAnimationFrame(frame);
    step(1);
    runningTweens = runningTweens.filter(function (f) { return f !== finish; });
    if (done) done();
  }
  function tick(now) {
    const t = Math.min(1, (now - started) / ms);
    if (t >= 1) { finish(); return; }
    step(ease(t));
    frame = requestAnimationFrame(tick);
  }
  frame = requestAnimationFrame(tick);
  runningTweens.push(finish);
  return finish;
}

// Web Animations with the shared ease. fill "backwards" hides a delayed part
// until its turn, and the final look is always the element's own styles.
function animate(element, frames, options) {
  if (!element || !canMove()) return null;
  return element.animate(frames, Object.assign({ easing: EASE, fill: "backwards" }, options));
}

// Plays once each time screen 2 is shown: the hero, the stats, the hours chart,
// and the rate chart (DESIGN.md, Motion).
// - Arm before screen 2 appears: whenever screen 2 is shown (Check the offer,
//   a shared link, a saved project, Back), every block switches to its starting
//   state in the same step that shows the screen, so its first frame is already
//   the start. Nothing is ever seen finished and then reset.
// - Each block plays when 35% of it is visible (for the charts, 35% of the
//   drawing itself), one after another through the queue below. A block that's
//   35% visible when screen 2 appears plays right away (after the reveal).
// - A block the person scrolls past (it leaves the top of the screen before it
//   plays) jumps to its final state. So does any armed block on a live change.
// Starting states are set by script, so without scripts (or under reduced
// motion) everything stays in its final state.
const PLAY_THRESHOLD = 0.35;
const PLAYS = {
  "hero-panel": playHero,
  metrics: playStats,
  "hours-chart": playHours,
  "offer-chart": playRate,
};
const ARMS = {
  "hero-panel": armHero,
  metrics: armStats,
  "hours-chart": armHours,
  "offer-chart": armRate,
};
// What the observer watches for each block: the drawing itself for the charts
// (the bars area, the plot), so headings and legends don't count.
const WATCH = {
  "hero-panel": "hero-panel",
  metrics: "metrics",
  "hours-chart": "bars",
  "offer-chart": "rate-plot",
};

function watched(id) {
  return byId(WATCH[id]);
}

function blockOf(element) {
  return Object.keys(WATCH).filter(function (id) { return WATCH[id] === element.id; })[0];
}

// For each block: "armed", "queued", "played", or "final".
let blockState = {};
let playObserver = null;
let playTimers = [];

// Screen 2 is being shown: forget what played, and arm every block that's on
// the page. Runs in the same step that shows the screen, before it's painted.
function armPlays() {
  finishPlays();
  blockState = {};
  lastPlay = { id: null, at: -Infinity };
  scrubHours = null;
  if (playObserver) playObserver.disconnect();
  if (!canMove() || !window.IntersectionObserver) return;
  Object.keys(ARMS).forEach(function (id) {
    const block = byId(id);
    if (block.hidden || block.closest("[hidden]")) return;
    blockState[id] = "armed";
    ARMS[id]();
  });
}

// Blocks play one after another, in page order, at least 200ms apart. The rate
// chart waits for the hours chart's fill to finish (wipe 400ms + fill 700ms).
const PLAY_ORDER = ["hero-panel", "metrics", "hours-chart", "offer-chart"];
const PLAY_GAP_MS = 200;
const HOURS_FILL_DONE_MS = 1100;
let playQueue = [];
let queueTimer = null;
let lastPlay = { id: null, at: -Infinity };

function gapAfter(previous, id) {
  return previous === "hours-chart" && id === "offer-chart" ? HOURS_FILL_DONE_MS : PLAY_GAP_MS;
}

function queuePlay(id) {
  blockState[id] = "queued";
  playQueue.push(id);
  playQueue.sort(function (a, b) { return PLAY_ORDER.indexOf(a) - PLAY_ORDER.indexOf(b); });
  pumpPlays();
}

function pumpPlays() {
  if (queueTimer !== null || !playQueue.length) return;
  const wait = Math.max(0, lastPlay.at + gapAfter(lastPlay.id, playQueue[0]) - performance.now());
  queueTimer = setTimeout(function () {
    queueTimer = null;
    const id = playQueue.shift();
    if (blockState[id] !== "queued") { pumpPlays(); return; }
    blockState[id] = "played";
    if (playObserver) playObserver.unobserve(watched(id));
    lastPlay = { id: id, at: performance.now() };
    PLAYS[id]();
    pumpPlays();
  }, wait);
}

function clearPlayQueue() {
  clearTimeout(queueTimer);
  queueTimer = null;
  playQueue = [];
}

// Plays start at t=0: when screen 2 is fully visible (after the reveal, or right away).
function startPlays() {
  if (!canMove() || !window.IntersectionObserver) return;
  if (!playObserver) {
    playObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        const id = blockOf(entry.target);
        const state = blockState[id];
        if (state !== "armed" && state !== "queued") return;
        // Scrolled past before it played: straight to its final state.
        if (!entry.isIntersecting && entry.boundingClientRect.bottom <= 0) {
          playObserver.unobserve(entry.target);
          finalizeBlock(id);
          return;
        }
        if (state === "armed" && entry.isIntersecting && entry.intersectionRatio >= PLAY_THRESHOLD) queuePlay(id);
      });
    }, { threshold: [0, PLAY_THRESHOLD] });
  }
  Object.keys(PLAYS).forEach(function (id) {
    if (blockState[id] === "armed") playObserver.observe(watched(id));
  });
}

// A jump from below the screen to above it crosses no threshold, so the
// observer never hears about it. A light scroll check catches those.
let pastFrame = null;

function finalizeScrolledPast() {
  pastFrame = null;
  Object.keys(blockState).forEach(function (id) {
    const state = blockState[id];
    if ((state === "armed" || state === "queued") && watched(id).getBoundingClientRect().bottom <= 0) {
      if (playObserver) playObserver.unobserve(watched(id));
      finalizeBlock(id);
    }
  });
}

window.addEventListener("scroll", function () {
  if (pastFrame === null) pastFrame = requestAnimationFrame(finalizeScrolledPast);
}, { passive: true });

// One block straight to its final state, without playing.
function finalizeBlock(id) {
  blockState[id] = "final";
  playQueue = playQueue.filter(function (queued) { return queued !== id; });
  if (id === "hero-panel") {
    if (lastResult && !byId("result-summary").hidden) paintHeroNumber(lastResult, heroValue(lastResult));
  } else {
    byId(id).classList.remove("armed");
    if (id === "metrics") renderStatNumbers();
  }
}

// Armed blocks that won't play after all (a live change) go to their final state.
function disarm() {
  clearPlayQueue();
  Object.keys(blockState).forEach(function (id) {
    if (blockState[id] === "armed" || blockState[id] === "queued") finalizeBlock(id);
  });
}

function later(ms, fn) {
  playTimers.push(setTimeout(fn, ms));
}

// Anything still playing jumps to its end: a live change, or leaving the screen.
function finishPlays() {
  playTimers.forEach(clearTimeout);
  playTimers = [];
  runningTweens.slice().forEach(function (finish) { finish(); });
  stopCountUp();
  if (lastResult && byId("hero-amount")) paintHeroNumber(lastResult, heroValue(lastResult));
  byId("result").getAnimations({ subtree: true }).forEach(function (animation) { animation.finish(); });
  byId("metrics").classList.remove("play");
  disarm();
  renderStatNumbers();
}

// Starting states, set while the block is still below the screen.
function armHero() {
  if (lastResult && !byId("result-summary").hidden) paintHeroNumber(lastResult, 0);
}

function armStats() {
  byId("metrics").classList.add("armed");
  document.querySelectorAll("#metrics .stat-number").forEach(function (number, i) {
    const item = shownStats[i];
    if (item && typeof item.number === "number") number.textContent = item.format(0);
  });
}

// No bar yet (it wipes in, then fills), and the line and labels wait.
function armHours() {
  byId("hours-chart").classList.add("armed");
}

// Nothing yet: the grid, target, curve, and dots each take their turn.
function armRate() {
  byId("offer-chart").classList.add("armed");
}

function playHero() {
  if (lastResult && !byId("result-summary").hidden) countUpHero(lastResult);
}

// Hairlines draw left to right (CSS), numbers count up 700ms, 80ms apart.
function playStats() {
  const metrics = byId("metrics");
  metrics.classList.add("play");
  metrics.classList.remove("armed");
  later(500, function () { metrics.classList.remove("play"); });
  metrics.querySelectorAll(".stat-number").forEach(function (number, i) {
    const item = shownStats[i];
    if (!item || typeof item.number !== "number") return;
    number.textContent = item.format(0);
    later(i * 80, function () {
      tween(COUNT_UP_MS, function (t) { number.textContent = item.format(item.number * t); },
        function () { number.textContent = item.value; });
    });
  });
}

// The hours chart acts out the finding, one step after another (DESIGN.md):
// the bar wipes in (400ms) as all hours past the budget, the gradient fills
// from the left and stops where the budget runs out (700ms), the split line
// drops in (200ms), then the labels and By task rise in, 60ms apart. Only
// clip-path, opacity, and transform move. With no budget bar, only By task plays.
const HOURS_WIPE_MS = 400;
const HOURS_FILL_MS = 700;
const HOURS_LINE_MS = 200;
const HOURS_LABEL_MS = 300;
const HOURS_LABEL_GAP_MS = 60;

function playHours() {
  const chart = byId("hours-chart");
  const hasBudget = !byId("budget").hidden;
  const lineAt = hasBudget ? HOURS_WIPE_MS + HOURS_FILL_MS : 0;
  const labelsAt = hasBudget ? lineAt + HOURS_LINE_MS : 0;

  // From armed to playing in one frame: every animation starts in the armed look.
  chart.classList.remove("armed");
  if (hasBudget) {
    animate(byId("budget-bar"), [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }],
      { duration: HOURS_WIPE_MS });
    animate(byId("budget-covered"), [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }],
      { duration: HOURS_FILL_MS, delay: HOURS_WIPE_MS });
    animate(byId("budget-split"), [{ opacity: 0, transform: "translateY(-8px)" }, { opacity: 1, transform: "none" }],
      { duration: HOURS_LINE_MS, delay: lineAt });
  }
  const labels = Array.prototype.slice.call(chart.querySelectorAll(".budget-label, .by-task-title, #group-legend li"))
    .filter(function (label) { return label.offsetParent; });
  labels.forEach(function (label, i) {
    // Labels inside the bar are centered with a transform, so they only fade.
    const inBar = label.classList.contains("budget-label") && !label.closest("#budget-under");
    const frames = inBar ? [{ opacity: 0 }, { opacity: 1 }]
      : [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }];
    animate(label, frames, { duration: HOURS_LABEL_MS, delay: labelsAt + i * HOURS_LABEL_GAP_MS });
  });
}

// The rate chart: the grid fades in (200ms), the target line draws (300ms), the
// curve draws left to right (900ms) so you watch the rate fall while the area
// below the target fades in, the charcoal dot pops as the curve reaches it, and
// the coral dot lands last with one halo pulse.
const RATE_GRID_MS = 200;
const RATE_TARGET_MS = 300;
const RATE_CURVE_MS = 900;

function playRate() {
  const svg = byId("rate-plot").querySelector("svg");
  byId("offer-chart").classList.remove("armed");
  if (!svg) return;
  const targetAt = RATE_GRID_MS;
  const curveAt = targetAt + RATE_TARGET_MS;
  const dotAt = curveAt + RATE_CURVE_MS;

  svg.querySelectorAll(".rate-grid, .rate-tick, .rate-zero").forEach(function (part) {
    animate(part, [{ opacity: 0 }, { opacity: 1 }], { duration: RATE_GRID_MS });
  });
  const target = svg.querySelector(".rate-target");
  const targetLength = Math.abs(target.x2.baseVal.value - target.x1.baseVal.value);
  animate(target, [{ strokeDasharray: targetLength + " " + targetLength, strokeDashoffset: targetLength },
    { strokeDasharray: targetLength + " " + targetLength, strokeDashoffset: 0 }], { duration: RATE_TARGET_MS, delay: targetAt });
  animate(svg.querySelector(".rate-target-label"), [{ opacity: 0 }, { opacity: 1 }], { duration: RATE_TARGET_MS, delay: targetAt });

  const curve = svg.querySelector(".rate-curve");
  const length = curve.getTotalLength();
  animate(curve, [{ strokeDasharray: length + " " + length, strokeDashoffset: length },
    { strokeDasharray: length + " " + length, strokeDashoffset: 0 }], { duration: RATE_CURVE_MS, delay: curveAt });
  animate(svg.querySelector(".rate-short"), [{ opacity: 0 }, { opacity: 1 }], { duration: RATE_CURVE_MS, delay: curveAt });

  const cross = svg.querySelector(".rate-cross");
  if (cross && rateView) {
    const share = Math.max(0, Math.min(1, (cross.cx.baseVal.value - rateView.pad.left) /
      (rateView.width - rateView.pad.left - rateView.pad.right)));
    const at = curveAt + RATE_CURVE_MS * Math.pow(share, 0.7);
    animate(cross, [{ transform: "scale(0)" }, { transform: "scale(1.4)" }, { transform: "scale(1)" }],
      { duration: 260, delay: at, easing: "ease-out" });
    animate(svg.querySelector(".rate-cross-label"), [{ opacity: 0 }, { opacity: 1 }], { duration: 250, delay: at });
  }

  animate(svg.querySelector(".rate-dot"), [{ transform: "scale(0)" }, { transform: "scale(1)" }],
    { duration: 260, delay: dotAt });
  animate(svg.querySelector(".rate-halo"),
    [{ transform: "scale(0.4)", opacity: 0 }, { transform: "scale(0.4)", opacity: 0.5, offset: 0.05 },
      { transform: "scale(1.6)", opacity: 0, offset: 0.6 }, { transform: "scale(1)", opacity: 1 }],
    { duration: 900, delay: dotAt + 120, easing: "ease-out" });
  animate(svg.querySelector(".rate-now-label"), [{ opacity: 0 }, { opacity: 1 }], { duration: 250, delay: dotAt + 260 });
}

// The reveal plays once per press of "Check the offer". Under reduced motion,
// the final state shows right away.
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const REVEAL_FADE_MS = 200;
const REVEAL_GROW_MS = 400;

function rectFrame(rect) {
  return { left: rect.left + "px", top: rect.top + "px", width: rect.width + "px", height: rect.height + "px" };
}

// The reveal runs in steps, each starting when the one before has finished, so
// nothing jumps: screen 1 fades out; while nothing is showing, the screens swap
// and the page scrolls to the top; the orb grows into the hero panel; screen 2
// fades in. Then t=0: the blocks in view play one after another.
const SCREEN1_PARTS = ".screen-inputs, .site-footer, .topbar, .glow";
const SCREEN2_PARTS = ".screen-results, .site-footer, .topbar";
let revealRun = 0;
let revealAnimations = [];

function cancelReveal() {
  revealRun++;
  revealAnimations.forEach(function (animation) { animation.cancel(); });
  revealAnimations = [];
  document.querySelectorAll(".reveal-orb").forEach(function (orb) { orb.remove(); });
  document.body.classList.remove("revealing", "reveal-hidden");
}

function revealAnimate(element, frames, options) {
  const animation = element.animate(frames, Object.assign({ easing: EASE, fill: "forwards" }, options));
  revealAnimations.push(animation);
  return animation;
}

function fadeAll(selector, from, to, ms) {
  return Promise.all(Array.prototype.map.call(document.querySelectorAll(selector), function (element) {
    return revealAnimate(element, [{ opacity: from }, { opacity: to }], { duration: ms }).finished;
  }));
}

function revealResults(quiet) {
  const body = document.body;
  cancelReveal();
  // Reduced motion: no reveal, no plays. The result shows in its final state.
  if (!canMove()) {
    openResults(quiet);
    return;
  }
  const run = revealRun;
  const live = function () { return run === revealRun; };

  // A copy of the gradient circle, fixed where the button's circle is.
  const from = byId("check-circle").getBoundingClientRect();
  const orb = document.createElement("div");
  orb.className = "reveal-orb";
  orb.setAttribute("aria-hidden", "true");
  // Round from the first frame, like the button's circle.
  Object.assign(orb.style, rectFrame(from), { borderRadius: "50%" });
  body.appendChild(orb);
  body.classList.add("revealing");

  // 1. Screen 1 fades out, 200ms. Nothing scrolls while it can be seen.
  fadeAll(SCREEN1_PARTS, 1, 0, REVEAL_FADE_MS).then(function () {
    if (!live()) return;
    // 2. Hidden now: swap the screens (this scrolls to the top) and arm the blocks.
    body.classList.add("reveal-hidden");
    revealAnimations.forEach(function (animation) { animation.cancel(); });
    revealAnimations = [];
    openResults(quiet);
    const to = byId("hero-panel").getBoundingClientRect();
    const start = Object.assign(rectFrame(from), { borderRadius: from.width / 2 + "px" });
    const end = Object.assign(rectFrame(to), { borderRadius: "28px" });
    // 3. The orb grows into the hero panel, 400ms.
    return revealAnimate(orb, [start, end], { duration: REVEAL_GROW_MS }).finished;
  }).then(function () {
    if (!live()) return;
    // 4. Screen 2 fades in over the orb, 200ms.
    revealAnimate(orb, [{ opacity: 1 }, { opacity: 0 }], { duration: REVEAL_FADE_MS });
    return fadeAll(SCREEN2_PARTS, 0, 1, REVEAL_FADE_MS);
  }).then(function () {
    if (!live()) return;
    // 5. t=0: screen 2 is fully visible.
    body.classList.remove("revealing", "reveal-hidden");
    revealAnimations.forEach(function (animation) { animation.cancel(); });
    revealAnimations = [];
    orb.remove();
    startPlays();
  }).catch(function () {
    // A cancelled animation ends the reveal; cancelReveal has cleaned up.
  });
}

// Back to screen 1. Uses the browser's Back when screen 2 was opened from screen 1,
// so history stays tidy; otherwise (opened from Projects, or after a reload) it
// adds a step to screen 1.
function editDetails() {
  if (history.state && history.state.fromInputs) {
    history.back();
  } else {
    go({ screen: "inputs", project: currentId || undefined });
  }
}

// Screen readers hear short confirmations ("Link copied", "Image saved") here.
function announce(text) {
  const region = byId("announcer");
  region.textContent = "";
  setTimeout(function () { region.textContent = text; }, 50);
}

