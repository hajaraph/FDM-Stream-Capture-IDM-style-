# FDM Helper Addon - Architecture & Development Guide

## Module Structure

The extension is organized into focused modules for maintainability:

```
┌─────────────────────────────────────────────────────────┐
│                    manifest.json                        │
│         (Extension configuration & permissions)         │
└─────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼────────┐   ┌───────▼───────┐   ┌────────▼────────┐
│  constants.js  │   │   config.js   │   │    utils.js     │
│ (Magic numbers)│   │(Detection rules│   │(Security, cookies│
│                │   │ & patterns)    │   │ notifications)   │
└────────────────┘   └───────────────┘   └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  background.js  │
                    │ (Core logic)    │
                    └─────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼────────┐   ┌───────▼───────┐   ┌────────▼────────┐
│  popup.js      │   │  content.js   │   │   options.js    │
│ (Popup UI)     │   │ (Page scanner)│   │  (Settings UI)  │
└────────────────┘   └───────────────┘   └─────────────────┘
```

## Module Responsibilities

### constants.js
- All magic numbers, timing values, and limits
- UI constants (colors, z-indexes)
- Security lists (blocked hosts)
- YouTube-specific fixes

### config.js
- Detection rules (extensions, MIME types)
- Regex patterns for URL detection
- Helper functions: `detectMediaType()`, `detectTypeFromContentType()`, `extractExtension()`

### utils.js
- Security: URL validation, cookie filtering
- Native messaging: safe port creation with error handling
- Notifications: user feedback system
- Cookie management: `getCookiesForUrls()`, `cleanYouTubeUrl()`

### background.js
- Stream detection via webRequest API
- Download management (single and batch)
- Native messaging to FDM
- Message routing between components
- Storage persistence with debouncing
- Download tracking and history

### content.js
- DOM observation for media detection
- Overlay button and dropdown UI
- Page scanning (links, videos, embedded JSON)
- XHR/Fetch interception for dynamic media
- Notification display

### popup.js / popup.html
- Stream list UI for active tab
- Batch download interface
- Cart management (catch log viewer)
- Page scanner trigger

### options.js / options.html
- Extension settings UI
- Profile configuration persistence

## Loading Order

The manifest.json defines strict loading order:

**Background scripts:**
1. constants.js (no dependencies)
2. config.js (depends on constants.js)
3. utils.js (depends on constants.js)
4. background.js (depends on all above)

**Content scripts:**
1. constants.js
2. config.js
3. content.js (depends on all above)

## Adding New Features

### Adding a new detection pattern
1. Edit `config.js` → add to `DETECTION_RULES.extensions` or `DETECTION_RULES.contentTypes`
2. Edit `config.js` → add regex to `DETECTION_PATTERNS` if needed
3. No changes to background.js required (uses centralized rules)

### Adding a new constant
1. Edit `constants.js` → add to appropriate category (TIMING, LIMITS, UI, etc.)
2. Use the constant in code instead of magic number

### Adding a new utility function
1. Edit `utils.js` → add function with JSDoc comment
2. If it needs export, add to `module.exports` at bottom

### Adding a new message handler
1. Edit `background.js` → add case to `browser.runtime.onMessage.addListener`
2. If it involves downloads, use `trackDownload()` and `updateDownloadStatus()`
3. If it needs user feedback, use `notifyUser()`

## Coding Standards

### Naming Conventions
- Functions: camelCase with descriptive verbs (`sendToFDM`, `filterSensitiveCookies`)
- Constants: UPPER_SNAKE_CASE (`MAX_DOWNLOAD_HISTORY`, `PERSIST_DEBOUNCE_MS`)
- Variables: camelCase (`tabStreams`, `downloadQueue`)
- Message types: UPPER_SNAKE_CASE strings (`"SEND_TO_FDM"`, `"GET_STREAMS"`)

### Error Handling
- All async operations wrapped in try/catch
- Silent failures logged with `console.warn` or `console.error`
- User notified via `notifyUser()` for important errors
- Fallback to browser download when FDM unavailable

### Storage
- Use `persist()` for debounced writes (auto-throttled)
- Use `persistNow()` only when immediate persistence is critical
- Keep `catchLog` under `MAX_CATCH_LOG` entries
- Keep `downloadHistory` under `MAX_DOWNLOAD_HISTORY` entries

### Security
- All URLs validated via `isValidDownloadUrl()` before use
- Sensitive cookies filtered via `filterSensitiveCookies()` before transmission
- No hardcoded secrets or API keys in code
- Native messaging host name defined as constant

## Testing

See `TESTS.md` for manual testing checklist and future automated test structure.

## Cross-Browser Compatibility

This extension targets Firefox primarily. For Chrome/Edge port:
- Replace `browser.*` with `chrome.*` or use `webextension-polyfill`
- Background scripts may need conversion to service workers (MV3)
- Some Firefox-specific APIs (like `partitionKey` for cookies) may not be available
- Use feature detection: `if (typeof browser.cookies.getAll === 'function')`
