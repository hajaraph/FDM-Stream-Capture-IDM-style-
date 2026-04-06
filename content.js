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

// --- PREMIUM UI: Shadow DOM Wrapper ---
let fdmShadowRoot = null;
let fdmContainer = null;

function detectSiteColor() {
    // 1. Check for Major Streaming Platforms (Presets)
    if (window.location.hostname.includes('youtube.com')) return '#ff0000';
    if (window.location.hostname.includes('dailymotion.com')) return '#0062ff';
    if (window.location.hostname.includes('twitch.tv')) return '#9146ff';
    if (window.location.hostname.includes('vimeo.com')) return '#1ab7ea';
    if (window.location.hostname.includes('uqload.')) return '#f59e0b'; // Amber thematic for Uqload

    // 2. Try to get theme-color meta tag
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme && metaTheme.content) return metaTheme.content;

    // 3. Fallback to Favicon Color ? (Simple fallback here)
    return '#2563eb';
}

function ensureShadowRoot() {
    if (fdmShadowRoot) return;
    fdmContainer = document.createElement('div');
    fdmContainer.id = 'fdm-overlay-container';
    fdmContainer.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none;';
    document.documentElement.appendChild(fdmContainer);
    
    // Create Shadow Root (mode: open for easier debugging if needed)
    fdmShadowRoot = fdmContainer.attachShadow({ mode: 'open' });
    
    // Apply Dynamic Site Identity
    const brandColor = detectSiteColor();
    fdmContainer.style.setProperty('--fdm-brand', brandColor);
    
    // Create a 15% opacity version (handling hex ONLY for simplicity)
    const mutedColor = brandColor.startsWith('#') && brandColor.length === 7 
        ? `${brandColor}26` 
        : 'rgba(37, 99, 235, 0.15)';
    fdmContainer.style.setProperty('--fdm-brand-muted', mutedColor);

    injectPremiumStyles();
}

function injectPremiumStyles() {
    const style = document.createElement('style');
    style.textContent = `
        :host {
            --fdm-brand: #2563eb;
            --fdm-brand-muted: rgba(37, 99, 235, 0.1);
        }

        #fdm-download-button {
            position: fixed;
            z-index: 2147483646;
            height: 44px;
            width: 44px;
            border-radius: 22px;
            background: rgba(15, 23, 42, 0.75);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            color: #ffffff;
            display: none;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25), inset 0 0 0 1.5px rgba(255, 255, 255, 0.15);
            font-family: 'Inter', system-ui, sans-serif;
            transition: width 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s ease, background 0.2s ease;
            border: none;
            padding: 0;
            pointer-events: auto;
            overflow: hidden;
            white-space: nowrap;
        }

        #fdm-download-button .btn-text {
            font-size: 13px;
            font-weight: 700;
            opacity: 0;
            max-width: 0;
            transition: opacity 0.3s ease, max-width 0.4s ease, margin 0.4s ease;
            margin-left: 0;
        }

        #fdm-download-button:hover {
            width: 154px;
            background: rgba(15, 23, 42, 0.95);
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
            transform: scale(1.05);
        }

        #fdm-download-button:hover .btn-text {
            opacity: 1;
            max-width: 100px;
            margin-left: 10px;
            margin-right: 8px;
        }

        #fdm-download-button svg {
            width: 20px;
            height: 20px;
            stroke: currentColor;
            stroke-width: 2.5;
            flex-shrink: 0;
            margin-left: 2px;
        }
        
        #fdm-download-button:hover svg {
            margin-left: 0;
            color: var(--fdm-brand);
        }

        #fdm-dropdown-menu {
            position: fixed;
            background: rgba(255, 255, 255, 0.9);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            color: #0f172a;
            min-width: 240px;
            max-width: 320px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.05);
            border-radius: 14px;
            visibility: hidden;
            opacity: 0;
            flex-direction: column;
            z-index: 2147483647;
            overflow: hidden;
            padding: 6px;
            font-family: 'Inter', system-ui, sans-serif;
            transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            transform: translateY(-8px) scale(0.95);
            pointer-events: auto;
            display: flex;
        }

        .fdm-dropdown-item {
            padding: 12px 14px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            color: #334155;
            display: flex;
            align-items: center;
            gap: 12px;
            border-radius: 12px;
            position: relative;
            user-select: none;
            transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            animation: fdmSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
            border-left: 0 solid var(--fdm-brand);
        }

        @keyframes fdmSlideIn {
            from { opacity: 0; transform: translateX(-10px); }
            to { opacity: 1; transform: translateX(0); }
        }

        .fdm-dropdown-item:hover {
            background-color: var(--fdm-brand-muted);
            color: var(--fdm-brand);
            transform: translateX(8px);
            border-left: 4px solid var(--fdm-brand);
            padding-left: 10px;
        }

        .fdm-dropdown-item:active {
            transform: translateX(4px) scale(0.96);
            background-color: var(--fdm-brand-muted);
        }

        .fdm-type-badge {
            flex-shrink: 0;
            padding: 2px 6px;
            border-radius: 5px;
            font-size: 9px;
            font-weight: 800;
            text-transform: uppercase;
            min-width: 34px;
            text-align: center;
            color: white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .fdm-empty-msg {
            padding: 12px;
            font-size: 11px;
            color: #64748b;
            text-align: center;
            font-style: italic;
        }
    `;
    fdmShadowRoot.appendChild(style);
}

