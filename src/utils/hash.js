// Hash generation utilities for duplicate tracking

const hashUtils = {
  async generateHash(url) {
    if (url.startsWith('magnet:')) {
      // Extract btih hash - handle both formats (hex and base32)
      const btihMatch = url.match(/btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})/i);
      if (btihMatch) {
        return btihMatch[1].toLowerCase();
      }
    }
    
    // For .torrent URLs, use Web Crypto API for consistent hashing
    const encoder = new TextEncoder();
    const data = encoder.encode(url.toLowerCase().split('?')[0]);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  extractMagnetHash(magnetUrl) {
    const btihMatch = magnetUrl.match(/btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})/i);
    return btihMatch ? btihMatch[1].toLowerCase() : null;
  }
};

// Duplicate tracking utilities
const duplicateTracker = {
  async addHash(hash, metadata = {}) {
    try {
      // Check if extension context is still valid
      if (!chrome.runtime?.id) {
        console.warn('Torrent Snag: Extension context invalidated, cannot add hash to tracking');
        return;
      }
      
      const data = await chrome.storage.local.get(['duplicateTracking']);
      const tracking = data.duplicateTracking || { 
        sentHashes: {}, 
        lastCleared: new Date().toISOString(), 
        maxEntries: 10000 
      };
      
      tracking.sentHashes[hash] = {
        timestamp: new Date().toISOString(),
        count: (tracking.sentHashes[hash]?.count || 0) + 1,
        ...metadata
      };
      
      await chrome.storage.local.set({ duplicateTracking: tracking });
    } catch (error) {
      console.error('Torrent Snag: Failed to add hash to tracking:', error);
    }
  },
  
  async hasHash(hash) {
    try {
      // Check if extension context is still valid
      if (!chrome.runtime?.id) {
        console.warn('Torrent Snag: Extension context invalidated, cannot check hash');
        return false;
      }
      
      const data = await chrome.storage.local.get(['duplicateTracking']);
      return !!data.duplicateTracking?.sentHashes?.[hash];
    } catch (error) {
      console.error('Torrent Snag: Failed to check hash:', error);
      return false;
    }
  },
  
  async getHashCount() {
    try {
      if (!chrome.runtime?.id) {
        return 0;
      }
      const data = await chrome.storage.local.get(['duplicateTracking']);
      return Object.keys(data.duplicateTracking?.sentHashes || {}).length;
    } catch (error) {
      console.error('Torrent Snag: Failed to get hash count:', error);
      return 0;
    }
  },

  async cleanupOldHashes(maxAge = 30 * 24 * 60 * 60 * 1000) {
    try {
      if (!chrome.runtime?.id) {
        return;
      }
      
      const data = await chrome.storage.local.get(['duplicateTracking']);
      const tracking = data.duplicateTracking;
      
      if (!tracking?.sentHashes) return;

      const cutoff = Date.now() - maxAge;
      const cleaned = {};
    
      
      for (const [hash, hashData] of Object.entries(tracking.sentHashes)) {
        if (new Date(hashData.timestamp).getTime() > cutoff) {
          cleaned[hash] = hashData;
        }
      }
      
      // If still too large, keep only most recent entries
      if (Object.keys(cleaned).length > tracking.maxEntries) {
        const sorted = Object.entries(cleaned)
          .sort((a, b) => new Date(b[1].timestamp) - new Date(a[1].timestamp))
          .slice(0, tracking.maxEntries);
        
        Object.assign(cleaned, Object.fromEntries(sorted));
      }
      
      tracking.sentHashes = cleaned;
      tracking.lastCleared = new Date().toISOString();
      
      await chrome.storage.local.set({ duplicateTracking: tracking });
    } catch (error) {
      console.error('Torrent Snag: Failed to cleanup old hashes:', error);
    }
  },

  async clearAll() {
    try {
      if (!chrome.runtime?.id) {
        return;
      }
      
      await chrome.storage.local.set({ 
        duplicateTracking: { 
          sentHashes: {}, 
          lastCleared: new Date().toISOString(), 
          maxEntries: 10000 
        } 
      });
    } catch (error) {
      console.error('Torrent Snag: Failed to clear all hashes:', error);
    }
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.hashUtils = hashUtils;
  window.duplicateTracker = duplicateTracker;
}
