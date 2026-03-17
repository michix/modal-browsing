// ModalBrowsing Background Service Worker
// Handles tab switching and other browser-level operations

// Track closed tabs for reopening
let closedTabsHistory = [];

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'switchTab') {
    handleTabSwitch(message.direction, sender.tab);
    sendResponse({ success: true });
  } else if (message.action === 'openNewTab') {
    handleOpenNewTab(sender.tab);
    sendResponse({ success: true });
  } else if (message.action === 'closeTab') {
    handleCloseTab(sender.tab);
    sendResponse({ success: true });
  } else if (message.action === 'reopenTab') {
    handleReopenTab();
    sendResponse({ success: true });
  } else if (message.action === 'moveTabLeft') {
    handleMoveTab('left', sender.tab).then(sendResponse);
    return true; // keep channel open for async response
  } else if (message.action === 'moveTabRight') {
    handleMoveTab('right', sender.tab).then(sendResponse);
    return true; // keep channel open for async response
  } else if (message.action === 'omnibarSearch') {
    handleOmnibarSearch(message.query, sender.tab).then(sendResponse);
    return true; // keep channel open for async response
  } else if (message.action === 'omnibarSwitchTab') {
    handleOmnibarSwitchTab(message.tabId).then(sendResponse);
    return true;
  } else if (message.action === 'omnibarOpenUrl') {
    handleOmnibarOpenUrl(message.url, sender.tab).then(sendResponse);
    return true;
  }
  return true;
});

async function handleTabSwitch(direction, currentTab) {
  try {
    // Get all tabs in the current window
    const tabs = await chrome.tabs.query({ currentWindow: true });
    
    // Find the index of the current tab
    const currentIndex = tabs.findIndex(tab => tab.id === currentTab.id);
    
    if (currentIndex === -1) return;
    
    let targetIndex;
    
    if (direction === 'left') {
      // Move to the left tab, wrap around if at the beginning
      targetIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
    } else if (direction === 'right') {
      // Move to the right tab, wrap around if at the end
      targetIndex = currentIndex === tabs.length - 1 ? 0 : currentIndex + 1;
    }
    
    // Activate the target tab
    if (targetIndex !== undefined) {
      await chrome.tabs.update(tabs[targetIndex].id, { active: true });
    }
  } catch (error) {
    console.error('Error switching tabs:', error);
  }
}

async function handleOpenNewTab(currentTab) {
  try {
    // Create a new tab next to the current one
    await chrome.tabs.create({
      active: true,
      index: currentTab.index + 1
    });
  } catch (error) {
    console.error('Error opening new tab:', error);
  }
}

async function handleCloseTab(currentTab) {
  try {
    // Save tab info before closing for potential reopening
    closedTabsHistory.push({
      url: currentTab.url,
      title: currentTab.title,
      index: currentTab.index
    });
    
    // Keep only the last 10 closed tabs
    if (closedTabsHistory.length > 10) {
      closedTabsHistory.shift();
    }
    
    // Close the tab
    await chrome.tabs.remove(currentTab.id);
  } catch (error) {
    console.error('Error closing tab:', error);
  }
}

async function handleReopenTab() {
  try {
    if (closedTabsHistory.length === 0) {
      console.log('No tabs to reopen');
      return;
    }
    
    // Get the last closed tab
    const tabInfo = closedTabsHistory.pop();
    
    // Reopen the tab
    await chrome.tabs.create({
      url: tabInfo.url,
      active: true
    });
  } catch (error) {
    console.error('Error reopening tab:', error);
  }
}

// Tab moving
async function handleMoveTab(direction, currentTab) {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const current = tabs.find(tab => tab.id === currentTab.id);

    if (!current) {
      return { success: false, notify: 'Could not find current tab.' };
    }

    if (current.pinned) {
      return { success: false, notify: 'Pinned tabs cannot be moved.' };
    }

    if (direction === 'left') {
      // Find the first non-pinned tab index as the left boundary
      const firstUnpinned = tabs.find(tab => !tab.pinned);
      if (!firstUnpinned || current.index <= firstUnpinned.index) {
        return { success: false, notify: 'Tab is already at the leftmost position; cannot move further.' };
      }
      await chrome.tabs.move(current.id, { index: current.index - 1 });
      return { success: true, notify: 'Tab moved left.' };
    }

    if (direction === 'right') {
      const lastTab = tabs[tabs.length - 1];
      if (current.index >= lastTab.index) {
        return { success: false, notify: 'Tab is already at the rightmost position; cannot move further.' };
      }
      await chrome.tabs.move(current.id, { index: current.index + 1 });
      return { success: true, notify: 'Tab moved right.' };
    }

    return { success: false, notify: 'Unknown direction.' };
  } catch (error) {
    console.error('Error moving tab:', error);
    return { success: false, notify: 'Error moving tab: ' + error.message };
  }
}

// Omnibar: search open tabs
async function handleOmnibarSearch(query, senderTab) {
  try {
    const results = [];
    const lowerQuery = query.toLowerCase();

    // Search open tabs
    const tabs = await chrome.tabs.query({ currentWindow: true });
    for (const tab of tabs) {
      if (tab.id === senderTab.id) continue; // skip current tab
      const title = (tab.title || '').toLowerCase();
      const url = (tab.url || '').toLowerCase();
      if (title.includes(lowerQuery) || url.includes(lowerQuery)) {
        results.push({
          type: 'tab',
          title: tab.title || '(Untitled)',
          url: tab.url || '',
          tabId: tab.id
        });
      }
    }

    return { success: true, results: results };
  } catch (error) {
    console.error('Error in omnibar search:', error);
    return { success: false, results: [] };
  }
}

// Omnibar: switch to a tab by ID
async function handleOmnibarSwitchTab(tabId) {
  try {
    await chrome.tabs.update(tabId, { active: true });
    return { success: true };
  } catch (error) {
    console.error('Error switching to tab:', error);
    return { success: false };
  }
}

// Omnibar: open a URL in the current tab
async function handleOmnibarOpenUrl(url, senderTab) {
  try {
    await chrome.tabs.update(senderTab.id, { url: url });
    return { success: true };
  } catch (error) {
    console.error('Error opening URL:', error);
    return { success: false };
  }
}
