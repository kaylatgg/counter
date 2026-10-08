# Counter design system (v4, "Lime reveal")

This file is the source of truth for how Counter looks. It replaces all earlier versions. CLAUDE.md still owns the flow, math, copy, validation, accessibility, and tests.

Reference images: `docs/design-v4-screen1.png` and `docs/design-v4-screen2.png`. Match their proportions and hierarchy. If an image and this file differ, this file wins. If something isn't covered, ask. Ignore all older reference images.

Every rule below has a reason. Keep the reasons when you change anything.

## The idea

**Counter counts the hours you don't see.**

The time block (1 block = 30 minutes) is the visual language of the whole product. It appears on screen 1 while you type, and again on screen 2 in the result.
Reason: the blocks are Counter's signature. Using them on both screens connects the two screens and makes the main insight (forgotten work) visible from the start.

**The reveal: the lime square on the button opens into a lime result band.**
Reason: both screens stay light, so the change isn't a harsh flip from white to black. The button's lime square previews the answer, then becomes it.

## Tokens

```css
:root {
  --paper:   #FFFFFF;
  --bar:     #F3F4F5;  /* screen 2 control bar */
  --ink:     #0E0F12;  /* 19:1 on white, 16.6:1 on lime */
  --ink-2:   #4A4F57;  /* secondary text. 8.2:1 white, 7.1:1 lime */
  --muted:   #5F646D;  /* labels, hints. 6:1 white, 5.2:1 lime */
  --line:    #E3E5E8;  /* hairlines on white, decorative */
  --control: #8A9099;  /* outlines that must be seen on white. 3.2:1 */
  --tag:     #C9CDD3;  /* tag border, decorative */
  --lime:    #D4FF3F;  /* the brand color */
  --error:   #B42318;  /* 6.5:1 on white, always with an icon */
}
```

- Lime is used as a **background** only: the result band and the arrow square on the button. Never lime text or lime lines on white.
  Reason: lime on white is about 1:1 contrast, so it can't carry meaning there. As a background under ink text it's 16.6:1.
- Everything on the lime band is ink, ink-2, or muted. Axis ticks on lime use `--ink-2`.
  Reason: `--control` gray falls below 3:1 on lime.
- No other colors.
  Reason: with one brand color, lime always means "the answer."

