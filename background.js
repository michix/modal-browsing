// ModalBrowsing Background Service Worker
// Handles tab switching and other browser-level operations

// Track closed tabs for reopening
let closedTabsHistory = [];

// Track tab activation history for Ctrl-o/Ctrl-i navigation
let tabActivationHistory = []; // stores tab IDs in activation order (oldest -> newest)
let tabHistoryIndex = -1;      // index of the currently active tab in the history (-1 means unset)
let isNavigatingHistory = false; // true while we programmatically switch tabs for history navigation
let navigationTargetId = null;   // target tab ID during navigation

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
  } else if (message.action === 'closeOtherTabs') {
    handleCloseOtherTabs(sender.tab).then(sendResponse);
    return true;
  } else if (message.action === 'closeRightTabs') {
    handleCloseRightTabs(sender.tab).then(sendResponse);
    return true;
  } else if (message.action === 'closeLeftTabs') {
    handleCloseLeftTabs(sender.tab).then(sendResponse);
    return true;
  } else if (message.action === 'reopenTab') {
    handleReopenTab();
    sendResponse({ success: true });
  } else if (message.action === 'moveTabLeft') {
    handleMoveTab('left', sender.tab).then(sendResponse);
    return true; // keep channel open for async response
  } else if (message.action === 'moveTabRight') {
    handleMoveTab('right', sender.tab).then(sendResponse);
    return true; // keep channel open for async response
  } else if (message.action === 'switchToPreviousTab') {
    handleSwitchToPreviousTab(sender.tab).then(sendResponse);
    return true; // keep channel open for async response
  } else if (message.action === 'switchToNextTab') {
    handleSwitchToNextTab(sender.tab).then(sendResponse);
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
  } else if (message.action === 'getTabGroups') {
    handleGetTabGroups().then(sendResponse);
    return true;
  } else if (message.action === 'moveTabToGroup') {
    handleMoveTabToGroup(message.groupId, sender.tab).then(sendResponse);
    return true;
  } else if (message.action === 'createGroupAndMoveTab') {
    handleCreateGroupAndMoveTab(message.title, sender.tab).then(sendResponse);
    return true;
  }
  return true;
});

// Track tab activation for Ctrl-o/Ctrl-i (jump to previous/next tab)
chrome.tabs.onActivated.addListener((activeInfo) => {
  const tabId = activeInfo.tabId;

  // If this activation is the result of our own navigation, just update the index and exit
  if (isNavigatingHistory && navigationTargetId === tabId) {
    const idx = tabActivationHistory.indexOf(tabId);
    if (idx !== -1) {
      tabHistoryIndex = idx;
    }
    isNavigatingHistory = false;
    navigationTargetId = null;
    return;
  }

  // User-driven activation: reset navigation state
  isNavigatingHistory = false;
  navigationTargetId = null;

  // Remove existing occurrence to keep entries unique
  const existingIndex = tabActivationHistory.indexOf(tabId);
  if (existingIndex !== -1) {
    tabActivationHistory.splice(existingIndex, 1);
  }

  // Truncate forward history when navigating to a new tab from a non-end position
  // This mimics browser history behavior: going back then clicking a new link
  // replaces the forward history instead of appending to it
  if (tabHistoryIndex >= 0 && tabHistoryIndex < tabActivationHistory.length - 1) {
    // User went back in history and is now clicking a different tab
    // Truncate everything after current position
    tabActivationHistory = tabActivationHistory.slice(0, tabHistoryIndex + 1);
  }

  // Append as most recent
  tabActivationHistory.push(tabId);

  // Clamp history size
  if (tabActivationHistory.length > 50) {
    tabActivationHistory.shift();
    // Adjust index if we removed items from the beginning
    tabHistoryIndex = tabActivationHistory.length - 1;
  } else {
    // Point to the newest entry
    tabHistoryIndex = tabActivationHistory.length - 1;
  }
});

