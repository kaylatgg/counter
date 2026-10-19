# Counter design system (v5, "Sunset")

Source of truth for how Counter looks. Replaces every earlier version. The build spec still owns the flow, math, copy, validation, accessibility, and tests.

Reference images: `docs/design-v5-screen1.png` and `docs/design-v5-screen2.png` (desktop), `docs/design-v5-phone.png` (phone), and the share and image references listed in their section. Match them. If an image and this file differ, this file wins. If something isn't covered, ask. Ignore all older reference images.

## The idea

Calm, light, and warm. Big light numbers, small mono labels, one sunset gradient.
The gradient means "the answer": it glows quietly on screen 1, then opens into the result on screen 2.

## Tokens

```css
:root {
  --bg:     #ECECEA;  /* page */
  --paper:  #F7F7F5;  /* pills, tally panel */
  --ink:    #161616;  /* 15:1 */
  --ink-2:  #4D4D4A;  /* secondary text, 7:1 */
  --muted:  #6B6B67;  /* small labels, 4.5:1 on --bg. Never on the gradient */
  --line:   #CFCFCB;  /* hairlines, decorative */
  --error:  #B42318;

  --sunset: radial-gradient(55% 95% at 88% 100%, #E8432E 0%, rgba(232,67,46,0) 70%),
            radial-gradient(50% 80% at 70% 80%, #FF8A3D 0%, rgba(255,138,61,0) 70%),
            radial-gradient(40% 60% at 55% 55%, #F7B98F 0%, rgba(247,185,143,0) 75%),
            linear-gradient(160deg, #C9D6EA 0%, #D9CDE6 40%, #EBC7B5 100%);
  --paid:   linear-gradient(90deg, #C9D6EA 0%, #EBC7B5 30%, #FF8A3D 70%, #E8432E 100%);
  --stripe: repeating-linear-gradient(90deg, var(--ink) 0 1px, transparent 1px 4px);
}
```

Rules:
- The gradient is only used for: the screen 1 corner glow, the button's arrow circle, the screen 2 hero panel, paid hours in the chart, the picked card in "Ways to close the gap" (with a 35% `--paper` wash, added October 15, 2026), and, since October 16, 2026, paid money in the Projects dashboard charts and its summary card (`--paid`) and the dashboard's Biggest fix card (the sunset with a 35% `--paper` wash). Reason: it always means "the answer."
- Text on the gradient is `--ink` or `--ink-2` only, and only over the cool left and top parts. Reason: `--muted` fails on the gradient, and warm red is too close to ink for small text.
- Stripes always mean unpaid or forgotten hours. Solid ink means design work.
- Add a light grain over gradients (SVG `feTurbulence` noise, about 8% opacity). Optional, drop it if it hurts performance.

## Type

