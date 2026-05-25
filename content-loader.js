/**
 * FDM Helper - Content Script Loader
 * Dynamically imports the ESM content script.
 */

(async () => {
    const src = chrome.runtime.getURL('content.js');
    await import(src);
})();