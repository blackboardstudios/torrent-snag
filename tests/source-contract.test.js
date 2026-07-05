// Contract checks against source files, not inline test doubles.

describe('source configuration contracts', () => {
  beforeAll(() => {
    jest.resetModules();
    require('../src/utils/config.js');
  });

  beforeEach(() => {
    chrome.storage.local.get.mockReset();
  });

  test('built-in magnet pattern detects hex and base32 btih hashes', () => {
    const magnetPattern = window.DEFAULT_CONFIG.patterns.find(pattern => pattern.id === 'magnet-links');
    const regex = new RegExp(magnetPattern.regex, 'i');

    expect(regex.test('magnet:?xt=urn:btih:1234567890abcdef1234567890abcdef12345678&dn=Test')).toBe(true);
    expect(regex.test('magnet:?xt=urn:btih:ABCDEFGHIJKLMNOPQRSTUVWXYZ234567&dn=Test')).toBe(true);
  });

  test('reconciles stale built-in html-torrent-downloads regex and preserves enabled state', async () => {
    const defaultPattern = window.DEFAULT_CONFIG.patterns.find(
      pattern => pattern.id === 'html-torrent-downloads'
    );

    chrome.storage.local.get.mockResolvedValue({
      config: {
        patterns: [
          {
            id: 'html-torrent-downloads',
            name: 'Old HTML Torrent Downloads',
            regex: 'https?://stale-regex',
            enabled: false,
            builtin: true
          }
        ]
      }
    });

    const config = await window.configUtils.getConfig();
    const reconciled = config.patterns.find(pattern => pattern.id === 'html-torrent-downloads');

    expect(reconciled.regex).toBe(defaultPattern.regex);
    expect(reconciled.enabled).toBe(false);
    expect(reconciled.name).toBe(defaultPattern.name);
  });

  test('restores missing built-in pattern', async () => {
    const customPattern = {
      id: 'custom-existing',
      name: 'Custom Pattern',
      regex: 'custom-regex',
      enabled: true,
      builtin: false
    };

    chrome.storage.local.get.mockResolvedValue({
      config: {
        patterns: [customPattern]
      }
    });

    const config = await window.configUtils.getConfig();
    const expectedPatternIds = window.DEFAULT_CONFIG.patterns.map(pattern => pattern.id);
    const actualPatternIds = config.patterns.map(pattern => pattern.id);

    expect(actualPatternIds.slice(0, expectedPatternIds.length)).toEqual(expectedPatternIds);
    expect(actualPatternIds).toContain('custom-existing');
    expect(config.patterns.find(pattern => pattern.id === 'custom-existing')).toEqual(customPattern);
    expect(config.patterns.indexOf(config.patterns.find(pattern => pattern.id === 'custom-existing'))).toBeGreaterThan(
      expectedPatternIds.length - 1
    );
  });

  test('preserves custom patterns exactly', async () => {
    const customPattern = {
      id: 'custom-keep',
      name: 'Custom keep me',
      regex: 'keep-regex',
      enabled: false,
      builtin: false
    };

    chrome.storage.local.get.mockResolvedValue({
      config: {
        patterns: [customPattern]
      }
    });

    const config = await window.configUtils.getConfig();
    const customResult = config.patterns.find(pattern => pattern.id === 'custom-keep');

    expect(customResult).toEqual(customPattern);
  });

  test('preserves custom filters exactly', async () => {
    const customFilter = {
      id: 'filter-keep',
      name: 'Custom filter keep me',
      regex: 'skip-me',
      enabled: false,
      builtin: false
    };

    chrome.storage.local.get.mockResolvedValue({
      config: {
        filters: [customFilter]
      }
    });

    const config = await window.configUtils.getConfig();
    const customResult = config.filters.find(filter => filter.id === 'filter-keep');

    expect(customResult).toEqual(customFilter);
  });

  test.each([
    { type: 'patterns', itemId: 'html-torrent-downloads', staleRegex: 'stale-download' },
    { type: 'filters', itemId: 'skip-live-albums', staleRegex: 'stale-live-albums' }
  ])('reconciles stale built-in $type item and preserves enabled flag', async ({ type, itemId, staleRegex }) => {
    const defaultItem = window.DEFAULT_CONFIG[type].find(item => item.id === itemId);
    const payload = { [type]: [{ id: itemId, name: 'Stale item', regex: staleRegex, enabled: false, builtin: true }] };

    chrome.storage.local.get.mockResolvedValue({ config: payload });

    const config = await window.configUtils.getConfig();
    const reconciled = config[type].find(item => item.id === itemId);

    expect(reconciled.regex).toBe(defaultItem.regex);
    expect(reconciled.enabled).toBe(false);
  });

  test.each([
    { type: 'patterns', itemId: 'magnet-links' },
    { type: 'filters', itemId: 'skip-greatest-hits' }
  ])('restores missing built-in $type item', async ({ type, itemId }) => {
    const payload = { [type]: [] };
    chrome.storage.local.get.mockResolvedValue({ config: payload });

    const config = await window.configUtils.getConfig();
    const defaultItem = window.DEFAULT_CONFIG[type].find(item => item.id === itemId);
    const reconciled = config[type].find(item => item.id === itemId);

    expect(reconciled).toMatchObject(defaultItem);
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
