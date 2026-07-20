---
title: Replace Instructions Tab with a Prep Tab
type: feat
status: completed
date: 2026-07-20
origin: docs/plans/2026-07-20-001-feat-shopping-prep-efficiency-plan.md
---

# Replace Instructions Tab with a Prep Tab

## Overview

Prep Day Mode currently only opens via a "Start/Resume Prep Day" button inside a specific week in My Weeks. This plan promotes it to its own top-level nav tab — replacing the "Instructions" tab (cook-day steps), which becomes redundant with the Meals tab's existing per-meal Recipe expander. Nothing about Prep Day Mode's internal behavior (the full-screen bag-by-bag flow shipped in `docs/plans/2026-07-20-001-feat-shopping-prep-efficiency-plan.md`) changes — this plan only changes how you *get there*.

## Problem Frame

Two product decisions were confirmed directly with the user before this plan:
1. The Instructions tab is removed entirely, not kept alongside a new Prep tab.
2. Cook-day steps remain reachable via the Meals tab's Recipe expander (which already shows them per-meal) — no replacement UI is being built for the per-week grouped/printable Instructions view. That capability is intentionally going away, not migrated.

With the "Instructions" tab removed, its nav slot is free — this plan uses it for Prep rather than leaving a three-tab nav. To be direct about the actual reasoning: this is an opportunistic use of a freed slot, not a response to a documented complaint about the existing My Weeks button being hard to find. The concrete value it adds is letting a user check or resume prep for a week without first navigating to My Weeks and locating the right week card — useful, but a convenience, not a fix for an evidenced pain point. The My Weeks button remains as the one-click path for someone who's already looking at the week they want to prep (see Key Technical Decisions).

## Requirements Trace

- R1. The main nav no longer shows an "Instructions" tab; cook-day step viewing is not replaced elsewhere in the nav (per the confirmed decision — Recipe expander already covers it).
- R2. The main nav shows a "Prep" tab. Clicking it shows a week picker (when more than one week exists) and an entry point into the existing Prep Day Mode full-screen flow for the selected week.
- R3. The existing "Start/Resume Prep Day" button inside My Weeks (`docs/plans/2026-07-20-001-...` Unit 3) is unchanged — both entry points coexist, mirroring how "Grocery list →" already exists both as a My Weeks shortcut and its own tab.
- R4. No changes to `PrepDayMode`'s internal bag-by-bag flow, checklist persistence, Prepped stamp, or print label (Units 4-6 of the prior plan) — this plan only changes the entry point.

## Scope Boundaries

- No new "which week" picker logic is invented — reuse the exact single-select `activeWeek`/`setActiveWeek` pattern already used by the outgoing `InstructionsTab`. (`GroceryTab` shares the same `.fd-shopweeks`/`.fd-wtoggle` CSS classes but a different, multi-select `shopWeeks` state — only the CSS is shared with it, not the selection logic; `InstructionsTab` is the actual pattern being copied.)
- No nav reordering — Prep takes the exact slot Instructions occupied (3rd position). Moving Grocery List's position was considered and rejected: it's the tab most likely to be tapped reflexively while at the store, and a position change has a real muscle-memory cost that isn't worth paying just to make the tab order narratively match the four planning stages.
- No changes to `PrepDayMode`, `PrepDayChecklist`, `prepDayBags`, or any of the `App`-level prep state/helpers (`prepProgress`, `prepped`, `togglePrepItem`, `prepDayWeekId`) — all already correct and shipped.
- Cook-day step viewing is not redesigned or relocated beyond what already exists on the Meals tab — explicitly confirmed as a non-goal, not an oversight.

### Deferred to Separate Tasks

- Any future dedicated "cook day" view beyond the existing Recipe expander, if the loss of the grouped/printable Instructions view turns out to matter in practice — not requested now, noted only so it isn't silently forgotten.

## Context & Research

### Relevant Code and Patterns

