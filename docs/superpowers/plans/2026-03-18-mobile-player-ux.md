# Mobile Player UX Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the mobile player UI so the video area is clearer, actions are easier to tap, and the video list becomes a bottom sheet instead of an inline sidebar block.

**Architecture:** Keep the existing desktop player layout intact while adding a phone-only overlay sheet flow for the sidebar. Reuse the current sidebar content and filtering logic where possible, but separate phone state handling in `app.js` and responsive layout/state rules in `style.css` so small-screen behavior stops inheriting desktop assumptions while tablet widths retain the current stacked inline layout.

**Tech Stack:** PHP 7.4+, vanilla JavaScript, CSS, Plyr.io

---

## File Map

- Modify: `index.php`
  Purpose: add mobile-only bottom-sheet trigger and overlay structure while preserving existing desktop markup.
- Modify: `app.js`
  Purpose: separate desktop sidebar state from mobile bottom-sheet state, including open/close behavior, overlay dismiss, and mobile-safe active-item scrolling.
- Modify: `style.css`
  Purpose: add mobile bottom-sheet styling, improve mobile spacing/hierarchy around the player, and preserve desktop behavior.

## Breakpoint Contract

- `> 1024px`: keep the current desktop sidebar behavior.
- `769px - 1024px`: keep the current tablet stacked layout with inline sidebar behavior; only spacing polish is allowed here.
- `<= 768px`: enable the new phone bottom-sheet behavior.
- `max-height: 500px` landscape: keep the existing row-oriented landscape priority, but allow the phone sheet to overlay when width is also `<= 768px`.

## Task 1: Update Player Markup For Mobile Sheet Controls

**Files:**
- Modify: `index.php`

- [ ] **Step 1: Inspect the current player markup and identify the smallest safe insertion points**

Read:
- `index.php` around the `.player-layout`, `.video-info`, and `.sidebar` sections

Confirm:
- where the existing floating sidebar button is rendered
- where the video action row is rendered
- where the sidebar begins and ends

- [ ] **Step 2: Add a phone-only list trigger in a location that also works without `.video-actions`**

Add a new button in `index.php` immediately after the video container and before `.video-info`, wrapped so it can render both when a current video exists and when the page is in a folder-only state:

```php
<?php if (!empty($videos) || !empty($subfolders)): ?>
<div class="mobile-sheet-trigger-row">
    <button
        class="btn-action btn-mobile-sheet-trigger"
        id="mobile-sheet-trigger"
        type="button"
        aria-controls="sidebar"
        aria-expanded="false"
    >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="8" y1="6" x2="21" y2="6"></line>
            <line x1="8" y1="12" x2="21" y2="12"></line>
            <line x1="8" y1="18" x2="21" y2="18"></line>
            <line x1="3" y1="6" x2="3.01" y2="6"></line>
            <line x1="3" y1="12" x2="3.01" y2="12"></line>
            <line x1="3" y1="18" x2="3.01" y2="18"></line>
        </svg>
        <span>Danh sách</span>
    </button>
</div>
<?php endif; ?>
```

- [ ] **Step 3: Add mobile sheet overlay helpers around the sidebar**

Add markup near the existing `.player-layout` / `.sidebar` structure:

```php
<button
    class="mobile-sheet-backdrop"
    id="mobile-sheet-backdrop"
    type="button"
    aria-label="Đóng danh sách"
    tabindex="-1"
></button>
```

Add a small handle/header region inside the sidebar before the existing `.sidebar-header`:

```php
<div class="mobile-sheet-handle" id="mobile-sheet-handle" aria-hidden="true">
    <span class="mobile-sheet-grip"></span>
</div>
```

Preserve the existing sidebar content tree so filtering and active-item markup stay reusable.

- [ ] **Step 4: Ensure control elements use safe button semantics and deterministic accessibility state**

Verify the new trigger and backdrop include:
- `type="button"`
- stable `id` values used by JavaScript
- labels that remain meaningful for screen readers
- `aria-controls="sidebar"` and `aria-expanded` on the trigger

Ensure the sidebar gets a stable label target such as:

```php
<aside class="sidebar" id="sidebar" aria-labelledby="sidebar-title">
```

Add the matching ID to the existing heading:

```php
<h2 class="sidebar-title" id="sidebar-title">
```

- [ ] **Step 5: Review generated markup for desktop regressions**

Manual check in `index.php`:
- desktop-only floating open button still exists
- sidebar markup still wraps the same searchable list
- no duplicate IDs were introduced
- the phone trigger still appears for folder-only / no-current-video states when list content exists

- [ ] **Step 6: Do not commit yet**

Keep changes unstaged until the full feature passes verification.

## Task 2: Split Sidebar Behavior Between Desktop And Mobile

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Read the current sidebar toggle implementation**

