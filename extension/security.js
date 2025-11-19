// Security utilities for CV Tailor Extension (Task 11)

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
 * Gemini API keys are typically 39 characters, alphanumeric with hyphens and underscores
 * @param {string} apiKey - API key to validate
 * @returns {boolean} True if valid format
 */
function validateApiKeyFormat(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
        return false;
    }

    const trimmed = apiKey.trim();

    // Check length (be flexible but reasonable)
    if (trimmed.length < 20 || trimmed.length > 100) {
        return false;
    }

    // Check for valid characters (alphanumeric, hyphens, underscores)
    const validPattern = /^[A-Za-z0-9_-]+$/;
    return validPattern.test(trimmed);
}

/**
 * Validate backend URL format (Task 11.2)
 * URLs must use HTTPS protocol (except localhost for development)
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
        if (urlObj.protocol !== 'https:' &&
            urlObj.hostname !== 'localhost' &&
            urlObj.hostname !== '127.0.0.1') {
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
 * Escape HTML to prevent XSS attacks (Task 11.2)
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    if (typeof text !== 'string') {
        return '';
    }

    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Redact sensitive information from logs (Task 11.1)
 * Never log API keys or other sensitive data to console
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

/**
 * Secure logging function that never logs sensitive information (Task 11.1)
 * @param {string} level - Log level (log, warn, error)
 * @param {string} message - Message to log
 * @param {*} data - Optional data to log
 */
function secureLog(level, message, data = null) {
    const safeMessage = redactSensitiveInfo(message);

    if (data && typeof data === 'object') {
        // Create a copy and redact sensitive fields
        const safeData = { ...data };
        if (safeData.apiKey) {
            safeData.apiKey = '[REDACTED]';
        }
        console[level](safeMessage, safeData);
    } else if (data) {
        console[level](safeMessage, redactSensitiveInfo(String(data)));
    } else {
        console[level](safeMessage);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        sanitizeInput,
        validateApiKeyFormat,
        validateBackendUrlFormat,
        escapeHtml,
        redactSensitiveInfo,
        secureLog
    };
}
