# Implementation Plan

- [x] 1. Set up Chrome extension project structure and manifest
  - Create extension directory with manifest.json (Manifest V3)
  - Define permissions: storage, contextMenus, activeTab, and host_permissions
  - Configure background service worker, popup, and content script entries
  - Add icon assets (16x16, 48x48, 128x128)
  - _Requirements: 1.1, 5.1_

- [x] 2. Implement background service worker core functionality
  - [x] 2.1 Create background.js with message routing system
    - Implement chrome.runtime.onMessage listener for handling messages from content scripts and popup
    - Create message type constants (TAILOR_CV, COMPILE_PDF, GET_STORAGE, SET_STORAGE)
    - Implement sendResponse handlers with async support
    - _Requirements: 1.3, 1.4_

  - [x] 2.2 Implement context menu creation and handling
    - Create context menu item "Tailor CV to this JD" on extension install
    - Implement chrome.contextMenus.onClicked listener
    - Extract selected text and trigger tailoring flow
    - _Requirements: 1.1, 1.2_

  - [x] 2.3 Implement API request handlers for tailoring
    - Create handleTailorRequest function that calls /api/tailor endpoint
    - Retrieve API key and base resume from storage
    - Format request body with jd, baseTex, and apiKey
    - Implement error handling for API failures
    - _Requirements: 1.3, 1.4, 1.5, 2.4_

  - [x] 2.4 Implement API request handler for PDF compilation
    - Create handleCompileRequest function that calls /api/compile/upload endpoint
    - Format FormData with .tex file blob
    - Handle PDF blob response and create blob URL
    - Implement error handling for compilation failures
    - _Requirements: 4.2, 4.3, 4.4_

  - [x] 2.5 Implement storage management functions
    - Create getStorage function wrapping chrome.storage.local.get
    - Create setStorage function wrapping chrome.storage.local.set
    - Implement storage error handling
    - _Requirements: 2.4, 2.5_

  - [x] 2.6 Implement retry logic with exponential backoff
    - Create fetchWithRetry function for API requests
    - Implement exponential backoff for 429 and 5xx errors
    - Set maximum retry count to 3
    - _Requirements: 6.5_

- [x] 3. Implement content script for text selection
  - [x] 3.1 Create content.js with selection detection
    - Implement message listener for GET_SELECTION requests
    - Use window.getSelection() to capture selected text
    - Send selected text back to service worker
    - _Requirements: 1.1, 1.2_

- [x] 4. Implement popup UI structure and navigation
  - [x] 4.1 Create popup.html with tab-based layout
    - Build HTML structure with three tabs: Editor, Preview, History
    - Add settings button in header
    - Include loading overlay for async operations
    - Link popup.css and popup.js
    - _Requirements: 3.1, 3.2, 4.1, 5.2, 5.3_

  - [x] 4.2 Create popup.css with styling
    - Style tab navigation and content areas
    - Implement responsive layout for popup dimensions (400x600)
    - Add loading spinner and error message styles
    - Style buttons, text areas, and form elements
    - _Requirements: 3.1, 3.2, 4.1_

  - [x] 4.3 Implement tab switching logic in popup.js
    - Create tab click handlers to show/hide content
    - Maintain active tab state
    - Preserve content when switching tabs
    - _Requirements: 3.5, 5.2_

- [x] 5. Implement Editor tab functionality
  - [x] 5.1 Create job description input and tailor button
    - Add textarea for manual JD input
    - Implement "Tailor CV" button click handler
    - Send TAILOR_CV message to service worker
    - Display loading state during API call
    - _Requirements: 1.3, 5.3_

  - [x] 5.2 Implement tailored LaTeX display and editing
    - Create editable textarea for tailored LaTeX result
    - Populate textarea when TAILOR_RESPONSE message received
    - Allow user to edit LaTeX content
    - Save edited content to storage on change
    - _Requirements: 3.1, 3.2, 3.5_

  - [x] 5.3 Implement copy and download buttons
    - Create "Copy to Clipboard" button using navigator.clipboard API
    - Create "Download .tex" button that creates blob and triggers download
    - Show success feedback after copy/download
    - _Requirements: 3.3, 3.4_

- [x] 6. Implement Preview tab functionality
  - [x] 6.1 Create PDF preview generation button
    - Add "Generate PDF Preview" button
    - Send COMPILE_PDF message to service worker with current LaTeX content
    - Display loading state during compilation
    - _Requirements: 4.1, 4.2_

  - [x] 6.2 Implement PDF viewer with iframe
    - Create iframe element for PDF display
    - Set iframe src to blob URL received from service worker
    - Handle iframe load errors
    - Implement fallback message when no preview available
    - _Requirements: 4.3_

  - [x] 6.3 Implement PDF download button
    - Create "Download PDF" button
    - Use blob URL from preview as download link
    - Set filename to "resume.pdf"
    - Disable button when no preview available
    - _Requirements: 4.5_

  - [x] 6.4 Implement error display for compilation failures
    - Show LaTeX error log in scrollable container
    - Parse and highlight error lines
    - Provide "Try Again" button
    - _Requirements: 4.4_

- [x] 7. Implement History tab functionality
  - [x] 7.1 Create history list display
    - Fetch history array from storage
    - Render list items with timestamp and JD snippet (first 100 chars)
    - Show "No history" message when empty
    - _Requirements: 5.4, 5.5_

  - [x] 7.2 Implement history item actions
    - Add "Load" button for each history item
    - Populate Editor tab with selected history item
    - Add "Delete" button to remove history item
    - Update storage after deletion
    - _Requirements: 5.5_

  - [x] 7.3 Implement history saving in service worker
    - Create saveToHistory function in background.js
    - Limit history to 5 most recent items (FIFO)
    - Store timestamp, JD (truncated to 200 chars), full JD, and tailored tex
    - Generate unique ID for each history item
    - _Requirements: 5.4_

