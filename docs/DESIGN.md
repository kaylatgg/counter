# Counter design system (v3.1, "Two screens")

## What this file replaces

This is the source of truth for how Counter looks. It replaces:
- All of section 6 of CLAUDE.md (Design system).
- In section 7: the hero number style, and the form, colors, and styling of both charts. The two charts are redesigned below.

Everything else in CLAUDE.md still applies: the flow, the math, the copy rules, validation, accessibility, and tests. The receipt, quote, and reply keep their content from CLAUDE.md and take their styling from here.

Reference renders: `docs/design-screen1-inputs.png` and `docs/design-screen2-results.png`. Match their proportions, weights, and spacing. Where an image and this file differ, this file wins. If something isn't covered, ask before deciding. (`design-reference-split.png` and `design-reference-desktop.png` are older directions. Ignore them.)

## Direction

**Count the work, then see the truth.**

Two screens. Screen 1 is a white page where you enter the job. One button turns the page black and reveals the result full width. A slim control bar keeps the key numbers live on the results screen. No cards, no rounded panels. Structure comes from big bold type, thin lines, and alignment.

Four rules carry the look:
1. **Bold, tight type.** One family, heavy weights, negative tracking on anything large.
2. **One number dominates.** The hero number is huge. Everything else is clearly smaller.
3. **One signal color, lime, only on black.** It marks your target and where the money runs out. On screen 1 it appears only inside the black "Check the offer" button, as a preview of the results.
4. **Charts you can count.** Hours are drawn as blocks of time. Pay is drawn as points on one ruler.

## Tokens

```css
:root {
  /* Light side (inputs) */
  --paper:   #FFFFFF;
  --ink:     #0E0F12;  /* 19:1 */
  --muted:   #5F646D;  /* labels, hints. 6:1 */
  --line:    #E3E5E8;  /* hairlines, decorative */
  --control: #8A9099;  /* 3.2:1, only for outlines that must be visible */

  /* Dark side (results) */
  --night:      #0C0D0F;
  --night-text: #F4F4F2;  /* 17.6:1 */
  --night-2:    #B9BCC2;  /* secondary text. 10:1 */
  --night-mute: #8B9098;  /* captions, axis labels. 6:1 */
  --night-dim:  #5E626A;  /* ONLY the dimmed cents of the hero number (large text). 3.2:1 */
  --night-tick: #6E737B;  /* axis ticks. 4:1 */
  --night-line: #26282D;  /* hairlines, decorative */
  --lime:       #D4FF3F;  /* the signal. 16.8:1 on night */

  /* States */
  --error: #B42318;  /* errors, light side only, always with an icon. 6.5:1 */
}
```

