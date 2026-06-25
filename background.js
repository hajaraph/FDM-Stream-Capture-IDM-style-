/**
 * FDM Helper - Background Script (ESM)
 * Handles stream detection, download management, and native messaging.
 */

import api, { BROWSER_ENV } from './browser-compat.js';
import { TIMING, LIMITS, UI, MAX_CATCH_LOG, MAX_DOWNLOAD_HISTORY, YOUTUBE_FIX } from './constants.js';
import { DETECTION_RULES, DETECTION_PATTERNS } from './config.js';
import { 
    isValidDownloadUrl, 
    filterSensitiveCookies, 
    getCookiesForUrls, 
    cleanYouTubeUrl, 
    notifyUser, 
    createSafePort, 
    getStreamPriority 
} from './utils.js';

// FDM Native Messaging Bridge
const FDM_HOST = 'org.freedownloadmanager.fdm5.cnh';
let nextTaskId = 1;

// --- STATE MANAGEMENT (Dual-Storage Strategy) ---
const AppState = {
    async get(keys, area = 'local') {
        const storage = api.storage[area] || api.storage.local;
        return new Promise((resolve) => {
            storage.get(keys || null, (data) => resolve(data || {}));
        });
    },
    async set(items, area = 'local') {
        const storage = api.storage[area] || api.storage.local;
        return new Promise((resolve) => {
            storage.set(items, () => resolve());
        });
    }
};

// Stream tracking state
let tabStreams = {};
let catchLog = [];
let isHydrated = false;
let hydratePromise = null;

// Feature 5 — URLs already sent this session (anti-duplicate)
const sentUrls = new Set();

// --- DOWNLOAD TRACKING ---
let downloadQueue = []; 
let downloadHistory = []; 

const DOWNLOAD_STATUS = {
    PENDING: 'pending',
    SENT: 'sent_to_fdm',
    FALLBACK: 'fallback_browser',
    COMPLETED: 'completed',
    FAILED: 'failed'
};

async function trackDownload(url, filename, status = DOWNLOAD_STATUS.SENT) {
    const data = await AppState.get(['downloadHistory'], 'local');
    const history = data.downloadHistory || [];
    
    const entry = {
        id: Date.now(),
        url: url,
        filename: filename,
        status: status,
        timestamp: new Date().toISOString(),
        tabId: null
    };

    downloadQueue.push(entry);
    history.unshift(entry);

    const trimmedHistory = history.slice(0, MAX_DOWNLOAD_HISTORY);
    await AppState.set({ downloadHistory: trimmedHistory }, 'local');
    downloadHistory = trimmedHistory;

    return entry;
}

async function updateDownloadStatus(id, newStatus) {
    const data = await AppState.get(['downloadHistory'], 'local');
    const history = data.downloadHistory || [];
    
    const entry = history.find(e => e.id === id);
    if (entry) {
        entry.status = newStatus;
        await AppState.set({ downloadHistory: history }, 'local');
        downloadHistory = history;
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
        const localPromise = AppState.get(['extensionSettings', 'catchLog', 'downloadHistory'], 'local');
        const sessionPromise = AppState.get(['tabStreams'], 'session');

        hydratePromise = Promise.all([localPromise, sessionPromise]).then(([localData, sessionData]) => {
            if (sessionData.tabStreams) tabStreams = sessionData.tabStreams;
            if (localData.catchLog) catchLog = localData.catchLog;
            if (localData.extensionSettings) extensionSettings = { ...extensionSettings, ...localData.extensionSettings };
            if (localData.downloadHistory) downloadHistory = localData.downloadHistory;
            isHydrated = true;
        });
    }
    await hydratePromise;
}

api.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.extensionSettings) {
        extensionSettings = { ...extensionSettings, ...changes.extensionSettings.newValue };
    }
});

function broadcastUpdate(tabId = -1) {
    api.runtime.sendMessage({ type: 'STREAMS_UPDATED', tabId: tabId }).catch(() => {});
}

let persistTimeoutLocal = null;
let persistTimeoutSession = null;

function persist(tabId = -1) {
    if (persistTimeoutSession) clearTimeout(persistTimeoutSession);
    persistTimeoutSession = setTimeout(async () => {
        await AppState.set({ tabStreams }, 'session');
        persistTimeoutSession = null;
        broadcastUpdate(tabId);
    }, TIMING.PERSIST_DEBOUNCE_MS);

    if (persistTimeoutLocal) clearTimeout(persistTimeoutLocal);
    persistTimeoutLocal = setTimeout(async () => {
        await AppState.set({ catchLog }, 'local');
        persistTimeoutLocal = null;
    }, TIMING.PERSIST_DEBOUNCE_MS * 2);
}

