# Design Document

## Overview

The Chrome Extension for CV Tailoring is a browser extension that enables users to tailor their LaTeX resumes to job descriptions found on any webpage. The extension integrates with the existing Tailor CV backend API, providing a seamless experience for job seekers to customize their resumes without leaving their browsing context.

The extension follows Chrome's Manifest V3 architecture, utilizing a service worker for background processing, content scripts for webpage interaction, and a popup interface for user interaction. All data processing leverages the existing Next.js API endpoints (`/api/tailor` and `/api/compile/upload`).

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Web Page                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │           Content Script                            │     │
│  │  - Text selection detection                         │     │
│  │  - Context menu integration                         │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Background Service Worker                       │
│  ┌────────────────────────────────────────────────────┐     │
│  │  - API request handling                             │     │
│  │  - Message routing                                  │     │
│  │  - Storage management                               │     │
│  │  - Context menu creation                            │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Popup UI                                  │
│  ┌────────────────────────────────────────────────────┐     │
│  │  - Settings page                                    │     │
│  │  - LaTeX editor                                     │     │
│  │  - PDF preview                                      │     │
│  │  - History view                                     │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Chrome Storage API                              │
│  - API Key (encrypted)                                       │
│  - Base Resume                                               │
│  - Tailored Resume Cache                                     │
│  - History (last 5 results)                                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│           External APIs (via Service Worker)                 │
│  ┌────────────────────────────────────────────────────┐     │
│  │  POST /api/tailor                                   │     │
│  │  - Input: { jd, baseTex, apiKey }                  │     │
│  │  - Output: { tex }                                  │     │
│  │                                                      │     │
│  │  POST /api/compile/upload                           │     │
│  │  - Input: FormData with .tex file                  │     │
│  │  - Output: PDF blob                                 │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

1. **Text Selection Flow:**
   - User selects text on webpage → Content Script detects selection
   - User right-clicks → Context Menu appears with "Tailor CV to this JD"
   - User clicks menu item → Content Script sends message to Service Worker
   - Service Worker retrieves stored API key and base resume
   - Service Worker calls `/api/tailor` endpoint
   - Service Worker sends result to Popup UI
   - Popup opens automatically to display result

2. **Manual Input Flow:**
   - User clicks extension icon → Popup opens
   - User pastes JD text manually → Clicks "Tailor CV" button
   - Popup sends message to Service Worker
   - Service Worker processes request (same as above)
   - Result displayed in Popup

3. **PDF Preview Flow:**
   - User clicks "Generate PDF Preview" in Popup
   - Popup sends LaTeX content to Service Worker
   - Service Worker calls `/api/compile/upload` with FormData
   - Service Worker receives PDF blob
   - Service Worker sends blob URL to Popup
   - Popup displays PDF in iframe

## Components and Interfaces

### 1. Manifest (manifest.json)

```json
{
  "manifest_version": 3,
  "name": "CV Tailor",
  "version": "1.0.0",
  "description": "Tailor your LaTeX CV to job descriptions using AI",
  "permissions": [
    "storage",
    "contextMenus",
    "activeTab"
  ],
  "host_permissions": [
    "https://your-backend-domain.com/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"]
    }
  ],
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

### 2. Background Service Worker (background.js)

**Responsibilities:**
- Create and manage context menu
- Handle messages from content scripts and popup
- Make API requests to backend
- Manage Chrome storage operations
- Route data between components

**Key Functions:**

```typescript
// Context menu creation
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "tailorCV",
    title: "Tailor CV to this JD",
    contexts: ["selection"]
  });
});

// Message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "TAILOR_CV") {
    handleTailorRequest(message.data)
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true; // Keep channel open for async response
  }
});

// API request handler
async function handleTailorRequest(data: {
  jd: string;
  baseTex?: string;
  apiKey?: string;
}) {
  // Retrieve stored data if not provided
  const storage = await chrome.storage.local.get(['apiKey', 'baseTex']);
  const apiKey = data.apiKey || storage.apiKey;
  const baseTex = data.baseTex || storage.baseTex;
  
  // Call backend API
  const response = await fetch('https://your-backend/api/tailor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jd: data.jd, baseTex, apiKey })
  });
  
  const result = await response.json();
  
  // Save to history
  await saveToHistory(result.tex, data.jd);
  
  return result;
}
```

### 3. Content Script (content.js)

**Responsibilities:**
- Detect text selection on web pages
- Send selected text to service worker when context menu is clicked
- Minimal footprint to avoid interfering with page functionality

**Key Functions:**

```typescript
// Listen for context menu clicks
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_SELECTION") {
    const selectedText = window.getSelection()?.toString() || "";
    sendResponse({ text: selectedText });
  }
});

