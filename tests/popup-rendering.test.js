const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const popupCode = fs.readFileSync(path.join(__dirname, '../src/popup/popup.js'), 'utf8');

function createPopupEnvironment() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    runScripts: 'outside-only'
  });

  const originalAddEventListener = dom.window.document.addEventListener.bind(dom.window.document);
  dom.window.document.addEventListener = jest.fn((eventName, listener, options) => {
    if (eventName === 'DOMContentLoaded') {
      return;
    }

    originalAddEventListener(eventName, listener, options);
  });

  dom.window.__TORRENT_SNAG_TEST_HOOKS__ = true;
  dom.window.configUtils = {
    getConfig: jest.fn().mockResolvedValue({})
  };
  dom.window.STORAGE_KEYS = {
    REVIEW_POPUP_TAB_ID: 'reviewPopupTabId',
    REVIEW_POPUP_WINDOW_ID: 'reviewPopupWindowId'
  };
  dom.window.chrome = {
    runtime: {
      sendMessage: jest.fn(),
      openOptionsPage: jest.fn()
    },
    storage: {
      local: {
        get: jest.fn().mockResolvedValue({})
      }
    },
    tabs: {
      query: jest.fn().mockResolvedValue([]),
      sendMessage: jest.fn()
    }
  };
  dom.window.MESSAGE_TYPES = {
    REMOVE_DETECTED_LINK: 'REMOVE_DETECTED_LINK',
    RESCAN_PAGE: 'RESCAN_PAGE',
    GET_DETECTED_LINKS: 'GET_DETECTED_LINKS',
    SEND_TORRENTS: 'SEND_TORRENTS'
  };

  dom.window.eval(popupCode);
  return dom;
}

describe('popup torrent rendering', () => {
  test('renders quoted torrent names as text and attributes, not markup', () => {
    const dom = createPopupEnvironment();
    const payload = 'Bad " Title <img src=x onerror=alert(1)>';
    const torrent = {
      url: `magnet:?xt=urn:btih:1111111111111111111111111111111111111111&dn=${encodeURIComponent(payload)}`
    };

    const element = dom.window.__torrentSnagPopupTest.createTorrentElement(torrent, 0);
    const name = element.querySelector('.torrent-name');
    const url = element.querySelector('.torrent-url');

    expect(name.textContent).toBe(payload);
    expect(name.getAttribute('title')).toBe(payload);
    expect(name.getAttribute('onerror')).toBeNull();
    expect(element.querySelector('img')).toBeNull();

    expect(url.textContent).toBe(torrent.url);
    expect(url.getAttribute('title')).toBe(torrent.url);
    expect(url.getAttribute('onerror')).toBeNull();

    dom.window.close();
  });

  test('maps handler ids to user-facing names in popup counts', async () => {
    const dom = createPopupEnvironment();
    dom.window.getTargetTabId = jest.fn().mockResolvedValue(undefined);
    const hook = dom.window.__torrentSnagPopupTest;

    expect(hook.getHandlerDisplayName('qbittorrent')).toBe('qBittorrent');
    expect(hook.getHandlerDisplayName('transmission')).toBe('Transmission');
    expect(hook.getHandlerDisplayName('deluge')).toBe('Deluge');
    expect(hook.getHandlerDisplayName('download')).toBe('Generic Download');
    expect(hook.getHandlerDisplayName('custom')).toBe('custom');

    dom.window.close();
  });

  test('uses STORAGE_KEYS constant when loading review popup tab id', async () => {
    const dom = createPopupEnvironment();

    dom.window.STORAGE_KEYS = {
      REVIEW_POPUP_TAB_ID: 'reviewPopupTabId'
    };
    dom.window.chrome.storage.local.get.mockResolvedValue({ reviewPopupTabId: 987 });
    dom.window.chrome.tabs.query.mockResolvedValue([{ id: 987 }]);

    await dom.window.__torrentSnagPopupTest.getTargetTabId();

    expect(dom.window.chrome.storage.local.get).toHaveBeenCalledWith(['reviewPopupTabId']);
    dom.window.close();
  });
});
