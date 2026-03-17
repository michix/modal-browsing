// ModalBrowsing Content Script
// Provides keyboard-based navigation with minimal permissions

(function() {
  'use strict';

  let isEnabled = true;
  let scrollStep = 60;
  let scrollStepLarge = 300;
  let lastKeyPressed = null;
  let lastKeyTime = 0;
  const keySequenceTimeout = 1000; // 1 second timeout for key sequences
  
  // Link hints state
  let linkHintMode = false;
  let linkHints = [];
  let hintInput = '';

  // Search state
  let searchMode = false;
  let searchQuery = '';
  let searchMatches = [];
  let currentMatchIndex = -1;
  let searchOverlay = null;

  // Check if we're in an input field
  function isEditableElement(element) {
    if (!element) return false;
    const tagName = element.tagName.toLowerCase();
    const isEditable = element.isContentEditable;
    const isInput = tagName === 'input' || tagName === 'textarea' || tagName === 'select';
    const role = (element.getAttribute('role') || '').toLowerCase();
    const isRoleEditable = role === 'textbox' || role === 'combobox' || role === 'searchbox';
    
    return isEditable || isInput || isRoleEditable;
  }

  // Get all clickable elements
  function getClickableElements() {
    const selector = 'a, button, input, textarea, select, [role="button"], [role="textbox"], [role="combobox"], [role="searchbox"], [contenteditable="true"], [onclick]';
    return Array.from(document.querySelectorAll(selector))
      .filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && 
               rect.top < window.innerHeight && rect.bottom > 0;
      });
  }

  // Smooth scroll helper
  function smoothScroll(x, y) {
    window.scrollBy({
      top: y,
      left: x,
      behavior: 'smooth'
    });
  }

  // Copy to clipboard helper
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      // Visual feedback
      showNotification('URL copied to clipboard');
      return true;
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      return false;
    }
  }

  // Show temporary notification
  function showNotification(message) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      bottom: 16px;
      right: 16px;
      background: rgba(50, 50, 50, 0.85);
      color: #e0e0e0;
      padding: 8px 14px;
      border-radius: 4px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      z-index: 999999;
      box-shadow: 0 1px 4px rgba(0,0,0,0.15);
      animation: slideIn 0.2s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.2s ease-out';
      setTimeout(() => notification.remove(), 200);
    }, 1500);
  }

  // Add CSS animations
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
    .modalbrowsing-hint {
      position: absolute;
      background: #FFD700;
      color: #000;
      font-family: monospace;
      font-size: 12px;
      font-weight: bold;
      padding: 2px 6px;
      border: 2px solid #FF8C00;
      border-radius: 3px;
      z-index: 999999;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      pointer-events: none;
      text-transform: lowercase;
    }
    .modalbrowsing-hint-highlight {
      outline: 2px solid #FFD700 !important;
      outline-offset: 2px;
    }
    .modalbrowsing-search-bar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 999999;
      display: flex;
      align-items: center;
      background: #1e1e1e;
      border-bottom: 1px solid #444;
      padding: 6px 12px;
      font-family: monospace;
      font-size: 14px;
      color: #e0e0e0;
    }
    .modalbrowsing-search-bar span {
      margin-right: 6px;
      color: #aaa;
    }
    .modalbrowsing-search-bar input {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: #e0e0e0;
      font-family: monospace;
      font-size: 14px;
    }
    .modalbrowsing-search-bar .modalbrowsing-search-count {
      margin-left: 12px;
      color: #888;
      font-size: 12px;
    }
    .modalbrowsing-search-highlight {
      background: #FFD700 !important;
      color: #000 !important;
      border-radius: 1px;
    }
    .modalbrowsing-search-current {
      background: #FF8C00 !important;
      color: #000 !important;
      border-radius: 1px;
    }
    .modalbrowsing-omnibar-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.4);
      z-index: 999998;
    }
    .modalbrowsing-omnibar {
      position: fixed;
      top: 80px;
      left: 50%;
      transform: translateX(-50%);
      width: 560px;
      max-width: 90vw;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      background: #1e1e1e;
      border: 1px solid #444;
      border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      overflow: hidden;
    }
    .modalbrowsing-omnibar input {
      width: 100%;
      box-sizing: border-box;
      padding: 12px 16px;
      background: #1e1e1e;
      border: none;
      border-bottom: 1px solid #333;
      outline: none;
      color: #e0e0e0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 15px;
    }
    .modalbrowsing-omnibar input::placeholder {
      color: #666;
    }
    .modalbrowsing-omnibar-results {
      max-height: 360px;
      overflow-y: auto;
    }
    .modalbrowsing-omnibar-item {
      display: flex;
      align-items: center;
      padding: 8px 16px;
      cursor: pointer;
      color: #ccc;
      gap: 10px;
    }
    .modalbrowsing-omnibar-item:hover,
    .modalbrowsing-omnibar-item.selected {
      background: #2a2d32;
    }
    .modalbrowsing-omnibar-item .omni-badge {
      flex-shrink: 0;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      padding: 2px 6px;
      border-radius: 3px;
      letter-spacing: 0.5px;
    }
    .modalbrowsing-omnibar-item .omni-badge.tab {
      background: #264f78;
      color: #7cb7ff;
    }
    .modalbrowsing-omnibar-item .omni-badge.url {
      background: #2e3e2e;
      color: #6abf6a;
    }
    .modalbrowsing-omnibar-item .omni-text {
      flex: 1;
      min-width: 0;
      overflow: hidden;
    }
    .modalbrowsing-omnibar-item .omni-title {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 13px;
      color: #e0e0e0;
    }
    .modalbrowsing-omnibar-item .omni-url {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 11px;
      color: #777;
      margin-top: 1px;
    }
    .modalbrowsing-omnibar-empty {
      padding: 16px;
      text-align: center;
      color: #666;
      font-size: 13px;
    }
  `;
  document.head.appendChild(style);

  // Generate hint labels (a, b, c, ..., z, aa, ab, ...)
  function generateHintLabels(count) {
    const labels = [];
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    
    if (count <= 26) {
      // Single letters are enough
      for (let i = 0; i < count; i++) {
        labels.push(chars[i]);
      }
    } else {
      // Need two letters
      for (let i = 0; i < count; i++) {
        if (i < 26) {
          labels.push(chars[i]);
        } else {
          const first = Math.floor((i - 26) / 26);
          const second = (i - 26) % 26;
          labels.push(chars[first] + chars[second]);
        }
      }
    }
    
    return labels;
  }

  // Show link hints
  function showLinkHints(mode = 'click') {
    // Get all clickable elements (links, buttons, etc.)
    const elements = getClickableElements();
    
    if (elements.length === 0) {
      showNotification('No clickable elements found on page');
      return;
    }

    const labels = generateHintLabels(elements.length);
    linkHints = [];
    
    elements.forEach((element, index) => {
      const rect = element.getBoundingClientRect();
      const hint = document.createElement('div');
      hint.className = 'modalbrowsing-hint';
      hint.textContent = labels[index];
      hint.style.left = (rect.left + window.scrollX) + 'px';
      hint.style.top = (rect.top + window.scrollY) + 'px';
      
      document.body.appendChild(hint);
      element.classList.add('modalbrowsing-hint-highlight');
      
      // Get URL for links, null for buttons
      const url = element.tagName.toLowerCase() === 'a' ? element.href : null;
      
      linkHints.push({
        label: labels[index],
        element: element,
        hint: hint,
        url: url,
        mode: mode
      });
    });
    
    linkHintMode = true;
    hintInput = '';
    const modeText = mode === 'copy' ? 'Copy URL' : (mode === 'newtab' ? 'Open in new tab' : 'Open link');
    showNotification(`${modeText} mode (${elements.length} elements) - Press letters or Esc to cancel`);
  }

  // Clear link hints
  function clearLinkHints() {
    linkHints.forEach(({ hint, element }) => {
      hint.remove();
      element.classList.remove('modalbrowsing-hint-highlight');
    });
    linkHints = [];
    linkHintMode = false;
    hintInput = '';
  }

  // Handle hint input
  function handleHintInput(key) {
    hintInput += key.toLowerCase();
    
    // Filter matching hints
    const matches = linkHints.filter(hint => hint.label.startsWith(hintInput));
    
    if (matches.length === 0) {
      // No matches, reset
      hintInput = '';
      return;
    }
    
    if (matches.length === 1 && matches[0].label === hintInput) {
      // Exact match - perform action based on mode
      const match = matches[0];
      if (match.mode === 'copy') {
        // Copy mode - only works for links with URLs
        if (match.url) {
          copyToClipboard(match.url);
        } else {
          showNotification('Cannot copy: not a link');
        }
      } else if (match.mode === 'newtab') {
        // Open in new tab - for links, open URL; for buttons, just click
        if (match.url) {
          window.open(match.url, '_blank');
        } else {
          match.element.click();
          if (isEditableElement(match.element)) match.element.focus();
        }
      } else {
        // Click mode - works for all elements (links, buttons, etc.)
        match.element.click();
        if (isEditableElement(match.element)) match.element.focus();
      }
      clearLinkHints();
      return;
    }
    
    // Update visual feedback - dim non-matching hints
    linkHints.forEach(({ hint, label }) => {
      if (!label.startsWith(hintInput)) {
        hint.style.opacity = '0.3';
      } else {
        hint.style.opacity = '1';
      }
    });
  }

  // --- Search / Find on page ---

  // Open the search bar
  function openSearchBar() {
    if (searchOverlay) return; // already open
    searchMode = true;

    searchOverlay = document.createElement('div');
    searchOverlay.className = 'modalbrowsing-search-bar';

    const label = document.createElement('span');
    label.textContent = '/';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Search...';
    input.value = searchQuery; // restore previous query if any

    const count = document.createElement('span');
    count.className = 'modalbrowsing-search-count';
    count.textContent = '';

    searchOverlay.appendChild(label);
    searchOverlay.appendChild(input);
    searchOverlay.appendChild(count);
    document.body.appendChild(searchOverlay);

    input.focus();

    // Live search as user types
    input.addEventListener('input', () => {
      searchQuery = input.value;
      performSearch(searchQuery);
      updateSearchCount(count);
    });

    // Handle Enter (next), Shift+Enter (prev), Escape (close) inside the input
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeSearchBar(false); // keep highlights so n/N can navigate
        e.preventDefault();
        e.stopPropagation();
      } else if (e.key === 'Enter') {
        if (e.shiftKey) {
          navigateSearch(-1);
        } else {
          navigateSearch(1);
        }
        updateSearchCount(count);
        e.preventDefault();
      }
    });
  }

  // Close the search bar
  function closeSearchBar(clearHighlightsFlag) {
    searchMode = false;
    if (searchOverlay) {
      searchOverlay.remove();
      searchOverlay = null;
    }
    if (clearHighlightsFlag) {
      clearSearchHighlights();
      searchQuery = '';
      searchMatches = [];
      currentMatchIndex = -1;
    }
  }

  // Perform text search across the page
  function performSearch(query) {
    clearSearchHighlights();
    searchMatches = [];
    currentMatchIndex = -1;

    if (!query || query.length === 0) return;

    const lowerQuery = query.toLowerCase();

    // Phase 1: Collect all text nodes that contain the query
    const matchData = []; // { node, idx }
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          // Skip our own UI elements
          if (parent.closest('.modalbrowsing-search-bar') ||
              parent.closest('.modalbrowsing-hint')) {
            return NodeFilter.FILTER_REJECT;
          }
          // Skip script/style
          const tag = parent.tagName;
          if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') {
            return NodeFilter.FILTER_REJECT;
          }
          if (node.textContent.toLowerCase().includes(lowerQuery)) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_REJECT;
        }
      }
    );

    let textNode;
    while (textNode = walker.nextNode()) {
      const lowerText = textNode.textContent.toLowerCase();
      let startPos = 0;
      while (true) {
        const idx = lowerText.indexOf(lowerQuery, startPos);
        if (idx === -1) break;
        matchData.push({ node: textNode, idx: idx, length: query.length });
        startPos = idx + query.length;
      }
    }

    // Phase 2: Apply highlights in reverse order so earlier indices stay valid
    // Group by node and process each node's matches in reverse
    const nodeGroups = new Map();
    for (const m of matchData) {
      if (!nodeGroups.has(m.node)) {
        nodeGroups.set(m.node, []);
      }
      nodeGroups.get(m.node).push(m);
    }

    // We need to process in reverse document order for nodes,
    // and reverse index order within each node
    const nodeList = Array.from(nodeGroups.keys()).reverse();
    const allMarks = [];

    for (const node of nodeList) {
      const matches = nodeGroups.get(node).sort((a, b) => b.idx - a.idx); // reverse by idx
      for (const m of matches) {
        try {
          const range = document.createRange();
          range.setStart(m.node, m.idx);
          range.setEnd(m.node, m.idx + m.length);
          const mark = document.createElement('mark');
          mark.className = 'modalbrowsing-search-highlight';
          range.surroundContents(mark);
          allMarks.push(mark);
        } catch (e) {
          // skip if range is invalid
        }
      }
    }

    // allMarks is in reverse document order; reverse it
    allMarks.reverse();
    searchMatches = allMarks;

    // Jump to first match
    if (searchMatches.length > 0) {
      currentMatchIndex = 0;
      highlightCurrentMatch();
    }
  }

  // Navigate between search matches
  function navigateSearch(direction) {
    if (searchMatches.length === 0) return;

    // Remove current highlight
    if (currentMatchIndex >= 0 && currentMatchIndex < searchMatches.length) {
      searchMatches[currentMatchIndex].className = 'modalbrowsing-search-highlight';
    }

    currentMatchIndex += direction;
    if (currentMatchIndex >= searchMatches.length) {
      currentMatchIndex = 0;
    } else if (currentMatchIndex < 0) {
      currentMatchIndex = searchMatches.length - 1;
    }

    highlightCurrentMatch();
  }

  // Highlight and scroll to the current match
  function highlightCurrentMatch() {
    if (currentMatchIndex < 0 || currentMatchIndex >= searchMatches.length) return;
    const mark = searchMatches[currentMatchIndex];
    mark.className = 'modalbrowsing-search-current';
    mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // Update the match counter display
  function updateSearchCount(countEl) {
    if (!countEl) return;
    if (searchMatches.length === 0 && searchQuery.length > 0) {
      countEl.textContent = 'No matches';
    } else if (searchMatches.length > 0) {
      countEl.textContent = (currentMatchIndex + 1) + '/' + searchMatches.length;
    } else {
      countEl.textContent = '';
    }
  }

  // Remove all search highlight <mark> elements and restore original text
  function clearSearchHighlights() {
    const marks = document.querySelectorAll('mark.modalbrowsing-search-highlight, mark.modalbrowsing-search-current');
    marks.forEach(mark => {
      const parent = mark.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(mark.textContent), mark);
        parent.normalize(); // merge adjacent text nodes
      }
    });
  }

  // --- Omnibar state ---
  let omnibarOpen = false;
  let omnibarOverlay = null;
  let omnibarContainer = null;
  let omnibarResults = [];
  let omnibarSelectedIndex = -1;
  let omnibarDebounceTimer = null;

  // Open the omnibar
  function openOmnibar() {
    if (omnibarOpen) return;
    omnibarOpen = true;
    omnibarResults = [];
    omnibarSelectedIndex = -1;

    // Backdrop overlay
    omnibarOverlay = document.createElement('div');
    omnibarOverlay.className = 'modalbrowsing-omnibar-overlay';
    omnibarOverlay.addEventListener('click', closeOmnibar);

    // Main container
    omnibarContainer = document.createElement('div');
    omnibarContainer.className = 'modalbrowsing-omnibar';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Search tabs or enter URL...';

    const resultsList = document.createElement('div');
    resultsList.className = 'modalbrowsing-omnibar-results';

    omnibarContainer.appendChild(input);
    omnibarContainer.appendChild(resultsList);
    document.body.appendChild(omnibarOverlay);
    document.body.appendChild(omnibarContainer);

    input.focus();

    // Live search on input
    input.addEventListener('input', () => {
      const query = input.value.trim();
      if (omnibarDebounceTimer) clearTimeout(omnibarDebounceTimer);

      if (query.length === 0) {
        omnibarResults = [];
        omnibarSelectedIndex = -1;
        renderOmnibarResults(resultsList, query);
        return;
      }

      omnibarDebounceTimer = setTimeout(() => {
        chrome.runtime.sendMessage({ action: 'omnibarSearch', query: query }, (response) => {
          if (response && response.success) {
            omnibarResults = response.results;
          } else {
            omnibarResults = [];
          }
          // If input looks like a URL, append an "Open URL" entry
          omnibarResults = appendUrlOption(omnibarResults, input.value.trim());
          omnibarSelectedIndex = omnibarResults.length > 0 ? 0 : -1;
          renderOmnibarResults(resultsList, input.value.trim());
        });
      }, 150);
    });

    // Keyboard navigation inside the input
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeOmnibar();
        e.preventDefault();
        e.stopPropagation();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (omnibarResults.length > 0) {
          omnibarSelectedIndex = (omnibarSelectedIndex + 1) % omnibarResults.length;
          renderOmnibarResults(resultsList, input.value.trim());
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (omnibarResults.length > 0) {
          omnibarSelectedIndex = (omnibarSelectedIndex - 1 + omnibarResults.length) % omnibarResults.length;
          renderOmnibarResults(resultsList, input.value.trim());
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (omnibarSelectedIndex >= 0 && omnibarSelectedIndex < omnibarResults.length) {
          activateOmnibarItem(omnibarResults[omnibarSelectedIndex]);
        } else {
          // No item selected; treat input as URL if non-empty
          const raw = input.value.trim();
          if (raw.length > 0) {
            activateOmnibarItem({ type: 'url', url: normalizeUrl(raw) });
          }
        }
      }
    });
  }

  // Close the omnibar
  function closeOmnibar() {
    omnibarOpen = false;
    omnibarResults = [];
    omnibarSelectedIndex = -1;
    if (omnibarDebounceTimer) {
      clearTimeout(omnibarDebounceTimer);
      omnibarDebounceTimer = null;
    }
    if (omnibarOverlay) {
      omnibarOverlay.remove();
      omnibarOverlay = null;
    }
    if (omnibarContainer) {
      omnibarContainer.remove();
      omnibarContainer = null;
    }
  }

  // Check whether the input looks like a URL
  function looksLikeUrl(text) {
    // Starts with a protocol
    if (/^[a-zA-Z]+:\/\//.test(text)) return true;
    // Contains a dot and no spaces (e.g. "example.com", "foo.bar/baz")
    if (!text.includes(' ') && /\.\w/.test(text)) return true;
    // localhost with optional port
    if (/^localhost(:\d+)?/.test(text)) return true;
    return false;
  }

  // Normalize URL: add protocol if missing
  function normalizeUrl(text) {
    if (/^[a-zA-Z]+:\/\//.test(text)) return text;
    return 'https://' + text;
  }

  // Append "Open URL" option if input looks like a URL
  function appendUrlOption(results, query) {
    if (query.length > 0 && looksLikeUrl(query)) {
      const fullUrl = normalizeUrl(query);
      // Don't add if an existing result already has this exact URL
      const alreadyPresent = results.some(r => r.url === fullUrl);
      if (!alreadyPresent) {
        results.push({
          type: 'url',
          title: 'Open ' + fullUrl,
          url: fullUrl
        });
      }
    }
    return results;
  }

  // Render the omnibar dropdown
  function renderOmnibarResults(container, query) {
    container.innerHTML = '';

    if (omnibarResults.length === 0 && query && query.length > 0) {
      // Show "Open as URL" option if input looks like a URL, otherwise empty state
      if (looksLikeUrl(query)) {
        const urlItem = buildOmnibarItem({ type: 'url', title: 'Open ' + normalizeUrl(query), url: normalizeUrl(query) }, 0, query);
        omnibarResults = [{ type: 'url', title: 'Open ' + normalizeUrl(query), url: normalizeUrl(query) }];
        omnibarSelectedIndex = 0;
        container.appendChild(urlItem);
      } else {
        const empty = document.createElement('div');
        empty.className = 'modalbrowsing-omnibar-empty';
        empty.textContent = 'No matching tabs';
        container.appendChild(empty);
      }
      return;
    }

    omnibarResults.forEach((item, index) => {
      const el = buildOmnibarItem(item, index, query);
      container.appendChild(el);
    });

    // Scroll selected item into view
    if (omnibarSelectedIndex >= 0) {
      const selected = container.children[omnibarSelectedIndex];
      if (selected) {
        selected.scrollIntoView({ block: 'nearest' });
      }
    }
  }

  // Build a single omnibar result element
  function buildOmnibarItem(item, index, query) {
    const el = document.createElement('div');
    el.className = 'modalbrowsing-omnibar-item';
    if (index === omnibarSelectedIndex) {
      el.classList.add('selected');
    }

    // Badge
    const badge = document.createElement('span');
    badge.className = 'omni-badge ' + item.type;
    badge.textContent = item.type === 'tab' ? 'Tab' : 'URL';
    el.appendChild(badge);

    // Text container
    const textDiv = document.createElement('div');
    textDiv.className = 'omni-text';

    const titleSpan = document.createElement('div');
    titleSpan.className = 'omni-title';
    titleSpan.textContent = item.title || item.url;
    textDiv.appendChild(titleSpan);

    if (item.type !== 'url') {
      const urlSpan = document.createElement('div');
      urlSpan.className = 'omni-url';
      urlSpan.textContent = item.url;
      textDiv.appendChild(urlSpan);
    }

    el.appendChild(textDiv);

    // Click handler
    el.addEventListener('click', () => {
      activateOmnibarItem(item);
    });

    // Hover handler to update selection
    el.addEventListener('mouseenter', () => {
      omnibarSelectedIndex = index;
      // Update selection visuals
      const parent = el.parentElement;
      if (parent) {
        Array.from(parent.children).forEach((child, i) => {
          child.classList.toggle('selected', i === index);
        });
      }
    });

    return el;
  }

  // Activate (select) an omnibar item
  function activateOmnibarItem(item) {
    closeOmnibar();
    if (item.type === 'tab') {
      chrome.runtime.sendMessage({ action: 'omnibarSwitchTab', tabId: item.tabId });
    } else if (item.type === 'url') {
      const url = item.url;
      chrome.runtime.sendMessage({ action: 'omnibarOpenUrl', url: url });
    }
  }

  // Handle keyboard shortcuts
  function handleKeydown(event) {
    // Handle Escape from omnibar input specially
    if (event.key === 'Escape' && omnibarOpen && omnibarContainer && omnibarContainer.contains(event.target)) {
      closeOmnibar();
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    // Handle Escape from search bar input specially
    if (event.key === 'Escape' && searchOverlay && searchOverlay.contains(event.target)) {
      closeSearchBar(false); // close bar but keep highlights for n/N navigation
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    // Allow ESC to work from input fields to exit to normal mode
    if (event.key === 'Escape' && isEditableElement(event.target)) {
      event.target.blur();
      // Ensure focus moves away from the editable element
      document.body.focus();
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    // Don't intercept if we're in an input field (except ESC handled above)
    if (isEditableElement(event.target)) {
      return;
    }

    // Don't intercept if modifier keys are pressed (except Shift for some commands)
    if (event.ctrlKey || event.altKey || event.metaKey) {
      return;
    }

    if (!isEnabled) return;

    let handled = false;
    const currentTime = Date.now();

    // Handle link hint mode separately
    if (linkHintMode) {
      if (event.key === 'Escape') {
        clearLinkHints();
        event.preventDefault();
        event.stopPropagation();
        return;
      } else if (event.key.length === 1 && /[a-z]/i.test(event.key)) {
        handleHintInput(event.key);
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      // Ignore other keys in hint mode
      return;
    }

    // Check for 'yy', 'yf', 'gg', '<<', and '>>' sequences
    if (event.key === 'y' && !event.shiftKey) {
      if (lastKeyPressed === 'y' && (currentTime - lastKeyTime) < keySequenceTimeout) {
        // Second 'y' pressed - copy URL
        copyToClipboard(window.location.href);
        handled = true;
        lastKeyPressed = null;
        lastKeyTime = 0;
      } else {
        // First 'y' pressed
        lastKeyPressed = 'y';
        lastKeyTime = currentTime;
        handled = true;
      }
    } else if (event.key === 'f' || event.key === 'F') {
      if (event.shiftKey) {
        // 'F' (Shift+f) - show link hints for opening in new tab
        showLinkHints('newtab');
        handled = true;
      } else if (lastKeyPressed === 'y' && (currentTime - lastKeyTime) < keySequenceTimeout) {
        // 'yf' sequence - show link hints for copying
        showLinkHints('copy');
        handled = true;
        lastKeyPressed = null;
        lastKeyTime = 0;
      } else {
        // Single 'f' - show link hints for clicking
        showLinkHints('click');
        handled = true;
      }
    } else if (event.key === 'g' && !event.shiftKey) {
      if (lastKeyPressed === 'g' && (currentTime - lastKeyTime) < keySequenceTimeout) {
        // Second 'g' pressed - go to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
        handled = true;
        lastKeyPressed = null;
        lastKeyTime = 0;
      } else {
        // First 'g' pressed
        lastKeyPressed = 'g';
        lastKeyTime = currentTime;
        handled = true;
      }
    } else if (event.key === '<') {
      // '<' is Shift+, on most keyboards, so event.shiftKey is true - that is expected
      if (lastKeyPressed === '<' && (currentTime - lastKeyTime) < keySequenceTimeout) {
        // Second '<' pressed - move tab left
        chrome.runtime.sendMessage({ action: 'moveTabLeft' }, (response) => {
          if (response && response.notify) showNotification(response.notify);
        });
        handled = true;
        lastKeyPressed = null;
        lastKeyTime = 0;
      } else {
        // First '<' pressed
        lastKeyPressed = '<';
        lastKeyTime = currentTime;
        handled = true;
      }
    } else if (event.key === '>') {
      // '>' is Shift+. on most keyboards, so event.shiftKey is true - that is expected
      if (lastKeyPressed === '>' && (currentTime - lastKeyTime) < keySequenceTimeout) {
        // Second '>' pressed - move tab right
        chrome.runtime.sendMessage({ action: 'moveTabRight' }, (response) => {
          if (response && response.notify) showNotification(response.notify);
        });
        handled = true;
        lastKeyPressed = null;
        lastKeyTime = 0;
      } else {
        // First '>' pressed
        lastKeyPressed = '>';
        lastKeyTime = currentTime;
        handled = true;
      }
    } else {
      // Reset sequence if a different key is pressed
      if (lastKeyPressed && (currentTime - lastKeyTime) < keySequenceTimeout) {
        // Don't reset immediately, just continue with other commands
      } else {
        lastKeyPressed = null;
        lastKeyTime = 0;
      }
    }

    // If a sequence key was handled, stop here
    if (handled && (event.key === 'y' || event.key === 'f' || event.key === 'F' || event.key === 'g' || event.key === '<' || event.key === '>')) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    switch(event.key) {
      // Scrolling
      case 'j':
        smoothScroll(0, scrollStep);
        handled = true;
        break;
      case 'k':
        smoothScroll(0, -scrollStep);
        handled = true;
        break;
      case 'h':
        smoothScroll(-scrollStep, 0);
        handled = true;
        break;
      case 'l':
        smoothScroll(scrollStep, 0);
        handled = true;
        break;

      // Large scrolling
      case 'd':
        smoothScroll(0, scrollStepLarge);
        handled = true;
        break;
      case 'u':
        smoothScroll(0, -scrollStepLarge);
        handled = true;
        break;

      // Page navigation - G for bottom only (gg handled above)
      case 'G':
        if (event.shiftKey) {
          // G - scroll to bottom
          window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
          handled = true;
        }
        break;

      // Tab switching
      case 'J':
        if (event.shiftKey) {
          chrome.runtime.sendMessage({ action: 'switchTab', direction: 'left' });
          handled = true;
        }
        break;
      case 'K':
        if (event.shiftKey) {
          chrome.runtime.sendMessage({ action: 'switchTab', direction: 'right' });
          handled = true;
        }
        break;

      // History navigation
      case 'H':
        if (event.shiftKey) {
          window.history.back();
          handled = true;
        }
        break;
      case 'L':
        if (event.shiftKey) {
          window.history.forward();
          handled = true;
        }
        break;

      // Reload
      case 'r':
        window.location.reload();
        handled = true;
        break;

      // Omnibar (search tabs, open URL)
      case 'o':
        openOmnibar();
        handled = true;
        break;

      // Open new tab
      case 't':
        chrome.runtime.sendMessage({ action: 'openNewTab' });
        handled = true;
        break;

      // Close current tab
      case 'x':
        if (!event.shiftKey) {
          chrome.runtime.sendMessage({ action: 'closeTab' });
          handled = true;
        }
        break;

      // Reopen last closed tab
      case 'X':
        if (event.shiftKey) {
          chrome.runtime.sendMessage({ action: 'reopenTab' });
          handled = true;
        }
        break;

      // Focus first input
      case 'i':
        const firstInput = document.querySelector('input:not([type="hidden"]), textarea');
        if (firstInput) {
          firstInput.focus();
          handled = true;
        }
        break;

      // Open search overlay
      case '/':
        openSearchBar();
        handled = true;
        break;

      // Search navigation
      case 'n':
        if (!event.shiftKey && searchMatches.length > 0) {
          navigateSearch(1);
          handled = true;
        }
        break;
      case 'N':
        if (event.shiftKey && searchMatches.length > 0) {
          navigateSearch(-1);
          handled = true;
        }
        break;

      // Escape to clear search and blur
      case 'Escape':
        if (searchMatches.length > 0 || searchOverlay) {
          closeSearchBar(true); // clear highlights and close
          handled = true;
        } else if (document.activeElement) {
          document.activeElement.blur();
          handled = true;
        }
        break;
    }

    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  // Listen for keyboard events
  document.addEventListener('keydown', handleKeydown, true);

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'toggleEnabled') {
      isEnabled = message.enabled;
      sendResponse({ success: true });
    } else if (message.action === 'getStatus') {
      sendResponse({ enabled: isEnabled });
    }
  });

  console.log('ModalBrowsing content script loaded');
})();
