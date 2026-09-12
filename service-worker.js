// Background Service Worker for QA Form Field Validator
// Compatible with Microsoft Edge, Brave, and Google Chrome

chrome.runtime.onInstalled.addListener(() => {
  // Configure side panel to open on toolbar icon click (Chromium 114+)
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
      console.warn('sidePanel.setPanelBehavior not supported or failed:', err);
    });
  }

  // Create context menu for right-clicking directly on editable fields
  chrome.contextMenus.create({
    id: 'qa_inspect_element',
    title: 'Probar este campo con QA Validator',
    contexts: ['editable']
  });
});

// Fallback action click handler in case openPanelOnActionClick isn't supported
chrome.action.onClicked.addListener(async (tab) => {
  if (chrome.sidePanel && chrome.sidePanel.open) {
    try {
      await chrome.sidePanel.open({ windowId: tab.windowId });
      return;
    } catch (e) {
      console.warn('sidePanel.open failed, opening in window fallback', e);
    }
  }
  
  // Fallback: open sidepanel UI in a dedicated popup window or tab
  const url = chrome.runtime.getURL('sidepanel/sidepanel.html');
  await chrome.windows.create({
    url: url,
    type: 'popup',
    width: 480,
    height: 800
  });
});

// Handle Context Menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'qa_inspect_element' && tab?.id) {
    // 1. Open side panel
    if (chrome.sidePanel && chrome.sidePanel.open) {
      try {
        await chrome.sidePanel.open({ windowId: tab.windowId });
      } catch (err) {
        console.warn('Could not open side panel:', err);
      }
    }

    // 2. Instruct content script to pick the right-clicked element
    try {
      await chrome.tabs.sendMessage(tab.id, {
        action: 'SELECT_CONTEXT_TARGET'
      });
    } catch (err) {
      console.warn('Content script not yet ready on tab:', err);
    }
  }
});

// Keep service worker responsive for messaging
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'PING') {
    sendResponse({ status: 'PONG' });
    return false;
  }

  // Open a new tab on behalf of the sidepanel (sidepanel lacks chrome.tabs access)
  if (message.action === 'OPEN_DASHBOARD_TAB') {
    const url = message.url || chrome.runtime.getURL('dashboard/dashboard.html');
    chrome.tabs.create({ url: url }).then((tab) => {
      sendResponse({ success: true, tabId: tab.id });
    }).catch((err) => {
      sendResponse({ success: false, error: err.message });
    });
    return true; // keep channel open for async sendResponse
  }

  return false;
});
