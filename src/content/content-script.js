// Content script for detecting torrent and magnet links
(async () => {
  'use strict';

  let config;
  let detectedLinks = new Set();
  let isScanning = false;
  let scanDebounceTimer = null;
  let currentUrl = window.location.href;

  // Initialize
  await initializeContentScript();

  async function initializeContentScript() {
    try {
      config = await configUtils.getConfig();
      setupMutationObserver();
      await scanPage();
    } catch (error) {
      console.error('Torrent Snag: Failed to initialize:', error);
    }
  }

  function setupMutationObserver() {
    const observer = new MutationObserver((mutations) => {
      let shouldScan = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if added nodes contain links
              if (node.tagName === 'A' || node.querySelector('a[href]')) {
                shouldScan = true;
              }
            }
          });
        }
      });

      if (shouldScan) {
        debouncedScan();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function debouncedScan() {
    if (scanDebounceTimer) {
      clearTimeout(scanDebounceTimer);
    }
    
    scanDebounceTimer = setTimeout(() => {
      scanPage();
    }, config.performance.debounceDelay);
  }

  async function scanPage() {
    if (isScanning) return;
    
    // Check if URL changed (for SPA navigation)
    if (window.location.href !== currentUrl) {
      detectedLinks.clear();
      currentUrl = window.location.href;
    }
    
    isScanning = true;
    
    try {
      const newLinks = await detectLinksInChunks();
      const filteredLinks = await filterNewLinks(newLinks);
      
      // Only add truly new links to avoid duplicates
      const currentCount = detectedLinks.size;
      filteredLinks.forEach(link => {
        // Check if link with same URL already exists
        const isDuplicate = Array.from(detectedLinks).some(existing => existing.url === link.url);
        if (!isDuplicate) {
          detectedLinks.add(link);
        }
      });
      
      
      // Update badge and store detected links
      await updateBadgeAndStorage();
      
    } catch (error) {
      console.error('Torrent Snag: Scan failed:', error);
    } finally {
      isScanning = false;
    }
  }

  async function detectLinksInChunks() {
    const allLinks = document.querySelectorAll('a[href], [href]');
    const detected = new Set();
    const chunkSize = config.performance.chunkSize;
    
    // Compile regex patterns for better performance
    const compiledPatterns = config.patterns
      .filter(p => p.enabled)
      .map(p => ({
        ...p,
        compiledRegex: new RegExp(p.regex, 'gi')
      }));

    // Compile filter patterns for filtering out unwanted torrents
    const compiledFilters = (config.filters || [])
      .filter(f => f.enabled)
      .map(f => ({
        ...f,
        compiledRegex: new RegExp(f.regex, 'gi')
      }));

    for (let i = 0; i < allLinks.length && detected.size < config.performance.maxLinksPerScan; i += chunkSize) {
      const chunk = Array.from(allLinks).slice(i, i + chunkSize);
      
      chunk.forEach(element => {
        if (element.href) {
          compiledPatterns.forEach(pattern => {
            if (pattern.compiledRegex.test(element.href)) {
              const elementText = element.textContent?.trim() || '';
              
              // Check if any filter matches the link text or URL
              const shouldSkip = compiledFilters.some(filter => {
                filter.compiledRegex.lastIndex = 0; // Reset regex state
                return filter.compiledRegex.test(elementText) || filter.compiledRegex.test(element.href);
              });
              
              if (!shouldSkip) {
                detected.add({
                  url: element.href,
                  patternId: pattern.id,
                  elementText: elementText,
                  timestamp: new Date().toISOString()
                });
              } else {
              }
            }
          });
        }
      });
      
      // Yield control back to browser between chunks
      if (i + chunkSize < allLinks.length) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    return Array.from(detected);
  }

  async function filterNewLinks(links) {
    const newLinks = [];
    
    for (const link of links) {
      try {
        // Check if extension context is still valid
        if (!chrome.runtime?.id) {
          console.warn('Torrent Snag: Extension context invalidated, skipping hash generation');
          return links; // Return all links without duplicate checking
        }
        
        // Check if hashUtils is available
        if (typeof hashUtils === 'undefined' || typeof duplicateTracker === 'undefined') {
          console.warn('Torrent Snag: Hash utilities not available, skipping duplicate checking');
          newLinks.push({
            url: link.url,
            hash: null,
            timestamp: Date.now()
          });
          continue;
        }
        
        const hash = await hashUtils.generateHash(link.url);
        const isDuplicate = await duplicateTracker.hasHash(hash);
        
        if (!isDuplicate) {
          newLinks.push({
            ...link,
            hash
          });
        }
      } catch (error) {
        // If extension context is invalidated, just include the link without hash checking
        if (error.message?.includes('Extension context invalidated')) {
          console.warn('Torrent Snag: Extension context invalidated, including link without duplicate check:', link.url);
          newLinks.push(link);
        } else {
          console.error('Torrent Snag: Failed to generate hash for:', link.url, error);
          // Include link anyway to avoid losing it
          newLinks.push(link);
        }
      }
    }
    
    return newLinks;
  }

  async function updateBadgeAndStorage() {
    try {
      // Check if extension context is still valid
      if (!chrome.runtime?.id) {
        return;
      }
      
      const linkArray = Array.from(detectedLinks);
      const count = linkArray.length;
      
      // Store detected links for this tab
      await chrome.storage.local.set({
        [`detectedLinks_${getTabId()}`]: linkArray
      });
      
      // Send message to background script to update badge
      chrome.runtime.sendMessage({
        type: 'UPDATE_BADGE',
        count: count,
        tabId: getTabId()
      });
    } catch (error) {
      if (error.message?.includes('Extension context invalidated') || !chrome.runtime?.id) {
        console.warn('Torrent Snag: Extension context invalidated during badge update');
      } else {
        console.error('Torrent Snag: Failed to update badge and storage:', error);
        throw error;
      }
    }
  }

  function getTabId() {
    // For content scripts, we'll use the URL as identifier since we can't directly access tab ID
    // Background script will map this to actual tab ID
    return btoa(window.location.href).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
  }

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'GET_DETECTED_LINKS':
        sendResponse({
          links: Array.from(detectedLinks),
          count: detectedLinks.size
        });
        break;
        
      case 'CLEAR_DETECTED_LINKS':
        detectedLinks.clear();
        updateBadgeAndStorage();
        sendResponse({ success: true });
        break;
        
      case 'REMOVE_DETECTED_LINK':
        // Remove specific link from detected links
        const urlToRemove = message.url;
        const linkToRemove = Array.from(detectedLinks).find(link => link.url === urlToRemove);
        if (linkToRemove) {
          detectedLinks.delete(linkToRemove);
          updateBadgeAndStorage();
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'Link not found' });
        }
        break;
        
      case 'RESCAN_PAGE':
        scanPage().then(() => {
          sendResponse({ success: true });
        });
        return true; // Indicates async response
        
      case 'CONFIG_UPDATED':
        configUtils.getConfig().then(newConfig => {
          config = newConfig;
          scanPage(); // Rescan with new patterns
        });
        break;
    }
  });

  // Handle page visibility changes
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      // Page became visible, rescan after a short delay
      setTimeout(scanPage, 1000);
    }
  });

  // Initial scan when page is fully loaded
  if (document.readyState === 'complete') {
    setTimeout(scanPage, 1000);
  } else {
    window.addEventListener('load', () => {
      setTimeout(scanPage, 1000);
    });
  }
})();
