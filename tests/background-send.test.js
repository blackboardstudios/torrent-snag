const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const backgroundCode = fs.readFileSync(path.join(__dirname, '../src/background/background.js'), 'utf8');

function loadBackgroundEnvironment() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    runScripts: 'outside-only'
  });

  const window = dom.window;
  let runtimeMessageListener;

  window.STORAGE_KEYS = {
    CONFIG: 'config',
    DUPLICATE_TRACKING: 'duplicateTracking',
    REVIEW_POPUP_TAB_ID: 'reviewPopupTabId',
    REVIEW_POPUP_WINDOW_ID: 'reviewPopupWindowId',
    DETECTED_LINKS_PREFIX: 'detectedLinks_'
  };
  window.MESSAGE_TYPES = {
    UPDATE_BADGE: 'UPDATE_BADGE',
    SEND_TORRENTS: 'SEND_TORRENTS',
    TEST_CONNECTION: 'TEST_CONNECTION',
    OPEN_REVIEW_POPUP: 'OPEN_REVIEW_POPUP',
    HANDLER_CONFIG_CHANGED: 'HANDLER_CONFIG_CHANGED',
    GET_TAB_ID: 'GET_TAB_ID',
    GET_DETECTED_LINKS: 'GET_DETECTED_LINKS',
    CLEAR_DETECTED_LINKS: 'CLEAR_DETECTED_LINKS',
    REMOVE_DETECTED_LINK: 'REMOVE_DETECTED_LINK',
    REMOVE_DETECTED_LINKS: 'REMOVE_DETECTED_LINKS',
    RESCAN_PAGE: 'RESCAN_PAGE',
    CONFIG_UPDATED: 'CONFIG_UPDATED'
  };

  const storageData = {};

  window.chrome = {
    runtime: {
      id: 'test-extension-id',
      getURL: path => `chrome-extension://test-extension-id/${path}`,
      onMessage: {
        addListener: jest.fn(listener => {
          runtimeMessageListener = listener;
        })
      },
      onInstalled: {
        addListener: jest.fn()
      },
      onStartup: {
        addListener: jest.fn()
      },
      sendMessage: jest.fn()
    },
    storage: {
      local: {
        get: jest.fn(async () => storageData),
        set: jest.fn(async data => {
          Object.assign(storageData, data);
        }),
        remove: jest.fn(async () => {})
      }
    },
    tabs: {
      sendMessage: jest.fn(),
      query: jest.fn(),
      onRemoved: {
        addListener: jest.fn()
      }
    },
    action: {
      onClicked: {
        addListener: jest.fn()
      },
      setBadgeText: jest.fn(),
      setBadgeBackgroundColor: jest.fn(),
      setTitle: jest.fn()
    },
    notifications: {
      create: jest.fn()
    },
    contextMenus: {
      onClicked: {
        addListener: jest.fn()
      },
      create: jest.fn(),
      remove: jest.fn()
    },
    commands: {
      onCommand: {
        addListener: jest.fn()
      }
    },
    windows: {
      create: jest.fn()
    }
  };

  window.configUtils = {
    getConfig: jest.fn().mockResolvedValue({
      selectedHandler: 'download',
      handlers: {
        download: {
          name: 'Generic Download'
        }
      }
    }),
    setConfig: jest.fn(async () => {})
  };

  window.contextMenuUtils = {
    setupContextMenus: jest.fn(async () => {}),
    updateContextMenus: jest.fn(async () => {}),
    handleContextMenuClick: jest.fn(async () => {})
  };

  window.HandlerFactory = {
    createHandler: jest.fn(),
    getAvailableHandlers: jest.fn(() => [{
      id: 'download',
      name: 'Generic Download'
    }])
  };

  window.hashUtils = {
    generateHash: jest.fn(async (url) => `hash-${url}`)
  };

  window.duplicateTracker = {
    addHash: jest.fn(async () => {}),
    cleanupOldHashes: jest.fn(async () => {})
  };

  window.importScripts = jest.fn();

  window.eval(backgroundCode);

  return {
    window,
    runtimeMessageListener: () => runtimeMessageListener,
    storageData
  };
}

function sendMessageToBackground(testEnv, message, tabId) {
  const listener = testEnv.runtimeMessageListener();
  if (!listener) {
    throw new Error('Background did not register message listener');
  }

  return new Promise(resolve => {
    listener(message, { tab: { id: tabId } }, resolve);
  });
}