// Force immediate persist
async function persistNow() {
    if (persistTimeoutLocal) clearTimeout(persistTimeoutLocal);
    if (persistTimeoutSession) clearTimeout(persistTimeoutSession);
    persistTimeoutLocal = null;
    persistTimeoutSession = null;
    
    await Promise.all([
        AppState.set({ tabStreams }, 'session'),
        AppState.set({ catchLog }, 'local')
    ]);
}

function getSmartFileName(rawTitle, url, isYoutube = false) {
    if (!rawTitle || rawTitle === "Vidéo détectée" || rawTitle === "Vidéo cachée") {
        try {
            const urlPath = new URL(url).pathname;
            const fileName = urlPath.substring(urlPath.lastIndexOf('/') + 1);
            if (fileName && fileName.includes('.') && fileName.length > 5) {
                rawTitle = fileName.split('.')[0];
            }
        } catch (e) {}
    }

    let name = rawTitle || "Media_Stream";

    const siteSeparators = [" - ", " | ", " — ", " : ", " » ", " « ", " // "];
    for (const sep of siteSeparators) {
        if (name.includes(sep)) {
            const parts = name.split(sep);
            name = parts.reduce((a, b) => a.length > b.length ? a : b);
        }
    }

    const junkPatterns = [
        /watch\s+/gi, /\s+online/gi, /\s+streaming/gi, /\s+free/gi, 
        /full\s+episode/gi, /official\s+video/gi, /official\s+trailer/gi,
        /\s+hd/gi, /\s+1080p/gi, /\s+720p/gi, /\s+4k/gi, /\[.*?\]/g, /\(.*?\)/g,
        /direct\s+download/gi, /vf/gi, /vostfr/gi, /sub\s+it/gi, /x264/gi, /x265/gi, /h264/gi, /bluray/gi
    ];
    
    junkPatterns.forEach(regex => {
        name = name.replace(regex, "");
    });

    name = name.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();
    
    if (!name || name.length < 3) {
        name = "FDM_Download_" + Math.random().toString(36).substring(2, 7);
    }

    let ext = "mp4"; 
    const extensions = ["mp4", "mkv", "avi", "webm", "m3u8", "ts", "mp3", "flac", "wav", "pdf", "zip"];
    const lowerUrl = url.toLowerCase();
    
    for (const e of extensions) {
        if (lowerUrl.includes("." + e)) {
            ext = e;
            break;
        }
    }
    
    if (isYoutube) ext = "mp4";

    if (!name.toLowerCase().endsWith('.' + ext)) {
        name += '.' + ext;
    }

    return name;
}

const TRACKING_PARAMS = [
    'utm_source','utm_medium','utm_campaign','utm_term','utm_content',
    'fbclid','gclid','msclkid','ref','_t','tracking_id','trk','source',
    'mc_cid','mc_eid','igshid','si','pp'
];

function cleanStreamUrl(url) {
    try {
        const u = new URL(url);
        // Preserve all params for HLS/DASH — removing them can break token auth
        if (u.pathname.match(/\.(m3u8|mpd|ts|m4s)$/i)) return url;
        TRACKING_PARAMS.forEach(p => u.searchParams.delete(p));
        return u.toString();
    } catch { return url; }
}

function parseM3U8(text, baseUrl) {
    const lines = text.split('\n');
    const variants = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line.startsWith('#EXT-X-STREAM-INF:')) continue;
        const attrs = line.slice('#EXT-X-STREAM-INF:'.length);
        const bwMatch  = attrs.match(/BANDWIDTH=(\d+)/);
        const resMatch = attrs.match(/RESOLUTION=([0-9]+x[0-9]+)/);
        const nextLine = (lines[i + 1] || '').trim();
        if (!nextLine || nextLine.startsWith('#')) continue;
        let varUrl;
        try { varUrl = nextLine.startsWith('http') ? nextLine : new URL(nextLine, baseUrl).href; }
        catch { continue; }
        variants.push({
            bandwidth:  bwMatch  ? parseInt(bwMatch[1],  10) : 0,
            resolution: resMatch ? resMatch[1] : '',
            url: varUrl
        });
    }
    return variants.sort((a, b) => b.bandwidth - a.bandwidth);
}

