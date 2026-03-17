# Mobile Player UX Design

Date: 2026-03-18
Project: Drive Players
Scope: Improve the mobile viewing experience so playback is clearer and common actions are easier to reach on small screens.

## Summary

The mobile player will shift from a stacked desktop-to-mobile adaptation into a mobile-first viewing flow:

- Keep the current top header pattern with the Drive URL input visible on the player page.
- Prioritize the video area and immediate playback context above the fold.
- Replace the current mobile inline sidebar behavior with a bottom-sheet video list.
- Keep the project's dark premium feel while making touch targets and spacing more comfortable.

This design intentionally avoids backend or data-flow changes. The work is limited to PHP markup, frontend behavior, and CSS responsive rules.

## Goals

- Make the active video easier to watch on phones without the list competing for vertical space.
- Make the primary mobile actions reachable with one hand.
- Preserve the current product identity and familiar top search/input flow.
- Keep folder navigation and video discovery available without feeling heavy.

## Non-Goals

- No changes to Google Drive API integration or PHP caching behavior.
- No redesign of the landing page desktop layout.
- No removal of the existing desktop sidebar pattern.
- No new account, sync, or personalization features.

## Current Problems

- On mobile, the player page still behaves like a compressed desktop stack.
- The sidebar consumes too much vertical space when visible inline.
- The current open/close behavior does not feel native to touch-first browsing.
- Header, breadcrumb, metadata, and actions compete for limited phone viewport height.

## Chosen Direction

### Layout

Use a "player first" mobile layout:

- Header remains at the top with the current Drive URL input.
- Video player appears immediately after the header.
- Video title, key metadata, and actions sit below the player in a tighter touch-friendly block.
- The video list moves into a bottom sheet instead of occupying the main page flow.

### Video List Access

Use a bottom sheet for the mobile list:

- A primary "Danh sach" trigger appears near the video action row.
- The sheet opens from the bottom with a visible drag handle.
- The sheet contains the current sidebar header context, search, folder groups, and video list.
- The active video remains clearly highlighted in the sheet.

### Navigation

- Keep the current breadcrumb concept, but compress its mobile presentation.
- Preserve the back-to-parent affordance for nested folders.
- Keep the current header search/input flow on the player page unchanged in purpose.

## UX Details

### Header

- Retain the existing header composition on mobile.
- Tighten padding and spacing to reduce height pressure.
- Continue hiding low-priority desktop-only elements such as the video count badge.

### Player Block

- Give the player stronger visual priority on phone screens.
- Reduce non-essential top spacing before the player.
- Maintain full-width playback with clean edges appropriate for small screens.

### Info Block

- Keep the title readable with slightly stronger hierarchy.
- Show essential metadata as compact badges.
- Reflow action buttons for thumb reach and touch safety.
- Ensure primary actions remain at least 44px tall/wide in touch terms.

### Bottom Sheet

- Closed state: hidden except for the explicit trigger button.
- Open state: overlays the lower portion of the viewport.
- Include a drag handle and clear visual separation from the page background.
- Allow the sheet body to scroll independently from the player page.
- Support a stable max height so the player context is not fully lost unless the user intentionally scrolls the sheet content.

### Search and List Content

- Keep the current filter input inside the bottom sheet.
- Preserve collapsible subfolder groups and active-state styling.
- Make list items slightly denser than desktop but still easy to tap.

### Landscape Mobile

- Continue prioritizing playback in short-height landscape mode.
- Minimize or suppress non-essential info when viewport height is constrained.
- Avoid forcing the bottom sheet open by default in landscape.

## Interaction Model

### Open and Close

- Tapping the "Danh sach" trigger opens the sheet.
- Tapping the close control or drag handle region can close it.
- Tapping outside the sheet on the page scrim closes it.
- Existing keyboard toggle logic may remain for non-touch use, but mobile behavior should not depend on it.

### Motion

- Use a smooth upward transition for the sheet.
- Keep motion short and responsive, aligned with the existing premium UI.
- Avoid over-animating list content or metadata.

### State Handling

- Mobile and desktop sidebar behaviors should be separated cleanly in CSS/JS.
- Desktop keeps the current sidebar layout.
- Mobile uses overlay sheet behavior instead of height-collapse inline behavior.
- Existing active video and filter logic should continue to work unchanged where possible.

## Technical Design

### Markup Changes

Update `index.php` to:

- Add a dedicated mobile bottom-sheet trigger near the video actions.
- Wrap the mobile sidebar experience with any needed overlay or sheet structure.
- Preserve existing desktop markup as much as possible to reduce regression risk.

### CSS Changes

Update `style.css` to:

- Introduce mobile-only bottom-sheet styling, overlay state, and safe spacing.
- Rework mobile header, breadcrumb, metadata, and actions for clearer hierarchy.
- Separate tablet/phone sheet behavior from desktop sidebar width behavior.
- Refine short-height landscape rules.

### JavaScript Changes

Update `app.js` to:

- Manage open/close state for the mobile bottom sheet.
- Support closing via overlay tap and explicit controls.
- Keep desktop sidebar toggling intact.
- Avoid breaking search filtering, active-item scrolling, and collapse-folder behavior.

## Risks

- Shared sidebar markup may make mobile and desktop state handling easy to entangle.
- The current toggle logic may assume a single sidebar behavior across breakpoints.
- Overlay and sheet scrolling need careful handling to prevent double-scroll issues.

## Testing Plan

- Verify player page on narrow phone widths around 360px to 430px.
- Verify tablet widths around 768px to 1024px still behave sensibly.
- Verify landscape phone height-constrained layouts.
- Verify open/close behavior of the sheet with active video, subfolders, and search filtering.
- Verify desktop layout remains unchanged in function.

## Acceptance Criteria

- On mobile, the video is visually prioritized above the list.
- The list no longer pushes major content down as an inline block on phones.
- Users can open and close the list quickly with one hand.
- The header still keeps the Drive URL input visible on the player page.
- Folder navigation, filtering, and active video indication remain functional.
