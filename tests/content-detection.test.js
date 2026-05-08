const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

function createMagnet(hash, name) {
  return `magnet:?xt=urn:btih:${hash}&dn=${encodeURIComponent(name)}`;
}

async function runContentScript(html, url) {
  const dom = new JSDOM(html, {
    url,
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });

  let messageListener;
  const storageData = {};

  dom.window.configUtils = {
    getConfig: jest.fn().mockResolvedValue({
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
    })
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
    GET_DETECTED_LINKS: 'GET_DETECTED_LINKS'
  };
  dom.window.chrome = {
    runtime: {
      id: 'test-extension-id',
      sendMessage: jest.fn(),
      onMessage: {
        addListener: jest.fn(listener => {
          messageListener = listener;
        })
      }
    },
    storage: {
      local: {
        get: jest.fn(async keys => {
          const result = {};
          keys.forEach(key => {
            result[key] = storageData[key];
          });
          return result;
        }),
        set: jest.fn(async value => {
          Object.assign(storageData, value);
        })
      }
    }
  };

  const script = fs.readFileSync(path.join(__dirname, '../src/content/content-script.js'), 'utf8');
  dom.window.eval(script);
  await new Promise(resolve => dom.window.setTimeout(resolve, 20));

  let response;
  messageListener({ type: 'GET_DETECTED_LINKS' }, {}, value => {
    response = value;
  });

  dom.window.close();
  return response;
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
});
