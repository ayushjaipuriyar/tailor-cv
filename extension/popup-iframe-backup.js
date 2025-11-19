// Popup script for CV Tailor Extension
// Loads the web application in an iframe

const DEFAULT_APP_URL = 'http://localhost:3000';

// DOM Elements
let appFrame;
let loading;
let error;
let errorMessage;
let retryBtn;
let settingsBtn;

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
    initializeElements();
    loadWebApp();
});

/**
 * Initialize DOM elements
 */
function initializeElements() {
    appFrame = document.getElementById('app-frame');
    loading = document.getElementById('loading');
    error = document.getElementById('error');
    errorMessage = document.getElementById('error-message');
    retryBtn = document.getElementById('retry-btn');
    settingsBtn = document.getElementById('settings-btn');

    // Add event listeners
    if (retryBtn) {
        retryBtn.addEventListener('click', () => {
            hideError();
            loadWebApp();
        });
    }

    if (settingsBtn) {
        settingsBtn.addEventListener('click', openSettings);
    }
}

/**
 * Load the web application in iframe
 */
async function loadWebApp() {
    showLoading();

    try {
        // Get app URL from storage (or use default)
        const storage = await chrome.storage.local.get(['appUrl', 'backendUrl']);
        const appUrl = storage.appUrl || storage.backendUrl || DEFAULT_APP_URL;

        // Validate URL
        if (!isValidUrl(appUrl)) {
            throw new Error('Invalid application URL. Please check your settings.');
        }

        // Set iframe source
        appFrame.src = appUrl;

        // Handle iframe load
        appFrame.onload = () => {
            hideLoading();
            showApp();
        };

        // Handle iframe error
        appFrame.onerror = () => {
            hideLoading();
            showError('Failed to load the application. Make sure the server is running.');
        };

        // Timeout after 10 seconds
        setTimeout(() => {
            if (loading && !loading.classList.contains('hidden')) {
                hideLoading();
                showError('Connection timeout. Make sure the server is running at ' + appUrl);
            }
        }, 10000);

    } catch (err) {
        hideLoading();
        showError(err.message || 'Failed to load application');
    }
}

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid
 */
function isValidUrl(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
        return false;
    }
}

/**
 * Show loading state
 */
function showLoading() {
    if (loading) loading.classList.remove('hidden');
    if (appFrame) appFrame.classList.add('hidden');
    if (error) error.classList.add('hidden');
}

/**
 * Hide loading state
 */
function hideLoading() {
    if (loading) loading.classList.add('hidden');
}

/**
 * Show app frame
 */
function showApp() {
    if (appFrame) appFrame.classList.remove('hidden');
    if (error) error.classList.add('hidden');
}

/**
 * Show error state
 * @param {string} message - Error message to display
 */
function showError(message) {
    if (errorMessage) errorMessage.textContent = message;
    if (error) error.classList.remove('hidden');
    if (appFrame) appFrame.classList.add('hidden');
}

/**
 * Hide error state
 */
function hideError() {
    if (error) error.classList.add('hidden');
}

/**
 * Open settings page
 */
function openSettings() {
    chrome.runtime.openOptionsPage();
}

// Listen for messages from the web app (if needed for communication)
window.addEventListener('message', (event) => {
    // Verify origin for security
    // You can add specific message handling here if your web app needs to communicate with the extension
    console.log('Message from app:', event.data);
});