- `index.html:167-369` — `App()`: owns `tab` state and the nav array at `index.html:292-308` (`[["meals","Meals"],["weeks","My Weeks"],["cook","Instructions"],["grocery","Grocery List"]]`), and the matching `tab === "..."` render conditionals at `index.html:311-366`. This is the only place the tab list and routing live — no other file/section references the `"cook"` tab key (verified via full-file grep; the only other `"cook"` string in the file is an unrelated meal-sort option value, not a tab reference).
- `index.html:1176-1249` — `InstructionsTab`: the component being removed. Its week-picker (`index.html:1192-1204`, `.fd-instr-bar` wrapping the reusable `.fd-shopweeks`/`.fd-wtoggle` classes) is the direct pattern to copy for the new Prep tab's week picker.
- `index.html:644-777` — `WeeksTab`: already contains the exact "Start/Resume Prep Day" button logic to mirror (`index.html:~700-706` — gated on `week.items.length === 0`, labeled via `isWeekPrepStarted(week.id, prepDayBags(week, byId), prepProgress) ? "Resume Prep Day" : "Start Prep Day"`, calling `startPrepDay(week.id)`).
- `index.html:264-278` — the existing full-screen takeover: when `prepDayWeekId` is set, `App` renders `<PrepDayMode>` in place of the entire normal tab UI (header, nav, and all tab bodies). The new Prep tab does not change this mechanism — it only adds a second way to call `setPrepDayWeekId(weekId)` (via `startPrepDay`, already passed down to `WeeksTab` and reusable for the new tab).
- `index.html:879` — **important cross-reference**: `PrepDayMode` already renders `<span className="fd-instr-mult">bag {n} of {mult}</span>` for ×2/×3 batch meals, reusing the `.fd-instr-mult` CSS class originally styled for `InstructionsTab`'s "make ×N" badge. Removing `InstructionsTab`'s JSX usage of this class does **not** make the CSS rule (`index.html:1446`) safe to delete — `PrepDayMode` still depends on it. See Risks.
- CSS at `index.html:1439-1458` — all `.fd-instr-*` rules. Confirmed via full-file grep: `.fd-instr-bar`, `.fd-instr-note`, `.fd-instr-list`, `.fd-instr-card`, `.fd-instr-name`, `.fd-instr-missing`, and their responsive/print sub-rules are used **only** by `InstructionsTab` and are safe to delete. `.fd-instr-mult` is the one exception (see above).

### Institutional Learnings

None — `docs/solutions/` still does not exist in this repository (confirmed in the prior session and again here).

## Key Technical Decisions

- **The new Prep tab is genuinely thin — a week picker and one button, nothing else.** An earlier draft of this plan had the tab also show the selected week's meal count, bag count, and Prepped badge before its entry button — a document-review pass caught that this reproduces, almost verbatim, the summary `PrepDayMode`'s own landing screen already shows one tap later (week name, bag count, Start/Resume button — `index.html:828-846`, which always renders first regardless of entry point). That's the "two landing screens in a row" this decision was meant to avoid, contradicting itself. Fixed: the Prep tab now shows only a week picker (when >1 week exists) and a single "Start/Resume Prep Day" button — no bag count, no badge preview. All of that content still exists; it just shows up once, on `PrepDayMode`'s own landing screen, not twice.
- **Keep the My Weeks "Start/Resume Prep Day" button, and make it explicitly keep `activeWeek` in sync.** Removing the button in favor of the new tab was considered and rejected: it's the faster path for someone already looking at the week they want to prep, and mirrors how "Grocery list →" also stays as a shortcut alongside its own tab. Verified against the current code that `WeeksTab`'s button already can't diverge from `activeWeek` in practice — it calls `startPrepDay(week.id)` where `week` is itself derived from `activeWeek` (`index.html:645`), so there's no path today where they disagree. Unit 2 adds an explicit `setActiveWeek(week.id)` call alongside the existing `startPrepDay(week.id)` call anyway: it costs nothing, and it makes "these two entry points can't drift apart" a property of the code rather than an accident of how one other variable happens to be derived — protecting against a future refactor decoupling `week` from `activeWeek` in `WeeksTab` without anyone noticing this invariant existed.
- **Exiting Prep Day Mode always returns to whichever tab launched it — verified, not just assumed.** `PrepDayMode`'s full-screen takeover is orthogonal to `App`'s `tab` state: entering it (via either entry point) never changes `tab`, and exiting it just lets the existing `tab`-based render resume. So starting from My Weeks and exiting lands back on My Weeks; starting from the new Prep tab and exiting lands back on the Prep tab. No new logic is needed to make this correct — it already falls out of how the two pieces of state are independent today.
- **`.fd-instr-mult` CSS class stays; only `InstructionsTab`'s own classes are removed.** Verified by grep that this specific class is shared with `PrepDayMode`. Renaming it for clarity (e.g. to a more generic `fd-badge-pill`) was considered but deferred as out of scope — it works correctly under its current name and a rename only adds risk for a Lightweight change.

## Open Questions

### Resolved During Planning

- Whether the Prep tab needs its own week-selection UI or can rely solely on `activeWeek`: resolved above — it gets a lightweight picker mirroring `InstructionsTab`'s pattern, since `activeWeek` alone would force users to visit My Weeks first just to switch which week they're prepping.
- Whether `.fd-instr-mult` can be deleted along with the rest of `InstructionsTab`'s CSS: resolved above — no, it's still used by `PrepDayMode`.

### Deferred to Implementation

