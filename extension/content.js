// Content script for CV Tailor Extension
// Detects job descriptions from web pages

/**
 * Extract job description from the current page
 * @returns {string} Extracted text
 */
function extractJobDescription() {
    // Try to find common job description containers
    const selectors = [
        // LinkedIn
        '.jobs-description__content',
        '.jobs-description',
        '[class*="job-description"]',
        '[class*="jobDescription"]',

        // Indeed
        '#jobDescriptionText',
        '.jobsearch-jobDescriptionText',

        // Glassdoor
        '.jobDescriptionContent',
        '[class*="JobDetails"]',

        // Generic
        '[class*="description"]',
        '[id*="description"]',
        'article',
        'main',

        // Fallback to body
        'body'
    ];

    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
            const text = element.innerText || element.textContent;
            if (text && text.trim().length > 100) {
                return text.trim();
            }
        }
    }

    // If nothing found, return all visible text
    return document.body.innerText || document.body.textContent || '';
}

/**
 * Listen for messages from the extension
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'EXTRACT_JD') {
        try {
            const text = extractJobDescription();
            sendResponse({ text });
        } catch (error) {
            console.error('Error extracting job description:', error);
            sendResponse({ text: '', error: error.message });
        }
        return true; // Keep channel open for async response
    }
});

// Also listen for selection changes for context menu
document.addEventListener('selectionchange', () => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    // Store selection for context menu
    if (selectedText) {
        chrome.storage.local.set({ lastSelection: selectedText });
    }
});

/**
 * Auto-fill form fields with profile data
 * @param {Object} profile - User profile data
 */
function autoFillForm(profile) {
    if (!profile) return 0;

    // Find all input fields, textareas, and selects
    const fields = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select');

    let filledCount = 0;

    fields.forEach(field => {
        // Skip if field already has a value
        if (field.value && field.value.trim()) return;

        // Get field identifiers
        const name = (field.name || '').toLowerCase();
        const id = (field.id || '').toLowerCase();
        const placeholder = (field.placeholder || '').toLowerCase();
        const ariaLabel = (field.getAttribute('aria-label') || '').toLowerCase();
        const label = findFieldLabel(field);

        // Combine all identifiers
        const fieldText = `${name} ${id} ${placeholder} ${ariaLabel} ${label}`.toLowerCase();

        // Match and fill fields
        if (/first.?name|fname|given.?name/i.test(fieldText) && profile.fullName) {
            field.value = profile.fullName.split(' ')[0];
            filledCount++;
        } else if (/last.?name|lname|surname|family.?name/i.test(fieldText) && profile.fullName) {
            const nameParts = profile.fullName.split(' ');
            field.value = nameParts[nameParts.length - 1];
            filledCount++;
        } else if (/^name$|full.?name/i.test(fieldText) && profile.fullName) {
            field.value = profile.fullName;
            filledCount++;
        } else if (/email|e-mail/i.test(fieldText) && profile.email) {
            field.value = profile.email;
            filledCount++;
        } else if (/phone|mobile|telephone/i.test(fieldText) && profile.phone) {
            field.value = profile.phone;
            filledCount++;
        } else if (/location|city|address/i.test(fieldText) && profile.location) {
            field.value = profile.location;
            filledCount++;
        } else if (/linkedin/i.test(fieldText) && profile.linkedin) {
            field.value = profile.linkedin;
            filledCount++;
        } else if (/github/i.test(fieldText) && profile.github) {
            field.value = profile.github;
            filledCount++;
        } else if (/portfolio|website|personal.?site/i.test(fieldText) && profile.portfolio) {
            field.value = profile.portfolio;
            filledCount++;
        } else if (/years.?of.?experience|experience.?years/i.test(fieldText) && profile.yearsExperience) {
            field.value = profile.yearsExperience;
            filledCount++;
        } else if (/company|employer|organization/i.test(fieldText) && profile.currentCompany) {
            field.value = profile.currentCompany;
            filledCount++;
        } else if (/title|position|role|job/i.test(fieldText) && profile.currentTitle) {
            field.value = profile.currentTitle;
            filledCount++;
        } else if (/education|degree|school|university/i.test(fieldText) && profile.education) {
            field.value = profile.education;
            filledCount++;
        } else if (/cover.?letter|message|additional.?info/i.test(fieldText) && profile.coverLetter) {
            field.value = profile.coverLetter;
            filledCount++;
        }

        // Trigger change event so the form knows the field was updated
        if (field.value) {
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });

    return filledCount;
}

/**
 * Find label text for a field
 * @param {HTMLElement} field - Input field element
 * @returns {string} Label text
 */
function findFieldLabel(field) {
    // Try to find label by 'for' attribute
    if (field.id) {
        const label = document.querySelector(`label[for="${field.id}"]`);
        if (label) return label.textContent || '';
    }

    // Try to find parent label
    const parentLabel = field.closest('label');
    if (parentLabel) return parentLabel.textContent || '';

    // Try to find previous sibling label
    let sibling = field.previousElementSibling;
    while (sibling) {
        if (sibling.tagName === 'LABEL') {
            return sibling.textContent || '';
        }
        sibling = sibling.previousElementSibling;
    }

    return '';
}

// Listen for auto-fill request
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'AUTO_FILL') {
        try {
            const filledCount = autoFillForm(message.profile);
            sendResponse({ success: true, filledCount });
        } catch (error) {
            console.error('Error auto-filling form:', error);
            sendResponse({ success: false, error: error.message });
        }
        return true;
    }
});
