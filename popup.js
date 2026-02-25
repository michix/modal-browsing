// Popup script for ModalBrowsing extension

document.addEventListener('DOMContentLoaded', async () => {
  const toggleBtn = document.getElementById('toggleBtn');
  
  // Get current status from the active tab
  async function getStatus() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getStatus' });
      return response.enabled;
    } catch (error) {
      // If content script not loaded, assume enabled
      return true;
    }
  }

  // Update button UI
  function updateButton(enabled) {
    if (enabled) {
      toggleBtn.textContent = 'Enabled';
      toggleBtn.className = 'toggle-btn enabled';
    } else {
      toggleBtn.textContent = 'Disabled';
      toggleBtn.className = 'toggle-btn disabled';
    }
  }

  // Initialize button state
  const initialStatus = await getStatus();
  updateButton(initialStatus);

  // Handle toggle
  toggleBtn.addEventListener('click', async () => {
    const currentStatus = await getStatus();
    const newStatus = !currentStatus;
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    try {
      await chrome.tabs.sendMessage(tab.id, { 
        action: 'toggleEnabled', 
        enabled: newStatus 
      });
      updateButton(newStatus);
    } catch (error) {
      console.error('Failed to toggle extension:', error);
    }
  });
});