// Clean up closed tabs from history
chrome.tabs.onRemoved.addListener((tabId) => {
  const removedIndex = tabActivationHistory.indexOf(tabId);
  if (removedIndex !== -1) {
    tabActivationHistory.splice(removedIndex, 1);
    if (tabHistoryIndex > removedIndex) {
      tabHistoryIndex -= 1;
    } else if (tabHistoryIndex === removedIndex) {
      tabHistoryIndex = tabActivationHistory.length - 1;
    }
  }
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

async function handleCloseOtherTabs(currentTab) {
  try {
    // Get all tabs in the current window
    const tabs = await chrome.tabs.query({ currentWindow: true });
    
    // Close all tabs except the current one
    const tabIdsToClose = tabs
      .filter(tab => tab.id !== currentTab.id)
      .map(tab => tab.id);
    
    if (tabIdsToClose.length > 0) {
      await chrome.tabs.remove(tabIdsToClose);
    }
  } catch (error) {
    console.error('Error closing other tabs:', error);
  }
}

async function handleCloseRightTabs(currentTab) {
  try {
    // Get all tabs in the current window
    const tabs = await chrome.tabs.query({ currentWindow: true });
    
    // Close all tabs to the right of the current one
    const tabIdsToClose = tabs
      .filter(tab => tab.index > currentTab.index)
      .map(tab => tab.id);
    
    if (tabIdsToClose.length > 0) {
      await chrome.tabs.remove(tabIdsToClose);
    }
  } catch (error) {
    console.error('Error closing right tabs:', error);
  }
}

async function handleCloseLeftTabs(currentTab) {
  try {
    // Get all tabs in the current window
    const tabs = await chrome.tabs.query({ currentWindow: true });
    
    // Close all tabs to the left of the current one
    const tabIdsToClose = tabs
      .filter(tab => tab.index < currentTab.index)
      .map(tab => tab.id);
    
    if (tabIdsToClose.length > 0) {
      await chrome.tabs.remove(tabIdsToClose);
    }
  } catch (error) {
    console.error('Error closing left tabs:', error);
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

// Switch to previously active tab (Ctrl-o)
async function handleSwitchToPreviousTab(currentTab) {
  try {
    return switchInHistory(-1);
  } catch (error) {
    console.error('Error switching to previous tab:', error);
    return { success: false, notify: 'Error switching to previous tab: ' + error.message };
  }
}

// Switch to next active tab in history (Ctrl-i)
async function handleSwitchToNextTab(currentTab) {
  try {
    return switchInHistory(1);
  } catch (error) {
    console.error('Error switching to next tab:', error);
    return { success: false, notify: 'Error switching to next tab: ' + error.message };
  }
}

// Navigate tab history. direction: -1 backward (Ctrl-o), 1 forward (Ctrl-i)
async function switchInHistory(direction) {
  if (tabActivationHistory.length === 0) {
    return { success: false, notify: 'No tab history available' };
  }

  // If index is unset, assume we are at the most recent tab
  if (tabHistoryIndex === -1) {
    tabHistoryIndex = tabActivationHistory.length - 1;
  }

  const targetIndex = tabHistoryIndex + direction;

  if (targetIndex < 0) {
    return { success: false, notify: 'At the beginning of tab history' };
  }
  if (targetIndex >= tabActivationHistory.length) {
    return { success: false, notify: 'At the most recent tab' };
  }

  const targetTabId = tabActivationHistory[targetIndex];

  try {
    await chrome.tabs.get(targetTabId);
  } catch (error) {
    // Tab no longer exists; remove it and adjust index
    tabActivationHistory = tabActivationHistory.filter(id => id !== targetTabId);
    if (tabHistoryIndex >= tabActivationHistory.length) {
      tabHistoryIndex = tabActivationHistory.length - 1;
    }
    return { success: false, notify: 'Tab no longer exists in history' };
  }

  // Set navigation state so onActivated doesn't rewrite history
  isNavigatingHistory = true;
  navigationTargetId = targetTabId;
  tabHistoryIndex = targetIndex;

  await chrome.tabs.update(targetTabId, { active: true });
  return { success: true };
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

// Tab groups: get all tab groups in the current window
async function handleGetTabGroups() {
  try {
    const groups = await chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });
    const results = groups.map(g => ({
      id: g.id,
      title: g.title || '(Unnamed)',
      color: g.color
    }));
    return { success: true, groups: results };
  } catch (error) {
    console.error('Error getting tab groups:', error);
    return { success: false, groups: [] };
  }
}

// Tab groups: create a new group with the given title and move the current tab into it
async function handleCreateGroupAndMoveTab(title, senderTab) {
  try {
    const groupId = await chrome.tabs.group({ tabIds: senderTab.id });
    await chrome.tabGroups.update(groupId, { title: title });
    return { success: true };
  } catch (error) {
    console.error('Error creating tab group:', error);
    return { success: false, notify: 'Error creating tab group: ' + error.message };
  }
}

// Tab groups: move the current tab into a group
async function handleMoveTabToGroup(groupId, senderTab) {
  try {
    await chrome.tabs.group({ tabIds: senderTab.id, groupId: groupId });
    return { success: true };
  } catch (error) {
    console.error('Error moving tab to group:', error);
    return { success: false, notify: 'Error moving tab to group: ' + error.message };
  }
}
