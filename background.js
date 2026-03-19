// FDM Native Messaging Bridge
const FDM_HOST = 'org.freedownloadmanager.fdm5.cnh';
let nextTaskId = 1;

// --- REGLES DE DETECTION ---
const DETECTION_RULES = {
    extensions: {
        manifests: ['.m3u8', '.mpd', '.f4m', '.m3u'],
        videos: ['.mp4', '.webm', '.mkv', '.avi', '.mov', '.flv'],
        segments: ['.ts', '.m4s', '.aac', '.m4a'],
        subtitles: ['.vtt', '.srt']
    },
    contentTypes: {
        'application/vnd.apple.mpegurl': 'manifests',
        'application/x-mpegurl': 'manifests',
        'application/dash+xml': 'manifests',
        'video/mp4': 'videos',
        'video/webm': 'videos',
        'video/mp2t': 'segments',
        'text/vtt': 'subtitles',
        'application/x-subrip': 'subtitles'
    }
};

let tabStreams = {};
let catchLog = [];
let isHydrated = false;
let hydratePromise = null;

let extensionSettings = {
    showButton: true,
    minSizeEnabled: true,
    minSizeMB: 1,
    detectSubtitles: true,
    scanHiddenStreams: true
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

function persist() {
    browser.storage.local.set({ tabStreams: tabStreams, catchLog: catchLog }).catch(() => { });
}

function addToCatchLog(entry) {
    if (!catchLog.some(s => s.url === entry.url)) {
        catchLog.unshift(entry);
        if (catchLog.length > 100) catchLog.pop();
        persist();
    }
}

async function sendToFDM(url, filename = "", referer = "", cookies = "", isYoutube = false) {
    try {
        const port = browser.runtime.connectNative(FDM_HOST);
        port.postMessage({
            id: (nextTaskId++).toString(),
            type: "handshake",
            handshake: { api_version: "1", browser: "Firefox" }
        });

        // --- SMART NAMING (IDM STYLE) ---
        let cleanName = filename.replace(/[\\/:*?"<>|]/g, "-").trim();
        if (!cleanName) cleanName = "Stream_Catcher_Video";

        let extMatch = url.match(/\.(mp4|mkv|avi|webm|m3u8|ts)(?:\?|$)/i);
        let ext = extMatch ? extMatch[1].toLowerCase() : "mp4";
        if (isYoutube) ext = "mp4";

        if (!cleanName.toLowerCase().endsWith('.' + ext)) {
            // Empêcher FDM de se tromper de format sur les m3u8
            if (url.includes('.m3u8') || url.includes('.m3u')) {
                cleanName += '.m3u8';
            } else {
                cleanName += '.' + ext;
            }
        }

        let downloadObj = {
            url: url,
            filename: cleanName,
            fileName: cleanName,
            suggestedName: cleanName,
            name: cleanName,
            comment: cleanName, // FDM reads this for title sometimes
            httpReferer: referer,
            httpCookies: cookies,
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
        port.postMessage({
            id: (nextTaskId++).toString(),
            type: "create_downloads",
            create_downloads: {
                downloads: [downloadObj]
            }
        });

        setTimeout(() => port.disconnect(), 1000);

    } catch (e) {
        browser.downloads.download({ url: url });
    }
}

async function sendBatchToFDM(batchItems) {
    try {
        const port = browser.runtime.connectNative(FDM_HOST);
        port.postMessage({
            id: (nextTaskId++).toString(),
            type: "handshake",
            handshake: { api_version: "1", browser: "Firefox" }
        });

        let downloadObjs = batchItems.map(item => {
            let nameFromItem = item.filename || item.title || "Stream_Catcher_Batch_Item";
            let cleanName = nameFromItem.replace(/[\\/:*?"<>|]/g, "-").trim();
            if (!cleanName) cleanName = "Stream_Catcher_Batch_Item";

            let extMatch = item.url.match(/\.(mp4|mkv|avi|webm|m3u8|ts|mp3|flac|wav|jpg|png|gif|pdf|zip|rar)(?:\?|$)/i);
            let ext = extMatch ? extMatch[1].toLowerCase() : "";

            if (ext && !cleanName.toLowerCase().endsWith('.' + ext)) {
                cleanName += '.' + ext;
            }

            return {
                url: item.url,
                filename: cleanName,
                fileName: cleanName,
                suggestedName: cleanName,
                name: cleanName,
                comment: cleanName,
                httpReferer: item.referer || item.url,
                userAgent: navigator.userAgent,
                originalUrl: item.url
            };
        });

        if (downloadObjs.length > 0) {
            port.postMessage({
                id: (nextTaskId++).toString(),
                type: "create_downloads",
                create_downloads: {
                    downloads: downloadObjs
                }
            });
        }

        setTimeout(() => port.disconnect(), 1000);

    } catch (e) {
        // Fallback for each
        batchItems.forEach(item => browser.downloads.download({ url: item.url }));
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
                    browser.action.setBadgeBackgroundColor({ color: "#FF0000", tabId: tabId });
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
                browser.action.setBadgeBackgroundColor({ color: "#FF0000", tabId: tabId });
            }
        })();
    } else if (message.type === "SEND_TO_FDM") {
        (async () => {
            let cookieStr = "";
            let finalReferer = message.referer || message.url;
            let finalUrl = message.url;

            if (!message.isYoutube) {
                try {
                    const cookieMap = new Map();
                    const getCookies = async (targetUrl) => {
                        if (!targetUrl) return;
                        try {
                            let c1 = await browser.cookies.getAll({ url: targetUrl });
                            c1.forEach(c => cookieMap.set(c.name, c.value));
                        } catch (e) { }
                        try {
                            let c2 = await browser.cookies.getAll({ url: targetUrl, partitionKey: {} });
                            c2.forEach(c => cookieMap.set(c.name, c.value));
                        } catch (e) { }
                    };

                    await getCookies(finalReferer);
                    await getCookies(finalUrl);

                    // Formater en "nom=valeur; nom2=valeur2"
                    cookieStr = Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
                } catch (err) {
                    console.error("Erreur lecture cookies:", err);
                }
            } else {
                finalReferer = ""; // Fix 413 error on YouTube
                // Nettoyer l'URL de YouTube (enlever les paramètres de tracking géants)
                try {
                    let u = new URL(message.url);
                    let v = u.searchParams.get('v');
                    if (v) {
                        finalUrl = "https://www.youtube.com/watch?v=" + v;
                    } else if (u.hostname === 'youtu.be') {
                        finalUrl = "https://www.youtube.com/watch?v=" + u.pathname.substring(1);
                    }
                } catch (e) { }
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
                // Priority: Youtube > Manifests > Videos > Segments > Others
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
                try {
                    const cookieMap = new Map();
                    if (referer) {
                        const pageCookies = await browser.cookies.getAll({ url: referer });
                        pageCookies.forEach(c => cookieMap.set(c.name, c.value));
                    }
                    const streamCookies = await browser.cookies.getAll({ url: targetUrl });
                    streamCookies.forEach(c => cookieMap.set(c.name, c.value));
                    cookieStr = Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
                } catch (err) { }
            } else {
                finalReferer = ""; // Fix 413 error on YouTube
                try {
                    let u = new URL(targetUrl);
                    let v = u.searchParams.get('v');
                    if (v) {
                        targetUrl = "https://www.youtube.com/watch?v=" + v;
                    } else if (u.hostname === 'youtu.be') {
                        targetUrl = "https://www.youtube.com/watch?v=" + u.pathname.substring(1);
                    }
                } catch (e) { }
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
    }
    return true;
});
