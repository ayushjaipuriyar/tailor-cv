// Popup script for CV Tailor Extension - Simplified version

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    initializeNetworkMonitoring();
    loadSavedState();
    autoDetectJobDescription(); // Auto-detect when popup opens
});

/**
 * Initialize event listeners for UI elements
 */
function initializeEventListeners() {
    // Settings button
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', openSettings);
    }

    // Detect from page button
    const detectBtn = document.getElementById('detectBtn');
    if (detectBtn) {
        detectBtn.addEventListener('click', handleDetectClick);
    }

    // Auto-fill button
    const autoFillBtn = document.getElementById('autoFillBtn');
    if (autoFillBtn) {
        autoFillBtn.addEventListener('click', handleAutoFillClick);
    }

    // Tailor button
    const tailorBtn = document.getElementById('tailorBtn');
    if (tailorBtn) {
        tailorBtn.addEventListener('click', () => handleGenerateClick('tailor'));
    }

    // Create button
    const createBtn = document.getElementById('createBtn');
    if (createBtn) {
        createBtn.addEventListener('click', () => handleGenerateClick('create'));
    }

    // Job Description input with debouncing
    const jdInput = document.getElementById('jdInput');
    if (jdInput) {
        let jdSaveTimeout;
        jdInput.addEventListener('input', () => {
            clearTimeout(jdSaveTimeout);
            jdSaveTimeout = setTimeout(() => {
                saveJdInput(jdInput.value);
                extractAndDisplayKeywords(jdInput.value);
                const companyName = extractCompanyName(jdInput.value);
                displayCompanyName(companyName);
            }, 500);
        });
    }

    // Listen for messages from service worker
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'TAILOR_RESPONSE') {
            handleTailorResponse(message.data);
        }
    });
}

/**
 * Open settings page
 */
function openSettings() {
    chrome.runtime.openOptionsPage();
}

/**
 * Auto-detect job description when popup opens
 */
async function autoDetectJobDescription() {
    try {
        // Only auto-detect if the textarea is empty
        const jdInput = document.getElementById('jdInput');
        if (jdInput && jdInput.value.trim()) {
            return; // Already has content, don't override
        }

        // Get the active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab.id) {
            return; // Can't access tab, skip auto-detect
        }

        // Inject content script if not already injected
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            });
        } catch (e) {
            // Content script might already be injected or page doesn't allow it
        }

        // Send message to content script to extract job description
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_JD' });

        if (response && response.text && response.text.length > 100) {
            if (jdInput) {
                jdInput.value = response.text;
                saveJdInput(response.text);
                // Extract and display keywords
                extractAndDisplayKeywords(response.text);
                // Extract and display company name
                const companyName = extractCompanyName(response.text);
                displayCompanyName(companyName);
            }
        }
    } catch (error) {
        // Silent fail - auto-detection is optional
        console.log('Auto-detection skipped:', error.message);
    }
}

/**
 * Handle Auto-Fill Form button click
 */
async function handleAutoFillClick() {
    try {
        // Get profile data from storage
        const storage = await chrome.storage.local.get([
            'fullName', 'email', 'phone', 'location',
            'linkedin', 'github', 'portfolio',
            'yearsExperience', 'currentCompany', 'currentTitle',
            'education', 'coverLetter'
        ]);

        // Check if profile is configured
        if (!storage.fullName && !storage.email) {
            showError('Profile Not Configured', 'Please configure your profile in settings first.', 'Open Settings', openSettings);
            return;
        }

        // Get the active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab.id) {
            showError('Error', 'Could not access current tab', 'OK');
            return;
        }

        // Inject content script if not already injected
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            });
        } catch (e) {
            // Content script might already be injected
        }

        // Send auto-fill message
        const response = await chrome.tabs.sendMessage(tab.id, {
            type: 'AUTO_FILL',
            profile: storage
        });

        if (response && response.success) {
            showSuccess(`Auto-filled ${response.filledCount} field(s)!`);
        } else {
            showError('Auto-Fill Failed', 'Could not auto-fill form fields. The page may not have a compatible form.', 'OK');
        }
    } catch (error) {
        console.error('Error auto-filling:', error);
        showError('Auto-Fill Failed', 'Could not auto-fill form. Try filling manually.', 'OK');
    }
}

/**
 * Handle Detect from Page button click
 */