Read:
- `app.js` around `initSidebarToggle()`
- `app.js` around `scrollToActiveVideo()`
- `app.js` around keyboard shortcut handling

Note the current assumptions:
- one `sidebar-closed` state for all breakpoints
- one toggle button reused by desktop and mobile
- active item scrolling runs against the whole document

- [ ] **Step 2: Write a breakpoint-aware sidebar controller**

Refactor `initSidebarToggle()` so it:
- detects phone layout with `window.matchMedia('(max-width: 768px)')`
- uses a phone-specific open state class such as `mobile-sheet-open`
- preserves the existing desktop `sidebar-closed` behavior and `SIDEBAR_KEY`

Implementation shape:

```javascript
const phoneQuery = window.matchMedia('(max-width: 768px)');

function isPhoneLayout() {
    return phoneQuery.matches;
}
```

- [ ] **Step 3: Wire the phone trigger, sidebar close button, floating open button, and backdrop**

Support these interactions in `app.js`:
- `#mobile-sheet-trigger` opens the sheet on mobile
- `#mobile-sheet-backdrop` closes the sheet on mobile
- `#mobile-sheet-handle` closes the sheet on phone tap
- existing `#sidebar-toggle-btn` closes the sheet on phone but still toggles width state on desktop/tablet
- existing `#sidebar-open-btn` remains desktop-only and must not become part of phone behavior

Expected class handling:

```javascript
document.body.classList.add('mobile-sheet-open');
layout.classList.add('mobile-sheet-open');
```

- [ ] **Step 4: Add accessibility state updates and focus behavior**

When the phone sheet opens:
- set trigger `aria-expanded="true"`
- move focus to `#filter-input` if it exists, otherwise `#sidebar-toggle-btn`

When the phone sheet closes:
- set trigger `aria-expanded="false"`
- return focus to `#mobile-sheet-trigger` when close was initiated from keyboard or `Escape`

- [ ] **Step 5: Add cleanup on breakpoint changes**

On breakpoint changes:
- remove `mobile-sheet-open` classes when moving to desktop
- restore desktop icon/title state from saved localStorage
- avoid leaving the backdrop active after resizing
- clear body scroll lock classes when leaving phone width

- [ ] **Step 6: Add body scroll lock and deterministic `Escape` behavior**

When the phone sheet is open:
- apply a body class such as `mobile-sheet-lock`
- prevent page scrolling behind the sheet

In keyboard handling:
- if `Escape` is pressed while the phone sheet is open, close the sheet and stop there
- otherwise keep the existing blur behavior

- [ ] **Step 7: Update active-item scrolling for the sheet**

Adjust `scrollToActiveVideo()` to:
- scroll within `.sidebar` / `.video-list` when on phone
- avoid forcing the entire page to jump unexpectedly

Suggested shape:

```javascript
activeItem.scrollIntoView({
    behavior: 'smooth',
    block: isPhoneLayout() ? 'nearest' : 'center'
});
```

- [ ] **Step 8: Keep keyboard shortcuts non-breaking**

Verify:
- `b` still works on desktop
- `b` opens/closes the phone sheet when on phone
- `/` still focuses the filter input when the sheet is open
- `Escape` closes the mobile sheet before only blurring inputs

- [ ] **Step 9: Run a syntax sanity check for JavaScript**

Run:

```bash
node --check app.js
```

Expected:
- command exits with code `0`

- [ ] **Step 10: Do not commit yet**

Keep changes unstaged until the full feature passes verification.

## Task 3: Redesign Mobile CSS Around A Player-First Layout

**Files:**
- Modify: `style.css`

- [ ] **Step 1: Read the existing player, sidebar, and mobile media-query sections**

Read:
- `style.css` around `.player-layout`, `.player-main`, `.video-info`, `.video-actions`, `.sidebar`
- all responsive blocks from `@media (max-width: 1024px)` through the landscape rules

Identify styles that currently force the sidebar into the document flow on mobile.

- [ ] **Step 2: Add base styles for the mobile sheet helpers**

Add default hidden styles outside media queries for:
- `.mobile-sheet-backdrop`
- `.mobile-sheet-handle`
- `.mobile-sheet-grip`
- `.btn-mobile-sheet-trigger`

These should not affect desktop rendering.

- [ ] **Step 3: Rework the tablet/phone layout rules to prioritize the player**

Update the responsive CSS so that:
- on `769px - 1024px`, `.player-layout` remains column-based with inline sidebar behavior preserved
- on `<= 768px`, the phone layout gets the stronger player-first spacing and sheet behavior
- `.player-main` keeps the first visual priority
- `.breadcrumb`, `.video-info`, `.video-meta`, and `.video-actions` use tighter spacing
- the player remains visually prominent without the inline sidebar block pushing down content

- [ ] **Step 4: Convert the sidebar into a bottom sheet on phones only**

