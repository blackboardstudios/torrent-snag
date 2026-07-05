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
importScripts('../utils/config.js');
importScripts('../utils/hash.js');
importScripts('../utils/constants.js');
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
      const data = await chrome.storage.local.get([STORAGE_KEYS.CONFIG, STORAGE_KEYS.DUPLICATE_TRACKING]);
      // Use merged config to avoid partial state issues
      try {
        this.config = await configUtils.getConfig();
      } catch (_) {
        this.config = data.config;
      }
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
    const appConfig = await configUtils.getConfig();
    
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
chrome.runtime.onInstalled.addListener(async (details) => {
  await serviceWorkerState.initialize();
  try {
    await duplicateTracker.cleanupOldHashes();
  } catch (error) {
    console.error('Torrent Snag: Duplicate cleanup failed during install:', error);
  }

  // Only initialize default config on fresh install, or if missing
  try {
    const { config } = await chrome.storage.local.get([STORAGE_KEYS.CONFIG]);
    const isFreshInstall = details?.reason === 'install';
    if (isFreshInstall || !config) {
      await initializeDefaultConfig();
    }
  } catch (e) {
    // As a safety net, attempt to initialize defaults if read failed
    await initializeDefaultConfig();
  }

  // Setup context menus (extension icon only, no link menus)
  await contextMenuUtils.setupContextMenus();
});

