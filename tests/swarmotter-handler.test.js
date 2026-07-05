describe('SwarmOtterHandler', () => {
  beforeAll(() => {
    global.BaseTorrentHandler = class {
      constructor(config) {
        this.config = config;
        this.isAuthenticated = false;
        this.isTesting = false;
      }

      extractFilename() {
        return 'download.torrent';
      }

      cleanupTorrentFile(torrentFile) {
        if (torrentFile) {
          torrentFile.content = null;
        }
      }

      showNotification() {}
    };

    jest.resetModules();
    require('../src/handlers/swarmotter-handler.js');
  });

  beforeEach(() => {
    global.fetch = jest.fn();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    delete global.fetch;
    console.error.mockRestore();
  });

  function jsonResponse(envelope, overrides = {}) {
    return {
      ok: overrides.ok ?? true,
      status: overrides.status ?? 200,
      statusText: overrides.statusText || 'OK',
      text: jest.fn(async () => JSON.stringify(envelope))
    };
  }

  function successEnvelope(data) {
    return {
      success: true,
      data,
      error: null
    };
  }

  test('adds magnets through the native API and applies labels', async () => {
    const hash = 'a'.repeat(40);
    const magnet = `magnet:?xt=urn:btih:${'b'.repeat(40)}`;

    fetch
      .mockResolvedValueOnce(jsonResponse(successEnvelope(hash)))
      .mockResolvedValueOnce(jsonResponse(successEnvelope(null)));

    const handler = new window.SwarmOtterHandler({
      url: 'http://localhost:9091',
      authToken: 'secret-token',
      downloadDir: '/data/downloads'
    });
    handler.isAuthenticated = true;

    const result = await handler.addTorrents([magnet], ['Movies']);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][0]).toBe('http://localhost:9091/api/v1/torrents/magnet');
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer secret-token');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      magnet,
      download_dir: '/data/downloads'
    });

    expect(fetch.mock.calls[1][0]).toBe(`http://localhost:9091/api/v1/torrents/${hash}/labels`);
    expect(fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer secret-token');
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ labels: ['Movies'] });

    expect(result).toMatchObject({
      success: true,
      count: 1,
      total: 1
    });
    expect(result.results[0]).toMatchObject({
      success: true,
      hash,
      duplicate: false,
      label: 'Movies'
    });
  });

  test('uploads fetched torrent files through the native raw file endpoint', async () => {
    const hash = 'c'.repeat(40);
    const torrentBlob = new Blob(['torrent bytes'], { type: 'application/x-bittorrent' });

    fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: jest.fn(header => header === 'content-type' ? 'application/x-bittorrent' : null)
        },
        blob: jest.fn(async () => torrentBlob)
      })
      .mockResolvedValueOnce(jsonResponse(successEnvelope(hash)));

    const handler = new window.SwarmOtterHandler({ url: 'http://localhost:9091' });
    handler.isAuthenticated = true;

    const result = await handler.addTorrents(['https://example.test/file.torrent']);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][0]).toBe('https://example.test/file.torrent');
    expect(fetch.mock.calls[1][0]).toBe('http://localhost:9091/api/v1/torrents/file');
    expect(fetch.mock.calls[1][1].headers['Content-Type']).toBe('application/octet-stream');
    expect(fetch.mock.calls[1][1].body).toBe(torrentBlob);
    expect(result.results[0]).toMatchObject({ success: true, hash });
  });

  test('treats native duplicate_torrent responses as successful duplicate sends', async () => {
    const hash = 'd'.repeat(40);
    const magnet = `magnet:?xt=urn:btih:${hash}`;

    fetch
      .mockResolvedValueOnce(jsonResponse({
        success: false,
        data: null,
        error: {
          code: 'duplicate_torrent',
          message: `duplicate torrent: ${hash}`
        }
      }, {
        ok: false,
        status: 409,
        statusText: 'Conflict'
      }))
      .mockResolvedValueOnce(jsonResponse(successEnvelope(null)));

    const handler = new window.SwarmOtterHandler({ url: 'http://localhost:9091' });
    handler.isAuthenticated = true;

    const result = await handler.addTorrents([magnet], ['Already Added']);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1][0]).toBe(`http://localhost:9091/api/v1/torrents/${hash}/labels`);
    expect(result).toMatchObject({
      success: true,
      count: 1,
      total: 1
    });
    expect(result.results[0]).toMatchObject({
      success: true,
      hash,
      duplicate: true
    });
  });

  test('tests connection against api health without duplicating api path', async () => {
    fetch.mockResolvedValueOnce(jsonResponse(successEnvelope({ status: 'ok' })));

    const handler = new window.SwarmOtterHandler({
      url: 'http://127.0.0.1:9091/api/v1',
      authToken: 'secret-token'
    });

    const result = await handler.testConnection();

    expect(result).toBe(true);
    expect(fetch.mock.calls[0][0]).toBe('http://127.0.0.1:9091/api/v1/health');
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer secret-token');
  });
});
