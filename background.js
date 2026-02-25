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
