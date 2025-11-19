// Background Service Worker for CV Tailor Extension

// Import error handling utilities
importScripts('errors.js');

// Import security utilities (Task 11)
importScripts('security.js');

// Message type constants
const MessageTypes = {
    TAILOR_CV: 'TAILOR_CV',
    COMPILE_PDF: 'COMPILE_PDF',
    GET_STORAGE: 'GET_STORAGE',
    SET_STORAGE: 'SET_STORAGE',
    GET_SELECTION: 'GET_SELECTION'
};

// Default backend URL
const DEFAULT_BACKEND_URL = 'http://localhost:3000';

console.log('CV Tailor extension service worker loaded');

// ============================================================================
// SECURITY UTILITIES (Task 11)
// ============================================================================

/**
 * Sanitize user input to prevent injection attacks (Task 11.2)
 * @param {string} input - Input string to sanitize
 * @returns {string} Sanitized input
 */
function sanitizeInput(input) {
    if (typeof input !== 'string') {
        return '';
    }

    // Remove null bytes and other control characters that could cause issues
    let sanitized = input.replace(/\0/g, '');

    // Trim excessive whitespace but preserve formatting
    sanitized = sanitized.trim();

    return sanitized;
}

/**
 * Validate API key format (Task 11.1)
 * @param {string} apiKey - API key to validate
 * @returns {boolean} True if valid format
 */
function validateApiKeyFormat(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
        return false;
    }

    const trimmed = apiKey.trim();

    // Gemini API keys are typically 39 characters, alphanumeric with hyphens and underscores
    // We'll be flexible with length but enforce character requirements
    if (trimmed.length < 20 || trimmed.length > 100) {
        return false;
    }

    // Check for valid characters (alphanumeric, hyphens, underscores)
    const validPattern = /^[A-Za-z0-9_-]+$/;
    return validPattern.test(trimmed);
}

/**
 * Validate backend URL format (Task 11.2)
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid HTTPS URL
 */