// Context menu click handler (triggered from background)
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "tailorCV" && info.selectionText) {
    chrome.runtime.sendMessage({
      type: "TAILOR_CV",
      data: { jd: info.selectionText }
    });
  }
});
```

### 4. Popup UI (popup.html + popup.js)

**Responsibilities:**
- Display main user interface
- Handle user input for manual JD entry
- Show tailored LaTeX results
- Provide editing capabilities
- Display PDF preview
- Manage settings
- Show history

**UI Structure:**

```
┌─────────────────────────────────────────┐
│  CV Tailor                    [Settings]│
├─────────────────────────────────────────┤
│  Tabs: [Editor] [Preview] [History]    │
├─────────────────────────────────────────┤
│                                         │
│  Editor Tab:                            │
│  ┌───────────────────────────────────┐ │
│  │ Job Description:                  │ │
│  │ [Text Area]                       │ │
│  │                                   │ │
│  │ [Tailor CV Button]                │ │
│  └───────────────────────────────────┘ │
│  ┌───────────────────────────────────┐ │
│  │ Tailored LaTeX:                   │ │
│  │ [Editable Text Area]              │ │
│  │                                   │ │
│  │ [Copy] [Download .tex]            │ │
│  └───────────────────────────────────┘ │
│                                         │
│  Preview Tab:                           │
│  ┌───────────────────────────────────┐ │
│  │ [Generate Preview Button]         │ │
│  │                                   │ │
│  │ [PDF Viewer iframe]               │ │
│  │                                   │ │
│  │ [Download PDF]                    │ │
│  └───────────────────────────────────┘ │
│                                         │
│  History Tab:                           │
│  ┌───────────────────────────────────┐ │
│  │ Recent Tailorings:                │ │
│  │ • [Date] - [JD snippet]           │ │
│  │ • [Date] - [JD snippet]           │ │
│  │ [Load] [Delete]                   │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**Settings Page Structure:**

```
┌─────────────────────────────────────────┐
│  Settings                      [< Back] │
├─────────────────────────────────────────┤
│                                         │
│  Gemini API Key:                        │
│  [Input Field (password type)]          │
│  [Save]                                 │
│                                         │
│  Base LaTeX Resume:                     │
│  [Text Area]                            │
│  [Upload .tex File]                     │
│  [Save]                                 │
│                                         │
│  Backend URL:                           │
│  [Input Field]                          │
│  (Default: https://your-backend.com)    │
│  [Save]                                 │
│                                         │
│  [Clear All Data]                       │
│                                         │
└─────────────────────────────────────────┘
```

### 5. Storage Schema

**Chrome Storage Local:**

```typescript
interface StorageSchema {
  // User settings
  apiKey: string;           // Gemini API key
  baseTex: string;          // Base LaTeX resume
  backendUrl: string;       // Backend API URL
  
  // Current session
  currentTailoredTex: string;  // Latest tailored result
  currentJd: string;           // Latest JD used
  currentPdfUrl: string;       // Latest PDF blob URL
  
  // History (array of last 5 results)
  history: Array<{
    id: string;              // Unique identifier
    timestamp: number;       // Unix timestamp
    jd: string;              // Job description (truncated to 200 chars)
    tex: string;             // Tailored LaTeX
    jdFull: string;          // Full job description
  }>;
}
```

## Data Models

### Message Types

