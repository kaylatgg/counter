# Counter design system (v5, "Sunset")

Source of truth for how Counter looks. Replaces every earlier version. CLAUDE.md still owns the flow, math, copy, validation, accessibility, and tests.

Reference images: `docs/design-v5-screen1.png` and `docs/design-v5-screen2.png`. Match them. If an image and this file differ, this file wins. If something isn't covered, ask. Ignore all older reference images.

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
- The gradient is only used for: the screen 1 corner glow, the button's arrow circle, the screen 2 hero panel, and paid hours in the chart. Reason: it always means "the answer."
- Text on the gradient is `--ink` or `--ink-2` only, and only over the cool left and top parts. Reason: `--muted` fails on the gradient, and warm red is too close to ink for small text.
- Stripes always mean unpaid or forgotten hours. Solid ink means design work.
- Add a light grain over gradients (SVG `feTurbulence` noise, about 8% opacity). Optional, drop it if it hurts performance.

## Type

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500&family=Geist+Mono:wght@400;500&display=swap">
```

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

## Screen 1: inputs

- `--bg` page. A soft blurred sunset glow off the top-right corner with two thin circle outlines. Nothing over the form fields.
- Header: "counter" (Geist 500, 20px) left; "Projects 3" and "Save as project" right. (The "for creative students" note was removed on October 11, 2026.)
- Headline, then the intro right under it, then "Example numbers..." in mono.
- Two columns: left (01 The job, 02 The work), right 480px and sticky (tally panel, 03 Your numbers, 04 Their offer, button).
- **Job choice:** a segmented control on `--paper`, selected segment ink with light text. Real radio inputs.
- **Steppers:** 44px circles, minus outlined, plus solid ink.
- **Work rows:** label, a small bar showing that row's hours (solid ink, or stripes for forgotten rows), then the input with a 1px ink underline. Forgotten rows get a mono "usually forgotten" note.
- **Tally panel ("Your work so far"):** `--paper`, 24px radius. Big total, then one bar of all groups (solid then stripes) with mono hour labels. Mono note "5.5h usually forgotten". Live.
- **Their offer:** "Did they offer an amount?" Yes / Not yet segmented control, next to "Amount they offered".
- **Button:** full width, 80px, fully rounded, ink. "Check the offer" (20px) and mono "11.5 hrs of work for $200". Right end: a 60px circle filled with `--sunset` and an ink arrow. Reason: the circle previews the answer.
- Replace / Keep my numbers: small rectangular buttons, not pills.

## Screen 2: result

- Header row: "counter", "Edit details" pill, then the live controls on the right (item stepper, rounds stepper, offer, target).
- **Hero panel:** `--sunset`, 24px margin, 28px radius, about 380px tall. Top left: "This offer pays". Top right: mono job summary and the sentence ("for 11.5 hours of real work. That's $7.61 an hour under your $25 target.") in ink. Bottom left: the hero number.
- **Stats row:** 4 columns with a hairline above each: Your estimate, More than they offered, Hours the offer pays for (7.2 of 11.5 hrs), After expenses.
- **Chart 1, "Where your 11.5 hours go"** (left, about 680px):
  - One bar per group, 96px tall, 4px gaps, widths by hours.
  - Paid hours filled with `--paid` as one continuous gradient across groups. Unpaid hours in `--stripe`, 1px ink outline.
  - Dashed line at the runs-out point with mono "$200 runs out at 7.2 hrs".
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
- Below: Show the math (collapsed), then Your price and Your reply side by side, then the footer.
- "Copy reply": fully rounded ink button.

## Motion

On "Check the offer": the button's gradient circle grows into the hero panel (about 400ms), the number counts up, the paid fill sweeps left to right, then the red dot appears. Once only. Off under reduced motion.

## Details decided while building v5

Decided with Kayla, October 11, 2026:
- **"h" only in small mono chart labels** (axis ticks, tally bar labels, the rate chart's dot labels). Sentences, stats, inputs, and headings keep "hrs": the tally note reads "5.5 hrs usually forgotten".
  Reason: CLAUDE.md's terms stay intact; the short form only where space is tight and the context is clearly data.
- **The rate curve is after expenses**, so "at 7.2h you hit $25" matches "$200 runs out at 7.2 hrs" in the chart beside it. Subtitle: "After your $20 in expenses, $200 spread over more hours pays less per hour." Red dot: "11.5h → $15.65/hr after expenses".
  Reason: both charts tell the same story.
- **No offer:** stats are Total hours, Your time at $25/hr, Expenses, and Usually forgotten (5.5 hrs, mono note "worth $137.50 at your rate"). The hours chart takes the full row.
- **Chart summaries are visible**, one 14px `--ink-2` line under each legend.
  Reason: CLAUDE.md requires a written summary under every chart.

Decided while building:
- **No offer in the hours chart:** the legend reads "design work" (solid) and "usually forgotten" (stripes).
- **No runs-out line** when the offer covers everything or doesn't cover expenses. The label row says so instead ("$400 covers all 11.5 hrs", "$15 doesn't cover your expenses").
- **Paid gradient** spans the whole bar width, so a color always means the same point in the hours.
- **Rate chart labels** take the spot with the fewest conflicts (plot edges, then other labels and dots, then the curve, then the target line). Y labels: the target always; $0, the top, and a negative bottom only when 16px or more from it. Grid steps: the smallest round step with at most 7 spaces.
- **Below expenses**, the curve sits under $0 with a hairline at $0 and no crossing dot.
- **Bar labels** that can't fit in one row alternate onto a second row.
- **Screen 2's header row is sticky** with a `--bg` background, so the live controls stay in reach. Screen 1's header scrolls away so it never cuts the glow.
- **Row bars on screen 1** share one scale: 25px per hour, narrower when any row would pass 150px.
- **The reveal** fades screen 1 (200ms), grows the orb from the button's circle to the hero panel (400ms), then fades screen 2 in, counts the number up, sweeps the bars (600ms), and shows the red dot last.
- **The corner glow** uses the sunset colors as one radial gradient, hottest at the center, blurred.

## Don'ts

- No black page, no lime, no heavy font weights for numbers.
- Gradient only in the four places listed.
- No text lighter than `--ink-2` on the gradient.
- Phone layout: not now.
