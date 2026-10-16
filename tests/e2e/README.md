# Browser regression tests

These open Counter in real browser engines (Chromium, the engine in Chrome and Edge, and WebKit, the engine in Safari) and click through it like a person would. They check that nothing breaks, nothing scrolls sideways, there are no console errors, and axe finds no accessibility problems.

The site itself doesn't use any of this. It stays plain HTML, CSS, and JS with no build step, and nothing it loads comes from `node_modules`. The packages in `package.json` are only for these tests.

## Set up (once)

From the project folder:

```
npm install
npx playwright-core install chromium webkit
```

The first line installs Playwright and axe into `node_modules/` (ignored by git). The second downloads the two browser engines.

## Run

```
npm test            # the math, share, and projects tests, then all browser tests
npm run test:unit   # only the math, share, and projects tests (no install needed)
npm run test:e2e    # only the browser tests
```

The full browser run takes about 40 minutes, since it covers both engines at 320, 390, 768, 1024, and 1440px. To run part of it:

```
node tests/e2e/run.mjs projects share-link           # some tests by name
E2E_BROWSERS=chromium node tests/e2e/run.mjs         # one engine
E2E_WIDTHS=390,1440 node tests/e2e/run.mjs           # some widths
```

Each test prints a line starting with `!!` for anything it finds, then a count. The run ends with PASS or FAIL for each test and fails (exit code 1) if anything was found. Extra notes, like measurements and Tab orders, go to a `counter-e2e` folder in your system's temp folder, never into the project.

## The tests

| Test | What it checks |
|---|---|
| `inputs` | Every field and job, steppers, typing, blank and invalid values, commas in money fields, zero hours, huge numbers |
| `offers` | Yes and Not yet, and offers of $0, $15, $20, $200, $310, $1,000, and $10,000: the hero, stats, rate chart, and reply |
| `result` | The reveal, the play queue, slow and fast scrolling, live controls, rate chart scrubbing, Show the math, price to send, reply, Copy reply |
| `save-image` | The preview dialog, the download, and the text in the image for each offer case |
| `share-link` | Copying, opening a link, cut-off and bad links, an unknown version, the unsaved-work dialog |
| `projects` | Save, autosave, rename, duplicate, edit, delete, reopen, the count, the empty state, the 60-character limit |
| `navigation` | Back and Forward on every screen, reload on every screen, opening Projects directly |
| `storage` | Storage blocked or full: the calculator works and saving shows the error |
| `accessibility` | A keyboard-only pass, axe on every screen and dialog, reduced motion |
| `huge-values` | Huge numbers never freeze the page |
| `one-tap` | One tap on "Check the offer" works right after typing (Safari on phones) |
| `hero-fit` | The hero number always fits its panel, including during a live change |
| `not-saved` | "Not saved" and "Try again" when saving fails |
| `save-error-grid` | The "Couldn't save" box sits on the layout grid lines |
| `layout-grid` | Every block starts and ends on a column edge (12/8/4 columns) |
| `close-the-gap` | Ways to close the gap for every job, offer, and rounds: when it shows, the options, the grid, no overlaps, the keyboard, and how the pick drives the price, reply, saving, and image |
| `chart-labels` | Hours and rate chart labels for every job and offer: no overlaps, nothing cut off, the runs-out line never through its label, the target label never hidden |

## Good to know

- The tests open `index.html` straight from the file, the same as double-clicking it.
- They run with reduced motion unless a test is about motion, so results don't depend on timing.
- On phones that can share files, "Save image" shares instead of downloading; the tests expect that.
