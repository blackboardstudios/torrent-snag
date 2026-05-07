// Contract checks against source files, not inline test doubles.

describe('source configuration contracts', () => {
  beforeAll(() => {
    jest.resetModules();
    require('../src/utils/config.js');
  });

  test('built-in magnet pattern detects hex and base32 btih hashes', () => {
    const magnetPattern = window.DEFAULT_CONFIG.patterns.find(pattern => pattern.id === 'magnet-links');
    const regex = new RegExp(magnetPattern.regex, 'i');

    expect(regex.test('magnet:?xt=urn:btih:1234567890abcdef1234567890abcdef12345678&dn=Test')).toBe(true);
    expect(regex.test('magnet:?xt=urn:btih:ABCDEFGHIJKLMNOPQRSTUVWXYZ234567&dn=Test')).toBe(true);
  });

  test('legacy handler config selects the migrated handler when selectedHandler is absent', async () => {
    chrome.storage.local.get.mockResolvedValueOnce({
      config: {
        handler: 'transmission',
        handlerConfig: {
          url: 'http://localhost:9091'
        }
      }
    });

    const config = await window.configUtils.getConfig();

    expect(config.selectedHandler).toBe('transmission');
    expect(config.handlers.transmission.url).toBe('http://localhost:9091');
  });
});

describe('source duplicate tracker contracts', () => {
  beforeAll(() => {
    jest.resetModules();
    require('../src/utils/hash.js');
  });

  beforeEach(() => {
    chrome.storage.local.get.mockReset();
    chrome.storage.local.set.mockReset();
    chrome.storage.local.set.mockResolvedValue();
  });

  test('cleanupOldHashes enforces maxEntries after age filtering', async () => {
    const now = Date.now();
    chrome.storage.local.get.mockResolvedValueOnce({
      duplicateTracking: {
        sentHashes: {
          newest: { timestamp: new Date(now).toISOString() },
          middle: { timestamp: new Date(now - 1000).toISOString() },
          oldest: { timestamp: new Date(now - 2000).toISOString() }
        },
        lastCleared: new Date(now - 3000).toISOString(),
        maxEntries: 2
      }
    });

    await window.duplicateTracker.cleanupOldHashes();

    const savedTracking = chrome.storage.local.set.mock.calls[0][0].duplicateTracking;
    expect(Object.keys(savedTracking.sentHashes)).toEqual(['newest', 'middle']);
  });
});
