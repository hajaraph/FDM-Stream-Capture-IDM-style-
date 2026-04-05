// Modern IDM-style overlay button with a dropdown list for streams
let fdmButton = null;
let currentVideo = null;
let dropdownMenu = null;
let hideTimeout = null;

// --- NOTIFICATION SYSTEM ---
function showFDMNotification(message, type = 'info') {
    // Remove existing notification if any
    const existing = document.getElementById('fdm-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.id = 'fdm-notification';

    const colors = UI.NOTIFICATION_COLORS[type] || UI.NOTIFICATION_COLORS.info;

    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: UI.Z_INDEX_BUTTON,
        background: colors.bg,
        color: '#ffffff',
        padding: '14px 20px',
        borderRadius: '8px',
        fontSize: '13px',
        fontWeight: '600',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
        border: `2px solid ${colors.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        maxWidth: '350px',
        animation: 'fdmSlideIn 0.3s ease-out',
        cursor: 'pointer'
    });

    const icon = document.createElement('span');
    icon.textContent = colors.icon;
    icon.style.fontSize = '16px';
    icon.style.fontWeight = 'bold';

    const text = document.createElement('span');
    text.textContent = message;
    text.style.flex = '1';

    notification.appendChild(icon);
    notification.appendChild(text);

    // Auto-dismiss after configured time
    let dismissTimeout = setTimeout(() => {
        notification.style.animation = 'fdmSlideOut 0.3s ease-in';
        setTimeout(() => notification.remove(), TIMING.NOTIFICATION_FADE_MS);
    }, TIMING.NOTIFICATION_DISMISS_MS);

    // Dismiss on click
    notification.addEventListener('click', () => {
        clearTimeout(dismissTimeout);
        notification.style.animation = 'fdmSlideOut 0.3s ease-in';
        setTimeout(() => notification.remove(), TIMING.NOTIFICATION_FADE_MS);
    });

    document.body.appendChild(notification);
}

// Add animation styles
function addNotificationStyles() {
    if (document.getElementById('fdm-notification-style')) return;

    const style = document.createElement('style');
    style.id = 'fdm-notification-style';
    style.textContent = `
        @keyframes fdmSlideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fdmSlideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    (document.head || document.documentElement).appendChild(style);
}

let currentSettings = {
    showButton: true,
    scanHiddenStreams: true
};

async function syncSettings() {
    try {
        const bgSettings = await browser.runtime.sendMessage({ type: "GET_SETTINGS" });
        if (bgSettings) currentSettings = bgSettings;
    } catch (e) { }
}

browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.extensionSettings) {
        currentSettings = { ...currentSettings, ...changes.extensionSettings.newValue };
        if (!currentSettings.showButton && fdmButton) {
            fdmButton.style.display = 'none';
        }
    }
});

function injectStyles() {
    if (document.getElementById('fdm-modern-style')) return;
    const style = document.createElement('style');
    style.id = 'fdm-modern-style';
    style.textContent = `
        #fdm-download-button {
            position: absolute;
            z-index: ${UI.Z_INDEX_BUTTON};
            background: #0f172a;
            color: #f8fafc;
            padding: 5px 10px;
            font-size: 11px;
            font-weight: 500;
            border-radius: 4px;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            display: none;
            font-family: system-ui, -apple-system, sans-serif;
            transition: all 0.15s ease;
            border: 1px solid #334155;
            max-width: 250px;
            white-space: nowrap;
        }
        
        #fdm-download-button:hover {
            background: #1e293b;
            box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
        }

        #fdm-btn-main {
            display: flex;
            align-items: center;
            gap: 6px;
        }

        #fdm-dropdown-menu {
            position: absolute;
            top: calc(100% + 4px);
            left: 0;
            background: #ffffff;
            color: #1e293b;
            min-width: 250px;
            max-width: 320px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            display: none;
            flex-direction: column;
            z-index: ${UI.Z_INDEX_DROPDOWN};
            overflow: hidden;
            padding: 4px 0;
            font-family: system-ui, -apple-system, sans-serif;
        }

        @keyframes fdmFadeIn {
            from { opacity: 0; transform: translateY(-10px) scale(0.98); }
            to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .fdm-dropdown-item {
            padding: 8px 12px;
            cursor: pointer;
            font-size: 12px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            color: #334155;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .fdm-dropdown-item:hover {
            background-color: #f1f5f9;
            color: #0f172a;
        }

        .fdm-badge-container {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 2px;
            min-width: 65px;
        }

        .fdm-type-badge {
            background: #e2e8f0;
            color: #475569;
            padding: 2px 4px;
            border-radius: 4px;
            font-size: 9px;
            font-weight: 600;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            text-align: center;
        }
        
        .fdm-type-badge.manifests { background: #dcfce7; color: #166534; }
        .fdm-type-badge.youtube { background: #fee2e2; color: #991b1b; }

        .fdm-ext-note {
            font-size: 8px;
            color: #94a3b8;
            font-weight: 700;
            text-transform: uppercase;
            padding-left: 1px;
        }

        .fdm-item-text {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .fdm-empty-msg {
            padding: 12px 16px;
            font-size: 12px;
            color: #94a3b8;
            text-align: center;
            font-style: italic;
        }
    `;
    (document.head || document.documentElement).appendChild(style);
}