async function handleDetectClick() {
    try {
        // Get the active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab.id) {
            showError('Error', 'Could not access current tab', 'OK');
            return;
        }

        // Inject content script if not already injected
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            });
        } catch (e) {
            // Content script might already be injected, continue
        }

        // Send message to content script to extract job description
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_JD' });

        if (response && response.text) {
            const jdInput = document.getElementById('jdInput');
            if (jdInput) {
                jdInput.value = response.text;
                saveJdInput(response.text);
                extractAndDisplayKeywords(response.text);
                const companyName = extractCompanyName(response.text);
                displayCompanyName(companyName);
                showSuccess('Job description detected from page!');
            }
        } else {
            showError('No Content', 'Could not detect job description on this page. Try selecting text and using the context menu.', 'OK');
        }
    } catch (error) {
        console.error('Error detecting content:', error);
        showError('Detection Failed', 'Could not detect content from page. Try copying and pasting instead.', 'OK');
    }
}

/**
 * Extract company name from job description
 * @param {string} text - Job description text
 * @returns {string} Company name or empty string
 */
function extractCompanyName(text) {
    if (!text) return '';

    // Common patterns for company names in job descriptions
    const patterns = [
        /(?:at|@|for)\s+([A-Z][A-Za-z0-9\s&.,-]{2,40})(?:\s+is|,|\.|$)/,
        /([A-Z][A-Za-z0-9\s&.,-]{2,40})\s+is\s+(?:hiring|looking|seeking)/i,
        /(?:join|about)\s+([A-Z][A-Za-z0-9\s&.,-]{2,40})(?:\s+team|,|\.|$)/i,
        /company:\s*([A-Z][A-Za-z0-9\s&.,-]{2,40})(?:\n|$)/i,
        /^([A-Z][A-Za-z0-9\s&.,-]{2,40})\s*\n/m
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            const company = match[1].trim();
            // Filter out common false positives
            const blacklist = ['The Company', 'Our Company', 'This Company', 'A Company', 'The Team', 'Our Team'];
            if (!blacklist.includes(company) && company.length > 2) {
                return company;
            }
        }
    }

    return '';
}

/**
 * Display company name
 * @param {string} companyName - Company name to display
 */
function displayCompanyName(companyName) {
    const companyInfo = document.getElementById('companyInfo');
    const companyNameEl = document.getElementById('companyName');

    if (companyName && companyInfo && companyNameEl) {
        companyNameEl.textContent = companyName;
        companyInfo.style.display = 'block';
    } else if (companyInfo) {
        companyInfo.style.display = 'none';
    }
}

/**
 * Handle Generate CV button click (both tailor and create)
 * @param {string} mode - 'tailor' or 'create'
 */
async function handleGenerateClick(mode) {
    // Check online status first
    if (!checkOnlineStatus()) {
        return;
    }

    const jdInput = document.getElementById('jdInput');
    const jd = jdInput.value.trim();

    // Validate job description input
    const jdValidation = validateJobDescription(jd);
    if (!jdValidation.valid) {
        const error = new ExtensionError(jdValidation.error, ErrorCodes.VALIDATION_ERROR);
        displayError(error, openSettings, null);
        return;
    }

    // Extract company name
    const companyName = extractCompanyName(jd);
    displayCompanyName(companyName);

    // Show loading state
    const loadingMessage = mode === 'create' ? 'Creating your CV and generating PDF...' : 'Tailoring your CV and generating PDF...';
    showLoading(loadingMessage);

    try {
        // Step 1: Tailor or Create the CV
        const tailorResponse = await chrome.runtime.sendMessage({
            type: 'TAILOR_CV',
            data: { jd, mode, companyName }
        });

        if (tailorResponse.error) {
            hideLoading();
            handleTailorError(tailorResponse.error);
            return;
        }

        if (!tailorResponse.data || !tailorResponse.data.tex) {
            hideLoading();
            showError('Unexpected Error', 'Received invalid response from server.', 'OK');
            return;
        }

        const tex = tailorResponse.data.tex;

        // Step 2: Compile to PDF
        showLoading('Compiling PDF...');

        const compileResponse = await chrome.runtime.sendMessage({
            type: 'COMPILE_PDF',
            data: { tex }
        });

        hideLoading();

        if (compileResponse.success && compileResponse.data.pdfBlobUrl) {
            // Download PDF with timestamp and company name
            downloadPdfWithTimestamp(compileResponse.data.pdfBlobUrl, companyName);
            showSuccess('Resume PDF generated and downloaded successfully!');
        } else if (compileResponse.data && compileResponse.data.error) {
            showError('Compilation Error', compileResponse.data.error, 'OK');
        } else if (compileResponse.error) {
            showError('Compilation Error', compileResponse.error, 'OK');
        } else {
            showError('Unexpected Error', 'Failed to compile PDF.', 'OK');
        }
    } catch (error) {
        hideLoading();

        // Check if error is network-related and queue for retry
        if (!isOnline() || error.message.includes('network') || error.message.includes('fetch')) {
            const queueError = new ExtensionError(
                'Request failed. Please check your connection and try again.',
                ErrorCodes.NETWORK_ERROR
            );
            displayError(queueError, null, null);
        } else {
            showError('Request Failed', error.message || 'Failed to communicate with extension service.', 'OK');
        }
    }
}

