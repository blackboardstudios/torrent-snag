// Background service worker for Torrent Snag extension
'use strict';

// Import torrent handlers
importScripts('../handlers/base-handler.js');
importScripts('../handlers/qbittorrent-handler.js');
importScripts('../handlers/transmission-handler.js');
importScripts('../handlers/deluge-handler.js');
importScripts('../handlers/generic-download-handler.js');
importScripts('../handlers/handler-factory.js');

// Import utilities
importScripts('../utils/context-menu.js');

// Service worker state management
const serviceWorkerState = {
  isInitialized: false,
  lastActivity: Date.now(),
  currentHandler: null,
  
  async initialize() {
    if (this.isInitialized) return;
    
    try {
      // Restore critical state from storage
      const data = await chrome.storage.local.get(['config', 'duplicateTracking']);
      this.config = data.config;
      this.duplicateTracking = data.duplicateTracking;
      this.isInitialized = true;
      
    } catch (error) {
      console.error('Torrent Snag: Failed to initialize service worker:', error);
    }
  },
  
  updateActivity() {
    this.lastActivity = Date.now();
  }
};

// Handler management functions
async function createCurrentHandler() {
  try {
    const config = await chrome.storage.local.get(['config']);
    const appConfig = config.config;
    
    if (!appConfig || !appConfig.selectedHandler) {
      throw new Error('No handler configured');
    }

    const selectedHandler = appConfig.selectedHandler;
    const handlerConfig = appConfig.handlers?.[selectedHandler];
    
    if (!handlerConfig) {
      throw new Error(`Handler configuration not found for: ${selectedHandler}`);
    }

    return HandlerFactory.createHandler(selectedHandler, handlerConfig);
  } catch (error) {
    console.error('Failed to create handler:', error);
    throw error;
  }
}

// Badge management
const badgeManager = {
  async updateBadge(tabId, count, hasError = false) {
    try {
      if (hasError) {
        await chrome.action.setBadgeText({ text: '!', tabId });
        await chrome.action.setBadgeBackgroundColor({ color: '#ff0000', tabId });
        await chrome.action.setTitle({ 
          title: 'Torrent Snag - Configuration Error', 
          tabId 
        });
      } else if (count > 0) {
        const displayText = count > 99 ? '99+' : count.toString();
        await chrome.action.setBadgeText({ text: displayText, tabId });
        await chrome.action.setBadgeBackgroundColor({ color: '#4285f4', tabId });
        await chrome.action.setTitle({ 
          title: `Torrent Snag - ${count} new torrents found`, 
          tabId 
        });
      } else {
        await chrome.action.setBadgeText({ text: '', tabId });
        await chrome.action.setTitle({ 
          title: 'Torrent Snag', 
          tabId 
        });
      }
    } catch (error) {
      console.error('Torrent Snag: Failed to update badge:', error);
    }
  },

  async clearBadge(tabId) {
    await this.updateBadge(tabId, 0, false);
  }
};

// Event listeners
chrome.runtime.onInstalled.addListener(async () => {
  await serviceWorkerState.initialize();
  await initializeDefaultConfig();
  
  // Setup context menus (extension icon only, no link menus)
  await contextMenuUtils.setupContextMenus();
});

chrome.runtime.onStartup.addListener(async () => {
  await serviceWorkerState.initialize();
});

// Handle extension icon clicks (direct send all torrents)
chrome.action.onClicked.addListener(async (tab) => {
  serviceWorkerState.updateActivity();
  await handleActionClick(tab);
});