function createFdmButton() {
    if (fdmButton) return;
    ensureShadowRoot();

    fdmButton = document.createElement('button');
    fdmButton.id = 'fdm-download-button';

    const btnIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    btnIcon.setAttribute('viewBox', '0 0 24 24'); btnIcon.setAttribute('fill', 'none'); btnIcon.setAttribute('stroke', 'currentColor');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4');
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline'); poly.setAttribute('points', '7 10 12 15 17 10');
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line'); line.setAttribute('x1', '12'); line.setAttribute('y1', '15'); line.setAttribute('x2', '12'); line.setAttribute('y2', '3');
    btnIcon.appendChild(path); btnIcon.appendChild(poly); btnIcon.appendChild(line);

    const btnText = document.createElement('span');
    btnText.className = 'btn-text';
    btnText.textContent = api.i18n.getMessage("btnText") || 'Télécharger';

    fdmButton.appendChild(btnIcon);
    fdmButton.appendChild(btnText);

    dropdownMenu = document.createElement('div');
    dropdownMenu.id = 'fdm-dropdown-menu';
    
    fdmShadowRoot.appendChild(fdmButton);
    fdmShadowRoot.appendChild(dropdownMenu);

    fdmButton.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (dropdownMenu.style.visibility === 'visible') {
            hideMenu();
        } else {
            const rect = fdmButton.getBoundingClientRect();
            dropdownMenu.style.top = (rect.bottom + 8) + 'px';
            dropdownMenu.style.left = Math.min(rect.left, window.innerWidth - 260) + 'px';
            
            await populateDropdown();
            
            dropdownMenu.style.visibility = 'visible';
            dropdownMenu.style.opacity = '1';
            dropdownMenu.style.pointerEvents = 'auto'; // FIX: Réactiver les clics
            dropdownMenu.style.transform = 'translateY(0) scale(1)';
        }
    });

    fdmButton.addEventListener('mouseenter', () => clearTimeout(hideTimeout));
    fdmButton.addEventListener('mouseleave', () => {
        if (dropdownMenu.style.visibility === 'visible') return;
        hideTimeout = setTimeout(() => {
            if (fdmButton) fdmButton.style.display = 'none';
        }, 800);
    });

    document.addEventListener('click', (e) => {
        // Since it's shadow DOM, we check differently
        if (!fdmContainer.contains(e.target)) hideMenu();
    });
}

function hideMenu() {
    if (!dropdownMenu) return;
    dropdownMenu.style.visibility = 'hidden';
    dropdownMenu.style.opacity = '0';
    dropdownMenu.style.pointerEvents = 'none';
    dropdownMenu.style.transform = 'translateY(-10px) scale(0.95)';
}

function positionButton(video) {
    if (!video || !fdmButton) return;
    const rect = video.getBoundingClientRect();
    
    // Check if video is visible and has size
    if (rect.width < 50 || rect.height < 50) return;

    // Fixed positioning relative to the viewport (shadow root handles isolation)
    fdmButton.style.left = (rect.left + 16) + 'px';
    fdmButton.style.top = (rect.top + 16) + 'px';
    fdmButton.style.display = 'flex';
}

async function populateDropdown() {
    if (!dropdownMenu) return;
    dropdownMenu.replaceChildren();

    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'fdm-empty-msg';
    loadingDiv.textContent = '...';
    dropdownMenu.appendChild(loadingDiv);

    try {
        const streams = await api.runtime.sendMessage({ type: "GET_STREAMS" }) || [];
        dropdownMenu.replaceChildren();

        if (streams.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'fdm-empty-msg';
            emptyDiv.textContent = api.i18n.getMessage("emptyMsg") || "Aucun flux détecté";
            dropdownMenu.appendChild(emptyDiv);
            return;
        }

        streams.forEach((stream, index) => addDropdownItem(stream, index));
    } catch (e) {
        console.error("FDM Population Error:", e);
    }
}