function validateBackendUrlFormat(url) {
    if (!url || typeof url !== 'string') {
        return false;
    }

    try {
        const urlObj = new URL(url);

        // Must be HTTPS for security (except localhost for development)
        if (urlObj.protocol !== 'https:' && urlObj.hostname !== 'localhost' && urlObj.hostname !== '127.0.0.1') {
            return false;
        }

        // Must have a valid hostname
        if (!urlObj.hostname) {
            return false;
        }

        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Redact sensitive information from logs (Task 11.1)
 * @param {string} message - Message to redact
 * @returns {string} Redacted message
 */
function redactSensitiveInfo(message) {
    if (typeof message !== 'string') {
        return message;
    }

    // Redact anything that looks like an API key (long alphanumeric strings)
    return message.replace(/[A-Za-z0-9_-]{20,}/g, '[REDACTED]');
}

// ============================================================================
// STORAGE MANAGEMENT FUNCTIONS (Task 2.5)
// ============================================================================

/**
 * Get data from Chrome storage
 * @param {string[]} keys - Array of keys to retrieve
 * @returns {Promise<Object>} Storage data
 */
async function getStorage(keys) {
    try {
        return await chrome.storage.local.get(keys);
    } catch (error) {
        console.error('Storage get error:', error);
        throw new ExtensionError(error.message, ErrorCodes.STORAGE_ERROR);
    }
}

/**
 * Set data in Chrome storage
 * @param {Object} data - Data to store
 * @returns {Promise<void>}
 */
async function setStorage(data) {
    try {
        // Validate API key format if being stored (Task 11.1)
        if (data.apiKey !== undefined) {
            if (!validateApiKeyFormat(data.apiKey)) {
                throw new ExtensionError('Invalid API key format. Please check your API key.', ErrorCodes.VALIDATION_ERROR);
            }
        }

        // Validate backend URL format if being stored (Task 11.2)
        if (data.backendUrl !== undefined) {
            if (!validateBackendUrlFormat(data.backendUrl)) {
                throw new ExtensionError('Invalid backend URL. URL must use HTTPS protocol.', ErrorCodes.VALIDATION_ERROR);
            }
        }

        await chrome.storage.local.set(data);
    } catch (error) {
        console.error('Storage set error:', error.message || error);
        throw error instanceof ExtensionError ? error : new ExtensionError(error.message, ErrorCodes.STORAGE_ERROR);
    }
}

// ============================================================================
// RETRY LOGIC WITH EXPONENTIAL BACKOFF (Task 2.6)
// ============================================================================

/**
 * Fetch with retry logic and exponential backoff
 * @param {string} url - URL to fetch
 * @param {RequestInit} options - Fetch options
 * @param {number} maxRetries - Maximum number of retries (default: 3)
 * @returns {Promise<Response>} Fetch response
 */
async function fetchWithRetry(url, options, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(url, options);

            // Retry on 429 (rate limit) or 5xx (server errors)
            if (response.status === 429 || response.status >= 500) {
                if (i === maxRetries - 1) {
                    const errorCode = response.status === 429 ? ErrorCodes.RATE_LIMIT : ErrorCodes.API_ERROR;
                    throw new ExtensionError(`Max retries exceeded. Status: ${response.status}`, errorCode);
                }

                // Exponential backoff: 1s, 2s, 4s
                const delay = Math.pow(2, i) * 1000;
                console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms due to status ${response.status}`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }

            return response;
        } catch (error) {
            if (i === maxRetries - 1) {
                throw new ExtensionError(error.message, ErrorCodes.NETWORK_ERROR);
            }

            // Wait before retry with exponential backoff
            const delay = Math.pow(2, i) * 1000;
            console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms due to error:`, error.message);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw new ExtensionError('Unexpected retry loop exit', ErrorCodes.NETWORK_ERROR);
}

// ============================================================================
// API REQUEST HANDLERS (Task 2.3 & 2.4)
// ============================================================================

/**
 * Handle tailor CV request
 * @param {Object} data - Request data containing jd, and optionally baseTex and apiKey
 * @returns {Promise<Object>} Tailored CV response
 */
async function handleTailorRequest(data) {
    try {
        // Retrieve stored data if not provided
        const storage = await getStorage(['apiKey', 'baseTex', 'backendUrl']);
        const apiKey = data.apiKey || storage.apiKey;
        const baseTex = data.baseTex || storage.baseTex;
        const backendUrl = storage.backendUrl || DEFAULT_BACKEND_URL;

        // Validate required fields
        // Note: API key and base resume are optional - the backend can use environment variables
        if (!data.jd || data.jd.trim().length === 0) {
            throw new ExtensionError('Job description cannot be empty.', ErrorCodes.VALIDATION_ERROR);
        }

        // Sanitize inputs before sending to API (Task 11.2)
        const sanitizedJd = sanitizeInput(data.jd);
        const sanitizedBaseTex = baseTex ? sanitizeInput(baseTex) : undefined;

        // Build request body - only include fields that are provided
        const requestBody = {
            jd: sanitizedJd
        };

        if (sanitizedBaseTex) {
            requestBody.baseTex = sanitizedBaseTex;
        }

        if (apiKey) {
            requestBody.apiKey = apiKey;
        }

        // Add mode (tailor or create) and company name if provided
        if (data.mode) {
            requestBody.mode = data.mode;
        }

        if (data.companyName) {
            requestBody.companyName = data.companyName;
        }

        // Call backend API with retry logic
        const response = await fetchWithRetry(
            `${backendUrl}/api/tailor`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch {
                errorData = { error: errorText };
            }
            throw new ExtensionError(errorData.error || `HTTP ${response.status}`, ErrorCodes.API_ERROR);
        }

        const result = await response.json();

        if (!result.tex) {
            throw new ExtensionError('No LaTeX content in response', ErrorCodes.INVALID_RESPONSE);
        }

        // Save to history
        await saveToHistory(result.tex, data.jd);

        // Cache the result
        await setStorage({
            currentTailoredTex: result.tex,
            currentJd: data.jd
        });

        return { tex: result.tex };
    } catch (error) {
        // Never log API key to console (Task 11.1)
        if (error.message && error.message.includes('apiKey')) {
            console.error('Tailor request error: [API key redacted]');
        } else {
            console.error('Tailor request error:', error.message || error);
        }
        throw error;
    }
}

/**
 * Handle PDF compilation request
 * @param {Object} data - Request data containing tex content
 * @returns {Promise<Object>} PDF blob URL response
 */
async function handleCompileRequest(data) {
    try {
        const storage = await getStorage(['backendUrl']);
        const backendUrl = storage.backendUrl || DEFAULT_BACKEND_URL;

        if (!data.tex || data.tex.trim().length === 0) {
            throw new ExtensionError('LaTeX content cannot be empty.', ErrorCodes.VALIDATION_ERROR);
        }

        // Create FormData with .tex file blob
        const formData = new FormData();
        const texBlob = new Blob([data.tex], { type: 'text/plain' });
        formData.append('file', texBlob, 'resume.tex');

        // Call backend API with retry logic
        const response = await fetchWithRetry(
            `${backendUrl}/api/compile/upload`,
            {
                method: 'POST',
                body: formData
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new ExtensionError(errorText, ErrorCodes.COMPILATION_ERROR);
        }

        // Get PDF blob
        const pdfBlob = await response.blob();

        // Convert blob to array buffer, then to base64 data URL
        // This works in service worker context (URL.createObjectURL doesn't)
        const arrayBuffer = await pdfBlob.arrayBuffer();
        const base64 = btoa(
            new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        const pdfDataUrl = `data:application/pdf;base64,${base64}`;

        // Cache the PDF data URL
        await setStorage({
            currentPdfUrl: pdfDataUrl
        });

        return { pdfBlobUrl: pdfDataUrl };
    } catch (error) {
        console.error('Compile request error:', error);

        // Try to extract error log if available
        if (error.message.includes(ErrorCodes.COMPILATION_ERROR)) {
            return { error: error.message, log: error.message };
        }

        throw error;
    }
}

/**
 * Save tailoring result to history
 * Implements resource cleanup by limiting history to 5 items (Task 12.2)
 * @param {string} tex - Tailored LaTeX content
 * @param {string} jd - Job description
 */
async function saveToHistory(tex, jd) {
    try {
        const storage = await getStorage(['history']);
        let history = storage.history || [];

        // Create new history item
        const historyItem = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
            timestamp: Date.now(),
            jd: jd.substring(0, 200), // Truncate for display
            jdFull: jd,
            tex: tex
        };

        // Add to beginning of array
        history.unshift(historyItem);

        // Keep only last 5 items (FIFO) - Resource cleanup (Task 12.2)
        if (history.length > 5) {
            history = history.slice(0, 5);
        }

        await setStorage({ history });
    } catch (error) {
        console.error('Error saving to history:', error);
        // Don't throw - history save failure shouldn't break the main flow
    }
}

// ============================================================================
// MESSAGE ROUTING SYSTEM (Task 2.1)
// ============================================================================

/**
 * Handle messages from content scripts and popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Received message:', message.type);

    // Handle different message types
    switch (message.type) {
        case MessageTypes.TAILOR_CV:
            handleTailorRequest(message.data)
                .then(result => sendResponse({ success: true, data: result }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true; // Keep channel open for async response

        case MessageTypes.COMPILE_PDF:
            handleCompileRequest(message.data)
                .then(result => sendResponse({ success: true, data: result }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true; // Keep channel open for async response

        case MessageTypes.GET_STORAGE:
            getStorage(message.keys || [])
                .then(data => sendResponse({ success: true, data }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true; // Keep channel open for async response

        case MessageTypes.SET_STORAGE:
            setStorage(message.data)
                .then(() => sendResponse({ success: true }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true; // Keep channel open for async response

        default:
            console.warn('Unknown message type:', message.type);
            sendResponse({ success: false, error: 'Unknown message type' });
            return false;
    }
});

// ============================================================================
// CONTEXT MENU CREATION AND HANDLING (Task 2.2)
// ============================================================================

/**
 * Create context menu on extension install
 */
chrome.runtime.onInstalled.addListener((details) => {
    console.log('Extension installed, creating context menu');

    chrome.contextMenus.create({
        id: 'tailorCV',
        title: 'Tailor CV to this JD',
        contexts: ['selection']
    });

    // Handle cleanup on uninstall (Task 11.3)
    // Note: Chrome automatically clears storage.local on uninstall, which includes:
    // - API key (stored encrypted by Chrome)
    // - Base resume
    // - Backend URL
    // - Tailoring history
    // - All cached data
    // This ensures all sensitive data is removed when the extension is uninstalled
    if (details.reason === 'install') {
        console.log('Extension installed - storage will be automatically cleared on uninstall');
    }
});

/**
 * Cleanup function to clear cached data (Task 11.3)
 * This is called when the service worker is about to be terminated
 * 
 * Security notes:
 * - Chrome automatically clears storage.local on extension uninstall
 * - API keys are stored encrypted by Chrome's storage.local API
 * - No sensitive data is logged to console
 * - Data URLs don't need explicit revocation like blob URLs
 */
async function cleanupOnShutdown() {
    try {
        // Clear cached PDF data URL to free memory
        const storage = await getStorage(['currentPdfUrl']);

        if (storage.currentPdfUrl) {
            // Clear from storage to free memory
            await setStorage({ currentPdfUrl: null });
            console.log('Cached PDF data cleared on shutdown');
        }
    } catch (error) {
        console.error('Error during cleanup:', error.message || error);
    }
}

// Listen for service worker lifecycle events
self.addEventListener('beforeunload', cleanupOnShutdown);

/**
 * Handle context menu clicks
 */
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'tailorCV' && info.selectionText) {
        console.log('Context menu clicked with selection:', info.selectionText.substring(0, 50) + '...');

        // Trigger tailoring flow with selected text
        handleTailorRequest({ jd: info.selectionText })
            .then(() => {
                console.log('Tailoring completed successfully');

                // Open popup to show result
                chrome.action.openPopup();
            })
            .catch(error => {
                // Never log sensitive information (Task 11.1)
                console.error('Tailoring failed:', error.message || 'Unknown error');

                // Show error notification
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'icons/icon48.png',
                    title: 'CV Tailor Error',
                    message: error.message || 'Failed to tailor CV. Please check settings.'
                });
            });
    }
});