- [-] 8. Implement Settings page
  - [x] 8.1 Create settings.html with form layout
    - Build form with API key input (password type)
    - Add textarea for base LaTeX resume
    - Add file upload button for .tex files
    - Add backend URL input with default value
    - Include "Clear All Data" button
    - Link settings.css and settings.js
    - _Requirements: 2.1, 2.2, 2.3, 7.4_

  - [x] 8.2 Implement settings form handlers in settings.js
    - Load current settings from storage on page load
    - Implement save button handlers for each setting
    - Validate API key format before saving
    - Validate backend URL format before saving
    - Show success/error feedback after save
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 7.3_

  - [ ] 8.3 Implement file upload for base resume
    - Add file input change handler
    - Read .tex file content using FileReader API
    - Populate textarea with file content
    - Validate file extension is .tex
    - _Requirements: 2.3_

  - [ ] 8.4 Implement "Clear All Data" functionality
    - Add confirmation dialog before clearing
    - Call chrome.storage.local.clear()
    - Show success message after clearing
    - Redirect to settings page after clearing
    - _Requirements: 7.4_

- [x] 9. Implement error handling and validation
  - [x] 9.1 Create error handling utilities
    - Define ExtensionError class with error codes
    - Create handleError function that maps error codes to user messages
    - Implement displayError function in popup.js to show error UI
    - _Requirements: 1.5_

  - [x] 9.2 Implement input validation
    - Validate JD is not empty and at least 16 characters
    - Validate API key is present before tailoring
    - Validate base resume is present before tailoring
    - Show validation errors in popup UI
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 9.3 Implement network error handling
    - Detect offline state using navigator.onLine
    - Show offline indicator in popup when offline
    - Queue failed requests for retry when online
    - Implement connectivity change listener
    - _Requirements: 6.3, 6.4, 6.5_

- [x] 10. Implement offline support and caching
  - [x] 10.1 Implement offline detection and UI indicators
    - Add offline banner to popup UI
    - Disable tailor and compile buttons when offline
    - Show cached content with offline indicator
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 10.2 Implement caching for recent results
    - Cache most recent tailored resume in storage
    - Cache most recent PDF blob URL in storage
    - Load cached content on popup open
    - Clear cache when new result generated
    - _Requirements: 6.2_

- [x] 11. Implement security measures
  - [x] 11.1 Implement secure API key storage
    - Store API key in chrome.storage.local (encrypted by Chrome)
    - Never log API key to console
    - Validate API key format (alphanumeric, 39 chars for Gemini)
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 11.2 Implement input sanitization
    - Sanitize user input before sending to API
    - Validate backend URL format (https only)
    - Escape special characters in displayed content
    - _Requirements: 7.2_

  - [x] 11.3 Implement cleanup on uninstall
    - Add chrome.runtime.onInstalled listener for uninstall
    - Clear all storage data on uninstall
    - Revoke all blob URLs
    - _Requirements: 7.5_

- [x] 12. Implement performance optimizations
  - [x] 12.1 Implement lazy loading for tabs
    - Load Preview tab content only when tab is active
    - Load History tab content only when tab is active
    - Defer PDF generation until explicitly requested
    - _Requirements: 4.1, 5.5_

  - [x] 12.2 Implement resource cleanup
    - Revoke blob URLs when no longer needed
    - Implement cleanup on popup close
    - Limit history storage to 5 items
    - _Requirements: 5.4_

  - [x] 12.3 Implement debouncing for text input
    - Debounce LaTeX editor changes (500ms)
    - Debounce JD input changes (500ms)
    - Prevent excessive storage writes
    - _Requirements: 3.2, 3.5_

- [x] 13. Write tests for core functionality
  - [x] 13.1 Write unit tests for service worker
    - Test message routing logic
    - Test API request formatting
    - Test storage operations
    - Test error handling
    - _Requirements: All_

  - [x] 13.2 Write integration tests
    - Test end-to-end tailoring flow
    - Test PDF compilation flow
    - Test settings persistence
    - Test history management
    - _Requirements: All_

- [ ] 14. Create build and packaging scripts
  - [ ] 14.1 Create build script
    - Bundle JavaScript files (webpack or rollup)
    - Minify CSS and HTML
    - Copy manifest and assets to dist folder
    - Generate .zip file for Chrome Web Store
    - _Requirements: All_

  - [ ] 14.2 Create development script
    - Set up file watcher for auto-reload
    - Create development manifest with localhost permissions
    - Add source maps for debugging
    - _Requirements: All_

- [ ] 15. Create documentation
  - [ ] 15.1 Write README.md
    - Installation instructions
    - Usage guide with screenshots
    - Configuration steps
    - Troubleshooting section
    - _Requirements: All_

  - [ ] 15.2 Write privacy policy
    - Data collection disclosure
    - API key storage explanation
    - Third-party service usage (Gemini API)
    - User rights and data deletion
    - _Requirements: 7.1, 7.2_

  - [ ] 15.3 Create Chrome Web Store assets
    - Design promotional tile (440x280)
    - Capture screenshots (1280x800)
    - Write detailed description
    - Prepare privacy policy URL
    - _Requirements: All_