/**
 * Download PDF with timestamp and company name in filename
 * @param {string} pdfBlobUrl - Blob URL of the PDF
 * @param {string} companyName - Company name (optional)
 */
function downloadPdfWithTimestamp(pdfBlobUrl, companyName = '') {
    try {
        // Create timestamp in format: YYYY-MM-DD_HH-MM-SS
        const now = new Date();
        const timestamp = now.getFullYear() + '-' +
            String(now.getMonth() + 1).padStart(2, '0') + '-' +
            String(now.getDate()).padStart(2, '0') + '_' +
            String(now.getHours()).padStart(2, '0') + '-' +
            String(now.getMinutes()).padStart(2, '0') + '-' +
            String(now.getSeconds()).padStart(2, '0');

        // Sanitize company name for filename
        let sanitizedCompany = '';
        if (companyName) {
            sanitizedCompany = companyName
                .replace(/[^a-zA-Z0-9\s-]/g, '') // Remove special chars
                .replace(/\s+/g, '_') // Replace spaces with underscore
                .substring(0, 30); // Limit length
            sanitizedCompany = '_' + sanitizedCompany;
        }

        const filename = `Ayush_Jaipuriyar_Resume${sanitizedCompany}_${timestamp}.pdf`;

        // Create temporary download link
        const a = document.createElement('a');
        a.href = pdfBlobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();

        // Cleanup
        document.body.removeChild(a);

        // Data URLs don't need to be revoked like blob URLs
    } catch (error) {
        console.error('Error downloading PDF:', error);
        showError('Download Failed', 'Unable to download PDF. Please try again.', 'OK');
    }
}

/**
 * Handle tailoring error
 * @param {string} errorMessage - Error message from service worker
 */
function handleTailorError(errorMessage) {
    const error = new Error(errorMessage);
    displayError(error, openSettings, handleTailorClick);
}

/**
 * Show loading overlay
 * @param {string} message - Loading message to display
 */
function showLoading(message = 'Processing...') {
    const overlay = document.getElementById('loadingOverlay');
    const loadingText = overlay.querySelector('.loading-text');

    if (loadingText) {
        loadingText.textContent = message;
    }

    overlay.classList.remove('hidden');
}

/**
 * Hide loading overlay
 */
function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    overlay.classList.add('hidden');
}

/**
 * Show error toast
 * @param {string} title - Error title
 * @param {string} message - Error message
 * @param {string} actionText - Action button text
 * @param {Function} actionCallback - Action button callback
 */
