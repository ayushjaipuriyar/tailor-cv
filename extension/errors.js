// Error handling utilities for CV Tailor Extension

/**
 * ExtensionError class with error codes
 */
class ExtensionError extends Error {
    /**
     * Create an ExtensionError
     * @param {string} message - Error message
     * @param {string} code - Error code from ErrorCodes
     * @param {boolean} recoverable - Whether the error is recoverable (default: true)
     */
    constructor(message, code, recoverable = true) {
        super(message);
        this.name = 'ExtensionError';
        this.code = code;
        this.recoverable = recoverable;
    }
}

/**
 * Error codes enum
 */
const ErrorCodes = {
    NO_API_KEY: 'NO_API_KEY',
    NO_BASE_RESUME: 'NO_BASE_RESUME',
    NETWORK_ERROR: 'NETWORK_ERROR',
    API_ERROR: 'API_ERROR',
    RATE_LIMIT: 'RATE_LIMIT',
    INVALID_RESPONSE: 'INVALID_RESPONSE',
    STORAGE_ERROR: 'STORAGE_ERROR',
    COMPILATION_ERROR: 'COMPILATION_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    OFFLINE_ERROR: 'OFFLINE_ERROR'
};

/**
 * User-facing error information
 * @typedef {Object} UserFacingError
 * @property {string} title - Error title
 * @property {string} message - Error message
 * @property {string} action - Action button text
 * @property {Function|null} actionCallback - Optional action callback
 */

/**
 * Map error codes to user-friendly messages
 * @param {ExtensionError|Error} error - Error object
 * @returns {UserFacingError} User-facing error information
 */
function handleError(error) {
    // Extract error code if it's an ExtensionError
    const errorCode = error.code || extractErrorCodeFromMessage(error.message);

    // Map error codes to user messages
    const userMessages = {
        [ErrorCodes.NO_API_KEY]: {
            title: 'API Key Required',
            message: 'Please configure your Gemini API key in settings.',
            action: 'Open Settings',
            actionCallback: 'openSettings'
        },
        [ErrorCodes.NO_BASE_RESUME]: {
            title: 'Base Resume Required',
            message: 'Please upload your base LaTeX resume in settings.',
            action: 'Open Settings',
            actionCallback: 'openSettings'
        },
        [ErrorCodes.NETWORK_ERROR]: {
            title: 'Connection Error',
            message: 'Unable to reach the server. Please check your internet connection.',
            action: 'Retry',
            actionCallback: 'retry'
        },
        [ErrorCodes.RATE_LIMIT]: {
            title: 'Rate Limit Exceeded',
            message: 'Too many requests. Please wait a moment and try again.',
            action: 'OK',
            actionCallback: null
        },
        [ErrorCodes.API_ERROR]: {
            title: 'API Error',
            message: error.message || 'An error occurred while processing your request.',
            action: 'OK',
            actionCallback: null
        },
        [ErrorCodes.INVALID_RESPONSE]: {
            title: 'Invalid Response',
            message: 'Received an unexpected response from the server.',
            action: 'OK',
            actionCallback: null
        },
        [ErrorCodes.STORAGE_ERROR]: {
            title: 'Storage Error',
            message: 'Unable to access browser storage. Please check your browser settings.',
            action: 'OK',
            actionCallback: null
        },
        [ErrorCodes.COMPILATION_ERROR]: {
            title: 'Compilation Error',
            message: 'Failed to compile LaTeX to PDF. Please check your LaTeX syntax.',
            action: 'OK',
            actionCallback: null
        },
        [ErrorCodes.VALIDATION_ERROR]: {
            title: 'Validation Error',
            message: error.message || 'Please check your input and try again.',
            action: 'OK',
            actionCallback: null
        },
        [ErrorCodes.OFFLINE_ERROR]: {
            title: 'Offline',
            message: 'You are currently offline. Please check your internet connection.',
            action: 'OK',
            actionCallback: null
        }
    };

    // Return mapped error or default error
    return userMessages[errorCode] || {
        title: 'Error',
        message: error.message || 'An unexpected error occurred.',
        action: 'OK',
        actionCallback: null
    };
}

/**
 * Extract error code from error message
 * @param {string} message - Error message
 * @returns {string|null} Error code or null
 */
function extractErrorCodeFromMessage(message) {
    if (!message) return null;

    // Check if message starts with error code
    for (const code of Object.values(ErrorCodes)) {
        if (message.startsWith(code)) {
            return code;
        }
    }

    // Check for common patterns in message
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('api key')) {
        return ErrorCodes.NO_API_KEY;
    }
    if (lowerMessage.includes('base resume') || lowerMessage.includes('basetex')) {
        return ErrorCodes.NO_BASE_RESUME;
    }
    if (lowerMessage.includes('network') || lowerMessage.includes('fetch failed')) {
        return ErrorCodes.NETWORK_ERROR;
    }
    if (lowerMessage.includes('429') || lowerMessage.includes('rate limit')) {
        return ErrorCodes.RATE_LIMIT;
    }
    if (lowerMessage.includes('compilation') || lowerMessage.includes('latex')) {
        return ErrorCodes.COMPILATION_ERROR;
    }
    if (lowerMessage.includes('storage')) {
        return ErrorCodes.STORAGE_ERROR;
    }
    if (lowerMessage.includes('offline')) {
        return ErrorCodes.OFFLINE_ERROR;
    }

    return ErrorCodes.API_ERROR;
}

/**
 * Display error in popup UI
 * @param {ExtensionError|Error} error - Error object
 * @param {Function} openSettingsCallback - Callback to open settings
 * @param {Function} retryCallback - Callback to retry the operation
 */
function displayError(error, openSettingsCallback = null, retryCallback = null) {
    const errorInfo = handleError(error);

    // Get toast elements
    const toast = document.getElementById('errorToast');
    const titleEl = document.getElementById('errorTitle');
    const messageEl = document.getElementById('errorMessage');
    const actionBtn = document.getElementById('errorAction');

    if (!toast || !titleEl || !messageEl || !actionBtn) {
        console.error('Error toast elements not found in DOM');
        return;
    }

    // Set error content
    titleEl.textContent = errorInfo.title;
    messageEl.textContent = errorInfo.message;
    actionBtn.textContent = errorInfo.action;

    // Remove previous listener by cloning the button
    const newActionBtn = actionBtn.cloneNode(true);
    actionBtn.parentNode.replaceChild(newActionBtn, actionBtn);

    // Add new listener based on action callback
    newActionBtn.addEventListener('click', () => {
        hideError();

        if (errorInfo.actionCallback === 'openSettings' && openSettingsCallback) {
            openSettingsCallback();
        } else if (errorInfo.actionCallback === 'retry' && retryCallback) {
            retryCallback();
        }
    });

    // Show toast
    toast.classList.remove('hidden');

    // Auto-hide after 5 seconds if no action callback
    if (!errorInfo.actionCallback) {
        setTimeout(() => {
            hideError();
        }, 5000);
    }
}

/**
 * Hide error toast
 */
function hideError() {
    const toast = document.getElementById('errorToast');
    if (toast) {
        toast.classList.add('hidden');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ExtensionError,
        ErrorCodes,
        handleError,
        displayError,
        hideError
    };
}