```typescript
// Content Script → Service Worker
interface TailorRequestMessage {
  type: "TAILOR_CV";
  data: {
    jd: string;
    baseTex?: string;
    apiKey?: string;
  };
}

// Service Worker → Popup
interface TailorResponseMessage {
  type: "TAILOR_RESPONSE";
  data: {
    tex: string;
    jd: string;
  } | {
    error: string;
  };
}

// Popup → Service Worker
interface CompileRequestMessage {
  type: "COMPILE_PDF";
  data: {
    tex: string;
  };
}

// Service Worker → Popup
interface CompileResponseMessage {
  type: "COMPILE_RESPONSE";
  data: {
    pdfBlobUrl: string;
  } | {
    error: string;
    log?: string;
  };
}

// Popup → Service Worker
interface GetStorageMessage {
  type: "GET_STORAGE";
  keys: string[];
}

// Popup → Service Worker
interface SetStorageMessage {
  type: "SET_STORAGE";
  data: Partial<StorageSchema>;
}
```

### API Request/Response Models

**Tailor API:**

```typescript
// Request
interface TailorRequest {
  jd: string;
  baseTex: string;
  apiKey: string;
}

// Response
interface TailorResponse {
  tex: string;
}

// Error Response
interface TailorErrorResponse {
  error: string;
  tried?: string[];
  status?: number;
}
```

**Compile API:**

```typescript
// Request: FormData with file field
// Response: PDF Blob or error text
```

## Error Handling

### Error Categories

1. **Network Errors:**
   - No internet connection
   - API endpoint unreachable
   - Timeout errors

2. **API Errors:**
   - Invalid API key
   - Rate limiting (429)
   - Server errors (500)
   - Gemini API failures

3. **Validation Errors:**
   - Missing API key
   - Missing base resume
   - Empty job description
   - Invalid LaTeX syntax

4. **Storage Errors:**
   - Storage quota exceeded
   - Storage access denied

### Error Handling Strategy

```typescript
class ExtensionError extends Error {
  constructor(
    message: string,
    public code: string,
    public recoverable: boolean = true
  ) {
    super(message);
  }
}

// Error codes
const ErrorCodes = {
  NO_API_KEY: 'NO_API_KEY',
  NO_BASE_RESUME: 'NO_BASE_RESUME',
  NETWORK_ERROR: 'NETWORK_ERROR',
  API_ERROR: 'API_ERROR',
  RATE_LIMIT: 'RATE_LIMIT',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
  STORAGE_ERROR: 'STORAGE_ERROR',
  COMPILATION_ERROR: 'COMPILATION_ERROR'
};

// Error handler
function handleError(error: ExtensionError): UserFacingError {
  const userMessages = {
    [ErrorCodes.NO_API_KEY]: {
      title: 'API Key Required',
      message: 'Please configure your Gemini API key in settings.',
      action: 'Open Settings'
    },
    [ErrorCodes.NO_BASE_RESUME]: {
      title: 'Base Resume Required',
      message: 'Please upload your base LaTeX resume in settings.',
      action: 'Open Settings'
    },
    [ErrorCodes.NETWORK_ERROR]: {
      title: 'Connection Error',
      message: 'Unable to reach the server. Please check your internet connection.',
      action: 'Retry'
    },
    [ErrorCodes.RATE_LIMIT]: {
      title: 'Rate Limit Exceeded',
      message: 'Too many requests. Please wait a moment and try again.',
      action: 'OK'
    },
    // ... other error mappings
  };
  
  return userMessages[error.code] || {
    title: 'Error',
    message: error.message,
    action: 'OK'
  };
}
```

### Retry Logic

```typescript
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 3
): Promise<Response> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      
      // Retry on 429 or 5xx errors
      if (response.status === 429 || response.status >= 500) {
        if (i === maxRetries - 1) throw new Error('Max retries exceeded');
        
        // Exponential backoff
        const delay = Math.pow(2, i) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      return response;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      // Wait before retry
      const delay = Math.pow(2, i) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error('Unexpected retry loop exit');
}
```

## Testing Strategy

### Unit Testing

**Components to Test:**
- Message handlers in service worker
- Storage operations
- API request formatting
- Error handling logic
- Data validation functions

**Testing Framework:** Jest with Chrome extension mocks

```typescript
// Example test
describe('Background Service Worker', () => {
  it('should handle TAILOR_CV message', async () => {
    const mockStorage = {
      apiKey: 'test-key',
      baseTex: '\\documentclass{article}...'
    };
    
    chrome.storage.local.get = jest.fn().mockResolvedValue(mockStorage);
    
    const message = {
      type: 'TAILOR_CV',
      data: { jd: 'Software Engineer position...' }
    };
    
    const response = await handleMessage(message);
    
    expect(response).toHaveProperty('tex');
    expect(response.tex).toContain('\\documentclass');
  });
});
```

