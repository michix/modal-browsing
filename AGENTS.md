# AGENTS.md - ModalBrowsing Development Guide

This guide is for AI coding agents working on the ModalBrowsing browser extension project.

## Project Overview

ModalBrowsing is a privacy-focused browser extension providing Vim-style keyboard navigation for web pages. It uses Chrome Extension Manifest V3 and consists of:
- **content.js** - Content script injected into pages for keyboard handling
- **background.js** - Service worker for tab management operations
- **popup.html/popup.js** - Extension popup UI
- **manifest.json** - Extension configuration

## Build & Test Commands

This is a vanilla JavaScript project with no build system. Development workflow:

```bash
# No build step required - load directly in browser

# Install in Microsoft Edge (or Chrome)
# 1. Navigate to edge://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the project directory

# Reload extension after changes
# Go to edge://extensions/ and click the reload icon

# Convert icons (if modifying icons)
magick icons/icon.svg -resize 16x16 icons/icon16.png
magick icons/icon.svg -resize 48x48 icons/icon48.png
magick icons/icon.svg -resize 128x128 icons/icon128.png

# No automated tests exist - manual testing required
# Test by loading extension and using keyboard shortcuts
```

## Code Style Guidelines

### General Principles

- **Privacy First**: Minimal permissions, no telemetry, no external requests
- **Vim Philosophy**: Modal navigation, double-key sequences (yy, gg, yf), link hints (f, F)
- **User Experience**: Visual feedback (notifications), smooth animations
- **Vanilla JS**: No frameworks, no build tools, modern ES6+ features

### File Structure

```
/
├── manifest.json       # Extension config (Manifest V3)
├── content.js         # Main keyboard handling logic
├── background.js      # Tab management service worker
├── popup.html         # Extension popup UI
├── popup.js          # Popup functionality
├── icons/            # Extension icons (16, 48, 128)
└── README.md         # User documentation
```

### JavaScript Style

**Formatting:**
- Use 2-space indentation
- Single quotes for strings
- Semicolons required
- Use `'use strict'` in IIFE wrappers

**Naming Conventions:**
- camelCase for variables and functions: `scrollStep`, `handleKeydown`
- PascalCase for classes (if used)
- UPPER_CASE for true constants: `keySequenceTimeout`
- Descriptive names: `isEditableElement()` not `checkEl()`

**Function Structure:**
```javascript
// Good: Clear function with early returns
function isEditableElement(element) {
  if (!element) return false;
  const tagName = element.tagName.toLowerCase();
  const isEditable = element.isContentEditable;
  const isInput = tagName === 'input' || tagName === 'textarea' || tagName === 'select';
  
  return isEditable || isInput;
}
```

**Async/Await:**
- Prefer async/await over promises
- Always use try/catch for error handling
```javascript
async function handleOpenNewTab(currentTab) {
  try {
    await chrome.tabs.create({
      active: true,
      index: currentTab.index + 1
    });
  } catch (error) {
    console.error('Error opening new tab:', error);
  }
}
```

### Error Handling

- Always wrap async operations in try/catch
- Log errors with descriptive messages: `console.error('Error switching tabs:', error)`
- Fail gracefully - don't break page functionality
- Show user-friendly notifications for user-facing errors

### Chrome Extension APIs

**Message Passing:**
```javascript
// Content script to background
chrome.runtime.sendMessage({ action: 'switchTab', direction: 'left' });

// Background listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'switchTab') {
    handleTabSwitch(message.direction, sender.tab);
    sendResponse({ success: true });
  }
  return true; // Required for async responses
});
```

**Chrome API Patterns:**
- Use async/await with chrome APIs
- Query tabs: `const tabs = await chrome.tabs.query({ currentWindow: true })`
- Update tabs: `await chrome.tabs.update(tabId, { active: true })`

### Key Sequence Handling

**Pattern for Double-Key Sequences (yy, gg, yf):**
```javascript
// Track last key and time
let lastKeyPressed = null;
let lastKeyTime = 0;
const keySequenceTimeout = 1000;

if (event.key === 'y' && !event.shiftKey) {
  if (lastKeyPressed === 'y' && (currentTime - lastKeyTime) < keySequenceTimeout) {
    // Second 'y' - execute action
    copyToClipboard(window.location.href);
    handled = true;
    lastKeyPressed = null;
    lastKeyTime = 0;
  } else {
    // First 'y' - wait for second
    lastKeyPressed = 'y';
    lastKeyTime = currentTime;
    handled = true;
  }
}
```

### UI & Visual Feedback

**Notifications:**
- Use the `showNotification()` helper for user feedback
- Green notifications (#4CAF50) for success
- Auto-dismiss after 2 seconds
- Animate with CSS: slideIn/slideOut

**CSS in JS:**
- Inject styles via `<style>` tag in document.head
- Namespace classes: `.modalbrowsing-hint`, `.modalbrowsing-hint-highlight`
- High z-index for overlays: `z-index: 999999`

### Documentation

**Code Comments:**
- Comment sections: `// Tab switching`, `// Page navigation`
- Explain non-obvious logic: `// Wrap around if at the beginning`
- Document helper functions with purpose comment

**Updating Documentation:**
When adding new shortcuts, update in order:
1. Implement in content.js/background.js
2. Update popup.html keybindings section
3. Update README.md keyboard shortcuts
4. Keep all three in sync

### State Management

**Content Script State:**
```javascript
let isEnabled = true;           // Extension on/off
let scrollStep = 60;            // Scroll distance
let linkHintMode = false;       // Link hint active state
let linkHints = [];             // Active link hint data
```

**Background Script State:**
```javascript
let closedTabsHistory = [];     // Last 10 closed tabs
```

Keep state minimal and at appropriate scope.

### Permissions

Current permissions in manifest.json:
- `activeTab` - Access current tab when invoked
- `storage` - Save preferences
- `tabs` - Tab management (switching, closing, reopening)
- `clipboardWrite` - Copy URLs/links

Only request new permissions if absolutely necessary for core functionality.

## Testing Checklist

Manual testing required for each change:
- [ ] Load extension in Edge developer mode
- [ ] Test on multiple sites (simple HTML, complex SPAs)
- [ ] Verify keyboard shortcuts work as expected
- [ ] Check input fields are not intercepted
- [ ] Test edge cases (empty pages, iframes)
- [ ] Verify visual feedback (notifications, hints)
- [ ] Check browser console for errors

## Common Patterns

**Adding a New Keyboard Shortcut:**
1. Add case in content.js switch statement
2. Send message to background if browser-level action needed
3. Add handler in background.js if needed
4. Update popup.html with new shortcut
5. Update README.md documentation

**Adding New Functionality:**
1. Check if permissions needed (update manifest.json)
2. Implement logic in appropriate file
3. Test thoroughly with extension reloaded
4. Update user-facing documentation
