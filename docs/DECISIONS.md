# Counter: design decisions log

Decisions for version 1 (the first testable MVP), October 5, 2026.
The record of every design decision and the reason for it.

## Provisional example data vs real findings

Everything below is **provisional example data**. None of it is validated.

| Item | Example value | Status |
|---|---|---|
| Job | Menu, 2 pages (default; was "Restaurant menu") | Provisional. Check it's familiar to students |
| Concepts and sketches | 2 hrs | Example, not a benchmark |
| Layout per page | 2 hrs | Example, not a benchmark |
| Emails, calls, meetings | 1.5 hrs | Example, not a benchmark |
| Hours per round of changes | 1.5 hrs | Example, not a benchmark |
| File prep and export | 1 hr | Example, not a benchmark |
| Target rate | $25/hr | Example rate, labeled "adjust for your project" |
| Expenses | $20 | Example |
| Offer | $200 | Example |

### Job options (added October 8, 2026)

Four more graphic design jobs, all **provisional example numbers**, none validated:

| Job | Item | Count | Setup | Per item | Emails/calls | Rounds x hrs | File prep | Total |
|---|---|---|---|---|---|---|---|---|
| Restaurant menu | pages | 2 | 2 | 2 | 1.5 | 2 x 1.5 | 1 | 11.5 hrs, $310 |
| Logo | concepts | 3 | 2 | 1.5 | 1.5 | 2 x 1 | 1.5 | 11.5 hrs, $310 |
| Social posts | posts | 6 | 2 | 0.5 | 1 | 2 x 1 | 0.5 | 8.5 hrs, $235 |
| Poster or flyer | sizes | 2 | 3 | 0.75 | 1 | 2 x 1 | 1 | 8.5 hrs, $235 |
| Custom | pieces | 1 | 0 | 0 | 0 | 0 x 0 | 0 | 0 hrs |

Note: the logo lands on the same 11.5 hrs and $310 as the menu, and the poster on the same 8.5 hrs and $235 as the social posts. Fine for examples, but worth knowing when comparing jobs in testing.

**Findings collected so far:** none yet. Add findings in a separate section only after real sessions.

## Decisions in version 1

