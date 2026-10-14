# Counter design system (v5, "Sunset")

Source of truth for how Counter looks. Replaces every earlier version. CLAUDE.md still owns the flow, math, copy, validation, accessibility, and tests.

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
  - The y labels get exactly the room they need: the widest one plus 8px, so "$1,250" is never cut off.
  - Labels never overlap. Priority: the current-hours label, then "at 7.2h you hit $25", then "your target $25/hr", then the axis labels. A lower one moves to its next spot; with none left, it's hidden from the drawing (the summary still says it). Decided with Kayla, October 13, 2026.
- Below: Show the math (collapsed), then Your price and Your reply side by side, then the footer.
- "Copy reply": fully rounded ink button.

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
- Right: "Projects N" (`--paper` pill) and "Save" (ink pill). "Save as project" is shortened to "Save". After saving, it behaves the same as on desktop.
  Reason: the full label doesn't fit next to Projects.
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
- Hours chart full width, 64px tall. Group names move into a 2-column legend under the bar. The runs-out label sits left of the dashed line, or right of it if there's no room.
  Reason: four labels under thin bars would overlap.
- Rate chart full width, about 170px tall. Same label rules as desktop.
- Then Show the math, Your price, Your reply (stacked), and the footer. "Copy reply" full width.

**Projects page and save field**
- Projects list: one column, each project is a full-width row (name, job, date), at least 56px tall.
- Row actions (desktop and phone): Edit, Rename, Duplicate, Delete, as plain text buttons, Delete last. The name opens the project on screen 2; Edit opens it on screen 1. Each has a full accessible name ("Edit Menu, Oct 11"). Added October 13, 2026.
- Dialogs are bottom sheets here (see "Dialogs" below).

**Motion:** the same reveal. The circle in the bottom bar grows into the hero. Off under reduced motion.

## Share link and Save image (screen 2)

Approved by Kayla, October 12, 2026. References: `docs/design-share-desktop.png`, `docs/design-share-phone.png`, `docs/design-save-image.png`.

**Share button**
- Desktop: a text button with a share icon, between Projects and Save, styled like Projects. After copying, the label reads "✓ Link copied" for 2 seconds, with a fixed width so nothing shifts.
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
- **Preview before saving.** "Save image" opens a native `<dialog>` showing the PNG it made (the same file, not redrawn). Title "Image for your client" (Geist 300). Under it: "This is exactly what they'll see. It uses your price to send, $310." with the real price, then a mono "1080 x 1350 PNG" (desktop only). Buttons: primary "Download image" (desktop) or "Share image" (phone, when the phone can share files), and an outline "Close". Alt text: "Image for your client: 11.5 hours of work, price $310".
  - Desktop: a centered panel on `--bg`, 28px radius, a dim backdrop. The image on the left (4:5, up to 640px tall, 1px `--line` border), the text and buttons on the right, aligned to the bottom.
  - Phone (below 760px): a bottom sheet, full width, 28px top corners. The image on top (up to 54vh), then the text, then the two buttons side by side, clear of the home bar.
  - Escape and Close return focus to "Save image". It only fades in, and not at all under reduced motion.
  Reason: the image goes to a client, so the student should see exactly what will be sent, and the price in it, before it leaves.
- The gradient rule ("only four places") is for the page. The saved image is its own canvas and uses the paid gradient and one sunset panel.

## Dialogs

Decided with Kayla, October 13, 2026. Replaces the panels that opened under the header.

- Save as project, "Start over?", "Open the shared result?", and the link to copy by hand (when copying fails) are native `<dialog>`s opened with `showModal()`, styled like the image preview: `--bg`, 28px radius, the same dim backdrop, a 160ms fade in (none under reduced motion).
  Reason: a panel at the top of the page pushed everything down and scrolled you away from where you were.
- Desktop: centered, 480px wide, 32px padding, the text or field on top and the buttons under it, aligned left.
- Phone (below 760px): a bottom sheet, full width, 28px top corners, clear of the home bar. Buttons share the row and are 44px tall.
- Each keeps its panel's text, field, and buttons. Escape and Cancel (or Close) close it and return focus to the button that opened it; Escape on "Open the shared result?" means "Keep mine". The page never scrolls when a dialog opens or closes.

## Don'ts

- No black page, no lime, no heavy font weights for numbers.
- Gradient only in the four places listed.
- No text lighter than `--ink-2` on the gradient.