function createFdmButton() {
    if (fdmButton) return;

    injectStyles();

    fdmButton = document.createElement('div');
    fdmButton.id = 'fdm-download-button';

    // Main button container
    // Main button container
    const btnMain = document.createElement('div');
    btnMain.id = 'fdm-btn-main';

    const svg1 = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg1.setAttribute('width', '16');
    svg1.setAttribute('height', '16');
    svg1.setAttribute('viewBox', '0 0 24 24');
    svg1.setAttribute('fill', 'none');
    svg1.setAttribute('stroke', 'currentColor');
    svg1.setAttribute('stroke-width', '2.5');
    svg1.setAttribute('stroke-linecap', 'round');
    svg1.setAttribute('stroke-linejoin', 'round');
    svg1.style.color = '#60a5fa';

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4');
    const polyline1 = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    polyline1.setAttribute('points', '7 10 12 15 17 10');
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', '12'); line.setAttribute('y1', '15');
    line.setAttribute('x2', '12'); line.setAttribute('y2', '3');
    svg1.appendChild(path); svg1.appendChild(polyline1); svg1.appendChild(line);

    const span = document.createElement('span');
    span.textContent = browser.i18n.getMessage("contentBtnText") || "Télécharger la vidéo";

    const svg2 = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg2.setAttribute('width', '14'); svg2.setAttribute('height', '14');
    svg2.setAttribute('viewBox', '0 0 24 24');
    svg2.setAttribute('fill', 'none'); svg2.setAttribute('stroke', 'currentColor');
    svg2.setAttribute('stroke-width', '2'); svg2.setAttribute('stroke-linecap', 'round');
    svg2.setAttribute('stroke-linejoin', 'round');
    svg2.style.opacity = '0.7';

    const polyline2 = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    polyline2.setAttribute('points', '6 9 12 15 18 9');
    svg2.appendChild(polyline2);

    btnMain.appendChild(svg1);
    btnMain.appendChild(span);
    btnMain.appendChild(svg2);
    fdmButton.appendChild(btnMain);

    // Dropdown menu
    dropdownMenu = document.createElement('div');
    dropdownMenu.id = 'fdm-dropdown-menu';
    fdmButton.appendChild(dropdownMenu);

    fdmButton.querySelector('#fdm-btn-main').addEventListener('click', async (e) => {
        e.stopPropagation();
        clearTimeout(hideTimeout);
        if (dropdownMenu.style.display === 'flex') {
            dropdownMenu.style.display = 'none';
        } else {
            dropdownMenu.style.display = 'flex';
            await populateDropdown();
        }
    });

    fdmButton.addEventListener('mouseenter', () => {
        clearTimeout(hideTimeout);
    });

    fdmButton.addEventListener('mouseleave', () => {
        if (dropdownMenu.style.display === 'flex') return;
        hideTimeout = setTimeout(() => {
            dropdownMenu.style.display = 'none';
            fdmButton.style.display = 'none';
        }, TIMING.BUTTON_HIDE_DELAY_MS);
    });

    // Close menu when clicking completely outside
    document.addEventListener('click', (e) => {
        if (fdmButton && !fdmButton.contains(e.target)) {
            if (dropdownMenu && dropdownMenu.style.display === 'flex') {
                dropdownMenu.style.display = 'none';
                fdmButton.style.display = 'none';
            }
        }
    });

    document.body.appendChild(fdmButton);
}

