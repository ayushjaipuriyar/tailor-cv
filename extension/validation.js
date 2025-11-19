// Input validation utilities for CV Tailor Extension

/**
 * Validation result
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether the input is valid
 * @property {string|null} error - Error message if invalid
 */

/**
 * Validate job description input
 * @param {string} jd - Job description text
 * @returns {ValidationResult} Validation result
 */
function validateJobDescription(jd) {
    if (!jd || typeof jd !== 'string') {
        return {
            valid: false,
            error: 'Job description is required.'
        };
    }

    const trimmedJd = jd.trim();

    if (trimmedJd.length === 0) {
        return {
            valid: false,
            error: 'Job description cannot be empty.'
        };
    }

    if (trimmedJd.length < 16) {
        return {
            valid: false,
            error: 'Job description must be at least 16 characters long.'
        };
    }

    return {
        valid: true,
        error: null
    };
}

/**
 * Validate API key
 * @param {string} apiKey - API key to validate
 * @returns {ValidationResult} Validation result
 */
function validateApiKey(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
        return {
            valid: false,
            error: 'API key is required. Please configure it in settings.'
        };
    }

    const trimmedKey = apiKey.trim();

    if (trimmedKey.length === 0) {
        return {
            valid: false,
            error: 'API key cannot be empty. Please configure it in settings.'
        };
    }

    // Basic format validation - API keys should be alphanumeric
    // Gemini API keys are typically 39 characters, but we'll be flexible
    if (trimmedKey.length < 10) {
        return {
            valid: false,
            error: 'API key appears to be invalid. Please check your settings.'
        };
    }

    return {
        valid: true,
        error: null
    };
}

/**
 * Validate base resume
 * @param {string} baseTex - Base LaTeX resume content
 * @returns {ValidationResult} Validation result
 */
function validateBaseResume(baseTex) {
    if (!baseTex || typeof baseTex !== 'string') {
        return {
            valid: false,
            error: 'Base resume is required. Please configure it in settings.'
        };
    }

    const trimmedTex = baseTex.trim();

    if (trimmedTex.length === 0) {
        return {
            valid: false,
            error: 'Base resume cannot be empty. Please configure it in settings.'
        };
    }

    // Basic LaTeX validation - should contain \documentclass or \begin{document}
    if (!trimmedTex.includes('\\documentclass') && !trimmedTex.includes('\\begin{document}')) {
        return {
            valid: false,
            error: 'Base resume does not appear to be valid LaTeX. Please check your settings.'
        };
    }

    return {
        valid: true,
        error: null
    };
}

/**
 * Validate LaTeX content
 * @param {string} tex - LaTeX content to validate
 * @returns {ValidationResult} Validation result
 */
function validateLatexContent(tex) {
    if (!tex || typeof tex !== 'string') {
        return {
            valid: false,
            error: 'LaTeX content is required.'
        };
    }

    const trimmedTex = tex.trim();

    if (trimmedTex.length === 0) {
        return {
            valid: false,
            error: 'LaTeX content cannot be empty.'
        };
    }

    return {
        valid: true,
        error: null
    };
}

/**
 * Validate backend URL (Task 11.2)
 * @param {string} url - Backend URL to validate
 * @returns {ValidationResult} Validation result
 */
function validateBackendUrl(url) {
    if (!url || typeof url !== 'string') {
        return {
            valid: false,
            error: 'Backend URL is required.'
        };
    }

    const trimmedUrl = url.trim();

    if (trimmedUrl.length === 0) {
        return {
            valid: false,
            error: 'Backend URL cannot be empty.'
        };
    }

    // URL validation with HTTPS requirement (Task 11.2)
    try {
        const urlObj = new URL(trimmedUrl);

        // Must be HTTPS for security (except localhost for development)
        if (urlObj.protocol !== 'https:' &&
            urlObj.hostname !== 'localhost' &&
            urlObj.hostname !== '127.0.0.1') {
            return {
                valid: false,
                error: 'Backend URL must use HTTPS protocol for security.'
            };
        }

        return {
            valid: true,
            error: null
        };
    } catch (error) {
        return {
            valid: false,
            error: 'Backend URL is not a valid URL.'
        };
    }
}

/**
 * Validate all required settings before tailoring
 * @param {Object} settings - Settings object
 * @param {string} settings.apiKey - API key
 * @param {string} settings.baseTex - Base resume
 * @param {string} settings.jd - Job description
 * @returns {ValidationResult} Validation result
 */
function validateTailoringInputs(settings) {
    // Validate API key
    const apiKeyValidation = validateApiKey(settings.apiKey);
    if (!apiKeyValidation.valid) {
        return apiKeyValidation;
    }

    // Validate base resume
    const baseResumeValidation = validateBaseResume(settings.baseTex);
    if (!baseResumeValidation.valid) {
        return baseResumeValidation;
    }

    // Validate job description
    const jdValidation = validateJobDescription(settings.jd);
    if (!jdValidation.valid) {
        return jdValidation;
    }

    return {
        valid: true,
        error: null
    };
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        validateJobDescription,
        validateApiKey,
        validateBaseResume,
        validateLatexContent,
        validateBackendUrl,
        validateTailoringInputs
    };
}
