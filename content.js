// Modern IDM-style overlay button with a dropdown list for streams
let fdmButton = null;
let currentVideo = null;
let dropdownMenu = null;
let hideTimeout = null;

// --- SAFETY: Ensure `api` is available in Content Script Scope ---
if (typeof api === 'undefined') {
    var api = typeof browser !== 'undefined' ? browser : chrome;
}

// --- NOTIFICATION SYSTEM ---
function showFDMNotification(message, type = 'info') {
    const existing = document.getElementById('fdm-notification');
    if (existing) existing.remove();

    const colors = {
        success: { bg: '#10b981', border: '#059669', icon: '✓' },
        error: { bg: '#ef4444', border: '#dc2626', icon: '✕' },
        warning: { bg: '#f59e0b', border: '#d97706', icon: '⚠' },
        info: { bg: '#3b82f6', border: '#2563eb', icon: 'ℹ' }
    };

    const color = colors[type] || colors.info;
    const notification = document.createElement('div');
    notification.id = 'fdm-notification';
    notification.style.cssText = `position:fixed;top:20px;right:20px;z-index:2147483647;background:${color.bg};color:#fff;padding:12px 16px;border-radius:8px;font-size:12px;font-weight:600;font-family:system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,0.2);border:1px solid ${color.border};display:flex;align-items:center;gap:8px;max-width:320px;cursor:pointer;`;
    
    const iconSpan = document.createElement('span');
    iconSpan.style.cssText = 'font-size:14px;font-weight:bold';
    iconSpan.textContent = color.icon;
    
    const textSpan = document.createElement('span');
    textSpan.style.cssText = 'flex:1';
    textSpan.textContent = message;
    
    notification.appendChild(iconSpan);
    notification.appendChild(textSpan);
    document.body.appendChild(notification);

    setTimeout(() => notification.remove(), 3000);
    notification.onclick = () => notification.remove();
}

