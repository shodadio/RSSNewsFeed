# NetNewsWire Web - iPhone 13 & Mobile-First UX Optimization Plan

## User Review & Critical Decisions

> [!IMPORTANT]
> **Keyboard Shortcuts Revision**: You noted that the app will primarily be used on an **iPhone 13** and asked if keyboard shortcuts are strictly needed. 
> **Decision**: We will keep basic keyboard shortcuts (`j`/`k`, `m`, `s`) as passive background listeners for desktop/iPad users with zero UI overhead, but **eliminate the standalone keyboard shortcuts modal/cheat-sheet**. 
> Instead, 100% of the UI and interaction design focus shifts to **maximizing utility, speed, and comfort on the iPhone 13 (390×844pt screen)**.

---

## 1. iPhone 13 Ergonomics & Key Enhancements

### A. One-Handed Natural Thumb Zone Navigation
- **Current problem**: On mobile, reaching top navigation buttons (Back, Filter, Mark as Read, Action icons) requires awkward finger stretching into the "Hard Reach Zone" (top 30% of screen).
- **Mobile Solution**:
  - **Reader Bottom Quick Bar**: In mobile Reader mode, provide a dedicated sticky bottom action bar (anchored in the natural thumb zone with `pb-safe`) housing:
    - **Previous Article (←)** & **Next Article (→)** for seamless one-handed reading progression.
    - **Star / Favorite (★)** toggle with instant haptic pulse.
    - **Mark Unread (●)** toggle.
    - **Share & Reader settings (Aa / Margin)** trigger.
  - **Swipe Gestures**:
    - Edge-swipe right to pop back to Timeline with fluid transition.
    - Horizontal swipe on article reader to advance to next/previous article.

### B. Mobile Reader Pane Layout & Typography Controls
- **Estimated Reading Time**:
  - Dynamically compute reading duration (e.g. `3 min read`) based on body word count.
  - Displayed inline in the article header below the title in clean, quiet typography (`· 3 min read`).
- **Reading Measure & Ergonomics**:
  - Mobile reading width: optimized margin options (Compact `px-4`, Relaxed `px-6`) with no horizontal clipping.
  - Line-height / leading controls (`leading-relaxed` vs `leading-loose`) to enhance eye-tracking on high-DPI OLED iPhone screens.
  - Responsive font scale (16px base, easily stepped up to 18px or 20px) preventing iOS Safari auto-zoom.

### C. Touch Target Hitboxes & Safe Area Padding (`pb-safe`)
- **44×44pt Touch Targets**: All action buttons, back chevrons, close icons, and filter tabs conform to Apple HIG touch target guidelines ($\ge 44\times 44\text{px}$).
- **Safe Area Insets**: Full support for iOS notch / dynamic island and home indicator bar (`env(safe-area-inset-bottom)` and `env(safe-area-inset-top)`).
- **Smooth Pull-to-Refresh & List Snapping**: Haptic-assisted pull-to-refresh at the top of the Timeline, with tactile resistance.

### D. Actionable Zero & Empty States
- When all articles are caught up in the "Today" or "Unread" tab:
  - Display an aesthetic Apple-styled calm state ("All Caught Up").
  - Provide a one-tap thumb-friendly button to switch to "All Articles" or "Starred" without reaching for the top hamburger menu.

---

## 2. Architecture & Mobile Screen States

```
┌─────────────────────────────────────────────────────────┐
│                    iPhone 13 Viewport                   │
├─────────────────────────────────────────────────────────┤
│ Top App Bar (Sticky, 52px)                              │
│ [← Back]           Article / Feed Title        [Share]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│                                                         │
│                 SCROLLABLE CONTENT AREA                 │
│                                                         │
│  • Article Title (text-2xl font-serif text-balance)     │
│  • Metadata: Feed name · Today · 3 min read             │
│  • Clean article body / Reader View                     │
│  • High-contrast legibility, no pills                   │
│                                                         │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ Mobile Bottom Quick-Action Bar (Sticky, Natural Thumb)  │
│ [← Prev]    [★ Star]    [● Read]    [Aa Format] [Next →]│
│ ─────────────────────────────────────────────────────── │
│                      Home Indicator Bar                 │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Implementation Steps

1. **Mobile Bottom Action Bar (`MobileReaderBar.tsx` / `ArticleView.tsx`)**:
   - Provide an ergonomic bottom action bar when on mobile viewports (`isMobile`).
   - Wire up: Prev Article, Next Article, Toggle Star, Toggle Read, and Reader Layout controls.
   - Respect iOS `pb-safe` (`padding-bottom: env(safe-area-inset-bottom, 16px)`).
2. **Estimated Reading Time & Typography Controls**:
   - Add word-count based reading time calculator in `ArticleView.tsx`.
   - Add quick reader formatting sheet (Font family, size, line-height, margin).
   - Store formatting in `localStorage` under `nnw_reader_prefs`.
3. **Timeline Mobile Empty State & Thumb Actions**:
   - Upgrade Timeline empty states with thumb-friendly buttons.
   - Ensure pull-to-refresh has proper touch dampening on iOS WebKit.
4. **Touch Target Auditing**:
   - Audit all icon buttons in `Sidebar.tsx`, `Timeline.tsx`, and `ArticleView.tsx` to ensure `min-w-[44px] min-h-[44px]`.

---

## 4. Verification & Testing
- [ ] Inspect mobile layout at 390px (iPhone 13/14/15 width).
- [ ] Test bottom action bar navigation: previous/next article cycling works fluidly.
- [ ] Test star and mark-as-read toggles from bottom bar.
- [ ] Verify calculated reading time appears cleanly in the article header.
- [ ] Test safe-area padding at screen bottom on mobile viewport.
- [ ] Verify compilation and lint pass cleanly (`compile_applet`, `lint_applet`).