Self-hosted since October 17, 2026: Geist 300, 400, and 500 and Geist Mono 400 and 500, latin woff2 only, in `fonts/` (from the official `@fontsource/geist` and `@fontsource/geist-mono` packages; license in `fonts/OFL.txt`). The `@font-face` rules are at the top of `styles.css`, with relative paths and `font-display: swap`. The two most used files, Geist 400 and Geist Mono 400, are preloaded, only when the page is served over http(s), since browsers block font preloads on a page opened as a file. The family names stay "Geist" and "Geist Mono" (`--font`, `--mono`, and Save image's canvas use them). Reason: the page doesn't wait for Google's stylesheet, and the fonts work where Google is blocked.

- **Geist 300** for big numbers and headings, tight tracking. Reason: light, large numbers feel calm and premium.
- **Geist 400** for body and labels.
- **Geist Mono** for units ("hrs", "/hr"), chart labels, axis ticks, and small notes. Reason: data reads like data.
- Tabular numbers everywhere. Sentence case. No all caps.

| Role | Style |
|---|---|
| Headline | Geist 300, 84px, -0.045em, line-height 0.98 |
| Intro | Geist 400, 19px, `--ink-2`, max 34em |
| Section title | Geist 300, 26px, with a mono number pill ("01.") on `--paper` |
| Hero number | Geist 300, 220px, -0.06em. "$" at 32% size, raised. "/hr" mono 22px |
| Tally total | Geist 300, 96px |
| Stat values | Geist 300, 46px, units mono 13px |
| Input values | Geist 300, 24px (hours) / 40px (rate, expenses, offer) |
| Chart titles | Geist 300, 22px |
| Body, row labels | Geist 400, 16px |
| Small labels | Geist 400, 13px, `--muted` |
| Mono notes, units, ticks | Geist Mono 11 to 13px |

**The logo lockup (October 18, 2026).** The header shows the mark, a ring with an off-center hole (the same shape as `favicon.svg`), just left of the wordmark "counter". The wordmark is Geist 400, 20px, -0.035em, lowercase. The mark is an inline SVG in `currentColor`, hidden from screen readers (the text "Counter" stays the name), cropped to the ring with no padding. Its sizes are in em, so it scales with the wordmark:
- 0.666em tall and wide, the height of the "t".
- Sits 0.012em below the baseline, the same overshoot as the round letters.
- 0.166em from the "c", the width of the ring's thick side, so the gap matches the ring.

Reason: built from the type's own measurements, so the mark and the word read as one lockup. The wordmark's line box is unchanged (30px tall, 17px from the top), so nothing moves when a project opens. On phones, screen 2 hides the wordmark for "Edit", and the mark hides with it.

## Layout grid

Decided with Kayla, October 13, 2026.

- A column grid. Blocks span whole columns and use the grid's column gap between them, so inner edges line up from row to row, not just the outer ones.

| Size | Columns | Side margin | Column gap |
|---|---|---|---|
| Phone (under 760px) | 4 | 20px | 16px |
| Tablet (760 to 1023px) | 8 | 40px | 24px |
| Desktop (1024px and up) | 12 | 64px, content at most 1312px wide, centered | 32px |

- The tokens live in `:root` in styles.css: `--columns`, `--column-gap`, and `--page-margin` (the side margin).
- Spans:
  - Desktop: screen 1's inputs 7 + 5 (the right column stays sticky), stats 3 + 3 + 3 + 3, charts 6 + 6 (12 when the rate chart is hidden), Your price and Your reply 6 + 6. The header, control row, hero, Show the math, footer, and Projects span 12.
  - Tablet: the inputs and the charts stack (8 each), stats 2 by 2 (4 each), Your price and Your reply side by side (4 + 4).
  - Phone: everything spans 4; stats 2 by 2 (2 each).
- To check the grid, open the page with `?grid` (`index.html?grid`): the columns show as faint bands over everything. It's never shown otherwise.
- Everything starts and ends on them: the header (wordmark and buttons), the screen 2 control row, the hero panel, the stats, the charts, Show the math, Your price and Your reply, the footer, screen 1's headline, form, tally card, and button, and the Projects page.
- Pills and panels (Edit details, the hero panel, the tally card, the phone control panel, the phone bottom bar) put their outer edge on the line; text inside keeps its padding.
- The footer's rule spans the row on every screen, and the reply box fills its column.
  Reason: rows started at four different edges (24, 48, 64, and 72px), so nothing lined up; then inner widths (the 480px inputs column, the 544px rate chart) and one-off gaps kept inner edges apart.

## Screen 1: inputs

- `--bg` page. A soft blurred sunset glow off the top-right corner with two thin circle outlines. Nothing over the form fields.
- Header: "counter" (Geist 500, 20px) left; "Projects 3" and "Save as project" right. (The "for creative students" note was removed on October 11, 2026.)
- Header spacing (760px and up; phones keep their own header): 24px between Projects, Share, and Save, so the visible gaps are equal. In a saved project the left reads "counter / Menu, Oct 11 Saved": a slash (Geist 300, 20px, `--muted`, hidden from screen readers), the name, then the mono status, 16px apart, all on one text baseline, also while renaming. The wordmark never moves when a project opens: it keeps the same baseline, and the rest lines up to it. Decided with Kayla, October 15, 2026.
- **New calculation, in the header (October 19, 2026).** On every screen, between Share and Save (Projects, Share on screen 2, New calculation, Save). An outlined pill: 36px tall, 16px side padding, 1px `--ink` border, transparent fill, `--ink` text, 14px, with a 12px "+" (two 1.4px round-capped lines, `currentColor`) 7px before the label, drawn like the Share and Back icons. Hover adds the outline buttons' faint ink tint. It replaces the button next to the Projects title; the empty state keeps its own. A long project name gives way first (it ends in "…"); the wordmark never shrinks.
  Reason: one filled action per screen. "Save as project" stays the only ink button, so starting over never looks like the main thing to do.
- Headline, then the intro right under it, then "Example numbers..." in mono.
- Two columns: left (01 The job, 02 The work), right 5 of 12 columns and sticky (tally panel, 03 Your numbers, 04 Their offer, button).
- **Job choice:** a segmented control on `--paper`, selected segment ink with light text. Real radio inputs.
- **Steppers:** 44px circles, minus outlined, plus solid ink.
- **Work rows:** label, a small bar showing that row's hours (solid ink, or stripes for forgotten rows), then the input with a 1px ink underline. Forgotten rows get a mono "usually forgotten" note.
- **Tally panel ("Your work so far"):** `--paper`, 24px radius. Big total, then one bar of all groups (solid then stripes) with mono hour labels. Mono note "5.5h usually forgotten". Live.
- **Their offer:** "Did they offer an amount?" Yes / Not yet segmented control, next to "Amount they offered".
- **Button:** full width, 80px, fully rounded, ink. "Check the offer" (20px) and mono "11.5 hrs of work for $200". Right end: a 60px circle filled with `--sunset` and an ink arrow. Reason: the circle previews the answer.
- Replace / Keep my numbers: small rectangular buttons, not pills.

## Screen 2: result

- Header row: "counter", "Edit details" pill, then the live controls on the right (item stepper, rounds stepper, offer, target).
- **Hero panel:** `--sunset`, its outer edge on the grid lines (no bleed past the text), 28px radius, about 380px tall. Top left: "This offer pays". Top right: mono job summary and the sentence ("for 11.5 hours of real work. That's $7.61 an hour under your $25 target.") in ink. Bottom left: the hero number.
- **Stats row:** 4 columns with a hairline above each: Your estimate, More than they offered, Hours the offer pays for (7.2 of 11.5 hrs), After expenses.
- **Chart 1, "Where your 11.5 hours go"** (left, 6 of 12 columns):
  - One bar per group, 96px tall, 4px gaps, widths by hours.
  - Paid hours filled with `--paid` as one continuous gradient across groups. Unpaid hours in `--stripe`, 1px ink outline.
  - Dashed line at the runs-out point with mono "$200 runs out at 7.2 hrs", always the full label. At every width it sits left of the line, then right of it, 8px away, then 6px. If it fits on neither side, it stays in its row, centered on the line and kept inside the chart, and the line starts 4px below it so it never crosses the text. It never touches the "usually forgotten" bracket. Decided with Kayla, October 15, 2026.
  - A bracket over the three forgotten groups: mono "5.5 hrs usually forgotten".
  - Under each group: hours (Geist 300, 24px) and name. Labels never overlap.
  - Legend: "paid by the offer" and "unpaid".
  - No offer: everything solid or striped, no gradient, no runs-out line.
- **Chart 2, "Your rate drops as hours grow"** (right, SVG):
  - Subtitle: "$200 spread over more hours pays less per hour."
  - Line: offer ÷ hours, from about 1/3 to 1.4x the current hours.
  - Dashed vertical grid lines with mono hour labels, y labels $0, target, and a top value.
  - Solid line at the target with mono "your target $25/hr".
  - Small ink dot where the curve meets the target, labeled "at 8h you hit $25".
  - Glowing red dot (#E8432E, soft halo) at the current hours, labeled "11.5h → $17.39/hr".
  - Hidden with no offer. If the offer is below expenses, show the curve without the target crossing.
  - `aria-hidden` with a text summary for screen readers.
  - The y labels get exactly the room they need: the widest one plus 8px, so "$1,250" is never cut off.
  - Labels never overlap. Priority: the current-hours label, then "your target $25/hr", then "at 7.2h you hit $25", then the axis labels. A lower one moves to its next spot; with none left, it's hidden from the drawing (the summary still says it). Decided with Kayla, October 13, 2026.
  - The target label is never hidden. After its usual spots (either end of the line, above or below), it tries the chart's left edge, above then below the line. If the full label fits nowhere, it becomes "target" in the same spots, but only where the y axis's "$25" stays visible, so the target's value always shows somewhere. Failing that, the full label slides along the line, above or below it, to any clear spot. The current-hours label also keeps clear of a 24px strip along the target line when it has another spot, so the target has room. Decided with Kayla, October 15, 2026.
- Below: Show the math (collapsed), then 05 Ways to close the gap (only with an offer below the estimate), then Your price and Your reply side by side, then the footer.
- "Copy reply": fully rounded ink button.
- The reply box: `--paper` fill, 1px `--muted` border (4.99:1, since a box you type into needs 3:1), 16px radius. Changed from `--line` on October 17, 2026.

## Motion

Approved by Kayla, October 13, 2026. Reference: open `docs/motion-study.html` in a browser and scroll. It is a prototype; match its timing and order, not its code.

The idea: motion acts out the finding. Each part plays once, then gets out of the way.
Easing for everything: `cubic-bezier(.2,.7,.2,1)` (ease-out). Under reduced motion, everything shows in its final state at once.

**The reveal** (on "Check the offer"): the button's gradient circle grows into the hero panel, about 400ms, as now.

**Plays once, when it scrolls into view** (35% visible, once per result, never again until the next "Check the offer"):
- **Hero:** the number counts up from 0, 700ms. Tabular digits, so the width never jumps.
- **Stats:** each hairline draws left to right, 500ms. Each number counts up, 700ms, 80ms after the one before.
- **Hours chart:**
  1. Bars wipe in from the left as stripes, 400ms. All work starts unpaid.
  2. The paid gradient fills from the left, 700ms, and stops where the money runs out.
  3. The dashed runs-out line drops in with its label, 200ms.
  4. The bracket draws over the forgotten groups, 300ms. Group labels rise 6px and fade in, 60ms apart.
  Reason: the fill stopping short is the moment people understand the problem.
- **Rate chart:**
  1. Grid fades in, 200ms. The target line draws left to right, 300ms.
  2. The curve draws left to right, 900ms, so you watch the rate fall.
  3. The black dot pops (scale 0 to 1.4 to 1, 260ms) as the curve reaches it.
  4. The red dot lands last, with one soft halo pulse, then its label.
- Arm before screen 2 appears: every time screen 2 is shown (Check the offer, a shared link, a saved project, Back), all blocks switch to their starting state before screen 2's first frame. Each then plays when it reaches 35% visible. A block that is 35% visible when screen 2 appears plays right away (after the reveal, if there is one).
- A block the person scrolls past (it leaves the top of the screen before playing) jumps to its final state.
- Never reset or replay a block that has been seen in its final state.
- If scripts fail, everything is visible in its final state.

**Live changes morph, never replay:** when a control or input changes the result, numbers, bar fills, the runs-out line, and the curve tween from old to new in 250ms.
Reason: the full show plays once. After that, motion only shows what changed.

**Scrub the rate chart** (new):
- Hover or drag on the chart: a vertical line, a dot on the curve, and a label "14h → $12.86/hr" follow the pointer, snapping to half hours.
- Keyboard: the chart is focusable. Left and right arrows move half an hour. Escape hides it. Each change is announced politely to screen readers ("At 14 hours, the offer pays $12.86 an hour after expenses.").
- Works under reduced motion.
- Reason: it turns the chart into a "what if" tool, and it is real interaction with the data.

**Small moments:**
- "Check the offer" hover: the gradient circle grows 6% and the arrow nudges 3px forward, 240ms. Press: the button scales to 98%.
- Pills and buttons: 160ms color and background transitions only.

## Details decided while building v5

Decided with Kayla, October 11, 2026:
- **"h" only in small mono chart labels** (axis ticks, tally bar labels, the rate chart's dot labels). Sentences, stats, inputs, and headings keep "hrs": the tally note reads "5.5 hrs usually forgotten".
  Reason: the build spec's terms stay intact; the short form only where space is tight and the context is clearly data.
- **The rate curve is after expenses**, so "at 7.2h you hit $25" matches "$200 runs out at 7.2 hrs" in the chart beside it. Subtitle: "After your $20 in expenses, $200 spread over more hours pays less per hour." Red dot: "11.5h → $15.65/hr after expenses".
  Reason: both charts tell the same story.
- **No offer:** stats are Total hours, Your time at $25/hr, Expenses, and Usually forgotten (5.5 hrs, mono note "worth $137.50 at your rate"). The hours chart takes the full row.
- **Chart summaries are visible**, one 14px `--ink-2` line under each legend.
  Reason: the build spec requires a written summary under every chart.

Decided while building:
- **No offer in the hours chart:** the legend reads "design work" (solid) and "usually forgotten" (stripes).
- **No runs-out line** when the offer covers everything or doesn't cover expenses. The label row says so instead ("$400 covers all 11.5 hrs", "$15 doesn't cover your expenses").
- **Paid gradient** spans the whole bar width, so a color always means the same point in the hours.
- **Rate chart labels** take the spot with the fewest conflicts (plot edges, then other labels and dots, then the curve, then the target line). Y labels: the target always; $0, the top, and a negative bottom only when 16px or more from it. Grid steps: the smallest round step with at most 7 spaces.
- **Below expenses**, the curve sits under $0 with a hairline at $0 and no crossing dot.
- **Bar labels** that can't fit in one row alternate onto a second row.
- **Job pills on desktop** (760px and up) that don't fit the column wrap onto a second line, aligned left with no stretching. The `--paper` background becomes a 24px rounded rectangle around both lines, with the same 4px padding and a 4px gap; the selected pill stays a full pill. Phones keep the scrolling row, and the field tabs scroll the same way there. Decided with Kayla, October 13, 2026.
- **Screen 2's header row is sticky** with a `--bg` background, so the live controls stay in reach. Screen 1's header scrolls away so it never cuts the glow.
- **Row bars on screen 1** share one scale: 25px per hour, narrower when any row would pass 150px.
- **The reveal** fades screen 1 (200ms), grows the orb from the button's circle to the hero panel (400ms), then fades screen 2 in, counts the number up, sweeps the bars (600ms), and shows the red dot last.
- **The corner glow** uses the sunset colors as one radial gradient, hottest at the center, blurred.

## Phone layout (below 760px)

Approved by Kayla, October 11, 2026. Reference: `docs/design-v5-phone.png` (390px wide). It must also work at 320px with no sideways page scroll.
Same tokens, fonts, colors, and rules as desktop. Only the layout and sizes change.

Sizes:
- Side padding 20px.
- Headline: `clamp(40px, 12vw, 84px)`. Intro 16px. Section titles 22px.
- Hero number: `clamp(80px, 27vw, 220px)`, always on one line.
- Stat values 32px. Chart titles 20px.
- Every tap target is at least 44px tall: header buttons, Field tabs, job pills, Yes / Not yet, all steppers.

**Header (both screens)**
- 56px. Screen 1: "counter" left. Screen 2: "← Edit" left in place of the wordmark.
  Reason: on a phone, getting back to your inputs matters more than the logo.
- Right: "+" (New calculation), "Projects" (`--paper` pill) and "Save" (ink pill). "Save as project" is shortened to "Save". After saving, it behaves the same as on desktop.
  Reason: the full label doesn't fit next to Projects.
- **New calculation (October 19, 2026):** only the "+", in an outlined 44px circle, named "New calculation", left of Projects, on screen 1 and Projects. Screen 2 leaves it out: Edit, Projects, Share, and Save already fill the row (358px of 350 at 390), and Edit is one tap away. Decided with Kayla.
- **The Projects count is hidden on phones** to make room; the link's name still says it ("Projects 3"). Below 360px every header has 4px gaps and slightly less padding (Projects 9px, Save 14px, Edit 12px).
- **"Try again" reads "Retry" on phones** (after an autosave fails), named "Retry saving" so the name starts with the visible word. Tablet and desktop keep "Try again". With these, every state fits one line at 320, 360, and 390. Decided with Kayla.
- Sticky on both screens on phone. Clear at the top of screen 1 so the glow shows, then `--bg` with a 1px `--line` bottom border once you scroll.
  Reason: the form is long on a phone, so Save and Projects stay in reach.
- On screen 2, the project name and its "Saved" status (when there is a project) go in one mono line under the header.

**Screen 1: inputs**
- One column in order: headline, intro, 01 The job, 02 The work, 03 Your numbers, 04 Their offer.
  Reason: same order as desktop, so people learn one flow.
- Corner glow: smaller, in the top right corner behind the header buttons only. Never behind the headline or intro.
  Reason: `--ink-2` text on orange fails contrast.
- Field tabs: one row. Job pills: one row that scrolls sideways, bleeding off the right edge so the last pill is cut off. No wrapping.
  Reason: the cut-off pill shows there is more to swipe.
- Steppers side by side. Work rows: label on top, then the bar and the hours input on one line.
- Rate and expenses side by side. Amount offered at half width under Yes / Not yet.
- **Bottom bar replaces the tally panel and the button.** Fixed, on the grid lines (20px from the sides), `calc(14px + env(safe-area-inset-bottom))` from the bottom, 28px radius, ink. Left: "Check the offer" (17px) and the live mono "11.5 hrs · $200", with a thin live hours bar under it (solid then stripes, light on ink). Right: 52px `--sunset` circle with the ink arrow. With no offer: "Get my estimate" and "11.5 hrs at $25/hr".
  Reason: the total and the button are what you check while typing, so they stay under your thumb.
- Add bottom padding to the page so the bar never covers the last field.

**Screen 2: result**
- Hero: on the grid lines (20px from the sides), 28px radius. "This offer pays" and the mono job summary on top, the number, then the sentence under it in ink.
- Live controls in a `--paper` panel (20px radius, outer edge on the grid lines) right under the hero, not sticky: the item stepper, the rounds stepper, then Offer and Target on one row.
  Reason: the desktop bar doesn't fit a phone. Right under the answer is where people try "what if".
- Stats in a 2x2 grid.
- Hours chart full width, 64px tall. Group names move into a 2-column legend under the bar (one column below 360px, so "Communication 1h" fits). The runs-out label is placed as on desktop (see Chart 1).
  Reason: four labels under thin bars would overlap.
- Rate chart full width, about 170px tall. Same label rules as desktop.
- Then Show the math, Your price, Your reply (stacked), and the footer. "Copy reply" full width.

**Projects page and save field**
- Projects list: one column, each project is a full-width row (name, job, date), at least 56px tall.
- Row actions (desktop and phone): Edit, Rename, Duplicate, Delete, as plain text buttons, Delete last. The name opens the project on screen 2; Edit opens it on screen 1. Each has a full accessible name ("Edit Menu, Oct 11"). Added October 13, 2026.
- Dialogs are bottom sheets here (see "Dialogs" below).

**Motion:** the same reveal. The circle in the bottom bar grows into the hero. Off under reduced motion.

## Ways to close the gap (05) and extra rounds (screen 2)

Decided with Kayla, October 15, 2026.

**Ways to close the gap**
- Shows only with an offer below the estimate, after Show the math and before 06 Your price. Title "Ways to close the $110 gap" (the real gap), intro "Change the price, the work, or both. Pick one to put it in your reply. All rates are after expenses."
- Up to three cards on the column grid: one per 4 columns on desktop, stacked full width on tablet and phone. `--paper`, 24px radius, 24px padding.
  1. "Raise your price" (tag "Your estimate"): the estimate, same work.
  2. "Trade work for price" (tag "Middle ground"): one round of changes fewer (with 0 rounds, one item fewer), at that smaller job's estimate. Left out if there's no smaller job or its estimate isn't above the offer.
  3. "Take their $200" (tag "Their budget"): the offer, for the smaller job (or the same work). Left out at or below expenses.
- No middle ground (decided with Kayla, October 16, 2026): when there's no "Trade work for price" card, "Take their $600" is for the smaller job, and it meets the target, one line follows the cards: "There's no middle ground here: their $600 already pays your target for 1 round less." (the Work row's words, "1 page less" with the job's item). Styled like the intro (14px, `--ink-2`, reading width), 16px above, on the page background, never on a card. It updates with live changes and is read as normal text after the cards. In every other case (both cards, no smaller job, offer at or below expenses) there's no note.
- Each card: the tag (mono 11px) and a chip, "meets your target" (ink fill) or "$7.00/hr under" (ink outline); the name (20px); the price (Geist 300, 48px) with its rate after expenses ("$25.22/hr", mono); the scope in mono 12px ("2 pages · 2 rounds of changes"); two lever rows with hairlines, Price ("+$110" over their offer, or "same price") and Work ("same work", "1 round less", "1 page less"), changed values ink 500 and unchanged ones gray; a bar of the option's work on one scale for all cards (the current job's hours): paid in the paid gradient, unpaid in stripes with an ink outline, saved hours as a dashed outline, with "10 hrs of work, 2.8 unpaid" and "1.5 hrs saved" under it; and "Use in reply" (outline) or "✓ In your reply" (ink).
- The picked card (option 1 by default) gets the sunset with a 35% `--paper` wash, fading in over 250ms (not under reduced motion). On it all text is `--ink` or `--ink-2`, hairlines are ink at 25%, and the paid bar gets a 1px ink outline.
- The cards are a radio group named by the title. Arrow keys move and pick (wrapping); one card is in the Tab order.
- Picking sets Price to send (option 1 leaves it blank, so it follows the estimate) and the reply to that option's price and scope. It never changes the inputs or the charts. An edited reply isn't overwritten; the update notice shows. The price line and the saved image use the option's hours. Typing a different price clears the pick; "Use my estimate" picks option 1. The pick saves with the project, not in the share link. Live changes keep the picked type, or fall back to option 1.
  Reason: the gap is the decision the result leads to, so the page shows the three honest ways to close it, with what each pays.

**Extra rounds of changes** (every result)
- Under the price: "Extra rounds of changes", "$40 each", and a mono note "1.5 hrs at $25/hr, rounded up" (hours per round x rate, rounded up to $5; "rounded up" only when it was). Hidden when a round takes no hours.
- The reply adds "Additional rounds of changes are $40 each." before its last sentence.

## Projects dashboard and summary card

Kayla's design, October 16, 2026. References: `docs/design-projects-dashboard.png` (desktop left, phone right) and option B in `docs/design-dashboard-link.png` (the summary card). If an image and this file differ, this file wins.

**What counts**
- A project counts when it has an offer, its numbers work (a broken price to send doesn't block, like the list), and it has hours. Others stay in the list but are left out of the dashboard.
- Everything is after expenses, like Ways to close the gap (the screen 2 hero stays before expenses). Per job, rounded to whole dollars first so every total adds up: target pay = rate x hours, kept = offer - expenses (can be negative), step = kept - target pay, percent = after-expense hourly ÷ rate, met = kept ≥ target pay. The math is `projectStore.pricingSummary`.
- Biggest fix: the job with the most negative step. "With fix" = (kept - its step) ÷ target pay. Its share of the gap shows only when the shortfall is above 0 and the share is under 100%. Ties keep the list's order (newest edit first).

**Layout (Projects page)**
- Order: Back pill, title row, dashboard, then "All projects" (Geist 300, 26px) over the table and storage note. The table's "Offer pays after expenses" column is after expenses too.
- The dashboard shows when at least one project counts. Projects but none counting: "Add an offer to a project to see your pricing so far." Some left out: a mono 12px `--muted` note under the hero meta, "Based on 3 of 5 projects. The rest need an offer or hours."
- Cards: `--paper`, 1px `--line` border, 24px radius, 32px 40px padding (20px on phones), each starting and ending on the column grid lines. Hero and chart card full width; the three middle cards 4 columns each on desktop and the same height; on tablet Unpaid hours and Jobs at your target 4 + 4 with Biggest fix full width below; stacked on phones.
- Each card starts with an outlined pill (1px `--ink`, 999px radius, 14px Geist 400, 6px 16px padding). Smallest text in the dashboard and summary card: 12px. Tabular numbers. Money in whole dollars, with a real minus sign (−) for losses and "+" for gains. Hourly money in cents, except a whole-dollar target ("$55/hr", "$27.50/hr"). "1 job", "2 jobs".
- The dashboard re-renders after every change to the list. "Show as table" choices are kept, and re-rendering never moves focus.

**1. Your pricing so far** (hero, full width)
- Left: "You kept 55% of your target pay. Read left to right to see where the other $1,138 went." (24px Geist 300; "Read down" below 1024px). Under it, 15px `--ink-2`: "Social posts, Oct 14 is 74% of the gap." or, when one job is all of it, "All of it came from Social posts, Oct 14." Then mono 12px `--muted`: "5 jobs · Oct 7 to Oct 15 · after expenses" (one date when the same day; the year on dates not in this year). Kept at or over target: "You kept 104% of your target pay. Your offers covered every hour." and no gap line.
- Right: the percent, Geist 300, 180px desktop, 140px tablet, 104px phone (above the sentence on phones).
- Waterfall (1024px and up): Target pay (solid `--line`, from $0), one floating step per job, You kept (`--paid`, from $0). Shortfalls in `--stripe` with a 1px ink outline, gains in `--paid`. Dashed 1px `--ink-2` connectors, a 1px ink baseline at $0, 4px radius. Shortfalls largest first, then gains largest first. Values above the bars (totals 20px Geist 500, steps 16px `--ink-2`); under each bar the name (14px, 2 lines then an ellipsis, the full name on hover) and a mono 12px `--muted` note: "your hours at target", "short of target", "over target", "after expenses". With more than 6 jobs: the 5 largest steps (either sign), then "Other jobs (N)" with their net, "net of N jobs", just before You kept. The scale always covers $0 and every running total.
- Below 1024px: the same steps as rows (name and value on one line, the bar under it, same scale), a 1px ink line above You kept.
- "Show as table" (13px, underlined, `--ink-2`, top right) swaps the chart for a table (Step, Amount) and reads "Show as chart". Focus stays on the button.

**2. Three cards**
- **Unpaid hours:** the hours (Geist 300, 72px; 56px on phones) with mono 13px "hrs", shown to one decimal so paid and unpaid add up to the total. "Hours the offers did not cover. About 4 of every 10 hours." (n = unpaid ÷ total x 10, rounded; 0: "Less than 1 of every 10 hours."; 10: "Almost every hour."). None unpaid: "Every hour was covered." All unpaid: "None of your hours were covered." A bar: paid in `--paid`, unpaid in `--stripe` with an ink outline, 2px gap, with "41.1 hrs paid" and "28.4 hrs unpaid" under it (numbers Geist 500).
- **Jobs at your target:** "1" with mono "of 5". "Every job paid what you asked for." / "No job paid what you asked for yet." / "Only Logo, Oct 9 paid what you asked for." / "2 jobs paid what you asked for." Then up to 5 rows, lowest percent first, with hairlines: the name, mono "met" or "missed", and a 14px circle (`--paid` for met, `--stripe` with an ink outline for missed); then "+ N more".
- **Biggest fix:** the sunset with a 35% `--paper` wash and a 1px ink border, like the picked gap card; text `--ink` only (the sentence was `--ink-2` until October 17, 2026, at 4.50:1 on the warm part). "+$840", "Price Social posts, Oct 14 at your target and you go from 55% to 88% of your target pay.", a 12px bar (now in ink, the added part in stripes with an ink outline, the rest a `--paper` track, all clamped to 0 to 100%) with mono "now 55%" at the start and "with fix 88%" ending where the added part ends, then an ink pill "Fix Social posts, Oct 14". No biggest fix: "Every job met your target." and no bar or button.
- "Fix" opens that project on screen 2, scrolls to Ways to close the gap (instantly under reduced motion), and focuses its heading. It happens once: Back returns to Projects, and Back, Forward, and reload don't land on the gap again. If the gap section is hidden, screen 2 opens at the top.

**3. Each job vs your target** (full width)
- Pill and "Show as table" at the top, then "How close each job came to your target" (24px Geist 300) and "Real pay per hour as a share of the target you set for that job. Lowest first."
- A bullet chart, one row per job, lowest percent first, on a 0% to 150% scale: paid in `--paid`, the gap up to 100% in `--stripe` with an ink outline, a dashed ink line at 100% labeled "your target", and "36%" (Geist 500) with mono "$20.00 of $55/hr". Over 150% the bar stops at the edge and the value shows the real percent. Below 0%: all stripes and "below expenses". Ticks 0%, 50%, 100%, 150% (mono 12px). Legend: "paid, after expenses" and "short of your target".
- Hover a row (1024px and up, with a mouse): a dark tooltip (`--ink`, `--paper` text, 10px radius) in the empty space right of the target line, never over the values: the name, "Offer $500 · 24 hrs", "15.3 hrs unpaid".
- Below 1024px: name and percent on one line, the bar under them, the mono rate under the bar.
- Table view: Project, Real rate after expenses, Target, Share of target, plus Offer, Hours, and Unpaid hours, so the tooltip's information is in the table too.

**Summary card (screen 2)**
- On a saved project's result only (never the unsaved calculation, which includes shared links), when at least 2 projects count. After Your reply, before the footer. Up to 720px wide on desktop, full width on phones. `--paper`, 1px `--line` border, 24px radius, 28px padding (20px on phones).
- The pill "Your pricing so far", the percent (Geist 300, 64px; 56px on phones) with "of your target pay, across 5 jobs" (15px `--ink-2`) beside it, or under it when it doesn't fit, a 12px bar (kept in `--paid`, short in `--stripe` with an ink outline, 2px gap, clamped to 0 to 100%), mono 12px "$1,370 kept" and "$1,138 short" under the ends, and an underlined link "See your pricing so far" to Projects. At 100% or more the bar is all `--paid` and the right label reads "nothing short".
- Same numbers as the dashboard, updated whenever projects save.

**Accessibility**
- Each chart is a figure with a visually hidden summary ("Target pay $2,508. Social posts, Oct 14 short $840. ... You kept $1,370."). Drawn bars are hidden from screen readers; the tables are real tables.

## Share link and Save image (screen 2)

Approved by Kayla, October 12, 2026. References: `docs/design-share-desktop.png`, `docs/design-share-phone.png`, `docs/design-save-image.png`.

**Share button**
- Desktop: a text button with a share icon, between Projects and Save, styled like Projects. After copying, the label reads "✓ Copied" for 2 seconds (screen readers hear "Link copied"). Both labels sit in one grid cell, the inactive one hidden, so the button is as wide as the wider label, its text centered, and nothing shifts.
  Reason: sharing is secondary to saving, so only Save is solid ink. Feedback shows where you clicked and covers nothing.
- Phone: a 44px icon button on `--paper`, labeled "Share" for screen readers. It opens the phone's share sheet.
  Reason: the header must fit Edit, Projects, Share, and Save on one line, and students share by text and DM.

**Opening a shared link**
- A mono note above the hero, `--ink-2`, with a small ink dot: "Shared result. Change anything to make it yours." For a partly broken link: "Some numbers in this link didn't work, so we used examples."
  Reason: it explains where the numbers came from without looking like an error. The dot is ink, because red already means "your current hours".
- If you have unsaved numbers, a dialog asks: "Open the shared result? Your current numbers will be replaced." Buttons: "Open shared result" and "Keep mine".
  Reason: a link should never wipe someone's work.

**Save image** (next to "Copy reply")
- An outline button, "Save image". It makes a 1080x1350 PNG for the client.
  Reason: the reply and the image are both things you send to the client, so they sit together. 4:5 fills a phone screen in Messages, DMs, and email. PNG keeps text and stripes sharp.
- The image speaks to the client, not the student: "Design" (not "Production"), "work you don't see" (not "usually forgotten"), "$200 covers 7.2 hrs" (not "runs out"). No target rate gaps or losses.
  Reason: it explains the work without sounding like a complaint.
- Layout, top to bottom: job summary (mono), "11 hours of work" (Geist 300), one line of intro, the hours chart with the bracket and covers line, labels alternating on two rows, the legend, then "My price" on a `--sunset` panel, and "Made with Counter" (mono, small).
- **The logo, top right (October 18, 2026).** The header's lockup: the mark, then "counter" in Geist 400, 34px, -0.035em (-1.19px), ink `#161616`. The mark is the favicon path drawn with `Path2D` (evenodd, ink), 0.666em (22.6px) square, its bottom 0.012em (0.4px) below the baseline, 0.166em (5.6px) left of the "c". "counter" ends on the right margin (x 1000), on baseline 103, the job summary's baseline. If the summary would come within 32px of the logo, it breaks at a " · " onto a second line; with every job's example numbers it stays at least 120px away. "Made with Counter" stays at the bottom.
  Reason: it shares the top row's baseline and the image's right margin, so it reads as part of the layout, not a stamp on top of it.
- **Preview before saving.** "Save image" opens a native `<dialog>` showing the PNG it made (the same file, not redrawn). Title "Image for your client" (Geist 300). Under it: "This is exactly what they'll see. It uses your price to send, $310." with the real price, then a mono "1080 x 1350 PNG" (desktop only). Buttons: primary "Download image" (desktop) or "Share image" (phone, when the phone can share files), and an outline "Close". Alt text: "Image for your client: 11.5 hours of work, price $310".
  - Desktop: a centered panel on `--bg`, 28px radius, a dim backdrop. The image on the left (4:5, up to 640px tall, 1px `--line` border), the text and buttons on the right, aligned to the bottom.
  - Phone (below 760px): a bottom sheet, full width, 28px top corners. The image on top (up to 54vh), then the text, then the two buttons side by side, clear of the home bar.
  - Escape and Close return focus to "Save image". It only fades in, and not at all under reduced motion.
  Reason: the image goes to a client, so the student should see exactly what will be sent, and the price in it, before it leaves.
- The gradient rule (the places listed under Color) is for the page. The saved image is its own canvas and uses the paid gradient and one sunset panel.

## Dialogs

Decided with Kayla, October 13, 2026. Replaces the panels that opened under the header.

- Save as project, "Save this calculation first?", "Open the shared result?", and the link to copy by hand (when copying fails) are native `<dialog>`s opened with `showModal()`, styled like the image preview: `--bg`, 28px radius, the same dim backdrop, a 160ms fade in (none under reduced motion).
  Reason: a panel at the top of the page pushed everything down and scrolled you away from where you were.
- Desktop: centered, 480px wide, 32px padding, the text or field on top and the buttons under it, aligned left.
- Phone (below 760px): a bottom sheet, full width, 28px top corners, clear of the home bar. Buttons share the row and are 44px tall.
- Each keeps its panel's text, field, and buttons. Escape and Cancel (or Close) close it and return focus to the button that opened it; Escape on "Open the shared result?" means "Keep mine". The page never scrolls when a dialog opens or closes.
- **"Save this calculation first?" (October 19, 2026)**, when New calculation would replace an unsaved calculation with changes. Under the title, 15px `--ink-2`, linked with `aria-describedby`: "Your unsaved menu calculation will be replaced if you start a new one." (the job's name, its first letter lowercase). Buttons: "Save as project" (filled ink, the main action: saves, then starts the new calculation; nothing starts over if saving fails), "Don't save" (outline: starts the new calculation), then "Cancel" as a link. Focus opens on Cancel, the safest choice. On phones the two actions stack full width, with Cancel under them.
  Reason: one filled action per screen, and the safe choice is the main button, like banking apps: keeping your work is the easy path, throwing it away takes a deliberate tap.

## Don'ts

- No black page, no lime, no heavy font weights for numbers.
- Gradient only in the places listed.
- No text lighter than `--ink-2` on the gradient.