describe('background send result handling', () => {
  let testWindow;

  beforeEach(() => {
    testWindow = loadBackgroundEnvironment();
  });

  afterEach(() => {
    testWindow.window.close();
  });

  test('returns sender tab id for GET_TAB_ID requests', async () => {
    const response = await sendMessageToBackground(testWindow, {
      type: 'GET_TAB_ID'
    }, 42);

    expect(response).toEqual({ tabId: 42 });
  });

  test('returns failure payload and does not clear links for all-failed sends', async () => {
    const stubHandler = {
      addTorrents: jest.fn().mockResolvedValue({
        success: false,
        count: 0,
        total: 2,
        results: [
          { url: 'https://example.test/fail/1.torrent', success: false, error: 'Bad torrent' },
          { url: 'https://example.test/fail/2.torrent', success: false, error: 'Still bad' }
        ]
      })
    };

    testWindow.window.HandlerFactory.createHandler.mockReturnValue(stubHandler);

    const response = await sendMessageToBackground(testWindow, {
      type: 'SEND_TORRENTS',
      tabId: 77,
      torrents: [
        { url: 'https://example.test/fail/1.torrent', label: 'label-1' },
        { url: 'https://example.test/fail/2.torrent', label: 'label-2' }
      ]
    }, 77);

    expect(stubHandler.addTorrents).toHaveBeenCalledWith(
      ['https://example.test/fail/1.torrent', 'https://example.test/fail/2.torrent'],
      ['label-1', 'label-2']
    );
    expect(testWindow.window.duplicateTracker.addHash).not.toHaveBeenCalled();

    expect(testWindow.window.chrome.tabs.sendMessage).not.toHaveBeenCalledWith(77, expect.objectContaining({
      type: 'CLEAR_DETECTED_LINKS'
    }));
    expect(testWindow.window.chrome.tabs.sendMessage).not.toHaveBeenCalledWith(77, expect.objectContaining({
      type: 'REMOVE_DETECTED_LINKS'
    }));
    expect(testWindow.window.chrome.action.setBadgeText).toHaveBeenCalledWith(
      expect.objectContaining({ text: '!', tabId: 77 })
    );

    expect(response).toEqual(expect.objectContaining({
      success: false,
      count: 0,
      total: 2,
      failed: 2,
      error: 'Bad torrent'
    }));
  });

  test('tracks and removes only successful urls for partial success', async () => {
    const successful = 'https://example.test/ok/1.torrent';
    const failed = 'https://example.test/fail/1.torrent';

    const stubHandler = {
      addTorrents: jest.fn().mockResolvedValue({
        success: true,
        count: 1,
        total: 2,
        results: [
          { url: successful, success: true },
          { url: failed, success: false, error: 'Bad hash' }
        ]
      })
    };

    testWindow.window.HandlerFactory.createHandler.mockReturnValue(stubHandler);

    const response = await sendMessageToBackground(testWindow, {
      type: 'SEND_TORRENTS',
      tabId: 88,
      torrents: [
        { url: successful, label: 'label-1' },
        { url: failed, label: 'label-2' }
      ]
    }, 88);

    expect(testWindow.window.duplicateTracker.addHash).toHaveBeenCalledTimes(1);
    expect(testWindow.window.duplicateTracker.addHash).toHaveBeenCalledWith('hash-https://example.test/ok/1.torrent');

    expect(testWindow.window.chrome.tabs.sendMessage).not.toHaveBeenCalledWith(88, expect.objectContaining({
      type: 'CLEAR_DETECTED_LINKS'
    }));
    expect(testWindow.window.chrome.tabs.sendMessage).toHaveBeenCalledWith(88, expect.objectContaining({
      type: 'REMOVE_DETECTED_LINKS',
      urls: [successful]
    }));
    expect(response).toMatchObject({
      success: false,
      partial: true,
      count: 1,
      total: 2,
      failed: 1
    });

    expect(testWindow.window.chrome.action.setBadgeText).toHaveBeenCalledWith(
      expect.objectContaining({ text: '1', tabId: 88 })
    );
  });

  test('keeps partial success response when content script removal message fails', async () => {
    const successful = 'https://example.test/ok/1.torrent';
    const failed = 'https://example.test/fail/1.torrent';

    const stubHandler = {
      addTorrents: jest.fn().mockResolvedValue({
        success: true,
        count: 1,
        total: 2,
        results: [
          { url: successful, success: true },
          { url: failed, success: false, error: 'Bad hash' }
        ]
      })
    };

    testWindow.window.HandlerFactory.createHandler.mockReturnValue(stubHandler);
    testWindow.window.chrome.tabs.sendMessage.mockRejectedValueOnce(new Error('No receiving end'));

    const response = await sendMessageToBackground(testWindow, {
      type: 'SEND_TORRENTS',
      tabId: 89,
      torrents: [
        { url: successful, label: 'label-1' },
        { url: failed, label: 'label-2' }
      ]
    }, 89);

    expect(testWindow.window.duplicateTracker.addHash).toHaveBeenCalledTimes(1);
    expect(testWindow.window.chrome.action.setBadgeText).toHaveBeenCalledWith(
      expect.objectContaining({ text: '1', tabId: 89 })
    );
    expect(response).toMatchObject({
      success: false,
      partial: true,
      count: 1,
      total: 2,
      failed: 1
    });
  });

  test('tracks all urls and clears links for full success', async () => {
    const successUrls = [
      'https://example.test/ok/1.torrent',
      'https://example.test/ok/2.torrent'
    ];

    const stubHandler = {
      addTorrents: jest.fn().mockResolvedValue({
        success: true,
        count: 2,
        total: 2,
        results: [
          { url: successUrls[0], success: true },
          { url: successUrls[1], success: true }
        ]
      })
    };

    testWindow.window.HandlerFactory.createHandler.mockReturnValue(stubHandler);

    const response = await sendMessageToBackground(testWindow, {
      type: 'SEND_TORRENTS',
      tabId: 99,
      torrents: [
        { url: successUrls[0], label: 'one' },
        { url: successUrls[1], label: 'two' }
      ]
    }, 99);

    expect(testWindow.window.duplicateTracker.addHash).toHaveBeenCalledTimes(2);
    expect(testWindow.window.duplicateTracker.addHash).toHaveBeenNthCalledWith(1, 'hash-https://example.test/ok/1.torrent');
    expect(testWindow.window.duplicateTracker.addHash).toHaveBeenNthCalledWith(2, 'hash-https://example.test/ok/2.torrent');

    expect(testWindow.window.chrome.tabs.sendMessage).toHaveBeenCalledWith(99, expect.objectContaining({
      type: 'CLEAR_DETECTED_LINKS'
    }));
    expect(response).toEqual(expect.objectContaining({
      success: true,
      count: 2,
      total: 2,
      failed: 0
    }));
  });

  test('treats malformed count-only partial result as all failed', async () => {
    const urls = [
      'https://example.test/malformed/1.torrent',
      'https://example.test/malformed/2.torrent'
    ];
    const stubHandler = {
      addTorrents: jest.fn().mockResolvedValue({
        success: true,
        count: 1,
        total: 2
      })
    };

    testWindow.window.HandlerFactory.createHandler.mockReturnValue(stubHandler);

    const response = await sendMessageToBackground(testWindow, {
      type: 'SEND_TORRENTS',
      tabId: 100,
      torrents: urls.map(url => ({ url, label: '' }))
    }, 100);

    expect(testWindow.window.duplicateTracker.addHash).not.toHaveBeenCalled();
    expect(testWindow.window.chrome.tabs.sendMessage).not.toHaveBeenCalled();
    expect(testWindow.window.chrome.action.setBadgeText).toHaveBeenCalledWith(
      expect.objectContaining({ text: '!', tabId: 100 })
    );
    expect(response).toMatchObject({
      success: false,
      count: 0,
      total: 2,
      failed: 2
    });
  });

  test('removes detected-link storage when a tab closes', async () => {
    const onRemoved = testWindow.window.chrome.tabs.onRemoved.addListener.mock.calls[0][0];

    await onRemoved(123);

    expect(testWindow.window.chrome.storage.local.remove).toHaveBeenCalledWith('detectedLinks_tab_123');
  });

  test('cleans up duplicate tracking on install and startup', async () => {
    const onInstalled = testWindow.window.chrome.runtime.onInstalled.addListener.mock.calls[0][0];
    const onStartup = testWindow.window.chrome.runtime.onStartup.addListener.mock.calls[0][0];

    await onInstalled({ reason: 'install' });
    await onStartup();

    expect(testWindow.window.duplicateTracker.cleanupOldHashes).toHaveBeenCalledTimes(2);
  });
});