chrome.runtime.onStartup.addListener(async () => {
  await serviceWorkerState.initialize();
  try {
    await duplicateTracker.cleanupOldHashes();
  } catch (error) {
    console.error('Torrent Snag: Duplicate cleanup failed during startup:', error);
  }
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
    case MESSAGE_TYPES.GET_TAB_ID:
      sendResponse({ tabId: sender.tab?.id ?? null });
      break;

    case MESSAGE_TYPES.UPDATE_BADGE:
      badgeManager.updateBadge(sender.tab?.id, message.count);
      break;
      
    case MESSAGE_TYPES.SEND_TORRENTS:
      // Handle both old format (links array) and new format (torrents array with labels)
      const targetTabId = message.tabId || sender.tab?.id;
      if (message.torrents && Array.isArray(message.torrents)) {
        // New format with labels
        const urls = message.torrents.map(t => t.url);
        const labels = message.torrents.map(t => t.label || '');
        sendTorrentsToHandler(urls, targetTabId, labels)
          .then(sendResponse)
          .catch(error => sendResponse({ success: false, error: error.message }));
      } else if (message.links && Array.isArray(message.links)) {
        // Old format for backward compatibility
        sendTorrentsToHandler(message.links, targetTabId)
          .then(sendResponse)
          .catch(error => sendResponse({ success: false, error: error.message }));
      } else {
        sendResponse({ success: false, error: 'Invalid message format' });
      }
      return true; // Indicates async response
      
    case MESSAGE_TYPES.TEST_CONNECTION:
      testHandlerConnection(message.handlerType, message.config)
        .then(sendResponse)
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
      
    case MESSAGE_TYPES.OPEN_REVIEW_POPUP:
      openReviewPopup(message.tabId);
      sendResponse({ success: true });
      break;
      
    case MESSAGE_TYPES.HANDLER_CONFIG_CHANGED:
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

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.remove(`${STORAGE_KEYS.DETECTED_LINKS_PREFIX}tab_${tabId}`)
    .catch(() => {});
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



// Core functions
async function initializeDefaultConfig() {
  // Do not overwrite existing user configuration
  const existing = await chrome.storage.local.get([STORAGE_KEYS.CONFIG]);
  if (existing && existing.config) {
    return;
  }

  const defaultConfig = await configUtils.getConfig();
  await configUtils.setConfig(defaultConfig);
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
      [STORAGE_KEYS.REVIEW_POPUP_TAB_ID]: tabId,
      [STORAGE_KEYS.REVIEW_POPUP_WINDOW_ID]: popup.id
    });
    
  } catch (error) {
    console.error('Failed to open review popup:', error);
    // Fallback: show notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'assets/icons/icon-48.png',
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
        iconUrl: 'assets/icons/icon-48.png',
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

function normalizeHandlerResult(urls, _labels, result = {}) {
  const totalCount = Array.isArray(urls) ? urls.length : 0;
  const normalized = {
    successfulUrls: [],
    failedResults: [],
    results: [],
    successCount: 0,
    totalCount,
    allSucceeded: false,
    allFailed: false,
    partiallySucceeded: false
  };

  const results = Array.isArray(result.results) ? result.results : null;

  if (!results) {
    if (typeof result.count === 'number' && result.count === totalCount) {
      normalized.successfulUrls = urls.slice();
      normalized.results = urls.map((url) => ({ url, success: true }));
      normalized.successCount = totalCount;
      normalized.allSucceeded = true;
      return normalized;
    }

    normalized.allFailed = totalCount > 0;
    normalized.failedResults = urls.map((url) => ({
      url,
      success: false,
      error: result.error || 'Failed to send torrent'
    }));
    normalized.results = normalized.failedResults;
    return normalized;
  }

  results.forEach((item, index) => {
    const url = urls[index];
    if (!url) {
      return;
    }

    if (item && item.success === true) {
      normalized.successfulUrls.push(url);
      normalized.results.push({ ...item, url, success: true });
      normalized.successCount += 1;
      return;
    }

    const failedResult = {
      url,
      success: false,
      error: item?.error || item?.message || 'Failed to send torrent'
    };
    normalized.failedResults.push(failedResult);
    normalized.results.push(failedResult);
  });

  for (let i = results.length; i < totalCount; i += 1) {
    const failedResult = {
      url: urls[i],
      success: false,
      error: 'Missing result details for torrent'
    };
    normalized.failedResults.push(failedResult);
    normalized.results.push(failedResult);
  }

  if (normalized.successCount === normalized.totalCount && normalized.totalCount > 0) {
    normalized.allSucceeded = true;
  } else if (normalized.successCount === 0 && normalized.failedResults.length === normalized.totalCount) {
    normalized.allFailed = true;
  } else if (normalized.successCount > 0 && normalized.failedResults.length > 0) {
    normalized.partiallySucceeded = true;
  } else if (normalized.totalCount === 0 && result.count === 0) {
    normalized.allSucceeded = true;
  }

  return normalized;
}

async function sendTorrentsToHandler(urls, tabId, labels = []) {
  try {
    const handler = await createCurrentHandler();
    
    const result = await handler.addTorrents(urls, labels);
    const normalized = normalizeHandlerResult(urls, labels, result);

    const urlsToTrack = normalized.successfulUrls;

    await Promise.all(urlsToTrack.map(async (url) => {
      try {
        const hash = await hashUtils.generateHash(url);
        await duplicateTracker.addHash(hash);
      } catch (error) {
        console.error('Torrent Snag: Failed to track hash for:', url, error);
      }
    }));

    const failedCount = normalized.totalCount - normalized.successCount;

    if (tabId) {
      if (normalized.allSucceeded) {
        try {
          await chrome.tabs.sendMessage(tabId, { type: MESSAGE_TYPES.CLEAR_DETECTED_LINKS });
        } catch (e) {
          // Tab may not have our content script; ignore
        }
        await badgeManager.clearBadge(tabId);
      } else if (normalized.partiallySucceeded) {
        if (urlsToTrack.length > 0) {
          try {
            await chrome.tabs.sendMessage(tabId, {
              type: MESSAGE_TYPES.REMOVE_DETECTED_LINKS,
              urls: urlsToTrack
            });
          } catch (e) {
            // Tab may not have our content script; keep the partial result non-fatal.
          }
        }
        await badgeManager.updateBadge(tabId, failedCount, false);
      } else if (normalized.allFailed) {
        await badgeManager.updateBadge(tabId, failedCount, true);
      }
    }

    // Show notification
    const mergedConfig = await configUtils.getConfig();
    const selectedHandler = mergedConfig.selectedHandler || 'qbittorrent';
    const handlerName = HandlerFactory.getAvailableHandlers().find(h => h.id === selectedHandler)?.name || selectedHandler;

    const notificationMessage = normalized.allSucceeded
      ? `Successfully processed ${normalized.successCount} torrents with ${handlerName}`
      : normalized.partiallySucceeded
        ? `Processed ${normalized.successCount} of ${normalized.totalCount} torrents; ${failedCount} failed with ${handlerName}`
        : `Failed to process torrents with ${handlerName}: ${normalized.failedResults[0]?.error || 'Unknown error'}`;
    
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'assets/icons/icon-48.png',
      title: 'Torrent Snag',
      message: notificationMessage
    });

    if (normalized.allSucceeded) {
      return {
        success: true,
        count: normalized.successCount,
        total: normalized.totalCount,
        failed: 0,
        results: normalized.results
      };
    }

    if (normalized.partiallySucceeded) {
      return {
        success: false,
        partial: true,
        count: normalized.successCount,
        total: normalized.totalCount,
        failed: failedCount,
        results: normalized.results
      };
    }

    return {
      success: false,
      count: 0,
      total: normalized.totalCount,
      failed: failedCount,
      results: normalized.results,
      error: normalized.failedResults[0]?.error || 'Unknown error'
    };
    
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



// Initialize service worker
serviceWorkerState.initialize();
