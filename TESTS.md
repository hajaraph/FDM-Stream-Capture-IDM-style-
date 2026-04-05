# FDM Helper Addon - Tests

## Overview
This document describes the test strategy for the FDM Helper browser extension.

## Manual Testing Checklist

### Security Tests
- [ ] URL Validation
  - Test with invalid URLs (data:, javascript:, about:)
  - Test with localhost URLs (should be blocked)
  - Test with malformed URLs
  - Test with valid http/https URLs

- [ ] Cookie Filtering
  - Test with sensitive cookies (token, auth, session)
  - Test with regular cookies (tracking, preferences)
  - Verify sensitive cookies are not sent to FDM

- [ ] Native Messaging Error Handling
  - Test with FDM not installed (should show error notification)
  - Test with FDM running normally
  - Test connection drop during operation

### Performance Tests
- [ ] MutationObserver vs Polling
  - Verify no setInterval calls in content.js
  - Verify MutationObserver triggers only on relevant DOM changes
  - Check memory usage during extended browsing

- [ ] Debounced Storage
  - Verify rapid stream detections don't cause excessive disk writes
  - Check that persist() is debounced (500ms)

- [ ] Cookie Logic DRY
  - Verify getCookiesForUrls() is used in both SEND_TO_FDM and DOWNLOAD_DIRECT
  - Verify cleanYouTubeUrl() is centralized

### Feature Tests
- [ ] Download Tracking
  - Verify downloads appear in history
  - Check status transitions (pending -> sent -> completed/failed)
  - Test batch downloads tracking

- [ ] Enhanced Page Scanner
  - Test detection of inline style media URLs
  - Test detection of JSON-embedded media URLs
  - Test XHR/Fetch interception for media files

- [ ] Notifications
  - Verify success notification (green)
  - Verify error notification (red)
  - Verify warning notification (yellow)
  - Verify auto-dismiss after 4 seconds
  - Verify click-to-dismiss

### Code Quality Tests
- [ ] Centralized Config
  - Verify config.js is loaded before background.js and content.js
  - Verify all regex patterns use DETECTION_PATTERNS from config.js
  - Verify all constants use constants.js

- [ ] Constants Usage
  - Search for remaining magic numbers in code
  - Verify all hardcoded values replaced with constants

## Automated Test Structure (Future)

When automated testing is added, use this structure:

```
tests/
├── unit/
│   ├── test-url-validation.js
│   ├── test-cookie-filtering.js
│   ├── test-naming-engine.js
│   └── test-config-patterns.js
├── integration/
│   ├── test-native-messaging.js
│   ├── test-storage-sync.js
│   └── test-message-routing.js
└── e2e/
    ├── test-download-flow.js
    └── test-page-scanner.js
```

## Testing Tools

Recommended tools for future automation:
- **Jest** - Unit testing framework
- **web-ext** - Mozilla's extension testing tool
- **Puppeteer** - Browser automation for E2E tests
- **Sinon.js** - Mocking and stubbing

## Known Edge Cases

1. **Firefox 143+ Native Messaging Bug** - Use-after-free vulnerability, ensure Firefox 144+
2. **YouTube 413 Error** - Referer must be empty for YouTube downloads
3. **Blob URLs** - Cannot be downloaded directly, need to extract source URL
4. **CORS-restricted Cookies** - May fail silently, handled gracefully
5. **Single Page Apps** - History state changes clear tab streams correctly
