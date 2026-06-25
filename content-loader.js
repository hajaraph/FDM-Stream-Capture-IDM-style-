/**
 * FDM Helper - Content Script Loader
 * Injects content.js as a module script to avoid dynamic import() AMO warning.
 */

const s = document.createElement('script');
s.type = 'module';
s.src = browser.runtime.getURL('content.js');
(document.head || document.documentElement).appendChild(s);
