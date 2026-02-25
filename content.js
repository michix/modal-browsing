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

  // Check if we're in an input field
  function isEditableElement(element) {
    if (!element) return false;
    const tagName = element.tagName.toLowerCase();
    const isEditable = element.isContentEditable;
    const isInput = tagName === 'input' || tagName === 'textarea' || tagName === 'select';
    
    return isEditable || isInput;
  }

  // Get all clickable elements
  function getClickableElements() {
    const selector = 'a, button, input[type="submit"], input[type="button"], [role="button"], [onclick]';
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

  // Open URL prompt
  function openUrlPrompt() {
    const url = prompt('Enter URL to open:');
    if (url) {
      // Add protocol if missing
      let fullUrl = url;
      if (!url.match(/^[a-zA-Z]+:\/\//)) {
        fullUrl = 'https://' + url;
      }
      window.location.href = fullUrl;
    }
  }

  // Show temporary notification
  function showNotification(message) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 12px 20px;
      border-radius: 4px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      z-index: 999999;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => notification.remove(), 300);
    }, 2000);
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
      text-transform: uppercase;
    }
    .modalbrowsing-hint-highlight {
      outline: 2px solid #FFD700 !important;
      outline-offset: 2px;
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
        }
      } else {
        // Click mode - works for all elements (links, buttons, etc.)
        match.element.click();
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

  // Handle keyboard shortcuts
  function handleKeydown(event) {
    // Allow ESC to work from input fields to exit to normal mode
    if (event.key === 'Escape' && isEditableElement(event.target)) {
      event.target.blur();
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

    // Check for 'yy', 'yf', and 'gg' sequences
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
    } else if (event.key === 'f') {
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
    } else {
      // Reset sequence if a different key is pressed
      if (lastKeyPressed && (currentTime - lastKeyTime) < keySequenceTimeout) {
        // Don't reset immediately, just continue with other commands
      } else {
        lastKeyPressed = null;
        lastKeyTime = 0;
      }
    }

    // If 'yy', 'yf', or 'gg' was handled, stop here
    if (handled && (event.key === 'y' || event.key === 'f' || event.key === 'g')) {
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

      // Open URL
      case 'o':
        openUrlPrompt();
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

      // Open find dialog
      case '/':
        // Trigger the browser's find functionality
        document.execCommand('find');
        handled = true;
        break;

      // Escape to blur
      case 'Escape':
        if (document.activeElement) {
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
