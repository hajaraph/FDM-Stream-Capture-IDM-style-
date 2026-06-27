/**
 * FDM Helper - Content Script Loader
 * Loads content.js as an ES module inside the content script's isolated world,
 * preserving access to extension messaging APIs (runtime.sendMessage / onMessage).
 */

const rt = (typeof browser !== 'undefined' ? browser : chrome).runtime;
import(rt.getURL('content.js')).catch((e) =>
    console.error('FDM: content.js load failed', e)
);
