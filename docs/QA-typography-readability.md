# Counter: typography and readability QA

Desktop only, both screens, checked at 1280, 1440, and 1920 px wide. October 7, 2026.
Checked against `docs/DESIGN.md` (v3, "Two screens") and CLAUDE.md.

Part 1 lists what was fixed directly. Part 2 lists what needs a decision. Part 3 is the readability report. No wording has been changed yet.

---

## Part 1. Typography and alignment: fixed

| Check | Before | Fix |
|---|---|---|
| Shared left edges | At 1920, the screen 1 wordmark sat at 64px while the headline and columns were centered at 304px. | The header content now uses the same 1312px centered width as screen 1. Screen 2 stays full width, as DESIGN.md says. |
| Labels and values share a baseline | Work rows aligned to the bottom of the input, so labels sat about 4px off the values' baseline. The control bar centered 12px labels against 18px values. | Work rows and control bar fields now align on the text baseline. |
| Lines under about 75 characters | The footer disclaimer ran 91 characters on one line. Hints in the wide left column ran about 100 characters. The reply box ran about 95. | Body text, hints, chart summaries, the quote line, the notice, the taxes note, the footer, and the reply box are capped at 62ch (about 75 characters). |
| No lone words, no awkward wraps | Nothing stopped a single word from landing alone on the last line. | Paragraphs, labels, and legends use `text-wrap: pretty`, and headings use `text-wrap: balance`. The audit found no lone last words at any of the three widths. |

**Left edge measurements after the fix**

| Width | Screen 1: wordmark, headline, 1 The job, work rows, footer | Screen 1: right column (3, 4, button) | Screen 2: wordmark, Edit all details, hero label, hero number, chart title, blocks, Show the math, Your quote, footer |
|---|---|---|---|
| 1280 | 64 | 688 | 64 |
| 1440 | 64 | 768 | 64 |
| 1920 | 304 | 1008 | 64 |

Every element in each group starts on the same line.

**Numbers:** the whole page uses tabular figures. In columns, numbers are right-aligned: hours inputs, group totals, the Total row, and receipt amounts. The metrics are a stacked list, not a column, so they stay left-aligned.

---

## Part 2. Typography: needs a decision

### 2.1 Sizes and weights not in the DESIGN.md type table

These are used but not in the type table. Some are named elsewhere in DESIGN.md's text, noted below.

| Element | Size / weight now | Covered by DESIGN.md? | Suggestion |
|---|---|---|---|
| Offer pills ("They offered an amount", "No offer yet") | 14px / 600 | No | Use Body 15px, or Small label 13px |
| Error message (both screens) | 13px / 600 | Size yes ("13px"), weight no | Use 500 to match Small label, or add 600 to the table |
| "Restaurant menu" job line (screen 1) | 15px / 600 | No (it was in v2) | Add to the table, or use Body 15px / 400 |
| "Add some hours…" / "Fix the fields…" (screen 2) | 16px / 400 | No | Match the hero sentence (16px), and add it to the table |
| Below-expenses warning | 16px / 400 | No size given | Same as the hero sentence it replaces |
| "Use estimate" link | 14px / 600 | No | Add to the table |
| Quote line ("At $310, you'd earn…") | 14px / 400 | No | Same as chart summaries (14px) |
| Reply notice ("Your numbers or scope changed…") | 14px / 400 | No | Same as chart summaries (14px) |
| "Copy reply" and "Update draft" buttons | 15px / 600 | Weight yes, size no | Add 15px to the table |
| "Copied to clipboard." status (Step 6) | 13px / 400 | No | Small label, 13px / 500 |
| Skip link | 15px / 600 | No | Fine as is |
| Stepper icons (−, +) | 18px and 15px / 600 | These are icons, not text | Fine as is |
| Hours input values | 17px / 600 | In the text ("value 17px 600"), not the table | Add to the table |
| Total row | 15px / 700 and 22px / 700 | In the text, not the table | Add to the table |

### 2.2 Spacing scale

DESIGN.md v3 has no spacing scale. The old scale in CLAUDE.md section 6 (4, 8, 12, 16, 20, 24, 32, 40, 56) was replaced along with the rest of section 6. DESIGN.md itself names these values: 18, 22, 28, 30, 34, 36, 40, 44, 56, 64, 96.

