describe('TransmissionHandler', () => {
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
    require('../src/handlers/transmission-handler.js');
  });

  beforeEach(() => {
    global.fetch = jest.fn();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    delete global.fetch;
    console.warn.mockRestore();
  });

  test('does not send Basic auth when Transmission credentials are absent', async () => {
    fetch.mockResolvedValueOnce({
      status: 409,
      headers: {
        get: jest.fn(() => 'session-id')
      },
      ok: false
    });

    const handler = new window.TransmissionHandler({
      url: 'http://localhost:9091'
    });

    await handler.login();

    expect(fetch.mock.calls[0][1].headers).toEqual({
      'Content-Type': 'application/json'
    });
  });

  test('sends Basic auth when Transmission username is configured', async () => {
    fetch.mockResolvedValueOnce({
      status: 409,
      headers: {
        get: jest.fn(() => 'session-id')
      },
      ok: false
    });

    const handler = new window.TransmissionHandler({
      url: 'http://localhost:9091',
      username: 'user',
      password: 'pass'
    });

    await handler.login();

    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Basic dXNlcjpwYXNz');
  });

  test('accepts a full Transmission RPC URL without appending the path twice', async () => {
    fetch.mockResolvedValueOnce({
      status: 409,
      headers: {
        get: jest.fn(() => 'session-id')
      },
      ok: false
    });

    const handler = new window.TransmissionHandler({
      url: 'http://localhost:9091/transmission/rpc'
    });

    await handler.login();

    expect(fetch.mock.calls[0][0]).toBe('http://localhost:9091/transmission/rpc');
  });

  test('reports the RPC URL when Transmission cannot be reached', async () => {
    fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const handler = new window.TransmissionHandler({
      url: 'http://localhost:9091'
    });
    handler.isTesting = true;

    const result = await handler.login();

    expect(result).toBe(false);
  });
});
