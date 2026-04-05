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

// Unified API wrapper
const api = BROWSER_ENV.api;

// Cross-browser message sending
function sendMessageToTab(tabId, message) {
    if (!api || !tabId) return Promise.resolve(null);
    return api.tabs.sendMessage(tabId, message).catch(() => null);
}

// Cross-browser storage access
function storageGet(keys) {
    if (!api) return Promise.resolve({});
    return api.storage.local.get(keys).catch(() => ({}));
}

function storageSet(data) {
    if (!api) return Promise.resolve();
    return api.storage.local.set(data).catch(() => {});
}

// Cross-browser notification helper
function notifyUser(message, type = 'info') {
    return api.tabs.query({ active: true, currentWindow: true }).then(tabs => {
        if (tabs && tabs[0]) {
            return sendMessageToTab(tabs[0].id, {
                type: 'FDM_NOTIFICATION',
                message: message,
                notificationType: type
            });
        }
        return null;
    }).catch(() => {});
}

// Feature detection helpers
function supportsPartitionedCookies() {
    return typeof api?.cookies?.getAll === 'function';
}

function supportsNativeMessaging() {
    return typeof api?.runtime?.connectNative === 'function';
}

function supportsWebRequest() {
    return typeof api?.webRequest?.onResponseStarted?.addListener === 'function';
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        BROWSER_ENV,
        api,
        sendMessageToTab,
        storageGet,
        storageSet,
        notifyUser,
        supportsPartitionedCookies,
        supportsNativeMessaging,
        supportsWebRequest
    };
}
