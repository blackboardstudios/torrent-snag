const crypto = require('crypto');

let digestOriginal = null;

beforeAll(() => {
  if (!global.crypto) {
    global.crypto = {};
  }

  if (!global.crypto.subtle) {
    global.crypto.subtle = {};
  }

  digestOriginal = global.crypto.subtle.digest;
  global.crypto.subtle.digest = async (_algorithm, data) => {
    return crypto.createHash('sha256').update(Buffer.from(new Uint8Array(data))).digest();
  };

  jest.resetModules();
  require('../src/utils/hash.js');
});

afterAll(() => {
  if (digestOriginal) {
    global.crypto.subtle.digest = digestOriginal;
  }
});

describe('hashUtils', () => {
  describe('generateHash', () => {
    test('should extract btih hash from magnet URL', async () => {
      const magnetUrl = 'magnet:?xt=urn:btih:1234567890abcdef1234567890abcdef12345678&dn=Test';
      const hash = await window.hashUtils.generateHash(magnetUrl);
      expect(hash).toBe('1234567890abcdef1234567890abcdef12345678');
    });

    test('should handle base32 btih format', async () => {
      const magnetUrl = 'magnet:?xt=urn:btih:ABCDEFGHIJKLMNOPQRSTUVWXYZ234567&dn=Test';
      const hash = await window.hashUtils.generateHash(magnetUrl);
      expect(hash).toBe('abcdefghijklmnopqrstuvwxyz234567');
    });

    test('should include query string for non-magnet URLs', async () => {
      const withIdOne = await window.hashUtils.generateHash('https://example.test/download.php?id=1');
      const withIdTwo = await window.hashUtils.generateHash('https://example.test/download.php?id=2');
      const withIdThree = await window.hashUtils.generateHash('https://example.test/download.php?x=1');

      expect(withIdOne).not.toBe(withIdTwo);
      expect(withIdOne).not.toBe(withIdThree);
    });

    test('should ignore fragment differences for non-magnet URLs', async () => {
      const withFragment = await window.hashUtils.generateHash('https://example.test/download.php?id=1#first');
      const withoutFragment = await window.hashUtils.generateHash('https://example.test/download.php?id=1#second');
      expect(withFragment).toBe(withoutFragment);
    });

    test('same btih should hash identically regardless of tracker parameters', async () => {
      const btihOne = await window.hashUtils.generateHash('magnet:?xt=urn:btih:1234567890ABCDEF1234567890ABCDEF1234567890&tr=udp://tracker1');
      const btihTwo = await window.hashUtils.generateHash('magnet:?xt=urn:btih:1234567890ABCDEF1234567890ABCDEF1234567890&tr=https://tracker2');
      expect(btihOne).toMatch(/^[a-f0-9]{40}$/);
      expect(btihTwo).toMatch(/^[a-f0-9]{40}$/);
      expect(btihOne).toBe(btihTwo);
    });
  });

  describe('extractMagnetHash', () => {
    test('should extract btih hash from magnet URL', () => {
      const magnetUrl = 'magnet:?xt=urn:btih:1234567890abcdef1234567890abcdef12345678&dn=Test';
      const hash = window.hashUtils.extractMagnetHash(magnetUrl);
      expect(hash).toBe('1234567890abcdef1234567890abcdef12345678');
    });

    test('should return null for non-magnet URLs', () => {
      const url = 'https://example.com/torrent/file.torrent';
      const hash = window.hashUtils.extractMagnetHash(url);
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
      await window.duplicateTracker.addHash('test-hash');
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    test('should handle missing duplicateTracking in storage', async () => {
      await window.duplicateTracker.addHash('test-hash');
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

      await window.duplicateTracker.addHash('test-hash');
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

      const result = await window.duplicateTracker.hasHash('test-hash');
      expect(result).toBe(true);
    });

    test('should return false for non-existing hash', async () => {
      chrome.storage.local.get.mockResolvedValueOnce({
        duplicateTracking: { sentHashes: {} }
      });

      const result = await window.duplicateTracker.hasHash('nonexistent');
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

      await window.duplicateTracker.clearAll();
      const setCall = chrome.storage.local.set.mock.calls[0];
      expect(setCall[0].duplicateTracking.sentHashes).toEqual({});
    });
  });
});