## Type

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,700..900&family=Geist:wght@400;500;600;700;800&display=swap">
```

- **Archivo** (wide, heavy) is only for big numbers: the tally total, the hero number, and the metric values. Settings: `font-stretch: 118%`, weight 800, letter-spacing -0.02em (hero -0.035em).
  Reason: the numbers are the product, so they get their own voice. It also keeps the page from looking like every other Geist site.
- **Geist** is for everything else. Tabular numbers on the whole page.
  Reason: clean and readable for forms and labels.

| Role | Font | Size | Weight |
|---|---|---|---|
| Headline | Geist | 60px, -0.05em, line-height 0.95 | 700 |
| Intro | Geist | 18px, line-height 1.45, max 36em | 400 |
| Section title ("1 The job") | Geist | 18px | 700, number 500 `--muted` |
| Tally total | Archivo | 56px | 800 |
| Hero number | Archivo | 140px, line-height 0.8 | 800 |
| Hero cents | Archivo | 45% of hero, raised to the top | 800 |
| Hero "/hr" | Geist | 26px, `--ink-2` | 600 |
| Metric values | Archivo | 30px | 800 |
| Chart title | Geist | 20px, -0.02em | 600 |
| Body, row labels | Geist | 15px | 400 |
| Group label | Geist | 12px | 700 |
| Small labels, hints, axis | Geist | 12 to 13px, `--muted` | 500 |
| Tag ("Usually forgotten") | Geist | 11px, `--muted`, 1px `--tag` border, 4px radius | 600 |

Cents are **smaller and raised**, not grayed.
Reason: gray cents at full size pulled attention to the least important digits.

Spacing scale: 4, 8, 12, 16, 24, 28, 32, 40, 56, 64.

## Screen 1: inputs (white)

Content max width 1312px, 64px side padding. Header 56px, white, hairline below, wordmark "counter" (Geist 800, 18px, -0.04em).

**Top:** headline, then the intro right under it, then "Example numbers. Change them to match your project." in 14px `--muted`. Then a hairline.
Reason: people read the question, then right away what to do.

**Two columns, 72px gap.** Left: 1 The job, 2 The work. Right (sticky below the header): the tally box, 3 Your numbers, 4 Their offer, the button.
Reason: reading order stays 1, 2, 3, 4 and ends on the button. The sticky right column keeps the total and the button in view while you edit hours.

**1 The job**
- Job tabs in one row: Restaurant menu, Logo, Social posts, Poster or flyer, Custom. Text tabs, 15px. Selected: 600 `--ink` with a 2.5px ink underline. Others: 500 `--muted`. A hairline under the row. Built as real radio inputs.
  Reason: tabs say "pick one," never wrap, and look different from on/off switches and action buttons.
- The "Replace your numbers?" question uses **rectangular buttons** (Replace: solid ink. Keep my numbers: 1.5px ink outline), 4px radius.
  Reason: actions must not look like choices.
- Steppers: 40px circles. Minus outlined, plus solid ink.

**2 The work**
- Hint: "Example hours. Change any to match how you work. 1 block = 30 min."
- Group label rows show a 10px swatch in the group's texture, then the name, total on the right.
- Each work row: label, then **a live row of mini blocks** (7px x 16px, 2px gap, group texture, 1px ink outline), then the hours input (84px, 2px ink underline).
  Reason: you see your hours stack up while you type.
- Communication, Revisions, and Delivery rows get a **"Usually forgotten" tag** after the label.
  Reason: this is Counter's thesis, shown where people make the mistake.
- Textures (on white): Production solid ink. Communication 135° lines. Revisions 45° lines. Delivery dots. Same on both screens.

**Tally box ("Your work so far")**, top of the right column.
- 1.5px ink border, 22px x 24px padding, no radius. The only box on the page.
  Reason: it's the only thing that sums everything up, so it's the only thing framed.
- Top row: "Your work so far" (13px 600 `--muted`) left, "**5 hrs** usually forgotten" right.
- Total in Archivo 56px, "hrs" in Geist 20px `--muted`.
- A strip of all blocks (12px x 30px, 3px gaps, 8px between groups).
- All live.

**3 Your numbers:** target hourly rate and project expenses, two equal columns, 24px values with a 2px ink underline, hints under each.

**4 Their offer:** "Did they offer an amount?" with a **pill switch** (Yes / Not yet), next to "Amount they offered." The amount hides on "Not yet."
Reason: a yes/no question looks like a switch.

**The button:** full width of the right column, 76px tall, square corners. Ink main area: "Check the offer" (19px 700 white) and the live line "11.5 hrs of work for $200" (12px `#8B9098`). Right end: a 76px lime square with an ink arrow. With no offer: "Get my estimate" and "11.5 hrs of work at $25/hr".

## Screen 2: result (light, with the lime band)

Content max width 1440px, 64px side padding.

**Header:** white, wordmark left, job name right (13px `--ink-2`).

**Control bar:** `--bar` background, 60px tall, hairline below, sticky under the header. Edit all details, item stepper, rounds stepper, offer, target. No helper sentence.
Reason: live updates explain themselves.

**The lime band** (full bleed, `--lime`, 30px top, 26px bottom padding) holds the whole answer:
1. **Hero row:** "This offer pays" (14px `--ink-2`). The hero number with small raised cents, and "/hr" next to it. To the right, aligned to the bottom of the number: the sentence (18px `--ink-2`, key numbers 600 ink): "for **11.5 hours** of real work. That's **$7.61 an hour** under your $25 target."
   Reason: the number and its meaning read together, with no dead space.
