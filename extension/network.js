// Network utilities for CV Tailor Extension

/**
 * Check if the browser is online
 * @returns {boolean} True if online, false if offline
 */
function isOnline() {
    return navigator.onLine;
}

/**
 * Queue for failed requests to retry when online
 */
class RequestQueue {
    constructor() {
        this.queue = [];
        this.isProcessing = false;

        // Listen for online/offline events
        window.addEventListener('online', () => this.onOnline());
        window.addEventListener('offline', () => this.onOffline());
    }

    /**
     * Add a request to the queue
     * @param {Function} requestFn - Function that returns a Promise for the request
     * @param {Function} onSuccess - Callback for successful request
     * @param {Function} onError - Callback for failed request
     */
    enqueue(requestFn, onSuccess, onError) {
        this.queue.push({
            requestFn,
            onSuccess,
            onError,
            timestamp: Date.now()
        });

        console.log(`Request queued. Queue size: ${this.queue.length}`);

        // Try to process queue if online
        if (isOnline() && !this.isProcessing) {
            this.processQueue();
        }
    }

    /**
     * Process queued requests
     */
    async processQueue() {
        if (this.isProcessing || this.queue.length === 0) {
            return;
        }

        this.isProcessing = true;

        while (this.queue.length > 0 && isOnline()) {
            const item = this.queue.shift();

            try {
                console.log(`Processing queued request. Remaining: ${this.queue.length}`);
                const result = await item.requestFn();

                if (item.onSuccess) {
                    item.onSuccess(result);
                }
            } catch (error) {
                console.error('Queued request failed:', error);

                if (item.onError) {
                    item.onError(error);
                }
            }

            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        this.isProcessing = false;
    }

    /**
     * Handle online event
     */
    onOnline() {
        console.log('Browser is now online. Processing queued requests...');

        // Update UI to show online status
        updateOnlineStatus(true);

        // Process queued requests
        this.processQueue();
    }

    /**
     * Handle offline event
     */
    onOffline() {
        console.log('Browser is now offline.');

        // Update UI to show offline status
        updateOnlineStatus(false);
    }

    /**
     * Clear the queue
     */
    clear() {
        this.queue = [];
        console.log('Request queue cleared');
    }

    /**
     * Get queue size
     * @returns {number} Number of queued requests
     */
    size() {
        return this.queue.length;
    }
}

// Global request queue instance
const requestQueue = new RequestQueue();

/**
 * Update UI to show online/offline status
 * @param {boolean} online - Whether the browser is online
 */
function updateOnlineStatus(online) {
    const offlineBanner = document.getElementById('offlineBanner');

    if (!offlineBanner) {
        console.warn('Offline banner element not found');
        return;
    }

    if (online) {
        offlineBanner.classList.add('hidden');
    } else {
        offlineBanner.classList.remove('hidden');
        // Load cached content when going offline
        loadCachedContent();
    }

    // Update button states
    updateButtonStates(online);
}

/**
 * Load cached content when offline
 * Implements lazy loading - only loads Editor tab content, not Preview/History (Task 12.1)
 */
async function loadCachedContent() {
    try {
        const storage = await chrome.storage.local.get(['currentTailoredTex', 'currentJd']);

        // Show cached LaTeX content if available
        if (storage.currentTailoredTex) {
            const latexOutput = document.getElementById('latexOutput');
            if (latexOutput && !latexOutput.value) {
                latexOutput.value = storage.currentTailoredTex;

                // Enable copy and download buttons for cached content
                const copyBtn = document.getElementById('copyBtn');
                const downloadTexBtn = document.getElementById('downloadTexBtn');
                if (copyBtn) copyBtn.disabled = false;
                if (downloadTexBtn) downloadTexBtn.disabled = false;
            }
        }

        // Show cached JD if available
        if (storage.currentJd) {
            const jdInput = document.getElementById('jdInput');
            if (jdInput && !jdInput.value) {
                jdInput.value = storage.currentJd;
            }
        }

        // Lazy loading (Task 12.1):
        // - PDF preview is NOT loaded here, only when Preview tab is activated
        // - This reduces memory usage and improves initial load performance
    } catch (error) {
        console.error('Error loading cached content:', error);
    }
}

/**
 * Update button states based on online status
 * @param {boolean} online - Whether the browser is online
 */
function updateButtonStates(online) {
    const tailorBtn = document.getElementById('tailorBtn');
    const generatePreviewBtn = document.getElementById('generatePreviewBtn');

    if (tailorBtn) {
        tailorBtn.disabled = !online;
        if (!online) {
            tailorBtn.title = 'Offline - Cannot tailor CV';
        } else {
            tailorBtn.title = '';
        }
    }

    if (generatePreviewBtn) {
        generatePreviewBtn.disabled = !online;
        if (!online) {
            generatePreviewBtn.title = 'Offline - Cannot generate preview';
        } else {
            generatePreviewBtn.title = '';
        }
    }
}

/**
 * Check online status and show error if offline
 * @returns {boolean} True if online, false if offline
 */
function checkOnlineStatus() {
    if (!isOnline()) {
        const error = new ExtensionError(
            'You are currently offline. Please check your internet connection.',
            ErrorCodes.OFFLINE_ERROR
        );
        displayError(error, null, null);
        return false;
    }
    return true;
}

/**
 * Initialize network monitoring
 */
function initializeNetworkMonitoring() {
    // Set initial online status
    updateOnlineStatus(isOnline());

    // Listen for online/offline events
    window.addEventListener('online', () => {
        console.log('Connection restored');
        showSuccess('Connection restored! You are now online.');
    });

    window.addEventListener('offline', () => {
        console.log('Connection lost');
        const error = new ExtensionError(
            'Connection lost. You are now offline.',
            ErrorCodes.OFFLINE_ERROR
        );
        displayError(error, null, null);
    });
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        isOnline,
        RequestQueue,
        requestQueue,
        updateOnlineStatus,
        checkOnlineStatus,
        initializeNetworkMonitoring
    };
}