function injectStyles() {
    if (document.getElementById('fdm-modern-style')) return;
    const style = document.createElement('style');
    style.id = 'fdm-modern-style';
    style.textContent = `
        #fdm-download-button {
            position: absolute;
            z-index: 2147483646;
            width: 42px;
            height: 42px;
            border-radius: 50%;
            background: #171717;
            color: #ffffff;
            display: none;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
            font-family: system-ui, -apple-system, sans-serif;
            transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease;
            border: none;
            padding: 0;
        }

        #fdm-download-button:hover {
            transform: scale(1.08);
            box-shadow: 0 10px 28px rgba(0, 0, 0, 0.4);
            background: #000000;
        }

        #fdm-download-button svg {
            width: 20px;
            height: 20px;
            stroke: currentColor;
            stroke-width: 2;
            transition: transform 0.3s ease;
        }

        #fdm-download-button:hover svg {
            animation: fdmBounce 1.5s infinite;
        }

        @keyframes fdmBounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(2px); }
        }

        #fdm-download-button.active {
            background: #000000;
            transform: scale(0.95);
        }

        #fdm-dropdown-menu {
            position: fixed;
            top: 0;
            left: 0;
            background: #ffffff;
            color: #171717;
            min-width: 200px;
            max-width: 280px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
            border: 1px solid rgba(0, 0, 0, 0.05);
            border-radius: 12px;
            visibility: hidden;
            opacity: 0;
            flex-direction: column;
            z-index: 2147483647;
            overflow: hidden;
            padding: 4px;
            font-family: system-ui, -apple-system, sans-serif;
            transition: opacity 0.15s ease, transform 0.15s cubic-bezier(0.16, 1, 0.3, 1);
            transform-origin: top center;
            pointer-events: none;
            display: flex;
        }

        .fdm-dropdown-item {
            padding: 6px 8px;
            cursor: pointer;
            font-size: 11px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            color: #171717;
            display: flex;
            align-items: center;
            gap: 6px;
            border-radius: 6px;
            transition: background 0.1s ease;
        }

        .fdm-dropdown-item:hover {
            background-color: #f3f4f6;
            color: #000000;
        }

        .fdm-dropdown-item:active {
            background-color: #e5e7eb;
        }

        .fdm-type-badge {
            background: #2563eb; /* Bleu vif par défaut */
            color: #ffffff; /* Texte blanc */
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 9px;
            font-weight: 800;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            min-width: 32px;
            text-align: center;
            display: inline-block;
            white-space: nowrap;
        }

        .fdm-type-badge.manifests { background: #16a34a; color: #ffffff; } /* Vert HLS */
        .fdm-type-badge.youtube { background: #dc2626; color: #ffffff; } /* Rouge YouTube */

        .fdm-empty-msg {
            padding: 8px 12px;
            font-size: 11px;
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

    const fabSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    fabSvg.setAttribute('viewBox', '0 0 24 24');
    fabSvg.setAttribute('fill', 'none');
    fabSvg.setAttribute('stroke', 'currentColor');
    fabSvg.setAttribute('stroke-width', '2.5');
    fabSvg.setAttribute('stroke-linecap', 'round');
    fabSvg.setAttribute('stroke-linejoin', 'round');

    const fabPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    fabPath.setAttribute('d', 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4');
    const fabPolyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    fabPolyline.setAttribute('points', '7 10 12 15 17 10');
    const fabLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    fabLine.setAttribute('x1', '12'); fabLine.setAttribute('y1', '15');
    fabLine.setAttribute('x2', '12'); fabLine.setAttribute('y2', '3');

    fabSvg.appendChild(fabPath); fabSvg.appendChild(fabPolyline); fabSvg.appendChild(fabLine);
    fdmButton.appendChild(fabSvg);

    // Append dropdown menu directly to documentElement to prevent clipping
    dropdownMenu = document.createElement('div');
    dropdownMenu.id = 'fdm-dropdown-menu';
    dropdownMenu.style.zIndex = '2147483647';
    document.documentElement.appendChild(dropdownMenu);

    fdmButton.addEventListener('click', async (e) => {
        e.stopPropagation();
        clearTimeout(hideTimeout);
        
        if (dropdownMenu.style.visibility === 'visible') {
            dropdownMenu.style.visibility = 'hidden';
            dropdownMenu.style.opacity = '0';
            dropdownMenu.style.pointerEvents = 'none';
        } else {
            // Position menu
            const rect = fdmButton.getBoundingClientRect();
            const menuWidth = 260;
            
            let leftPos = rect.left + rect.width / 2 - menuWidth / 2;
            
            // Bounds checking
            if (leftPos + menuWidth > window.innerWidth) leftPos = window.innerWidth - menuWidth - 15;
            if (leftPos < 10) leftPos = 10;

            dropdownMenu.style.top = (rect.bottom + 8) + 'px';
            dropdownMenu.style.left = leftPos + 'px';
            
            await populateDropdown();
            
            dropdownMenu.style.visibility = 'visible';
            dropdownMenu.style.opacity = '1';
            dropdownMenu.style.pointerEvents = 'auto';
        }
    });

    fdmButton.addEventListener('mouseenter', () => clearTimeout(hideTimeout));
    fdmButton.addEventListener('mouseleave', () => {
        if (dropdownMenu.style.visibility === 'visible') return;
        hideTimeout = setTimeout(() => {
            fdmButton.style.display = 'none';
        }, 300);
    });

    document.addEventListener('click', (e) => {
        if (fdmButton && !fdmButton.contains(e.target) && dropdownMenu && !dropdownMenu.contains(e.target)) {
            dropdownMenu.style.visibility = 'hidden';
            dropdownMenu.style.opacity = '0';
            dropdownMenu.style.pointerEvents = 'none';
        }
    });

    document.body.appendChild(fdmButton);
}

function positionButton(video) {
    if (!video || !fdmButton) return;
    const rect = video.getBoundingClientRect();
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    fdmButton.style.left = (rect.left + scrollLeft + 12) + 'px';
    fdmButton.style.top = (rect.top + scrollTop + 12) + 'px';
    fdmButton.style.display = 'flex';
}

async function populateDropdown() {
    if (!dropdownMenu) return;
    dropdownMenu.textContent = '';

    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'fdm-empty-msg';
    loadingDiv.textContent = '...';
    dropdownMenu.appendChild(loadingDiv);

    const streams = await api.runtime.sendMessage({ type: "GET_STREAMS" }) || [];
    dropdownMenu.textContent = '';

    if (streams.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'fdm-empty-msg';
        emptyDiv.textContent = api.i18n.getMessage("emptyMsg") || "Aucun flux détecté";
        dropdownMenu.appendChild(emptyDiv);
        return;
    }

    streams.forEach(stream => addDropdownItem(stream));
}

function addDropdownItem(stream) {
    if (!stream) return;

    const item = document.createElement('div');
    item.className = 'fdm-dropdown-item';
    
    // Robustly extract format
    let ext = 'FILE';
    if (stream.url) {
        const lowerUrl = stream.url.toLowerCase();
        if (lowerUrl.includes('.m3u8')) ext = 'M3U8';
        else if (lowerUrl.includes('.mpd')) ext = 'DASH';
        else if (lowerUrl.includes('.mp4')) ext = 'MP4';
        else if (lowerUrl.includes('.mkv')) ext = 'MKV';
        else if (lowerUrl.includes('.webm')) ext = 'WEBM';
        else if (lowerUrl.includes('.flv')) ext = 'FLV';
        else if (lowerUrl.includes('.ts')) ext = 'TS';
        else if (lowerUrl.includes('.mp3')) ext = 'MP3';
        else if (lowerUrl.includes('.aac')) ext = 'AAC';
    }
    
    // Fallbacks
    if (ext === 'FILE') {
        if (stream.type === 'youtube') ext = 'YT';
        else if (stream.type === 'manifests') ext = 'HLS';
        else if (stream.type === 'segments') ext = 'SEG';
        else if (stream.type) ext = stream.type.toUpperCase().substring(0, 3);
    }

    // Determine badge color dynamically
    let badgeColor = '#2563eb'; // Blue default
    if (stream.type === 'manifests') badgeColor = '#16a34a'; // Green
    if (stream.type === 'youtube') badgeColor = '#dc2626'; // Red

    const cleanTitle = (stream.title || "Vidéo").trim().substring(0, 30);
    const fileName = stream.type === 'youtube' ? 'YouTube HD' : cleanTitle;

    // Secure DOM creation instead of innerHTML
    const badgeSpan = document.createElement('span');
    badgeSpan.style.cssText = `flex-shrink:0; background:${badgeColor}; color:white; padding:2px 6px; border-radius:4px; font-size:9px; font-weight:bold; min-width:24px; text-align:center;`;
    badgeSpan.textContent = ext;

    const nameSpan = document.createElement('span');
    nameSpan.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis';
    nameSpan.title = stream.url || '';
    nameSpan.textContent = fileName;

    item.appendChild(badgeSpan);
    item.appendChild(nameSpan);

    item.addEventListener('click', (e) => {
        e.stopPropagation();
        api.runtime.sendMessage({
            type: "SEND_TO_FDM",
            url: stream.url,
            filename: stream.title || fileName,
            referer: stream.pageUrl || window.location.href,
            isYoutube: stream.type === 'youtube'
        });
        item.style.backgroundColor = '#dcfce7';
        item.style.color = '#166534';
        setTimeout(() => {
            if (dropdownMenu) {
                dropdownMenu.style.visibility = 'hidden';
                dropdownMenu.style.opacity = '0';
                dropdownMenu.style.pointerEvents = 'none';
            }
            if (fdmButton) fdmButton.style.display = 'none';
        }, 800);
    });

    dropdownMenu.appendChild(item);
}

// Observe videos
function searchVideos() {
    const videos = document.querySelectorAll('video');
    videos.forEach(v => {
        if (v.dataset.fdmAttached) return;
        v.dataset.fdmAttached = "true";

        v.addEventListener('mouseenter', async () => {
            if (!currentVideo) currentVideo = v;

            let hasStreams = false;
            const videoSrc = v.currentSrc || v.src;
            if (videoSrc && !videoSrc.startsWith('blob:')) hasStreams = true;
            else {
                try {
                    const streams = await api.runtime.sendMessage({ type: "GET_STREAMS" }) || [];
                    if (streams.length > 0) hasStreams = true;
                } catch (e) {}
            }

            if (hasStreams) {
                createFdmButton();
                positionButton(v);
                clearTimeout(hideTimeout);
            }
        });

        v.addEventListener('mouseleave', () => {
            if (dropdownMenu && dropdownMenu.style.visibility === 'visible') return;
            hideTimeout = setTimeout(() => {
                if (fdmButton) fdmButton.style.display = 'none';
            }, 300);
        });
    });
}

// Initial check and optimized detection
setTimeout(() => {
    searchVideos();
    setInterval(searchVideos, 2000);
}, 1000);

window.addEventListener('scroll', () => { if (fdmButton && dropdownMenu && dropdownMenu.style.visibility !== 'visible') fdmButton.style.display = 'none'; });
window.addEventListener('resize', () => { if (fdmButton && dropdownMenu && dropdownMenu.style.visibility !== 'visible') fdmButton.style.display = 'none'; });