function addToCatchLog(entry) {
    if (!catchLog.some(s => s.url === entry.url)) {
        catchLog.unshift(entry);
        if (catchLog.length > MAX_CATCH_LOG) catchLog.pop();
        persist();
    }
}

async function sendToFDM(url, filename = "", referer = "", cookies = "", isYoutube = false) {
    if (!isValidDownloadUrl(url)) {
        console.error('FDM: Blocked invalid URL:', url);
        notifyUser('FDM: URL invalide ou non securise bloque.', 'error');
        return;
    }
    if (sentUrls.has(url)) {
        notifyUser('FDM: Ce fichier a déjà été envoyé à FDM cette session.', 'warning');
        return;
    }
    sentUrls.add(url);

    const safeCookies = filterSensitiveCookies(cookies);
    const cleanName = extensionSettings.smartNaming ? getSmartFileName(filename, url, isYoutube) : filename;
    const downloadEntry = await trackDownload(url, cleanName, DOWNLOAD_STATUS.PENDING);

    try {
        const safePort = createSafePort(FDM_HOST);
        if (!safePort) {
            const fdmTargetUrl = "fdm://" + url;
            api.tabs.create({ url: fdmTargetUrl, active: false }, (tab) => {
                setTimeout(() => { if (tab && tab.id) api.tabs.remove(tab.id); }, 3000);
            });
            updateDownloadStatus(downloadEntry.id, DOWNLOAD_STATUS.FALLBACK);
            notifyUser('FDM lancé via protocole fdm:// (Sans linker NativeMessaging)', 'warning');
            return;
        }

        safePort.postMessage({
            id: (nextTaskId++).toString(),
            type: "handshake",
            handshake: { api_version: "1", browser: "Browser" }
        });

        let downloadObj = {
            url: url,
            filename: cleanName,
            httpReferer: referer,
            httpCookies: safeCookies,
            userAgent: navigator.userAgent
        };

        if (isYoutube || url.includes(".m3u8") || url.includes(".mpd")) {
            downloadObj.youtubeChannelVideosDownload = 0;
            downloadObj.videoUrl = url;
            downloadObj.audioUrl = ""; 
        }

        safePort.postMessage({
            id: (nextTaskId++).toString(),
            type: "create_downloads",
            create_downloads: {
                downloads: [downloadObj]
            }
        });

        setTimeout(() => safePort.disconnect(), TIMING.NATIVE_PORT_DISCONNECT_MS);
        updateDownloadStatus(downloadEntry.id, DOWNLOAD_STATUS.SENT);

    } catch (e) {
        console.error('FDM sendToFDM error:', e);
        updateDownloadStatus(downloadEntry.id, DOWNLOAD_STATUS.FAILED);
        api.downloads.download({ url: url });
        notifyUser('FDM: Erreur, telechargement via navigateur.', 'warning');
    }
}

