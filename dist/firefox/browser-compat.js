/**
 * Browser Compatibility Layer
 * Provides unified API for cross-browser extension development.
 * Loaded before all other scripts to ensure API availability.
 */

// Detect browser environment
const BROWSER_ENV = (() => {
    const isFirefox = typeof browser !== 'undefined' && browser.runtime;
    const isChrome = typeof chrome !== 'undefined' && chrome.runtime;

    return {
        isFirefox,
        isChrome,
        api: isFirefox ? browser : (isChrome ? chrome : null),
        namespace: isFirefox ? 'browser' : (isChrome ? 'chrome' : 'unknown')
    };
})();

// Unified API wrapper - exposed globally as `api`
// Use 'var' to ensure it's a global variable accessible by other scripts
var api = BROWSER_ENV.api;

// Expose to global scope (covers Service Workers, Content Scripts, and Pages)
globalThis.api = api;
globalThis.BROWSER_ENV = BROWSER_ENV;

// Feature detection helpers
function supportsPartitionedCookies() {
    return BROWSER_ENV.isFirefox && typeof api?.cookies?.getAll === 'function';
}

function supportsNativeMessaging() {
    return typeof api?.runtime?.connectNative === 'function';
}

function supportsWebRequest() {
    return typeof api?.webRequest?.onResponseStarted?.addListener === 'function';
}

function supportsWebNavigation() {
    return typeof api?.webNavigation?.getAllFrames === 'function';
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        BROWSER_ENV,
        api,
        supportsPartitionedCookies,
        supportsNativeMessaging,
        supportsWebRequest,
        supportsWebNavigation
    };
}
