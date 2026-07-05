const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

function createMagnet(hash, name) {
  return `magnet:?xt=urn:btih:${hash}&dn=${encodeURIComponent(name)}`;
}

async function initializeContentScript(html, url, options = {}) {
  const dom = new JSDOM(html, {
    url,
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });

  const storageData = {};
  let messageListener;

  const defaultConfig = {
    patterns: [
      {
        id: 'magnet-links',
        regex: 'magnet:\\?xt=urn:btih:(?:[a-fA-F0-9]{40}|[a-zA-Z2-7]{32})[^\\s]*',
        enabled: true
      }
    ],
    filters: [],
    performance: {
      maxLinksPerScan: 1000,
      chunkSize: 100,
      debounceDelay: 10
    }
  };

  const configValue = options.config || defaultConfig;
  const getConfigDelayMs = options.getConfigDelayMs || 0;
  const configResolver = () => new Promise(resolve => {
    if (getConfigDelayMs > 0) {
      dom.window.setTimeout(() => resolve(configValue), getConfigDelayMs);
      return;
    }

    resolve(configValue);
  });
  const getConfigImpl = options.getConfigImpl || (() => configResolver());

  const runtimeMessageResult = options.tabId === undefined
    ? { tabId: 77 }
    : { tabId: options.tabId };

  let sendMessageImpl = options.sendMessageImpl;
  if (!sendMessageImpl) {
    sendMessageImpl = (message) => {
      if (message?.type === 'GET_TAB_ID') {
        return Promise.resolve(runtimeMessageResult);
      }
      return Promise.resolve();
    };
  }

  dom.window.configUtils = {
    getConfig: jest.fn().mockImplementation(getConfigImpl)
  };
  dom.window.hashUtils = {
    generateHash: jest.fn(async linkUrl => {
      const match = linkUrl.match(/btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})/i);
      return match ? match[1].toLowerCase() : linkUrl;
    })
  };
  dom.window.duplicateTracker = {
    hasHash: jest.fn().mockResolvedValue(false)
  };
  dom.window.MESSAGE_TYPES = {
    UPDATE_BADGE: 'UPDATE_BADGE',
    GET_TAB_ID: 'GET_TAB_ID',
    GET_DETECTED_LINKS: 'GET_DETECTED_LINKS',
    CLEAR_DETECTED_LINKS: 'CLEAR_DETECTED_LINKS',
    REMOVE_DETECTED_LINKS: 'REMOVE_DETECTED_LINKS',
    RESCAN_PAGE: 'RESCAN_PAGE'
  };
  dom.window.chrome = {
    runtime: {
      id: 'test-extension-id',
      sendMessage: jest.fn(sendMessageImpl),
      onMessage: {
        addListener: jest.fn(listener => {
          messageListener = listener;
        })
      }
    },
    storage: {
      local: {
        get: jest.fn(async keys => {
          const requestedKeys = Array.isArray(keys) ? keys : [keys];
          const result = {};
          requestedKeys.forEach(key => {
            if (key in storageData) {
              result[key] = storageData[key];
            }
          });
          return result;
        }),
        set: jest.fn(async value => {
          Object.assign(storageData, value);
        }),
        remove: jest.fn(async keys => {
          const keyList = Array.isArray(keys) ? keys : [keys];
          keyList.forEach(key => {
            delete storageData[key];
          });
        })
      }
    }
  };

  dom.window.STORAGE_KEYS = {
    DETECTED_LINKS_PREFIX: 'detectedLinks_'
  };
  dom.window.TextEncoder = TextEncoder;
  dom.window.TextDecoder = TextDecoder;

  dom.window.crypto = dom.window.crypto || {};
  dom.window.crypto.subtle = {
    digest: jest.fn(async (_algorithm, data) => {
      return crypto.createHash('sha256').update(Buffer.from(new Uint8Array(data))).digest();
    })
  };

  if (options.regExpFactory) {
    dom.window.RegExp = options.regExpFactory(dom.window.RegExp);
  }

  const script = fs.readFileSync(path.join(__dirname, '../src/content/content-script.js'), 'utf8');
  dom.window.eval(script);
  await new Promise(resolve => dom.window.setTimeout(resolve, 20));

    return { dom, messageListener, storageData };
  }

function sendMessage(messageListener, message) {
  return new Promise(resolve => {
    messageListener(message, {}, response => {
      resolve(response);
    });
  });
}

async function runContentScript(html, url, options = {}) {
  const { dom, messageListener } = await initializeContentScript(html, url, options);
  try {
    return await sendMessage(messageListener, { type: 'GET_DETECTED_LINKS' });
  } finally {
    dom.window.close();
  }
}