Values used in `styles.css`, with how often they appear:
1 (5), 2 (8), 3 (3), 4 (9), 6 (12), 7.5 (1), 8 (10), 9 (2), 10 (5), 12 (4), 14 (7), 16 (12), 18 (4), 20 (6), 22 (6), 24 (4), 28 (7), 30 (2), 32 (2), 34 (3), 36 (3), 40 (7), 44 (1), 48 (1), 56 (2), 64 (8), 80 (1), 96 (1), 120 (1).

- 1 to 3 are borders, offsets, and icon nudges.
- 7.5 and 9 center the dots and the gap band on the ruler line.
- 80 and 120 are the blocks' row gap and the scroll padding under the sticky bars.

**Rhythm between sections:**
- **Screen 1:** even, at 40 / 28 / 28 / 40.
- **Screen 2:** varies (hero 36 above and 28 below, charts 30 above, lower rows 34). That's exactly what DESIGN.md asks for, so I left it.

**Decision needed:** should I add a spacing scale to DESIGN.md, for example 4, 8, 12, 16, 20, 24, 28, 32, 40, 56, 64, 96, and round the in-between values (6, 10, 14, 18, 22, 30, 34, 36) to it? This would slightly change spacing that DESIGN.md currently specifies.

### 2.3 Wide screens (1920)

Screen 2 is full width with 64px sides, as DESIGN.md says. At 1920:
- The hero number and its sentence use about a third of the row.
- The hours chart's blocks stop at their 22px maximum, about 660px in, while "1 block = 30 min" sits at the far right of a 1300px column.

Nothing breaks, but it feels sparse. One option is a max width for screen 2's content (for example 1440px, centered, like screen 1).

---

## Part 3. Readability report (report only, nothing changed)

**Reading level:** scored with Flesch-Kincaid, after replacing numbers with words so "$7.61" doesn't count as a sentence end. Every sentence scores between about grade 1 and grade 5, at or below the grade 6 to 8 target. So the issues aren't sentence length. They're word choice (jargon like "scope", "production", "direct costs") and the same idea going by different names.

Grades are shown for full sentences. Short labels are marked "label".

### 3.1 Every piece of text

#### Header and skip link

| Where | Current text | Reading level | Suggested rewrite |
|---|---|---|---|
| Header, left (both screens) | counter | label | Keep |
| Header, right (screen 2) | Restaurant menu | label | Keep |
| Skip link (keyboard only) | Skip to your result | label | Keep |

#### Screen 1: top

| Where | Current text | Reading level | Suggested rewrite |
|---|---|---|---|
| Headline | What does this job really pay? | label | Keep |
| Intro | Count all the work, see what an offer pays per hour, then choose your price or scope. | 3.5. "Scope" is jargon. | Count all the work, see what an offer really pays per hour, then set your price or change the work. |
| Under the intro | Example numbers. Change them to match your project. | 3.7, clear | Keep |

#### Screen 1: 1 The job

| Where | Current text | Reading level | Suggested rewrite |
|---|---|---|---|
| Section title | 1 The job | label | Keep |
| Job line | Restaurant menu · Example job | label | Keep |
| Stepper labels | Pages · Rounds of changes | label | Keep |
| Stepper buttons (screen reader only) | One less page · One more page · One less round of changes · One more round of changes | label | Keep |
| Hint under steppers | Changing pages or rounds changes the work you promise the client, so it changes the hours below. | 4.9. "Changes" three times. | Pages and rounds are the work you promise. Change them and the hours below change too. |

#### Screen 1: 2 The work

| Where | Current text | Reading level | Suggested rewrite |
|---|---|---|---|
| Section title | 2 The work | label | Keep |
| Under the title | Example hours. Change any to match how you work. | clear | Keep |
| Group name | Production | label. Means "design work". Screen 2 calls it "the design itself". | Design work (see terms, 3.3) |
| Group names | Communication · Revisions · Delivery | label | Keep |
| Group totals | 6 hrs · 1.5 hrs · 3 hrs · 1 hr | label | Keep |
| Row labels | Concepts and sketches · Layout per page · Emails, calls, and meetings · Hours per round of changes · File prep and export | label | Keep |
| Unit after inputs | hrs | label | Keep |
| Hint under Layout per page | If fewer pages means fitting the same content into less space, it may not save much time. Adjust this if so. | 3.1. Long condition up front. | Fewer pages may not save time if the same content still has to fit. If so, raise this number. |
| Total row | Total · 11.5 hrs | label | Total hours · 11.5 hrs |