### Integration Testing

**Scenarios:**
1. End-to-end flow: Text selection → Tailoring → Display
2. Settings save and retrieve
3. PDF compilation flow
4. History management
5. Offline behavior

### Manual Testing Checklist

- [ ] Context menu appears on text selection
- [ ] Tailoring works with selected text
- [ ] Tailoring works with manual input
- [ ] Settings persist across sessions
- [ ] PDF preview generates correctly
- [ ] Download buttons work
- [ ] History saves and loads correctly
- [ ] Error messages display appropriately
- [ ] Offline mode shows correct indicators
- [ ] Extension icon badge updates

## Security Considerations

### API Key Storage

- Store API key using Chrome's `storage.local` API
- Never log API key to console
- Clear API key on extension uninstall
- Validate API key format before storage

### Content Security Policy

```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

### Data Transmission

- Use HTTPS for all API requests
- Validate backend URL format
- Implement request timeout (120 seconds)
- Sanitize user input before sending to API

### Permissions Justification

- `storage`: Required for saving API key, base resume, and history
- `contextMenus`: Required for right-click menu integration
- `activeTab`: Required for reading selected text from web pages
- `host_permissions`: Required for making API requests to backend

## Performance Considerations

### Optimization Strategies

1. **Lazy Loading:**
   - Load PDF preview only when tab is active
   - Defer history loading until history tab is opened

2. **Caching:**
   - Cache base resume in memory after first load
   - Reuse PDF blob URLs when content hasn't changed
   - Cache API responses for identical JD inputs (with 5-minute TTL)

3. **Resource Management:**
   - Revoke blob URLs when no longer needed
   - Limit history to 5 most recent items
   - Compress stored LaTeX content if over 100KB

4. **UI Responsiveness:**
   - Show loading indicators during API calls
   - Debounce text input in editor (500ms)
   - Use virtual scrolling for long LaTeX content

### Memory Management

```typescript
// Cleanup function for blob URLs
function cleanupBlobUrls() {
  const storage = chrome.storage.local.get(['currentPdfUrl']);
  if (storage.currentPdfUrl) {
    URL.revokeObjectURL(storage.currentPdfUrl);
  }
}

// Call on popup close
window.addEventListener('unload', cleanupBlobUrls);
```

## Deployment and Distribution

### Build Process

1. Bundle JavaScript files (using webpack or rollup)
2. Minify CSS and HTML
3. Optimize images
4. Generate manifest.json with correct permissions
5. Create .zip file for Chrome Web Store

### Chrome Web Store Submission

**Required Assets:**
- 128x128 icon
- 440x280 promotional tile
- 1280x800 screenshots (at least 1)
- Detailed description
- Privacy policy URL

**Review Checklist:**
- Manifest V3 compliance
- Minimal permissions requested
- Clear privacy policy
- No obfuscated code
- Proper error handling

### Update Strategy

- Use semantic versioning (MAJOR.MINOR.PATCH)
- Test updates in development mode before publishing
- Maintain backward compatibility for storage schema
- Provide migration logic for breaking changes

```typescript
// Migration example
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'update') {
    const previousVersion = details.previousVersion;
    
    if (previousVersion && compareVersions(previousVersion, '2.0.0') < 0) {
      // Migrate from v1.x to v2.x
      await migrateStorageSchema();
    }
  }
});
```

## Future Enhancements

1. **Multi-Resume Support:** Allow users to store multiple base resumes
2. **Template Library:** Provide pre-built LaTeX templates
3. **Job Board Integration:** Direct integration with LinkedIn, Indeed, etc.
4. **Collaborative Features:** Share tailored resumes with team members
5. **Analytics:** Track which tailorings lead to interviews
6. **AI Suggestions:** Suggest improvements to base resume
7. **Export Formats:** Support for Word, PDF, and HTML exports
8. **Keyboard Shortcuts:** Add hotkeys for common actions
9. **Dark Mode:** Theme support for popup UI
10. **Internationalization:** Multi-language support