async function sendBatchToFDM(batchItems) {
    const validItems = batchItems.filter(item => isValidDownloadUrl(item.url) && !sentUrls.has(item.url));
    validItems.forEach(item => sentUrls.add(item.url));

    if (validItems.length === 0) {
        notifyUser('FDM: Aucun URL valide a telecharger.', 'error');
        return;
    }

    const batchIds = await Promise.all(validItems.map(item => {
        const cleanName = extensionSettings.smartNaming ? getSmartFileName(item.filename || item.title || "Stream_Catcher_Item", item.url, false) : (item.filename || item.title);
        return trackDownload(item.url, cleanName, DOWNLOAD_STATUS.PENDING).then(e => e.id);
    }));

    try {
        const safePort = createSafePort(FDM_HOST);
        if (!safePort) {
            validItems.forEach(item => api.downloads.download({ url: item.url }));
            batchIds.forEach(id => updateDownloadStatus(id, DOWNLOAD_STATUS.FALLBACK));
            notifyUser('FDM: FDM non disponible, telechargement via navigateur.', 'warning');
            return;
        }

        safePort.postMessage({
            id: (nextTaskId++).toString(),
            type: "handshake",
            handshake: { api_version: "1", browser: "Browser" }
        });

        let downloadObjs = validItems.map(item => {
            let nameFromItem = item.filename || item.title || "Stream_Catcher_Item";
            let cleanName = extensionSettings.smartNaming ? getSmartFileName(nameFromItem, item.url, false) : nameFromItem;
            const safeItemCookies = filterSensitiveCookies(item.cookies || '');

            return {
                url: item.url,
                filename: cleanName,
                fileName: cleanName,
                suggestedName: cleanName,
                name: cleanName,
                comment: cleanName,
                httpReferer: item.referer || item.url,
                httpCookies: safeItemCookies,
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
        batchIds.forEach(id => updateDownloadStatus(id, DOWNLOAD_STATUS.SENT));
        notifyUser(`FDM: ${downloadObjs.length} fichier(s) envoye(s) avec succes.`, 'success');

    } catch (e) {
        console.error('FDM sendBatchToFDM error:', e);
        validItems.forEach(item => api.downloads.download({ url: item.url }));
        batchIds.forEach(id => updateDownloadStatus(id, DOWNLOAD_STATUS.FAILED));
        notifyUser('FDM: Erreur batch, telechargement via navigateur.', 'warning');
    }
}

api.webRequest.onResponseStarted.addListener(
    async (details) => {
        await hydrate();
        const { url, tabId, frameId, responseHeaders } = details;
        if (tabId < 0) return;

        let detectedType = null;
        const lowerUrl = url.toLowerCase().split('?')[0];

        for (const [group, exts] of Object.entries(DETECTION_RULES.extensions)) {
            if (exts.some(ext => lowerUrl.endsWith(ext))) {
                detectedType = group;
                break;
            }
        }

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
            if (detectedType === 'subtitles' && !extensionSettings.detectSubtitles) return;

            if (extensionSettings.minSizeEnabled && (detectedType === 'videos' || detectedType === 'segments')) {
                const clHeader = responseHeaders.find(h => h.name.toLowerCase() === 'content-length');
                if (clHeader) {
                    const sizeBytes = parseInt(clHeader.value, 10);
                    const minBytes = extensionSettings.minSizeMB * 1024 * 1024;
                    if (!isNaN(sizeBytes) && sizeBytes < minBytes) return;
                }
            }
            
            if (!tabStreams[tabId]) tabStreams[tabId] = [];

            api.webNavigation.getAllFrames({ tabId: tabId }).then(frames => {
                if (tabStreams[tabId] && frames) {
                    const aliveFrameIds = frames.map(f => f.frameId);
                    tabStreams[tabId] = tabStreams[tabId].filter(s =>
                        aliveFrameIds.includes(s.frameId) || s.type === 'youtube' || typeof s.frameId === 'undefined'
                    );
                }

                const cleanUrl = cleanStreamUrl(url);
                if (!tabStreams[tabId].some(s => s.url === cleanUrl)) {
                    const clHeader = responseHeaders ? responseHeaders.find(h => h.name.toLowerCase() === 'content-length') : null;
                    const sizeBytes = clHeader ? parseInt(clHeader.value, 10) : null;
                    const streamEntry = {
                        url: cleanUrl,
                        title: "Vidéo détectée",
                        type: detectedType,
                        timestamp: Date.now(),
                        frameId: frameId,
                        pageUrl: details.documentUrl || details.originUrl || cleanUrl,
                        size: (sizeBytes && !isNaN(sizeBytes) && sizeBytes > 0) ? sizeBytes : null
                    };

                    tabStreams[tabId].push(streamEntry);
                    addToCatchLog(streamEntry);
                    persist(tabId);

                    api.tabs.get(tabId).then(tab => {
                        const s = tabStreams[tabId].find(x => x.url === url);
                        if (s) {
                            s.title = tab.title || "Vidéo détectée";
                            if (frameId > 0) {
                                api.webNavigation.getFrame({ tabId: tabId, frameId: frameId }).then(frame => {
                                    if (frame && frame.url && frame.url !== "about:blank") {
                                        s.pageUrl = frame.url;
                                        persist(tabId);
                                    }
                                }).catch(() => { });
                            } else if (!s.pageUrl || s.pageUrl === url) {
                                s.pageUrl = tab.url || "";
                            }
                            persist(tabId);
                        }
                    }).catch(() => { });

                    const count = tabStreams[tabId].filter(s => s.type !== 'youtube').length;
                    api.action.setBadgeText({ text: count > 0 ? count.toString() : "", tabId: tabId });
                    api.action.setBadgeBackgroundColor({ color: UI.BADGE_COLOR, tabId: tabId });
                }
            }).catch(() => {});
        }
    },
    { urls: ["<all_urls>"] },
    ["responseHeaders"]
);

api.webNavigation.onBeforeNavigate.addListener(async (details) => {
    await hydrate();
    if (!tabStreams[details.tabId]) return;
    if (details.frameId === 0) {
        tabStreams[details.tabId] = [];
    } else {
        tabStreams[details.tabId] = tabStreams[details.tabId].filter(s => s.frameId !== details.frameId && typeof s.frameId !== 'undefined');
    }
    persist(details.tabId);
    api.action.setBadgeText({ text: "", tabId: details.tabId });
});

api.webNavigation.onHistoryStateUpdated.addListener(async (details) => {
    await hydrate();
    if (details.frameId === 0 && tabStreams[details.tabId]) {
        tabStreams[details.tabId] = [];
        persist(details.tabId);
        api.action.setBadgeText({ text: "", tabId: details.tabId });
    }
});

api.tabs.onRemoved.addListener(async (tabId) => {
    await hydrate();
    delete tabStreams[tabId];
    persist();
});

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "GET_STREAMS") {
        (async () => {
            await hydrate();
            const targetTabId = message.tabId || (sender && sender.tab ? sender.tab.id : null);
            if (!targetTabId) {
                sendResponse([]);
                return;
            }

            try {
                const frames = await api.webNavigation.getAllFrames({ tabId: targetTabId });
                if (tabStreams[targetTabId] && frames) {
                    const aliveFrameIds = frames.map(f => f.frameId);
                    tabStreams[targetTabId] = tabStreams[targetTabId].filter(s =>
                        aliveFrameIds.includes(s.frameId) || s.type === 'youtube' || typeof s.frameId === 'undefined'
                    );
                    persist(targetTabId);
                }
            } catch (e) {}

            let rawStreams = [...(tabStreams[targetTabId] || [])];
            const tabUrl = message.tabUrl || (sender && sender.tab ? sender.tab.url : "");
            const tabTitle = message.tabTitle || (sender && sender.tab ? sender.tab.title : "YouTube Video");

            if (tabUrl && (tabUrl.includes("youtube.com/watch") || tabUrl.includes("youtu.be/"))) {
                if (!rawStreams.some(s => s.type === 'youtube')) {
                    rawStreams.unshift({
                        url: tabUrl,
                        title: tabTitle,
                        type: 'youtube',
                        pageUrl: tabUrl,
                        timestamp: Date.now()
                    });
                }
            }

            const uniqueMap = new Map();
            rawStreams.forEach(s => {
                const key = s.url;
                if (!uniqueMap.has(key) || s.timestamp > uniqueMap.get(key).timestamp) uniqueMap.set(key, s);
            });

            const streams = Array.from(uniqueMap.values());
            streams.sort((a, b) => getStreamPriority(b) - getStreamPriority(a));
            sendResponse(streams);
        })();
        return true;
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
                const entry = {
                    url: message.url,
                    title: sender.tab.title || "Vidéo cachée",
                    type: message.streamType || 'videos',
                    timestamp: Date.now(),
                    pageUrl: message.pageUrl || sender.url || sender.tab.url || ""
                };
                tabStreams[tabId].push(entry);
                addToCatchLog(entry);
                persist(tabId);
            }
        })();
    } else if (message.type === "SEND_TO_FDM") {
        (async () => {
            let senderUrl = sender.tab ? sender.tab.url : "";
            let finalReferer = message.referer || senderUrl || message.url;
            let finalUrl = message.url;
            let cookieStr = "";

            if (!message.isYoutube) cookieStr = await getCookiesForUrls([finalReferer, finalUrl]);
            else {
                finalReferer = YOUTUBE_FIX.CLEAR_REFERER;
                finalUrl = cleanYouTubeUrl(message.url);
            }
            sendToFDM(finalUrl, message.filename, finalReferer, cookieStr, message.isYoutube);
        })();
    } else if (message.type === "PARSE_HLS_MANIFEST") {
        (async () => {
            try {
                const resp = await fetch(message.url, {
                    headers: message.referer ? { 'Referer': message.referer } : {}
                });
                if (!resp.ok) { sendResponse({ variants: [] }); return; }
                const text = await resp.text();
                sendResponse({ variants: parseM3U8(text, message.url) });
            } catch (e) {
                sendResponse({ variants: [] });
            }
        })();
        return true;
    } else if (message.type === "SEND_BATCH_TO_FDM") {
        (async () => {
            await hydrate();
            await sendBatchToFDM(message.items || []);
            sendResponse({ success: true });
        })();
        return true;
    } else if (message.type === "CLEAR_CATCH_LOG") {
        catchLog = [];
        persist();
        sendResponse({ success: true });
    }
    return true;
});

api.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        api.tabs.create({ url: api.runtime.getURL('onboarding.html') });
    }
});