function positionButton(video) {
    if (!video || !fdmButton) return;

    const rect = video.getBoundingClientRect();
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    // Position top-right edge with some padding
    fdmButton.style.left = (rect.left + scrollLeft + LIMITS.BUTTON_POSITION_OFFSET) + 'px';
    fdmButton.style.top = (rect.top + scrollTop + LIMITS.BUTTON_POSITION_OFFSET) + 'px';
    fdmButton.style.display = 'block';
}

async function populateDropdown() {
    if (!dropdownMenu) return;

    dropdownMenu.textContent = '';
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'fdm-empty-msg';
    loadingDiv.textContent = '...';
    dropdownMenu.appendChild(loadingDiv);

    // Fetch streams from background script
    const streams = await browser.runtime.sendMessage({ type: "GET_STREAMS" }) || [];

    dropdownMenu.textContent = '';

    if (streams.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'fdm-empty-msg';
        emptyDiv.textContent = browser.i18n.getMessage("emptyMsg") || "Aucun flux détecté";
        dropdownMenu.appendChild(emptyDiv);

        // Direct video src fallback
        if (currentVideo && currentVideo.src && !currentVideo.src.startsWith('blob:')) {
            addDropdownItem({
                url: currentVideo.src,
                title: "Fichier vidéo HTML5",
                type: "videos"
            });
        }
        return;
    }

    streams.forEach(stream => {
        addDropdownItem(stream);
    });
}

function addDropdownItem(stream) {
    const item = document.createElement('div');
    item.className = 'fdm-dropdown-item';

    // Nettoyer le titre (enlever les retours à la ligne ou caractères bizarres)
    const cleanTitle = (stream.title || "Vidéo").trim().substring(0, LIMITS.MAX_TITLE_LENGTH);

    // Pour YouTube ou les flux, on affiche le titre de la page Web.
    // Si pas de titre dispo, on fallback sur un nom générique.
    const fileName = stream.type === 'youtube' ? 'YouTube HD' : cleanTitle;
    const typeLabel = stream.type.toUpperCase();

    // Extract extension using centralized helper
    let extension = extractExtension(stream.url)?.toUpperCase() || '';
    if (stream.type === 'youtube') extension = 'WEBM/MP4';
    else if (!extension && stream.type === 'manifests') extension = 'M3U8';
    else if (!extension) extension = 'MEDIA';

    const badgeContainer = document.createElement('div');
    badgeContainer.className = 'fdm-badge-container';

    const typeSpan = document.createElement('span');
    typeSpan.className = 'fdm-type-badge ' + stream.type;
    typeSpan.textContent = typeLabel;

    const extSpan = document.createElement('span');
    extSpan.className = 'fdm-ext-note';
    extSpan.textContent = extension;

    badgeContainer.appendChild(typeSpan);
    badgeContainer.appendChild(extSpan);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'fdm-item-text';
    nameSpan.title = stream.url || '';
    nameSpan.textContent = fileName;

    item.appendChild(badgeContainer);
    item.appendChild(nameSpan);

    item.addEventListener('click', (e) => {
        e.stopPropagation();
        const isYoutube = stream.type === 'youtube';

        browser.runtime.sendMessage({
            type: "SEND_TO_FDM",
            url: stream.url,
            filename: stream.title || fileName,
            referer: stream.pageUrl || window.location.href,
            isYoutube: isYoutube
        });

        // Visual feedback
        item.style.backgroundColor = '#dcfce7';
        item.style.color = '#166534';
        item.textContent = '';
        const successSpan = document.createElement('span');
        successSpan.style.flex = '1';
        successSpan.style.textAlign = 'center';
        successSpan.style.fontWeight = '500';
        successSpan.textContent = "[OK] " + (browser.i18n.getMessage("btnCopied") || "Envoyé");
        item.appendChild(successSpan);

        setTimeout(() => {
            dropdownMenu.style.display = 'none';
            fdmButton.style.display = 'none';
            item.style.backgroundColor = '';
            item.style.color = '';
        }, TIMING.SUCCESS_FEEDBACK_MS);
    });

    dropdownMenu.appendChild(item);
}