#### Screen 1: 3 Your numbers

| Where | Current text | Reading level | Suggested rewrite |
|---|---|---|---|
| Section title | 3 Your numbers | label | Keep |
| Field | Target hourly rate · $25/hr | label | Keep |
| Hint | Example rate. Adjust for your project. | clear | Example rate. Change it to yours. (matches "Change them" above) |
| Field | Project expenses · $20 | label | Keep |
| Hint | Direct costs for this job, like fonts, stock images, or printed proofs. | 2.9. "Direct costs" is accounting language. | Money you spend on this job, like fonts, stock photos, or printed proofs. |

#### Screen 1: 4 Their offer

| Where | Current text | Reading level | Suggested rewrite |
|---|---|---|---|
| Section title | 4 Their offer | label | Keep |
| Pills | They offered an amount · No offer yet | label | Keep |
| Field | Amount they offered · $200 | label | Keep |

#### Screen 1: button

| Where | Current text | Reading level | Suggested rewrite |
|---|---|---|---|
| With an offer | Check the offer / 11.5 hrs of work against $200 | label | Check the offer / 11.5 hrs of work for $200 ("against" is a little formal) |
| No offer | Get my estimate / 11.5 hrs of work at $25/hr | label | Keep |

#### Error messages (screen 1 and the control bar)

| Where | Current text | Reading level | Suggested rewrite |
|---|---|---|---|
| Blank field | Enter [field]. Use 0 if there is none. (e.g. "Enter emails, calls, and meetings.") | 1.7. Reads like "type your emails". | For hour fields: Enter the hours for emails, calls, and meetings. Use 0 if there are none. |
| Not a number | [Field] needs to be a number. (e.g. "Project expenses needs to be a number.") | 4.0. Grammar breaks on plural names ("expenses needs", "Pages needs"). | Use a number for project expenses. |
| Negative | [Field] can't be negative. | label | [Field] can't be less than 0. ("negative" is fine for most, but less plain) |
| Not whole | [Field] needs to be a whole number. ("Pages needs…") | label. Same plural issue. | Use a whole number for pages. |
| Rate | Your target hourly rate needs to be more than 0. | 2.3, clear | Keep |
| Offer blank | Enter the amount they offered. Use 0 if they offered nothing. | 3.7, clear | Keep |

#### Footer (both screens)

| Where | Current text | Reading level | Suggested rewrite |
|---|---|---|---|
| Footer | Counter gives an estimate from your own inputs. It isn't a market rate or financial advice. | 5.2. "Inputs" and "market rate" are a little technical. | Counter estimates from the numbers you enter. It isn't a market rate or financial advice. |

#### Screen 2: control bar

| Where | Current text | Reading level | Suggested rewrite |
|---|---|---|---|
| Back link | Edit all details | label | Keep |
| Labels | Pages · Rounds · Offer · Rate | label. "Rate" here is the target rate. | Pages · Rounds · Offer · Target |
| Note, right | Change these to see it update | label. "It" is vague. | Change these to update the result |

#### Screen 2: hero

| Where | Current text | Reading level | Suggested rewrite |
|---|---|---|---|
| Label (offer) | This offer pays | label | Keep |
| Label (no offer) | Estimated project price | label | Your estimate (see terms, 3.3) |
| Number | $17.39/hr or $310 | label | Keep |
| Sentence (under target) | for 11.5 hours of real work. That's $7.61 an hour under your $25 target. | under 1, clear | Keep |
| Sentence (meets target) | for 11.5 hours of real work. That meets your $25 target. | clear | Keep |
| Sentence (no offer) | 11.5 hrs at your $25.00/hr target, plus $20.00 in expenses. Rounded up from $307.50. | under 1, clear | Keep. Possibly "$25/hr" to match the other sentence's "$25". |
| Warning (offer below expenses) | This offer is $5.00 less than your expenses alone. | 3.7, clear | Keep |
| Metric | After expenses · $15.65/hr | label | Keep |
| Metric | Your estimate · $310 | label | Keep |
| Metric | Above the offer · +$110 (or Below the offer · -$20, or Matches the offer · $0) | label. Unclear what is "above". | Over their offer · +$110 / Under their offer · -$20 / Same as their offer |
| Metric (no offer) | Total hours · 11.5 | label. Missing unit. | Total hours · 11.5 hrs |
| Metric (no offer) | Your time · $287.50 | label. Unclear what "time" costs. | Your time at $25/hr · $287.50 |
| Metric (no offer) | Expenses · $20.00 | label | Keep |
| Empty state | Add some hours to see your estimate. | 2.3, clear | Keep |
| Error state | Fix the fields with errors to see your result. | 2.3, clear | Keep |

