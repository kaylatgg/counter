# Counter: launch quality check

October 16, 2026. Nothing was pushed, tagged, or deployed.

**Update, October 17, 2026:** Kayla decided four of the items listed at the end (1, 2, 3, and 6), and they're done: the screen reader result summary, the reply box border, self-hosted fonts, and the Biggest fix sentence in ink. New Lighthouse scores are in "After Kayla's decisions" below. See decision 45 in docs/DECISIONS.md.

The rule for this check: fix only clear bugs that don't change the design, and list everything else for Kayla. Every fix below was checked in Chromium and WebKit. Screen 1 is pixel-identical before and after the fixes at 390 and 1440. The only visible changes are three lines of small text on the gradient that are now ink instead of ink-2 (fix 2).

## Lighthouse

Lighthouse 13.5.0 (`npx --yes lighthouse`, not added to package.json), run on Playwright's Chromium against the site served at `http://127.0.0.1:8000/counter/`. Projects ran with no saved projects, since Lighthouse starts with empty storage. Mobile uses Lighthouse's simulated slow 4G and a slower CPU. Performance moves a few points from run to run.

| Page | Mode | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|---|
| Screen 1 | mobile | 83 → 89 | 100 → 100 | 96 → 96 | 90 → 90 |
| Screen 1 | desktop | 100 → 99 | 100 → 100 | 96 → 96 | 90 → 90 |
| Screen 2 (#result) | mobile | 80 → 87 | 100 → 100 | 96 → 96 | 90 → 90 |
| Screen 2 (#result) | desktop | 99 → 99 | 100 → 100 | 96 → 96 | 90 → 90 |
| Projects (#projects) | mobile | 89 → 94 | 100 → 100 | 96 → 96 | 90 → 90 |
| Projects (#projects) | desktop | 99 → 100 | 100 → 100 | 96 → 96 | 90 → 90 |

- **Accessibility:** 100 everywhere, before and after.
- **Best Practices 96:** the only failure is a console error, the 404 for `/favicon.ico`. Expected: the favicon waits for the logo.
- **SEO 90:** the only failure is the missing meta description. Expected: it waits for the logo, along with the link preview image.
- **Performance:**
  - **Projects mobile:** the layout shift went from 0.147 to 0 (fix 1).
  - **The rest of mobile:** held back by render-blocking requests: the Google Fonts stylesheet and `styles.css` (first paint 2.5 to 3.4s on simulated slow 4G). Listed below; changing it changes how fonts arrive.
  - **Desktop:** 99 to 100.
- **Agentic Browsing** (a new Lighthouse category, not asked for): Projects mobile 89 → 100 from the same layout shift fix; 98 to 100 elsewhere.

### After Kayla's decisions (October 17, 2026)

Same setup: Lighthouse 13.5.0 through `npx --yes`, `http://127.0.0.1:8000/counter/` served from the parent folder with `python3 -m http.server 8000 --bind 127.0.0.1`, stopped after. The middle column is the October 16 score after the fixes.

| Page | Mode | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|---|
| Screen 1 | mobile | 89 → 93 | 100 | 96 | 90 |
| Screen 1 | desktop | 99 → 100 | 100 | 96 | 90 |
| Screen 2 (#result) | mobile | 87 → 89 | 100 | 96 | 90 |
| Screen 2 (#result) | desktop | 99 → 100 | 100 | 96 | 90 |
| Projects (#projects) | mobile | 94 → 89 | 100 | 96 | 90 |
| Projects (#projects) | desktop | 100 → 100 | 100 | 96 | 90 |

- **Google's font stylesheet no longer blocks the first paint.** Only `styles.css` does now. Screen 1 mobile first paint: 2.5s → 1.5s.
- **Mobile Performance is noisy here.** Rerun back to back, Projects mobile scored 93 and 89 with the same files, and screen 2 mobile 88 both times. A copy without the font preload scored about the same (92 on Projects, 91 on screen 2, 86 to 92 on screen 1), so the preload neither helps nor hurts much on Lighthouse's simulated slow 4G. It's kept as decided.
- **Screen 1's layout shift is 0.068** (was 0.05), still within Google's "good" limit of 0.1. It's the title rewrapping when Geist arrives: item 4 below, still open.
- **Best Practices and SEO** are unchanged: the favicon 404 and the missing meta description, both expected.

## 1. Tests

- `npm test`, the one full run, in a scratch copy, because Playwright and axe aren't installed in the project folder by design:
  - **Unit tests:** 96 calc, 10 share, and 44 projects, all passing.
  - **Browser suite:** 18 of 18 pass, Chromium and WebKit, at every width. 0 findings.
- **After the fixes,** only the affected browser tests were run again: navigation, share-link, inputs, one-tap, accessibility, projects, dashboard, close-the-gap, layout-grid. All 9 pass, both browsers, 0 findings.

## 2. As it will be once live (/counter/)

Served from the project's parent folder with `python3 -m http.server 8000 --bind 127.0.0.1` (local only), then stopped.

- **Pass:** every file loads; no 404s from the page in either browser (the server log shows only 200s).
- **Pass:** no links or paths start with "/". Every file is relative (`styles.css`, `calc.js`, ...). Fonts came from Google Fonts then; since October 17 they're in `fonts/`, also relative, and load with 200s at /counter/.
- **Pass:** screen 1, Check the offer (#result), a saved project (#p/[id]/result and #p/[id]), and Projects (#projects) all work at /counter/, and so does a reload on each. The dashboard shows.
- **Pass:** the share link keeps the subfolder (`http://127.0.0.1:8000/counter/#s=v=1&...`), opens on screen 2 with "Shared result. Change anything to make it yours.", becomes #result, and reloads.
- **Pass:** no console errors or warnings (Chromium and WebKit, 390 and 1440).

## 3. Lighthouse

See the table at the top.

## 4. Accessibility

### Contrast
- **Plain backgrounds, pass:** every text token passes AA on every plain background it's used on.

  | Text | On `--bg` | On `--paper` |
  |---|---|---|
  | ink | 15.30 | 16.87 |
  | ink-2 | 7.17 | 7.91 |
  | muted | 4.52 | 4.99 |
  | error | 5.56 | 6.13 |

  Paper text on ink buttons is 16.87; on the ink-2 hover it's 7.91.
- **Gradient, fixed:** text on the gradient was measured from the real pixels behind each line (the text hidden, then the worst pixel in its box). That covered the screen 2 hero panel, the picked gap card, and the Biggest fix card, at 390, 768, 1024, and 1440 in both browsers: 168 text items. Three failed over the warm, red part of the gradient:

  | Card | Text | Was |
  |---|---|---|
  | Picked gap card | "11.5 hrs of work, 0 unpaid" | 4.00:1 |
  | Picked gap card | "same work" | 4.28:1 |
  | Biggest fix card | "with fix 88%" | 3.86:1 |

  Fixed (fix 2). Now all 168 pass. The closest was the Biggest fix sentence at 4.50:1; since October 17 it's ink, 9.61:1 at its worst pixel. Remeasured then: all 168 still pass, the closest now the hero's "/hr" (4.85:1).
- **Focus rings, pass:** 2px or 3px ink, 15:1 on the page and well over 3:1 on the gradient.
- **Non-text, done October 17:** the reply box's border was `--line`, 1.46:1 against its paper fill, where 3:1 is needed. It's now `--muted`, 4.99:1. The other inputs use an ink underline (15:1).

### Keyboard only (390 and 1440, Chromium and WebKit)
- **Pass, after fix 3.** The whole task was done with Tab, Shift+Tab, Enter, Space, and arrows:
  - pick a job (arrows in the pills), change hours, enter an offer, Check the offer;
  - pick a way to close the gap (arrows), Copy reply, Save as project (Enter in the dialog);
  - open Projects, both Show as table toggles (Enter and Space), Fix, and back to Projects.
- **Every key press was checked:** focus was on something, it had a visible ring, it was on screen, and no fixed or sticky bar covered it. It's never lost when something re-renders.
- **Safari's Tab:** by default Tab only moves between text fields; buttons and links need Option+Tab, or the setting "Press Tab to highlight each item." That's the browser, not Counter, so WebKit was walked through with Option+Tab.
- **Fixed (fix 3):** in Safari, arrow keys in the field tabs, job pills, and Yes / Not yet switch moved selection but hid the focus ring.

### Screen reader (the accessibility tree, both browsers, 390 and 1440)
- **Pass:** one h1 per screen ("What does this job really pay?", "The result", "Projects"), and heading levels never skip.
- **Pass:** axe reports no violations on screen 1, screen 2, or Projects.
- **Pass:** every chart has a text summary, and its drawing is hidden from screen readers:
  - screen 2: the hours chart and the rate chart;
  - Projects: the waterfall and the bullet chart.
- **Pass:** dialogs move focus in, keep Tab inside (it can reach the browser's toolbar, never the page behind), and Escape returns focus to the button that opened them.
- **Live regions, pass:** "Couldn't save" is an alert; the replace question, copy status, and the announcer are polite. Nothing is announced on every keystroke.
- **Done October 17** (it needed a decision): the summary announcement in the build spec section 8 ("Estimated price $310 for 11.5 hrs. The offer of $200 pays ...") was never built. The polite region exists, but only "Link copied", "Image saved", and "Your reply now uses $270." use it. So a screen reader user changing numbers on screen 1 heard nothing about the result. Now built with the wording in item 1 below, and tested in tests/e2e/accessibility.mjs (each case heard once with the right text, nothing on load, when a saved project or share link opens, on a screen change, on errors, or on 0 hours; Chromium and WebKit, 390 and 1440).

### Zoom and reflow
- **Pass:** at 200% zoom on a 1280px screen (640 CSS px wide) and at 320px: screen 1, screen 2 (Show the math closed and open), Projects, and Projects with both tables shown. No sideways scrolling, nothing cut off, no text overlapping, in both browsers.

### Touch targets (phone, 390)
- **Fixed (fix 4):**
  - Chromium drew the Pages and Rounds fields and the rate, expenses, offer, and Price to send fields 42.6 to 42.8px tall (WebKit: 45 to 47px).
  - "Edit" on project rows was 32.8px wide.
- **Now:** every control is at least 44 by 44, and nothing moved on the page.
- **Small text links,** allowed by WCAG 2.5.8: "Show as table" and "Use my estimate" are 44px tall already. None seem hard to tap.

### Reduced motion
- **Pass:** with reduced motion on, nothing animates (checked with the browser's own list of running animations): Check the offer, a live change, picking a gap card, or scrolling the charts in.

### Earlier audit fixes
The two partner audits aren't in the repo under that name. The October 12 accessibility fixes (decision 24) and the phone layout were re-checked; all still hold:
- the hero's "/hr" passes on the gradient (4.85:1 at its worst);
- the weeks note sits below the hero in ink-2;
- one h1 per screen;
- the first Tab reaches the skip link;
- every number input has a 44px tap area (now in Chromium too);
- the phone layout tests pass.

## 5. Real-world conditions

- **Slow font files, pass:** the page is ready in about 0.3s with the fallback font, works fully (an offer typed, Check the offer), and nothing overlaps.
- **Slow font stylesheet, done October 17:** if Google's small font stylesheet itself was slow, the page stayed blank until it arrived (6s in the test), because it blocked the first paint. The fonts are now in the repo, so there's no stylesheet to wait for.
- **Fonts blocked, pass:** every screen is readable, with nothing overlapping or cut off. The only console messages are the blocked font requests.
- **Storage blocked (private mode), pass:** the page works, Save as project shows "Couldn't save. Your changes will be lost if you leave this page.", and nothing crashes. No console errors.
- **Console, pass:** no errors or warnings anywhere in these checks, apart from the blocked fonts on purpose. Two exceptions: the favicon 404 Lighthouse reports, and axe's own file:// warnings, which disappear over http.

## Fixes made

1. **Wrong screen flashed on opening an address.**
   - **Problem:** opening #result, #projects, or a saved project directly, Chromium painted screen 1 for one frame before the app showed the right screen. On Projects that moved the footer (layout shift 0.147, Lighthouse Performance 89).
   - **Fix:** a three-line script in the page head hides the page while such an address is being routed, and the app shows it once the right screen is up. If the app doesn't run, the page shows when it finishes loading.
   - **Result:** layout shift 0, Performance 94.
2. **Gradient contrast.** On the picked gap card, the bar labels and the unchanged lever values; on the Biggest fix card, "now 55%" and "with fix 88%": ink-2 → ink.
3. **Safari focus ring on radio groups.**
   - **Problem:** Safari stops matching `:focus-visible` when arrow keys move between radios (it does this on a bare page too).
   - **Fix:** the page remembers whether the last input was a key or a pointer, and shows the same ring on a focused radio after a key. Mouse clicks still show no ring.
4. **44px tap areas on phones.**
   - **Fields:** the extra padding on the Pages and Rounds fields went from 4px to 6px, and the money fields got 2px on top, each with an equal negative margin.
   - **"Edit":** an invisible 44px tap area, centered on the word.
   - **No visual change:** screen 1 is pixel-identical.

## Needs Kayla's decision

1. **Done October 17, as suggested.** **The live result summary (the build spec section 8) was never built.** It's screen reader only, so nothing changes visually. The spec gives one example, but the wording for other cases is yours. Suggested:
   - With an offer: "Estimated price $310 for 11.5 hrs. The offer of $200 pays $17.39 an hour before expenses and $15.65 after. Your target is $25.00." (as in the build spec)
   - No offer: "Estimated price $310 for 11.5 hrs. Your target is $25.00."
   - Offer below expenses: "Estimated price $310 for 11.5 hrs. The offer of $15 is $5.00 less than your expenses."
   - With errors or 0 hours: nothing new (the field errors are already linked to their fields).
2. **Done October 17: `--muted`.** **The reply box border.** `--line` is 1.46:1 against its fill; a box you type into needs 3:1 (WCAG 1.4.11). Options:
   - `--muted` (4.99:1);
   - `--ink-2`;
   - an ink underline like the other fields.
3. **Done October 17: the font files are in the repo.** Geist 300, 400, 500 and Geist Mono 400, 500, latin woff2, from `@fontsource/geist` and `@fontsource/geist-mono` (license in `fonts/OFL.txt`); Geist 400 and Geist Mono 400 are preloaded. Screenshots of screen 1, screen 2, and Projects at 390 and 1440 match before and after: same page heights, and only a few hundred pixels differ, at glyph edges. The preload is added only over http(s): opened as a file, browsers block font preloads, and Safari then skipped Geist 400 and Geist Mono 400 entirely. **The Google Fonts stylesheet blocked the first paint.** On slow connections the page is blank until it arrives (mobile first paint 2.5 to 3.4s in Lighthouse). Options:
   - load it without blocking (the fallback font shows first, then swaps);
   - put the Geist font files in the repo and preload them.

   Either changes how the page looks while loading.
4. **The font swap rewraps screen 1's title** (layout shift about 0.05, within Google's "good" limit of 0.1). It could be smoothed with a size-matched fallback font, if it bothers you.
5. **"same work" and "same price" on the picked gap card are now ink** (fix 2), so on the picked card the difference between changed and unchanged values is only weight (500 vs 400). If you'd like a stronger cue there, it can't be a lighter color on that gradient.
6. **Done October 17: ink, now 9.61:1.** **The Biggest fix sentence measured 4.50:1** at its worst pixel: it passes, but only just. Making it ink would give it room.
7. **Expected, not added:** the meta description, the favicon (its 404 is the Best Practices point), and the link preview image. They wait for the logo.
