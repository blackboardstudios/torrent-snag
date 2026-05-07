// Jest setup file for Torrent Snag tests

global.chrome = {
  runtime: {
    id: 'test-extension-id',
    getURL: (path) => `chrome-extension://test-extension-id/${path}`,
    onMessage: {
      addListener: jest.fn()
    },
    sendMessage: jest.fn()
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn()
    }
  },
  tabs: {
    sendMessage: jest.fn(),
    query: jest.fn()
  },
  action: {
    setBadgeText: jest.fn(),
    setBadgeBackgroundColor: jest.fn(),
    setTitle: jest.fn()
  },
  notifications: {
    create: jest.fn()
  },
  i18n: {
    getMessage: jest.fn((key) => key)
  },
  contextMenus: {
    create: jest.fn(),
    remove: jest.fn(),
    onClicked: {
      addListener: jest.fn()
    }
  },
  commands: {
    onCommand: {
      addListener: jest.fn()
    }
  },
  alarms: {
    onAlarm: {
      addListener: jest.fn()
    },
    create: jest.fn()
  },
  windows: {
    create: jest.fn()
  }
};

global.TextEncoder = class {
  encode(str) {
    const chars = [];
    for (let i = 0; i < str.length; i++) {
      chars.push(str.charCodeAt(i));
    }
    return new Uint8Array(chars);
  }
};

global.TextDecoder = require('util').TextDecoder;

global.crypto = {
  subtle: {
    digest: jest.fn().mockResolvedValue(
      new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16])
    )
  }
};

global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');

global.atob = (str) => Buffer.from(str, 'base64').toString('binary');
