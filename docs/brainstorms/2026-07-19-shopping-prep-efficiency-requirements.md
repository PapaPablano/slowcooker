---
date: 2026-07-19
topic: shopping-prep-efficiency
---

# Shopping & Prep Efficiency: Ingredient Grouping + Prep Day Mode

## Problem Frame

The user plans meals, buys groceries, then assembles freezer bags for a week of slow-cooker meals. Two connected pain points came up when asked what's actually frustrating about this today:

1. **Shopping list clarity** — the same ingredient shows up in different physical forms across meals (e.g. "frozen diced onion" in one meal, "yellow onion, diced" in another — the same vegetable, prepped differently), listed as unrelated line items. The user has to mentally reconcile these to decide what to actually buy (e.g. buying fresh onion and dicing it covers both lines). This only applies to true form-variants of one ingredient — not different ingredients that happen to share a name root (a green onion/scallion is a different vegetable from a yellow onion, used differently, and should never be clustered with it).
2. **Prep-day efficiency** — once ingredients are bought, there's no guided way to know exactly what goes in each bag. Bag-assembly directions currently only exist inside each meal card's "Recipe" expander on the Meals tab, one meal at a time, with no checklist, no labeling support, and no way to track progress across a multi-bag session.

Both stem from the same underlying data (the `ing[]` and `prep[]` fields reconciled from the source meal-plan PDFs in a prior session) and were surfaced by the same user complaint, so they're scoped together here.

This document covers requirements for both. `ce:plan` will define the technical approach for each.

## Requirements

**Grocery List — Ingredient Grouping**
- R1. On the Grocery List tab, ingredient line items that represent true physical-form variants of the same ingredient (e.g. "frozen diced onion" vs. "yellow onion, diced" — not different ingredients that merely share a name root, like green onion vs. yellow onion) are visually clustered together under a shared heading, rather than appearing as unrelated separate lines.
- R2. Each cluster shows which meals need it and in what form/quantity, so the user can see the full picture before deciding what to buy.
- R3. When a cluster has an obvious simplification (e.g. frozen-diced and fresh-whole forms of the same onion could both be covered by buying fresh and chopping), the app shows an informational tip suggesting it. This tip is scoped narrowly to same-ingredient form differences only — the app never suggests substituting between different named ingredients. The tip is advisory only — the user decides what to actually buy; the app never removes, merges, or auto-substitutes items on the list itself.

