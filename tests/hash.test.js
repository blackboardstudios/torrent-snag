// Tests for hash utilities
const hashUtils = {
  async generateHash(url) {
    if (url.startsWith('magnet:')) {
      const btihMatch = url.match(/btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})/i);
      if (btihMatch) {
        return btihMatch[1].toLowerCase();
      }
    }
    return null;
  },

  extractMagnetHash(magnetUrl) {
    const btihMatch = magnetUrl.match(/btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})/i);
    return btihMatch ? btihMatch[1].toLowerCase() : null;
  }
};

const duplicateTracker = {
  async addHash(hash, metadata = {}) {
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
  },
  
  async hasHash(hash) {
    const data = await chrome.storage.local.get(['duplicateTracking']);
    return !!data.duplicateTracking?.sentHashes?.[hash];
  },

  async clearAll() {
    await chrome.storage.local.set({ 
      duplicateTracking: { 
        sentHashes: {}, 
        lastCleared: new Date().toISOString(), 
        maxEntries: 10000 
      } 
    });
  }
};

describe('hashUtils', () => {
  describe('generateHash', () => {
    test('should extract btih hash from magnet URL', async () => {
      const magnetUrl = 'magnet:?xt=urn:btih:1234567890abcdef1234567890abcdef12345678&dn=Test';
      const hash = await hashUtils.generateHash(magnetUrl);
      expect(hash).toBe('1234567890abcdef1234567890abcdef12345678');
    });

    test('should handle base32 btih format', async () => {
      const magnetUrl = 'magnet:?xt=urn:btih:ABCDEFGHIJKLMNOPQRSTUVWXYZ234567&dn=Test';
      const hash = await hashUtils.generateHash(magnetUrl);
      expect(hash).toBe('abcdefghijklmnopqrstuvwxyz234567');
    });
  });

  describe('extractMagnetHash', () => {
    test('should extract btih hash from magnet URL', () => {
      const magnetUrl = 'magnet:?xt=urn:btih:1234567890abcdef1234567890abcdef12345678&dn=Test';
      const hash = hashUtils.extractMagnetHash(magnetUrl);
      expect(hash).toBe('1234567890abcdef1234567890abcdef12345678');
    });

    test('should return null for non-magnet URLs', () => {
      const url = 'https://example.com/torrent/file.torrent';
      const hash = hashUtils.extractMagnetHash(url);
      expect(hash).toBeNull();
    });
  });
});

describe('duplicateTracker', () => {
  beforeEach(() => {
    chrome.storage.local.get.mockReset();
    chrome.storage.local.set.mockReset();
    chrome.storage.local.get.mockResolvedValue({});
    chrome.storage.local.set.mockResolvedValue();
  });

  describe('addHash', () => {
    test('should add hash to tracking', async () => {
      await duplicateTracker.addHash('test-hash');
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    test('should handle missing duplicateTracking in storage', async () => {
      await duplicateTracker.addHash('test-hash');
      const setCall = chrome.storage.local.set.mock.calls[0];
      expect(setCall[0].duplicateTracking).toBeDefined();
      expect(setCall[0].duplicateTracking.sentHashes['test-hash']).toBeDefined();
    });

    test('should increment count for existing hash', async () => {
      const existingTimestamp = '2026-01-01T00:00:00.000Z';
      chrome.storage.local.get.mockResolvedValueOnce({
        duplicateTracking: {
          sentHashes: { 'test-hash': { count: 1, timestamp: existingTimestamp } },
          lastCleared: existingTimestamp,
          maxEntries: 10000
        }
      });

      await duplicateTracker.addHash('test-hash');
      const setCall = chrome.storage.local.set.mock.calls[0];
      expect(setCall[0].duplicateTracking.sentHashes['test-hash'].count).toBe(2);
    });
  });

  describe('hasHash', () => {
    test('should return true for existing hash', async () => {
      chrome.storage.local.get.mockResolvedValueOnce({
        duplicateTracking: {
          sentHashes: { 'test-hash': { count: 1, timestamp: new Date().toISOString() } }
        }
      });

      const result = await duplicateTracker.hasHash('test-hash');
      expect(result).toBe(true);
    });

    test('should return false for non-existing hash', async () => {
      chrome.storage.local.get.mockResolvedValueOnce({
        duplicateTracking: { sentHashes: {} }
      });

      const result = await duplicateTracker.hasHash('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('clearAll', () => {
    test('should clear all tracked hashes', async () => {
      chrome.storage.local.get.mockResolvedValueOnce({
        duplicateTracking: {
          sentHashes: { 'another-hash': { count: 1, timestamp: new Date().toISOString() } }
        }
      });

      await duplicateTracker.clearAll();
      const setCall = chrome.storage.local.set.mock.calls[0];
      expect(setCall[0].duplicateTracking.sentHashes).toEqual({});
    });
  });
});