Color rules:
- Lime appears only on black, and only for: your target rate, the "money runs out" marker, the gap, emphasized words about the gap, "Copy reply", and the arrow square of the screen 1 button. Never directly on white (it's invisible there).
- No other colors anywhere. No green or red arrows.
- Text never lighter than `--muted` on white or `--night-mute` on black. The one exception is the hero's dimmed cents.

## Type

One family: **Geist**, from Google Fonts.

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&display=swap">
```

Fallback `system-ui, sans-serif`. `font-variant-numeric: tabular-nums` on the whole page. `-webkit-font-smoothing: antialiased`.

| Role | Size | Weight | Tracking | Notes |
|---|---|---|---|---|
| Hero number | clamp(96px, 9.5vw, 136px) | 700 | -0.065em | line-height 0.8. Cents in `--night-dim` |
| Hero unit "/hr" | 28px | 600 | -0.01em | `--night-2`, sits on the baseline, 12px left |
| Page headline (screen 1) | 56px | 700 | -0.05em | line-height 0.95, breaks after "job" |
| Section title (1 The job) | 17px | 600 | | step number in `--muted` |
| Chart title | 20px | 600 | -0.02em | `--night-text` |
| Metric value | 30px | 600 | -0.02em | |
| Button label (screen 1) | 19px | 700 | -0.02em | |
| Big input value (rate, expenses, offer) | 22px | 700 | -0.02em | |
| Stepper number | 24px | 700 | | |
| Wordmark "counter" | 18px | 800 | -0.04em | lowercase |
| Body and row labels | 15px | 400 | | |
| Group label (Production) | 12px | 700 | | |
| Small label, caption, axis | 12 to 13px | 500 | | muted color |
| Job line ("Restaurant menu", screen 1) | 15px | 600 | | |
| Hours input value | 17px | 600 | | right-aligned |
| Total row | 15px label, 22px value | 700 | -0.02em on the value | |
| Offer pills | 14px | 600 | | |
| Error message | 13px | 600 | | `--error` on white; 12px 500 `--night-text` under control bar fields |
| Empty and error states (screen 2) | 16px | 400 | | `--night-2`, same as the hero sentence |
| Below-expenses warning | 16px | 400 | | `--night-text` |
| Text link ("Use my estimate") | 14px | 600 | | lime, underlined |
| Quote line, reply notice | 14px | 400 | | `--night-2`, same as chart summaries |
| Pill buttons ("Copy reply", "Update draft") | 15px | 600 | | |
| Copy status ("Copied to clipboard.") | 13px | 400 | | `--night-2` |
| Skip link | 15px | 600 | | |
| Stepper icons (−, +) | 18px on screen 1, 15px in the control bar | 600 | | icons, not text |

Line length: body text, hints, summaries, and notes stay under about 75 characters (`max-width: 36em`). Paragraphs use `text-wrap: pretty` so no word is left alone on a line; headings use `text-wrap: balance`.

Sentence case. No all caps. No small labels stacked above headings.

## Spacing scale

All margins, padding, and gaps use this scale: **4, 8, 12, 16, 24, 28, 32, 40, 56, 64**.

Exceptions, because they're geometry rather than spacing:
- Borders, focus offsets, and optical nudges of 1 to 3px.
- Chart internals that the drawing code also uses: the 4px and 14px block gaps, the 34px room above the blocks for the "runs out" line, the 44px room below them for group labels, the 80px row gap if blocks wrap, and the dot and ruler positions.
- Hit-area tricks, such as the control bar steppers' -4px margins around 44px touch targets.
- Scroll padding under the sticky header and bar (56px and 120px).

## Layout (desktop, 960px and up)

Both screens live in the same page (one `index.html`). Only one shows at a time. No page reload.

### Header (both screens)
- 56px tall, `position: sticky; top: 0; z-index: 10`, 64px side padding, wordmark "counter" left.
- Screen 1: `--paper` background, `--line` bottom hairline, `--ink` wordmark.
- Screen 2: `--night` background, `--night-line` bottom hairline, `--night-text` wordmark. Right side: the job name ("Restaurant menu") in 13px `--night-2`.

### Screen 1: inputs (white)
- Content max width 1312px, centered, 64px side padding, 40px below the header.
- **Top row:** the same two columns as the form below. Headline in the left column ("What does this job / really pay?"). In the right column, starting exactly at its left edge, max 380px, bottom-aligned with the headline: the intro line (16px `--ink`) and "Example numbers. Change them to match your project." (14px `--muted`). 40px below, a `--line` hairline.
- **Two columns**, equal width, 64px gap, 28px below the hairline:
  - **Left column:** 1 The job, then 2 The work.
  - **Right column:** 3 Your numbers, then 4 Their offer, then the button. It's sticky (`top: 84px`, the 56px header plus 28px), so it stays in view while the left column scrolls.
  - Sections inside a column are separated by a `--line` hairline with 28px above and below.
  - This keeps the reading order 1, 2, 3, 4 (down the left, then down the right) and ends on the button.
- **2 The work** starts with the hint "Example hours. Change any to match how you work." and ends with a total row: 2px `--ink` line above, "Total hours" 15px 700 left, "11.5 hrs" 22px 700 right (live).
- **Footer:** below both columns, a `--line` hairline, then the disclaimer in 12px `--muted`.

### The button (end of screen 1)
- Full width of the right column, 40px below the offer, 76px tall, **square corners**. Built as a real `<button>`.
- Two parts side by side:
  - Main area: `--night` background, 24px left padding. Line 1: "Check the offer" (19px 700, `--night-text`). Line 2: a live preview, "11.5 hrs of work for $200" (12px `--night-mute`).
  - Right end: a 76px square in `--lime` with a black arrow icon (26px, 2.5px stroke, square ends).
- With "No offer yet": "Get my estimate" and "11.5 hrs of work at $25/hr".
- While there are errors, the button stays enabled. Pressing it moves focus to the first field with an error and shows its message.
- Hover: main area `#1A1C20`. Focus: 2px `--ink` outline, 3px offset.
- Pressing it shows screen 2, scrolls to the top, and moves keyboard focus to the "This offer pays" label (so screen readers announce the result).

### Screen 2: results (black)
- Whole page `--night` background. Content capped at 1440px wide and centered, with 64px side padding, so it lines up with the header and screen 1. The control bar's background runs edge to edge, with its content in the same centered column.
- The browser's Back button returns to screen 1 with every value kept.
- The footer disclaimer shows at the bottom of screen 2 too, 12px `--night-mute`, above a `--night-line` hairline.
- **Control bar** directly under the header: 64px tall, `#15171A` background, `--night-line` bottom hairline, 64px side padding, items in one row with 28px gaps:
  1. "Edit all details" with a left chevron, 13px 600 `--night-2`. Returns to screen 1 with all values kept, focus on the headline.
  2. 1px `--night-line` divider.
  3. Pages stepper and Rounds stepper, compact: label 12px `--night-mute`, 30px circles (minus: 1.5px `--night-2` outline, plus: solid `--night-text` with a `--night` icon), number 18px 700.
  4. Divider.
  5. Offer and Target as inline editable fields: label 12px `--night-mute`, value 18px 700 with a 2px `--night-text` bottom border. Hide Offer when "No offer yet". An error shows right under its field: a small alert icon plus the message, 12px `--night-text`.
  6. Right end: "Change these to update the result" in 12px `--night-mute`.
  - These controls are the same values as screen 1. Changing them updates everything on both screens.
  - The bar is sticky under the header (`top: 56px`).
- **Row 1 (hero):** two columns, `1fr` and 300px, 64px gap, 40px top padding, 28px bottom padding, `--night-line` hairline below.
  - Left: label, hero number, sentence.
  - Right: 1px `--night-line` left border, 32px left padding, the three metrics **stacked** vertically, each separated by a hairline.
  - The label sits on its own row above both columns, so the top of the metrics column lines up exactly with the top of the hero number.
- **Row 2 (charts):** two columns, `minmax(0, 1fr)` and 440px, 56px gap, 32px top padding. Left: the hours chart. Right: 1px `--night-line` left border, 40px left padding, the pay per hour chart.
- **Row 3, below the fold:** the full content width. "Show the math" spans it. Below that, "Your price" (left) and "Your reply" (right) sit side by side in two equal columns with a 64px gap. Each row has a `--night-line` hairline above with 32px spacing.
- Phone layout: not now. Skip until Kayla says to start it.

### Inputs (both screens)
- **Steppers (screen 1):** 40px circles. Minus: 1.5px `--ink` outline. Plus: solid `--ink` with a white icon. Number between, 24px 700. Label above in 13px 500 `--muted`.
- **Work rows:** group label (Production, 12px 700) with its total on the right in `--muted`. Each row: label left 15px, input right. Hairline `--line` under every row.
- **Hours inputs:** no box. 88px wide, 2px `--ink` bottom border only, value 17px 600 right-aligned, "hrs" 12px `--muted` after it.
- **Target hourly rate and project expenses:** two equal columns. 12px 500 `--muted` label, value 22px 700 with a 2px `--ink` bottom border.
- **Offer choice:** two pills. Selected: solid `--ink`, white text. Unselected: 1.5px `--ink` outline. Real radio inputs. The offer field (half the column width) hides with "No offer yet".
- **Focus on white:** 2px `--ink` outline, 3px offset. Inputs thicken their bottom border to 3px on focus.
- **Errors:** 16px alert icon plus message in `--error`, 13px, under the row. Bottom border turns `--error`.

## Dark side (results)

### Hero
- "This offer pays" (or "Your estimate"), 14px `--night-2`, 24px space below.
- The hero number. With an offer: `$17` in `--night-text`, `.39` in `--night-dim`, then "/hr". With no offer: `$310`, no unit, no dimmed part.
- One sentence, 16px `--night-2`, max 34em, key numbers in 600 `--night-text`, the gap amount in 600 lime: "for **11.5 hours** of real work. That's **$7.61 an hour** under your $25 target." If the offer meets or beats the target: "for **11.5 hours** of real work. That meets your $25 target." (no lime).
- **Metrics** (right column of the hero row, stacked): three items split by `--night-line` hairlines, 16px padding each. Label 12px `--night-mute`, value 30px 600.
  - With an offer: "After expenses" $15.65/hr, "Your estimate" $310, "Over their offer" +$110 (or "Under their offer" -$20, or "Same as their offer" $0).
  - No offer: "Total hours" 11.5 hrs, "Your time at $25/hr" $287.50, "Expenses" $20.00.
- **Offer below expenses:** replace the sentence with a warning line: alert icon plus "This offer is $5.00 less than your expenses alone." in `--night-text`, with a 2px lime left border, 12px left padding.
- Screen readers get the full hero value in one label ("$17.39 per hour"). Hide the split spans.

### Chart 1: Your 11.5 hours, and where the money runs out
Question it answers: Where does the time go, and which part does the offer actually pay for?

- Title left: "Your 11.5 hours, and where the money runs out" (the number is live). Right: "1 block = 30 min" in 12px `--night-mute`.
- **Blocks:** each block is one unit of time, 56px tall, 4px gaps inside a group, 14px gaps between groups. Groups in order: Production, Communication, Revisions, Delivery.
- On screen 2 the blocks are 64px tall.
- Block fills, all with a 1.5px `--night-text` inside outline:
  - Production: solid `--night-text`
  - Communication: diagonal lines at 135°, `--night-text` on transparent, 1.5px lines every 5px
  - Revisions: diagonal lines at 45°
  - Delivery: dots, 1.1px, every 5px
- **Unit size:** 30 min while total hours are 24 or fewer, 1 hr up to 48, 2 hrs beyond. Update the "1 block =" note to match. Block width fills the full width of the chart's column: (width minus gaps) divided by block count, min 8px, no maximum.
- **Partial blocks:** a group whose hours aren't a whole number of units ends with a narrower block sized to the remainder.
- **Where the money runs out** (only when there's an offer and it covers expenses): a 2px lime vertical line at the "hours the offer covers" position (7.2 hrs), from 34px above the blocks to their bottom. Label at the top, right of the line: "$200 runs out at 7.2 hrs", 13px 600 lime. Every block (or part of a block) after the line drops to 28% opacity. If the offer covers all the hours, no line, no dimming, and the label reads "$200 covers all 11.5 hrs" next to the title.
- If the offer is below expenses, no line; every block is dimmed, and the label reads "$15 doesn't cover your expenses".
- **Labels under each group:** the hours on one line ("6 hrs", 14px 600 `--night-text`) and the name below ("Production", 12px `--night-2`), left-aligned to the group. A label never reaches into the next group's space: if a name is wider than its blocks, the gap after that group widens just enough (at least 12px before the next group), and block widths are worked out after that.
- **Summary sentence**, 14px `--night-2`, numbers in 600 `--night-text`: "**4.3 hours** go unpaid, and **5.5 hours** are work outside production." With no outside work: "All 11.5 hours are production." Drop the first clause when nothing is unpaid.
- The blocks and the line are `aria-hidden`. A visually hidden list gives each group's hours, plus the summary sentence.

### Chart 2: Pay per hour
Question it answers: How far is this offer from my target?

- Title: "Pay per hour".
- **One horizontal ruler** in dollars per hour, from $0 to a rounded max a little above the largest value (steps: $5 up to $20, then $10, $25, $50; at most 6 ticks). 1px `--night-line` line, 6px `--night-tick` ticks, tick labels 12px `--night-mute` under the ticks, well below everything else. The last tick carries the unit ("$30/hr").
- Points on the ruler:
  - **Offer:** 15px solid `--night-text` dot. Label above the ruler, left of the dot: "offer $17.39/hr", 12px 600 `--night-text`.
  - **After expenses:** 15px hollow dot, 2px `--night-text` ring, `--night` fill. Label below the ruler, centered under the dot: "after expenses $15.65/hr", 12px `--night-2`.
  - **Target:** 4px by 25px lime bar. Label above the ruler, centered on the bar: "target $25/hr", 12px 600 lime.
- **The gap:** between the offer dot and the target, a 9px tall dashed lime band (4px dashes, 3px gaps). Below the ruler, under its center: "-$7.61/hr", 13px 600 lime. Hide this label if the band is under 64px wide.
- If the offer meets or beats the target: no gap band. Optional small label "+$X/hr" in `--night-2` below the ruler, between the target and the offer.
- If the after-expenses value is below $0: put the hollow dot at $0 with the label "after expenses -$0.43/hr".
- **Labels never overlap, for any values.** Above the ruler: offer and target. If they would come closer than 8px, they slide apart just enough, staying inside the ruler. Below the ruler: the gap amount and "+$X/hr" share a row the same way ("+$X/hr" hides first if the row can't fit). "after expenses" stays centered under its dot; if that would put it closer than 8px to another label below the ruler, it moves to a second row of its own, and the tick labels move down to stay below it.
- `aria-hidden` on the ruler. Keep the summary sentence from CLAUDE.md under it in 14px `--night-2`.

### How we calculated this (collapsed by default)
- The right side should feel visual, not like a spreadsheet. So the receipt is hidden until asked for.
- Use a real `<details>` element. The summary row reads "Show the math" with a small chevron, 15px 600 `--night-text`, and the estimate on the right in 15px 600 ("$310"). Open, it reads "Hide the math".
- Inside: the same table as before. 14px, item `--night-2`, math `--night-mute`, amount `--night-text` right-aligned. Rows 8px padding, `--night-line` hairlines. Sum rows: 1px `--night-2` line above. Math cells carry units ("2 hrs + 2 pages x 2 hrs", "11.5 hrs x $25/hr"). "Rounded up to the nearest $5". Final row "Your estimate $310" 22px 700.
- Under it, 12px `--night-mute`: "Taxes are not included. None of these numbers are take-home pay."
- No lists or tables anywhere else on the black side. The two charts replace the old hours and per-hour lists completely.

### Your price and your reply
- Same input style as the light side, reversed: 2px `--night-text` bottom border, `--night-text` value, labels in `--night-mute`.
- Section "6 Your price", field "Price to send".
- "Use my estimate": text button, lime, underlined. It clears the price field, so the price follows the estimate again.
- Reply textarea: transparent fill, 1px `--night-tick` border, 12px radius, 16px `--night-text`.
- "Copy reply": pill, solid lime fill, `--night` text, 48px tall, 600. The only lime-filled control on the page.
- "Update draft": pill, 1.5px `--night-text` outline, `--night-text` text.
- **Focus on the dark side:** 2px lime outline, 3px offset.

## Motion
- Block opacity and positions, the "runs out" line, the dots, and the gap band move with 180ms ease-out when values change. Nothing animates on load. All of it off under `prefers-reduced-motion`.

### The reveal (pressing "Check the offer")
Plays once per press of the button, about 1 second in all. Not on load, not on the browser's Back or Forward, and never replayed when values change on screen 2 (those use the normal 180ms transitions).
1. **Fade (200ms):** screen 1 fades out as the page and header turn black (100ms), then screen 2 fades in (100ms).
2. **Hero count-up (500ms, ease-out cubic):** the hero number counts from $0 to its value. Screen readers get the final value right away from the hidden label; only the visible digits move. If a value changes during the count, the real value takes over.
3. **Blocks fill in:** left to right, each growing up from its base (220ms), starting 150ms after screen 2 appears, staggered 18ms apart (less for big jobs, so the fill takes at most 400ms).
4. **The lime line drops in last:** the "runs out" line and its label fade in while dropping 12px (200ms), right after the last block.
- Under `prefers-reduced-motion`, none of this plays: the final state shows immediately.

## Don'ts
- No cards, tiles, rounded panels, or shadows. The only rounded things are pills, circles, and the reply box.
- No gradients except the chart textures.
- No lime directly on white.
- No rounded pill for the screen 1 button. It's a square-cornered black block with the lime arrow square.
- No pies, donuts, sparklines, or decorative charts.
- No light font weights for numbers. Large numbers are 600 or 700.
