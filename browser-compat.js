/**
 * FDM Helper - Cross-Browser API Wrapper (ESM)
 * Provides a unified 'api' object (browser.* or chrome.*)
 */

const api = typeof browser !== 'undefined' ? browser : chrome;

// Feature detection helpers
export const BROWSER_ENV = {
    isFirefox: typeof browser !== 'undefined' && typeof browser.runtime.getBrowserInfo === 'function',
    isChrome: typeof chrome !== 'undefined' && ! (typeof browser !== 'undefined'),
    hasSidePanel: typeof api.sidePanel !== 'undefined',
    hasSidebar: typeof api.sidebarAction !== 'undefined'
};

export default api;