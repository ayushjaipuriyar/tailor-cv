// Jest setup file for Chrome extension tests
// Provides mocks for Chrome APIs

// Mock Chrome storage API
global.chrome = {
    storage: {
        local: {
            get: jest.fn((keys) => {
                return Promise.resolve({});
            }),
            set: jest.fn((data) => {
                return Promise.resolve();
            }),
            clear: jest.fn(() => {
                return Promise.resolve();
            })
        }
    },
    runtime: {
        onMessage: {
            addListener: jest.fn()
        },
        onInstalled: {
            addListener: jest.fn()
        },
        sendMessage: jest.fn((message, callback) => {
            if (callback) callback({});
        })
    },
    contextMenus: {
        create: jest.fn(),
        onClicked: {
            addListener: jest.fn()
        }
    },
    action: {
        openPopup: jest.fn()
    },
    notifications: {
        create: jest.fn()
    }
};

// Mock fetch API
global.fetch = jest.fn(() =>
    Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(''),
        blob: () => Promise.resolve(new Blob())
    })
);

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = jest.fn();

// Mock FormData
global.FormData = class FormData {
    constructor() {
        this.data = {};
    }
    append(key, value) {
        this.data[key] = value;
    }
};

// Mock Blob
global.Blob = class Blob {
    constructor(parts, options) {
        this.parts = parts;
        this.options = options;
    }
};

// Mock importScripts for service worker
global.importScripts = jest.fn();

// Mock console methods to reduce noise in tests
global.console = {
    ...console,
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
};
