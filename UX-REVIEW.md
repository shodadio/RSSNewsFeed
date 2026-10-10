# UX Review — RSSNewsFeed (NetNewsWire-style RSS reader)

**Scope:** `Sidebar`, `Timeline`, `ArticleView`, `AddFeedModal` (plus the supporting
`SwipeableArticleCard` card and `useLongPressReorder` hook that `Timeline` renders).
**Method:** source review of the actual components and a running build, at desktop and
iPhone widths.
**Severity:** **P1** = blocks a core task or risks data loss · **P2** = friction or
ambiguity · **P3** = polish.

---

## TL;DR

A polished, iOS-authentic shell with genuine power features (offline-first storage,
pull-to-refresh, reader mode, AI briefs, OPML import/export, multi-pane mobile
drill-down) that is repeatedly undermined by **hidden or irreversible interactions**
and **duplicated controls**. The core reading loop works; the seam between "iOS-style
gestures" and "desktop Web" is where users get lost. Overall heuristic score ≈ **5 / 10**.

---

## 1. Component critique

### 1.1 `Sidebar`

- **P1 — Folders can't be opened.** A folder row only toggles collapse/expand
  (`toggleFolder`). `isFolderActive()` is defined but never called, and nothing ever
  dispatches `onSelectFilter({ type: 'folder', … })` — yet `App.tsx` implements a full
  `case 'folder'` filter. The "view every article in this folder" capability is dead UI.
- **P1 — Deletion is hidden behind a gesture.** Unsubscribe lives only behind a 450 ms
  long-press or `onContextMenu`. Feeds are *also* drag-reorderable via `pointerdown` on
  the same row, so both actions are invisible on desktop and can collide.
- **P2 — Misleading status.** The header is hard-coded `"Updated Just Now"`, independent
  of the real `lastFetched` timestamp.
- **P2 — Fragmented default folder names.** One concept, three names: `Sidebar` falls back
  to `'Feeds'`, `AddFeedModal` defaults to `'Subscriptions'`, and `App.DEFAULT_FEEDS`
  uses `'Indie Mac & Swift'`.
- **P3 — Weak affordances.** The only "add" control is a floating FAB inside the sidebar
  column, overlapping rows at the bottom-right. There is no add/plus next to the
  "Subscriptions" group header, which is where people look first.

### 1.2 `Timeline` (+ `SwipeableArticleCard`)

- **P1 — Conflicting gestures on one card.** The card wires **two** long-presses: a
  450 ms press opens the action sheet (`SwipeableArticleCard`) *and* a 300 ms press
  starts drag-to-reorder (`useLongPressReorder`, attached via `onPointerDown`). They race
  on the same element, so the result depends on timing.
- **P1 — Destructive over-swipe.** Swiping left past `-ACTION_TRAY_WIDTH - 60` (> 285 px)
  **deletes instantly** with no confirmation and no undo.
- **P2 — Ambiguous icons.** The "unread only" toggle is a bare `Filter` icon whose state
  is conveyed by **color alone** (no on/off glyph, no `aria-pressed`). "Mark all as read"
  is a green `CheckCheck` that reads like "done" rather than "clear unread". Both are
  irreversible.
- **P2 — Search is scoped and sticky.** Search only walks the *current* filter
  (`filteredArticles`), and `searchQuery` is never reset when the filter changes — empty
  results are easy to misread.
- **P2 — Undocumented back gesture.** An edge-swipe-right (< 90 px start, > 60 px travel)
  duplicates the visible "Feeds" back button and fights the OS/browser back gesture.
- **P3 — Hidden reordering.** Articles can be reordered but there is no visible handle.

### 1.3 `ArticleView`

- **P1 — Toolbar overload + duplicated controls.** The top bar packs **8+ controls**
  (AI Summary, Reader View, A−/A+, Read Aloud, Star, Read, Share, Open). Then AI Summary
  reappears as an inline callout and Read Aloud reappears as a floating player bar
  (plus `MobileReaderBar` on mobile). The same action lives on two or three surfaces.
- **P2 — Icon and color collisions.** `Sparkles` means both "Reader View" and "AI";
  `Zap`/amber is reused for unrelated actions; green is used both for "success" and for
  "mark read". Users can't build a reliable icon vocabulary.
- **P2 — Read/star state is not announced.** Reading controls that change state carry no
  `aria-pressed`, and the tap targets for A−/A+ are below the 44 px touch minimum.
- **P3 — Reader-mode toggle is not remembered.** Font size and reader mode reset between
  articles, forcing repeat work.

### 1.4 `AddFeedModal`

- **P1 — Three parallel "add" flows with unequal power.** Mode tabs *Direct URL* /
  *Add Recommended* / *AI Search*. Only the Direct URL form lets you set folder, tags and
  title; **Add All (N)** and the AI results add with defaults and no review step.
- **P1 — Untitled bulk action closes itself.** "Add All (N)" adds every recommended feed
  with default folders, then auto-closes after 600 ms with no confirm and no undo.
- **P2 — The same destination is advertised twice.** The "New here? Populate your library
  → Add Recommended" banner duplicates the "Add Recommended" tab directly above it.