// Message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  serviceWorkerState.updateActivity();
  
  switch (message.type) {
    case 'UPDATE_BADGE':
      badgeManager.updateBadge(sender.tab?.id, message.count);
      break;
      
    case 'SEND_TORRENTS':
      // Handle both old format (links array) and new format (torrents array with labels)
      if (message.torrents && Array.isArray(message.torrents)) {
        // New format with labels
        const urls = message.torrents.map(t => t.url);
        const labels = message.torrents.map(t => t.label || '');
        sendTorrentsToHandler(urls, sender.tab?.id, labels)
          .then(sendResponse)
          .catch(error => sendResponse({ success: false, error: error.message }));
      } else if (message.links && Array.isArray(message.links)) {
        // Old format for backward compatibility
        sendTorrentsToHandler(message.links, sender.tab?.id)
          .then(sendResponse)
          .catch(error => sendResponse({ success: false, error: error.message }));
      } else {
        sendResponse({ success: false, error: 'Invalid message format' });
      }
      return true; // Indicates async response
      
    case 'TEST_CONNECTION':
      testHandlerConnection(message.handlerType, message.config)
        .then(sendResponse)
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case 'OPEN_REVIEW_POPUP':
      // Open the review popup window
      openReviewPopup(message.tabId);
      sendResponse({ success: true });
      break;
      
    case 'HANDLER_CONFIG_CHANGED':
      // Update context menus when handler configuration changes
      contextMenuUtils.updateContextMenus();
      sendResponse({ success: true });
      break;
  }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  serviceWorkerState.updateActivity();
  await contextMenuUtils.handleContextMenuClick(info, tab);
});

// Handle keyboard commands
chrome.commands.onCommand.addListener(async (command, tab) => {
  serviceWorkerState.updateActivity();
  
  try {
    switch (command) {
      case 'open-review-popup':
        await openReviewPopup(tab.id);
        break;
        
      case 'send-all-torrents':
        await handleActionClick(tab);
        break;
    }
  } catch (error) {
    console.error('Command execution failed:', error);
  }
});

// Alarm handling
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'duplicateCleanup') {
    await cleanupDuplicateTracking();
  }
});

// Core functions
async function initializeDefaultConfig() {
  const DEFAULT_CONFIG = {
    selectedHandler: 'qbittorrent',
    handlers: {
      qbittorrent: {
        url: 'http://localhost:8080',
        username: '',
        password: '',
        timeout: 30000
      },
      transmission: {
        url: 'http://localhost:9091',
        username: '',
        password: '',
        timeout: 30000
      },
      deluge: {
        url: 'http://localhost:8112',
        password: '',
        timeout: 30000
      },
      download: {
        timeout: 30000
      }
    },
    patterns: [
      {
        id: 'magnet-links',
        name: 'Magnet Links',
        regex: 'magnet:\\?xt=urn:btih:[a-fA-F0-9]{40}[^\\s]*',
        enabled: true,
        builtin: true
      },
      {
        id: 'torrent-files',
        name: 'Torrent Files',
        regex: 'https?://[^\\s]*\\.torrent(?:\\?[^\\s]*)?',
        enabled: true,
        builtin: true
      }
    ]
  };
  
  await chrome.storage.local.set({ config: DEFAULT_CONFIG });
}

async function openReviewPopup(tabId) {
  try {
    // Create a popup window with the review interface
    const popup = await chrome.windows.create({
      url: chrome.runtime.getURL('popup/popup.html'),
      type: 'popup',
      width: 500,
      height: 700,
      focused: true
    });
    
    // Store the tab ID so the popup can communicate with the correct tab
    await chrome.storage.local.set({
      reviewPopupTabId: tabId,
      reviewPopupWindowId: popup.id
    });
    
  } catch (error) {
    console.error('Failed to open review popup:', error);
    // Fallback: show notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-48.png',
      title: 'Torrent Snag',
      message: 'Failed to open review window. Please try again.'
    });
  }
}

async function handleActionClick(tab) {
  try {
    // Get detected links from content script
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_DETECTED_LINKS' });
    
    if (!response || !response.links || response.links.length === 0) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon-48.png',
        title: 'Torrent Snag',
        message: 'No new torrents found on this page'
      });
      return;
    }
    
    const urls = response.links.map(link => link.url);
    await sendTorrentsToHandler(urls, tab.id, []);
    
  } catch (error) {
    console.error('Torrent Snag: Failed to handle action click:', error);
    await badgeManager.updateBadge(tab.id, 0, true);
  }
}