#### Screen 2: hours chart

| Where | Current text | Reading level | Suggested rewrite |
|---|---|---|---|
| Title | Your 11.5 hours, and where the money runs out | label | Keep |
| Title (no offer) | Your 11.5 hours | label | Keep |
| Scale note | 1 block = 30 min | label | Keep |
| Line label | $200 runs out at 7.2 hrs | label | Keep |
| Flag (covers all) | $200 covers all 11.5 hrs | label | Keep |
| Flag (below expenses) | $15 doesn't cover your expenses | label | Keep |
| Group labels | 6h Production · 1.5h Communication · 3h Revisions · 1h Delivery | label. "h" is a third way to write hours. | 6 hrs · Production (or keep "6h" for space; see units, 3.2) |
| Summary | 4.3 hours go unpaid, and 5.5 hours are work outside the design itself. | 4.9. "The design itself" = Production. | 4.3 hours go unpaid, and 5.5 hours are work outside the design. (or "…outside production", see 3.3) |
| Summary (no outside work) | All 11.5 hours are production. | clear | Match whatever the group is called |
| Hidden list (screen readers) | Production: 6 hrs, … | label | Keep |

#### Screen 2: pay chart

| Where | Current text | Reading level | Suggested rewrite |
|---|---|---|---|
| Title | Pay per hour | label | Keep |
| Ruler labels | offer $17.39 · after expenses $15.65 · target $25 | label. Missing "/hr". | offer $17.39/hr · after expenses $15.65/hr · target $25/hr |
| Gap label | -$7.61/hr | label | Keep |
| Over label | +$61.96/hr | label | Keep |
| Tick labels | $0 · $10 · $20 · $30 | label. Missing "/hr". | Add "/hr" to the last tick only: $30/hr |
| Summary (short) | Before expenses, the offer pays $7.61 an hour less than your target. | 4.8, clear | Keep |
| Summary (meets) | Before expenses, the offer meets your target rate. | clear | Before expenses, the offer meets your target. (one term, see 3.3) |
| Summary add-on | After expenses, it pays less than $0 an hour, so you would lose money on this job. | 4.9 | After expenses, you would lose money on this job. |
| Hidden list | Offer, before expenses: $17.39/hr · Offer, after $20.00 expenses: $15.65/hr · Your target rate: $25.00/hr | label | Keep |

#### Screen 2: Show the math

| Where | Current text | Reading level | Suggested rewrite |
|---|---|---|---|
| Toggle | Show the math · $310 / Hide the math | label | Keep |
| Row | Production · 2 + 2 pages x 2 · 6 hrs | label. The math has no units. | Production · 2 hrs + 2 pages x 2 hrs · 6 hrs |
| Rows | Communication · 1.5 hrs; Delivery · 1 hr; Total hours · 11.5 hrs | label | Keep |
| Row | Revisions · 2 rounds x 1.5 · 3 hrs | label. No unit. | Revisions · 2 rounds x 1.5 hrs · 3 hrs |
| Row | Your time · 11.5 x $25.00 · $287.50 | label. No units. | Your time · 11.5 hrs x $25/hr · $287.50 |
| Rows | Expenses · $20.00; Subtotal · $307.50 | label | Keep |
| Row | Rounded up to nearest $5 · +$2.50 | label. Missing "the". | Rounded up to the nearest $5 · +$2.50 |
| Final row | Estimated project price · $310 | label | Your estimate · $310 (see 3.3) |
| Note | Taxes are not included. None of these numbers are take-home pay. | 2.6, clear | Keep (CLAUDE.md requires this idea) |

#### Screen 2: quote