1. **One shared flow, offer optional.** Works for "what do you charge?" and "here's my budget." Blank offer ("No offer yet") is different from an explicit $0 offer.
2. **Hours are grouped into four types of work:** production, communication, revisions, delivery. This is the core insight: work outside production is easy to forget.
3. **Rate and hours are editable and labeled as examples.** No experience-level presets until there is a defensible basis.
4. **Removed:** the 20% business-use add-on and the "fair range." Neither had an explainable basis. A footer note says the estimate isn't a market rate.
5. **Exact math.** Full precision in calculations. Hourly results show cents. The estimated price rounds up to the nearest $5, and the receipt shows the exact subtotal and the rounding amount.
6. **Two hourly figures, clearly labeled:** before expenses (offer ÷ hours) and after expenses ((offer - expenses) ÷ hours). Neither is called take-home pay. Taxes are not included.
7. **Estimate and quote are separate.** The user can type a different price to send. Counter shows that quote's hourly effect without changing the estimate or target rate.
8. **Scope controls change the promised work.** Rounds of changes is the main control. Pages stay adjustable, with a note that fewer pages may not save time and an editable hours-per-page value.
9. **Honest scope results.** At 1 page and 1 round, the estimate is $220, shown as "$20 above the offer," not as fitting the budget.
10. **Reply is protected.** Once edited, input changes show "Update draft" instead of overwriting the user's writing. The reply names the price and the scope.
11. **Edge cases:** zero hours, negative or non-numeric input, missing values, rate must be above 0, offer below expenses shows the shortfall, no negative "hours covered."
12. **Data visualization:** a stacked bar for "where the hours come from" with a legend, percentages, and a text summary; three bars on one dollars-per-hour scale for the offer comparison; an itemized receipt for the price.
13. **Accessibility:** real labels, visible focus, errors tied to fields, color is never the only cue (patterns plus labels), screen reader summary announced after a pause or a committed change, reduced motion respected, skip link to the result.
14. **Layout:** desktop puts inputs beside the result, with the main result kept in view while scrolling. Phone is one sequence with the result after the inputs.
15. **Visual direction:** white canvas, dark ink type, thin dividers, one blue accent that always means "your target." Brand and logo are not decided.
16. **Job options, graphic design only.** Five pills: Restaurant menu, Logo, Social media posts, Poster or flyer, Custom. One formula for all of them: production = setup + count x hours per item, so the menu still gives 11.5 hrs and $310. Labels follow the job (item name, setup row, "Design, per [item]"); the "fewer pages" hint is menu only. Switching loads the job's example numbers, and asks first ("Replace your numbers with the [job] example?" / Keep my numbers) if the person changed any. "Keep my numbers" still switches the labels. Rate, expenses, and offer don't belong to a job, so they never change. The "Example job" tag was removed: the pills replace it, and the example lines at the top and in 2 The work still mark the numbers as examples.
17. **Visual direction v4, "Lime reveal" (October 8, 2026).** Replaces decision 15's look (see docs/DESIGN.md v4). Both screens stay light; lime is only a background (the result band and the button's arrow square), never text or lines on white, because lime on white has about 1:1 contrast. The 30-minute time block is the visual language on both screens: live mini blocks in each work row and a tally box on screen 1, the full-width hours chart on screen 2. "Usually forgotten" tags mark communication, revisions, and delivery. Job choice became tabs, the offer a Yes / Not yet switch, and actions rectangles, so choices, switches, and actions each look different. Archivo is used only for the big numbers. The delivery row is named per job (Print setup and export, Formats and color versions, Resizing and export, File prep and export for Custom). "Social media posts" is shortened to "Social posts" on the tab and header; the reply still says "a set of social media posts."
18. **Visual direction v5, "Sunset" (October 11, 2026).** Replaces v4 (see docs/DESIGN.md v5). Calm and light: a warm gray page, big Geist light numbers, Geist Mono for data. One sunset gradient always means "the answer": the screen 1 glow, the button's circle, the hero panel, and paid hours. Stripes always mean unpaid or forgotten hours. New chart "Your rate drops as hours grow" uses the offer after expenses, so it crosses the target at the same 7.2 hrs where the hours chart's money runs out. "6h" is allowed only in small mono chart labels; everything else keeps "hrs".
19. **Projects (October 11, 2026).** Counter opens on a list of saved projects instead of one example job, so students can keep several offers side by side and come back to them. Saved in localStorage only, with a note saying so, because accounts are out of scope. Decided with Kayla: New project is its own screen; Rename and Delete's confirmation happen inline in the row (nothing covers the page); "Edited" dates are relative ("today at 3:42 PM", "yesterday") then plain dates; a blank rename keeps the old name; duplicate names are shortened to fit 60 characters. Broken saved data is skipped project by project, so one bad entry never loses the rest. If saving fails, the page says so and keeps working.
20. **Projects become optional (October 11, 2026).** Replaces the flow in decision 19: Counter opens on the calculator again, because the first thing a student needs is the answer, not a list. "Save as project" in the header names and keeps a calculation (suggested name "[Job type], [Mon D]"); after that it autosaves. The unsaved calculation is kept as a separate draft so a refresh never loses work, and it can never overwrite a saved project. The separate New project form is gone; the Projects page's button is now "New calculation". Decided with Kayla: screen 2's header becomes two sticky rows; "New calculation" starts from the menu example and, if the draft has changes, asks first with Save as project, Start over, and Cancel; Save as project is hidden on the Projects page.
21. **Fields and more jobs (October 11, 2026).** A field choice (Graphic design, Illustration, Photography) sits above the job pills, so illustrators and photographers can use Counter too. Nine jobs plus Custom in every field. **Every example number is provisional, not validated**; check them with students in each field before testing. The examples were chosen so no two jobs share a total, so switching jobs always visibly changes the result (earlier, Logo matched Menu and Poster matched Social posts). "Restaurant menu" became "Menu". The reply's opener is now "Hi! Thanks for reaching out." with no job word, decided with Kayla, so it reads well for every job. The expenses hint changes by field. Projects store the field; older ones load as Graphic design.

## Known limits of version 1

- Three fields and nine jobs, all with guessed example hours.
- Default hours are guesses until checked with students.
- The phone layout puts the result below the inputs. Watch whether people find it.
- Projects save only in this browser on this device. No accounts, sync, or market rate data, on purpose.
