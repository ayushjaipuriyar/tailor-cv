// Settings page script for CV Tailor Extension

const DEFAULT_BACKEND_URL = 'http://localhost:3000';

// DOM Elements
let backendUrlInput;
let apiKeyInput;
let baseTexInput;
let fullNameInput;
let emailInput;
let phoneInput;
let locationInput;
let linkedinInput;
let githubInput;
let portfolioInput;
let yearsExperienceInput;
let currentCompanyInput;
let currentTitleInput;
let educationInput;
let coverLetterInput;
let saveBtn;
let resetBtn;
let successToast;
let successMessage;
let errorToast;
let errorMessage;

// Initialize settings page
document.addEventListener('DOMContentLoaded', () => {
    initializeElements();
    loadSettings();
});

/**
 * Initialize DOM elements
 */
function initializeElements() {
    backendUrlInput = document.getElementById('backendUrl');
    apiKeyInput = document.getElementById('apiKey');
    baseTexInput = document.getElementById('baseTex');
    fullNameInput = document.getElementById('fullName');
    emailInput = document.getElementById('email');
    phoneInput = document.getElementById('phone');
    locationInput = document.getElementById('location');
    linkedinInput = document.getElementById('linkedin');
    githubInput = document.getElementById('github');
    portfolioInput = document.getElementById('portfolio');
    yearsExperienceInput = document.getElementById('yearsExperience');
    currentCompanyInput = document.getElementById('currentCompany');
    currentTitleInput = document.getElementById('currentTitle');
    educationInput = document.getElementById('education');
    coverLetterInput = document.getElementById('coverLetter');
    saveBtn = document.getElementById('saveBtn');
    resetBtn = document.getElementById('resetBtn');
    successToast = document.getElementById('successToast');
    successMessage = document.getElementById('successMessage');
    errorToast = document.getElementById('errorToast');
    errorMessage = document.getElementById('errorMessage');

    // Add event listeners
    if (saveBtn) {
        saveBtn.addEventListener('click', handleSave);
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', handleReset);
    }

    // Save on Enter key in URL field
    if (backendUrlInput) {
        backendUrlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleSave();
            }
        });
    }
}

/**
 * Load settings from storage
 */
async function loadSettings() {
    try {
        const storage = await chrome.storage.local.get([
            'backendUrl', 'apiKey', 'baseTex',
            'fullName', 'email', 'phone', 'location',
            'linkedin', 'github', 'portfolio',
            'yearsExperience', 'currentCompany', 'currentTitle',
            'education', 'coverLetter'
        ]);

        if (backendUrlInput) backendUrlInput.value = storage.backendUrl || DEFAULT_BACKEND_URL;
        if (apiKeyInput) apiKeyInput.value = storage.apiKey || '';
        if (baseTexInput) baseTexInput.value = storage.baseTex || '';
        if (fullNameInput) fullNameInput.value = storage.fullName || '';
        if (emailInput) emailInput.value = storage.email || '';
        if (phoneInput) phoneInput.value = storage.phone || '';
        if (locationInput) locationInput.value = storage.location || '';
        if (linkedinInput) linkedinInput.value = storage.linkedin || '';
        if (githubInput) githubInput.value = storage.github || '';
        if (portfolioInput) portfolioInput.value = storage.portfolio || '';
        if (yearsExperienceInput) yearsExperienceInput.value = storage.yearsExperience || '';
        if (currentCompanyInput) currentCompanyInput.value = storage.currentCompany || '';
        if (currentTitleInput) currentTitleInput.value = storage.currentTitle || '';
        if (educationInput) educationInput.value = storage.education || '';
        if (coverLetterInput) coverLetterInput.value = storage.coverLetter || '';
    } catch (error) {
        console.error('Error loading settings:', error);
        showError('Failed to load settings');
    }
}

/**
 * Handle save button click
 */
async function handleSave() {
    const backendUrl = backendUrlInput.value.trim();
    const apiKey = apiKeyInput.value.trim();
    const baseTex = baseTexInput.value.trim();

    // Validate backend URL (required)
    if (!backendUrl) {
        showError('Please enter a backend URL');
        return;
    }

    if (!isValidUrl(backendUrl)) {
        showError('Please enter a valid URL (http:// or https://)');
        return;
    }

    try {
        // Save to storage
        const settings = { backendUrl };

        // Only save optional fields if they're provided
        if (apiKey) settings.apiKey = apiKey;
        if (baseTex) settings.baseTex = baseTex;

        // Save profile fields
        if (fullNameInput) settings.fullName = fullNameInput.value.trim();
        if (emailInput) settings.email = emailInput.value.trim();
        if (phoneInput) settings.phone = phoneInput.value.trim();
        if (locationInput) settings.location = locationInput.value.trim();
        if (linkedinInput) settings.linkedin = linkedinInput.value.trim();
        if (githubInput) settings.github = githubInput.value.trim();
        if (portfolioInput) settings.portfolio = portfolioInput.value.trim();
        if (yearsExperienceInput) settings.yearsExperience = yearsExperienceInput.value.trim();
        if (currentCompanyInput) settings.currentCompany = currentCompanyInput.value.trim();
        if (currentTitleInput) settings.currentTitle = currentTitleInput.value.trim();
        if (educationInput) settings.education = educationInput.value.trim();
        if (coverLetterInput) settings.coverLetter = coverLetterInput.value.trim();

        await chrome.storage.local.set(settings);
        showSuccess('Settings saved successfully!');
    } catch (error) {
        console.error('Error saving settings:', error);
        showError('Failed to save settings');
    }
}

/**
 * Handle reset button click
 */
async function handleReset() {
    try {
        // Reset to defaults
        await chrome.storage.local.set({
            backendUrl: DEFAULT_BACKEND_URL,
            apiKey: '',
            baseTex: ''
        });

        if (backendUrlInput) {
            backendUrlInput.value = DEFAULT_BACKEND_URL;
        }

        if (apiKeyInput) {
            apiKeyInput.value = '';
        }

        if (baseTexInput) {
            baseTexInput.value = '';
        }

        showSuccess('Settings reset to default');
    } catch (error) {
        console.error('Error resetting settings:', error);
        showError('Failed to reset settings');
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
 * Show success toast
 * @param {string} message - Success message
 */
function showSuccess(message) {
    if (successMessage) {
        successMessage.textContent = message;
    }

    if (successToast) {
        successToast.classList.remove('hidden');
    }

    // Auto-hide after 3 seconds
    setTimeout(() => {
        if (successToast) {
            successToast.classList.add('hidden');
        }
    }, 3000);
}

/**
 * Show error toast
 * @param {string} message - Error message
 */
function showError(message) {
    if (errorMessage) {
        errorMessage.textContent = message;
    }

    if (errorToast) {
        errorToast.classList.remove('hidden');
    }

    // Auto-hide after 5 seconds
    setTimeout(() => {
        if (errorToast) {
            errorToast.classList.add('hidden');
        }
    }, 5000);
}
