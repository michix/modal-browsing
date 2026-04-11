# AGENTS.md - ModalBrowsing Development Guide

Guide for AI coding agents working on this Chrome/Edge browser extension (Manifest V3).
Vim-style modal keyboard navigation for web pages. Privacy-focused, zero telemetry.

## Project Structure

```
manifest.json       # Extension config (Manifest V3, version managed by release.sh)
content.js          # Content script: keyboard handling, link hints, search, omnibar, UI
background.js       # Service worker: tab ops, message handling, omnibar search
popup.html          # Extension popup with toggle + shortcut reference (inline CSS)
popup.js            # Popup toggle logic
icons/              # icon.svg source + generated PNGs (16, 48, 128)
package.sh          # ZIP packaging for distribution
release.sh          # Version bump, git tag, ZIP release automation
```

## Build & Test Commands

No build system, no package.json, no linter, no test framework. Vanilla JS loaded directly.

```bash
# Load extension: edge://extensions/ → Developer mode → Load unpacked → select repo dir
# Reload after changes: click reload icon on edge://extensions/

# Generate icons from SVG (requires ImageMagick)
magick icons/icon.svg -resize 16x16 icons/icon16.png
magick icons/icon.svg -resize 48x48 icons/icon48.png
magick icons/icon.svg -resize 128x128 icons/icon128.png

# Package for distribution
bash package.sh

# Release (bumps manifest version, commits, tags, packages)
bash release.sh <version>   # e.g. bash release.sh 1.3.0
```

No automated tests exist. All testing is manual:
- Load extension in Edge/Chrome developer mode
- Test keyboard shortcuts on multiple sites (simple HTML, complex SPAs)
- Verify input fields are not intercepted (type in forms, contenteditable)
- Check browser console (F12) for errors
- Test edge cases: empty pages, iframes, pages with many links

## Code Style

### Formatting
- 2-space indentation
- Single quotes for strings
- Semicolons required
- `'use strict'` inside IIFE wrapper (content.js is wrapped in `(function() { ... })()`)
- background.js is module-level (no IIFE), uses top-level async functions

### Naming
- `camelCase` for variables and functions: `scrollStep`, `handleKeydown`, `isEditableElement`
- `UPPER_CASE` for timeout constants: `keySequenceTimeout`
- Descriptive names over abbreviations: `isEditableElement()` not `checkEl()`
- CSS classes namespaced with `modalbrowsing-` prefix: `.modalbrowsing-hint`, `.modalbrowsing-search-bar`

### Functions
- Early returns for guard clauses
- `async/await` over raw promises
- Always `try/catch` around async/chrome API operations
- Log errors with context: `console.error('Error switching tabs:', error)`

### Error Handling
- Wrap all chrome API calls in try/catch
- Never break page functionality on errors — fail silently or show notification
- User-facing errors use `showNotification()` in content.js
- Background script sends `{ success: false, notify: '...' }` responses on failure

### State Management
- Minimal module-scoped state variables at top of each file
- content.js state: `isEnabled`, `scrollStep`, `linkHintMode`, `linkHints`, `hintInput`, search state, omnibar state, group picker state, help overlay state
- background.js state: `closedTabsHistory` (array, max 10 entries)
- No shared state between files — communicate via `chrome.runtime.sendMessage`

## Architecture Patterns

### Message Passing (content ↔ background)
```javascript
// Content script → background
chrome.runtime.sendMessage({ action: 'switchTab', direction: 'left' });

// Background handler (always return true for async)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'switchTab') {
    handleTabSwitch(message.direction, sender.tab);
    sendResponse({ success: true });
  }
  return true;
});
```

Message actions: `switchTab`, `openNewTab`, `closeTab`, `reopenTab`, `moveTabLeft`,
`moveTabRight`, `omnibarSearch`, `omnibarSwitchTab`, `omnibarOpenUrl`, `getTabGroups`,
`moveTabToGroup`, `createGroupAndMoveTab`, `toggleEnabled`, `getStatus`

### Key Sequence Handling (yy, gg, yf, gt)
Uses `lastKeyPressed` + `lastKeyTime` with 1-second timeout. First key stores state,
second key within timeout executes the action and resets state.

### Link Hints System
Three modes triggered by different keys:
- `f` → click mode (click/focus element)
- `F` → newtab mode (open link in new tab)
- `yf` → copy mode (copy link URL)

Labels generated as `a-z` for ≤26 elements, `a-z` then `aa-zz` for more.
Typed prefix is highlighted in matched hints; non-matching hints dim to 30% opacity.

### UI Components (all in content.js)
- **Notifications**: fixed bottom-right, auto-dismiss 1.5s, slide animation
- **Search bar**: fixed top bar with `/` prefix, live search, smart case
- **Omnibar** (`o`): centered modal for tab search / URL entry
- **Group picker** (`gt`): centered modal for tab group management
- **Help overlay** (`?`): centered modal with all shortcuts
- **Link hints**: absolutely positioned labels over clickable elements

All UI uses injected `<style>` in document.head. Z-index: 999999 for UI, 999998 for overlays.

### CSS Class Conventions
- `.modalbrowsing-hint` — link hint label
- `.modalbrowsing-hint-matched` — typed character highlight in hint
- `.modalbrowsing-hint-highlight` — outline on hinted element
- `.modalbrowsing-search-*` — search bar and highlights
- `.modalbrowsing-omnibar*` — omnibar components
- `.modalbrowsing-grouppicker*` — group picker components
- `.modalbrowsing-help*` — help overlay components

## Permissions (manifest.json)

- `activeTab` — access current tab when invoked
- `storage` — save preferences
- `tabs` — tab management (switch, close, reopen, move, query)
- `clipboardWrite` — copy URLs/links
- `tabGroups` — tab group management

Only add new permissions if absolutely necessary for core functionality.

## When Adding Features

### New Keyboard Shortcut
1. Add handling in `handleKeydown()` in content.js (key sequences before switch, single keys in switch)
2. If browser-level action needed, send message to background.js and add handler there
3. Update the `shortcuts` array in `openHelp()` in content.js
4. Update the keybindings section in popup.html
5. Update keyboard shortcuts in README.md
6. Keep all four locations in sync

### New UI Component
1. Add CSS classes (namespaced `modalbrowsing-`) in the injected `<style>` block
2. Add state variables at module scope
3. Implement open/close/render functions following existing patterns
4. Handle Escape key dismissal in `handleKeydown()`
5. Clean up DOM elements in close function