async function sendTorrentsToHandler(urls, tabId, labels = []) {
  try {
    const handler = await createCurrentHandler();
    
    const result = await handler.addTorrents(urls, labels);
    
    // Mark torrents as sent
    for (const url of urls) {
      try {
        const hash = await generateHash(url);
        await addHashToTracking(hash);
      } catch (error) {
        console.error('Torrent Snag: Failed to track hash for:', url, error);
      }
    }
    
    // Clear detected links and badge
    if (tabId) {
      await chrome.tabs.sendMessage(tabId, { type: 'CLEAR_DETECTED_LINKS' });
      await badgeManager.clearBadge(tabId);
    }
    
    // Show success notification
    const config = await chrome.storage.local.get(['config']);
    const selectedHandler = config.config?.selectedHandler || 'handler';
    const handlerName = HandlerFactory.getAvailableHandlers().find(h => h.id === selectedHandler)?.name || selectedHandler;
    
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-48.png',
      title: 'Torrent Snag',
      message: `Successfully processed ${result.count} torrents with ${handlerName}`
    });
    
    return { success: true, count: result.count };
    
  } catch (error) {
    console.error('Torrent Snag: Failed to send torrents:', error);
    
    if (tabId) {
      await badgeManager.updateBadge(tabId, 0, true);
    }
    
    throw error;
  }
}

async function testHandlerConnection(handlerType, handlerConfig) {
  try {
    if (!handlerType || !handlerConfig) {
      return { success: false, error: 'Missing handler type or configuration' };
    }
    
    const handler = HandlerFactory.createHandler(handlerType, handlerConfig);
    handler.isTesting = true; // Suppress notifications during testing
    
    const testResult = await handler.testConnection();
    
    // Handle both boolean and object responses
    if (typeof testResult === 'boolean') {
      if (!testResult) {
        const handlerName = HandlerFactory.getAvailableHandlers().find(h => h.id === handlerType)?.name || handlerType;
        return { success: false, error: `Failed to connect to ${handlerName}. Check configuration and service availability.` };
      }
      return { success: true };
    } else if (typeof testResult === 'object') {
      // Return the detailed test result object
      return testResult;
    }
    
    return { success: true };
  } catch (error) {
    console.error('Handler test connection error:', error);
    
    // Provide more helpful error messages for common issues
    let errorMessage = error.message || 'Unknown connection error';
    let suggestions = [];
    
    if (error.message && error.message.includes('Failed to fetch')) {
      errorMessage = 'Network connection failed';
      suggestions = [
        'Check if the service is running and accessible',
        'Verify the URL and port are correct',
        'Check for firewall or network restrictions'
      ];
    }
    
    return { 
      success: false, 
      error: errorMessage,
      suggestions: suggestions.length > 0 ? suggestions : undefined
    };
  }
}

async function generateHash(url) {
  if (url.startsWith('magnet:')) {
    const btihMatch = url.match(/btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})/i);
    if (btihMatch) {
      return btihMatch[1].toLowerCase();
    }
  }
  
  const encoder = new TextEncoder();
  const data = encoder.encode(url.toLowerCase().split('?')[0]);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function addHashToTracking(hash) {
  const data = await chrome.storage.local.get(['duplicateTracking']);
  const tracking = data.duplicateTracking || { 
    sentHashes: {}, 
    lastCleared: new Date().toISOString(), 
    maxEntries: 10000 
  };
  
  tracking.sentHashes[hash] = {
    timestamp: new Date().toISOString(),
    count: (tracking.sentHashes[hash]?.count || 0) + 1
  };
  
  await chrome.storage.local.set({ duplicateTracking: tracking });
}

async function cleanupDuplicateTracking() {
  try {
    const data = await chrome.storage.local.get(['duplicateTracking']);
    const tracking = data.duplicateTracking;
    
    if (!tracking?.sentHashes) return;

    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const cleaned = {};
    
    for (const [hash, hashData] of Object.entries(tracking.sentHashes)) {
      if (new Date(hashData.timestamp).getTime() > thirtyDaysAgo) {
        cleaned[hash] = hashData;
      }
    }
    
    // If still too large, keep only most recent 5000 entries
    if (Object.keys(cleaned).length > 5000) {
      const sorted = Object.entries(cleaned)
        .sort((a, b) => new Date(b[1].timestamp) - new Date(a[1].timestamp))
        .slice(0, 5000);
      
      tracking.sentHashes = Object.fromEntries(sorted);
    } else {
      tracking.sentHashes = cleaned;
    }
    
    tracking.lastCleared = new Date().toISOString();
    await chrome.storage.local.set({ duplicateTracking: tracking });
    
  } catch (error) {
    console.error('Torrent Snag: Cleanup failed:', error);
  }
}

// Initialize service worker
serviceWorkerState.initialize();