In the `@media (max-width: 768px)` rules:
- make `.sidebar` fixed to the viewport bottom
- give it a rounded top edge, independent scrolling, and capped height
- hide it by default with translate/opacity/pointer-events
- reveal it via `.mobile-sheet-open`
- add `overscroll-behavior: contain` so the sheet absorbs scroll cleanly

Implementation targets:

```css
.sidebar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    transform: translateY(calc(100% - 88px));
}

.mobile-sheet-open .sidebar {
    transform: translateY(0);
}
```

Adjust the exact closed transform so the full sheet stays hidden if the design no longer uses a persistent peek state.

- [ ] **Step 5: Add backdrop, scroll lock, and z-index layering**

Create styles so:
- the backdrop covers the viewport behind the sheet
- the sheet sits above player content
- the header remains visually consistent and does not layer above an open sheet unintentionally
- `body.mobile-sheet-lock` disables page scrolling while the phone sheet is open
- sheet content uses `overscroll-behavior` to prevent background scroll chaining

- [ ] **Step 6: Improve mobile touch targets and hierarchy**

Update CSS for:
- `.btn-action`
- `.sidebar-header`
- `.filter-input`
- `.video-item`
- `.collapse-folder-header`

Targets:
- minimum comfortable tap area
- clearer active-state contrast
- less cramped metadata and buttons

- [ ] **Step 7: Scope all new bottom-sheet selectors to phone rules or explicit state classes**

Place new bottom-sheet layout selectors:
- inside `@media (max-width: 768px)`, or
- behind explicit classes such as `.mobile-sheet-open` / `.mobile-sheet-lock`

Do not rewrite desktop selectors such as:
- `.player-layout.sidebar-closed .sidebar`
- `.player-layout.sidebar-closed .player-main`
- `.sidebar-open-btn`

- [ ] **Step 8: Preserve desktop behavior**

Ensure desktop-only behavior still uses:
- width-based sidebar layout
- floating reopen button
- existing `sidebar-closed` classes

Do not let `.mobile-sheet-open` rules leak into desktop breakpoints.

- [ ] **Step 9: Refine short-height landscape behavior explicitly**

Update the landscape mobile rule set so:
- widths above `768px` keep the current row layout and inline sidebar behavior
- widths `<= 768px` keep player-first landscape layout while allowing the phone sheet to overlay
- excessive metadata is reduced if space is constrained

- [ ] **Step 10: Run a CSS sanity pass**

Manually inspect for:
- duplicate or conflicting mobile sidebar selectors
- stale `max-height` collapse rules that fight the new sheet behavior
- hidden controls that accidentally remain hidden on desktop

- [ ] **Step 11: Do not commit yet**

Keep changes unstaged until the full feature passes verification.

## Task 4: Verify Mobile And Desktop Regressions

**Files:**
- Modify: `index.php`
- Modify: `app.js`
- Modify: `style.css`

- [ ] **Step 1: Run PHP syntax checks for touched PHP files**

Run:

```bash
php -l index.php
```

Expected:
- `No syntax errors detected in index.php`

- [ ] **Step 2: Re-run JavaScript syntax validation**

Run:

```bash
node --check app.js
```

Expected:
- command exits with code `0`

- [ ] **Step 3: Manually test mobile player behavior in a browser**

Verify at phone widths:
- header still shows the Drive URL input
- video appears before the list content
- tapping `Danh sách` opens the bottom sheet
- tapping the backdrop, handle, or close control closes the sheet
- `Escape` closes the sheet and returns focus appropriately
- filter input still works
- active video remains highlighted and visible
- page scroll does not move behind the sheet
- the sheet still opens on folder-only / no-current-video states when list content exists

- [ ] **Step 4: Manually test resize and state-transition cases**

Verify:
- resizing from phone to tablet/desktop while the sheet is open clears overlay state
- resizing from desktop/tablet to phone does not leave stale `sidebar-closed` visuals
- active-item scrolling behaves correctly when the sheet starts closed vs open

- [ ] **Step 5: Manually test content-variant cases**

Verify:
- page with only root videos
- page with only subfolders
- page with both root videos and subfolders

- [ ] **Step 6: Manually test desktop and tablet regression cases**

Verify at desktop and tablet widths:
- sidebar still appears inline beside the player
- floating reopen button still works when the sidebar is closed
- keyboard shortcut `b` still toggles the sidebar
- search and collapse-folder interactions still work
- tablet widths do not unexpectedly get the phone sheet behavior

- [ ] **Step 7: Review the final diff for accidental behavior drift**

Run:

```bash
git diff -- index.php app.js style.css
```

Confirm:
- no backend logic changed
- no unnecessary desktop visual rewrites slipped in
- mobile-only classes remain clearly named

- [ ] **Step 8: Commit verification-complete implementation**

Run:

```bash
git add index.php app.js style.css
git commit -m "feat: improve mobile player usability"
```
