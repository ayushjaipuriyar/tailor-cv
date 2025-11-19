# Requirements Document

## Introduction

This document defines the requirements for a Chrome browser extension that enables users to tailor their LaTeX CV/resume to job descriptions found on web pages. The extension will integrate with the existing Tailor CV web application backend, allowing users to select job description text from any webpage, send it to the Gemini AI service, and receive a tailored LaTeX resume without leaving their browsing context.

## Glossary

- **Extension**: The Chrome browser extension application
- **Content Script**: JavaScript code that runs in the context of web pages
- **Background Service Worker**: The extension's background process that handles API requests
- **Popup UI**: The user interface displayed when clicking the extension icon
- **Context Menu**: The right-click menu in the browser
- **Base Resume**: The user's original LaTeX resume template stored in extension storage
- **Tailored Resume**: The AI-modified LaTeX resume customized for a specific job description
- **Gemini API**: Google's Generative AI API service used for resume tailoring
- **Job Description (JD)**: Text content describing a job posting that the user wants to tailor their resume for

## Requirements

### Requirement 1

**User Story:** As a job seeker, I want to select job description text on any webpage and tailor my resume to it, so that I can quickly customize my application materials while browsing job postings.

#### Acceptance Criteria

1. WHEN the user selects text on a webpage and right-clicks, THE Extension SHALL display a context menu option labeled "Tailor CV to this JD"
2. WHEN the user clicks the context menu option, THE Extension SHALL capture the selected text as the job description
3. WHEN the selected text is captured, THE Extension SHALL send the job description and base resume to the Gemini API for tailoring
4. WHEN the API returns the tailored resume, THE Extension SHALL display the result in the popup UI
5. IF the API request fails, THEN THE Extension SHALL display an error message with the failure reason

### Requirement 2

**User Story:** As a user, I want to configure my base LaTeX resume and API key once, so that I can reuse them for multiple tailoring operations without re-entering the information.

#### Acceptance Criteria

1. THE Extension SHALL provide a settings page accessible from the popup UI
2. THE Extension SHALL allow users to input and save their Gemini API key in the settings
3. THE Extension SHALL allow users to upload or paste their base LaTeX resume in the settings
4. WHEN the user saves settings, THE Extension SHALL store the API key and base resume in Chrome's local storage
5. WHEN the Extension needs to tailor a resume, THE Extension SHALL retrieve the stored API key and base resume from local storage

### Requirement 3

**User Story:** As a user, I want to view and edit the tailored LaTeX resume within the extension, so that I can make final adjustments before downloading.

#### Acceptance Criteria

1. WHEN a tailored resume is generated, THE Extension SHALL display the LaTeX content in an editable text area
2. THE Extension SHALL allow users to modify the displayed LaTeX content
3. THE Extension SHALL provide a "Copy to Clipboard" button that copies the LaTeX content
4. THE Extension SHALL provide a "Download .tex" button that downloads the content as a .tex file
5. THE Extension SHALL preserve user edits when switching between tabs in the popup

### Requirement 4

**User Story:** As a user, I want to see a PDF preview of my tailored resume, so that I can verify the formatting before downloading.

#### Acceptance Criteria

1. THE Extension SHALL provide a "Generate PDF Preview" button in the popup UI
2. WHEN the user clicks the preview button, THE Extension SHALL send the LaTeX content to the compilation API endpoint
3. WHEN the compilation succeeds, THE Extension SHALL display the PDF in an embedded viewer within the popup
4. IF the compilation fails, THEN THE Extension SHALL display the LaTeX error log to the user
5. THE Extension SHALL provide a "Download PDF" button when a preview is successfully generated

### Requirement 5

**User Story:** As a user, I want to quickly access the extension from any webpage, so that I can tailor my resume without navigating away from job postings.

#### Acceptance Criteria

1. THE Extension SHALL display a browser action icon in the Chrome toolbar
2. WHEN the user clicks the extension icon, THE Extension SHALL open a popup window with the main interface
3. THE Extension SHALL allow users to manually paste job description text in the popup if no text is selected
4. THE Extension SHALL maintain a history of the last 5 tailored resumes in local storage
5. THE Extension SHALL allow users to access previous tailoring results from the popup UI

### Requirement 6

**User Story:** As a user, I want the extension to work offline for basic operations, so that I can view my saved resumes even without internet connectivity.

#### Acceptance Criteria

1. THE Extension SHALL store the base resume locally for offline access
2. THE Extension SHALL cache the most recent tailored resume for offline viewing
3. WHEN the user is offline, THE Extension SHALL display cached content with an offline indicator
4. WHEN the user attempts to tailor a resume while offline, THE Extension SHALL display a message indicating internet connectivity is required
5. THE Extension SHALL automatically retry failed API requests when connectivity is restored

### Requirement 7

**User Story:** As a user, I want my API key and resume data to be stored securely, so that my sensitive information is protected.

#### Acceptance Criteria

1. THE Extension SHALL store the Gemini API key using Chrome's storage.local API with encryption
2. THE Extension SHALL not transmit the API key to any server except the Gemini API endpoint
3. THE Extension SHALL validate the API key format before storing it
4. THE Extension SHALL provide a "Clear All Data" option in settings that removes all stored information
5. WHEN the extension is uninstalled, THE Extension SHALL automatically remove all stored data through Chrome's cleanup mechanisms
