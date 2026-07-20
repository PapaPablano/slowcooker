---
date: 2026-07-19
topic: meal-journey-ux
focus: improving the UX across the four user stages — review meals, select meals, get groceries, prep the bags/meals
---

# Ideation: Meal Journey UX

## Codebase Context

Single-file React 18 app (`index.html`, ~1200 lines, in-browser Babel, no build step) deployed to GitHub Pages at https://papapablano.github.io/slowcooker/. All state lives in `localStorage` on a single device; no accounts, no backend. Print styles exist for the Grocery and Instructions tabs.

Data model (`DATA` constant, 56 freezer-to-slow-cooker meals, sourced and reconciled from 12 monthly meal-plan PDFs — see [slowcook-source-pdfs memory]): each meal has `name`, `serves`, `cook`/`cookHours`, `supplies`, `proteins[]`, `cuisine`, structured `ing[]` (qty/unit/name/store-category/raw text), `steps[]` (cook-day directions), `prep[]` (bag-assembly directions: label the bag, add all ingredients except X, freeze), `reserve[]` (ingredients bought but kept OUT of the freezer bag), `also[]` (cook-day extras not in the main ingredient list), and `serveWith`.

Current tabs are feature-named, not stage-named:
- **Meals** — search, protein/quick/cuisine filters, A-Z sort, 56-card grid. Each card: tags, meta, 3-state rating, an inline "Recipe" expander (shopping list w/ reserve badges, freezer-bag list, reserve-for-cook-day list, cook steps), add-to-week dropdown, hide.
- **My Weeks** — weeks list, rename/delete, per-meal ×1/×2 batch multiplier, remove meal.
- **Grocery List** — multi-week aggregated list grouped by store category, persistent checkboxes, hide-pantry toggle, progress counter, Copy (multiple formats), Print.
- **Instructions** — per-week cook-day step cards only, "make ×N" badge, print.

Notable gap: **Stage 4 (bag prep) has no dedicated UI at all.** The `prep[]` data (bag-assembly directions reconciled from the source PDFs in the prior session) is only reachable inside each meal card's Recipe toggle on the Meals tab — there's no consolidated, ordered, checklist-driven prep experience, and no printable bag labels despite the source PDFs having them.

No relevant `docs/solutions/` learnings existed (fresh repo, no prior ideation docs).

## Ranked Ideas

### 1. Prep Day Mode
**Description:** A dedicated guided mode for bag-assembly day: an aggregated mise-en-place step first ("dice 3 cups onion — goes in Bags A, C, F"), then per-bag checklists built from each meal's `prep[]` directions with batch multipliers applied, a progress bar, and a printable bag-label sheet (name, cook-from-frozen directions, use-by date = today + 3 months — restoring what the source PDFs had).
**Rationale:** The most labor-intensive stage of the stated journey (prep the bags) currently has zero dedicated UI. All the underlying data — `prep[]`, structured `ing[]` quantities, batch multipliers — already exists in `DATA`; this is presentation and aggregation, not new data collection.
**Downsides:** Reliable chop-aggregation across meals needs ingredient-name normalization (e.g. "frozen diced onion" vs "onion, diced") to avoid a noisy or wrong combined list.
**Confidence:** 90%
**Complexity:** Medium-High
**Status:** Explored (brainstorm seeded this session)

### 2. Tonight Mode
**Description:** A full-screen, large-type "cooking today" view for a single meal: cook steps, a "grab these" pull-list built from `reserve[]`/`also[]`, the `serveWith` note, and a start-time calculator ("for 6pm dinner, start by 10am" derived from `cookHours`).
**Rationale:** The existing Instructions tab shows cook steps but hides reserve items — precisely what gets forgotten on cook day — and a kitchen counter mid-cook needs big type and nothing else, not filter chips or a card grid.
**Downsides:** Adds another view to navigate; some overlap with Instructions tab that would need reconciling.
**Confidence:** 85%
**Complexity:** Low-Medium
**Status:** Unexplored

### 3. Smarter Grocery List + Store Mode
**Description:** Three upgrades to the Grocery tab: each line can reveal which meals need it and how the quantity splits; "buy but don't bag" items get a dedicated section (not just a badge) using existing `reserve[]` data; and an optional phone-first store layout with large tap targets and a remembered aisle ordering.
**Rationale:** The grocery-shopping stage is the most hostile physical context (phone, moving through a store) the app serves today, and gets no accommodation — the layout is identical to the couch-browsing layout.
**Downsides:** Aisle-order customization is fiddly UI to get right in a first pass; may be worth deferring to a v2.
**Confidence:** 80%
**Complexity:** Medium
**Status:** Unexplored

