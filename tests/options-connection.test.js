const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const optionsCode = fs.readFileSync(path.join(__dirname, '../src/options/options.js'), 'utf8');

function createOptionsTestEnvironment() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    runScripts: 'outside-only'
  });

  dom.window.__TORRENT_SNAG_OPTIONS_TEST_HOOKS__ = true;
  dom.window.eval(optionsCode);
  return dom;
}

describe('options connection requirements', () => {
  test('generic download connection test does not require a server URL', () => {
    const dom = createOptionsTestEnvironment();
    const { getRequiredHandlerFields } = dom.window.__torrentSnagOptionsTest;

    expect(getRequiredHandlerFields({
      id: 'download',
      name: 'Generic Download',
      requiresAuth: false,
      fields: []
    })).toEqual([]);

    expect(getRequiredHandlerFields({
      id: 'qbittorrent',
      name: 'qBittorrent',
      requiresAuth: true,
      fields: ['url', 'username', 'password', 'defaultLabel']
    })).toEqual(['url', 'username', 'password']);

    expect(getRequiredHandlerFields({
      id: 'swarmotter',
      name: 'SwarmOtter',
      requiresAuth: false,
      fields: ['url', 'authToken', 'downloadDir', 'defaultLabel']
    })).toEqual(['url']);

    dom.window.close();
  });
});
