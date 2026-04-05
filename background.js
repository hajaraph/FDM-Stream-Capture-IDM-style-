/**
 * FDM Helper - Background Script
 * Handles stream detection, download management, and native messaging.
 * 
 * Module dependencies (loaded before this script):
 * - constants.js: Magic numbers, timing, limits
 * - config.js: Detection rules and patterns
 * - utils.js: Security, notification, and cookie utilities
 */

// FDM Native Messaging Bridge
const FDM_HOST = 'org.freedownloadmanager.fdm5.cnh';
let nextTaskId = 1;

// Stream tracking state
let tabStreams = {};
let catchLog = [];
let isHydrated = false;
let hydratePromise = null;

// --- DOWNLOAD TRACKING ---
let downloadQueue = []; // Track sent downloads
let downloadHistory = []; // Persistent history

const DOWNLOAD_STATUS = {
    PENDING: 'pending',
    SENT: 'sent_to_fdm',
    FALLBACK: 'fallback_browser',
    COMPLETED: 'completed',
    FAILED: 'failed'
};

function trackDownload(url, filename, status = DOWNLOAD_STATUS.SENT) {
    const entry = {
        id: Date.now(),
        url: url,
        filename: filename,
        status: status,
        timestamp: new Date().toISOString(),
        tabId: null
    };

    downloadQueue.push(entry);
    downloadHistory.unshift(entry);

    // Keep history manageable
    if (downloadHistory.length > MAX_DOWNLOAD_HISTORY) {
        downloadHistory = downloadHistory.slice(0, MAX_DOWNLOAD_HISTORY);
    }

    // Persist history
    browser.storage.local.set({ downloadHistory: downloadHistory }).catch(() => {});

    return entry;
}

function updateDownloadStatus(id, newStatus) {
    const queueEntry = downloadQueue.find(e => e.id === id);
    if (queueEntry) {
        queueEntry.status = newStatus;
    }

    const historyEntry = downloadHistory.find(e => e.id === id);
    if (historyEntry) {
        historyEntry.status = newStatus;
        browser.storage.local.set({ downloadHistory: downloadHistory }).catch(() => {});
    }
}

let extensionSettings = {
    showButton: true,
    minSizeEnabled: true,
    minSizeMB: 1,
    detectSubtitles: true,
    scanHiddenStreams: true,
    smartNaming: true
};

async function hydrate() {
    if (isHydrated) return;
    if (!hydratePromise) {
        hydratePromise = browser.storage.local.get(['tabStreams', 'extensionSettings', 'catchLog']).then(data => {
            if (data.tabStreams) tabStreams = data.tabStreams;
            if (data.catchLog) catchLog = data.catchLog;
            if (data.extensionSettings) extensionSettings = { ...extensionSettings, ...data.extensionSettings };
            isHydrated = true;
        });
    }
    await hydratePromise;
}

browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.extensionSettings) {
        extensionSettings = { ...extensionSettings, ...changes.extensionSettings.newValue };
    }
});

// --- OPTIMIZED PERSIST WITH DEBOUNCE ---
let persistTimeout = null;

function persist() {
    // Clear any pending write
    if (persistTimeout) clearTimeout(persistTimeout);

    // Schedule new write after debounce delay
    persistTimeout = setTimeout(() => {
        browser.storage.local.set({ tabStreams: tabStreams, catchLog: catchLog }).catch(() => {});
        persistTimeout = null;
    }, TIMING.PERSIST_DEBOUNCE_MS);
}

// Force immediate persist (use sparingly)
function persistNow() {
    if (persistTimeout) {
        clearTimeout(persistTimeout);
        persistTimeout = null;
    }
    browser.storage.local.set({ tabStreams: tabStreams, catchLog: catchLog }).catch(() => {});
}