- Exact copy/wording for the new tab's empty states (no weeks yet / selected week has no meals) — should mirror `InstructionsTab`'s existing empty-state tone (`index.html:1177-1184`) but isn't worth pre-specifying word-for-word here.

## Implementation Units

- [x] **Unit 1: Add `PrepTab` component (week picker + entry point)**

**Goal:** A new component that lets the user pick a week (when more than one exists) and launch the existing full-screen `PrepDayMode` for it.

**Requirements:** R2, R3

**Dependencies:** None — purely additive; can be built before Unit 2 removes `InstructionsTab`.

**Files:**
- Modify: `index.html` (add new `PrepTab` function, placed where `InstructionsTab` currently lives so its replacement is easy to review as a like-for-like diff)

**Approach:**
- Signature: `PrepTab({ weeks, byId, activeWeek, setActiveWeek, prepProgress, prepped, startPrepDay, goMeals })` — same shape as `InstructionsTab`'s props plus `prepProgress`/`prepped`/`startPrepDay` (already available in `App`, just not currently passed to this slot).
- Empty state (no weeks at all): mirror `InstructionsTab`'s existing empty state (`index.html:1177-1184`), pointing at Prep Day Mode instead of cook-day directions, with the same "Browse meals" CTA.
- Non-empty state: a week-picker bar reusing `.fd-shopweeks`/`.fd-wtoggle` (same markup shape as `InstructionsTab:1192-1204`), driven by `activeWeek`/`setActiveWeek` — omit the picker bar entirely when `weeks.length === 1` (nothing to switch between).
- Below the picker: just the Prepped badge (`prepped[week.id]`, same rendering as `WeeksTab`'s badge) if applicable, and a single primary button reusing the exact label logic already in `WeeksTab` (`isWeekPrepStarted(...) ? "Resume Prep Day" : "Start Prep Day"`), calling `startPrepDay(week.id)` on click. **Deliberately no bag count, meal count, or other summary content here** — `PrepDayMode`'s own landing screen shows that immediately after, and showing it twice was flagged and corrected during document review (see Key Technical Decisions).
- When the selected week has zero meals: the button is disabled (matching `WeeksTab`'s gating), and a one-line hint renders in its place — reuse `InstructionsTab`'s existing empty-week copy ("This week has no meals yet. Add some from the Meals tab.", `index.html:~1215`) rather than leaving a silently-disabled button with no explanation.

**Patterns to follow:**
- `InstructionsTab`'s week-picker bar (`index.html:1192-1204`) for markup shape.
- `WeeksTab`'s "Start/Resume Prep Day" button (`index.html:~700-706`) for the exact label/gating logic — do not reimplement this logic differently; call the same `isWeekPrepStarted`/`prepDayBags` helpers.

**Test scenarios:**
- Happy path — single week: with exactly one week that has meals, the tab shows no picker bar and an enabled "Start Prep Day" button that calls `startPrepDay` with the correct week id.
- Happy path — multiple weeks: with 2+ weeks, the picker bar renders one toggle per week; clicking a different week updates the button's label/state to match that week (via shared `activeWeek`).
- Edge case — empty week selected: a week with zero meals shows a disabled entry button plus the explanatory hint text, matching `WeeksTab`'s existing gating.
- Edge case — no weeks at all: shows the empty state with a working "Browse meals" link back to the Meals tab.
- Happy path — resume label: a week with existing `prepProgress` shows "Resume Prep Day" and the Prepped badge when applicable, matching `WeeksTab`'s same-data-driven display.
- Integration — no duplicated content: confirm the tab itself shows no bag count or meal count — only the picker, badge, and button — verifying the fix for the landing-screen duplication caught in document review.
- Integration — launches the real flow: clicking the entry button actually opens the existing full-screen `PrepDayMode` (via `prepDayWeekId`), landing on its own landing screen (which *does* show the bag count) for the correct week — confirms the two components hand off correctly rather than duplicating logic.

**Verification:**
- Manually verify in-browser: a household with 2+ weeks, one partially prepped and one untouched — confirm picker switching, correct button labels, the empty-week hint, and that clicking through opens the right week's Prep Day Mode session with no redundant summary shown beforehand.

---

- [x] **Unit 2: Swap the nav tab and remove `InstructionsTab`**

**Goal:** Replace "Instructions" with "Prep" in the main nav and routing, removing the old component and its now-dead CSS.

**Requirements:** R1, R2

**Dependencies:** Unit 1 (the new `PrepTab` must exist before it can be wired in)

**Files:**
- Modify: `index.html` (`App`'s nav array and tab-switch render block, `index.html:292-308` and `344-352`; delete the old `InstructionsTab` function; delete its dead CSS)

**Approach:**
- Nav array: replace `["cook", "Instructions"]` with `["prep", "Prep"]` in place — same 3rd position, no reordering of the other tabs (see Scope Boundaries on why the order otherwise stays put).
- Render block: replace the `tab === "cook"` conditional rendering `<InstructionsTab>` with `tab === "prep"` rendering `<PrepTab>`, passing `weeks`, `byId`, `activeWeek`, `setActiveWeek`, `prepProgress`, `prepped`, `startPrepDay={(weekId) => setPrepDayWeekId(weekId)}` (same closure shape already used for `WeeksTab`'s `startPrepDay` prop), `goMeals`.
- In `WeeksTab`, change the existing button's `onClick` from `() => startPrepDay(week.id)` to `() => { setActiveWeek(week.id); startPrepDay(week.id); }` — `setActiveWeek` is already a prop `WeeksTab` receives, so this only adds the call, not a new prop. See Key Technical Decisions for why this is worth doing even though it's not fixing an active bug.
- Delete the `InstructionsTab` function body entirely.
- Delete its dead CSS rules (`.fd-instr-bar`, `.fd-instr-note`, `.fd-instr-list`, `.fd-instr-card`, `.fd-instr-name`, `.fd-instr-missing`, and their two responsive/print sub-rules at `index.html:1453` and `1456-1458`) — leave `.fd-instr-mult` untouched (still used by `PrepDayMode`).

**Patterns to follow:**
- The existing tab-array-plus-conditional-render structure in `App` — no new routing mechanism, just edit the existing list and conditional.

**Test scenarios:**
- Happy path — nav renders correctly: the tab bar shows Meals, My Weeks, Prep, Grocery List in that order (Prep occupies Instructions' old slot); no "Instructions" label anywhere.
- Happy path — Prep tab routes correctly: clicking "Prep" renders `PrepTab`, not a blank screen or leftover `InstructionsTab` content.
- Regression — other tabs unaffected: Meals, My Weeks, and Grocery List still render and function exactly as before (this unit only touches the array and one conditional branch).
- Regression — `PrepDayMode`'s ×2/×3 batch badge still renders correctly (visually confirms `.fd-instr-mult` CSS survived the cleanup).
- Integration — `activeWeek` sync: clicking "Start/Resume Prep Day" in My Weeks for a given week, then exiting Prep Day Mode and switching to the Prep tab, shows that same week selected (confirms the new `setActiveWeek` call in `WeeksTab`'s button actually keeps the two entry points aligned).
- Integration — exit returns to the launching tab: entering Prep Day Mode from My Weeks and exiting lands back on My Weeks; entering from the Prep tab and exiting lands back on the Prep tab.

**Verification:**
- Manually verify in-browser: full click-through of all four tabs in the new order, confirm no console errors, confirm the removed Instructions tab leaves no dead link or blank state anywhere, confirm print styles for Grocery List still work unaffected (its `@media print` block is separate from the deleted `.fd-instr-*` one).

## System-Wide Impact

- **Interaction graph:** Only `App`'s tab array/render conditional and the two components at the boundary (`InstructionsTab` removed, `PrepTab` added) are touched. `PrepDayMode` and all `App`-level prep state (Units 3-6 of the prior plan) are unchanged and untouched by this plan.
- **State lifecycle risks:** None new — `PrepTab` reads existing `activeWeek`/`prepProgress`/`prepped` state, writes nothing new; `prepDayWeekId`'s existing full-screen-takeover mechanism is reused as-is.
- **Unchanged invariants:** `PrepDayMode`'s bag-by-bag flow, checklist persistence, Prepped stamp timing, and print-label behavior are explicitly out of scope for this plan and must remain byte-for-byte behaviorally identical — this plan only changes how a user reaches that flow, never what happens once they're in it.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Deleting `InstructionsTab`'s CSS accidentally removes `.fd-instr-mult`, silently breaking `PrepDayMode`'s ×2/×3 batch badge | Explicitly called out in Context & Research and Unit 2's approach; Unit 2's test scenarios include a specific regression check for this badge |
| Cook-day step visibility genuinely regresses for users who relied on the grouped/printable Instructions view (not just individual Recipe cards) | Explicitly accepted as a confirmed, deliberate product decision (see Problem Frame) — not something this plan should silently work around; noted under Deferred to Separate Tasks if it turns out to matter |

## Sources & References

- **Origin document:** [docs/plans/2026-07-20-001-feat-shopping-prep-efficiency-plan.md](2026-07-20-001-feat-shopping-prep-efficiency-plan.md) — the Prep Day Mode feature this plan re-routes navigation to.
- Related code: `index.html` (`App`, `WeeksTab`, `InstructionsTab`, `PrepDayMode`)
