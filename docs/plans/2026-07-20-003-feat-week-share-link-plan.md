---
title: Share a Week via Link
type: feat
status: completed
date: 2026-07-20
origin: docs/brainstorms/2026-07-20-week-share-requirements.md
---

# Share a Week via Link

## Overview

Add a "Share" action to a week in My Weeks that generates a URL encoding that week's meals (recipe id + name) and batch multipliers. Opening the link on another device shows a full-screen preview of the incoming week; confirming adds it as a brand-new, fully independent week to that device's own My Weeks list. No backend, no accounts — the link itself carries all the data, matching this app's existing zero-server architecture.

## Problem Frame

Two people plan meals somewhat independently in their own copies of this app. Today, handing a built week to someone else means describing it verbally or by screenshot — no structured data actually transfers, so the recipient rebuilds it meal-by-meal by hand. Because both people's apps ship the same static 56-recipe `DATA` array (`index.html:33`, ids `r0`-`r55`), a week's essential content — a name plus a list of `(recipe id, recipe name, multiplier)` — is small enough to encode directly in a URL, with everything else (ingredients, quantities, prep steps) derived locally on both ends exactly as it already is today. See origin: `docs/brainstorms/2026-07-20-week-share-requirements.md` for the full problem framing, the four-persona requirements review that shaped R6/R7, and the specific product decisions (id+name matching, full-screen preview, zero-match blocking) that this plan builds on directly.

## Requirements Trace

- R1. Generate a shareable link from a week in My Weeks; disabled when the week has zero meals.
- R2. Copy the link to the clipboard, reusing the Grocery List "Copy list" pattern in full (async clipboard + textarea fallback + timed success confirmation).
- R3. Opening the link shows a full-screen preview (week name, meals, multipliers) before anything is saved.
- R4. Confirm adds a new week and navigates to My Weeks with it selected; Dismiss saves nothing.
- R5. The imported week is a fresh, fully independent copy (new id, no link back to the sender's week).
- R6. Matching requires both recipe id and recipe name to agree; a mismatch is treated as unmatched. Partial mismatches are skipped and named individually in the preview; a zero-match link blocks the import entirely rather than creating an empty week.
- R7. An undecodable/corrupted link shows an explicit error state, never a blank screen or silent no-op.

## Scope Boundaries

- No accounts, sync, or backend — the link is the only data channel, and the app must keep working as a static site with no server component.
- No live/two-way sync between the sender's and recipient's copies of a week after import.
- Only meals and batch multipliers travel. Ratings, hidden-meal choices, Prep Day checklist progress, and "Prepped" stamps never travel with the share, even if set on the sender's source week.
- One week per share — not a whole-app export/backup. (A general export/import-everything feature is a plausible future idea, explicitly not part of this plan.)
- No editing the incoming week's contents from the preview screen — accept-as-is or don't import; changes happen afterward via My Weeks' existing tools.
- Cross-tab coordination (opening a share link in a second tab while another tab has the app open) is not addressed — same last-write-wins behavior the app already has for any two tabs today. Not a regression this feature introduces, so not solved here.
- **This feature requires both people to load the app from the same deployed origin** (currently `https://papapablano.github.io/slowcooker/`), carried forward from the origin document's Dependencies section. A share link is only meaningful against a copy of the app served from that same URL — someone running an independent local copy (e.g. opening `index.html` directly as a `file://` page, per the README's supported "host it yourself" mode) or a separate fork at a different URL would have a link that resolves to nothing useful. This isn't solvable by this feature; it's a precondition for it working at all (see Risks & Dependencies).

### Deferred to Separate Tasks

- A general "export/import my whole plan" feature, if the pattern proves useful beyond single-week sharing — not requested now.

## Context & Research

### Relevant Code and Patterns