// --- INTELLIGENT NAMING ENGINE ---
function getSmartFileName(rawTitle, url, isYoutube = false) {
    if (!rawTitle || rawTitle === "Vidéo détectée" || rawTitle === "Vidéo cachée") {
        // Tenter d'extraire du nom de fichier dans l'URL si le titre est générique
        try {
            const urlPath = new URL(url).pathname;
            const fileName = urlPath.substring(urlPath.lastIndexOf('/') + 1);
            if (fileName && fileName.includes('.') && fileName.length > 5) {
                rawTitle = fileName.split('.')[0];
            }
        } catch (e) {}
    }

    let name = rawTitle || "Video_Stream";

    // 1. Supprimer les noms de sites communs et séparateurs à la fin
    // Ex: "Movie Title - Netflix" -> "Movie Title"
    const siteSeparators = [" - ", " | ", " — ", " : ", " » ", " « ", " // "];
    for (const sep of siteSeparators) {
        if (name.includes(sep)) {
            const parts = name.split(sep);
            // On garde généralement la partie la plus longue ou la première
            if (parts[0].length > 5) name = parts[0];
            else if (parts.length > 1) name = parts[1];
        }
    }

    // 2. Nettoyage des mots "parasites" de SEO/Streaming (Case Insensitive)
    const junkWords = [
        /watch\s+/gi, /\s+online/gi, /\s+streaming/gi, /\s+free/gi, 
        /full\s+episode/gi, /official\s+video/gi, /official\s+trailer/gi,
        /\s+hd/gi, /\s+1080p/gi, /\s+720p/gi, /\[.*?\]/g, /\(.*?\)/g
    ];
    
    junkWords.forEach(regex => {
        name = name.replace(regex, "");
    });

    // 3. Caractères interdits Windows
    name = name.replace(/[\\/:*?"<>|]/g, "-").trim();
    
    // 4. Fallback si vide après nettoyage
    if (!name || name.length < LIMITS.MIN_NAME_LENGTH) name = "FDM_Download_" + Math.floor(Math.random() * LIMITS.MAX_FILENAME_RANDOM_SUFFIX);

    // 5. Gestion de l'extension
    let extMatch = url.match(/\.(mp4|mkv|avi|webm|m3u8|ts|mp3|flac|wav|jpg|png|gif|pdf|zip|rar)(?:\?|$)/i);
    let ext = extMatch ? extMatch[1].toLowerCase() : (isYoutube ? "mp4" : "mp4");
    
    if (url.includes('.m3u8') || url.includes('.m3u')) ext = "m3u8";

    if (!name.toLowerCase().endsWith('.' + ext)) {
        name += '.' + ext;
    }

    return name;
}

function addToCatchLog(entry) {
    if (!catchLog.some(s => s.url === entry.url)) {
        catchLog.unshift(entry);
        if (catchLog.length > MAX_CATCH_LOG) catchLog.pop();
        persist();
    }
}

async function sendToFDM(url, filename = "", referer = "", cookies = "", isYoutube = false) {
    // --- SECURITY: Validate URL before sending ---
    if (!isValidDownloadUrl(url)) {
        console.error('FDM: Blocked invalid URL:', url);
        notifyUser('FDM: URL invalide ou non securise bloque.', 'error');
        return;
    }

    // --- SECURITY: Filter sensitive cookies ---
    const safeCookies = filterSensitiveCookies(cookies);

    // --- TRACK DOWNLOAD ---
    const cleanName = extensionSettings.smartNaming ? getSmartFileName(filename, url, isYoutube) : filename;
    const downloadEntry = trackDownload(url, cleanName, DOWNLOAD_STATUS.PENDING);

    try {
        const safePort = createSafePort(FDM_HOST);
        if (!safePort) {
            // Fallback to browser download if connection failed
            browser.downloads.download({ url: url });
            updateDownloadStatus(downloadEntry.id, DOWNLOAD_STATUS.FALLBACK);
            notifyUser('FDM: FDM non disponible, telechargement via navigateur.', 'warning');
            return;
        }

        // Send handshake
        safePort.postMessage({
            id: (nextTaskId++).toString(),
            type: "handshake",
            handshake: { api_version: "1", browser: "Firefox" }
        });

        // --- SMART NAMING (IDM STYLE) ---
        let downloadObj = {
            url: url,
            filename: cleanName,
            fileName: cleanName,
            suggestedName: cleanName,
            name: cleanName,
            comment: cleanName, // FDM reads this for title sometimes
            httpReferer: referer,
            httpCookies: safeCookies, // Use filtered cookies
            userAgent: navigator.userAgent,
            originalUrl: url
        };

        // Permet a FDM de fusionner Audio/Video sur les plateformes connues
        if (isYoutube || url.includes(".m3u8")) {
            downloadObj.youtubeChannelVideosDownload = 0;
            downloadObj.videoUrl = url;
            downloadObj.audioUrl = ""; // Force l'utilisation du parser interne pour fusion audio/video
        }

        // On utilise TOUJOURS le téléchargement direct (IDM style)
        safePort.postMessage({
            id: (nextTaskId++).toString(),
            type: "create_downloads",
            create_downloads: {
                downloads: [downloadObj]
            }
        });

        setTimeout(() => safePort.disconnect(), TIMING.NATIVE_PORT_DISCONNECT_MS);

        // --- UPDATE STATUS & NOTIFICATION ---
        updateDownloadStatus(downloadEntry.id, DOWNLOAD_STATUS.SENT);
        notifyUser('FDM: Telechargement envoye avec succes.', 'success');

    } catch (e) {
        console.error('FDM sendToFDM error:', e);
        updateDownloadStatus(downloadEntry.id, DOWNLOAD_STATUS.FAILED);
        browser.downloads.download({ url: url });
        notifyUser('FDM: Erreur, telechargement via navigateur.', 'warning');
    }
}

async function sendBatchToFDM(batchItems) {
    // --- SECURITY: Validate all URLs before sending ---
    const validItems = batchItems.filter(item => {
        if (!isValidDownloadUrl(item.url)) {
            console.warn('FDM Batch: Blocked invalid URL:', item.url);
            return false;
        }
        return true;
    });

    if (validItems.length === 0) {
        notifyUser('FDM: Aucun URL valide a telecharger.', 'error');
        return;
    }

    // --- TRACK BATCH DOWNLOAD ---
    const batchIds = validItems.map(item => {
        const cleanName = extensionSettings.smartNaming ? getSmartFileName(item.filename || item.title || "Stream_Catcher_Item", item.url, false) : (item.filename || item.title);
        return trackDownload(item.url, cleanName, DOWNLOAD_STATUS.PENDING).id;
    });

    try {
        const safePort = createSafePort(FDM_HOST);
        if (!safePort) {
            // Fallback for each item
            validItems.forEach(item => browser.downloads.download({ url: item.url }));
            batchIds.forEach(id => updateDownloadStatus(id, DOWNLOAD_STATUS.FALLBACK));
            notifyUser('FDM: FDM non disponible, telechargement via navigateur.', 'warning');
            return;
        }

        // Send handshake
        safePort.postMessage({
            id: (nextTaskId++).toString(),
            type: "handshake",
            handshake: { api_version: "1", browser: "Firefox" }
        });

        let downloadObjs = validItems.map(item => {
            let nameFromItem = item.filename || item.title || "Stream_Catcher_Item";
            let cleanName = extensionSettings.smartNaming ? getSmartFileName(nameFromItem, item.url, false) : nameFromItem;
            // --- SECURITY: Filter sensitive cookies for each item ---
            const safeItemCookies = filterSensitiveCookies(item.cookies || '');

            return {
                url: item.url,
                filename: cleanName,
                fileName: cleanName,
                suggestedName: cleanName,
                name: cleanName,
                comment: cleanName,
                httpReferer: item.referer || item.url,
                httpCookies: safeItemCookies, // Use filtered cookies
                userAgent: navigator.userAgent,
                originalUrl: item.url
            };
        });

        if (downloadObjs.length > 0) {
            safePort.postMessage({
                id: (nextTaskId++).toString(),
                type: "create_downloads",
                create_downloads: {
                    downloads: downloadObjs
                }
            });
        }

        setTimeout(() => safePort.disconnect(), TIMING.NATIVE_PORT_DISCONNECT_MS);

        // --- UPDATE STATUS & SUCCESS NOTIFICATION ---
        batchIds.forEach(id => updateDownloadStatus(id, DOWNLOAD_STATUS.SENT));
        notifyUser(`FDM: ${downloadObjs.length} fichier(s) envoye(s) avec succes.`, 'success');

    } catch (e) {
        console.error('FDM sendBatchToFDM error:', e);
        // Fallback for each
        validItems.forEach(item => browser.downloads.download({ url: item.url }));
        batchIds.forEach(id => updateDownloadStatus(id, DOWNLOAD_STATUS.FAILED));
        notifyUser('FDM: Erreur batch, telechargement via navigateur.', 'warning');
    }
}

browser.webRequest.onResponseStarted.addListener(
    async (details) => {
        await hydrate();
        const { url, tabId, frameId, responseHeaders } = details;
        if (tabId < 0) return;

        let detectedType = null;
        const lowerUrl = url.toLowerCase().split('?')[0];

        // 1. Check par extension
        for (const [group, exts] of Object.entries(DETECTION_RULES.extensions)) {
            if (exts.some(ext => lowerUrl.endsWith(ext))) {
                detectedType = group;
                break;
            }
        }

        // 2. Check par Content-Type
        if (!detectedType && responseHeaders) {
            const ctHeader = responseHeaders.find(h => h.name.toLowerCase() === 'content-type');
            if (ctHeader) {
                const ct = ctHeader.value.toLowerCase();
                for (const [mime, group] of Object.entries(DETECTION_RULES.contentTypes)) {
                    if (ct.includes(mime)) {
                        detectedType = group;
                        break;
                    }
                }
            }
        }

        if (detectedType) {
            // Check settings: Disable subtitles if requested
            if (detectedType === 'subtitles' && !extensionSettings.detectSubtitles) {
                return;
            }

            // Check settings: Anti-Noise Minimum Size filter
            if (extensionSettings.minSizeEnabled && (detectedType === 'videos' || detectedType === 'segments')) {
                const clHeader = responseHeaders.find(h => h.name.toLowerCase() === 'content-length');
                if (clHeader) {
                    const sizeBytes = parseInt(clHeader.value, 10);
                    const minBytes = extensionSettings.minSizeMB * 1024 * 1024;
                    if (!isNaN(sizeBytes) && sizeBytes < minBytes) {
                        return; // Ignore file that is too small
                    }
                } else if (detectedType === 'segments') {
                    // Small segments without Content-Length often are noise unless part of a big m3u8...
                    // Let's keep them if no content-length since we can't be sure, or ignore? We keep.
                }
            }
            if (!tabStreams[tabId]) tabStreams[tabId] = [];

            // Purge proactive des iframes morts AVANT d'ajouter le nouveau flux
            browser.webNavigation.getAllFrames({ tabId: tabId }).then(frames => {
                if (tabStreams[tabId] && frames) {
                    const aliveFrameIds = frames.map(f => f.frameId);
                    tabStreams[tabId] = tabStreams[tabId].filter(s =>
                        aliveFrameIds.includes(s.frameId) || s.type === 'youtube' || typeof s.frameId === 'undefined'
                    );
                    persist();
                }

                if (!tabStreams[tabId].some(s => s.url === url)) {
                    const streamEntry = {
                        url: url,
                        title: "Vidéo détectée",
                        type: detectedType,
                        timestamp: Date.now(),
                        frameId: frameId,
                        pageUrl: details.documentUrl || details.originUrl || url
                    };

                    tabStreams[tabId].push(streamEntry);
                    addToCatchLog(streamEntry);
                    persist();

                    browser.tabs.get(tabId).then(tab => {
                        const s = tabStreams[tabId].find(x => x.url === url);
                        if (s) {
                            s.title = tab.title || "Vidéo détectée";

                            // On tente de récupérer la véritable URL de l'iFrame !
                            if (frameId > 0) {
                                browser.webNavigation.getFrame({ tabId: tabId, frameId: frameId }).then(frame => {
                                    if (frame && frame.url && frame.url !== "about:blank") {
                                        s.pageUrl = frame.url;
                                        persist();
                                    }
                                }).catch(() => { });
                            } else if (!s.pageUrl || s.pageUrl === url) {
                                s.pageUrl = tab.url || "";
                            }
                            persist();
                        }
                    }).catch(() => { });

                    const count = tabStreams[tabId].filter(s => s.type !== 'youtube').length;
                    browser.action.setBadgeText({
                        text: count > 0 ? count.toString() : "",
                        tabId: tabId
                    });
                    browser.action.setBadgeBackgroundColor({ color: UI.BADGE_COLOR, tabId: tabId });
                }
            }).catch(() => {
                // Fallback sécurité si l'onglet ferme entre temps
                if (tabStreams[tabId] && !tabStreams[tabId].some(s => s.url === url)) {
                    const se = {
                        url: url,
                        title: "Vidéo détectée",
                        type: detectedType,
                        timestamp: Date.now(),
                        frameId: frameId
                    };
                    tabStreams[tabId].push(se);
                    addToCatchLog(se);
                    persist();
                }
            });
        }
    },
    { urls: ["<all_urls>"] },
    ["responseHeaders"]
);

browser.webNavigation.onBeforeNavigate.addListener(async (details) => {
    await hydrate();
    if (!tabStreams[details.tabId]) return;

    if (details.frameId === 0) {
        // Navigation de la page principale : on vide tout
        tabStreams[details.tabId] = [];
    } else {
        // Navigation d'un sous-lecteur (iframe) : on enlève unqiuement les flux de cet ancien lecteur
        tabStreams[details.tabId] = tabStreams[details.tabId].filter(s => s.frameId !== details.frameId && typeof s.frameId !== 'undefined');
    }
    persist();

    const count = tabStreams[details.tabId].length;
    browser.action.setBadgeText({
        text: count > 0 ? count.toString() : "",
        tabId: details.tabId
    });
});

browser.webNavigation.onHistoryStateUpdated.addListener(async (details) => {
    // Handling SPA (Single Page Application) navigation
    await hydrate();
    if (details.frameId === 0 && tabStreams[details.tabId]) {
        tabStreams[details.tabId] = [];
        persist();
        browser.action.setBadgeText({ text: "", tabId: details.tabId });
    }
});

browser.tabs.onRemoved.addListener(async (tabId) => {
    await hydrate();
    delete tabStreams[tabId];
    persist();
});

// --- COOKIE MANAGEMENT (DRY) ---
async function getCookiesForUrls(urls) {
    const cookieMap = new Map();

    for (const url of urls) {
        if (!url) continue;
        try {
            // Standard cookies
            const cookies1 = await browser.cookies.getAll({ url: url });
            cookies1.forEach(c => cookieMap.set(c.name, c.value));
        } catch (e) {
            // Silently ignore - some URLs may not have cookies
        }
        try {
            // Partitioned cookies (CHIPS)
            const cookies2 = await browser.cookies.getAll({ url: url, partitionKey: {} });
            cookies2.forEach(c => cookieMap.set(c.name, c.value));
        } catch (e) {
            // Silently ignore - partitioned cookies may not be supported
        }
    }

    return Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
}

// --- YOUTUBE URL CLEANER ---
function cleanYouTubeUrl(url) {
    try {
        const u = new URL(url);
        const v = u.searchParams.get('v');
        if (v) {
            return "https://www.youtube.com/watch?v=" + v;
        } else if (u.hostname === 'youtu.be') {
            return "https://www.youtube.com/watch?v=" + u.pathname.substring(1);
        }
        return url; // Return original if parsing fails
    } catch (e) {
        return url; // Return original on error
    }
}

// --- MESSAGE HANDLERS ---
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "GET_STREAMS") {
        (async () => {
            await hydrate();
            const targetTabId = message.tabId || (sender && sender.tab ? sender.tab.id : null);
            if (!targetTabId) {
                sendResponse([]);
                return;
            }

            // Nettoyage magique des iframes morts pour éviter l'accumulation !
            try {
                const frames = await browser.webNavigation.getAllFrames({ tabId: targetTabId });
                if (tabStreams[targetTabId] && frames) {
                    const aliveFrameIds = frames.map(f => f.frameId);

                    // On garde les flux si l'iframe existe toujours, ou si c'est YT, ou s'il n'a pas de frameId
                    tabStreams[targetTabId] = tabStreams[targetTabId].filter(s =>
                        aliveFrameIds.includes(s.frameId) || s.type === 'youtube' || typeof s.frameId === 'undefined'
                    );
                    persist();

                    const count = tabStreams[targetTabId].filter(s => s.type !== 'youtube').length;
                    browser.action.setBadgeText({ text: count > 0 ? count.toString() : "", tabId: targetTabId });
                }
            } catch (e) {
                // ignore
            }

            let streams = [...(tabStreams[targetTabId] || [])];

            // Auto-inject YouTube stream if on YouTube
            const tabUrl = message.tabUrl || (sender && sender.tab ? sender.tab.url : "");
            const tabTitle = message.tabTitle || (sender && sender.tab ? sender.tab.title : "YouTube Video");

            if (tabUrl && (tabUrl.includes("youtube.com/watch") || tabUrl.includes("youtu.be/"))) {
                if (!streams.some(s => s.type === 'youtube')) {
                    streams.unshift({
                        url: tabUrl,
                        title: tabTitle,
                        type: 'youtube',
                        pageUrl: tabUrl
                    });
                }
            }
            sendResponse(streams);
        })();

        return true; // Indicates async response
    } else if (message.type === "GET_SETTINGS") {
        (async () => {
            await hydrate();
            sendResponse(extensionSettings);
        })();
        return true;
    } else if (message.type === "ADD_HIDDEN_STREAM") {
        (async () => {
            await hydrate();
            const tabId = sender.tab ? sender.tab.id : null;
            if (!tabId) return;

            if (!tabStreams[tabId]) tabStreams[tabId] = [];

            if (!tabStreams[tabId].some(s => s.url === message.url)) {
                const streamEntry = {
                    url: message.url,
                    title: sender.tab.title || "Vidéo cachée",
                    type: message.streamType || 'videos',
                    timestamp: Date.now(),
                    pageUrl: message.pageUrl || sender.url || sender.tab.url || ""
                };
                tabStreams[tabId].push(streamEntry);
                addToCatchLog(streamEntry);
                persist();

                const count = tabStreams[tabId].filter(s => s.type !== 'youtube').length;
                browser.action.setBadgeText({
                    text: count > 0 ? count.toString() : "",
                    tabId: tabId
                });
                browser.action.setBadgeBackgroundColor({ color: UI.BADGE_COLOR, tabId: tabId });
            }
        })();
    } else if (message.type === "SEND_TO_FDM") {
        (async () => {
            let finalReferer = message.referer || message.url;
            let finalUrl = message.url;
            let cookieStr = "";

            if (!message.isYoutube) {
                // Use centralized cookie logic (DRY)
                cookieStr = await getCookiesForUrls([finalReferer, finalUrl]);
            } else {
                finalReferer = YOUTUBE_FIX.CLEAR_REFERER; // Fix 413 error on YouTube
                finalUrl = cleanYouTubeUrl(message.url);
            }
            sendToFDM(finalUrl, message.filename, finalReferer, cookieStr, message.isYoutube);
        })();
    } else if (message.type === "DOWNLOAD_DIRECT") {
        (async () => {
            await hydrate();
            const tabId = sender.tab.id;
            const referer = sender.tab.url;
            let targetUrl = message.url;
            let filename = "video";
            let isYoutube = referer && (referer.includes("youtube.com/watch") || referer.includes("youtu.be/"));
            let streams = tabStreams[tabId] || [];

            // If we have detected streams, pick the best one
            if (streams.length > 0) {
                const bestStream =
                    streams.find(s => s.type === 'youtube') ||
                    streams.find(s => s.type === 'manifests') ||
                    streams.find(s => s.type === 'videos') ||
                    streams.find(s => s.type === 'segments') ||
                    streams[0];
                targetUrl = bestStream.url;
                filename = bestStream.title || "video";
                isYoutube = isYoutube || (bestStream.type === 'youtube');
            }

            if (!targetUrl) {
                if (isYoutube) targetUrl = referer;
                else return; // Nothing to download
            }

            let cookieStr = "";
            let finalReferer = referer;

            if (!isYoutube) {
                // Use extracted cookie logic (DRY)
                cookieStr = await getCookiesForUrls([referer, targetUrl]);
            } else {
                finalReferer = YOUTUBE_FIX.CLEAR_REFERER; // Fix 413 error on YouTube
                targetUrl = cleanYouTubeUrl(targetUrl);
            }

            sendToFDM(targetUrl, filename, finalReferer, cookieStr, isYoutube);
        })();
    } else if (message.type === "DOWNLOAD_BATCH") {
        (async () => {
            const batchItems = message.items || [];
            if (batchItems.length > 0) {
                sendBatchToFDM(batchItems);
            }
        })();
    } else if (message.type === "GET_CATCH_LOG") {
        (async () => {
            await hydrate();
            sendResponse(catchLog);
        })();
        return true;
    } else if (message.type === "CLEAR_CATCH_LOG") {
        catchLog = [];
        persist();
        sendResponse({ success: true });
    } else if (message.type === "GET_DOWNLOAD_HISTORY") {
        (async () => {
            sendResponse(downloadHistory);
        })();
        return true;
    } else if (message.type === "GET_DOWNLOAD_STATS") {
        (async () => {
            const totalDownloads = downloadHistory.length;
            const sentToFdm = downloadHistory.filter(d => d.status === DOWNLOAD_STATUS.SENT).length;
            const fallbackBrowser = downloadHistory.filter(d => d.status === DOWNLOAD_STATUS.FALLBACK).length;
            const failed = downloadHistory.filter(d => d.status === DOWNLOAD_STATUS.FAILED).length;

            // Stats by type
            const byType = {};
            downloadHistory.forEach(d => {
                const ext = d.filename.split('.').pop()?.toLowerCase() || 'unknown';
                byType[ext] = (byType[ext] || 0) + 1;
            });

            sendResponse({
                total: totalDownloads,
                sentToFdm: sentToFdm,
                fallbackBrowser: fallbackBrowser,
                failed: failed,
                byType: byType,
                lastDownload: downloadHistory.length > 0 ? downloadHistory[0].timestamp : null
            });
        })();
        return true;
    } else if (message.type === "CLEAR_DOWNLOAD_HISTORY") {
        downloadHistory = [];
        browser.storage.local.set({ downloadHistory: [] }).catch(() => {});
        sendResponse({ success: true });
    }
    return true;
});
