describe('DelugeHandler', () => {
  beforeAll(() => {
    global.BaseTorrentHandler = class {
      constructor(config) {
        this.config = config;
        this.isAuthenticated = false;
        this.isTesting = false;
      }

      showNotification() {}
    };

    jest.resetModules();
    require('../src/handlers/deluge-handler.js');
  });

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  test('uses monotonically increasing unique JSON-RPC ids for addTorrents', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ error: null })
    });

    const handler = new window.DelugeHandler({ url: 'http://localhost:8112', password: 'test' });
    handler.isAuthenticated = true;

    await handler.addTorrents([
      'https://example.test/one.torrent',
      'https://example.test/two.torrent',
      'https://example.test/three.torrent'
    ]);

    expect(fetch).toHaveBeenCalledTimes(3);

    const requestIds = fetch.mock.calls.map(call => JSON.parse(call[1].body).id);

    expect(requestIds).toEqual([1, 2, 3]);
    expect(new Set(requestIds).size).toBe(3);
  });
});
