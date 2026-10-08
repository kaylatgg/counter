# Counter design system (v2, "Split")

## What this file replaces

This is the source of truth for how Counter looks. It replaces:
- All of section 6 of CLAUDE.md (Design system).
- In section 7: the hero number style, and the form, colors, and styling of both charts. The two charts are redesigned below.

Everything else in CLAUDE.md still applies: the flow, the math, the copy rules, validation, accessibility, and tests. The receipt, quote, and reply keep their content from CLAUDE.md and take their styling from here.

Reference render: `docs/design-reference-split.png`. Match its proportions, weights, and spacing. Where the image and this file differ, this file wins. If something isn't covered, ask before deciding.

## Direction

**You type on the left. The truth shows up on the right.**

The page is split in two: a white input side and a full-height black result side. No cards, no rounded panels. Structure comes from the split, big bold type, thin lines, and alignment.

Four rules carry the look:
1. **Bold, tight type.** One family, heavy weights, negative tracking on anything large.
2. **One number dominates.** The hero number is huge. Everything else is clearly smaller.
3. **One signal color, lime, only on the dark side.** It marks your target and where the money runs out.
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
- Lime appears only on the dark side, and only for: your target rate, the "money runs out" marker, the gap, and emphasized words about the gap in sentences. Never on white (it's invisible there).
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
| Hero number | clamp(112px, 11.5vw, 168px) | 700 | -0.065em | line-height 0.8. Cents in `--night-dim` |
| Hero unit "/hr" | 28px | 600 | -0.01em | `--night-2`, sits on the baseline, 10px left |
| Page headline | 46px | 700 | -0.045em | line-height 0.98, breaks after "this" |
| Chart title | 20px | 600 | -0.02em | `--night-text` |
| Metric value | 26px | 600 | -0.02em | |
| Big input value (rate, expenses, offer) | 22px | 700 | -0.02em | |
| Stepper number | 24px | 700 | | |
| Wordmark "counter" | 18px | 800 | -0.04em | lowercase |
| Body and row labels | 15px | 400 | | |
| Group label (Production) | 12px | 700 | | |
| Small label, caption, axis | 12 to 13px | 500 | | muted color |

Sentence case. No all caps. No small labels stacked above headings.

## Layout (desktop, 960px and up)

- Two columns that fill the window height: **left 500px** white, **right** takes the rest, black. No gap, no rounded corners.
- Left padding 30px top, 48px sides. Right padding 30px top, 64px sides.
- The right column is `position: sticky; top: 0; height: 100vh; overflow-y: auto` so results stay in view while you scroll the inputs.
- Right column order, separated by `--night-line` hairlines with 34px above and below each:
  1. Hero: label, number, one sentence, metrics row
  2. Your hours chart
  3. Pay per hour chart
  4. Show the math (collapsed receipt)
  5. Your quote
  6. Your reply
- Phone layout: not now. Skip until Kayla says to start it.

## Sticky header

- A header bar stays fixed at the top of the window while the page scrolls. 56px tall, full width, `position: sticky; top: 0; z-index: 10`.
- It's split to match the columns below it, so it feels like part of the page, not a separate strip:
  - Left part (500px): `--paper` background, the wordmark "counter" (18px, 800, -0.04em, `--ink`), aligned with the left content (48px padding). Bottom hairline `--line`.
  - Right part: `--night` background, bottom hairline `--night-line`. Empty while the hero is on screen. Once the hero number scrolls out of view, a compact live summary fades in on the right side (120ms, off under reduced motion): "This offer pays" in 12px `--night-mute`, then "$17.39/hr" in 18px 700 `--night-text`, then "Estimate $310" in 14px 600 `--night-2`. With no offer: "Estimate $310" only. `aria-hidden`, since the full result is already on the page.
- The wordmark moves from the page body into this header (don't show it twice).
- The right results column is now sticky below the header: `top: 56px; height: calc(100vh - 56px)`.

## Light side (inputs)

- The wordmark lives in the sticky header. The light side starts 44px below the header with the headline, then "Example numbers. Change them to match your project." in `--muted`.
- Job line: "Restaurant menu" 15px 600 plus an "Example job" pill (1px `--line`, 12px `--muted`).
- **Steppers:** 40px circles. Minus: 1.5px `--ink` outline. Plus: solid `--ink` with a white icon. Number between, 24px 700. Label above in 13px 500 `--muted`.
- **Work rows:** group label (Production, 12px 700) with its total on the right in `--muted`. Each row: label left 15px, input right. Hairline `--line` under every row.
- **Hours inputs:** no box. 88px wide, 2px `--ink` bottom border only, value 17px 600 right-aligned, "hrs" 12px `--muted` after it.
- **Rate, expenses, offer:** a 3-column row. 12px 500 `--muted` label, then the value 22px 700 with a 2px `--ink` bottom border. "$" and "/hr" are part of the field display.
- **Offer choice:** two pills above the offer field. Selected: solid `--ink`, white text. Unselected: 1.5px `--ink` outline. Built from real radio inputs. When "No offer yet" is selected, the offer field hides.
- **Focus on the light side:** 2px `--ink` outline, 3px offset. Inputs also thicken their bottom border to 3px on focus.
- **Errors:** 16px alert icon plus message in `--error`, 13px, under the row. Bottom border turns `--error`.

## Dark side (results)

### Hero
- "This offer pays" (or "Estimated project price"), 14px `--night-2`, 22px space below.
- The hero number. With an offer: `$17` in `--night-text`, `.39` in `--night-dim`, then "/hr". With no offer: `$310`, no unit, no dimmed part.
- One sentence, 16px `--night-2`, max 34em, key numbers in 600 `--night-text`, the gap amount in 600 lime: "for **11.5 hours** of real work. That's **$7.61 an hour** under your $25 target." If the offer meets or beats the target: "for **11.5 hours** of real work. That meets your $25 target." (no lime).
- **Metrics row**, 34px below: three items split by 1px `--night-line` vertical lines. Label 12px `--night-mute`, value 26px 600.
  - With an offer: "After expenses" $15.65/hr, "Your estimate" $310, "Above the offer" +$110 (or "Below the offer" -$20, or "Matches the offer").
  - No offer: "Total hours" 11.5, "Your time" $287.50, "Expenses" $20.00.
- **Offer below expenses:** replace the sentence with a warning line: alert icon plus "This offer is $5.00 less than your expenses alone." in `--night-text`, with a 2px lime left border, 12px left padding.
- Screen readers get the full hero value in one label ("$17.39 per hour"). Hide the split spans.

### Chart 1: Your 11.5 hours, and where the money runs out
Question it answers: Where does the time go, and which part does the offer actually pay for?

- Title left: "Your 11.5 hours, and where the money runs out" (the number is live). Right: "1 block = 30 min" in 12px `--night-mute`.
- **Blocks:** each block is one unit of time, 56px tall, 4px gaps inside a group, 14px gaps between groups. Groups in order: Production, Communication, Revisions, Delivery.
- Block fills, all with a 1.5px `--night-text` inside outline:
  - Production: solid `--night-text`
  - Communication: diagonal lines at 135°, `--night-text` on transparent, 1.5px lines every 5px
  - Revisions: diagonal lines at 45°
  - Delivery: dots, 1.1px, every 5px
- **Unit size:** 30 min while total hours are 24 or fewer, 1 hr up to 48, 2 hrs beyond. Update the "1 block =" note to match. Block width fills the available space: (width minus gaps) divided by block count, max 22px, min 8px.
- **Partial blocks:** a group whose hours aren't a whole number of units ends with a narrower block sized to the remainder.
- **Where the money runs out** (only when there's an offer and it covers expenses): a 2px lime vertical line at the "hours the offer covers" position (7.2 hrs), from 34px above the blocks to their bottom. Label at the top, right of the line: "$200 runs out at 7.2 hrs", 13px 600 lime. Every block (or part of a block) after the line drops to 28% opacity. If the offer covers all the hours, no line, no dimming, and the label reads "$200 covers all 11.5 hrs" next to the title.
- If the offer is below expenses, no line; every block is dimmed, and the label reads "$15 doesn't cover your expenses".
- **Labels under each group:** "6h" 14px 600 `--night-text` plus the name 12px `--night-2`. Labels may overflow their group to the right, but must not change the block spacing (position them so they don't affect layout).
- **Summary sentence**, 14px `--night-2`, numbers in 600 `--night-text`: "**4.3 hours** go unpaid, and **5.5 hours** are work outside the design itself." Drop the first clause when nothing is unpaid.
- The blocks and the line are `aria-hidden`. A visually hidden list gives each group's hours, plus the summary sentence.

### Chart 2: Pay per hour
Question it answers: How far is this offer from my target?

- Title: "Pay per hour".
- **One horizontal ruler** in dollars per hour, from $0 to a rounded max a little above the largest value (steps: $5 up to $20, then $10, $25, $50; at most 6 ticks). 1px `--night-line` line, 6px `--night-tick` ticks, tick labels 12px `--night-mute` under the ticks, well below everything else.
- Points on the ruler:
  - **Offer:** 15px solid `--night-text` dot. Label above, right of the dot: "offer $17.39", 12px 600 `--night-text`.
  - **After expenses:** 15px hollow dot, 2px `--night-text` ring, `--night` fill. Label above, left of the dot: "after expenses $15.65", 12px `--night-2`.
  - **Target:** 4px by 25px lime bar. Label centered above: "target $25", 12px 600 lime.
- **The gap:** between the offer dot and the target, a 9px tall dashed lime band (4px dashes, 3px gaps). Under its center: "-$7.61/hr", 13px 600 lime. Hide this label if the band is under 64px wide.
- If the offer meets or beats the target: no gap band. Optional small label "+$X/hr" in `--night-2` between the target and the offer.
- If the after-expenses value is below $0: put the hollow dot at $0 with the label "after expenses -$0.43".
- If labels would overlap (values close together), move the after-expenses label below the ruler.
- `aria-hidden` on the ruler. Keep the summary sentence from CLAUDE.md under it in 14px `--night-2`.

### How we calculated this (collapsed by default)
- The right side should feel visual, not like a spreadsheet. So the receipt is hidden until asked for.
- Use a real `<details>` element. The summary row reads "Show the math" with a small chevron, 15px 600 `--night-text`, and the estimate on the right in 15px 600 ("$310"). Open, it reads "Hide the math".
- Inside: the same table as before. 14px, item `--night-2`, math `--night-mute`, amount `--night-text` right-aligned. Rows 8px padding, `--night-line` hairlines. Sum rows: 1px `--night-2` line above. Final row "Estimated project price $310" 22px 700.
- Under it, 12px `--night-mute`: "Taxes are not included. None of these numbers are take-home pay."
- No lists or tables anywhere else on the black side. The two charts replace the old hours and per-hour lists completely.

### Your quote and your reply
- Same input style as the light side, reversed: 2px `--night-text` bottom border, `--night-text` value, labels in `--night-mute`.
- "Use estimate": text button, lime, underlined.
- Reply textarea: transparent fill, 1px `--night-tick` border, 12px radius, 16px `--night-text`.
- "Copy reply": pill, solid lime fill, `--night` text, 48px tall, 600. The only lime-filled control on the page.
- "Update draft": pill, 1.5px `--night-text` outline, `--night-text` text.
- **Focus on the dark side:** 2px lime outline, 3px offset.

## Motion
- Block opacity and positions, the "runs out" line, the dots, and the gap band move with 180ms ease-out when values change. Nothing animates on load. All of it off under `prefers-reduced-motion`.

## Don'ts
- No cards, tiles, rounded panels, or shadows. The only rounded things are pills, circles, and the reply box.
- No gradients except the chart textures.
- No lime on the white side.
- No pies, donuts, sparklines, or decorative charts.
- No light font weights for numbers. Large numbers are 600 or 700.