2. **The pay ruler, full width, right under the hero.** Ink axis line, `--ink-2` ticks every $5, labels 12px `--muted`, last label "$30/hr".
   - This offer: 18px solid ink dot, label below "this offer $17.39" (13px 600, lime background behind the text so the axis line doesn't cross it).
   - After expenses: 18px hollow dot (2px ink ring, lime fill), label above, left.
   - Target: 4px x 32px ink bar, label above, right: "your target $25" (13px 700).
   - The gap: 12px tall dashed ink band between the offer and the target, label above it: "$7.61/hr short" (14px 700).
   - Labels never overlap. Keep the existing collision rules.
   Reason: "$17.39" means nothing until you see "$25" next to it.
3. **Metrics row:** "Your estimate" $310, "More than they offered" $110, "Hours the offer pays for" 7.2 of 11.5. Labels 12px `--muted`, values Archivo 30px. 1px `--ink-2` dividers at 30% opacity between items.
   Reason: no repeated numbers, no confusing plus sign, and the third metric leads into the chart below.

**Below the band, on white:**
- **"Your 11.5 hours, and where the money runs out"**, full width.
  - Blocks fill the full content width, 72px tall, 5px gaps, 26px between groups. Same textures as screen 1, 1.5px ink outline.
  - "Runs out" marker: 2px ink line with the label "$200 runs out at 7.2 hrs" (13px 700). Blocks after it at 28% opacity.
  - Labels under each group: hours (15px 600), name (12px `--ink-2`), and for the three forgotten groups a "Usually forgotten" tag. Labels never wrap into the next group.
  - Keep the summary sentence and all edge cases from before.
- Then Show the math (collapsed), then Your price and Your reply side by side, then the footer.
- "Copy reply": rectangular, 4px radius, solid ink, white text, with a small lime square icon on the left.
  Reason: lime text isn't allowed on white, and this keeps the button family consistent with "Check the offer."

## The reveal (about 1 second, once)

When "Check the offer" is pressed: screen 1 fades out (150ms), the lime band grows down from the top (250ms), the hero counts up (500ms), the blocks fill in left to right, and the runs-out line drops in last. Under `prefers-reduced-motion`, show the final state right away. Later changes use 180ms transitions only.
Reason: one choreographed moment is memorable. Repeating it would be annoying.

## Details decided while building v4

- **Ticks every $5** while that's 10 steps or fewer; above that, the ruler keeps its own steps ($10, $25, $50).
  Reason: a $200/hr offer would otherwise get 40 tick labels.
- **"this offer" beats tick labels.** A tick label closer than 8px to "this offer $17.39" is hidden.
  Reason: both sit under the line, and the offer matters more than the scale.
- **"after expenses" moves up to a second row** when it would come closer than 8px to another label above the line.
  Reason: the existing collision rule, moved to the new label positions.
- **Above the target:** no gap band; "$9.78/hr over" sits between the target and the offer, and is dropped first if the row is full.
- **Metric variants:** "Less than they offered" or "Same as their offer" when the estimate isn't higher. "Hours the offer pays for" shows "0 of 11.5" below expenses and never more than the total. With no offer: Total hours, Your time at $25/hr, Expenses (no ruler).
  Reason: no plus or minus signs; the label says which way it goes.
- **Empty and error states** sit inside the band, in place of the hero.
  Reason: the band always holds the answer, or what's missing for it.
- **The pay ruler's summary sentence is screen-reader only.** The hero sentence right above it says the same thing visibly.
  Reason: no repeated sentences on screen.
- **No total row in 2 The work.** The tally box shows the total.
  Reason: no repeated numbers; the tally is in view while you edit.
- **Mini blocks** use the same block size as the chart (30 min, or 1 or 2 hrs for big jobs, and the hint says which). A row shows at most 60 and wraps within 180px.
  Reason: very large numbers can't push the input out of its row.

## Don'ts

- No black page backgrounds. No lime text or lines on white.
- No boxes except the tally box. No shadows. No gradients except the textures.
- Pills only for on/off switches. Tabs for picking a job. Rectangles for actions.
- No gray, full-size cents.
- Phone layout: not now. Skip until Kayla says to start it.