function showError(title, message, actionText = 'OK', actionCallback = null) {
    const toast = document.getElementById('errorToast');
    const titleEl = document.getElementById('errorTitle');
    const messageEl = document.getElementById('errorMessage');
    const actionBtn = document.getElementById('errorAction');

    titleEl.textContent = title;
    messageEl.textContent = message;
    actionBtn.textContent = actionText;

    // Remove previous listener
    const newActionBtn = actionBtn.cloneNode(true);
    actionBtn.parentNode.replaceChild(newActionBtn, actionBtn);

    // Add new listener
    newActionBtn.addEventListener('click', () => {
        hideError();
        if (actionCallback) {
            actionCallback();
        }
    });

    toast.classList.remove('hidden');

    // Auto-hide after 5 seconds if no action callback
    if (!actionCallback) {
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
    toast.classList.add('hidden');
}

/**
 * Show success toast
 * @param {string} message - Success message
 */
function showSuccess(message) {
    const toast = document.getElementById('successToast');
    const messageEl = document.getElementById('successMessage');

    messageEl.textContent = message;
    toast.classList.remove('hidden');

    // Auto-hide after 3 seconds
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

/**
 * Load saved state from storage
 */
function loadSavedState() {
    chrome.storage.local.get(['currentJd'], (result) => {
        if (result.currentJd) {
            const jdInput = document.getElementById('jdInput');
            if (jdInput && !jdInput.value) {
                jdInput.value = result.currentJd;
            }
        }
    });
}

/**
 * Save job description input to storage
 * @param {string} jd - Job description content to save
 */
function saveJdInput(jd) {
    chrome.storage.local.set({ currentJd: jd });
}

/**
 * Handle TAILOR_RESPONSE message from service worker
 * @param {Object} data - Response data
 */
function handleTailorResponse(data) {
    hideLoading();

    if (data.error) {
        handleTailorError(data.error);
    }
}

/**
 * Extract ATS keywords from job description
 * @param {string} text - Job description text
 * @returns {Object} Categorized keywords
 */
function extractKeywords(text) {
    if (!text) return { skills: [], tools: [], qualifications: [], other: [] };

    const lowerText = text.toLowerCase();

    // Common technical skills and tools
    const techKeywords = [
        'javascript', 'typescript', 'python', 'java', 'c\\+\\+', 'c#', 'ruby', 'go', 'rust', 'php',
        'react', 'vue', 'angular', 'node\\.?js', 'express', 'django', 'flask', 'spring', 'laravel',
        'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'jenkins', 'ci/cd', 'terraform',
        'sql', 'nosql', 'mongodb', 'postgresql', 'mysql', 'redis', 'elasticsearch',
        'git', 'github', 'gitlab', 'jira', 'agile', 'scrum', 'devops', 'sre',
        'rest', 'graphql', 'api', 'microservices', 'serverless',
        'html', 'css', 'sass', 'tailwind', 'bootstrap',
        'webpack', 'vite', 'babel', 'npm', 'yarn', 'pnpm',
        'jest', 'mocha', 'cypress', 'selenium', 'testing',
        'linux', 'unix', 'bash', 'shell', 'scripting'
    ];

    // Qualifications and experience
    const qualificationKeywords = [
        'bachelor', 'master', 'phd', 'degree', 'certification', 'certified',
        '\\d+\\+?\\s*years?', 'experience', 'senior', 'junior', 'lead', 'principal',
        'b\\.?s\\.?', 'm\\.?s\\.?', 'b\\.?tech', 'm\\.?tech'
    ];

    // Soft skills and other keywords
    const softSkillKeywords = [
        'leadership', 'communication', 'teamwork', 'problem[- ]solving',
        'analytical', 'critical thinking', 'collaboration', 'mentoring',
        'remote', 'hybrid', 'on-site', 'full[- ]time', 'part[- ]time'
    ];

    const skills = [];
    const qualifications = [];
    const other = [];

    // Extract technical skills
    techKeywords.forEach(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = text.match(regex);
        if (matches) {
            const normalized = matches[0].toLowerCase();
            if (!skills.includes(normalized)) {
                skills.push(normalized);
            }
        }
    });

    // Extract qualifications
    qualificationKeywords.forEach(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = text.match(regex);
        if (matches) {
            matches.forEach(match => {
                if (!qualifications.includes(match)) {
                    qualifications.push(match);
                }
            });
        }
    });

    // Extract soft skills
    softSkillKeywords.forEach(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = text.match(regex);
        if (matches) {
            const normalized = matches[0].toLowerCase();
            if (!other.includes(normalized)) {
                other.push(normalized);
            }
        }
    });

    return {
        skills: skills.slice(0, 15), // Limit to top 15
        qualifications: qualifications.slice(0, 5),
        other: other.slice(0, 10)
    };
}

/**
 * Extract and display ATS keywords
 * @param {string} text - Job description text
 */
function extractAndDisplayKeywords(text) {
    const keywords = extractKeywords(text);

    // Check if keywords container exists, if not create it
    let keywordsContainer = document.getElementById('keywordsContainer');
    if (!keywordsContainer) {
        const section = document.querySelector('.section');
        keywordsContainer = document.createElement('div');
        keywordsContainer.id = 'keywordsContainer';
        keywordsContainer.className = 'keywords-container';
        section.appendChild(keywordsContainer);
    }

    // Build HTML
    let html = '<div class="keywords-header">🎯 Detected ATS Keywords</div>';

    if (keywords.skills.length > 0) {
        html += '<div class="keywords-category">';
        html += '<strong>Technical Skills:</strong> ';
        html += keywords.skills.map(k => `<span class="keyword-tag">${k}</span>`).join(' ');
        html += '</div>';
    }

    if (keywords.qualifications.length > 0) {
        html += '<div class="keywords-category">';
        html += '<strong>Qualifications:</strong> ';
        html += keywords.qualifications.map(k => `<span class="keyword-tag">${k}</span>`).join(' ');
        html += '</div>';
    }

    if (keywords.other.length > 0) {
        html += '<div class="keywords-category">';
        html += '<strong>Other:</strong> ';
        html += keywords.other.map(k => `<span class="keyword-tag">${k}</span>`).join(' ');
        html += '</div>';
    }

    if (keywords.skills.length === 0 && keywords.qualifications.length === 0 && keywords.other.length === 0) {
        html += '<div class="keywords-empty">No keywords detected. Try pasting a job description.</div>';
    }

    keywordsContainer.innerHTML = html;
}