- **P2 — Folder vs. category, and silent precedence.** The form shows a "Folder Category"
  `<select>` and an "Or New Category" text input side by side. If both are filled the
  text input silently wins (`newFolderName || folder`), and auto-suggested categories are
  placed *above* the folder control and overwrite it on click with no explanation.
- **P3 — Two competing recommendation systems.** A hardcoded "Quick Popular Feeds" strip
  sits below the folder controls while a live, Google-grounded list lives in another tab.

### 1.5 Cross-cutting

- **Feedback depends on haptics that most users never feel.** Haptics were used as the
  dominant confirmation for tap, success and error across eleven components — invisible on
  desktop and (as shipped) disabled entirely, so status often reduces to a color change
  or a spinner.
- **Duplicated surfaces.** AI summary (toolbar + inline callout) and read-aloud (toolbar +
  floating bar + `MobileReaderBar`) each appear two to three times.

---

## 2. What would make this more intuitive (redesign plan)

1. **Make navigation truthful and complete.** Wire folder rows to
   `onSelectFilter({ type: 'folder' })` and use `isFolderActive()` for the active state;
   if folders stay non-selectable, delete the `case 'folder'` branch so the UI stops
   promising something it can't do.
2. **Adopt one observable pattern for destruction.** Never auto-delete on swipe: replace
   it with a **5-second undo toast** ("Article deleted — Undo") and add a confirm step
   before "Add All"/bulk add. Reversible actions teach confidence; silent ones teach fear.
3. **One primary action per surface.** Collapse ArticleView's toolbar to a single row
   (Star, Read, Share, Open, ⋯), move AI Summary into a "⋯ / More" menu, and render one
   read-aloud control whose state the floating bar reflects.
4. **Reshape "Add Feed" as a single search-first flow.** Open on one search field; show
   *Direct URL*, *Recommended* and *AI* as **results of the same search**, not as modes.
   Every result expands to show folder + tags before adding, so bulk add is just the
   reviewed list with everything pre-ticked.
5. **Make state visible without haptics or color alone.** Give the unread toggle a glyph
   + text and `aria-pressed`, add `aria-pressed` to Read/Star, and replace
   "Updated Just Now" with a real relative time ("Updated 4m ago").
6. **Standardize vocabulary and defaults.** Pick one default folder name and use it
   everywhere; use "folder" everywhere or "category" everywhere, not both.
7. **Respect the platform's own gestures.** Drop the custom edge-swipe-right back gesture
   in favor of the visible back control and the OS/browser gesture.
8. **Persist reading preferences.** Remember reader mode + font size per user.

---

## 3. Heuristic UX score

| Dimension | Score | Why |
|---|---|---|
| **Discoverability** | **4 / 10** | Folders aren't selectable, delete/reorder are invisible gestures, AI/read-aloud hide behind icons. |
| **Efficiency** | **7 / 10** | Pull-to-refresh, bulk add, AI brief and keyboard/growth paths are fast for power users. |
| **Clarity** | **5 / 10** | Icon/color collisions, "folder vs category", three default names for one concept. |
| **Consistency** | **5 / 10** | Duplicated surfaces (AI, read-aloud) and two recommendation systems. |
| **Error prevention** | **3 / 10** | Instant swipe-delete, autoclosing bulk add, no undo anywhere; "mark all read" irreversible. |
| **Feedback & status** | **5 / 10** | Rich spinners/timers, but status leans on now-disabled haptics and color alone. |
| **Accessibility** | **4 / 10** | Missing `aria-pressed`; small A−/A+ targets; color-only state; no focus management in modals. |
| **Learning curve** | **6 / 10** | The reading loop is obvious; the gesture layer and mode tabs are not. |
| **Overall** | **≈ 5 / 10** | A strong iOS shell whose best features are its best-kept secrets. |

---

## 4. What's already strong

Offline-first local storage, pull-to-refresh, empty states with actions, an iOS-legible
mobile drill-down animation, OPML import/export, reader mode, AI briefs, and a coherent
dark visual language. The problem is not capability — it's exposure and reversibility.

---

## 5. Top 5 highest-leverage fixes

1. Make folders selectable (or remove the dead filter).
2. Collapse duplicate AI-summary and read-aloud surfaces to one each.
3. Add undo/confirmation to every destructive action (swipe delete, mark-all-read, bulk add).
4. Surface "⋯" (long-press actions) as visible UI.
5. Replace haptics/color-only feedback with visible, accessible status.

---

## Appendix — low-value features removed in this pass

Following the review, two interaction layers were removed because they added complexity
without carrying their weight:

- **Haptics** — `src/utils/haptics.ts` plus every `triggerHaptic()` call site and the
  unused `web-haptics` dependency were deleted. Vibration is imperceptible on desktop,
  inconsistent on iOS Safari, and was already stubbed to a no-op, so it only created
  dead indirection. Status now relies on visible UI (spinners, toasts/to come).
- **Vim-style keyboard shortcuts** — the `j / k / e / m / s / u / r / o` handler in
  `App.tsx` was removed. It was undocumented, undiscoverable, and silently hijacked arrow
  keys and plain letters, conflicting with normal page scrolling and text selection.
