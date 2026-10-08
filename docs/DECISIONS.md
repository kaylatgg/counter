# Counter: design decisions log

Decisions for version 1 (the first testable MVP), October 5, 2026.
The record of every design decision and the reason for it.

## Provisional example data vs real findings

Everything below is **provisional example data**. None of it is validated.

| Item | Example value | Status |
|---|---|---|
| Job | Restaurant menu, 2 pages (default) | Provisional. Check it's familiar to students |
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
| Social media posts | posts | 6 | 2 | 0.5 | 1 | 2 x 1 | 0.5 | 8.5 hrs, $235 |
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

## Known limits of version 1

- Graphic design jobs only, with guessed example hours.
- Default hours are guesses until checked with students.
- The phone layout puts the result below the inputs. Watch whether people find it.
- No saving, accounts, or market rate data, on purpose.