- `index.html:33` — `DATA`, the static 56-recipe array (`id`, `name` fields used for R6's matching).
- `index.html:115` — `uid()`, the existing id generator (`Math.random().toString(36).slice(2, 9)`), reused for the imported week's fresh id.
- `index.html:182-198` — `App`'s load effect: an async IIFE calls `loadState()`, sets each state slice, then sets `loaded = true`. The save effect (`index.html:201-204`) is gated by `if (!loaded) return`. This is the source of the confirm-handler race flagged in the origin doc (see Key Technical Decisions).
- `index.html:264-278` — `App`'s existing full-screen-takeover pattern for `PrepDayMode`: a piece of transient state (`prepDayWeekId`) causes `App` to return an alternate component tree instead of the normal tab UI. This plan's share-preview screen follows the identical shape with its own transient state variable, `incomingShare` (named explicitly here so Units 2 and 3 reference the same thing rather than inventing their own names independently).
- `index.html:706-719` — `WeeksTab`'s per-week action row ("+ Add meals", "Grocery list →", "Start/Resume Prep Day", "Delete"); "Grocery list →" and "Start/Resume Prep Day" are both `disabled={week.items.length === 0}` (lines 708-710, 711-717) — the pattern the new Share button follows per R1.
- `index.html:694-697` — the existing rename affordance (click title → inline edit → `renameWeek`), reused as-is for editing an imported week's name after the fact (no new rename UI needed).
- `index.html:1003-1020` — `GroceryTab`'s `copyNow()`: tries `navigator.clipboard.writeText`, falls back to a selectable `<textarea>` + `document.execCommand("copy")` on failure, then sets a timed `copied` success flag. R2 requires reusing this in full, not just the happy path.
- Confirmed via repo research: **no existing use anywhere in `index.html` of `location.hash`, query strings, `history.pushState`/`replaceState`, `btoa`/`atob`, or `encodeURIComponent`/`decodeURIComponent`.** This feature introduces URL-based state entirely from scratch — there's no local pattern to extend, only the two structural patterns above (full-screen takeover, clipboard-with-fallback) to reuse.
- No `package.json`, build step, or test framework exists in this repo (confirmed, consistent with the rest of the codebase) — this plan does not introduce one.

### Institutional Learnings

- `docs/solutions/` does not exist in this repository (confirmed). No prior recorded incidents to apply.
- A prior ideation document (`docs/ideation/2026-07-19-meal-journey-ux-ideation.md`) already considered and rejected a simpler "live URL sync" approach because a one-way URL can't round-trip checkbox/progress state — consistent with this plan's Scope Boundaries (meals/multipliers only, no live sync, no personal state travels).

### External References

None used — this feature's technical surface (URL hash encoding, `encodeURIComponent`/`decodeURIComponent`, `atob`/`btoa`) is standard browser behavior with no framework- or version-specific pitfalls to research; the codebase's lack of prior art here is a "build fresh" situation, not a "learn an unfamiliar library" one.

## Key Technical Decisions

- **Encode the payload as base64url-encoded JSON in the URL hash, not a custom delimited format or query string — using a UTF-8-safe encode/decode step, not plain `btoa`/`atob`.** A hash fragment is never sent to a server or logged (unlike a query string), and recipe/week names can contain arbitrary characters (commas, colons, emoji, accented characters) that a hand-rolled delimited format would need custom escaping for — JSON already handles that for free. Plain `btoa()` only accepts Latin-1 characters and throws on anything outside that range (an emoji in a renamed week, for instance) — flagged during document review as a bug that would break the encoder on realistic input, not just a hand-edited-link edge case. The encode/decode helpers must therefore go through a UTF-8-safe step first (e.g. the standard `unescape(encodeURIComponent(json))` / `decodeURIComponent(escape(atob(...)))` idiom, or `TextEncoder`/`TextDecoder`), plus the usual base64→base64url substitution (`+`/`-`, `/`/`_`, stripped `=` padding) so the result is hash-safe. The cost is a slightly longer link than a maximally compact custom format, which doesn't matter since links are shared by tapping, not retyping.
- **The payload includes a small format-version marker (e.g. `v: 1`).** Flagged during document review: without one, a future change to the week/meal shape has no way to distinguish "valid link in an older format" from "genuinely corrupted" (R7) — both would otherwise collapse into the same undecodable-link error. A version field costs a few bytes and lets a future version of the decoder choose to handle old formats differently instead of just failing.
- **The confirm-write is gated on `App`'s existing `loaded` flag, eliminating the load-effect race by construction.** The origin doc flagged a real risk: if the import write happens before the initial `loadState()` effect resolves, that effect's own `setWeeks(...)` could silently overwrite the just-imported week. Rather than adding new coordination logic, the share-preview screen simply doesn't enable its Confirm button (or render real content beyond a brief loading state) until `loaded` is `true` — the same flag `App` already uses to gate its save effect. Given `loadState()`'s work is effectively synchronous (a `localStorage.getItem` call wrapped in an async function), this loading state will be imperceptible in practice, but the guard removes the race outright rather than relying on timing.
- **The share hash is parsed and cleared immediately on mount, not on confirm/dismiss.** Flagged during flow analysis: if the hash stayed in the URL until the user acted, a refresh at any point while the preview is open would re-trigger the same import, and a second Confirm would silently create a duplicate week (R5 makes every import independent, so nothing else would stop this). Reading `location.hash` once, storing the decoded payload in transient `App` state, and clearing the hash (`history.replaceState` or `location.hash = ''`) right away means a refresh after that point just reloads the normal app — the payload only exists once, in memory, for the lifetime of that preview.
- **A matched meal's multiplier is validated against the app's own supported values ({1, 2, 3}), clamping to 1 rather than dropping the meal.** The app's UI only ever offers ×1/×2/×3 (`index.html:750-761`), so any other decoded value can only come from a corrupted or hand-edited link. Since the meal itself already passed the id+name match, discarding it entirely over a bad multiplier is more destructive than necessary — clamping to the safe default (×1) keeps the meal in the import while never silently amplifying a corrupted value into a large batch.
- **Duplicate recipe ids within one payload are de-duplicated, keeping the first occurrence.** Mirrors the app's own existing invariant (`addToWeek`, `index.html:224-234`) that a week never holds the same `rid` twice — a corrupted or hand-edited link is the only way this could occur, and de-duping preserves that invariant on import rather than introducing a new kind of week the rest of the app has never had to handle.
- **Zero-match failure copy avoids assuming "your app is out of date."** A zero-match link can also mean the recipient edited/deleted those specific recipes locally, not just version skew. Copy reads along the lines of "None of these meals could be matched — the recipe list may have changed since this link was made," without prescribing a specific fix that might be wrong.
- **A blank or unreasonably long decoded week name falls back to a safe default.** An empty/whitespace-only name becomes "Shared Week"; an excessively long one is truncated to a sane cap (~60 characters). Both are hand-edited-link scenarios, not something a real Share action would ever produce, but the import path shouldn't trust decoded input the way normal UI input is implicitly trusted.
- **Dismiss lands on the app's default tab (Meals), not a remembered "previous" tab.** Since a share link is opened cold (a fresh page load from a messaging app, not a same-tab navigation from within the app), there is no prior in-app tab to return to — `App`'s existing default `tab` state covers this with no new logic needed.
- **The imported week is appended to the end of `weeks`, with no special ordering or sorting.** Matches how every other week (`addWeek`) is already added — no new insertion-order concept for the app to reason about.
- **Browser back/forward during the preview is left as default browser behavior — no `history.pushState` entry is added for entering or exiting it.** Since the hash is cleared via `replaceState` immediately on mount (not pushed as a new entry), there's nothing in history for back/forward to act on within this feature; a back gesture behaves exactly like leaving any other page reached via an external link. Adding push-state entries just to make back-navigation dismiss the preview would introduce new history-management complexity for a low-stakes, low-frequency interaction — consistent with this plan's existing pattern of accepting narrow, low-consequence limitations (see cross-tab coordination and pre-feature-version links above) rather than solving every edge case with new machinery.
- **No dedicated accessibility (focus management, ARIA live regions, keyboard shortcuts) work is scoped for the new preview screen, matching the app's existing baseline.** Flagged during document review as a gap, but verified against the codebase: no screen this app already ships — including `PrepDayMode`'s own full-screen takeover, the closest existing precedent — has bespoke focus/ARIA handling today. This plan follows the same baseline as the rest of the app rather than introducing a new, inconsistent standard for one screen; a broader accessibility pass, if wanted, is a separate cross-cutting effort rather than something to bolt onto this feature alone.
- **A zero-match link blocks the import at exactly 0-of-N matched, not some higher "mostly unmatched" threshold.** A partial-match link (e.g. 9 of 10 skipped) still shows the recipient exactly which single meal survived and lets them decide whether that's worth keeping — the zero-match rule specifically exists to prevent a *useless* (fully empty) week, not to second-guess how useful a mostly-empty one is. Any percentage-based threshold would need its own justification for where to draw the line; the simple 0-match rule needs none.
- **Typical link length is small enough not to need special handling.** A week of 5-6 meals with normal-length names encodes to roughly a few hundred bytes of JSON, and base64 inflates that by about a third — comfortably under practical URL-length limits for the sharing channels this targets (SMS/iMessage/WhatsApp/email all handle URLs far longer than this in practice, since the length limit concern for SMS applies to per-segment character counts of the *message*, not a hard cap on embedded URLs). No length-based truncation or warning is built for this reason; Unit 1's test scenarios include one exercising a larger-than-typical week to confirm this holds in practice rather than just in estimate.
- **The Share action gets its own visible copy surface (a small panel with a ref'd, read-only `<textarea>`), structurally mirroring `GroceryTab`'s existing copy panel (`.fd-copy-overlay`/`.fd-copy-panel`, `index.html:1128-1173`) — not just a bare, non-visual clipboard function.** Flagged during document review: `document.execCommand("copy")` only works against a focused, selected DOM text node — `GroceryTab`'s fallback works because that node (the panel's textarea) already exists for the user to manually select from if both the async clipboard API and `execCommand` fail. A shared helper that only takes a callback has nothing to select, silently losing the manual-copy safety net in exactly the in-app browsers (opened from SMS/email) where it matters most. The underlying try/writeText/catch/fallback *logic* is still extracted into one shared function so both call sites can't drift apart, but the panel markup (textarea + visible link text) is duplicated structurally for the Share action, matching what already exists for Grocery List.

## Open Questions

### Resolved During Planning

- Whether Prep Day Mode being open could conflict with an incoming share link: resolved — `prepDayWeekId` is transient (not persisted to `localStorage`), so a fresh page load from a share link never has stale Prep Day Mode state to collide with. The only way to reach both at once would be manually replacing the URL of an already-open tab that happens to be mid-Prep-Day-Mode — rare enough, and low-consequence enough (worst case, the share preview simply takes over as the new full-screen state), not to need special handling.
- Where the Share button lives: resolved — `WeeksTab`'s existing action row (`index.html:706-719`), alongside "Grocery list →" and "Start/Resume Prep Day", following the same `disabled={week.items.length === 0}` convention.
- Hash vs. query string for the encoded payload: resolved — hash fragment (see Key Technical Decisions).
- Whether import needs cross-tab coordination beyond what already exists: resolved — no; same last-write-wins behavior the app already has, not a new regression (see Scope Boundaries).

### Deferred to Implementation

- The payload's overall shape is decided (`{v: 1, name, items: [{id, name, mult}, ...]}`, per Key Technical Decisions) — only the exact JSON *key names* are left flexible (e.g. shortened keys like `n`/`m` to save a few bytes vs. the more descriptive names shown here), a pure compactness/readability tradeoff best resolved while writing the actual encode/decode code.
- Exact copy/wording for the preview screen's various states (matched list, partial-skip warning, zero-match block, corrupted-link error) — should follow the tone of existing empty-state copy (`index.html:1177-1184` era text, now on `PrepTab`) but isn't worth pre-writing word-for-word.

## Implementation Units

- [x] **Unit 1: Share link generation**

**Goal:** Add a "Share" action to a week in My Weeks that produces a clipboard-copied link encoding that week's data.

**Requirements:** R1, R2

**Dependencies:** None — purely additive, no dependency on Units 2/3.

**Files:**
- Modify: `index.html` (new module-level encode helper near the other week helpers like `prepDayBags`; shared clipboard try/fallback *logic* extracted from `GroceryTab`'s `copyNow`; a new copy-panel component/markup for the Share action structurally mirroring `GroceryTab`'s existing `.fd-copy-overlay`/`.fd-copy-panel`; `GroceryTab` updated to call the extracted shared logic instead of its inline version; new "Share" button in `WeeksTab`'s action row; corresponding CSS)

**Approach:**
- New helper `encodeShareLink(week, byId)` builds `{v: 1, name, items: [{id, name, mult}, ...]}` from the week's `items` (skipping any `rid` that no longer resolves via `byId`, which shouldn't happen for a week built entirely from live UI actions, but keeps the encoder honest about only encoding what it can actually look up), UTF-8-safely encodes it to base64url, then produces a `#share=<encoded>`-shaped hash string (see Key Technical Decisions for the encoding requirements).
- The underlying try-`writeText`/catch/fallback *logic* from `GroceryTab`'s existing `copyNow` (`index.html:1003-1020`) is extracted into one shared function so both call sites can't drift apart — but the Share action gets its own visible copy panel (ref'd read-only `<textarea>` + visible link text), structurally mirroring `GroceryTab`'s existing `.fd-copy-overlay`/`.fd-copy-panel` markup, not just a bare non-visual helper (see Key Technical Decisions for why the panel itself, not just the logic, needs to be duplicated).
- New "Share" button in `WeeksTab`'s action row (`index.html:706-719`), placed after "Start/Resume Prep Day" and before "Delete" (grouping it with the other non-destructive actions, keeping the destructive "Delete" last), `disabled={week.items.length === 0}` matching the two existing buttons beside it, calling `encodeShareLink` then opening the new copy panel, with the same success-confirmation treatment `GroceryTab` already gives its "Copy list" button.

**Patterns to follow:**
- `GroceryTab`'s `copyNow` and its copy panel markup (`index.html:1003-1020`, `1128-1173`) for both the clipboard fallback logic and the panel structure being mirrored.
- `WeeksTab`'s existing "Grocery list →" / "Start/Resume Prep Day" buttons (`index.html:706-719`) for the new button's styling and disabled-state convention.

**Test scenarios:**
- Happy path: a week with 3+ meals at mixed multipliers produces a link whose decoded payload (manually decoded for the test) contains the correct id/name/mult triples for every item.
- Edge case: a week with exactly one meal encodes correctly (no off-by-one in the items array).
- Edge case: a week with an unusually large number of meals and long recipe names still produces a link well within practical URL-length limits (see Key Technical Decisions' size estimate).
- Edge case: a week name or recipe name containing non-Latin1 characters (e.g. an emoji or accented character) encodes and decodes without throwing — the specific bug the UTF-8-safe encoding step exists to prevent.
- Edge case: Share button is disabled when `week.items.length === 0`, matching the other two action buttons' gating.
- Integration: clicking Share with `navigator.clipboard` available copies the correct link text and shows the same success-confirmation treatment as "Copy list".
- Integration: clicking Share with `navigator.clipboard.writeText` throwing/unavailable falls back to the panel's selectable textarea, exercising the newly-extracted shared logic from a second call site (not just `GroceryTab`'s).
- Regression: after extracting the shared clipboard logic, `GroceryTab`'s own "Copy list" button still produces the same success confirmation and the same textarea-fallback behavior as before the refactor — this is the test that actually backs the "not a behavior change" claim in System-Wide Impact.

**Verification:**
- Manually verify in-browser: share a week with 1 meal and a week with several mixed-multiplier meals; confirm the copied link's payload (inspect via a temporary log or by pasting into the address bar and checking the resulting preview from Unit 3) matches the source week exactly.

---

- [x] **Unit 2: Share import — parsing, validation, and matching**

**Goal:** On page load, detect and safely decode a share link's payload, validate and match it against the local `DATA`, and expose the result as transient `App`-level state — without any UI yet (that's Unit 3).

**Requirements:** R5, R6, R7 (engine only; UI in Unit 3)

**Dependencies:** None functionally — this unit's helpers and state are usable in isolation — but Unit 3 is the only consumer of what this unit produces, so the two are naturally built and landed together rather than as separate reviewable commits. Unit 1 has no dependency relationship with either.

**Files:**
- Modify: `index.html` (new module-level decode/match helper(s) near the other pure helpers like `isWeekPrepStarted`; new transient `App` state `incomingShare` for the parsed-and-validated share payload; new `App`-mount-time effect to detect and consume `location.hash`)

**Approach:**
- New helper `decodeShareLink(hash)` reverses Unit 1's encoding (including the UTF-8-safe base64url step and the `v: 1` version check); returns a clear "invalid/undecodable" result (not a thrown exception) on any parse failure or unrecognized version, feeding R7's error state.
- New helper `matchShareItems(items, byId)` takes the decoded `{id, name, mult}` list and, for each entry: looks up `byId[id]`; counts it matched only if the found recipe's `name` also equals the decoded `name`; clamps `mult` to `1` if it isn't one of `{1, 2, 3}`; de-dupes by `id`, keeping the first occurrence. Returns both the matched list (ready to become week items, still shaped `{id, name, mult}` at this stage — Unit 3 maps `id` to the `rid` field the rest of the app's week-item shape uses when it actually builds the new week) and the list of skipped entries (by name, for R6's per-meal warning) so Unit 3 can render both.
- On `App` mount, a new effect checks `location.hash` for the share marker once; if present, decodes and matches it immediately, clears the hash via `history.replaceState` (or `location.hash = ''`) regardless of whether decoding succeeded, and stores the outcome (error / zero-match / matched-with-some-skipped / fully-matched, plus the decoded week name) in `incomingShare`.
- `incomingShare`'s presence causes `App` to render the Unit 3 preview screen in place of the normal tab UI, exactly like the existing `prepDayWeekId` → `PrepDayMode` branch (`index.html:264-278`) — this unit only produces the data; Unit 3 consumes it.
- Confirm-time write (executed by Unit 3, but the gating condition lives here) must not run until `App`'s existing `loaded` flag is `true` — see Key Technical Decisions for why.
- Since `encodeShareLink` (Unit 1) and `matchShareItems` are meant to always agree on what counts as valid, a clamp or de-dupe actually triggering against a link generated by this app's own Share button (as opposed to a hand-edited one) most likely indicates an encoder bug, not a legitimate hand-edited link. A `console.warn` when clamping/de-duping actually fires gives this a visible signal during development without adding any user-facing behavior or new state.

**Patterns to follow:**
- `App`'s `prepDayWeekId` state and the `prepDayWeek` derivation immediately above its full-screen branch (`index.html:264-278`) for how a single piece of transient state should drive an alternate render path.
- `addToWeek` (`index.html:224-234`) for the existing "never duplicate an `rid` in one week" invariant this unit's de-dupe logic preserves.

**Test scenarios:**
- Happy path: a validly-encoded payload with 3 meals, all matching by id+name, decodes to a fully-matched result with an empty skipped list.
- Edge case: a payload with a matched id but a mismatched name is treated as unmatched (not accepted), and it appears in the skipped list, not the matched list.
- Edge case: a payload with a multiplier outside `{1, 2, 3}` (e.g. `0`, `-1`, `"abc"`, `99`) results in that meal being matched with `mult` clamped to `1`, not dropped.
- Edge case: a payload listing the same recipe id twice results in only one item in the matched output.
- Edge case: a payload where zero of N ids match produces a distinct "zero-match" outcome (not the same shape as "partial match"), per R6.
- Edge case: an empty or whitespace-only decoded week name falls back to "Shared Week"; a name far beyond a reasonable length is truncated.
- Error path: a hash that isn't valid base64, or decodes to base64 that isn't valid JSON, or JSON that doesn't match the expected shape, or JSON with an unrecognized `v` value, produces the "undecodable link" outcome (R7) rather than throwing.
- Integration: after any outcome (error, zero-match, matched), `location.hash` is empty immediately — confirmed by checking `location.hash === ''` right after the mount effect runs, before any user interaction, so a simulated refresh at this point can't re-trigger the same decode.

**Verification:**
- Manually verify in-browser: paste a link generated by Unit 1 directly into the address bar and confirm the hash disappears from the URL bar immediately on load, before interacting with anything.

---

- [x] **Unit 3: Share import — preview screen and confirm/dismiss**

**Goal:** Build the full-screen preview UI that presents Unit 2's parsed result and lets the recipient confirm (adding a new week) or dismiss.

**Requirements:** R3, R4, R6 (presentation), R7 (presentation)

**Dependencies:** Unit 2 (needs its decoded/matched state and helpers to render against).

**Files:**
- Modify: `index.html` (new `ShareImportPreview`-style component; `App`'s render branch wiring it in similar to the `PrepDayMode` branch; CSS additions reusing existing empty-state/full-screen patterns rather than introducing a new visual language)

**Approach:**
- Full-screen takeover styled like `PrepDayMode`'s wrapper (`index.html:264-278`, the `.fd-root` + `<style>{CSS}</style>` shape), with a single Dismiss control (one button, matching R4's wording exactly — not a separate corner Close icon plus a Dismiss button; both would trigger identical behavior, so there's no reason to build two).
- Renders one of four states based on `incomingShare`'s outcome: undecodable-link error (R7); zero-match blocked (R6, with the softened copy from Key Technical Decisions, no Confirm option); partial-match (week name, matched meal list with multipliers, a named list of skipped meals, enabled Confirm); fully-matched (same as partial but no skipped-meals section).
- Before `App`'s `loaded` flag is `true`, the screen renders its Confirm button disabled with its existing label (no separate spinner or loading copy — per Key Technical Decisions, this state is expected to be imperceptible in practice, so it doesn't need its own visual treatment beyond the normal disabled-button style already used elsewhere in the app).
- Confirm also disables itself synchronously the instant it's clicked (independent of the `loaded` gate), so a rapid double-tap — common on mobile, which is how this screen is most often reached — can't invoke the handler twice and create two duplicate weeks from one link.
- On Confirm: build a new week object (`{id: uid(), name: <decoded-or-fallback name>, items: <matched items mapped from {id, name, mult} to {rid: id, mult}, matching the shape addToWeek already produces>}`), append it to `weeks` state, also update `shopWeeks` for the new week's id exactly as `addWeek` already does (`index.html:209-215`) so the imported week is pre-selected for grocery-list generation like any other week, clear `incomingShare`, then navigate to My Weeks (`setTab("weeks")`) with the new week selected (`setActiveWeek(newWeek.id)`) and a brief success confirmation (e.g. a momentary highlight on the newly-selected week card, distinct from an ordinary tab switch) — satisfying R4's "lands on a working, editable week" success criterion directly, and making a successful import visibly different from a no-op.
- On Dismiss: clear `incomingShare` only; land on the app's existing default tab (no new "remembered tab" logic, per Key Technical Decisions). Browser back/forward during the takeover is left as default behavior (see Key Technical Decisions) — no additional handling is built for it.

**Patterns to follow:**
- `PrepDayMode`'s full-screen wrapper and its `onExit` prop shape (`index.html:801` onward) for the takeover structure and dismiss handling.
- `WeeksTab`'s empty-state copy (`index.html:1177-1184`-era tone, now living in `PrepTab`) for the voice of the error/zero-match states.
- `addWeek` (`index.html:209-215`) for how a new week object is constructed and appended to `weeks` state, and for its `setShopWeeks` side effect that the Confirm handler must also replicate (see Approach).

**Test scenarios:**
- Happy path: a fully-matched payload renders the week name, every matched meal with its multiplier, and an enabled Confirm button with no skipped-meals section.
- Happy path: clicking Confirm on a fully-matched payload adds exactly one new week to `weeks`, updates `shopWeeks` for the new week's id, switches to My Weeks, and selects the new week with a visible success confirmation.
- Edge case: rapidly double-clicking Confirm still adds exactly one new week, not two — confirming the synchronous re-entrancy guard actually prevents the duplicate.
- Edge case: a partial-match payload renders the named list of skipped meals alongside the matched ones, and Confirm still succeeds for the matched subset.
- Edge case: a zero-match payload renders the blocked state with no Confirm option at all.
- Edge case: an undecodable-link payload renders the R7 error state, distinct from the zero-match state (different message, since the causes are different).
- Integration: clicking Dismiss on any state clears the preview and returns to the app's default tab without creating a week.
- Integration: Confirm renders disabled if the screen is somehow reached before `App`'s `loaded` flag becomes true, confirming Unit 2's race-avoidance gate actually reaches the UI.

**Verification:**
- Manually verify in-browser end-to-end: generate a link from a real week (Unit 1), open it in the same browser (simulating the recipient), confirm the import, and check the new week appears correctly in My Weeks with the right meals and multipliers, fully independent of the original week (editing one doesn't touch the other).

## System-Wide Impact

- **Interaction graph:** A new `App`-mount effect (Unit 2) runs alongside the existing load/save effects; it only reads `location.hash` and writes to new, dedicated transient state — it does not touch `weeks`, `prepProgress`, `prepped`, or any other existing state until the recipient explicitly confirms.
- **State lifecycle risks:** The confirm-write race with the initial `loadState()` effect is the one genuine risk here, addressed directly by gating on the existing `loaded` flag (see Key Technical Decisions) rather than introducing new coordination.
- **API surface parity:** None — this is a UI-only feature with no other interface (CLI, API) to keep in parity with.
- **Unchanged invariants:** `PrepDayMode`, `GroceryTab`'s core list logic, and all existing week/meal state management are untouched. Extracting `GroceryTab`'s clipboard try/fallback logic into a shared function is a refactor of its existing behavior, not a behavior change — Unit 1's explicit `GroceryTab` regression test scenario exists specifically to confirm this holds.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Confirm-write race with the initial `localStorage` load could silently discard an import | Gated on `App`'s existing `loaded` flag before Confirm can act (Unit 2/3) |
| A stale link re-opened later (e.g. scrolling back in a text thread) could duplicate a week | Explicit confirm step (R4) means duplication requires deliberate re-confirmation, not an accident; hash is cleared on mount so a mere refresh can't replay it |
| Recipe id reuse/renumbering could cause a wrong-meal import | id+name double match (R6) degrades any such case to "unmatched," never "silently wrong" |
| Two browser tabs open at once (one already loaded, one opening a share link) could last-write-wins over each other | Accepted as an existing app-wide limitation, not unique to this feature (see Scope Boundaries) — not solved here |
| A recipient on a cached copy of the app that predates this feature entirely opens a link and nothing happens | Accepted limitation — no way to retroactively teach an old cached page a new link format; recipient needs to reload |
| The recipient's copy of the app is hosted at a different origin than the sender's (e.g. their own local/forked copy, not the shared deployed URL) — the link resolves to nothing meaningful | Accepted precondition, not something this feature can solve (see Scope Boundaries); both people need to be using the same deployed copy for a share link to mean anything |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-07-20-week-share-requirements.md](../brainstorms/2026-07-20-week-share-requirements.md) — full problem framing, requirements R1-R7, and the four-persona review that resolved the id+name matching, full-screen preview, and zero-match-blocking decisions this plan builds on.
- Related code: `index.html` (`App`, `WeeksTab`, `GroceryTab`, `PrepDayMode`)
- Related ideation: `docs/ideation/2026-07-19-meal-journey-ux-ideation.md` (prior rejection of a live two-way sync approach, informing this plan's one-way/independent-copy scope)
