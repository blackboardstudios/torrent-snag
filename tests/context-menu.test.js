const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

function createContextMenuEnvironment() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    runScripts: 'outside-only'
  });

  dom.window.chrome = {
    contextMenus: {
      create: jest.fn(),
      update: jest.fn(),
      removeAll: jest.fn(async () => {}),
      onClicked: {
        addListener: jest.fn()
      }
    }
  };

  dom.window.configUtils = {
    getConfig: jest.fn().mockResolvedValue({
      selectedHandler: 'qbittorrent'
    })
  };

  dom.window.HandlerFactory = {
    getAvailableHandlers: jest.fn(() => [{ id: 'qbittorrent', name: 'qBittorrent' }])
  };

  const contextMenuCode = fs.readFileSync(path.join(__dirname, '../src/utils/context-menu.js'), 'utf8');
  dom.window.eval(contextMenuCode);

  return dom.window;
}

describe('context menu validation', () => {
  test('isTorrentOrMagnetLink validates only direct torrent links', () => {
    const window = createContextMenuEnvironment();

    expect(window.contextMenuUtils.isTorrentOrMagnetLink(
      'magnet:?xt=urn:btih:1234567890ABCDEF1234567890ABCDEF1234567890'
    )).toBe(true);
    expect(window.contextMenuUtils.isTorrentOrMagnetLink(
      'magnet:?xt=urn:btih:ABCDEFGHIJKLMNOPQRSTUVWXYZ234567&tr=udp://tracker'
    )).toBe(true);
    expect(window.contextMenuUtils.isTorrentOrMagnetLink(
      'magnet:?xt=urn:sha1:123'
    )).toBe(false);
    expect(window.contextMenuUtils.isTorrentOrMagnetLink(
      'https://example.test/file.torrent?id=1'
    )).toBe(true);
    expect(window.contextMenuUtils.isTorrentOrMagnetLink(
      'https://example.test/download.php?id=1'
    )).toBe(false);
    expect(window.contextMenuUtils.isTorrentOrMagnetLink(
      'https://example.test/torrent/123'
    )).toBe(false);
    expect(window.contextMenuUtils.isTorrentOrMagnetLink(
      'file:///tmp/file.torrent'
    )).toBe(false);

    window.close();
  });

  test('creates strict link menus without custom label menu item', async () => {
    const window = createContextMenuEnvironment();
    const menu = window.contextMenuUtils;

    await menu.setupContextMenus();
    await menu.createLabelSubmenus();

    const createCalls = window.chrome.contextMenus.create.mock.calls.map(([options]) => options);
    const menuIds = createCalls.map((call) => call.id);
    expect(menuIds).toContain('link-label-books');
    expect(menuIds).not.toContain('link-label-custom');

    const linkMenu = createCalls.find(call => call.id === 'link-send-torrent');
    expect(linkMenu.targetUrlPatterns).toEqual(['http://*/*.torrent*', 'https://*/*.torrent*', 'magnet:*']);

    const labeledMenu = createCalls.find(call => call.id === 'link-send-with-label');
    expect(labeledMenu.targetUrlPatterns).toEqual(['http://*/*.torrent*', 'https://*/*.torrent*', 'magnet:*']);

    window.close();
  });
});