**Prep Day Mode — Entry and Structure**
- R4. A "Start Prep Day" action is available on a week in the My Weeks tab. It opens a guided, full-screen mode scoped to that week's meals. Because this mode is used hands-on at the kitchen counter (not seated browsing), checklist rows and navigation controls use larger tap targets than the rest of the app.
- R4a. If a week has in-progress or completed bag checkmarks from an earlier Prep Day session, the action relabels to "Resume Prep Day" and reopens on the first unfinished bag with prior checkmarks intact, rather than restarting from Bag 1. This mirrors how Grocery List checkboxes already persist.
- R5. Prep Day Mode presents one **bag** at a time, in sequence, with next/previous navigation, an explicit close/exit action back to My Weeks, and a "Bag N of M" progress indicator. A bag corresponds to one physical freezer bag — a meal set to make ×2 batches produces two separate, sequential bag screens (e.g. "Bag 3 of 7 — Chicken Gnocchi Soup (1 of 2)" then "Bag 4 of 7 ... (2 of 2)"), not one screen with doubled quantities.
- R6. Each bag screen shows a checklist of only the ingredients that go into that bag (i.e. excludes items in that meal's `reserve[]`), each item individually checkable.
- R7. Each bag screen also lists that meal's reserved ingredients (`reserve[]`) as a visually distinct "do NOT bag — set aside for cook day" reminder, so nothing gets bagged by mistake and nothing gets forgotten for cook day.
- R8. Each bag screen includes the bag-sealing/labeling steps from that meal's `prep[]` directions as checklist items (e.g. label the bag, seal, freeze flat).

**Prep Day Mode — Labels and Completion**
- R9. Each bag screen has a "Print label" action producing a small printable label with the meal name and a use-by date computed as the current date + 3 months. (Verified: this 3-month figure is not an app-invented default — it's stated verbatim in the source PDF prep directions for all 56 meals, e.g. "expiration date (today's date plus three months)".) If no printer is available, R8's "label the bag" checklist item already covers writing this information on the bag by hand, so R9 is additive rather than blocking.
- R10. A bag screen's checklist is "fully checked off" when every item is checked — both the ingredient items (R6) and the sealing/labeling steps (R8). When every bag in the week reaches that state, the week is stamped as "Prepped" with the completion date, and that status is visible on the week in My Weeks (e.g. "✓ Prepped Jul 19").

## Success Criteria
- A user can go from "groceries are bought" to "every bag is assembled, labeled, and in the freezer" using only Prep Day Mode, without needing to reopen individual meal cards on the Meals tab.
- The grocery list makes true same-ingredient form overlaps visible at a glance, so the user doesn't have to separately notice and cross-reference matching line items themselves. (This surfaces the overlap; it does not compute a suggested total quantity for the user.)
- Reserve-for-cook-day ingredients are never ambiguous on a bag's checklist — the user always knows what to leave out.

## Scope Boundaries
- No cross-meal chop aggregation or shared prep "stations" (e.g. "dice all onions for all bags first") in this version. Explicitly deferred — see Key Decisions.
- No freezer inventory or consumption tracking (a separate, larger idea from the same ideation session — see `docs/ideation/2026-07-19-meal-journey-ux-ideation.md`, idea #5). The "Prepped" stamp (R10) is the only persistent trace this feature adds.
- The app never auto-substitutes or edits what's on the grocery list on the user's behalf (R3) — grouping and tips are informational only.
- Ingredient grouping (R1-R3) is a display-layer change; it does not restructure the underlying `ing[]` data model or store-category grouping used elsewhere in the app.
- No multi-device sync. Prep Day Mode progress lives in the same single-device `localStorage` model the rest of the app already uses.
- Prep Day Mode does not lock or restrict editing a week after it's marked "Prepped" — the stamp is informational, not a state machine gate.

## Key Decisions
- **Per-bag sequential checklists, not cross-meal chop aggregation**: verified the current ingredient-name data is inconsistent enough (198 unique ingredient names across 56 meals, including near-duplicates like "frozen diced onion" / "yellow onion" / "onion frozen," and at least one data-quality bug where raw recipe text leaked into a name field: "onion cut into 1-inch slices") that reliable cross-meal aggregation isn't safe to build on yet. Per-bag checklists sidestep this entirely — each bag only needs its own meal's already-correct ingredient list.
- **Grouping is advisory, not prescriptive**: the app shows the user the full picture and a tip, but never decides what they buy. This avoids the app being wrong about store availability, brand preference, or bulk-buying habits.
- **×2 batches render as two separate bag screens**: matches the physical reality of filling two distinct freezer bags, rather than asking the user to do their own doubling/splitting math from a single combined screen.
- **Completion is stamped, not just walked through**: marking the week "Prepped" with a date is a low-cost addition (a single field on the week object) that makes the state of a week's prep work visible on My Weeks at a glance, rather than requiring the user to remember or reopen Prep Day Mode to check.
- **R9's use-by date is sourced, not invented**: verified that all 56 meals' `prep[]` data explicitly states "today's date plus three months" as the freezer duration, taken directly from the source meal-plan PDFs. The +3-month computation is not an app-chosen default; it reproduces what the recipe author already specified for every meal.
- **R9's label omits cook directions**: the label shows meal name and use-by date only. Cook-from-frozen directions can't be reliably derived from `steps[]` as originally envisioned — verified 53 of 56 meals' cook steps open with "thaw overnight in fridge," not a frozen-start procedure — so a false or misleading instruction on a physical, hard-to-correct freezer label was judged worse than omitting it. Full, correct cook directions remain available in the app's Instructions tab.
- **Ingredient-name cleanup is a prerequisite for R1-R3, not a parallel/deferred concern**: the same messy `ing[]` data (198 unique names across 56 meals, including near-duplicates and at least one raw-text-leak bug) that ruled out cross-meal chop aggregation for Prep Day Mode also undermines reliable grouping. Rather than applying a looser bar to the grocery-list feature, `scripts/reconcile.cjs` should be extended to canonicalize ingredient names (the same approach already used to clean this data in a prior session) before the grouping UI is built.

## Dependencies / Assumptions
- **Correction from the original brainstorm draft**: `prep[]` is not clean data as previously assumed. Verified: 33 of 56 meals have corrupted trailing text in their final `prep[]` entry (raw recipe-card text leaked in, e.g. ending in "MEAL PLAN #7 *This recipe card contains ingredients to make one dinner"), and 19 of 56 meals have additional substantive prep-action lines beyond label/add-ingredients/store (e.g. "BLEND TOGETHER SAUCE INGREDIENTS") that R8 as scoped to "sealing/labeling steps" would not surface. This affects R8 directly — see Outstanding Questions.
- Assumes `reserve[]` and `ing[]` (aside from the grouping-normalization question below) are accurate enough to drive per-bag checklists directly.
- Assumes per-bag checklist progress persists across a page reload the same way Grocery List checkboxes already do today (existing `localStorage` pattern), so a user can leave and resume a Prep Day session.
- Assumes bag order within a week defaults to the week's existing meal order, expanded in place for any ×2 batches.
- Assumes `mult` is always a positive integer (the existing My Weeks UI only offers ×1/×2 today). Other batch counts (×3+, fractional) are out of scope for this feature.

## Outstanding Questions

### Deferred to Planning
- [Affects R1-R3][Technical] The normalization approach itself (extending `scripts/reconcile.cjs` to canonicalize ingredient names, per the Key Decision above) still needs a concrete design: what counts as "the same ingredient in a different form" vs. a different ingredient, and how manual review/aliasing is handled for edge cases the script can't infer automatically.
- [Affects R1][Technical] The app's existing store-category grouping (used elsewhere in the Grocery List tab) has its own data-quality bugs — e.g. some green-onion entries are miscategorized outside Produce. Planning should confirm whether ingredient-form clusters (R1) are scoped within a single store category or can span categories, since a same-ingredient cluster could otherwise be split by a miscategorized entry. This may be worth fixing in the same `reconcile.cjs` pass as ingredient-name normalization.
- [Affects R9][Technical] Print label physical layout/sizing, and whether printing happens one bag at a time or as a full label sheet for the whole week. Note: the app's existing print CSS (used for Grocery List and Instructions) hides chrome and prints an entire tab's content — there is no existing pattern for printing an isolated small element. A label print will need a dedicated print-only subtree, not reuse of the existing whole-tab pattern as-is.
- [Affects R5-R10][Technical] Per-bag checklist state cannot be keyed on `(weekId, rid)` alone — a ×2-batch meal is a single `{rid, mult}` entry in `items[]`, so bag 1 and bag 2 of the same meal would collide under that key. Planning should key state as `(weekId, rid, bagInstanceIndex)`, and R10's completion check must count expanded bag instances, not `items.length`. Planning should also decide what happens to in-progress or completed bag state if the user edits the week's meal list between Prep Day sessions (e.g. removes a meal, changes a mult) — the current bag numbering isn't stable across such an edit.
- [Affects R8][Technical] Given the confirmed `prep[]` data-quality issues (see Dependencies), planning should decide: extend `scripts/reconcile.cjs` to clean `prep[]` the same way it was extended for `ing[]` in the prior session, or have R8 apply a display-time rule (e.g. drop/truncate the trailing store-duration line, since its content — "store up to 3 months" — is already captured by R9's use-by date) rather than showing the raw field verbatim.

## Next Steps
-> `/ce:plan` for structured implementation planning. Planning should sequence the `scripts/reconcile.cjs` ingredient-name (and `prep[]`) cleanup pass as a prerequisite phase before the grouping UI and Prep Day Mode's R8 checklist rendering are built, since both depend on that data being reliable.