function addDropdownItem(stream, index = 0) {
    if (!stream) return;

    const item = document.createElement('div');
    item.className = 'fdm-dropdown-item';
    item.style.animationDelay = (index * 0.04) + 's';
    
    let ext = 'FILE';
    if (stream.url) {
        const lowerUrl = stream.url.toLowerCase();
        if (lowerUrl.includes('.m3u8')) ext = 'HLS';
        else if (lowerUrl.includes('.mpd')) ext = 'DASH';
        else if (lowerUrl.includes('.mp4')) ext = 'MP4';
        else if (lowerUrl.includes('.mkv')) ext = 'MKV';
        else if (lowerUrl.includes('.webm')) ext = 'WEBM';
        else if (lowerUrl.includes('.ts')) ext = 'TS';
        else if (lowerUrl.includes('.mp3')) ext = 'MP3';
    }
    
    if (ext === 'FILE') {
        if (stream.type === 'youtube') ext = 'YT';
        else if (stream.type === 'manifests') ext = 'HLS';
        else if (stream.type) ext = stream.type.toUpperCase().substring(0, 3);
    }

    let badgeColor = '#3b82f6';
    if (stream.type === 'manifests') badgeColor = '#10b981';
    if (stream.type === 'youtube') badgeColor = '#ef4444';

    const cleanTitle = (stream.title || "Vidéo").trim();
    const fileName = stream.type === 'youtube' ? 'YouTube HD Video' : cleanTitle;

    const badgeSpan = document.createElement('span');
    badgeSpan.className = 'fdm-type-badge';
    badgeSpan.style.backgroundColor = badgeColor;
    badgeSpan.style.boxShadow = `0 2px 8px ${badgeColor}44`;
    badgeSpan.textContent = ext;

    const nameSpan = document.createElement('span');
    nameSpan.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;letter-spacing:-0.01em;';
    nameSpan.textContent = fileName;

    item.appendChild(badgeSpan);
    item.appendChild(nameSpan);

    item.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Visual feedback
        item.style.backgroundColor = 'rgba(16, 185, 129, 0.15)';
        item.style.color = '#059669';
        
        api.runtime.sendMessage({
            type: "SEND_TO_FDM",
            url: stream.url,
            filename: stream.title || fileName,
            referer: stream.pageUrl || window.location.href,
            isYoutube: stream.type === 'youtube'
        });
        
        // We only hide the menu after a delay, but we KEEP the main button visible
        setTimeout(() => {
            hideMenu();
            // Restore item style for next time
            item.style.backgroundColor = '';
            item.style.color = '';
        }, 800);
    });

    dropdownMenu.appendChild(item);
}

// --- OPTIMIZED DETECTION ENGINE (2026) ---
const observerOptions = { childList: true, subtree: true };

function handleVideoAttached(video) {
    if (video.dataset.fdmAttached) return;
    video.dataset.fdmAttached = "true";

    video.addEventListener('mouseenter', async () => {
        currentVideo = video;
        let hasStreams = false;
        const videoSrc = video.currentSrc || video.src;
        
        if (videoSrc && !videoSrc.startsWith('blob:')) hasStreams = true;
        else {
            try {
                const streams = await api.runtime.sendMessage({ type: "GET_STREAMS" }) || [];
                if (streams.length > 0) hasStreams = true;
            } catch (e) {}
        }

        if (hasStreams) {
            createFdmButton();
            positionButton(video);
            clearTimeout(hideTimeout);
        }
    });

    video.addEventListener('mouseleave', () => {
        if (dropdownMenu && dropdownMenu.style.visibility === 'visible') return;
        hideTimeout = setTimeout(() => {
            if (fdmButton) fdmButton.style.display = 'none';
        }, 300);
    });
}

const videoObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
            if (node.nodeName === 'VIDEO') {
                handleVideoAttached(node);
            } else if (node.querySelectorAll) {
                node.querySelectorAll('video').forEach(handleVideoAttached);
            }
        }
    }
});

// Initial scan
document.querySelectorAll('video').forEach(handleVideoAttached);
videoObserver.observe(document.body, observerOptions);

window.addEventListener('scroll', () => { if (fdmButton && dropdownMenu && dropdownMenu.style.visibility !== 'visible') fdmButton.style.display = 'none'; }, { passive: true });
window.addEventListener('resize', () => { if (fdmButton && dropdownMenu && dropdownMenu.style.visibility !== 'visible') fdmButton.style.display = 'none'; }, { passive: true });
