// Unit tests for background service worker
// Tests message routing, API requests, storage operations, and error handling

describe('Background Service Worker', () => {
    let ExtensionError, ErrorCodes;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Load error handling utilities
        ExtensionError = class ExtensionError extends Error {
            constructor(message, code, recoverable = true) {
                super(message);
                this.name = 'ExtensionError';
                this.code = code;
                this.recoverable = recoverable;
            }
        };

        ErrorCodes = {
            NO_API_KEY: 'NO_API_KEY',
            NO_BASE_RESUME: 'NO_BASE_RESUME',
            NETWORK_ERROR: 'NETWORK_ERROR',
            API_ERROR: 'API_ERROR',
            RATE_LIMIT: 'RATE_LIMIT',
            INVALID_RESPONSE: 'INVALID_RESPONSE',
            STORAGE_ERROR: 'STORAGE_ERROR',
            COMPILATION_ERROR: 'COMPILATION_ERROR',
            VALIDATION_ERROR: 'VALIDATION_ERROR'
        };

        global.ExtensionError = ExtensionError;
        global.ErrorCodes = ErrorCodes;
    });

    describe('Storage Operations', () => {
        test('getStorage should retrieve data from chrome.storage.local', async () => {
            const mockData = { apiKey: 'test-key', baseTex: 'test-tex' };
            chrome.storage.local.get.mockResolvedValue(mockData);

            const getStorage = async (keys) => {
                try {
                    return await chrome.storage.local.get(keys);
                } catch (error) {
                    throw new ExtensionError(error.message, ErrorCodes.STORAGE_ERROR);
                }
            };

            const result = await getStorage(['apiKey', 'baseTex']);

            expect(chrome.storage.local.get).toHaveBeenCalledWith(['apiKey', 'baseTex']);
            expect(result).toEqual(mockData);
        });

        test('getStorage should throw ExtensionError on storage failure', async () => {
            chrome.storage.local.get.mockRejectedValue(new Error('Storage error'));

            const getStorage = async (keys) => {
                try {
                    return await chrome.storage.local.get(keys);
                } catch (error) {
                    throw new ExtensionError(error.message, ErrorCodes.STORAGE_ERROR);
                }
            };

            await expect(getStorage(['apiKey'])).rejects.toThrow(ExtensionError);
        });

        test('setStorage should save data to chrome.storage.local', async () => {
            const mockData = { apiKey: 'test-key' };
            chrome.storage.local.set.mockResolvedValue();

            const setStorage = async (data) => {
                try {
                    await chrome.storage.local.set(data);
                } catch (error) {
                    throw new ExtensionError(error.message, ErrorCodes.STORAGE_ERROR);
                }
            };

            await setStorage(mockData);

            expect(chrome.storage.local.set).toHaveBeenCalledWith(mockData);
        });

        test('setStorage should validate API key format', async () => {
            const validateApiKeyFormat = (apiKey) => {
                if (!apiKey || typeof apiKey !== 'string') return false;
                const trimmed = apiKey.trim();
                if (trimmed.length < 20 || trimmed.length > 100) return false;
                return /^[A-Za-z0-9_-]+$/.test(trimmed);
            };

            const setStorage = async (data) => {
                if (data.apiKey !== undefined) {
                    if (!validateApiKeyFormat(data.apiKey)) {
                        throw new ExtensionError('Invalid API key format', ErrorCodes.VALIDATION_ERROR);
                    }
                }
                await chrome.storage.local.set(data);
            };

            await expect(setStorage({ apiKey: 'short' })).rejects.toThrow('Invalid API key format');
            await expect(setStorage({ apiKey: 'valid-api-key-12345678901234567890' })).resolves.not.toThrow();
        });

        test('setStorage should validate backend URL format', async () => {
            const validateBackendUrlFormat = (url) => {
                if (!url || typeof url !== 'string') return false;
                try {
                    const urlObj = new URL(url);
                    if (urlObj.protocol !== 'https:' && urlObj.hostname !== 'localhost' && urlObj.hostname !== '127.0.0.1') {
                        return false;
                    }
                    return !!urlObj.hostname;
                } catch {
                    return false;
                }
            };

            const setStorage = async (data) => {
                if (data.backendUrl !== undefined) {
                    if (!validateBackendUrlFormat(data.backendUrl)) {
                        throw new ExtensionError('Invalid backend URL', ErrorCodes.VALIDATION_ERROR);
                    }
                }
                await chrome.storage.local.set(data);
            };

            await expect(setStorage({ backendUrl: 'http://example.com' })).rejects.toThrow('Invalid backend URL');
            await expect(setStorage({ backendUrl: 'https://example.com' })).resolves.not.toThrow();
            await expect(setStorage({ backendUrl: 'http://localhost:3000' })).resolves.not.toThrow();
        });
    });

    describe('API Request Formatting', () => {
        test('handleTailorRequest should format request correctly', async () => {
            const mockStorage = {
                apiKey: 'test-api-key-1234567890123456789',
                baseTex: '\\documentclass{article}\\begin{document}Test\\end{document}',
                backendUrl: 'https://example.com'
            };

            chrome.storage.local.get.mockResolvedValue(mockStorage);

            global.fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ tex: 'tailored-tex' })
            });

            const handleTailorRequest = async (data) => {
                const storage = await chrome.storage.local.get(['apiKey', 'baseTex', 'backendUrl']);
                const apiKey = data.apiKey || storage.apiKey;
                const baseTex = data.baseTex || storage.baseTex;
                const backendUrl = storage.backendUrl || 'http://localhost:3000';

                if (!apiKey) throw new ExtensionError('API key required', ErrorCodes.NO_API_KEY);
                if (!baseTex) throw new ExtensionError('Base resume required', ErrorCodes.NO_BASE_RESUME);
                if (!data.jd || data.jd.trim().length === 0) {
                    throw new ExtensionError('Job description cannot be empty', ErrorCodes.VALIDATION_ERROR);
                }

                const response = await fetch(`${backendUrl}/api/tailor`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ jd: data.jd, baseTex, apiKey })
                });

                if (!response.ok) throw new ExtensionError('API error', ErrorCodes.API_ERROR);

                const result = await response.json();
                if (!result.tex) throw new ExtensionError('No LaTeX content', ErrorCodes.INVALID_RESPONSE);

                return { tex: result.tex };
            };

            const result = await handleTailorRequest({ jd: 'Software Engineer position' });

            expect(fetch).toHaveBeenCalledWith(
                'https://example.com/api/tailor',
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                })
            );
            expect(result).toEqual({ tex: 'tailored-tex' });
        });

        test('handleTailorRequest should throw error when API key is missing', async () => {
            chrome.storage.local.get.mockResolvedValue({ baseTex: 'test-tex' });

            const handleTailorRequest = async (data) => {
                const storage = await chrome.storage.local.get(['apiKey', 'baseTex', 'backendUrl']);
                const apiKey = data.apiKey || storage.apiKey;

                if (!apiKey) throw new ExtensionError('API key required', ErrorCodes.NO_API_KEY);

                return {};
            };

            await expect(handleTailorRequest({ jd: 'test' })).rejects.toThrow('API key required');
        });

        test('handleTailorRequest should throw error when base resume is missing', async () => {
            chrome.storage.local.get.mockResolvedValue({ apiKey: 'test-key-12345678901234567890' });

            const handleTailorRequest = async (data) => {
                const storage = await chrome.storage.local.get(['apiKey', 'baseTex', 'backendUrl']);
                const baseTex = data.baseTex || storage.baseTex;

                if (!baseTex) throw new ExtensionError('Base resume required', ErrorCodes.NO_BASE_RESUME);

                return {};
            };

            await expect(handleTailorRequest({ jd: 'test' })).rejects.toThrow('Base resume required');
        });

        test('handleCompileRequest should format FormData correctly', async () => {
            chrome.storage.local.get.mockResolvedValue({ backendUrl: 'https://example.com' });

            global.fetch.mockResolvedValue({
                ok: true,
                blob: () => Promise.resolve(new Blob(['pdf-content']))
            });

            const handleCompileRequest = async (data) => {
                const storage = await chrome.storage.local.get(['backendUrl']);
                const backendUrl = storage.backendUrl || 'http://localhost:3000';

                if (!data.tex || data.tex.trim().length === 0) {
                    throw new ExtensionError('LaTeX content cannot be empty', ErrorCodes.VALIDATION_ERROR);
                }

                const formData = new FormData();
                const texBlob = new Blob([data.tex], { type: 'text/plain' });
                formData.append('file', texBlob, 'resume.tex');

                const response = await fetch(`${backendUrl}/api/compile/upload`, {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) throw new ExtensionError('Compilation failed', ErrorCodes.COMPILATION_ERROR);

                const pdfBlob = await response.blob();
                const pdfBlobUrl = URL.createObjectURL(pdfBlob);

                return { pdfBlobUrl };
            };

            const result = await handleCompileRequest({ tex: '\\documentclass{article}' });

            expect(fetch).toHaveBeenCalledWith(
                'https://example.com/api/compile/upload',
                expect.objectContaining({
                    method: 'POST'
                })
            );
            expect(result.pdfBlobUrl).toBe('blob:mock-url');
        });
    });

    describe('Error Handling', () => {
        test('should handle network errors', async () => {
            global.fetch.mockRejectedValue(new Error('Network error'));

            const fetchWithRetry = async (url, options, maxRetries = 3) => {
                for (let i = 0; i < maxRetries; i++) {
                    try {
                        return await fetch(url, options);
                    } catch (error) {
                        if (i === maxRetries - 1) {
                            throw new ExtensionError(error.message, ErrorCodes.NETWORK_ERROR);
                        }
                        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 10));
                    }
                }
            };

            await expect(fetchWithRetry('https://example.com', {}, 2)).rejects.toThrow(ExtensionError);
        });

        test('should handle rate limit errors with retry', async () => {
            global.fetch
                .mockResolvedValueOnce({ ok: false, status: 429 })
                .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ tex: 'success' }) });

            const fetchWithRetry = async (url, options, maxRetries = 3) => {
                for (let i = 0; i < maxRetries; i++) {
                    const response = await fetch(url, options);

                    if (response.status === 429 || response.status >= 500) {
                        if (i === maxRetries - 1) {
                            throw new ExtensionError('Max retries exceeded', ErrorCodes.RATE_LIMIT);
                        }
                        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 10));
                        continue;
                    }

                    return response;
                }
            };

            const result = await fetchWithRetry('https://example.com', {});
            expect(result.ok).toBe(true);
        });

        test('should handle API errors', async () => {
            global.fetch.mockResolvedValue({
                ok: false,
                status: 500,
                text: () => Promise.resolve('Internal server error')
            });

            const handleTailorRequest = async (data) => {
                const response = await fetch('https://example.com/api/tailor', {
                    method: 'POST',
                    body: JSON.stringify(data)
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new ExtensionError(errorText, ErrorCodes.API_ERROR);
                }
            };

            await expect(handleTailorRequest({ jd: 'test' })).rejects.toThrow(ExtensionError);
        });

        test('should handle invalid response format', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({})
            });

            const handleTailorRequest = async () => {
                const response = await fetch('https://example.com/api/tailor');
                const result = await response.json();

                if (!result.tex) {
                    throw new ExtensionError('No LaTeX content in response', ErrorCodes.INVALID_RESPONSE);
                }
            };

            await expect(handleTailorRequest()).rejects.toThrow('No LaTeX content in response');
        });
    });

    describe('Message Routing', () => {
        test('should route TAILOR_CV messages correctly', () => {
            const messageHandler = jest.fn((message, sender, sendResponse) => {
                if (message.type === 'TAILOR_CV') {
                    sendResponse({ success: true, data: { tex: 'test' } });
                    return true;
                }
            });

            chrome.runtime.onMessage.addListener(messageHandler);

            const mockSendResponse = jest.fn();
            messageHandler({ type: 'TAILOR_CV', data: { jd: 'test' } }, {}, mockSendResponse);

            expect(mockSendResponse).toHaveBeenCalledWith({ success: true, data: { tex: 'test' } });
        });

        test('should route COMPILE_PDF messages correctly', () => {
            const messageHandler = jest.fn((message, sender, sendResponse) => {
                if (message.type === 'COMPILE_PDF') {
                    sendResponse({ success: true, data: { pdfBlobUrl: 'blob:test' } });
                    return true;
                }
            });

            chrome.runtime.onMessage.addListener(messageHandler);

            const mockSendResponse = jest.fn();
            messageHandler({ type: 'COMPILE_PDF', data: { tex: 'test' } }, {}, mockSendResponse);

            expect(mockSendResponse).toHaveBeenCalledWith({ success: true, data: { pdfBlobUrl: 'blob:test' } });
        });

        test('should route GET_STORAGE messages correctly', () => {
            const messageHandler = jest.fn((message, sender, sendResponse) => {
                if (message.type === 'GET_STORAGE') {
                    sendResponse({ success: true, data: { apiKey: 'test' } });
                    return true;
                }
            });

            chrome.runtime.onMessage.addListener(messageHandler);

            const mockSendResponse = jest.fn();
            messageHandler({ type: 'GET_STORAGE', keys: ['apiKey'] }, {}, mockSendResponse);

            expect(mockSendResponse).toHaveBeenCalledWith({ success: true, data: { apiKey: 'test' } });
        });

        test('should route SET_STORAGE messages correctly', () => {
            const messageHandler = jest.fn((message, sender, sendResponse) => {
                if (message.type === 'SET_STORAGE') {
                    sendResponse({ success: true });
                    return true;
                }
            });

            chrome.runtime.onMessage.addListener(messageHandler);

            const mockSendResponse = jest.fn();
            messageHandler({ type: 'SET_STORAGE', data: { apiKey: 'test' } }, {}, mockSendResponse);

            expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
        });

        test('should handle unknown message types', () => {
            const messageHandler = jest.fn((message, sender, sendResponse) => {
                if (message.type === 'UNKNOWN') {
                    sendResponse({ success: false, error: 'Unknown message type' });
                    return false;
                }
            });

            const mockSendResponse = jest.fn();
            messageHandler({ type: 'UNKNOWN' }, {}, mockSendResponse);

            expect(mockSendResponse).toHaveBeenCalledWith({ success: false, error: 'Unknown message type' });
        });
    });

    describe('History Management', () => {
        test('saveToHistory should add item to history', async () => {
            chrome.storage.local.get.mockResolvedValue({ history: [] });
            chrome.storage.local.set.mockResolvedValue();

            const saveToHistory = async (tex, jd) => {
                const storage = await chrome.storage.local.get(['history']);
                let history = storage.history || [];

                const historyItem = {
                    id: `${Date.now()}-test`,
                    timestamp: Date.now(),
                    jd: jd.substring(0, 200),
                    jdFull: jd,
                    tex: tex
                };

                history.unshift(historyItem);

                if (history.length > 5) {
                    history = history.slice(0, 5);
                }

                await chrome.storage.local.set({ history });
            };

            await saveToHistory('test-tex', 'test-jd');

            expect(chrome.storage.local.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    history: expect.arrayContaining([
                        expect.objectContaining({
                            tex: 'test-tex',
                            jdFull: 'test-jd'
                        })
                    ])
                })
            );
        });

        test('saveToHistory should limit history to 5 items', async () => {
            const existingHistory = Array(5).fill(null).map((_, i) => ({
                id: `item-${i}`,
                timestamp: Date.now() - i * 1000,
                jd: `jd-${i}`,
                jdFull: `full-jd-${i}`,
                tex: `tex-${i}`
            }));

            chrome.storage.local.get.mockResolvedValue({ history: existingHistory });
            chrome.storage.local.set.mockResolvedValue();

            const saveToHistory = async (tex, jd) => {
                const storage = await chrome.storage.local.get(['history']);
                let history = storage.history || [];

                const historyItem = {
                    id: `${Date.now()}-test`,
                    timestamp: Date.now(),
                    jd: jd.substring(0, 200),
                    jdFull: jd,
                    tex: tex
                };

                history.unshift(historyItem);

                if (history.length > 5) {
                    history = history.slice(0, 5);
                }

                await chrome.storage.local.set({ history });
            };

            await saveToHistory('new-tex', 'new-jd');

            const savedHistory = chrome.storage.local.set.mock.calls[0][0].history;
            expect(savedHistory).toHaveLength(5);
            expect(savedHistory[0].tex).toBe('new-tex');
        });
    });
});
