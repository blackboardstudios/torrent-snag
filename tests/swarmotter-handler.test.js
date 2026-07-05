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
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'table').mockImplementation(() => {});
  });

  afterEach(() => {
    delete global.fetch;
    console.error.mockRestore();
    console.info.mockRestore();
    console.warn.mockRestore();
    console.table.mockRestore();
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

  test('adds magnets through the native bulk API and applies labels', async () => {
    const hash = 'a'.repeat(40);
    const magnet = `magnet:?xt=urn:btih:${'b'.repeat(40)}`;

    fetch
      .mockResolvedValueOnce(jsonResponse(successEnvelope({
        added: [{ kind: 'magnet', index: 0, info_hash: hash }],
        failed: []
      })))
      .mockResolvedValueOnce(jsonResponse(successEnvelope(null)));

    const handler = new window.SwarmOtterHandler({
      url: 'http://localhost:9091',
      authToken: 'secret-token',
      downloadDir: '/data/downloads'
    });
    handler.isAuthenticated = true;

    const result = await handler.addTorrents([magnet], ['Movies']);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][0]).toBe('http://localhost:9091/api/v1/torrents/bulk');
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer secret-token');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      magnets: [magnet],
      torrent_files: [],
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

  test('uploads fetched torrent files through the native bulk API', async () => {
    const hash = 'c'.repeat(40);
    const torrentBlob = {
      size: 13,
      type: 'application/x-bittorrent',
      arrayBuffer: jest.fn(async () => new TextEncoder().encode('torrent bytes').buffer)
    };

    fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: jest.fn(header => header === 'content-type' ? 'application/x-bittorrent' : null)
        },
        blob: jest.fn(async () => torrentBlob)
      })
      .mockResolvedValueOnce(jsonResponse(successEnvelope({
        added: [{ kind: 'torrent_file', index: 0, info_hash: hash }],
        failed: []
      })));

    const handler = new window.SwarmOtterHandler({ url: 'http://localhost:9091' });
    handler.isAuthenticated = true;

    const result = await handler.addTorrents(['https://example.test/file.torrent']);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][0]).toBe('https://example.test/file.torrent');
    expect(fetch.mock.calls[1][0]).toBe('http://localhost:9091/api/v1/torrents/bulk');
    expect(fetch.mock.calls[1][1].headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({
      magnets: [],
      torrent_files: [{ metainfo: 'dG9ycmVudCBieXRlcw==' }]
    });
    expect(result.results[0]).toMatchObject({ success: true, hash });
  });

  test('maps mixed bulk response indexes back to original URL order', async () => {
    const firstHash = '1'.repeat(40);
    const fileHash = '2'.repeat(40);
    const secondHash = '3'.repeat(40);
    const firstMagnet = `magnet:?xt=urn:btih:${firstHash}`;
    const secondMagnet = `magnet:?xt=urn:btih:${secondHash}`;
    const torrentBlob = {
      size: 12,
      type: 'application/x-bittorrent',
      arrayBuffer: jest.fn(async () => new TextEncoder().encode('mixed bytes').buffer)
    };

    fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: jest.fn(header => header === 'content-type' ? 'application/x-bittorrent' : null)
        },
        blob: jest.fn(async () => torrentBlob)
      })
      .mockResolvedValueOnce(jsonResponse(successEnvelope({
        added: [
          { kind: 'magnet', index: 0, info_hash: firstHash },
          { kind: 'magnet', index: 1, info_hash: secondHash },
          { kind: 'torrent_file', index: 0, info_hash: fileHash }
        ],
        failed: []
      })));

    const handler = new window.SwarmOtterHandler({ url: 'http://localhost:9091' });
    handler.isAuthenticated = true;

    const result = await handler.addTorrents([
      firstMagnet,
      'https://example.test/file.torrent',
      secondMagnet
    ]);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({
      magnets: [firstMagnet, secondMagnet],
      torrent_files: [{ metainfo: 'bWl4ZWQgYnl0ZXM=' }]
    });
    expect(result.results.map(item => item.hash)).toEqual([firstHash, fileHash, secondHash]);
  });

  test('treats native duplicate_torrent responses as successful duplicate sends', async () => {
    const hash = 'd'.repeat(40);
    const magnet = `magnet:?xt=urn:btih:${hash}`;

    fetch
      .mockResolvedValueOnce(jsonResponse({
        success: true,
        data: {
          added: [],
          failed: [{
            kind: 'magnet',
            index: 0,
            code: 'duplicate_torrent',
            message: `duplicate torrent: ${hash}`
          }]
        },
        error: null
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
