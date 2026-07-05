// Content script for detecting torrent and magnet links
(async () => {
  'use strict';

  let config;
  let detectedLinks = new Set();
  let isScanning = false;
  let scanDebounceTimer = null;
  let initializationPromise = null;
  let isInitialized = false;
  let currentUrl = window.location.href;
  let storageKey = null;
  let storageScopeId = null;
  let isTabScoped = false;
  let mutationObserver = null;
  let extensionContextInvalidated = false;
  let compiledPatternCache = null;
  let compiledFilterCache = null;
  let compiledConfigSignature = null;
  const detectedLinksPrefix = typeof STORAGE_KEYS !== 'undefined' && STORAGE_KEYS?.DETECTED_LINKS_PREFIX
    ? STORAGE_KEYS.DETECTED_LINKS_PREFIX
    : 'detectedLinks_';

  async function initializeContentScript() {
    if (initializationPromise) {
      return initializationPromise;
    }

    initializationPromise = initialize();
    return initializationPromise;
  }

  async function scanWhenReady() {
    try {
      await initializationPromise;
      if (!isInitialized || extensionContextInvalidated) {
        return;
      }

      return scanPage();
    } catch (error) {
      if (isExtensionContextError(error) || !isExtensionContextValid()) {
        markExtensionContextInvalidated();
        return;
      }
      throw error;
    }
  }

  async function getStorageScopeId() {
    try {
      const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_TAB_ID });
      const tabId = response?.tabId;

      if (typeof tabId === 'number' && Number.isInteger(tabId)) {
        return { scopeId: `tab_${tabId}`, isTabScoped: true };
      }
    } catch (error) {
      if (isExtensionContextError(error)) {
        markExtensionContextInvalidated();
      }
    }

    const fallbackScopeId = await computeUrlFallbackScopeId(window.location.href);
    return { scopeId: `url_${fallbackScopeId}`, isTabScoped: false };
  }

  async function computeUrlFallbackScopeId(url) {
    const encoder = new TextEncoder();
    const encodedUrl = encoder.encode(url);
    const subtle = (typeof crypto !== 'undefined' && crypto.subtle) || (typeof window !== 'undefined' && window.crypto?.subtle);
    const hashBuffer = await subtle.digest('SHA-256', encodedUrl);
    const hashArray = new Uint8Array(hashBuffer);
    return Array.from(hashArray).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  function getStorageKey() {
    if (!storageScopeId) {
      return null;
    }

    return `${detectedLinksPrefix}${storageScopeId}`;
  }

  async function removeStorageKey(keyToRemove) {
    if (!keyToRemove || !isExtensionContextValid()) {
      return;
    }

    try {
      await chrome.storage.local.remove(keyToRemove);
    } catch (error) {
      if (isExtensionContextError(error) || !isExtensionContextValid()) {
        markExtensionContextInvalidated();
      }
    }
  }

  async function clearCurrentStorage() {
    detectedLinks.clear();
    await removeStorageKey(storageKey);
  }

  async function maybeUpdateStorageScopeOnNavigation() {
    const previousStorageKey = storageKey;

    detectedLinks.clear();
    currentUrl = window.location.href;

    if (!isTabScoped) {
      const fallbackScopeId = `url_${await computeUrlFallbackScopeId(window.location.href)}`;
      storageScopeId = fallbackScopeId;
      storageKey = getStorageKey();
    }

    await removeStorageKey(previousStorageKey);
    await loadFromStorage();
  }

  async function initialize() {
    try {
      config = await configUtils.getConfig();
      const storageScope = await getStorageScopeId();
      storageScopeId = storageScope.scopeId;
      isTabScoped = storageScope.isTabScoped;
      storageKey = getStorageKey();
      await loadFromStorage();
      setupMutationObserver();
      await scanPage();
      isInitialized = true;
    } catch (error) {
      if (isExtensionContextError(error) || !isExtensionContextValid()) {
        markExtensionContextInvalidated();
        return;
      }
      console.error('Torrent Snag: Failed to initialize:', error);
    }
  }

  async function loadFromStorage() {
    try {
      if (!storageKey) {
        return;
      }
      const stored = await chrome.storage.local.get([storageKey]);
      if (stored[storageKey] && Array.isArray(stored[storageKey])) {
        detectedLinks = new Set(stored[storageKey].map(link => ({ ...link })));
      }
    } catch (error) {
      if (isExtensionContextError(error)) {
        markExtensionContextInvalidated();
        return;
      }
      console.warn('Torrent Snag: Failed to load from storage:', error);
    }
  }

  async function saveToStorage() {
    try {
      if (!isExtensionContextValid()) return;
      if (!storageKey) {
        return;
      }

      const linkArray = Array.from(detectedLinks);
      if (linkArray.length === 0) {
        await chrome.storage.local.remove(storageKey);
        return;
      }

      await chrome.storage.local.set({ [storageKey]: linkArray });
    } catch (error) {
      if (isExtensionContextError(error) || !isExtensionContextValid()) {
        markExtensionContextInvalidated();
      } else {
        console.error('Torrent Snag: Failed to save to storage:', error);
      }
    }
  }

  function setupMutationObserver() {
    mutationObserver = new MutationObserver((mutations) => {
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

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function debouncedScan() {
    if (extensionContextInvalidated || !isInitialized || !config) return;

    if (scanDebounceTimer) {
      clearTimeout(scanDebounceTimer);
    }
    
    scanDebounceTimer = setTimeout(() => {
      scanWhenReady();
    }, config.performance.debounceDelay);
  }

  async function scanPage() {
    if (isScanning || extensionContextInvalidated) return;
    if (!config) return;
    if (!isExtensionContextValid()) {
      markExtensionContextInvalidated();
      return;
    }

    // Check if URL changed (for SPA navigation)
    if (window.location.href !== currentUrl) {
      try {
        await maybeUpdateStorageScopeOnNavigation();
      } catch (error) {
        if (isExtensionContextError(error) || !isExtensionContextValid()) {
          markExtensionContextInvalidated();
          return;
        }
        console.warn('Torrent Snag: Failed to refresh storage scope for navigation:', error);
      }
    }

    isScanning = true;

    try {
      const newLinks = await detectLinksInChunks();
      const filteredLinks = await filterNewLinks(newLinks);
      const currentContentKeys = new Set(filteredLinks.map(link => getContentKey(link.url)));
      detectedLinks = new Set(
        Array.from(detectedLinks).filter(link => currentContentKeys.has(getContentKey(link.url)))
      );

      // Only add truly new links to avoid duplicates
      for (const link of filteredLinks) {
        const contentKey = getContentKey(link.url);
        const isDuplicate = Array.from(detectedLinks).some(existing => getContentKey(existing.url) === contentKey);
        if (!isDuplicate) {
          detectedLinks.add(link);
        }
      }

      // Update badge and store detected links
      await updateBadgeAndStorage();

    } catch (error) {
      if (isExtensionContextError(error) || !isExtensionContextValid()) {
        markExtensionContextInvalidated();
        return;
      }
      console.error('Torrent Snag: Scan failed:', error);
    } finally {
      isScanning = false;
    }
  }

  // CSS selectors for elements that typically contain non-primary torrent links
  // (ads, sidebars, related torrents widgets, footers, etc.)
  const EXCLUDED_CONTAINER_SELECTORS = [
    '.adblock',
    '.ad120',
    '.ad728',
    '.ad468',
    '.ad234',
    '.ad-container',
    '.ad-wrapper',
    '.ads',
    '.advertisement',
    'footer',
    'header',
    'aside',
    '.sidebar',
    '.widget',
    '.recent-torrents',
    '.related-torrents',
    '.similar-torrents',
    '.col-left',
    '.col-right',
    '#ad-bottom',
    '#ad-top',
    '#had468',
    '#had234'
  ];

  const DETAIL_ROOT_SELECTORS = [
    '[id*="description" i]',
    '[class*="description" i]',
    '[id*="detail" i]',
    '[class*="detail" i]',
    '[id*="torrent" i]',
    '[class*="torrent" i]',
    'article'
  ];

  const CONTENT_ROOT_SELECTORS = [
    'main',
    '[role="main"]',
    '#content',
    '.content',
    '[id*="content" i]',
    '[class*="content" i]'
  ];

  function isInExcludedContainer(element) {
    for (const selector of EXCLUDED_CONTAINER_SELECTORS) {
      if (element.closest(selector)) {
        return true;
      }
    }
    return false;
  }

  function hrefMatchesEnabledPattern(href, compiledPatterns) {
    return compiledPatterns.some(pattern => {
      pattern.compiledRegex.lastIndex = 0;
      return pattern.compiledRegex.test(href);
    });
  }

  function rootContainsMatchingLink(root, compiledPatterns) {
    const elements = [];

    if (root.matches?.('[href]')) {
      elements.push(root);
    }
    elements.push(...root.querySelectorAll('a[href], [href]'));

    return elements.some(element => {
      if (!element.href || isInExcludedContainer(element)) {
        return false;
      }
      return hrefMatchesEnabledPattern(element.href, compiledPatterns);
    });
  }

  function removeNestedRoots(roots) {
    return roots.filter(root => !roots.some(other => other !== root && other.contains(root)));
  }

  function getMatchingRoots(selectors, compiledPatterns) {
    const roots = new Set();

    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(root => {
        if (!isInExcludedContainer(root) && rootContainsMatchingLink(root, compiledPatterns)) {
          roots.add(root);
        }
      });
    });

    return removeNestedRoots(Array.from(roots));
  }

  function getDetectionRoots(compiledPatterns) {
    const detailRoots = getMatchingRoots(DETAIL_ROOT_SELECTORS, compiledPatterns);
    if (detailRoots.length > 0) {
      return detailRoots;
    }

    const contentRoots = getMatchingRoots(CONTENT_ROOT_SELECTORS, compiledPatterns);
    if (contentRoots.length > 0) {
      return contentRoots;
    }

    return [document];
  }

  function getCandidateLinkElements(compiledPatterns) {
    const elements = new Set();

    getDetectionRoots(compiledPatterns).forEach(root => {
      if (root.matches?.('[href]')) {
        elements.add(root);
      }
      root.querySelectorAll('a[href], [href]').forEach(element => elements.add(element));
    });

    return Array.from(elements);
  }

  function getConfigSignature(targetConfig) {
    const safeConfig = targetConfig || {};
    const normalizeItems = (items) => {
      return (Array.isArray(items) ? items : [])
        .map(item => ({
          id: item?.id,
          regex: item?.regex,
          enabled: item?.enabled
        }));
    };

    return JSON.stringify({
      patterns: normalizeItems(safeConfig.patterns),
      filters: normalizeItems(safeConfig.filters)
    });
  }

  function getCompiledRules() {
    const nextSignature = getConfigSignature(config);
    if (
      nextSignature === compiledConfigSignature &&
      compiledPatternCache !== null &&
      compiledFilterCache !== null
    ) {
      return {
        compiledPatterns: compiledPatternCache,
        compiledFilters: compiledFilterCache
      };
    }

    const compiledPatterns = (config.patterns || [])
      .filter(p => p.enabled)
      .map((p) => ({
        ...p,
        compiledRegex: new RegExp(p.regex, 'i')
      }));

    const compiledFilters = (config.filters || [])
      .filter(f => f.enabled)
      .map((f) => ({
        ...f,
        compiledRegex: new RegExp(f.regex, 'i')
      }));

    compiledPatternCache = compiledPatterns;
    compiledFilterCache = compiledFilters;
    compiledConfigSignature = nextSignature;

    return {
      compiledPatterns,
      compiledFilters
    };
  }

  async function detectLinksInChunks() {
    const detected = new Set();
    const chunkSize = config.performance.chunkSize;
    const { compiledPatterns, compiledFilters } = getCompiledRules();

    const allLinks = getCandidateLinkElements(compiledPatterns);

    for (let i = 0; i < allLinks.length && detected.size < config.performance.maxLinksPerScan; i += chunkSize) {
      const chunk = allLinks.slice(i, i + chunkSize);
      
      chunk.forEach(element => {
        if (element.href) {
          const href = element.href;
          
          // Skip links within excluded containers (ads, sidebars, widgets, etc.)
          if (isInExcludedContainer(element)) {
            return;
          }
          
          compiledPatterns.forEach(pattern => {
            // Reset lastIndex defensively in case a pattern was created with 'g'
            pattern.compiledRegex.lastIndex = 0;
            if (pattern.compiledRegex.test(href)) {
              const elementText = element.textContent?.trim() || '';
              
              // Check if any filter matches the link text or URL
              const shouldSkip = compiledFilters.some(filter => {
                filter.compiledRegex.lastIndex = 0; // Reset regex state
                return filter.compiledRegex.test(elementText) || filter.compiledRegex.test(href);
              });
              
              if (!shouldSkip) {
                detected.add({
                  url: href,
                  patternId: pattern.id,
                  elementText: elementText,
                  timestamp: new Date().toISOString()
                });
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

    if (!isExtensionContextValid()) {
      markExtensionContextInvalidated();
      return newLinks;
    }
    
    for (const link of links) {
      try {
        // Check if extension context is still valid
        if (!isExtensionContextValid()) {
          markExtensionContextInvalidated();
          return newLinks;
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
        if (isExtensionContextError(error) || !isExtensionContextValid()) {
          markExtensionContextInvalidated();
          return newLinks;
        } else {
          console.error('Torrent Snag: Failed to generate hash for:', link.url, error);
          // Include link anyway to avoid losing it
          newLinks.push({ ...link, hash: null });
        }
      }
    }
    
    return newLinks;
  }

  async function updateBadgeAndStorage() {
    try {
      if (!isExtensionContextValid()) {
        markExtensionContextInvalidated();
        return;
      }
      
      const count = detectedLinks.size;
      
      await saveToStorage();
      
      chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.UPDATE_BADGE,
        count: count
      });
    } catch (error) {
      if (isExtensionContextError(error) || !isExtensionContextValid()) {
        markExtensionContextInvalidated();
      } else {
        console.error('Torrent Snag: Failed to update badge and storage:', error);
        throw error;
      }
    }
  }

  function isExtensionContextValid() {
    try {
      return !extensionContextInvalidated && !!chrome.runtime?.id;
    } catch {
      return false;
    }
  }

  function isExtensionContextError(error) {
    return error?.message?.includes('Extension context invalidated');
  }

  function markExtensionContextInvalidated() {
    extensionContextInvalidated = true;
    if (scanDebounceTimer) {
      clearTimeout(scanDebounceTimer);
      scanDebounceTimer = null;
    }
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }
  }

  function getContentKey(url) {
    // Normalize a torrent URL to a content identifier so multiple links pointing
    // to the same torrent (e.g. magnet links with different tracker lists) are
    // counted as a single torrent.
    if (url.startsWith('magnet:')) {
      const btihMatch = url.match(/btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})/i);
      if (btihMatch) {
        return 'magnet:' + btihMatch[1].toLowerCase();
      }
    }
    try {
      const urlObj = new URL(url);
      return urlObj.origin + urlObj.pathname + urlObj.search;
    } catch {
      return url;
    }
  }

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    switch (message.type) {
      case MESSAGE_TYPES.GET_DETECTED_LINKS:
        sendResponse({
          links: Array.from(detectedLinks),
          count: detectedLinks.size
        });
        break;
        
      case MESSAGE_TYPES.CLEAR_DETECTED_LINKS:
        clearCurrentStorage().then(() => {
          sendResponse({ success: true });
        }).catch(() => {
          sendResponse({ success: false, error: 'Failed to clear links' });
        });
        return true;
        
      case MESSAGE_TYPES.REMOVE_DETECTED_LINK:
        const urlToRemove = message.url;
        const linkToRemove = Array.from(detectedLinks).find(link => link.url === urlToRemove);
        if (linkToRemove) {
          detectedLinks.delete(linkToRemove);
          saveToStorage().then(() => {
            sendResponse({ success: true });
          }).catch(() => {
            sendResponse({ success: false, error: 'Failed to update storage' });
          });
          return true;
        } else {
          sendResponse({ success: false, error: 'Link not found' });
        }
        break;

      case MESSAGE_TYPES.REMOVE_DETECTED_LINKS:
        const urlsToRemove = Array.isArray(message.urls) ? new Set(message.urls) : new Set();
        const beforeCount = detectedLinks.size;
        if (urlsToRemove.size > 0) {
          detectedLinks = new Set(Array.from(detectedLinks).filter(link => !urlsToRemove.has(link.url)));
        }

        const afterCount = detectedLinks.size;
        if (beforeCount === afterCount) {
          sendResponse({ success: false, error: 'No matching links found' });
          break;
        }

        saveToStorage().then(() => {
          sendResponse({ success: true, removedCount: beforeCount - afterCount });
        }).catch(() => {
          sendResponse({ success: false, error: 'Failed to update storage' });
        });
        return true;
        
      case MESSAGE_TYPES.RESCAN_PAGE:
        scanWhenReady().then(() => {
          sendResponse({ success: true });
        });
        return true;
        
      case MESSAGE_TYPES.CONFIG_UPDATED:
        compiledPatternCache = null;
        compiledFilterCache = null;
        compiledConfigSignature = null;
        configUtils.getConfig().then(newConfig => {
          config = newConfig;
          scanWhenReady();
        });
        break;
    }
  });

  // Handle page visibility changes
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      // Page became visible, rescan after a short delay
      setTimeout(scanWhenReady, 1000);
    }
  });

  // Initial scan when page is fully loaded
  if (document.readyState === 'complete') {
    setTimeout(scanWhenReady, 1000);
  } else {
    window.addEventListener('load', () => {
      setTimeout(scanWhenReady, 1000);
    });
  }

  await initializeContentScript();
})();