// Observe videos
function searchVideos() {
    const videos = document.querySelectorAll('video');

    videos.forEach(v => {
        // Prevent duplicate listeners
        if (v.dataset.fdmAttached) return;
        v.dataset.fdmAttached = "true";

        v.addEventListener('mouseenter', async () => {
            if (!currentSettings.showButton) return;
            currentVideo = v;

            // Vérifier s'il y a vraiment un flux téléchargeable avant d'afficher le bouton
            let hasStreams = false;
            if (v.src && !v.src.startsWith('blob:')) {
                hasStreams = true; // Lien direct MP4 classique détecté
            } else {
                try {
                    const streams = await browser.runtime.sendMessage({ type: "GET_STREAMS" }) || [];
                    if (streams.length > 0) hasStreams = true; // Des flux M3U8/DASH ont été interceptés
                } catch (e) { }
            }

            if (hasStreams) {
                createFdmButton();
                positionButton(v);
                clearTimeout(hideTimeout);
            }
        });

        v.addEventListener('mouseleave', () => {
            if (dropdownMenu && dropdownMenu.style.display === 'flex') return;
            hideTimeout = setTimeout(() => {
                if (fdmButton && dropdownMenu.style.display !== 'flex') {
                    fdmButton.style.display = 'none';
                    dropdownMenu.style.display = 'none';
                }
            }, TIMING.BUTTON_HIDE_DELAY_MS);
        });
    });
}

const knownHiddenUrls = new Set();
function extractHiddenStreams() {
    if (!currentSettings.scanHiddenStreams) return;

    const scripts = document.querySelectorAll('script');

    scripts.forEach(script => {
        if (!script.textContent) return;
        let text = script.textContent.replace(/\\\//g, '/'); // Unescape JSON slashes

        let match;
        while ((match = DETECTION_PATTERNS.hiddenStreamRegex.exec(text)) !== null) {
            const url = match[1];
            if (!knownHiddenUrls.has(url)) {
                knownHiddenUrls.add(url);

                // Use centralized detection helper
                let type = detectMediaType(url) || 'videos';

                try {
                    browser.runtime.sendMessage({
                        type: "ADD_HIDDEN_STREAM",
                        url: url,
                        streamType: type,
                        pageUrl: window.location.href
                    });
                } catch (e) { }
            }
        }
    });
}

// Initial check and optimized detection with MutationObserver
syncSettings().then(() => {
    addNotificationStyles();

    // Initial scan after short delay
    setTimeout(() => {
        searchVideos();
        extractHiddenStreams();
    }, TIMING.INITIAL_SCAN_DELAY_MS);

    // Use MutationObserver to detect dynamic content changes efficiently
    let observerTimeout = null;
    const observer = new MutationObserver((mutations) => {
        // Debounce to avoid excessive scanning
        if (observerTimeout) clearTimeout(observerTimeout);

        observerTimeout = setTimeout(() => {
            let shouldScan = false;

            // Check if relevant changes occurred
            for (const mutation of mutations) {
                if (mutation.addedNodes && mutation.addedNodes.length > 0) {
                    for (const node of mutation.addedNodes) {
                        // Check for new video elements or script changes
                        if (node.nodeName === 'VIDEO' ||
                            node.nodeName === 'SCRIPT' ||
                            (node.querySelectorAll &&
                             (node.querySelectorAll('video').length > 0 ||
                              node.querySelectorAll('script').length > 0))) {
                            shouldScan = true;
                            break;
                        }
                    }
                }
                if (shouldScan) break;
            }

            // Only scan if relevant changes detected
            if (shouldScan) {
                searchVideos();
                extractHiddenStreams();
            }
        }, TIMING.MUTATION_DEBOUNCE_MS);
    });

    // Observe the entire document body for child list changes
    const startObserver = () => {
        if (document.body) {
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        } else {
            // If body not ready, retry after DOMContentLoaded
            document.addEventListener('DOMContentLoaded', startObserver);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startObserver);
    } else {
        startObserver();
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        observer.disconnect();
        if (observerTimeout) clearTimeout(observerTimeout);
    });
});

// --- LISTEN FOR NOTIFICATIONS FROM BACKGROUND ---
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'FDM_NOTIFICATION') {
        showFDMNotification(request.message, request.notificationType);
    }
    return true;
});