| Where | Current text | Reading level | Suggested rewrite |
|---|---|---|---|
| Section title | 6 Your quote | label | 6 Your price (see 3.3) |
| Field | Price you'll send · placeholder $310 | label | Keep |
| Link | Use estimate | label | Use my estimate |
| Hint | Leave blank to use your estimate. Changing this doesn't change your estimate or target rate. | 3.9. "Change" twice. | Leave blank to use your estimate. This won't change your estimate or your target. |
| Line | At $310, you'd earn $26.96/hr before expenses and $25.22/hr after. | 3.9, clear | Keep |
| Line add-on | That's $30 below your estimate. / above | clear | Keep |

#### Screen 2: reply

| Where | Current text | Reading level | Suggested rewrite |
|---|---|---|---|
| Section title | 7 Your reply | label | Keep |
| Field | Your reply to the client | label | Keep |
| Draft | Hi! Thanks for reaching out about the menu. For a 2-page menu with 2 rounds of changes and print-ready files, my price is $310. I know that's more than the $200 you mentioned, so I'm happy to talk about what would fit your budget. Let me know if you have any questions! | 3.2, friendly | Keep |
| Notice | Your numbers or scope changed since you edited this reply. | 3.7. "Scope" again. | Your numbers changed after you edited this reply. |
| Buttons | Update draft · Copy reply | label | Keep |
| Status (Step 6) | Copied to clipboard. / Couldn't copy. Select the text and copy it yourself. | clear | Keep |

#### Screen readers only

| Where | Current text | Reading level | Suggested rewrite |
|---|---|---|---|
| Headings | 5 The result · How we calculated this | label | "How we calculated this" could match the toggle: "The math" |
| Hero value | $17.39 per hour | label | Keep |

### 3.2 Units check

Every number should carry a unit ($, hrs, /hr). These don't:

| Where | Now | Missing |
|---|---|---|
| No-offer metric "Total hours" | 11.5 | hrs |
| Pay chart labels | offer $17.39, after expenses $15.65, target $25 | /hr |
| Pay chart tick labels | $0, $10, $20, $30 | /hr (at least on the last tick) |
| Receipt math | 2 + 2 pages x 2; 2 rounds x 1.5; 11.5 x $25.00 | hrs and /hr |
| Hours chart group labels | 6h, 1.5h | Has a unit, but "h" instead of "hrs" |

Counts (pages, rounds) and everything else carry their units.

### 3.3 Term consistency

| Idea | Names used now | Where | Suggested single term |
|---|---|---|---|
| The rounded price from your hours, rate, and expenses | "Your estimate", "Estimated project price", "estimate", "Get my estimate", "Use estimate" | Metrics, hero label (no offer), receipt final row, button, quote | **Your estimate** everywhere |
| The price you actually send | "Your quote" (section), "Price you'll send" (field), "my price" (reply draft), "quote" (CLAUDE.md) | Quote section, reply | **Your price** for the section, keeping "Price you'll send". Or keep "quote" and rename the field "Your quote". Pick one. |
| Your target hourly rate | "Target hourly rate", "target rate", "target", "Rate" (bar), "your $25 target" | Screen 1, pay chart, bar, hero | **Target rate** in full, **target** for short. Rename the bar's "Rate" to "Target". |
| Hours of design work | "Production" (group, receipt, chart), "the design itself" (chart summary) | Screen 1, chart, receipt | One name: **Production** (and "outside production"), or **Design work** everywhere |
| Rounds of changes | "Rounds of changes", "Rounds" (bar), "Revisions" (group), "Hours per round of changes" | Screen 1, bar, chart | Fine. Revisions is the work, rounds are the count. Worth a test question. |
| Hours | "hours" (sentences), "hrs" (values), "h" (chart labels) | Everywhere | "hours" in sentences, "hrs" next to numbers, drop "h" |
| What changed (notice) | "numbers or scope" | Reply notice, intro ("price or scope") | Drop "scope". Say "the work" or "your numbers". |

### 3.4 Decisions for Kayla

1. Approve, change, or reject each suggested rewrite in 3.1.
2. Pick the single terms in 3.3, especially the estimate and the quote or price.
3. Units: add "/hr" to the pay chart labels and "hrs" to the receipt math?
4. Spacing scale (2.2) and a max width for screen 2 on wide screens (2.3)?
5. Type table additions (2.1)?
