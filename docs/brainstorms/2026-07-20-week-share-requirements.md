---
date: 2026-07-20
topic: week-share
---

# Share a Week via Link

## Problem Frame

Two people plan meals somewhat independently in their own copies of the app (no accounts, no backend — state lives in each browser's `localStorage`). When one of them builds out a week (meals + batch multipliers), the only way to hand it to the other person today is verbally or by screenshot — there's no way to transfer the actual structured data, so the receiving person has to manually rebuild the same week meal-by-meal, multiplier-by-multiplier, to get the same grocery list and prep flow. This matters most for the exact case that prompted it: a wife builds a week, and her husband needs his own copy of it without re-entering anything.

Because the set of meals in an already-built week doesn't change once it's built, and both people's apps already ship the same static 56-meal recipe database (`DATA`, `index.html:33`, each recipe keyed by a short id like `r0`, `r1`), a week's essential content is just a short list of `(recipe id, recipe name, multiplier)` triples plus a name — everything else (ingredients, quantities, prep steps) is already derivable locally on both ends. That makes a link-based share a natural fit for this app's existing zero-backend architecture, rather than requiring any server or account system.

## User Flow

```mermaid
flowchart TB
    A[Wife builds a week in My Weeks] --> B[Taps Share]
    B --> C[App generates a link encoding<br/>week name + meal ids/names + multipliers]
    C --> D[Link copied to clipboard]
    D --> E[Wife sends link via text/email/etc.]
    E --> F[Husband opens link in his own app]
    F --> G[Full-screen preview:<br/>week name, meal list, multipliers]
    G -->|Confirm| H[New week added to My Weeks;<br/>switches to it with a success confirmation]
    G -->|Dismiss| I[Nothing saved]
    G -.->|Some meals unmatched| J[Preview names which meals were skipped;<br/>the rest import normally]
    G -.->|Zero meals matched| K[Import blocked:<br/>"This link couldn't be read on this version"]
    G -.->|Link unreadable/corrupted| L[Explicit error state,<br/>no partial/blank import]
```

## Requirements

**Sharing**
- R1. From a week in My Weeks, the user can generate a shareable link representing that week's meals and batch multipliers. Like the existing "Grocery list →" and "Start Prep Day" actions, Share is disabled when the week has zero meals (`index.html:708,714`).
- R2. The generated link is copied to the clipboard, reusing the existing clipboard pattern already used by Grocery List's "Copy list" button (`index.html:1003-1020`) in full — including its fallback to a selectable text field when `navigator.clipboard` fails or is unavailable (common in in-app browsers opened from SMS/email/messaging apps), and its timed success confirmation. A happy-path-only clipboard call would silently fail for exactly the users this feature targets.

**Receiving**
- R3. Opening the link (in any browser with the app loaded) shows a full-screen preview of the incoming week — same "big, single-purpose moment" pattern the app already uses for Prep Day Mode (`index.html:264-278`) — with the week name, list of meals, and their multipliers, before anything is saved to the recipient's data.
- R4. From the preview, the recipient can confirm to add it as a new week in their own My Weeks list, or dismiss without importing anything. Confirming switches the view to My Weeks with the new week selected and a brief success confirmation, so a successful import is never ambiguous with a no-op.
- R5. The imported week gets its own local identity (a freshly generated week id). It is a fully independent copy — importing never modifies, merges into, or links back to the sender's original week.

**Robustness**
- R6. The link encodes each meal's recipe id *and* its name (not just the id). On import, a meal only counts as matched when both the id and the name agree with the recipe in the recipient's local `DATA`; an id match with a name mismatch (e.g. that id now points to a different recipe) is treated the same as no match at all, closing the gap where a reused or renumbered id could otherwise silently import the wrong meal. Unmatched meals (whether due to a missing id or a name mismatch) are skipped, and the preview names each one that was skipped — not just a count — so the recipient knows exactly what's missing without asking the sender. If zero meals match, the import is blocked entirely (no empty week is created) with a message like "This link couldn't be read on this version."
- R7. If the link's data is missing, truncated, or fails to decode entirely, the app shows an explicit error state (e.g. "This link couldn't be read — ask them to resend it") rather than a blank screen, a crash, or silently doing nothing.

## Success Criteria

- A person can build a week, share a link, and have the other person land on a working, editable week — right meals, right batch multipliers — with no manual re-entry and no account, login, or backend involved.
- Reopening a stale or already-imported link requires explicit confirmation before anything is added — it never silently duplicates or corrupts the recipient's existing data.

## Scope Boundaries

- No accounts, sync, or backend of any kind. The link itself carries all the transferred data — this must keep working as a static site with no server component.
- No live/two-way sync. After import, the sender's and recipient's copies of the week are fully independent; editing one never affects the other.
- Only meals and batch multipliers travel. Personal, per-device state — ratings, hidden-meal choices, Prep Day checklist progress, "Prepped" stamps — never travels with the share, even if the sender has some of that set on the source week.
- Scoped to one week per share, not a whole-app export/backup. (A general "export/import my whole plan" feature is a plausible adjacent idea if this proves useful, but is explicitly not part of this brainstorm — noted so it isn't silently forgotten, not pursued now.)
- No editing the incoming week's contents from the preview screen. It's accept-as-is or don't import; changes happen afterward using My Weeks' existing tools (add/remove meals, adjust batches, rename).

## Key Decisions

- **Delivery is a tappable link, not a manually-typed short code.** Resolved directly with the user — the recipient just opens a link rather than copying a code into a separate import box.
- **Opening the link shows a preview and requires explicit confirmation before saving.** Chosen over silent auto-import so that reopening an old link (e.g. scrolling back in a text thread) can't accidentally duplicate a week, and so the recipient can see what they're about to get first.
- **Partial import with a visible, per-meal warning when some (but not all) recipes don't match, but a hard block when none do.** Keeps the common case (both people on the current app version) completely frictionless, degrades gracefully when versions drift on a handful of meals, and names the specific meals that were skipped rather than only a count — but a link where nothing matches produces no useful week, so it's treated as a failed import rather than an empty one.
- **The link carries each recipe's name alongside its id, and import requires both to agree.** Resolved directly with the user as a guard against the app's biggest single risk in this scheme: an id match alone can't distinguish "this recipe still means what it meant when the link was made" from "this id now points at something else." Treating an id/name mismatch as unmatched (same as a missing id) costs a few extra bytes per meal in exchange for closing that hole, rather than silently importing the wrong meal with no warning at all.
- **The preview is a full-screen takeover, mirroring Prep Day Mode's existing pattern.** Resolved directly with the user — reuses an established "big, single-purpose screen" convention already in the app rather than introducing a new modal/dialog pattern.
- **The imported week's name defaults to the sender's name but stays editable afterward.** Editing happens post-import via the same rename affordance already in My Weeks (`index.html:694`) — not during the preview itself, which is accept-as-is per Scope Boundaries. Avoids forcing an extra rename step while not locking the recipient into the sender's naming.

## Dependencies / Assumptions

- Both people load the app from the same deployed origin (currently `https://papapablano.github.io/slowcooker/`) so a shared link resolves to the same page. If a recipient's cached copy predates this feature entirely, the link is simply unrecognized — there's no way to retroactively teach an old cached page to parse a new link format. Accepted as a known limitation rather than something this feature can solve; the recipient just needs to reload to a version that has it.
- Recipe ids (`r0`, `r1`, …) plus names together serve as the join key between the encoded link and each device's local `DATA` (see R6's id+name matching). This is a mitigation, not a guarantee the ids themselves are append-only — see the deferred research question below for the underlying tooling question, which is no longer blocking now that a mismatch degrades to "unmatched" instead of "silently wrong."
- The encoded link data must survive being pasted through common text/messaging channels (SMS, iMessage, WhatsApp, email) without corruption or truncation — implies sticking to URL-safe characters. (Technical; deferred to planning.)

## Outstanding Questions

### Deferred to Planning
- [Affects R1][Technical] Where does the link's data live — query string vs. URL hash — and what's the compact encoding scheme (e.g. delimited recipe-id/name/multiplier tuples vs. JSON+base64)? A hash fragment is likely preferable since it isn't sent to a server or appear in access logs, but this is an implementation choice for planning.
- [Affects R1][Technical] Where the "Share" action lives in the UI — most likely a new button in `WeeksTab` alongside "Grocery list →" / "Start Prep Day" (`index.html:707-717`).
- [Affects R3][Technical] What should happen if someone opens a share link while mid-flow in Prep Day Mode or another disruptive state — does the preview interrupt it, or wait until they exit?
- [Affects R4][Technical] `App` loads persisted state asynchronously on mount (`index.html:181-198`) before setting a `loaded` flag. Does the import-confirm handler need to wait for `loaded === true` before writing the new week, so it can't be silently overwritten by that same load effect resolving afterward?
- [Affects R6][Needs research] Confirm how stable recipe ids are expected to be over time (append-only vs. ever reused/renumbered as recipes are added, edited, or removed via the `scripts/*.cjs` maintenance pipeline). No longer a blocking question — R6's id+name matching already guards against the worst case — but worth understanding for how often the redundancy check is expected to actually trigger in practice.

## Next Steps

-> `/ce:plan` for structured implementation planning (no `Resolve Before Planning` items — nothing blocks planning).