// Listener for Mass Downloader feature with enhanced scanning
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "SCAN_PAGE") {
        const foundMedia = new Map();

        const addMedia = (url, title, type) => {
            if (!url || typeof url !== 'string' || url.startsWith('javascript:') || url.startsWith('mailto:')) return;
            try {
                let parsed = new URL(url, window.location.href);
                let fullUrl = parsed.href;
                if (!foundMedia.has(fullUrl)) {
                    foundMedia.set(fullUrl, {
                        url: fullUrl,
                        title: title || document.title || "Fichier",
                        type: type,
                        referer: window.location.href
                    });
                }
            } catch (e) { }
        };

        // Scan Anchors
        document.querySelectorAll('a[href]').forEach(a => {
            if (DETECTION_PATTERNS.pageScanExtensions.test(a.href)) {
                let extMatch = a.href.match(DETECTION_PATTERNS.pageScanExtensions);
                let typeText = extMatch ? extMatch[1].toUpperCase() : 'FILE';
                addMedia(a.href, a.textContent.trim() || typeText + " File", typeText);
            }
        });

        // Scan HTML5 Video/Audio
        document.querySelectorAll('video').forEach((v, i) => {
            if (v.src && !v.src.startsWith('blob:')) addMedia(v.src, document.title + ' (Video ' + (i + 1) + ')', 'VIDEO');
        });
        document.querySelectorAll('audio').forEach((a, i) => {
            if (a.src && !a.src.startsWith('blob:')) addMedia(a.src, document.title + ' (Audio ' + (i + 1) + ')', 'AUDIO');
        });
        document.querySelectorAll('source').forEach((s, i) => {
            if (s.src && !s.src.startsWith('blob:')) addMedia(s.src, document.title + ' (Media ' + (i + 1) + ')', 'MEDIA');
        });

        // Scan data attributes and inline styles for media URLs
        document.querySelectorAll('[style*="url("]').forEach(el => {
            const style = el.getAttribute('style');
            const urlMatch = style.match(/url\(['"]?([^'")]+)/i);
            if (urlMatch) {
                const url = urlMatch[1];
                if (DETECTION_PATTERNS.pageScanExtensions.test(url)) {
                    addMedia(url, 'Background Media', 'BACKGROUND');
                }
            }
        });

        // Scan for media in JSON data embedded in page
        document.querySelectorAll('script[type="application/json"], script[type="application/ld+json"]').forEach(script => {
            try {
                const data = JSON.parse(script.textContent);
                const extractUrls = (obj, depth = 0) => {
                    if (depth > 5 || !obj) return; // Limit recursion
                    if (typeof obj === 'string' && DETECTION_PATTERNS.pageScanExtensions.test(obj)) {
                        addMedia(obj, 'JSON Embedded', 'EMBEDDED');
                    } else if (typeof obj === 'object') {
                        Object.values(obj).forEach(v => extractUrls(v, depth + 1));
                    }
                };
                extractUrls(data);
            } catch (e) { }
        });

        sendResponse({ items: Array.from(foundMedia.values()) });
    }
    return true;
});

// --- XHR/FETCH INTERCEPTOR FOR DYNAMIC MEDIA DETECTION ---
(function interceptNetworkRequests() {
    const detectedUrls = new Set();

    // Intercept XMLHttpRequest
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url) {
        this._fdmUrl = url;
        return originalXHROpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function() {
        if (this._fdmUrl && DETECTION_PATTERNS.networkMediaExtensions.test(this._fdmUrl) && !detectedUrls.has(this._fdmUrl)) {
            detectedUrls.add(this._fdmUrl);
            browser.runtime.sendMessage({
                type: "ADD_HIDDEN_STREAM",
                url: this._fdmUrl,
                streamType: detectMediaType(this._fdmUrl) || 'videos',
                pageUrl: window.location.href
            }).catch(() => {});
        }
        return originalXHRSend.apply(this, arguments);
    };

    // Intercept Fetch API
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;

        if (url && DETECTION_PATTERNS.networkMediaExtensions.test(url) && !detectedUrls.has(url)) {
            detectedUrls.add(url);
            browser.runtime.sendMessage({
                type: "ADD_HIDDEN_STREAM",
                url: url,
                streamType: detectMediaType(url) || 'videos',
                pageUrl: window.location.href
            }).catch(() => {});
        }

        return originalFetch.apply(this, args);
    };
})();

window.addEventListener('scroll', () => { if (fdmButton && dropdownMenu && dropdownMenu.style.display !== 'flex') { fdmButton.style.display = 'none'; } });
window.addEventListener('resize', () => { if (fdmButton && dropdownMenu && dropdownMenu.style.display !== 'flex') { fdmButton.style.display = 'none'; } });
