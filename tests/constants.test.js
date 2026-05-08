// Tests for constants

const MESSAGE_TYPES = {
  UPDATE_BADGE: 'UPDATE_BADGE',
  SEND_TORRENTS: 'SEND_TORRENTS',
  TEST_CONNECTION: 'TEST_CONNECTION',
  OPEN_REVIEW_POPUP: 'OPEN_REVIEW_POPUP',
  HANDLER_CONFIG_CHANGED: 'HANDLER_CONFIG_CHANGED',
  GET_DETECTED_LINKS: 'GET_DETECTED_LINKS',
  CLEAR_DETECTED_LINKS: 'CLEAR_DETECTED_LINKS',
  REMOVE_DETECTED_LINK: 'REMOVE_DETECTED_LINK',
  RESCAN_PAGE: 'RESCAN_PAGE',
  CONFIG_UPDATED: 'CONFIG_UPDATED'
};

const STORAGE_KEYS = {
  CONFIG: 'config',
  DUPLICATE_TRACKING: 'duplicateTracking',
  REVIEW_POPUP_TAB_ID: 'reviewPopupTabId',
  REVIEW_POPUP_WINDOW_ID: 'reviewPopupWindowId',
  DETECTED_LINKS_PREFIX: 'detectedLinks_'
};

const HANDLER_TYPES = {
  QBITTORRENT: 'qbittorrent',
  TRANSMISSION: 'transmission',
  DELUGE: 'deluge',
  DOWNLOAD: 'download'
};

const DEFAULTS = {
  DEBOUNCE_DELAY: 500,
  CHUNK_SIZE: 100,
  MAX_LINKS_PER_SCAN: 1000,
  MAX_DUPLICATE_ENTRIES: 10000,
  TIMEOUT: 30000,
  CLEANUP_INTERVAL_DAYS: 30,
  MAX_ENTRIES_AFTER_CLEANUP: 5000
};

describe('MESSAGE_TYPES', () => {
  test('should have all required message types', () => {
    expect(MESSAGE_TYPES.UPDATE_BADGE).toBe('UPDATE_BADGE');
    expect(MESSAGE_TYPES.SEND_TORRENTS).toBe('SEND_TORRENTS');
    expect(MESSAGE_TYPES.TEST_CONNECTION).toBe('TEST_CONNECTION');
    expect(MESSAGE_TYPES.OPEN_REVIEW_POPUP).toBe('OPEN_REVIEW_POPUP');
    expect(MESSAGE_TYPES.HANDLER_CONFIG_CHANGED).toBe('HANDLER_CONFIG_CHANGED');
    expect(MESSAGE_TYPES.GET_DETECTED_LINKS).toBe('GET_DETECTED_LINKS');
    expect(MESSAGE_TYPES.CLEAR_DETECTED_LINKS).toBe('CLEAR_DETECTED_LINKS');
    expect(MESSAGE_TYPES.REMOVE_DETECTED_LINK).toBe('REMOVE_DETECTED_LINK');
    expect(MESSAGE_TYPES.RESCAN_PAGE).toBe('RESCAN_PAGE');
    expect(MESSAGE_TYPES.CONFIG_UPDATED).toBe('CONFIG_UPDATED');
  });
});

describe('STORAGE_KEYS', () => {
  test('should have all required storage keys', () => {
    expect(STORAGE_KEYS.CONFIG).toBe('config');
    expect(STORAGE_KEYS.DUPLICATE_TRACKING).toBe('duplicateTracking');
    expect(STORAGE_KEYS.REVIEW_POPUP_TAB_ID).toBe('reviewPopupTabId');
    expect(STORAGE_KEYS.REVIEW_POPUP_WINDOW_ID).toBe('reviewPopupWindowId');
    expect(STORAGE_KEYS.DETECTED_LINKS_PREFIX).toBe('detectedLinks_');
  });
});

describe('HANDLER_TYPES', () => {
  test('should have all required handler types', () => {
    expect(HANDLER_TYPES.QBITTORRENT).toBe('qbittorrent');
    expect(HANDLER_TYPES.TRANSMISSION).toBe('transmission');
    expect(HANDLER_TYPES.DELUGE).toBe('deluge');
    expect(HANDLER_TYPES.DOWNLOAD).toBe('download');
  });
});

describe('DEFAULTS', () => {
  test('should have all required default values', () => {
    expect(DEFAULTS.DEBOUNCE_DELAY).toBe(500);
    expect(DEFAULTS.CHUNK_SIZE).toBe(100);
    expect(DEFAULTS.MAX_LINKS_PER_SCAN).toBe(1000);
    expect(DEFAULTS.MAX_DUPLICATE_ENTRIES).toBe(10000);
    expect(DEFAULTS.TIMEOUT).toBe(30000);
    expect(DEFAULTS.CLEANUP_INTERVAL_DAYS).toBe(30);
    expect(DEFAULTS.MAX_ENTRIES_AFTER_CLEANUP).toBe(5000);
  });

  test('should have sensible default values', () => {
    expect(DEFAULTS.DEBOUNCE_DELAY).toBeGreaterThanOrEqual(100);
    expect(DEFAULTS.DEBOUNCE_DELAY).toBeLessThanOrEqual(5000);
    expect(DEFAULTS.CHUNK_SIZE).toBeGreaterThan(0);
    expect(DEFAULTS.TIMEOUT).toBeGreaterThan(0);
  });
});