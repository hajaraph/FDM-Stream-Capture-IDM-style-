// Modern IDM-style overlay button with a dropdown list for streams
let fdmButton = null;
let currentVideo = null;
let dropdownMenu = null;
let hideTimeout = null;

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
            z-index: 2147483647;
            background: #0f172a;
            color: #f8fafc;
            padding: 8px 12px;
            font-size: 12px;
            font-weight: 500;
            border-radius: 6px;
            cursor: pointer;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            display: none;
            font-family: system-ui, -apple-system, sans-serif;
            transition: all 0.15s ease;
            border: 1px solid #334155;
        }
        
        #fdm-download-button:hover {
            background: #1e293b;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        }

        #fdm-btn-main {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        #fdm-dropdown-menu {
            position: absolute;
            top: calc(100% + 5px);
            left: 0;
            background: #ffffff;
            color: #333333;
            min-width: 350px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            display: none;
            flex-direction: column;
            z-index: 2147483648;
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
        }, 400); // 400ms delay for smoother experience
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
    fdmButton.style.left = (rect.left + scrollLeft + 15) + 'px';
    fdmButton.style.top = (rect.top + scrollTop + 15) + 'px';
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
    const cleanTitle = (stream.title || "Vidéo").trim().substring(0, 50);

    // Pour YouTube ou les flux, on affiche le titre de la page Web.
    // Si pas de titre dispo, on fallback sur un nom générique.
    const fileName = stream.type === 'youtube' ? 'YouTube HD' : cleanTitle;
    const typeLabel = stream.type.toUpperCase();

    // Extraire l'extension (ex: .mp4, .m3u8) ou deviner
    let extMatch = stream.url.match(/\.(mp4|m3u8|ts|webm|flv|mkv)(?:\?|$)/i);
    let extension = extMatch ? extMatch[1].toUpperCase() : '';
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
        }, 1200);
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
            }, 400);
        });
    });
}

const knownHiddenUrls = new Set();
function extractHiddenStreams() {
    if (!currentSettings.scanHiddenStreams) return;

    const scripts = document.querySelectorAll('script');
    // Recherche agressive d'URL terminant par .m3u8, .mp4, etc. dans le JS
    const regex = /(https?:\/\/[^\s"'<>\\]+?\.(?:m3u8|mp4|webm|mkv|ts)(?:\?[^\s"'<>\\]*)?)/ig;

    scripts.forEach(script => {
        if (!script.textContent) return;
        let text = script.textContent.replace(/\\\//g, '/'); // Unescape JSON slashes

        let match;
        while ((match = regex.exec(text)) !== null) {
            const url = match[1];
            if (!knownHiddenUrls.has(url)) {
                knownHiddenUrls.add(url);

                let type = 'videos';
                if (url.toLowerCase().includes('.m3u8')) type = 'manifests';
                else if (url.toLowerCase().includes('.ts')) type = 'segments';

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

// Initial check and periodic polling for dynamic content
syncSettings().then(() => {
    setTimeout(() => {
        searchVideos();
        extractHiddenStreams();
        setInterval(() => {
            searchVideos();
            extractHiddenStreams();
        }, 2000);
    }, 1000);
});

// Listener for Mass Downloader feature
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
        const extensions = /\.(mp4|mkv|avi|webm|m3u8|ts|mp3|flac|wav|ogg|jpg|jpeg|png|gif|pdf|zip|rar|7z|iso)(?:\?|$)/i;
        document.querySelectorAll('a[href]').forEach(a => {
            if (extensions.test(a.href)) {
                let extMatch = a.href.match(extensions);
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

        sendResponse({ items: Array.from(foundMedia.values()) });
    }
    return true;
});

window.addEventListener('scroll', () => { if (fdmButton && dropdownMenu && dropdownMenu.style.display !== 'flex') { fdmButton.style.display = 'none'; } });
window.addEventListener('resize', () => { if (fdmButton && dropdownMenu && dropdownMenu.style.display !== 'flex') { fdmButton.style.display = 'none'; } });