describe('content script detection', () => {
  test('prefers detail containers over unrelated page-level torrent links', async () => {
    const primaryMagnet = createMagnet('1111111111111111111111111111111111111111', 'Primary Torrent');
    const descriptionMagnet = createMagnet('2222222222222222222222222222222222222222', 'Description Torrent');
    const injectedMagnet = createMagnet('3333333333333333333333333333333333333333', 'Injected Unrelated Torrent');

    const response = await runContentScript(`
      <main>
        <div id="description_container">
          <div class="links"><a href="${primaryMagnet}">Get This Torrent</a></div>
          <div id="description_text"><a href="${descriptionMagnet}">Extra file</a></div>
        </div>
        <div id="injected-results"><a href="${injectedMagnet}">Injected Unrelated Torrent</a></div>
      </main>
    `, 'https://example.test/items/83035619');

    expect(response.count).toBe(2);
    expect(response.links.map(link => link.url)).toEqual([primaryMagnet, descriptionMagnet]);
  });

  test('supports unicode URLs without btoa path errors', async () => {
    const response = await runContentScript(`
      <main>
        <a href="${createMagnet('4444444444444444444444444444444444444444', '中文种子')}">中文种子</a>
      </main>
    `, 'https://example.test/路径/下载?查询=种子', { tabId: 99 });

    expect(response.count).toBe(1);
    expect(response.links[0].url).toContain('dn=%E4%B8%AD%E6%96%87%E7%A7%8D%E5%AD%90');
  });

  test('uses deterministic fallback storage keys in URL mode and keeps keys short', async () => {
    const instance = await initializeContentScript(`
      <main>
        <a href="${createMagnet('5555555555555555555555555555555555555555', 'Fallback torrent')}">Fallback torrent</a>
      </main>
    `, 'https://example.test/some/very/long/path/with/a/lot/of/segments/and/a-very-long-query?abc=1&def=2&ghi=3', { tabId: {} });

    await sendMessage(instance.messageListener, { type: 'GET_DETECTED_LINKS' });

    const storageKeys = Object.keys(instance.storageData);
    expect(storageKeys.length).toBe(1);

    const storageKey = storageKeys[0];
    expect(storageKey).toMatch(/^detectedLinks_url_[a-f0-9]{64}$/);
    instance.dom.window.close();
  });

  test('scopes fallback storage keys by tab id for each content script instance', async () => {
    const html = `
      <main>
        <a href="${createMagnet('9999999999999999999999999999999999999999', 'Shared url') }">Shared URL</a>
      </main>
    `;

    const firstInstance = await initializeContentScript(html, 'https://example.test/shared', { tabId: 101 });
    const secondInstance = await initializeContentScript(html, 'https://example.test/shared', { tabId: 102 });

    await sendMessage(firstInstance.messageListener, { type: 'GET_DETECTED_LINKS' });
    await sendMessage(secondInstance.messageListener, { type: 'GET_DETECTED_LINKS' });

    const firstKeys = Object.keys(firstInstance.storageData);
    const secondKeys = Object.keys(secondInstance.storageData);

    expect(firstKeys).toEqual(['detectedLinks_tab_101']);
    expect(secondKeys).toEqual(['detectedLinks_tab_102']);
    expect(firstKeys[0]).not.toBe(secondKeys[0]);

    firstInstance.dom.window.close();
    secondInstance.dom.window.close();
  });

  test('recomputes fallback storage scope on URL changes and removes previous scope', async () => {
    const html = `
      <main>
        <a href="${createMagnet('6666666666666666666666666666666666666666', 'Changing torrent')}">Changing</a>
      </main>
    `;

    const instance = await initializeContentScript(html, 'https://example.test/path/resource?id=1', { tabId: {} });

    await sendMessage(instance.messageListener, { type: 'GET_DETECTED_LINKS' });

    const firstKey = Object.keys(instance.storageData).find(key => key.startsWith('detectedLinks_url_'));
    expect(firstKey).toBeDefined();

    instance.dom.reconfigure({ url: 'https://example.test/path/resource?id=2' });
    await sendMessage(instance.messageListener, { type: 'RESCAN_PAGE' });

    const keyList = Object.keys(instance.storageData).filter(key => key.startsWith('detectedLinks_url_'));
    expect(keyList.length).toBe(1);
    expect(keyList[0]).not.toBe(firstKey);

    instance.dom.window.close();
  });

  test('clears detected links by removing storage key', async () => {
    const { dom, messageListener, storageData } = await initializeContentScript(`
      <main>
        <a href="${createMagnet('7777777777777777777777777777777777777777', 'Clear me')}">Clear me</a>
      </main>
    `, 'https://example.test/clear-links');

    await sendMessage(messageListener, { type: 'GET_DETECTED_LINKS' });
    const keysBeforeClear = Object.keys(storageData);
    expect(keysBeforeClear.length).toBe(1);

    const clearResponse = await sendMessage(messageListener, { type: 'CLEAR_DETECTED_LINKS' });
    expect(clearResponse).toEqual({ success: true });
    expect(Object.keys(storageData).length).toBe(0);

    dom.window.close();
  });

  test('removes only the specified links when handling REMOVE_DETECTED_LINKS', async () => {
    const { dom, messageListener, storageData } = await initializeContentScript(`
      <main>
        <a href="https://example.test/keep.torrent">Keep</a>
        <a href="https://example.test/remove-a.torrent">Remove A</a>
        <a href="https://example.test/remove-b.torrent">Remove B</a>
      </main>
    `, 'https://example.test/multi-remove', {
      config: {
        patterns: [
          {
            id: 'direct-torrent',
            regex: 'https?://[^\\s]*\\.torrent(?:\\?[^\\s]*)?',
            enabled: true
          }
        ],
        filters: [],
        performance: {
          maxLinksPerScan: 1000,
          chunkSize: 100,
          debounceDelay: 10
        }
      }
    });

    const initial = await sendMessage(messageListener, { type: 'GET_DETECTED_LINKS' });
    expect(initial.count).toBe(3);

    const response = await sendMessage(messageListener, {
      type: 'REMOVE_DETECTED_LINKS',
      urls: [
        'https://example.test/remove-a.torrent',
        'https://example.test/remove-b.torrent'
      ]
    });
    expect(response).toEqual({ success: true, removedCount: 2 });

    const after = await sendMessage(messageListener, { type: 'GET_DETECTED_LINKS' });
    expect(after.count).toBe(1);
    expect(after.links[0].url).toBe('https://example.test/keep.torrent');

    const storageKey = Object.keys(storageData)[0];
    expect(storageData[storageKey].length).toBe(1);
    expect(storageData[storageKey][0].url).toBe('https://example.test/keep.torrent');

    dom.window.close();
  });

  test('refreshes scans with updated config after CONFIG_UPDATED', async () => {
    const currentConfig = {
      patterns: [
        {
          id: 'direct-torrent',
          regex: 'https?://[^\\s]*keep\\.torrent',
          enabled: true
        }
      ],
      filters: [],
      performance: {
        maxLinksPerScan: 1000,
        chunkSize: 100,
        debounceDelay: 10
      }
    };

    const { dom, messageListener } = await initializeContentScript(`
      <main>
        <a href="https://example.test/keep.torrent">Keep</a>
        <a href="https://example.test/changed.torrent">Changed</a>
      </main>
    `, 'https://example.test/config-refresh', {
      config: currentConfig
    });

    const initial = await sendMessage(messageListener, { type: 'GET_DETECTED_LINKS' });
    expect(initial.count).toBe(1);
    expect(initial.links[0].url).toBe('https://example.test/keep.torrent');

    currentConfig.patterns = [{
      id: 'direct-torrent',
      regex: 'https?://[^\\s]*changed\\.torrent',
      enabled: true
    }];

    messageListener({ type: 'CONFIG_UPDATED' }, {}, () => {});
    await new Promise(resolve => dom.window.setTimeout(resolve, 20));
    await sendMessage(messageListener, { type: 'RESCAN_PAGE' });

    const updated = await sendMessage(messageListener, { type: 'GET_DETECTED_LINKS' });
    expect(updated.count).toBe(1);
    expect(updated.links[0].url).toBe('https://example.test/changed.torrent');

    dom.window.close();
  });

  test('does not scan or throw before delayed config initialization resolves', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const instance = await initializeContentScript(`
      <main>
        <a href="${createMagnet('8888888888888888888888888888888888888888', 'Delayed init')}">Delayed init</a>
      </main>
    `, 'https://example.test/delayed-config', { getConfigDelayMs: 1200 });

    await new Promise(resolve => instance.dom.window.setTimeout(resolve, 1100));
    await new Promise(resolve => instance.dom.window.setTimeout(resolve, 200));

    const response = await sendMessage(instance.messageListener, { type: 'GET_DETECTED_LINKS' });
    expect(response.count).toBe(1);
    expect(errorSpy).not.toHaveBeenCalled();

    errorSpy.mockRestore();
    instance.dom.window.close();
  });

  test('keeps query-based torrent URLs distinct', async () => {
    const response = await runContentScript(`
      <main>
        <a href="https://example.test/download.php?id=1">One</a>
        <a href="https://example.test/download.php?id=2">Two</a>
      </main>
    `, 'https://example.test/download-page', {
      tabId: 88,
      config: {
        patterns: [
          {
            id: 'direct-download',
            regex: 'https://example\\.test/download\\.php',
            enabled: true
          }
        ],
        filters: [],
        performance: {
          maxLinksPerScan: 1000,
          chunkSize: 100,
          debounceDelay: 10
        }
      }
    });

    expect(response.count).toBe(2);
    expect(response.links.map(link => link.url).sort()).toEqual([
      'https://example.test/download.php?id=1',
      'https://example.test/download.php?id=2'
    ]);
  });

  test('treats identical btih magnet links as one torrent regardless of tracker parameters', async () => {
    const response = await runContentScript(`
      <main>
        <a href="${createMagnet('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'Mag 1')}">A</a>
        <a href="${createMagnet('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')}&tr=https://tracker.one">B</a>
      </main>
    `, 'https://example.test/magnet-same-btih');

    expect(response.count).toBe(1);
  });
});