### 4. Stage-Named Journey Rail
**Description:** Restructure navigation around the stated stages — Browse → Pick → Shop → Prep → Cook — with a persistent status line ("Week of Jul 20: 4 meals picked, groceries 60% bought"). Make the meal-card expander stage-aware: show decision info (flavor, effort, protein, time) while browsing, and defer execution detail (bag lists, steps) to the Shop/Prep contexts where it's actionable.
**Rationale:** The user explicitly thinks in stages; today's feature-named tabs (Meals/Weeks/Grocery/Instructions) require mental translation every time.
**Downsides:** Touches nearly every view; best sequenced after ideas 1-3 define what content belongs in each stage.
**Confidence:** 75%
**Complexity:** Medium
**Status:** Unexplored

### 5. Freezer Inventory
**Description:** Completing a Prep Day session converts its bags into a "My Freezer" list — bag count derived from batch multipliers, made-on date, auto-computed expiration. Cooking a meal (via Tonight Mode) consumes a bag. The Meals tab shows "2 in freezer" badges.
**Rationale:** The entire workflow's real-world output — a stocked freezer — currently has no representation in the app, so "what can I actually cook tonight?" is unanswerable without opening the physical freezer.
**Downsides:** Only pays off if bag/cook events are reliably recorded; needs Prep Day Mode (idea 1) as its data-entry point, so it's naturally sequenced after it.
**Confidence:** 75%
**Complexity:** Medium
**Status:** Unexplored

### 6. Restore the Month Plans
**Description:** The source PDFs are pre-balanced 12-meal monthly plans with intended recipe doublings, and the reconciliation pipeline's `recipes.json` already records which PDF each recipe came from. Surface them as one-tap starter plans a user adopts into a week (then tweaks à la carte), rather than requiring hand-assembly from 56 cards every time.
**Rationale:** The hardest cognitive work of selection — balancing proteins/cuisines/effort across a batch — was already solved by the source material and is currently discarded in favor of pure browsing.
**Downsides:** Plan groupings need a small re-extraction pass from the PDF menu/table-of-contents pages (not yet captured by `parse_pdfs.cjs`).
**Confidence:** 70%
**Complexity:** Low-Medium
**Status:** Unexplored

### 7. Overlap-Aware Meal Picker
**Description:** While building a week, unpicked meal cards show their ingredient overlap with the current picks ("shares 6 items, adds only 4 new"), with an optional sort-by-overlap.
**Rationale:** Turns meal selection into shopping-cost optimization, using the structured `ing[]` data that was just cleaned up and reconciled against the source PDFs.
**Downsides:** Overlap scoring is only as trustworthy as ingredient-name normalization across meals; risk of noisy or misleading numbers without careful matching.
**Confidence:** 65%
**Complexity:** Medium
**Status:** Unexplored

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | Auto-balanced week generator / "deal me a hand" picker | Duplicates the value of Restore the Month Plans with weaker grounding (no pre-solved source data); better as a v2 once ratings/history accumulate |
| 2 | "What's for dinner tonight" decider | Depends on Freezer Inventory existing first; folds naturally into Tonight Mode + Freezer Inventory later rather than standing alone |
| 3 | Cost estimator per meal/week | No price data exists anywhere in the app or source PDFs; per-store price variance would make estimates untrustworthy and misleading |
| 4 | Pantry memory / shop-your-pantry-first | The existing "hide pantry staples" toggle already captures most of this value; a persistent pantry ledger adds bookkeeping burden disproportionate to the gain |
| 5 | Calendar slotting / ICS export timeline | Full scheduling is overkill for a household app; the useful part (start-time math) is already covered by Tonight Mode's start-time calculator |
| 6 | Share-to-phone URL sync | The app already works on any phone via the same URL; only week/list state needs to travel, and a one-way URL can't round-trip checkbox state, so it doesn't actually solve the multi-device problem |
| 7 | Compare tray (side-by-side meal comparison) | Better absorbed as a variant of the Browse-stage view once Stage-Named Journey Rail (idea 4) redesigns that view, rather than a standalone feature |
| 8 | Ratings-driven default sort ("loved-first") | Real but minor; small enough to fold into idea 4 as a quick win rather than list separately |
| 9 | Cook-history journal ("made 4×, last on June 2") | Feeds the rejected auto-generator idea; existing ratings already capture most of the relevant signal without a new logging system |

## Session Log
- 2026-07-19: Initial ideation — 4 parallel frames (pain/friction, inversion/automation, assumption-breaking, leverage/compounding) generated ~40 raw candidates, merged/deduped to survivors. 7 survived adversarial filtering. User selected idea #1 (Prep Day Mode) to brainstorm next.
