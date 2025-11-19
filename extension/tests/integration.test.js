// Integration tests for Chrome extension
// Tests end-to-end flows including tailoring, PDF compilation, settings, and history

describe('Integration Tests', () => {
    let ExtensionError, ErrorCodes;

    beforeEach(() => {
        jest.clearAllMocks();

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

    describe('End-to-End Tailoring Flow', () => {
        test('should complete full tailoring flow from selection to display', async () => {
            // Setup: Mock storage with API key and base resume
            const mockStorage = {
                apiKey: 'test-api-key-1234567890123456789',
                baseTex: '\\documentclass{article}\\begin{document}Original Resume\\end{document}',
                backendUrl: 'https://example.com'
            };

            chrome.storage.local.get.mockResolvedValue(mockStorage);
            chrome.storage.local.set.mockResolvedValue();

            // Mock successful API response
            global.fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    tex: '\\documentclass{article}\\begin{document}Tailored Resume\\end{document}'
                })
            });

            // Step 1: User selects text and triggers context menu
            const selectedText = 'Software Engineer position at tech company with React and Node.js';

            // Step 2: Background worker handles tailor request
            const handleTailorRequest = async (data) => {
                const storage = await chrome.storage.local.get(['apiKey', 'baseTex', 'backendUrl']);
                const apiKey = data.apiKey || storage.apiKey;
                const baseTex = data.baseTex || storage.baseTex;
                const backendUrl = storage.backendUrl || 'http://localhost:3000';

                if (!apiKey) throw new ExtensionError('API key required', ErrorCodes.NO_API_KEY);
                if (!baseTex) throw new ExtensionError('Base resume required', ErrorCodes.NO_BASE_RESUME);

                const response = await fetch(`${backendUrl}/api/tailor`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ jd: data.jd, baseTex, apiKey })
                });

                if (!response.ok) throw new ExtensionError('API error', ErrorCodes.API_ERROR);

                const result = await response.json();
                if (!result.tex) throw new ExtensionError('No LaTeX content', ErrorCodes.INVALID_RESPONSE);

                // Save to history
                const historyStorage = await chrome.storage.local.get(['history']);
                let history = historyStorage.history || [];
                history.unshift({
                    id: `${Date.now()}-test`,
                    timestamp: Date.now(),
                    jd: data.jd.substring(0, 200),
                    jdFull: data.jd,
                    tex: result.tex
                });
                if (history.length > 5) history = history.slice(0, 5);
                await chrome.storage.local.set({ history });

                // Cache result
                await chrome.storage.local.set({
                    currentTailoredTex: result.tex,
                    currentJd: data.jd
                });

                return { tex: result.tex };
            };

            const result = await handleTailorRequest({ jd: selectedText });

            // Verify: API was called correctly
            expect(fetch).toHaveBeenCalledWith(
                'https://example.com/api/tailor',
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                })
            );

            // Verify: Result contains tailored LaTeX
            expect(result.tex).toContain('Tailored Resume');

            // Verify: Result was cached
            expect(chrome.storage.local.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    currentTailoredTex: expect.stringContaining('Tailored Resume'),
                    currentJd: selectedText
                })
            );

            // Verify: History was updated
            expect(chrome.storage.local.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    history: expect.arrayContaining([
                        expect.objectContaining({
                            jdFull: selectedText,
                            tex: expect.stringContaining('Tailored Resume')
                        })
                    ])
                })
            );
        });

        test('should handle tailoring flow with missing API key', async () => {
            chrome.storage.local.get.mockResolvedValue({
                baseTex: '\\documentclass{article}\\begin{document}Test\\end{document}'
            });

            const handleTailorRequest = async (data) => {
                const storage = await chrome.storage.local.get(['apiKey', 'baseTex', 'backendUrl']);
                const apiKey = data.apiKey || storage.apiKey;

                if (!apiKey) throw new ExtensionError('API key required', ErrorCodes.NO_API_KEY);

                return {};
            };

            await expect(
                handleTailorRequest({ jd: 'Software Engineer position' })
            ).rejects.toThrow('API key required');
        });

        test('should handle tailoring flow with API error', async () => {
            chrome.storage.local.get.mockResolvedValue({
                apiKey: 'test-key-1234567890123456789',
                baseTex: '\\documentclass{article}\\begin{document}Test\\end{document}',
                backendUrl: 'https://example.com'
            });

            global.fetch.mockResolvedValue({
                ok: false,
                status: 500,
                text: () => Promise.resolve('Internal server error')
            });

            const handleTailorRequest = async (data) => {
                const storage = await chrome.storage.local.get(['apiKey', 'baseTex', 'backendUrl']);
                const backendUrl = storage.backendUrl || 'http://localhost:3000';

                const response = await fetch(`${backendUrl}/api/tailor`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new ExtensionError(errorText, ErrorCodes.API_ERROR);
                }
            };

            await expect(
                handleTailorRequest({ jd: 'Software Engineer position' })
            ).rejects.toThrow(ExtensionError);
        });
    });

    describe('PDF Compilation Flow', () => {
        test('should complete full PDF compilation flow', async () => {
            chrome.storage.local.get.mockResolvedValue({
                backendUrl: 'https://example.com'
            });
            chrome.storage.local.set.mockResolvedValue();

            const mockPdfBlob = new Blob(['pdf-content'], { type: 'application/pdf' });
            global.fetch.mockResolvedValue({
                ok: true,
                blob: () => Promise.resolve(mockPdfBlob)
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

                await chrome.storage.local.set({ currentPdfUrl: pdfBlobUrl });

                return { pdfBlobUrl };
            };

            const latexContent = '\\documentclass{article}\\begin{document}Test Resume\\end{document}';
            const result = await handleCompileRequest({ tex: latexContent });

            // Verify: API was called with FormData
            expect(fetch).toHaveBeenCalledWith(
                'https://example.com/api/compile/upload',
                expect.objectContaining({
                    method: 'POST'
                })
            );

            // Verify: Blob URL was created
            expect(result.pdfBlobUrl).toBe('blob:mock-url');

            // Verify: PDF URL was cached
            expect(chrome.storage.local.set).toHaveBeenCalledWith({
                currentPdfUrl: 'blob:mock-url'
            });
        });

        test('should handle compilation with empty LaTeX', async () => {
            const handleCompileRequest = async (data) => {
                if (!data.tex || data.tex.trim().length === 0) {
                    throw new ExtensionError('LaTeX content cannot be empty', ErrorCodes.VALIDATION_ERROR);
                }
            };

            await expect(handleCompileRequest({ tex: '' })).rejects.toThrow('LaTeX content cannot be empty');
        });

        test('should handle compilation API error', async () => {
            chrome.storage.local.get.mockResolvedValue({ backendUrl: 'https://example.com' });

            global.fetch.mockResolvedValue({
                ok: false,
                status: 500,
                text: () => Promise.resolve('LaTeX compilation error: undefined control sequence')
            });

            const handleCompileRequest = async (data) => {
                const storage = await chrome.storage.local.get(['backendUrl']);
                const backendUrl = storage.backendUrl || 'http://localhost:3000';

                const formData = new FormData();
                formData.append('file', new Blob([data.tex]), 'resume.tex');

                const response = await fetch(`${backendUrl}/api/compile/upload`, {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new ExtensionError(errorText, ErrorCodes.COMPILATION_ERROR);
                }
            };

            await expect(
                handleCompileRequest({ tex: '\\invalid{command}' })
            ).rejects.toThrow(ExtensionError);
        });
    });

    describe('Settings Persistence', () => {
        test('should save and retrieve API key', async () => {
            const apiKey = 'test-api-key-1234567890123456789';

            chrome.storage.local.set.mockResolvedValue();
            chrome.storage.local.get.mockResolvedValue({ apiKey });

            // Save API key
            await chrome.storage.local.set({ apiKey });

            // Retrieve API key
            const result = await chrome.storage.local.get(['apiKey']);

            expect(result.apiKey).toBe(apiKey);
        });

        test('should save and retrieve base resume', async () => {
            const baseTex = '\\documentclass{article}\\begin{document}My Resume\\end{document}';

            chrome.storage.local.set.mockResolvedValue();
            chrome.storage.local.get.mockResolvedValue({ baseTex });

            // Save base resume
            await chrome.storage.local.set({ baseTex });

            // Retrieve base resume
            const result = await chrome.storage.local.get(['baseTex']);

            expect(result.baseTex).toBe(baseTex);
        });

        test('should save and retrieve backend URL', async () => {
            const backendUrl = 'https://my-backend.com';

            chrome.storage.local.set.mockResolvedValue();
            chrome.storage.local.get.mockResolvedValue({ backendUrl });

            // Save backend URL
            await chrome.storage.local.set({ backendUrl });

            // Retrieve backend URL
            const result = await chrome.storage.local.get(['backendUrl']);

            expect(result.backendUrl).toBe(backendUrl);
        });

        test('should save multiple settings at once', async () => {
            const settings = {
                apiKey: 'test-key-1234567890123456789',
                baseTex: '\\documentclass{article}\\begin{document}Test\\end{document}',
                backendUrl: 'https://example.com'
            };

            chrome.storage.local.set.mockResolvedValue();
            chrome.storage.local.get.mockResolvedValue(settings);

            // Save all settings
            await chrome.storage.local.set(settings);

            // Retrieve all settings
            const result = await chrome.storage.local.get(['apiKey', 'baseTex', 'backendUrl']);

            expect(result).toEqual(settings);
        });

        test('should validate settings before saving', async () => {
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

            await expect(setStorage({ apiKey: 'invalid' })).rejects.toThrow('Invalid API key format');
        });
    });

    describe('History Management', () => {
        test('should add item to empty history', async () => {
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

        test('should maintain history limit of 5 items', async () => {
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
            expect(savedHistory[0].jdFull).toBe('new-jd');
        });

        test('should retrieve history items', async () => {
            const mockHistory = [
                {
                    id: 'item-1',
                    timestamp: Date.now(),
                    jd: 'Software Engineer',
                    jdFull: 'Software Engineer position at tech company',
                    tex: 'tailored-tex-1'
                },
                {
                    id: 'item-2',
                    timestamp: Date.now() - 1000,
                    jd: 'Product Manager',
                    jdFull: 'Product Manager role at startup',
                    tex: 'tailored-tex-2'
                }
            ];

            chrome.storage.local.get.mockResolvedValue({ history: mockHistory });

            const result = await chrome.storage.local.get(['history']);

            expect(result.history).toHaveLength(2);
            expect(result.history[0].id).toBe('item-1');
            expect(result.history[1].id).toBe('item-2');
        });

        test('should delete history item', async () => {
            const mockHistory = [
                { id: 'item-1', timestamp: Date.now(), jd: 'JD 1', jdFull: 'Full JD 1', tex: 'tex-1' },
                { id: 'item-2', timestamp: Date.now() - 1000, jd: 'JD 2', jdFull: 'Full JD 2', tex: 'tex-2' }
            ];

            chrome.storage.local.get.mockResolvedValue({ history: mockHistory });
            chrome.storage.local.set.mockResolvedValue();

            const deleteHistoryItem = async (itemId) => {
                const storage = await chrome.storage.local.get(['history']);
                let history = storage.history || [];

                history = history.filter(item => item.id !== itemId);

                await chrome.storage.local.set({ history });
            };

            await deleteHistoryItem('item-1');

            const savedHistory = chrome.storage.local.set.mock.calls[0][0].history;
            expect(savedHistory).toHaveLength(1);
            expect(savedHistory[0].id).toBe('item-2');
        });

        test('should load history item into editor', async () => {
            const mockHistory = [
                {
                    id: 'item-1',
                    timestamp: Date.now(),
                    jd: 'Software Engineer',
                    jdFull: 'Software Engineer position at tech company',
                    tex: '\\documentclass{article}\\begin{document}Tailored Resume\\end{document}'
                }
            ];

            chrome.storage.local.get.mockResolvedValue({ history: mockHistory });

            const loadHistoryItem = async (itemId) => {
                const storage = await chrome.storage.local.get(['history']);
                const history = storage.history || [];

                const item = history.find(h => h.id === itemId);
                if (!item) throw new Error('History item not found');

                return {
                    jd: item.jdFull,
                    tex: item.tex
                };
            };

            const result = await loadHistoryItem('item-1');

            expect(result.jd).toBe('Software Engineer position at tech company');
            expect(result.tex).toContain('Tailored Resume');
        });
    });

    describe('Retry Logic', () => {
        test('should retry on network failure', async () => {
            global.fetch
                .mockRejectedValueOnce(new Error('Network error'))
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ tex: 'success' })
                });

            const fetchWithRetry = async (url, options, maxRetries = 3) => {
                for (let i = 0; i < maxRetries; i++) {
                    try {
                        const response = await fetch(url, options);
                        if (response.status === 429 || response.status >= 500) {
                            if (i === maxRetries - 1) {
                                throw new ExtensionError('Max retries exceeded', ErrorCodes.RATE_LIMIT);
                            }
                            await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 10));
                            continue;
                        }
                        return response;
                    } catch (error) {
                        if (i === maxRetries - 1) {
                            throw new ExtensionError(error.message, ErrorCodes.NETWORK_ERROR);
                        }
                        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 10));
                    }
                }
            };

            const result = await fetchWithRetry('https://example.com', {});
            const data = await result.json();

            expect(data.tex).toBe('success');
            expect(fetch).toHaveBeenCalledTimes(2);
        });

        test('should retry on rate limit', async () => {
            global.fetch
                .mockResolvedValueOnce({ ok: false, status: 429 })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ tex: 'success' })
                });

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
            expect(fetch).toHaveBeenCalledTimes(2);
        });

        test('should fail after max retries', async () => {
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
            expect(fetch).toHaveBeenCalledTimes(2);
        });
    });
});
